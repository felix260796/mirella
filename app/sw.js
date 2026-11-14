/* Mirella Service Worker: erst Netz, sonst Zwischenspeicher (Updates kommen sofort an, App startet auch offline) */
const C = "mirella-v40";
const FILES = ["./", "./index.html", "./style.css?v=40", "./farbe.css?v=40", "./datum.js?v=40", "./logik.js?v=40", "./app.js?v=40", "./bereiche.js?v=40", "./scan.js?v=40", "./wecker.js?v=40", "./suche.js?v=40", "./ki.js?v=40", "./auswertung.js?v=40", "./export.js?v=40", "./wetter.js?v=40", "./bahn.js?v=40", "./losgehen.js?v=40", "./viewer.js?v=40", "./sync.js?v=40", "./native.js?v=40", "./pc.js?v=40", "./pc.css?v=40", "./zugang.js?v=40", "./zugang.css?v=40", "./logo-final.svg", "./manifest.webmanifest", "./app-icon-180.png", "./app-icon-192.png"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).catch(() => {})); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  e.respondWith(fetch(r).then(res => { if (res.ok && (new URL(r.url).origin === location.origin || r.url.includes("fonts.g"))) { const cl = res.clone(); caches.open(C).then(c => c.put(r, cl)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match("./"))));
});
