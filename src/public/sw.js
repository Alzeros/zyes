// zyes service worker — minimal app-shell caching for the PWA.
//
// Deliberately small scope; each request class gets exactly one strategy:
//   * NAVIGATIONS (the HTML shell): network-first, falling back to the cached
//     shell when offline. Network-first means a deploy is picked up on the
//     very next load — no "stuck on the old version" trap.
//   * SAME-ORIGIN STATIC FILES (/assets/*, /icons/*, manifest): cache-first.
//     Vite fingerprints the /assets filenames, so a cached entry can never go
//     stale — an updated app references NEW hashed URLs and the old entries
//     simply stop being requested (and are dropped on the next cache bump).
//   * /api/*: NEVER touched. Data always hits the network (auth headers,
//     freshness). Offline, the shell still opens but data fetches fail — the
//     bookmarks need connectivity to be clickable anyway.
//   * CROSS-ORIGIN (Google Fonts, iconify API, favicon fallbacks): not
//     intercepted; the browser HTTP cache handles those, and each has a
//     system/first-letter fallback in the UI.
//
// Updates: bump CACHE when the caching logic changes. activate() drops every
// other cache and claims open clients, so a new SW applies without a manual
// "close all tabs" dance.

const CACHE = 'zyes-shell-v1';

self.addEventListener('install', (event) => {
  // Pre-cache the shell so the first offline open after install works.
  event.waitUntil(
    caches.open(CACHE).then((c) => c.add('/')).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // cross-origin: hands off
  if (url.pathname.startsWith('/api/')) return; // API: always network, never cached

  // App shell (any navigation — the SPA serves one index.html for all paths):
  // network-first, offline falls back to the cached copy.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/').then((hit) => hit ?? Response.error()))
    );
    return;
  }

  // Static files: cache-first with network fill.
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});
