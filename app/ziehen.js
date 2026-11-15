/* Mirella – Nach unten ziehen zum Abgleichen (iPhone und iPad, alles mit Touch).
   Ganz oben in einer Liste nach unten ziehen und loslassen: Mirella gleicht sofort mit den anderen Geräten ab. */
"use strict";
(function () {
  if (!("ontouchstart" in window) || typeof sync !== "function") return;
  const GO = 110; // so weit ziehen (Pixel), dann wird abgeglichen
  const ind = document.createElement("div");
  ind.id = "ptr";
  ind.style.cssText = "position:fixed;left:50%;top:calc(env(safe-area-inset-top, 0px) + 6px);z-index:9999;transform:translate(-50%,-70px);opacity:0;" +
    "background:var(--surface,#fff);color:var(--ink,#141416);border:1px solid var(--line,#E2E2DD);border-radius:99px;padding:8px 16px;font-size:14px;" +
    "box-shadow:0 6px 20px rgba(20,20,22,.15);pointer-events:none;transition:opacity .15s;white-space:nowrap";
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(ind));
  if (document.body) document.body.appendChild(ind);

  const scroller = el => {
    for (let e = el; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      const o = getComputedStyle(e).overflowY;
      if ((o === "auto" || o === "scroll") && e.scrollHeight > e.clientHeight + 1) return e;
    }
    return document.scrollingElement || document.documentElement;
  };
  const blocked = el => !!(el.closest && el.closest(".sheet, #sheet, .pdfview, .zv, input, textarea, select, [contenteditable]")) ||
    !!document.querySelector("#sheet.open, .sheet.open, .pdfview, .zv");

  let y0 = null, x0 = 0, sc = null, d = 0, busy = false;
  const show = (txt, dy) => { ind.textContent = txt; ind.style.opacity = "1"; ind.style.transform = "translate(-50%," + dy + "px)"; };
  const hide = () => { ind.style.opacity = "0"; ind.style.transform = "translate(-50%,-70px)"; };

  document.addEventListener("touchstart", e => {
    y0 = null; d = 0;
    if (busy || e.touches.length !== 1 || blocked(e.target)) return;
    sc = scroller(e.target);
    if (sc.scrollTop > 0) return;
    y0 = e.touches[0].clientY; x0 = e.touches[0].clientX;
  }, { passive: true });

  document.addEventListener("touchmove", e => {
    if (y0 === null) return;
    const t = e.touches[0], dy = t.clientY - y0;
    if (sc.scrollTop > 0 || dy <= 0 || Math.abs(t.clientX - x0) > Math.abs(dy)) { hide(); y0 = null; d = 0; return; }
    d = dy;
    if (d > 20) show(d >= GO ? "Loslassen zum Abgleichen" : "↓ Zum Abgleichen ziehen", Math.min(d / 2, 50) - 10);
  }, { passive: true });

  document.addEventListener("touchend", async () => {
    if (y0 === null) return;
    y0 = null;
    if (d < GO) { hide(); d = 0; return; }
    d = 0;
    if (typeof syOn === "function" && !syOn()) { hide(); if (typeof toast === "function") toast("Abgleich ist aus: bitte erst anmelden"); return; }
    busy = true; show("Gleiche ab …", 40);
    try { await sync(true); if (typeof render === "function") render(true); } finally { busy = false; hide(); }
  });
  document.addEventListener("touchcancel", () => { y0 = null; d = 0; hide(); });
})();
