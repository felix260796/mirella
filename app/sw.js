/* Mirella Service Worker: erst Netz, sonst Zwischenspeicher (Updates kommen sofort an, App startet auch offline) */
const C = "mirella-v51";
const FILES = ["./", "./index.html", "./frueh.js?v=51", "./style.css?v=51", "./farbe.css?v=51", "./datum.js?v=51", "./logik.js?v=51", "./app.js?v=51", "./bereiche.js?v=51", "./scan.js?v=51", "./wecker.js?v=51", "./suche.js?v=51", "./ki.js?v=51", "./auswertung.js?v=51", "./export.js?v=51", "./wetter.js?v=51", "./bahn.js?v=51", "./losgehen.js?v=51", "./nfc.js?v=51", "./viewer.js?v=51", "./sync.js?v=51", "./karten.js?v=51", "./native.js?v=51", "./pc.js?v=51", "./desktop.js?v=51", "./desktop.css?v=51", "./pc.css?v=51", "./zugang.js?v=51", "./zugang.css?v=51", "./logo-final.svg", "./manifest.webmanifest", "./app-icon-180.png", "./app-icon-192.png"];
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
