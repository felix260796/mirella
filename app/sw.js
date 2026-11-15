/* Mirella Service Worker: erst Netz, sonst Zwischenspeicher (Updates kommen sofort an, App startet auch offline) */
const C = "mirella-v46";
const FILES = ["./", "./index.html", "./style.css?v=46", "./farbe.css?v=46", "./datum.js?v=46", "./logik.js?v=46", "./app.js?v=46", "./bereiche.js?v=46", "./scan.js?v=46", "./wecker.js?v=46", "./suche.js?v=46", "./ki.js?v=46", "./auswertung.js?v=46", "./export.js?v=46", "./wetter.js?v=46", "./bahn.js?v=46", "./losgehen.js?v=46", "./nfc.js?v=46", "./viewer.js?v=46", "./sync.js?v=46", "./karten.js?v=46", "./native.js?v=46", "./pc.js?v=46", "./desktop.js?v=46", "./desktop.css?v=46", "./pc.css?v=46", "./zugang.js?v=46", "./zugang.css?v=46", "./logo-final.svg", "./manifest.webmanifest", "./app-icon-180.png", "./app-icon-192.png"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).catch(() => {})); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  e.respondWith(fetch(r).then(res => { if (res.ok && (new URL(r.url).origin === location.origin || r.url.includes("fonts.g"))) { const cl = res.clone(); caches.open(C).then(c => c.put(r, cl)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match("./"))));
});
