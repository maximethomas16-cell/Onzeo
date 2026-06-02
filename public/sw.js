const CACHE_NAME = "fc-regny-shell-v11";
const APP_SHELL = [
  "./",
  "./index.html",
  "./admin.html",
  "./widget.html",
  "./styles.css?v=free-static-1",
  "./app.js?v=free-static-1",
  "./admin.js?v=free-static-1",
  "./widget.js?v=free-static-1",
  "./shared.js",
  "./data-source.js",
  "./config.js",
  "./manifest.webmanifest",
  "./assets/logo-fc-regny.png",
  "./data/season.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isFreshData = url.pathname.endsWith("/data/season.json") || url.pathname.endsWith("/config.js");
  if (isFreshData) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
