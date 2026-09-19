import { registerSW } from 'virtual:pwa-register';

/**
 * Keeps the running app on the newest deploy.
 *
 * The service worker that makes the scorebook work offline also means a browser
 * will happily keep serving the version it already has. Left alone, a new deploy
 * only appears once every tab showing the app has been closed — which in practice
 * means people carry a stale build around for days.
 *
 * So: check for a new version periodically and whenever the app comes back to the
 * foreground, and hand the decision of *when* to swap to the caller. The app
 * reloads straight away when nothing would be lost, and waits when a game is being
 * scored — a reload there would cost the scorer their undo stack and interrupt a
 * half-finished tap.
 */

const CHECK_EVERY_MS = 30 * 60 * 1000;

let apply: ((reloadPage?: boolean) => Promise<void>) | null = null;
let pending = false;
let reloading = false;
const listeners = new Set<(ready: boolean) => void>();

function announce() {
  for (const listener of listeners) listener(pending);
}

export function initUpdates() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  // Do the reload here rather than leaving it to the registration helper: this
  // fires for the swap however it was triggered, including from another tab.
  //
  // `pending` is the guard, and it is the precise one. The controller also changes
  // the first time a worker claims an uncontrolled page, which is not an update and
  // must not bounce the page. Only a genuine waiting version sets `pending`, via
  // onNeedRefresh below.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!pending || reloading) return;
    reloading = true;
    window.location.reload();
  });

  apply = registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine) void registration.update().catch(() => {});
      };
      setInterval(check, CHECK_EVERY_MS);
      // Coming back to the app is the natural moment to notice a new version —
      // and on a phone it is most of how the app gets opened at all.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      window.addEventListener('online', check);
    },
    onNeedRefresh() {
      pending = true;
      announce();
    },
  });
}

/** Subscribe to "a new version is waiting". Returns an unsubscribe function. */
export function onUpdateReady(listener: (ready: boolean) => void): () => void {
  listeners.add(listener);
  if (pending) listener(true);
  return () => listeners.delete(listener);
}

/**
 * Let the waiting worker take over. The reload follows from `controllerchange`
 * above, so it happens the same way no matter what set the swap going.
 */
export function applyUpdate() {
  void apply?.(false);
}
