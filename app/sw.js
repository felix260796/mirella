/* Mirella Service Worker: erst Netz, sonst Zwischenspeicher (Updates kommen sofort an, App startet auch offline) */
const C = "mirella-v48";
const FILES = ["./", "./index.html", "./frueh.js?v=48", "./style.css?v=48", "./farbe.css?v=48", "./datum.js?v=48", "./logik.js?v=48", "./app.js?v=48", "./bereiche.js?v=48", "./scan.js?v=48", "./wecker.js?v=48", "./suche.js?v=48", "./ki.js?v=48", "./auswertung.js?v=48", "./export.js?v=48", "./wetter.js?v=48", "./bahn.js?v=48", "./losgehen.js?v=48", "./nfc.js?v=48", "./viewer.js?v=48", "./sync.js?v=48", "./karten.js?v=48", "./native.js?v=48", "./pc.js?v=48", "./desktop.js?v=48", "./desktop.css?v=48", "./pc.css?v=48", "./zugang.js?v=48", "./zugang.css?v=48", "./logo-final.svg", "./manifest.webmanifest", "./app-icon-180.png", "./app-icon-192.png"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).catch(() => {})); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url), own = u.origin === location.origin;
  const put = res => { if (res.ok && (own || r.url.includes("fonts.g"))) { const cl = res.clone(); caches.open(C).then(c => c.put(r, cl)); } return res; };
  /* Dateien mit Versionsnummer (?v=) ändern sich nie: sofort aus dem Zwischenspeicher, das macht den Start schnell */
  if (own && /[?&]v=\d+/.test(u.search)) { e.respondWith(caches.match(r).then(m => m || fetch(r).then(put))); return; }
  /* Die Seite selbst: erst Netz (damit Updates sofort ankommen), aber nach 3 Sekunden ohne Antwort aus dem Zwischenspeicher */
  if (r.mode === "navigate") {
    e.respondWith(new Promise(resolve => {
      let done = false; const fin = x => { if (!done && x) { done = true; resolve(x); } };
      const net = fetch(r).then(put);
      net.then(fin).catch(() => caches.match(r).then(m => fin(m || caches.match("./"))));
      setTimeout(() => caches.match(r).then(m => { if (m) fin(m); }), 3000);
    }));
    return;
  }
  e.respondWith(fetch(r).then(put).catch(() => caches.match(r).then(m => m || caches.match("./"))));
});
