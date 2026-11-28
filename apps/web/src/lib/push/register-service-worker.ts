/** Registers the service worker that makes the app installable and shows desktop pushes. */
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {
    // A blocked worker only costs installing and desktop pushes.
  });
}
