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
 * The passcode model has no Supabase user accounts. The `login` edge function
 * checks the passcode against three bcrypt hashes and mints a JWT carrying
 * `app_role`; every request rides on that token, and RLS reads the claim.
 */
export async function clientFor(token: string | null): Promise<SupabaseClient | null> {
  if (!isConfigured) return null;
  // Loaded on demand so a local-only install never pays for the client library,
  // and a phone at the field only fetches it when there is something to sync to.
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(URL!, ANON!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}

export class LoginError extends Error {}

export async function login(passcode: string): Promise<Session> {
  if (!isConfigured) throw new LoginError('No Supabase project is configured.');
  const res = await fetch(`${URL}/functions/v1/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON! },
    body: JSON.stringify({ passcode }),
  });
  if (res.status === 401) throw new LoginError("That passcode doesn't match.");
  if (!res.ok) throw new LoginError(`Sign-in failed (${res.status}). Try again in a moment.`);
  const body = (await res.json()) as Session;
  if (!body?.token || !body?.role) throw new LoginError('Sign-in returned an unexpected response.');
  return body;
}
