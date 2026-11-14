/* Mirella Service Worker: erst Netz, sonst Zwischenspeicher (Updates kommen sofort an, App startet auch offline) */
const C = "mirella-v43";
const FILES = ["./", "./index.html", "./style.css?v=43", "./farbe.css?v=43", "./datum.js?v=43", "./logik.js?v=43", "./app.js?v=43", "./bereiche.js?v=43", "./scan.js?v=43", "./wecker.js?v=43", "./suche.js?v=43", "./ki.js?v=43", "./auswertung.js?v=43", "./export.js?v=43", "./wetter.js?v=43", "./bahn.js?v=43", "./losgehen.js?v=43", "./nfc.js?v=43", "./viewer.js?v=43", "./sync.js?v=43", "./native.js?v=43", "./pc.js?v=43", "./pc.css?v=43", "./zugang.js?v=43", "./zugang.css?v=43", "./logo-final.svg", "./manifest.webmanifest", "./app-icon-180.png", "./app-icon-192.png"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).catch(() => {})); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  e.respondWith(fetch(r).then(res => { if (res.ok && (new URL(r.url).origin === location.origin || r.url.includes("fonts.g"))) { const cl = res.clone(); caches.open(C).then(c => c.put(r, cl)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match("./"))));
});
