/* Mirella – Briefe und Belege ablegen wie bei einer Sekretärin:
   Foto -> Papier erkennen -> zuschneiden und entzerren (Scan-Modus) -> Text lesen (auf dem Gerät)
   -> Bereich, Art, Betrag und Frist vorschlagen -> ablegen, bei Bedarf Aufgabe anlegen.
   Das Foto wird sofort zwischengespeichert, damit nichts verloren geht, wenn das Fenster zugeht. */
"use strict";
const TMP = "mirella.tmpphoto", TMPID = "tmp_photo";
const OCR_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
let scan = null; // { img, w, h, pts:[[x,y]x4], bw }

function tmpSet(ctx) { try { localStorage.setItem(TMP, JSON.stringify({ kind: ctx.kind, area: ctx.area, ref: ctx.ref || "", t: Date.now() })); } catch (_) { } }
function tmpGet() { try { const d = JSON.parse(localStorage.getItem(TMP) || "null"); return d && Date.now() - d.t < 24 * 3600e3 ? d : null; } catch (_) { return null; } }
function tmpClear() { try { localStorage.removeItem(TMP); } catch (_) { } (typeof origPhotoDel === "function" ? origPhotoDel : photoDel)(TMPID).catch(() => { }); }

photoStart = function (kind, areaId) {
  photoCtx = { kind: kind || null, area: areaId || null, blob: null, url: null, ref: "" };
  openSheet(`<p class="stitle">Foto oder Brief an Mirella</p>
  <p class="swipehint" style="text-align:left;margin:0 0 12px">Brief, Rechnung, Beleg, Dokument oder Einkaufszettel. Bei Papier schneide ich automatisch zu und lese den Text.</p>
  <div style="display:grid;gap:8px"><button class="btn pri" data-act="pickcam">📷 Foto machen</button><button class="btn" data-act="picklib">Aus „Fotos“ wählen</button><button class="btn" data-act="pickpdf">📎 PDF oder Datei</button><button class="btn" data-close="sheet" style="background:none;border:0">Abbrechen</button></div>`);
};
photoChosen = async function (file) {
  if (!file) return;
  try {
    toast("Foto wird vorbereitet …");
    const blob = await shrink(file, 2000, 0.85);
    photoCtx = photoCtx || { kind: null, area: null };
    if (photoCtx.url) URL.revokeObjectURL(photoCtx.url);
    photoCtx.blob = blob; photoCtx.url = URL.createObjectURL(blob); photoCtx.text = ""; photoCtx.guess = null;
    await photoPutLocal(TMPID, blob); tmpSet(photoCtx);
    const k = photoCtx.kind || (photoCtx.area === "geld" ? "beleg" : "dokument");
    if (k === "zettel" || k === "bereich") return photoForm();
    photoCtx.kind = k;
    scanStart();
  } catch (e) { toast(e.message || "Foto konnte nicht gelesen werden"); }
};
/* Zwischenspeicher nur lokal (nicht in den Abgleich) */
async function photoPutLocal(id, blob) { return (typeof origPhotoPut === "function" ? origPhotoPut : photoPut)(id, blob); }

