/* Mirella Service Worker: erst Netz, sonst Zwischenspeicher (Updates kommen sofort an, App startet auch offline) */
const C = "mirella-v36";
const FILES = ["./", "./index.html", "./style.css?v=36", "./farbe.css?v=36", "./datum.js?v=36", "./logik.js?v=36", "./app.js?v=36", "./bereiche.js?v=36", "./scan.js?v=36", "./wecker.js?v=36", "./suche.js?v=36", "./ki.js?v=36", "./auswertung.js?v=36", "./export.js?v=36", "./wetter.js?v=36", "./bahn.js?v=36", "./viewer.js?v=36", "./sync.js?v=36", "./native.js?v=36", "./logo-final.svg", "./manifest.webmanifest", "./app-icon-180.png"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).catch(() => {})); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  e.respondWith(fetch(r).then(res => { if (res.ok && (new URL(r.url).origin === location.origin || r.url.includes("fonts.g"))) { const cl = res.clone(); caches.open(C).then(c => c.put(r, cl)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match("./"))));
});
