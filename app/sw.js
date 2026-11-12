/* Mirella Service Worker: erst Netz, sonst Zwischenspeicher (Updates kommen sofort an, App startet auch offline) */
const C = "mirella-v33";
const FILES = ["./", "./index.html", "./style.css?v=33", "./farbe.css?v=33", "./logik.js?v=33", "./app.js?v=33", "./bereiche.js?v=33", "./scan.js?v=33", "./wecker.js?v=33", "./suche.js?v=33", "./ki.js?v=33", "./auswertung.js?v=33", "./export.js?v=33", "./wetter.js?v=33", "./viewer.js?v=33", "./sync.js?v=33", "./native.js?v=33", "./logo-final.svg", "./manifest.webmanifest", "./app-icon-180.png"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).catch(() => {})); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  e.respondWith(fetch(r).then(res => { if (res.ok && (new URL(r.url).origin === location.origin || r.url.includes("fonts.g"))) { const cl = res.clone(); caches.open(C).then(c => c.put(r, cl)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match("./"))));
});
