const CACHE = 'warranty-tracker-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/icon.svg',
  '/manifest.json',
];

// Install: cache all assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: delete old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
  // Notify all open tabs that a new version is active
  self.clients.matchAll({ type: 'window' }).then((clients) => {
    clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED' }));
  });
});

// Fetch: cache-first, fall back to network
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
