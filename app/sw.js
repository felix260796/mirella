/* Mirella Service Worker: erst Netz, sonst Zwischenspeicher (Updates kommen sofort an, App startet auch offline) */
const C = "mirella-v38";
const FILES = ["./", "./index.html", "./style.css?v=38", "./farbe.css?v=38", "./datum.js?v=38", "./logik.js?v=38", "./app.js?v=38", "./bereiche.js?v=38", "./scan.js?v=38", "./wecker.js?v=38", "./suche.js?v=38", "./ki.js?v=38", "./auswertung.js?v=38", "./export.js?v=38", "./wetter.js?v=38", "./bahn.js?v=38", "./losgehen.js?v=38", "./viewer.js?v=38", "./sync.js?v=38", "./native.js?v=38", "./logo-final.svg", "./manifest.webmanifest", "./app-icon-180.png"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).catch(() => {})); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  e.respondWith(fetch(r).then(res => { if (res.ok && (new URL(r.url).origin === location.origin || r.url.includes("fonts.g"))) { const cl = res.clone(); caches.open(C).then(c => c.put(r, cl)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match("./"))));
});
