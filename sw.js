/**
 * ARQiblaMasjid - Service Worker
 * Basic offline cache for core assets.
 */

const CACHE_NAME = "arqibla-cache-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/app.css",
  "/app.js",
  "/manifest.json"
];

// Install: cache core assets
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names
          .filter(function (name) {
            return name !== CACHE_NAME;
          })
          .map(function (name) {
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first, fallback to cache
self.addEventListener("fetch", function (event) {
  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Skip external CDN resources (let them load normally)
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    // For CDN resources, try network only
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        // Cache successful responses
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(function () {
        // Offline: serve from cache
        return caches.match(event.request);
      })
  );
});
