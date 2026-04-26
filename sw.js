// Service Worker — limpia caché antigua y se desregistra
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// Sin caché — todo directo a red
self.addEventListener('fetch', e => e.respondWith(fetch(e.request)));
