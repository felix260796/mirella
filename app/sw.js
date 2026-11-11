/* Mirella Service Worker: erst Netz, sonst Zwischenspeicher (Updates kommen sofort an, App startet auch offline) */
const C = "mirella-v30";
const FILES = ["./", "./index.html", "./style.css?v=30", "./farbe.css?v=30", "./logik.js?v=30", "./app.js?v=30", "./bereiche.js?v=30", "./scan.js?v=30", "./wecker.js?v=30", "./suche.js?v=30", "./ki.js?v=30", "./auswertung.js?v=30", "./export.js?v=30", "./wetter.js?v=30", "./viewer.js?v=30", "./sync.js?v=30", "./native.js?v=30", "./logo-final.svg", "./manifest.webmanifest", "./app-icon-180.png"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).catch(() => {})); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  e.respondWith(fetch(r).then(res => { if (res.ok && (new URL(r.url).origin === location.origin || r.url.includes("fonts.g"))) { const cl = res.clone(); caches.open(C).then(c => c.put(r, cl)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match("./"))));
});
