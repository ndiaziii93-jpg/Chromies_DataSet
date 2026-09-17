// Exchanges a team passcode for a JWT carrying `app_role`.
//
// No imports. Signing a HS256 token and calling one RPC are both a few lines of
// Deno built-ins, and a dependency-free auth endpoint has no version to pin, no
// registry to be down at deploy time, and nothing third-party in the path between
// a passcode and a token.
//
// Deploy: paste into the dashboard's edge function editor, or
//   supabase functions deploy login --no-verify-jwt
// (--no-verify-jwt is right: this is the endpoint people call *before* they have
// a token. Everything it can do is bounded by the checks below.)
//
// Secrets: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase.
// You must set JWT_SECRET (the project's legacy HS256 JWT secret). ALLOWED_ORIGIN
// is optional but worth setting to the deployed site once the URL is settled.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const JWT_SECRET = Deno.env.get('JWT_SECRET')!;
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*';

const SESSION_DAYS = 30;

const cors = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

// --- HS256, by hand -------------------------------------------------------

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const b64urlJson = (value: unknown) => b64url(new TextEncoder().encode(JSON.stringify(value)));

const signingKey = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(JWT_SECRET),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign'],
);

async function signJwt(payload: Record<string, unknown>): Promise<string> {
  const input = `${b64urlJson({ alg: 'HS256', typ: 'JWT' })}.${b64urlJson(payload)}`;
  const sig = await crypto.subtle.sign('HMAC', signingKey, new TextEncoder().encode(input));
  return `${input}.${b64url(new Uint8Array(sig))}`;
}

// --- Brute-force dampening ------------------------------------------------

/**
 * A passcode is a short secret on a public endpoint, so guessing should cost
 * something. Per-instance and best-effort — edge functions scale out and this
 * state is not shared — but it turns a fast online attack into a slow one, and
 * bcrypt handles the rest.
 */
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; until: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hit = attempts.get(ip);
  if (!hit || now > hit.until) {
    attempts.set(ip, { count: 1, until: now + WINDOW_MS });
    return false;
  }
  hit.count += 1;
  return hit.count > MAX_ATTEMPTS;
}

// --- Handler --------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (rateLimited(ip)) return json({ error: 'Too many attempts. Wait a minute.' }, 429);

  let passcode: unknown;
  try {
    passcode = (await req.json())?.passcode;
  } catch {
    return json({ error: 'Expected JSON.' }, 400);
  }
  if (typeof passcode !== 'string' || !passcode.trim() || passcode.length > 200) {
    return json({ error: 'Missing passcode.' }, 400);
  }

  // The bcrypt comparison happens inside Postgres; the hashes never come over
  // the wire, and the service_role key never leaves this function.
  let role: string | null = null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verify_passcode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ passcode: passcode.trim() }),
    });
    if (!res.ok) {
      console.error('verify_passcode failed', res.status, await res.text());
      return json({ error: 'Sign-in is unavailable.' }, 500);
    }
    role = await res.json();
  } catch (err) {
    console.error('verify_passcode threw', err);
    return json({ error: 'Sign-in is unavailable.' }, 500);
  }

  // One response for every wrong passcode: nothing here should tell an attacker
  // which of the three they were close to.
  if (role !== 'manager' && role !== 'scorer' && role !== 'viewer') {
    return json({ error: 'Invalid passcode.' }, 401);
  }

  const now = Math.floor(Date.now() / 1000);
  const token = await signJwt({
    // PostgREST reads `role`; the RLS policies read `app_role`.
    role: 'authenticated',
    app_role: role,
    sub: `team-${role}`,
    aud: 'authenticated',
    iss: `${SUPABASE_URL}/auth/v1`,
    iat: now,
    exp: now + 60 * 60 * 24 * SESSION_DAYS,
  });

  return json({ token, role });
});
