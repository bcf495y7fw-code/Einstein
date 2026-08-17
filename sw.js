const CACHE = 'einstein-v2';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icon.svg',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ASSETS.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;

  if (req.method !== 'GET') return;

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      /* HTML navigation: network-first so updates appear immediately */
      if (req.mode === 'navigate') {
        return fetch(req)
          .then(res => {
            if (res && res.ok) {
              const clone = res.clone();
              caches.open(CACHE).then(c => c.put(req, clone));
            }
            return res;
          })
          .catch(() => hit);
      }

      /* Static assets: stale-while-revalidate */
      const net = fetch(req).then(res => {
        if (res && res.ok && new URL(req.url).origin === location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => hit);

      return hit || net;
    })
  );
});
