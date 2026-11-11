/* Mirella Service Worker: erst Netz, sonst Zwischenspeicher (Updates kommen sofort an, App startet auch offline) */
const C = "mirella-v26";
const FILES = ["./", "./index.html", "./style.css?v=26", "./farbe.css?v=26", "./logik.js?v=26", "./app.js?v=26", "./bereiche.js?v=26", "./scan.js?v=26", "./wecker.js?v=26", "./suche.js?v=26", "./ki.js?v=26", "./auswertung.js?v=26", "./export.js?v=26", "./wetter.js?v=26", "./viewer.js?v=26", "./sync.js?v=26", "./native.js?v=26", "./logo-final.svg", "./manifest.webmanifest", "./app-icon-180.png"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).catch(() => {})); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  e.respondWith(fetch(r).then(res => { if (res.ok && (new URL(r.url).origin === location.origin || r.url.includes("fonts.g"))) { const cl = res.clone(); caches.open(C).then(c => c.put(r, cl)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match("./"))));
});
