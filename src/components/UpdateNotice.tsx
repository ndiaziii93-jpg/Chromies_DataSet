import { useEffect, useState } from 'react';
import { css } from '../lib/css';
import { applyUpdate, onUpdateReady } from '../state/updates';
import { useActiveGame } from '../state/live';

/**
 * Swaps the app onto a new deploy.
 *
 * With nothing in progress it just reloads — the person sees a blink at worst,
 * and never has to know the app updates itself. While a game is being scored it
 * holds off and offers the reload instead: the scorebook itself is safe in
 * localStorage, but the undo stack lives only in memory, and yanking the page
 * mid-inning would take it away along with any half-finished tap.
 */
export function UpdateNotice() {
  const [ready, setReady] = useState(false);
  const active = useActiveGame();
  const scoringNow = active?.status === 'in_progress';

  useEffect(() => onUpdateReady(setReady), []);

  useEffect(() => {
    if (ready && !scoringNow) applyUpdate();
  }, [ready, scoringNow]);

  if (!ready || !scoringNow) return null;

  return (
    <button
      type="button"
      onClick={applyUpdate}
      title="A newer version of the scorebook is ready"
      style={css(
        'position:fixed;left:50%;transform:translateX(-50%);bottom:84px;z-index:10;' +
          'min-height:44px;padding:0 18px;border:0;border-radius:22px;' +
          'background:#FFC400;color:#111111;' +
          "font:600 13px 'IBM Plex Sans',sans-serif;" +
          'box-shadow:0 2px 10px rgba(0,0,0,.35)',
      )}
    >
      Update ready — tap to reload
    </button>
  );
}
