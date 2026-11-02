import type { SupabaseClient } from '@supabase/supabase-js';

export type Role = 'manager' | 'scorer' | 'viewer';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * With no project configured the app runs exactly as the prototype did: one
 * device, localStorage, full rights. Setting both env vars turns on passcode
 * sign-in and server sync with no other code change.
 */
export const isConfigured = Boolean(URL && ANON);

export const SESSION_KEY = 'chromies-auth-v1';

/**
 * One account per role, and the passcode is that account's password.
 *
 * The original design minted its own JWT in an edge function. That is only
 * possible where a project signs with the legacy HS256 shared secret; this one
 * signs with an EC key whose private half Supabase holds and never exposes, so
 * a token we signed ourselves would never verify. Supabase Auth issues the
 * token instead, correctly signed, whatever the project's algorithm — and the
 * role rides in `app_metadata`, which the RLS policies read.
 *
 * Nobody types an email. These addresses are reserved by RFC 2606 and are not
 * deliverable; they exist only so three password records can be told apart.
 * They must match the accounts created in the dashboard exactly.
 */
const ACCOUNTS: { role: Role; email: string }[] = [
  { role: 'manager', email: 'manager@chromies.example.com' },
  { role: 'scorer', email: 'scorer@chromies.example.com' },
  { role: 'viewer', email: 'viewer@chromies.example.com' },
];

export interface Session {
  token: string;
  role: Role;
}

export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return s?.token && s?.role ? s : null;
  } catch {
    return null;
  }
}

export function writeSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Non-fatal: the session just won't survive a reload.
  }
}

/**
 * One client for the whole app. It owns the Supabase Auth session and refreshes
 * the access token in the background, which matters at a field: a game runs
 * longer than a token lives, and a sync that starts failing in the fifth is not
 * something anyone is going to notice until it is too late.
 */
let shared: SupabaseClient | null = null;

async function sharedClient(): Promise<SupabaseClient | null> {
  if (!isConfigured) return null;
  if (shared) return shared;
  // Loaded on demand so a local-only install never pays for the client library,
  // and a phone at the field only fetches it when there is something to sync to.
  const { createClient } = await import('@supabase/supabase-js');
  shared = createClient(URL!, ANON!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'chromies-sb-auth',
    },
  });
  return shared;
}

/**
 * The client every request rides on. The token argument is kept for the call
 * sites that still pass one; the live session is what actually authorises, so a
 * refreshed token is picked up without anything here having to know.
 */
export async function clientFor(_token: string | null): Promise<SupabaseClient | null> {
  return sharedClient();
}

export class LoginError extends Error {}

/** The `app_role` claim, read straight out of the token the server just issued. */
function roleFromToken(token: string): Role | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(json) as {
      app_role?: string;
      app_metadata?: { app_role?: string };
    };
    const found = claims.app_role ?? claims.app_metadata?.app_role;
    return found === 'manager' || found === 'scorer' || found === 'viewer' ? found : null;
  } catch {
    return null;
  }
}

/**
 * Trades a passcode for a session.
 *
 * The passcode does not say which role it is, so each account is tried in turn,
 * highest first. Wrong passcodes cost three failed sign-ins, which Supabase
 * rate-limits for us — better than the hand-rolled limiter this replaced.
 */
export async function login(passcode: string): Promise<Session> {
  if (!isConfigured) throw new LoginError('No Supabase project is configured.');
  const client = await sharedClient();
  if (!client) throw new LoginError('No Supabase project is configured.');

  let rateLimited = false;
  let reachable = false;

  for (const account of ACCOUNTS) {
    const { data, error } = await client.auth.signInWithPassword({
      email: account.email,
      password: passcode,
    });

    if (error) {
      // A 400 is this account saying no; keep going. Anything else is the
      // server itself, and trying the next account will not help.
      if (error.status === 400 || error.status === 401) {
        reachable = true;
        continue;
      }
      if (error.status === 429) {
        rateLimited = true;
        break;
      }
      throw new LoginError(`Sign-in failed (${error.status ?? '?'}). Try again in a moment.`);
    }

    const token = data.session?.access_token;
    if (!token) throw new LoginError('Sign-in returned no session.');

    const role = roleFromToken(token);
    if (!role) {
      // The account exists and the password matched, but nothing stamped its
      // role, so the policies would refuse everything. Say so plainly rather
      // than letting the app look signed in and then fail on every read.
      await client.auth.signOut();
      throw new LoginError(
        'That account has no role set. Run the app_metadata step in docs/SUPABASE_SETUP.md.',
      );
    }
    return { token, role };
  }

  if (rateLimited) throw new LoginError('Too many attempts. Wait a minute and try again.');
  if (reachable) throw new LoginError("That passcode doesn't match.");
  throw new LoginError("Couldn't reach the server. Check your connection and try again.");
}

/** Ends the Supabase session as well as the local record of it. */
export async function endSession(): Promise<void> {
  try {
    const client = await sharedClient();
    await client?.auth.signOut();
  } catch {
    // Signing out locally is what matters; a failed server call is not worth
    // blocking on when someone is handing the phone to the next scorer.
  }
}
