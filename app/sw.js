/* Mirella Service Worker: erst Netz, sonst Zwischenspeicher (Updates kommen sofort an, App startet auch offline) */
const C = "mirella-v31";
const FILES = ["./", "./index.html", "./style.css?v=31", "./farbe.css?v=31", "./logik.js?v=31", "./app.js?v=31", "./bereiche.js?v=31", "./scan.js?v=31", "./wecker.js?v=31", "./suche.js?v=31", "./ki.js?v=31", "./auswertung.js?v=31", "./export.js?v=31", "./wetter.js?v=31", "./viewer.js?v=31", "./sync.js?v=31", "./native.js?v=31", "./logo-final.svg", "./manifest.webmanifest", "./app-icon-180.png"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).catch(() => {})); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  e.respondWith(fetch(r).then(res => { if (res.ok && (new URL(r.url).origin === location.origin || r.url.includes("fonts.g"))) { const cl = res.clone(); caches.open(C).then(c => c.put(r, cl)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match("./"))));
});
