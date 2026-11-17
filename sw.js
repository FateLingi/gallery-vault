const CACHE = "velora-pwa-v6";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  // delete every cache that is not the current one (including old "gallery-pwa-*" caches)
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Network-first for everything on this origin (page, manifest, icons), so a published update
// (e.g. a new app name or icon) is never hidden by an old cached copy. Cache is the offline fallback.
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request).then(response => {
      if (response.status === 200) {
        const copy = response.clone();
        const key = request.mode === "navigate" ? "./index.html" : request;
        caches.open(CACHE).then(cache => cache.put(key, copy)).catch(() => {});
      }
      return response;
    }).catch(() =>
      caches.match(request).then(cached => cached || (request.mode === "navigate" ? caches.match("./index.html") : Response.error()))
    )
  );
});
