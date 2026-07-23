const CACHE = "app-pedidos-v15";
const FILES = [
  "./",
  "index.html",
  "css/style.css",
  "js/main.js",
  "js/db.js",
  "js/pedidos.js",
  "js/platos.js",
  "js/ui.js",
  "js/export.js",
  "lib/dexie.min.js",
  "manifest.json"
];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});