/* Mirella Service Worker: erst Netz, sonst Zwischenspeicher (Updates kommen sofort an, App startet auch offline) */
const C = "mirella-v37";
const FILES = ["./", "./index.html", "./style.css?v=37", "./farbe.css?v=37", "./datum.js?v=37", "./logik.js?v=37", "./app.js?v=37", "./bereiche.js?v=37", "./scan.js?v=37", "./wecker.js?v=37", "./suche.js?v=37", "./ki.js?v=37", "./auswertung.js?v=37", "./export.js?v=37", "./wetter.js?v=37", "./bahn.js?v=37", "./losgehen.js?v=37", "./viewer.js?v=37", "./sync.js?v=37", "./native.js?v=37", "./logo-final.svg", "./manifest.webmanifest", "./app-icon-180.png"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).catch(() => {})); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  e.respondWith(fetch(r).then(res => { if (res.ok && (new URL(r.url).origin === location.origin || r.url.includes("fonts.g"))) { const cl = res.clone(); caches.open(C).then(c => c.put(r, cl)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match("./"))));
});
