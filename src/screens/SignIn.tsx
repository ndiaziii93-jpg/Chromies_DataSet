import { useEffect, useState, type FormEvent } from 'react';
import { css } from '../lib/css';
import { Wordmark } from '../components/Wordmark';
import { applyTheme } from '../state/theme';
import { login, LoginError, type Session } from '../state/supabase';

/**
 * One passcode per role — no accounts, no email. The passcode is exchanged for a
 * JWT by the `login` edge function; the client never sees the stored hashes.
 */
export function SignIn({ onSignIn }: { onSignIn: (s: Session) => void }) {
  const [passcode, setPasscode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // The sign-in screen renders before a stored preference exists.
  useEffect(() => applyTheme('light'), []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!passcode.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      onSignIn(await login(passcode.trim()));
    } catch (err) {
      setError(
        err instanceof LoginError
          ? err.message
          : "Couldn't reach the server. Check your connection and try again.",
      );
      setBusy(false);
    }
  };

  return (
    <div
      style={css(
        'min-height:100vh;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box',
      )}
    >
      <form
        onSubmit={submit}
        style={css('width:min(380px,100%);display:flex;flex-direction:column;gap:20px')}
      >
        <div style={css('display:flex;justify-content:center')}>
          <Wordmark />
        </div>

        <div style={css('display:flex;flex-direction:column;gap:6px')}>
          <label
            htmlFor="passcode"
            style={css("font:600 11px 'IBM Plex Mono',monospace;letter-spacing:.08em;color:#AAA")}
          >
            TEAM PASSCODE
          </label>
          <input
            id="passcode"
            type="password"
            value={passcode}
            autoComplete="current-password"
            autoFocus
            onChange={(e) => setPasscode(e.target.value)}
            style={css(
              "min-height:52px;border:1.5px solid #444;border-radius:4px;background:#1B1B1B;color:#fff;padding:0 14px;font:500 18px 'IBM Plex Mono',monospace;letter-spacing:.1em;width:100%;box-sizing:border-box",
            )}
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          style={css(
            "min-height:56px;border:0;border-radius:4px;background:#FFC400;color:#111111;font:700 16px 'IBM Plex Sans',sans-serif",
          )}
        >
          {busy ? 'Checking…' : 'Sign in'}
        </button>

        <div
          style={css("min-height:18px;font:500 13px 'IBM Plex Sans',sans-serif;color:#FF9A9A;text-wrap:pretty")}
          role="alert"
        >
          {error}
        </div>

        <div style={css('font-size:13px;line-height:1.6;color:#888;text-wrap:pretty')}>
          Three passcodes, three levels of access: managers edit everything, scorers can score a live game
          and set the opposition lineup, everyone else can read the whole scorebook. Ask a manager for
          yours.
        </div>
      </form>
    </div>
  );
}
