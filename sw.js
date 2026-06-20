/* Aesthete service worker — installable PWA shell.
   Strategy:
   - navigations: network-first (so deploys show up), fall back to cached shell offline
   - same-origin GET assets (icons, manifest): cache-first
   - everything cross-origin (Supabase, Gemini, CDN) and all POSTs: untouched
   The /api/gemini proxy is a POST, so it is never cached. */
const CACHE = 'aesthete-v3';
const SHELL = [
  '/', '/index.html', '/manifest.webmanifest',
  '/icons/icon-180.png', '/icons/icon-192.png', '/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // leave POSTs (incl. /api/gemini) alone
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // leave Supabase / Gemini / CDN alone

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('/', cp)); return r; })
        .catch(() => caches.match('/').then(r => r || caches.match('/index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return r;
    }).catch(() => hit))
  );
});
