/* Mirella Service Worker: erst Netz, sonst Zwischenspeicher (Updates kommen sofort an, App startet auch offline) */
const C = "mirella-v45";
const FILES = ["./", "./index.html", "./style.css?v=45", "./farbe.css?v=45", "./datum.js?v=45", "./logik.js?v=45", "./app.js?v=45", "./bereiche.js?v=45", "./scan.js?v=45", "./wecker.js?v=45", "./suche.js?v=45", "./ki.js?v=45", "./auswertung.js?v=45", "./export.js?v=45", "./wetter.js?v=45", "./bahn.js?v=45", "./losgehen.js?v=45", "./nfc.js?v=45", "./viewer.js?v=45", "./sync.js?v=45", "./native.js?v=45", "./pc.js?v=45", "./desktop.js?v=45", "./desktop.css?v=45", "./pc.css?v=45", "./zugang.js?v=45", "./zugang.css?v=45", "./logo-final.svg", "./manifest.webmanifest", "./app-icon-180.png", "./app-icon-192.png"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).catch(() => {})); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  e.respondWith(fetch(r).then(res => { if (res.ok && (new URL(r.url).origin === location.origin || r.url.includes("fonts.g"))) { const cl = res.clone(); caches.open(C).then(c => c.put(r, cl)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match("./"))));
});
