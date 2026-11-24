const CACHE = "velora-pwa-v15";
const LIB = "velora-lib-v2";   // pdf.js (cache-first, kept across app updates)
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
const LIBS = ["./lib/pdf.js", "./lib/pdf.worker.js"];

self.addEventListener("install", event => {
  event.waitUntil(Promise.all([
    caches.open(CACHE).then(cache => cache.addAll(SHELL)),
    caches.open(LIB).then(cache => Promise.all(LIBS.map(u => cache.match(u).then(hit => hit || fetch(u).then(r => r.ok ? r.clone().blob().then(b => b.size > 100000 && cache.put(u, r)) : 0).catch(() => {})))))
      .catch(() => {})   // the app still works without it; pdf.js is then fetched on first use
  ]));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE && key !== LIB).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // pdf.js: cache-first
  if (url.pathname.includes("/lib/")) {
    event.respondWith(caches.open(LIB).then(cache => cache.match(request).then(hit => hit || fetch(request).then(response => {
      if (response.status === 200) response.clone().blob().then(b => { if (b.size > 100000) cache.put(request, response.clone()); }).catch(() => {});
      return response;
    }))));
    return;
  }

  // App files: network-first so a published update is never hidden by an old copy
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
