/* Mirella Service Worker: erst Netz, sonst Zwischenspeicher (damit Updates sofort ankommen und die App offline startet) */
const C = "mirella-v1";
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(["/", "/index.html", "/style.css?v=1", "/app.js?v=1", "/logo-final.svg", "/manifest.webmanifest", "/app-icon-180.png"]).catch(() => {}))); });
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  e.respondWith(fetch(r).then(res => { if (res.ok && (new URL(r.url).origin === location.origin || r.url.includes("fonts.g"))) { const cl = res.clone(); caches.open(C).then(c => c.put(r, cl)); } return res; }).catch(() => caches.match(r, { ignoreSearch: false }).then(m => m || caches.match("/"))));
});
