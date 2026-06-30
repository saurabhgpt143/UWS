self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => caches.delete(key))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  // Always fetch directly from network without caching to avoid broken bundle paths in Vite
  event.respondWith(fetch(event.request));
});