/* ---------- Scan-Modus: Ecken finden, verschieben, entzerren ---------- */
function loadImg(url) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }); }
function findPaper(img) {
  const s = 160 / Math.max(img.naturalWidth, img.naturalHeight), w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
  const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, lum = new Float32Array(w * h), hist = new Array(256).fill(0);
  for (let i = 0; i < w * h; i++) { const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2]; const sat = Math.max(r, gg, b) - Math.min(r, gg, b); const l = 0.299 * r + 0.587 * gg + 0.114 * b - sat * 0.6; lum[i] = l; hist[Math.max(0, Math.min(255, l | 0))]++; }
  // Otsu-Schwelle: Papier ist heller und weniger farbig als der Untergrund
  let sum = 0, sumB = 0, wB = 0, best = 0, thr = 128; for (let i = 0; i < 256; i++) sum += i * hist[i];
  for (let i = 0; i < 256; i++) { wB += hist[i]; if (!wB) continue; const wF = w * h - wB; if (!wF) break; sumB += i * hist[i]; const mB = sumB / wB, mF = (sum - sumB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; thr = i; } }
  // größte helle Fläche (vom Zentrum aus füllen)
  const mask = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) mask[i] = lum[i] > thr ? 1 : 0;
  const seen = new Uint8Array(w * h); let bestC = null;
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || seen[start]) continue;
    const st = [start], comp = []; seen[start] = 1;
    while (st.length) { const p = st.pop(); comp.push(p); const x = p % w, y = (p / w) | 0; for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) if (q >= 0 && mask[q] && !seen[q]) { seen[q] = 1; st.push(q); } }
    if (!bestC || comp.length > bestC.length) bestC = comp;
  }
  if (!bestC) return null;
  const share = bestC.length / (w * h); if (share < 0.15 || share > 0.97) return null;
  let tl, tr, br, bl, a = 1e9, b2 = -1e9, c2 = -1e9, d2 = 1e9;
  for (const p of bestC) { const x = p % w, y = (p / w) | 0; if (x + y < a) { a = x + y; tl = [x, y]; } if (x - y > b2) { b2 = x - y; tr = [x, y]; } if (x + y > c2) { c2 = x + y; br = [x, y]; } if (x - y < d2) { d2 = x - y; bl = [x, y]; } }
  return [tl, tr, br, bl].map(([x, y]) => [x / s, y / s]);
}
async function scanStart() {
  const img = await loadImg(photoCtx.url), w = img.naturalWidth, h = img.naturalHeight;
  const found = findPaper(img), m = 0.04;
  scan = { img, w, h, found: !!found, bw: photoCtx.kind === "dokument", pts: found || [[w * m, h * m], [w * (1 - m), h * m], [w * (1 - m), h * (1 - m)], [w * m, h * (1 - m)]] };
  scanRender();
}
function scanRender() {
  const p = scan.pts.map(([x, y]) => [x / scan.w * 100, y / scan.h * 100]);
  openSheet(`<p class="stitle">${scan.found ? "Papier erkannt: zuschneiden" : "Zuschneiden"}</p>
  <p class="swipehint" style="text-align:left;margin:0 0 8px">${scan.found ? "Ich habe die Ecken gefunden. Passt es nicht, zieh die runden Punkte auf die Ecken des Blatts." : "Zieh die runden Punkte auf die Ecken des Blatts."}</p>
  <div class="scanbox" id="scanbox"><img src="${photoCtx.url}" alt="Dein Foto" draggable="false"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="${p.map(q => q.join(",")).join(" ")}" /></svg>${p.map((q, i) => `<span class="hdl" data-i="${i}" style="left:${q[0]}%;top:${q[1]}%"></span>`).join("")}</div>
  <label class="tgl"><input type="checkbox" id="scan-bw"${scan.bw ? " checked" : ""}> Scan-Look (Schwarz auf Weiß, besser lesbar)</label>
  <div class="row2"><button class="btn" data-act="scanrot" style="flex:none" aria-label="Drehen">⟳</button><button class="btn" data-act="scanskip">Ohne Zuschnitt</button><button class="btn pri" data-act="scanok">Zuschneiden</button></div>
  <div class="row2" style="margin-top:6px"><button class="btn" data-act="photodrop" style="background:none;border:0">Verwerfen</button></div>`);
  sheetCleanup = () => { };
  const box = $("#scanbox"); let drag = null;
  const move = e => { if (drag == null) return; e.preventDefault(); const r = box.getBoundingClientRect(); const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)); scan.pts[drag] = [x * scan.w, y * scan.h]; const h = box.querySelector(`[data-i="${drag}"]`); h.style.left = x * 100 + "%"; h.style.top = y * 100 + "%"; box.querySelector("polygon").setAttribute("points", scan.pts.map(([a, b]) => `${a / scan.w * 100},${b / scan.h * 100}`).join(" ")); };
  box.addEventListener("pointerdown", e => { const h = e.target.closest(".hdl"); if (!h) { // nächsten Punkt nehmen
      const r = box.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * scan.w, y = (e.clientY - r.top) / r.height * scan.h; let bi = 0, bd = 1e18; scan.pts.forEach(([a, b], i) => { const d = (a - x) ** 2 + (b - y) ** 2; if (d < bd) { bd = d; bi = i; } }); drag = bi; } else drag = +h.dataset.i;
    box.setPointerCapture(e.pointerId); move(e); });
  box.addEventListener("pointermove", move);
  box.addEventListener("pointerup", () => { drag = null; }); box.addEventListener("pointercancel", () => { drag = null; });
}
function warp() {
  const [tl, tr, br, bl] = scan.pts, dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  let W = Math.max(dist(tl, tr), dist(bl, br)), H = Math.max(dist(tl, bl), dist(tr, br));
  const k = Math.min(1, 1800 / Math.max(W, H)); W = Math.round(W * k); H = Math.round(H * k);
  const sc = document.createElement("canvas"); sc.width = scan.w; sc.height = scan.h; const sg = sc.getContext("2d"); sg.drawImage(scan.img, 0, 0);
  const src = sg.getImageData(0, 0, scan.w, scan.h).data;
  const out = document.createElement("canvas"); out.width = W; out.height = H; const og = out.getContext("2d"); const od = og.createImageData(W, H), o = od.data;
  const Hm = L.homography(scan.pts, W, H), bw = $("#scan-bw") ? $("#scan-bw").checked : scan.bw;
  let lo = 255, hi = 0; const lums = bw ? new Uint8ClampedArray(W * H) : null;
  for (let v = 0; v < H; v++) for (let u = 0; u < W; u++) {
    const [x, y] = L.mapPt(Hm, u, v), xi = Math.min(scan.w - 1, Math.max(0, x | 0)), yi = Math.min(scan.h - 1, Math.max(0, y | 0)), si = (yi * scan.w + xi) * 4, oi = (v * W + u) * 4;
    if (bw) { const l = 0.299 * src[si] + 0.587 * src[si + 1] + 0.114 * src[si + 2]; lums[v * W + u] = l; if (l < lo) lo = l; if (l > hi) hi = l; }
    else { o[oi] = src[si]; o[oi + 1] = src[si + 1]; o[oi + 2] = src[si + 2]; o[oi + 3] = 255; }
  }
  if (bw) { const span = Math.max(30, hi - lo); for (let i = 0; i < W * H; i++) { let n = (lums[i] - lo) / span; n = n > 0.82 ? 1 : Math.pow(n / 0.82, 1.6); const g = n * 255; o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = g; o[i * 4 + 3] = 255; } }
  og.putImageData(od, 0, 0);
  return new Promise(res => out.toBlob(res, "image/jpeg", 0.85));
}
async function scanDone(doWarp) {
  if (doWarp) { toast("Wird zugeschnitten …"); await new Promise(r => setTimeout(r, 30)); const b = await warp(); if (b) { URL.revokeObjectURL(photoCtx.url); photoCtx.blob = b; photoCtx.url = URL.createObjectURL(b); await photoPutLocal(TMPID, b); } }
  photoForm(); readText();
}
function rotate() {
  const c = document.createElement("canvas"); c.width = scan.h; c.height = scan.w; const g = c.getContext("2d"); g.translate(scan.h, 0); g.rotate(Math.PI / 2); g.drawImage(scan.img, 0, 0);
  c.toBlob(async b => { URL.revokeObjectURL(photoCtx.url); photoCtx.blob = b; photoCtx.url = URL.createObjectURL(b); await photoPutLocal(TMPID, b); scanStart(); }, "image/jpeg", 0.9);
}

