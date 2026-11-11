/* Mirella Service Worker: erst Netz, sonst Zwischenspeicher (Updates kommen sofort an, App startet auch offline) */
const C = "mirella-v27";
const FILES = ["./", "./index.html", "./style.css?v=27", "./farbe.css?v=27", "./logik.js?v=27", "./app.js?v=27", "./bereiche.js?v=27", "./scan.js?v=27", "./wecker.js?v=27", "./suche.js?v=27", "./ki.js?v=27", "./auswertung.js?v=27", "./export.js?v=27", "./wetter.js?v=27", "./viewer.js?v=27", "./sync.js?v=27", "./native.js?v=27", "./logo-final.svg", "./manifest.webmanifest", "./app-icon-180.png"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).catch(() => {})); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  e.respondWith(fetch(r).then(res => { if (res.ok && (new URL(r.url).origin === location.origin || r.url.includes("fonts.g"))) { const cl = res.clone(); caches.open(C).then(c => c.put(r, cl)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match("./"))));
});
