// Exchanges a team passcode for a short-lived JWT carrying `app_role`.
//
// Deployed with:  supabase functions deploy login --no-verify-jwt
// (--no-verify-jwt because this is the endpoint people call *before* they have a
// token; everything it can do is bounded by the checks below.)
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and JWT_SECRET are
// injected by Supabase; ALLOWED_ORIGIN should be set to the deployed site.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const JWT_SECRET = Deno.env.get('JWT_SECRET')!;

// Set this to the deployed origin (e.g. https://ndiaziii93-jpg.github.io).
// Left unset it allows any origin, which is fine while you are still setting up
// but worth locking down once the URL is settled.
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

/**
 * A passcode is a short secret on a public endpoint, so it is worth making
 * guessing expensive. Per-instance and best-effort — edge functions scale out and
 * this state is not shared — but it turns a fast online attack into a slow one,
 * and bcrypt handles the rest.
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

const signingKey = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(JWT_SECRET),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign'],
);

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

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // The bcrypt comparison happens in Postgres; the hashes never come over the wire.
  const { data: role, error } = await sb.rpc('verify_passcode', { passcode: passcode.trim() });
  if (error) {
    console.error('verify_passcode failed', error);
    return json({ error: 'Sign-in is unavailable.' }, 500);
  }
  // Same response shape and timing for every wrong passcode: nothing here should
  // tell an attacker which of the three they were close to.
  if (!role) return json({ error: 'Invalid passcode.' }, 401);

  const token = await create(
    { alg: 'HS256', typ: 'JWT' },
    {
      // PostgREST reads `role`; the RLS policies read `app_role`.
      role: 'authenticated',
      app_role: role,
      sub: `team-${role}`,
      aud: 'authenticated',
      iss: `${SUPABASE_URL}/auth/v1`,
      iat: getNumericDate(0),
      exp: getNumericDate(60 * 60 * 24 * SESSION_DAYS),
    },
    signingKey,
  );

  return json({ token, role });
});