/* ---------- Text lesen (auf dem Gerät, Tesseract) und einsortieren ---------- */
let ocrP = null;
function ocrLib() { if (window.Tesseract) return Promise.resolve(window.Tesseract); if (ocrP) return ocrP; ocrP = new Promise((res, rej) => { const s = document.createElement("script"); s.src = OCR_URL; s.onload = () => res(window.Tesseract); s.onerror = () => { ocrP = null; rej(new Error("Texterkennung nicht erreichbar")); }; document.head.appendChild(s); }); return ocrP; }
async function readText() {
  const ctx = photoCtx; if (!ctx || !ctx.blob) return;
  const st = () => $("#ocr-state");
  try {
    st() && (st().textContent = "Mirella liest den Text …");
    const T = await ocrLib();
    const r = await T.recognize(ctx.blob, "deu", { logger: m => { if (m.status === "recognizing text" && st()) st().textContent = `Mirella liest den Text … ${Math.round(m.progress * 100)} %`; } });
    if (photoCtx !== ctx) return;
    ctx.text = (r && r.data && r.data.text || "").trim();
    ctx.guess = L.classifyDoc(ctx.text, today());
    applyGuess();
  } catch (e) { if (st()) st().textContent = "Text konnte ich gerade nicht lesen (" + (e.message || "Fehler") + "). Bitte selbst einsortieren."; }
}
function applyGuess() {
  const g = photoCtx.guess; if (!g) return;
  const set = (id, v) => { const el = document.getElementById(id); if (el && v != null && v !== "" && !el.dataset.touched) el.value = v; };
  if (photoCtx.kind === "dokument") {
    set("d-name", g.title); set("d-area", g.area); set("d-folder", FOLDERS.includes(g.type) ? g.type : (g.type === "Mahnung" ? "Rechnung" : g.type === "Wohnen" || g.type === "Auto" || g.type === "Reise" ? "Brief" : "Sonstiges"));
    if (g.due) set("d-until", g.due);
    const tk = $("#d-task"); if (tk && (g.due || g.amount)) { tk.closest("label").hidden = false; tk.checked = true; $("#d-tasktxt").textContent = taskText(g); }
  }
  if (photoCtx.kind === "beleg") {
    if (g.amount) set("e-amt", String(g.amount).replace(".", ","));
    const first = (photoCtx.text.split("\n").map(x => x.trim()).find(x => /[a-zäöü]{3}/i.test(x)) || "").slice(0, 30); set("e-shop", first);
    const cat = guessCat(photoCtx.text); if (cat !== "Sonstiges") set("e-cat", cat);
  }
  const st = $("#ocr-state"); if (st) st.innerHTML = `<b>Mirella hat gelesen:</b> ${esc(g.title || "Brief")}${g.amount ? " · " + eur(g.amount) : ""}${g.due ? " · Frist " + fmtDate(g.due) : ""}. ${g.sure < 0.5 ? "Ich bin mir nicht ganz sicher, bitte kurz prüfen." : "Prüfen und ablegen."}`;
}
const taskText = g => g.amount ? `Bezahlen: ${eur(g.amount)}${g.due ? " bis " + fmtDate(g.due) : ""}` : `Frist beachten: ${fmtDate(g.due)}`;

