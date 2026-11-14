/* Mirella Service Worker: erst Netz, sonst Zwischenspeicher (Updates kommen sofort an, App startet auch offline) */
const C = "mirella-v44";
const FILES = ["./", "./index.html", "./style.css?v=44", "./farbe.css?v=44", "./datum.js?v=44", "./logik.js?v=44", "./app.js?v=44", "./bereiche.js?v=44", "./scan.js?v=44", "./wecker.js?v=44", "./suche.js?v=44", "./ki.js?v=44", "./auswertung.js?v=44", "./export.js?v=44", "./wetter.js?v=44", "./bahn.js?v=44", "./losgehen.js?v=44", "./nfc.js?v=44", "./viewer.js?v=44", "./sync.js?v=44", "./native.js?v=44", "./pc.js?v=44", "./desktop.js?v=44", "./desktop.css?v=44", "./pc.css?v=44", "./zugang.js?v=44", "./zugang.css?v=44", "./logo-final.svg", "./manifest.webmanifest", "./app-icon-180.png", "./app-icon-192.png"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).catch(() => {})); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  e.respondWith(fetch(r).then(res => { if (res.ok && (new URL(r.url).origin === location.origin || r.url.includes("fonts.g"))) { const cl = res.clone(); caches.open(C).then(c => c.put(r, cl)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match("./"))));
});
