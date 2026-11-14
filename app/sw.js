/* Mirella Service Worker: erst Netz, sonst Zwischenspeicher (Updates kommen sofort an, App startet auch offline) */
const C = "mirella-v42";
const FILES = ["./", "./index.html", "./style.css?v=42", "./farbe.css?v=42", "./datum.js?v=42", "./logik.js?v=42", "./app.js?v=42", "./bereiche.js?v=42", "./scan.js?v=42", "./wecker.js?v=42", "./suche.js?v=42", "./ki.js?v=42", "./auswertung.js?v=42", "./export.js?v=42", "./wetter.js?v=42", "./bahn.js?v=42", "./losgehen.js?v=42", "./viewer.js?v=42", "./sync.js?v=42", "./native.js?v=42", "./pc.js?v=42", "./pc.css?v=42", "./zugang.js?v=42", "./zugang.css?v=42", "./logo-final.svg", "./manifest.webmanifest", "./app-icon-180.png", "./app-icon-192.png"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).catch(() => {})); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  e.respondWith(fetch(r).then(res => { if (res.ok && (new URL(r.url).origin === location.origin || r.url.includes("fonts.g"))) { const cl = res.clone(); caches.open(C).then(c => c.put(r, cl)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match("./"))));
});
