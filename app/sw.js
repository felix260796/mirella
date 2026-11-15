/* Mirella Service Worker: erst Netz, sonst Zwischenspeicher (Updates kommen sofort an, App startet auch offline) */
const C = "mirella-v50";
const FILES = ["./", "./index.html", "./frueh.js?v=50", "./style.css?v=50", "./farbe.css?v=50", "./datum.js?v=50", "./logik.js?v=50", "./app.js?v=50", "./bereiche.js?v=50", "./scan.js?v=50", "./wecker.js?v=50", "./suche.js?v=50", "./ki.js?v=50", "./auswertung.js?v=50", "./export.js?v=50", "./wetter.js?v=50", "./bahn.js?v=50", "./losgehen.js?v=50", "./nfc.js?v=50", "./viewer.js?v=50", "./sync.js?v=50", "./karten.js?v=50", "./native.js?v=50", "./pc.js?v=50", "./desktop.js?v=50", "./desktop.css?v=50", "./pc.css?v=50", "./zugang.js?v=50", "./zugang.css?v=50", "./logo-final.svg", "./manifest.webmanifest", "./app-icon-180.png", "./app-icon-192.png"];
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
