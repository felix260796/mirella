/* Mirella Service Worker: erst Netz, sonst Zwischenspeicher (Updates kommen sofort an, App startet auch offline) */
const C = "mirella-v41";
const FILES = ["./", "./index.html", "./style.css?v=41", "./farbe.css?v=41", "./datum.js?v=41", "./logik.js?v=41", "./app.js?v=41", "./bereiche.js?v=41", "./scan.js?v=41", "./wecker.js?v=41", "./suche.js?v=41", "./ki.js?v=41", "./auswertung.js?v=41", "./export.js?v=41", "./wetter.js?v=41", "./bahn.js?v=41", "./losgehen.js?v=41", "./viewer.js?v=41", "./sync.js?v=41", "./native.js?v=41", "./pc.js?v=41", "./pc.css?v=41", "./zugang.js?v=41", "./zugang.css?v=41", "./logo-final.svg", "./manifest.webmanifest", "./app-icon-180.png", "./app-icon-192.png"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).catch(() => {})); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  e.respondWith(fetch(r).then(res => { if (res.ok && (new URL(r.url).origin === location.origin || r.url.includes("fonts.g"))) { const cl = res.clone(); caches.open(C).then(c => c.put(r, cl)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match("./"))));
});