photoForm = function () {
  const k = photoCtx.kind || (photoCtx.area === "doku" || !photoCtx.area ? "dokument" : photoCtx.area === "geld" ? "beleg" : "dokument");
  photoCtx.kind = k;
  const kinds = [["dokument", "Brief / Dokument"], ["beleg", "Beleg / Kassenbon"], ["zettel", "Einkaufszettel"], ["bereich", "Foto für Bereich"]];
  const defArea = photoCtx.area && photoCtx.area !== "wecker" ? photoCtx.area : "doku";
  let f = "";
  if (k === "beleg") f = `<div class="fgrid"><div class="fld"><label for="e-amt">Betrag in €</label><input id="e-amt" inputmode="decimal" placeholder="0,00"></div><div class="fld"><label for="e-date">Datum</label><input id="e-date" type="date" value="${today()}"></div></div><div class="fld"><label for="e-shop">Laden</label><input id="e-shop" placeholder="z. B. REWE"></div><div class="fld"><label for="e-cat">Kategorie</label><select id="e-cat">${catList().map(c => `<option>${esc(c)}</option>`).join("")}</select></div>`;
  if (k === "dokument") f = `<div class="fld"><label for="d-name">Was ist das?</label><input id="d-name" placeholder="z. B. Rechnung Telekom"></div>
    <div class="fgrid"><div class="fld"><label for="d-area">Bereich</label><select id="d-area">${AREAS.filter(a => a.id !== "wecker").map(a => `<option value="${a.id}"${a.id === defArea ? " selected" : ""}>${esc(a.id === "doku" ? "Allgemein (Dokumente)" : a.n)}</option>`).join("")}</select></div><div class="fld"><label for="d-folder">Art</label><select id="d-folder">${FOLDERS.map(x => `<option>${x}</option>`).join("")}</select></div></div>
    <div class="fld"><label for="d-until">Frist / gültig bis (freiwillig)</label><input id="d-until" type="date"></div>
    <label class="tgl" hidden><input type="checkbox" id="d-task"> Aufgabe anlegen: <span id="d-tasktxt"></span></label>`;
  if (k === "zettel") f = `<div class="fld"><label for="z-items">Was steht drauf? Eine Zeile pro Artikel, gern mit Menge</label><textarea id="z-items" placeholder="2 Liter Milch&#10;Brot&#10;500 g Hack"></textarea></div><p class="hint">Tipp: Im Textfeld gedrückt halten und „Text scannen“ wählen, dann liest das iPhone den Zettel selbst ab.</p>`;
  if (k === "bereich") f = `<div class="fld"><label for="b-area">Bereich</label><select id="b-area">${AREAS.filter(a => a.id !== "doku" && a.id !== "wecker").map(a => `<option value="${a.id}"${a.id === photoCtx.area ? " selected" : ""}>${esc(a.n)}</option>`).join("")}</select></div><div class="fld"><label for="b-name">Was ist das?</label><input id="b-name" placeholder="z. B. Fahrzeugschein, Typenschild"></div><div class="fld"><label for="b-until">Gültig bis / Frist (freiwillig)</label><input id="b-until" type="date"></div>`;
  openSheet(`<p class="stitle">Wohin damit?</p><img class="photo-prev" src="${photoCtx.url}" alt="Dein Foto">
  ${k === "dokument" || k === "beleg" ? `<div class="hint" id="ocr-state">${photoCtx.guess ? "" : "Mirella liest den Text …"}</div>` : ""}
  <div class="pick">${kinds.map(([v, l]) => `<button data-act="photokind" data-k="${v}" aria-pressed="${v === k}">${l}</button>`).join("")}</div>
  ${f}
  <div class="row2"><button class="btn" data-act="photodrop">Verwerfen</button><button class="btn pri" data-act="photosave">Ablegen</button></div>`);
  sheetCleanup = () => { };
  $("#sheetbody").addEventListener("input", e => { if (e.target.id) e.target.dataset.touched = "1"; });
  $("#sheetbody").addEventListener("change", e => { if (e.target.id && e.target.tagName === "SELECT") e.target.dataset.touched = "1"; });
  if (photoCtx.guess) applyGuess();
};
photoSave = async function () {
  const k = photoCtx.kind;
  if (k === "zettel") {
    const items = $("#z-items").value.split(/\n|,/).map(x => x.trim()).filter(Boolean);
    if (!items.length) { toast("Bitte mindestens einen Artikel eintragen"); return; }
    items.forEach(t => addShop(t)); tmpClear();
    save(); closeSheet(); todoList = "einkauf"; view = "todos"; render(); toast(items.length + " auf die Einkaufsliste"); return;
  }
  if (k === "beleg" && parseAmount($("#e-amt").value) == null) { toast("Bitte den Betrag eintragen"); return; }
  const pid = "ph_" + uid();
  try { await photoPut(pid, photoCtx.blob); } catch (e) { toast("Foto konnte nicht gespeichert werden"); return; }
  tmpClear();
  const text = (photoCtx.text || "").slice(0, 4000);
  if (k === "beleg") {
    const a = parseAmount($("#e-amt").value);
    S.expenses.push({ id: uid(), d: $("#e-date").value || today(), amount: a, shop: $("#e-shop").value.trim(), cat: $("#e-cat").value, photo: pid, text });
    save(); closeSheet(); area = "geld"; view = "bereich"; render(); toast("Beleg abgelegt: " + eur(a)); return;
  }
  if (k === "dokument") {
    const name = $("#d-name").value.trim() || "Brief vom " + fmtDate(today()), ar = $("#d-area").value, until = $("#d-until").value;
    S.docs.push({ id: uid(), name, area: ar, folder: $("#d-folder").value, until, photo: pid, created: today(), text, ref: photoCtx.ref || "" });
    const g = photoCtx.guess;
    if ($("#d-task") && $("#d-task").checked && g) S.todos.push({ id: uid(), t: `${name}: ${taskText(g)}`, list: "todo", done: false, created: today(), date: g.due ? addDays(g.due, -3) < today() ? today() : addDays(g.due, -3) : today(), time: "", trig: "zeit", rep: "nie", area: ar, prio: 1, nerv: !!S.settings.nerv.fristen });
    save(); closeSheet(); area = ar; view = "bereich"; render(); toast(`Abgelegt in ${areaById(ar).id === "doku" ? "Dokumente" : areaById(ar).n} › ${$("#d-folder") ? "" : ""}${name}`); return;
  }
  const ar = $("#b-area").value, name = $("#b-name").value.trim() || "Foto vom " + fmtDate(today());
  S.docs.push({ id: uid(), name, folder: "Foto", until: $("#b-until").value, photo: pid, created: today(), area: ar, ref: photoCtx.ref || "" });
  save(); closeSheet(); area = ar; view = "bereich"; render(); toast("Abgelegt bei " + areaById(ar).n);
};

