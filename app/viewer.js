/* Mirella – Bild- und PDF-Ansicht mit Zoomen
   Zwei Finger auseinanderziehen, doppelt tippen oder die Knöpfe − / +. PDFs zeichnet pdf.js als Seiten,
   damit sie auf dem iPhone auch in der Home-Bildschirm-App zoombar sind. */
"use strict";
/* pdf.js 3.11.174 liegt fest in app/vendor, nichts wird von fremden Servern geladen */
const PDFJS = new URL("./vendor/pdfjs/", location.href).href;
let pdfLibP = null;
function pdfLib() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!pdfLibP) pdfLibP = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = PDFJS + "pdf.min.js";
    s.onload = () => { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; res(window.pdfjsLib); } catch (e) { rej(e); } };
    s.onerror = () => { pdfLibP = null; rej(new Error("pdf.js nicht ladbar")); };
    document.head.appendChild(s);
  });
  return pdfLibP;
}

/* blob: Bild oder PDF; name: Titel oben */
async function openViewer(blob, name) {
  document.querySelectorAll(".zv").forEach(x => x.remove());
  const isPdf = /pdf/.test(blob.type || "") || /\.pdf$/i.test(name || "");
  const url = URL.createObjectURL(isPdf && !blob.type ? new Blob([blob], { type: "application/pdf" }) : blob);
  const o = document.createElement("div"); o.className = "zv";
  o.innerHTML = `<div class="zvbar"><b>${esc(name || (isPdf ? "Dokument" : "Foto"))}</b><button class="iconbtn" data-z="-1" aria-label="Verkleinern">−</button><button class="iconbtn" data-z="1" aria-label="Vergrößern">+</button><a class="mini" href="${url}" target="_blank" rel="noopener" style="text-decoration:none">Öffnen</a><button class="iconbtn" data-x="1" aria-label="Schließen">✕</button></div><div class="zvs"><div class="zvc">${isPdf ? '<p class="zvload">Dokument wird geladen …</p>' : `<img src="${url}" alt="">`}</div></div>`;
  document.body.appendChild(o);
  const sc = o.querySelector(".zvs"), ct = o.querySelector(".zvc");
  let z = 1;
  const close = () => { URL.revokeObjectURL(url); o.remove(); if (typeof render === "function" && !$("#sheet").classList.contains("open")) render(true); };
  const setZ = (nz, cx, cy) => {
    nz = Math.max(1, Math.min(6, nz)); const r = sc.getBoundingClientRect();
    cx = cx == null ? r.width / 2 : cx; cy = cy == null ? r.height / 2 : cy;
    const px = (sc.scrollLeft + cx) / z, py = (sc.scrollTop + cy) / z;
    z = nz; ct.style.width = (z * 100) + "%";
    sc.scrollLeft = px * z - cx; sc.scrollTop = py * z - cy;
    o.classList.toggle("zoomed", z > 1.01);
  };
  o.querySelector("[data-x]").onclick = close;
  o.querySelectorAll("[data-z]").forEach(b => b.onclick = () => setZ(z * (+b.dataset.z > 0 ? 1.5 : 1 / 1.5)));
  // Zwei-Finger-Zoom
  let pin = null, lastTap = 0;
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  sc.addEventListener("touchstart", e => {
    if (e.touches.length === 2) { const r = sc.getBoundingClientRect(); pin = { d: dist(e.touches), z, cx: (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left, cy: (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top, s: 1 }; e.preventDefault(); }
    else if (e.touches.length === 1) { const now = Date.now(); if (now - lastTap < 300) { const r = sc.getBoundingClientRect(); setZ(z > 1.2 ? 1 : 2.5, e.touches[0].clientX - r.left, e.touches[0].clientY - r.top); e.preventDefault(); lastTap = 0; } else lastTap = now; }
  }, { passive: false });
  sc.addEventListener("touchmove", e => {
    if (!pin || e.touches.length !== 2) return; e.preventDefault();
    pin.s = Math.max(1 / pin.z, Math.min(6 / pin.z, dist(e.touches) / pin.d));
    ct.style.transformOrigin = `${sc.scrollLeft + pin.cx}px ${sc.scrollTop + pin.cy}px`; ct.style.transform = `scale(${pin.s})`;
  }, { passive: false });
  sc.addEventListener("touchend", e => { if (!pin || e.touches.length >= 2) return; const p = pin; pin = null; ct.style.transform = ""; setZ(p.z * p.s, p.cx, p.cy); });
  // Mausrad mit Strg (PC/iPad mit Trackpad)
  sc.addEventListener("wheel", e => { if (!e.ctrlKey) return; e.preventDefault(); const r = sc.getBoundingClientRect(); setZ(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  if (!isPdf) return o;
  try {
    const lib = await pdfLib();
    const doc = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
    ct.innerHTML = "";
    const want = Math.min(1600, Math.round(Math.min(innerWidth, 900) * (window.devicePixelRatio || 1) * 1.5));
    for (let i = 1; i <= doc.numPages; i++) {
      if (!o.isConnected) return;
      const pg = await doc.getPage(i), v1 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: want / v1.width });
      const c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height); c.setAttribute("aria-label", "Seite " + i);
      const wrap = document.createElement("div"); wrap.className = "zvp"; wrap.dataset.page = i; wrap.appendChild(c);
      ct.appendChild(wrap);
      await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      // Verweise im PDF antippbar machen: Sprünge im Dokument (z. B. „Vertiefung“) und Links nach außen
      try {
        for (const an of await pg.getAnnotations()) {
          if (an.subtype !== "Link" || !an.rect || !(an.dest || an.url)) continue;
          const r = lib.Util.normalizeRect(vp.convertToViewportRectangle(an.rect));
          const l = document.createElement("a"); l.className = "zvl"; l.setAttribute("role", "link"); l.setAttribute("aria-label", an.url ? "Link öffnen" : "Zur Stelle im Dokument springen");
          l.style.cssText = `left:${r[0] / vp.width * 100}%;top:${r[1] / vp.height * 100}%;width:${(r[2] - r[0]) / vp.width * 100}%;height:${(r[3] - r[1]) / vp.height * 100}%`;
          if (an.url) { l.href = an.url; l.target = "_blank"; l.rel = "noopener"; }
          else l.onclick = async e => {
            e.preventDefault();
            try {
              const d = typeof an.dest === "string" ? await doc.getDestination(an.dest) : an.dest; if (!d) return;
              const pi = typeof d[0] === "object" ? await doc.getPageIndex(d[0]) : +d[0];
              const tw = ct.querySelector(`.zvp[data-page="${pi + 1}"]`); if (!tw) return;
              let frac = 0;
              try { const tp = await doc.getPage(pi + 1), tv = tp.getViewport({ scale: 1 }); const y = d[1] && d[1].name === "XYZ" ? d[3] : d[1] && /^FitB?H$/.test(d[1].name) ? d[2] : null; if (y != null) frac = Math.max(0, Math.min(1, tv.convertToViewportPoint(0, y)[1] / tv.height)); } catch (_) { }
              sc.scrollTo({ top: Math.max(0, tw.offsetTop + tw.offsetHeight * frac - 8), behavior: "smooth" });
            } catch (_) { }
          };
          wrap.appendChild(l);
        }
      } catch (_) { }
    }
  } catch (e) {
    // ohne Netz oder bei Fehlern: wie bisher im eingebauten Anzeiger
    ct.innerHTML = `<iframe src="${url}" title="${esc(name || "Dokument")}" style="width:100%;height:80vh;border:0;background:#fff"></iframe><p class="zvload">Zoomen geht gerade nicht (keine Verbindung). Über „Öffnen“ kannst du das PDF in Safari zoomen.</p>`;
  }
  return o;
}

/* Alle Ansichten der App laufen über den Zoom-Anzeiger */
viewPhoto = async function (id) {
  if (!id) return;
  const b = await photoGet(id).catch(() => null); if (!b) { toast("Datei nicht gefunden"); return; }
  const d = (S.docs || []).find(x => x.photo === id);
  openViewer(b, d ? d.name : "");
};
openBrief = async function (id) {
  const b = S.briefings.find(x => x.id === id); if (!b) return;
  if (b.remote) {
    if (!b.pdf) { toast("Das PDF ist noch nicht da. Es kommt in wenigen Minuten."); return; }
    b.read = true; save();
    try { const r = await fetch(webBase() + b.pdf, { cache: "no-store" }); if (!r.ok) throw new Error(); const bl = await r.blob(); openViewer(bl.type ? bl : new Blob([bl], { type: "application/pdf" }), "Briefing " + fmtDate(b.d)); }
    catch (_) { window.open(webBase() + b.pdf, "_blank", "noopener"); }
    return;
  }
  const blob = await photoGet(id).catch(() => null); if (!blob) { toast("Datei nicht gefunden"); return; }
  b.read = true; save();
  openViewer(blob.type ? blob : new Blob([blob], { type: b.type || "application/pdf" }), b.name || "Briefing");
};
