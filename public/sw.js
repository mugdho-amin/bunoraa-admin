const CACHE = "bunoraa-admin-v2-cache-v1";
const OFFLINE_URL = "/login";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      fetch(OFFLINE_URL).then((response) => {
        if (response.ok || response.type === "opaqueredirect") {
          return cache.put(OFFLINE_URL, response);
        }
      }).catch(() => {
        // Backend unavailable — skip caching offline page.
        // SW installation should not fail because of a downstream service.
      }),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL)),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
  );
});