/* PDF oder Datei aus der Dateien-App */
let pdfRef = "";
async function addDocFile(file) {
  const id = "ph_" + uid(), refIt = pdfRef && S.items.find(x => x.id === pdfRef); pdfRef = "";
  try { await photoPut(id, file); } catch (_) { toast("Datei konnte nicht gespeichert werden"); return; }
  if (refIt) {
    const K = KINDS[refIt.kind], folder = refIt.kind === "versicherung" ? "Versicherung" : refIt.kind === "vertrag" ? "Vertrag" : "Sonstiges";
    S.docs.push({ id, name: `${kindTitle(refIt.kind, refIt)} – ${file.name.replace(/\.[a-z0-9]+$/i, "")}`, area: K.area, folder, until: "", photo: id, created: today(), type: file.type || "application/pdf", ref: refIt.id });
    save(); render(true); itemDetail(refIt); toast("Dokument hängt jetzt fest an „" + kindTitle(refIt.kind, refIt) + "“"); return;
  }
  const g = L.classifyDoc(file.name.replace(/[_-]/g, " "), today());
  const ar = view === "bereich" && area && area !== "wecker" ? area : g.sure > 0 ? g.area : "doku";
  S.docs.push({ id, name: file.name.replace(/\.[a-z0-9]+$/i, ""), area: ar, folder: g.sure > 0 ? (FOLDERS.includes(g.type) ? g.type : "Brief") : "Sonstiges", until: "", photo: id, created: today(), type: file.type || "application/pdf" });
  save(); area = ar; view = "bereich"; render(); toast("Abgelegt: " + file.name + " (antippen zum Ändern)");
}
docRow = function (d) {
  const pdf = /pdf/.test(d.type || "");
  const thumb = pdf ? `<span class="thumbimg pdfthumb">PDF</span>` : `<img class="thumbimg" data-thumb="${d.photo || ""}" alt="">`;
  return `<div class="listrow"><button data-act="viewphoto" data-id="${d.photo || ""}" style="border:0;padding:0;background:none" aria-label="Ansehen">${thumb}</button><span class="grow" role="button" tabindex="0" data-act="editdoc" data-id="${d.id}" style="cursor:pointer">${esc(d.name)}<small>${esc([d.folder, d.until ? (d.until < today() ? "abgelaufen " : "bis ") + fmtDate(d.until) : "", fmtDate(d.created)].filter(Boolean).join(" · "))}</small></span><button class="rowdel" data-act="deldoc" data-id="${d.id}" aria-label="löschen">✕</button></div>`;
};
viewPhoto = async function (id) {
  if (!id) return;
  const b = await photoGet(id).catch(() => null); if (!b) { toast("Datei nicht gefunden"); return; }
  const u = URL.createObjectURL(b), o = document.createElement("div");
  if (/pdf/.test(b.type)) { o.className = "pdfview"; o.innerHTML = `<div class="pdfbar"><b>Dokument</b><a class="mini" href="${u}" target="_blank" rel="noopener" style="text-decoration:none">Teilen / Öffnen</a><button class="iconbtn" aria-label="Schließen">✕</button></div><iframe src="${u}" title="Dokument"></iframe>`; o.querySelector("button").onclick = () => { URL.revokeObjectURL(u); o.remove(); }; }
  else { o.className = "imgfull"; o.innerHTML = `<img src="${u}" alt=""><button aria-label="Schließen">✕</button>`; o.onclick = () => { URL.revokeObjectURL(u); o.remove(); }; }
  document.body.appendChild(o);
};
function docForm(d) {
  openSheet(`<p class="stitle">Dokument</p>
  <div class="fld"><label for="dd-name">Name</label><input id="dd-name" value="${esc(d.name)}"></div>
  <div class="fgrid"><div class="fld"><label for="dd-area">Bereich</label><select id="dd-area">${AREAS.filter(a => a.id !== "wecker").map(a => `<option value="${a.id}"${a.id === (d.area || "doku") ? " selected" : ""}>${esc(a.id === "doku" ? "Allgemein" : a.n)}</option>`).join("")}</select></div><div class="fld"><label for="dd-folder">Art</label><select id="dd-folder">${[...new Set([...FOLDERS, d.folder || "Sonstiges"])].map(x => `<option${x === d.folder ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></div></div>
  <div class="fld"><label for="dd-until">Frist / gültig bis</label><input id="dd-until" type="date" value="${esc(d.until || "")}"></div>
  ${d.text ? `<details class="hint"><summary>Gelesener Text</summary><div style="white-space:pre-wrap;max-height:200px;overflow:auto">${esc(d.text)}</div></details>` : ""}
  <div class="row2"><button class="btn danger" data-act="deldoc" data-id="${d.id}" style="flex:none">Löschen</button><button class="btn" data-act="viewphoto" data-id="${d.photo || ""}">Ansehen</button><button class="btn pri" data-act="savedoc" data-id="${d.id}">Speichern</button></div>`);
}

Object.assign(ACT, {
  pickpdf: () => { pdfRef = ""; const f = $("#f-doc"); f.value = ""; f.click(); },
  pdffor: el => { pdfRef = el.dataset.id; const f = $("#f-doc"); f.value = ""; f.click(); },
  scanok: () => scanDone(true),
  scanskip: () => scanDone(false),
  scanrot: () => rotate(),
  photodrop: () => { if (!ask("Foto verwerfen?")) return; tmpClear(); photoCtx = null; closeSheet(); },
  photokind: el => { photoCtx.kind = el.dataset.k; photoForm(); if ((el.dataset.k === "dokument" || el.dataset.k === "beleg") && !photoCtx.guess) readText(); },
  editdoc: el => { const d = S.docs.find(x => x.id === el.dataset.id); if (d) docForm(d); },
  savedoc: el => { const d = S.docs.find(x => x.id === el.dataset.id); if (!d) return; d.name = $("#dd-name").value.trim() || d.name; d.area = $("#dd-area").value; d.folder = $("#dd-folder").value; d.until = $("#dd-until").value; save(); closeSheet(); render(true); toast("Gespeichert"); },
  resumephoto: async () => { const t = tmpGet(); const b = await photoGet(TMPID).catch(() => null); if (!t || !b) { tmpClear(); render(true); return; } photoCtx = { kind: t.kind, area: t.area, ref: t.ref, blob: b, url: URL.createObjectURL(b), text: "" }; photoForm(); if (photoCtx.kind === "dokument" || photoCtx.kind === "beleg") readText(); }
});
document.addEventListener("change", e => { if (e.target.id === "f-doc" && e.target.files[0]) addDocFile(e.target.files[0]); });
HOOKS.heuteTop.push(() => tmpGet() ? `<div class="card due" role="button" tabindex="0" data-act="resumephoto"><span class="av">📷</span><span style="min-width:0"><div class="t">Foto noch nicht abgelegt</div><div class="s">Antippen, dann geht es genau da weiter</div></span></div>` : "");
HOOKS.search.push(ql => S.docs.filter(d => ((d.name || "") + " " + (d.folder || "") + " " + (d.text || "")).toLowerCase().includes(ql)).map(d => ({ g: "Dokumente", ic: "📄", t: d.name, s: [areaById(d.area || "doku") ? areaById(d.area || "doku").n : "", d.folder, fmtDate(d.created)].filter(Boolean).join(" · "), act: "editdoc", id: d.id })));
