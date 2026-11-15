/* Mirella – Programm für den Windows-Computer (v0.40, Entwurf von Felix abgesegnet 14.11.2026)
   Aufbau wie ein klassisches Windows-Programm (Outlook / Explorer):
   ganz oben links die Menüleiste (Datei, Bearbeiten, Ansicht, …), darunter die Symbolleiste,
   links der Ordner-Baum, in der Mitte Tabellen mit Spalten (Zellen direkt änderbar),
   rechts das Formular mit allen Feldern (Tab von Feld zu Feld, Strg+S speichert), unten die Statusleiste.
   Jeder Bereich ist eigens umgesetzt: Übersicht, Kontakte, Aufgaben, Einkauf, Kalender, alle Rubriken
   (Finanzen, Verträge, Zuhause, Auto, Gesundheit, Arbeit, Sport, Dokumente, Freizeit), Briefings, Wetter, Einstellungen.
   Gilt nur im Browser auf einem breiten Bildschirm mit Maus (ab 1100 Pixel). iPhone, iPad und schmales
   Fenster bleiben unverändert. Gelesen und geschrieben wird nur über die bestehenden Daten und Funktionen. */
"use strict";
(function () {
  if (NATIVE) return;
  const MQ = window.matchMedia ? window.matchMedia("(min-width: 1100px) and (pointer: fine)") : null;
  const root = document.documentElement;
  let on = false, installEvt = null, lastKey = "";

  /* ---------- Oberfläche merken (nur dieses Gerät) ---------- */
  const PK = "mirella.desktop2";
  let P = { nav: 1, det: 1, dw: 560, fold: { aufgaben: 1 } };
  try { P = Object.assign(P, JSON.parse(localStorage.getItem(PK) || "{}")); } catch (_) { }
  if (!P.fold) P.fold = {};
  const pSave = () => { try { localStorage.setItem(PK, JSON.stringify(P)); } catch (_) { } };

  /* ---------- Symbole ---------- */
  const sv = (d, w) => `<svg viewBox="0 0 24 24" width="${w || 16}" height="${w || 16}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const I = {
    newp: '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20c0-3.6 2.9-6.5 6.5-6.5 1.6 0 3 .5 4.1 1.4M18 14v6M15 17h6"/>',
    newt: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M12 8v8M8 12h8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
    del: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    check: '<path d="M4 12.5l5 5L20 6.5"/>',
    wa: '<path d="M4 20l1.5-4A8 8 0 1 1 8 18.5z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    cycle: '<path d="M4 12a8 8 0 1 1 3 6.2M4 19v-5h5"/>',
    arch: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v10h14V9M10 13h4"/>',
    imp: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    exp: '<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>',
    print: '<path d="M6 9V3h12v6M6 17H4v-7h16v7h-2M7 14h10v7H7z"/>',
    sync: '<path d="M20 11a8 8 0 0 0-14.3-4.9M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9M20 20v-4h-4"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    today: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><rect x="10" y="13" width="4" height="4" rx=".5"/>',
    prev: '<path d="M15 6l-6 6 6 6"/>', next: '<path d="M9 6l6 6-6 6"/>',
    flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
    cart: '<circle cx="9" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/><path d="M2 3h3l2.6 12.2a1 1 0 0 0 1 .8h9.7a1 1 0 0 0 1-.8L21 7H6"/>',
    tpl: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    clean: '<path d="M4 20h16M7 16l9-9 3 3-9 9H7z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    pdf: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 15h6M12 12v6"/>',
    cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    note: '<path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4M8 9h8M8 13h5"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    euro: '<path d="M17 6.5A7 7 0 1 0 17 17.5M4 10h9M4 14h9"/>',
    goal: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.2A5 5 0 0 1 21 19"/>',
    task: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 12l3 3 5-6"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12"/>',
    none: '<circle cx="12" cy="12" r="8"/><path d="M6.5 17.5l11-11"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
    side: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    open: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
    chart: '<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3"/>',
    pin: '<path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/>',
    sick: '<path d="M12 3v10M9 6h6"/><circle cx="12" cy="17" r="4"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>'
  };
  const ic = (k, w) => sv(I[k] || I.doc, w);

  /* ================================================================
     Rückgängig / Wiederholen (Strg+Z, Strg+Y)
     ================================================================ */
  const UNDO = [], REDO = [];
  let base = null, lastMsg = "";
  const snap = () => { try { return JSON.stringify(S); } catch (_) { return null; } };
  const origSaveDt = save;
  save = function () {
    const r = origSaveDt.apply(this, arguments);
    if (on) { const now = snap(); if (base && now && now !== base) { UNDO.push({ s: base, m: lastMsg }); if (UNDO.length > 40) UNDO.shift(); REDO.length = 0; } base = now; }
    else base = null;
    return r;
  };
  if (typeof syApply === "function") { const oa = syApply; syApply = function () { const r = oa.apply(this, arguments); UNDO.length = 0; REDO.length = 0; base = snap(); return r; }; }
  const origToast = toast;
  toast = function (m) { lastMsg = String(m || ""); return origToast.apply(this, arguments); };
  function restore(from, to, word) {
    const e = from.pop(); if (!e) { origToast(word === "undo" ? "Nichts zum Rückgängigmachen" : "Nichts zum Wiederholen"); return; }
    to.push({ s: snap(), m: e.m });
    const keep = {}; (typeof LOCAL_ONLY !== "undefined" ? LOCAL_ONLY : []).forEach(k => { keep[k] = S.settings[k]; });
    S = JSON.parse(e.s); Object.assign(S.settings, keep);
    base = snap(); origSaveDt(); closeAll(); fDirty = false; iDirty = false; ED = null;
    if (view === "akte" && !S.people.some(p => p.id === cur)) view = "menschen";
    render(true);
    origToast((word === "undo" ? "Rückgängig" : "Wiederholt") + (e.m ? ": " + e.m.replace(/^Gespeichert:?\s*/, "") : ""));
  }
  const undo = () => restore(UNDO, REDO, "undo"), redo = () => restore(REDO, UNDO, "redo");

  /* ================================================================
     Tabellen: Auswahl (Strg / Umschalt), Sortieren, Zellen ändern
     p Kontakte, t Aufgaben, s Einkauf, i Einträge eines Bereichs, e Ausgaben, g Sparziele, d Dokumente, n Notizen, r Briefings
     ================================================================ */
  const SEL = { k: new Set(), p: new Set(), t: new Set(), s: new Set(), i: new Set(), e: new Set(), g: new Set(), d: new Set(), n: new Set(), r: new Set() };
  const ANCH = {}, CUR = {}, ACOL = {};
  let ED = null; // gerade geänderte Zelle { tb, id, k }
  const TB = {};
  const SORT = { p: { k: "last", d: 1 }, n: { k: "d", d: -1 }, d: { k: "created", d: -1 }, e: { k: "d", d: -1 }, r: { k: "d", d: -1 } };
  const selOf = tb => [...SEL[tb]].map(id => TB[tb].find(id)).filter(Boolean);
  function curOf(tb) { return tb === "p" ? (view === "akte" ? cur : null) : CUR[tb] || null; }
  function setCur(tb, id) { if (tb === "p") { if (id) { cur = id; view = "akte"; } else view = "menschen"; } else CUR[tb] = id; }
  function pick(tb, id, e) {
    if (!leaveForms(tb, id)) return;
    const list = TB[tb].order(), S0 = SEL[tb];
    if (e && (e.ctrlKey || e.metaKey)) { S0.has(id) ? S0.delete(id) : S0.add(id); ANCH[tb] = id; }
    else if (e && e.shiftKey && ANCH[tb] && list.includes(ANCH[tb])) { const a = list.indexOf(ANCH[tb]), b = list.indexOf(id); S0.clear(); list.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(x => S0.add(x)); }
    else { S0.clear(); S0.add(id); ANCH[tb] = id; }
    setCur(tb, S0.has(id) ? id : (S0.size ? [...S0][S0.size - 1] : null));
    if (tb === "p") pNew = false; if (tb === "i") iNew = null; if (tb === "k") { kdPid = null; kdQ = ""; }
    if (tb === "r") { const b = S.briefings.find(x => x.id === id); if (b && !b.read && S0.size === 1) { b.read = true; origSaveDt(); base = snap(); } }
    render(true); scrollSel();
  }
  const scrollSel = () => requestAnimationFrame(() => { const r = $("#screen tr.cur") || $("#screen tr.sel"); if (r) r.scrollIntoView({ block: "nearest" }); const a = $("#screen td.ac"); if (a) a.scrollIntoView({ block: "nearest", inline: "nearest" }); });
  function curTb() {
    if (view === "menschen" || view === "akte") return "p";
    if (view === "todos") return todoList === "einkauf" ? "s" : "t";
    if (view === "briefings") return "r";
    if (view === "karten") return kdTab === "karten" && !kdPid ? "k" : null;
    if (view === "bereich") { const s = bsub(); return s === "exp" ? "e" : s === "goals" ? "g" : s === "notes" ? "n" : s === "docs" ? "d" : s.startsWith("k:") ? "i" : null; }
    return null;
  }

  function gridHTML(tb, rows, opt = {}) {
    const cols = TB[tb].cols(), cid = curOf(tb), ac = ACOL[tb] || 0;
    const sk = (SORT[tb] || {}).k, sd = (SORT[tb] || {}).d || 1;
    const head = `<thead><tr>${cols.map(c => `<th style="${c.w ? `width:${c.w}px` : ""}"${c.cls ? ` class="${c.cls}"` : ""}>${c.sort ? `<button data-act="dtsort" data-tb="${tb}" data-k="${c.k}">${esc(c.l)}${sk === c.k ? `<i>${sd > 0 ? "▲" : "▼"}</i>` : ""}</button>` : `<span>${esc(c.l)}</span>`}</th>`).join("")}</tr></thead>`;
    const minW = cols.reduce((a, c) => a + (c.w || 180), 0);
    const body = rows.map(o => {
      if (o.gh) return `<tr class="gh"${o.drop != null ? ` data-drop="${esc(o.drop)}"` : ""}><td colspan="${cols.length}">${o.fold ? `<button class="dtfoldbtn" data-act="${o.fold}">${o.open ? "▾" : "▸"}</button>` : ""}<b>${esc(o.gh)}</b><span>${o.n != null ? o.n : ""}</span>${o.hint ? `<small>${esc(o.hint)}</small>` : ""}</td></tr>`;
      const isCur = o.id === cid, cls = [SEL[tb].has(o.id) ? "sel" : "", isCur ? "cur" : "", o._cls || ""].filter(Boolean).join(" ");
      return `<tr class="${cls}" data-act="dtrow" data-tb="${tb}" data-id="${esc(o.id)}"${opt.drag ? ' draggable="true"' : ""}>${cols.map((c, i) => {
        if (ED && ED.tb === tb && ED.id === o.id && ED.k === c.k) return `<td class="ed">${editorHTML(c, o)}</td>`;
        let v = ""; try { v = c.v(o); } catch (_) { v = ""; }
        return `<td data-c="${i}"${c.e ? ' data-e="1"' : ""} class="${[c.cls || "", isCur && i === ac && c.e ? "ac" : ""].filter(Boolean).join(" ")}"${c.tip ? ` title="${esc(c.tip(o))}"` : ""}>${v == null ? "" : v}</td>`;
      }).join("")}</tr>`;
    }).join("");
    const n = rows.filter(r => !r.gh).length;
    return `<table class="dtg${opt.cls ? " " + opt.cls : ""}" style="min-width:${minW}px" data-tb="${tb}">${head}<tbody>${opt.top || ""}${body}</tbody></table>${n ? "" : `<div class="dtempty">${esc(opt.empty || "Keine Einträge.")}</div>`}`;
  }
  function sortRows(tb, list) { const s = SORT[tb], c = s && TB[tb].cols().find(x => x.k === s.k); return c && c.sort ? list.sort((a, b) => s.d * c.sort(a, b)) : list; }
  const opt = (list, val) => list.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(val == null ? "" : val) ? " selected" : ""}>${esc(l)}</option>`).join("");

  function editorHTML(c, o) {
    const raw = c.get ? c.get(o) : (o[c.k] == null ? "" : o[c.k]), v = esc(String(raw));
    const sel = (opts, c0) => `<select class="dtcell">${opt(opts, c0)}</select>`;
    switch (c.e) {
      case "group": return sel([["", "keine Gruppe"], ...[...new Set(S.groups.concat(raw ? [raw] : []))].map(g => [g, g])], raw);
      case "cyc": return sel(CYCLES.map(x => [x, cycLabel(x)]), raw || "nie");
      case "prio": return sel([["", "keine"], ...PRIOS.map(([n, l]) => [n, l])], raw);
      case "area": return sel([["", "kein Bereich"], ...AREAS.map(a => [a.id, a.n])], raw);
      case "rep": return sel(REPS.map(r => [r, r]), raw || "nie");
      case "cat": return sel(catList().map(x => [x, x]), raw);
      case "darea": return sel(AREAS.map(a => [a.id, a.n]), raw || "doku");
      case "sel": return sel(c.o, raw);
      case "date": return `<input class="dtcell" type="date" value="${v}">`;
      case "time": return `<input class="dtcell" type="time" value="${v}">`;
      case "bday": return `<input class="dtcell" value="${esc(L.bdayToInput(raw))}" placeholder="TT.MM.JJJJ" maxlength="10">`;
      case "num": return `<input class="dtcell" inputmode="decimal" value="${esc(String(raw).replace(".", ","))}">`;
      default: return `<input class="dtcell" value="${v}" spellcheck="false">`;
    }
  }
  function startEdit(tb, id, k) {
    const c = TB[tb].cols().find(x => x.k === k); if (!c || !c.e) return false;
    ED = { tb, id, k }; render(true);
    requestAnimationFrame(() => { const i = $("#screen .dtcell"); if (i) { i.focus(); if (i.tagName === "INPUT" && i.type === "text") i.select(); } });
    return true;
  }
  let committing = false;
  function commitEdit(move) {
    if (!ED || committing) return; committing = true;
    try {
      const { tb, id, k } = ED, inp = $("#screen .dtcell"), o = TB[tb].find(id);
      if (!inp || !o) { ED = null; return; }
      const err = TB[tb].commit(o, k, inp.value);
      if (err) { origToast(err); inp.focus(); return; }
      ED = null; lastMsg = "Geändert: " + (TB[tb].name ? TB[tb].name(o) : ""); if (TB[tb].after) TB[tb].after(o, k); save();
      const ecols = TB[tb].cols().filter(c => c.e).map(c => c.k), list = TB[tb].order();
      if (move === "tab" || move === "stab") { const j = ecols.indexOf(k) + (move === "tab" ? 1 : -1); if (j >= 0 && j < ecols.length) { ACOL[tb] = TB[tb].cols().findIndex(c => c.k === ecols[j]); committing = false; startEdit(tb, id, ecols[j]); return; } }
      if (move === "down") { const n = list[list.indexOf(id) + 1]; if (n) { SEL[tb].clear(); SEL[tb].add(n); ANCH[tb] = n; setCur(tb, n); } }
      render(true); scrollSel();
    } finally { committing = false; }
  }
  function cancelEdit() { if (!ED) return; ED = null; render(true); }
  document.addEventListener("keydown", e => {
    if (!on || !e.target.classList || !e.target.classList.contains("dtcell")) return;
    if (e.key === "Enter") { e.preventDefault(); e.stopImmediatePropagation(); commitEdit("down"); }
    else if (e.key === "Tab") { e.preventDefault(); e.stopImmediatePropagation(); commitEdit(e.shiftKey ? "stab" : "tab"); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); cancelEdit(); }
  }, true);
  document.addEventListener("focusout", e => { if (on && e.target.classList && e.target.classList.contains("dtcell") && ED && !committing) setTimeout(() => { if (ED && !(document.activeElement && document.activeElement.classList.contains("dtcell"))) commitEdit(); }, 0); });

  function paneLayout(head, list, det, k) {
    return `<div class="dtview">${head}<div class="dtbody"><section class="dtpane dtlist" data-k="${k}">${list}</section>${P.det && det != null ? `<div class="dtsplit" role="separator" aria-orientation="vertical" title="Ziehen ändert die Breite, Doppelklick setzt zurück"></div><aside class="dtpane dtdetail" data-k="${k}d">${det}</aside>` : ""}</div></div>`;
  }
  const noneHTML = (icn, t, s) => `<div class="dtnone">${ic(icn, 40)}<p>${esc(t)}</p><small>${esc(s)}</small></div>`;
  const miniTbl = (head, rows, empty) => rows.length ? `<table class="dtg mini"><thead><tr>${head.map(([l, w, c]) => `<th${w ? ` style="width:${w}px"` : ""}${c ? ` class="${c}"` : ""}>${l}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>` : `<p class="dtmut dtpad">${empty}</p>`;

  /* ================================================================
     KONTAKTE
     ================================================================ */
  let cf = "all", pNew = false, ptab = "allg", fDirty = false;
  const keyName = p => ((p.last || p.first || "") + " " + (p.first || "")).trim();
  const nb = p => { try { return nextBirthday(p); } catch (_) { return null; } };
  const city = p => { const a = p.addr || ""; const m = a.match(/\b\d{5}\s+([^,]+)/); return m ? m[1].trim() : (a.includes(",") ? (a.split(",").pop() || "").trim() : ""); };
  const isDran = p => !p.arch && ["late", "due"].includes(callState(p));
  const bdaySoon = p => { const b = !p.arch && !p.death && nb(p); return b && diffDays(today(), b) <= 30; };
  const CF = [["all", "Alle Kontakte", "people", p => !p.arch], ["dran", "Anruf fällig", "phone", isDran], ["bday", "Geburtstag bald", "gift", bdaySoon]];
  function cfTest() {
    if (cf === "arch") return p => !!p.arch;
    if (cf === "nogrp") return p => !p.arch && !p.group;
    if (cf.startsWith("g:")) { const g = cf.slice(2); return p => !p.arch && p.group === g; }
    return (CF.find(x => x[0] === cf) || CF[0])[3];
  }
  const cfLabel = () => cf === "arch" ? "Archiv" : cf === "nogrp" ? "Ohne Gruppe" : cf.startsWith("g:") ? "Gruppe " + cf.slice(2) : (CF.find(x => x[0] === cf) || CF[0])[1];
  const bdTxt = p => { if (!p.bday) return ""; const [y, m, d] = p.bday.split("-"); return `${d}.${m}.${y !== "1604" ? y : ""}`; };
  TB.p = {
    name: p => fullName(p),
    find: id => S.people.find(p => p.id === id),
    cols: () => [
      { k: "last", l: "Nachname", w: 130, e: "text", v: p => `<b>${esc(p.last || "")}</b>`, sort: (a, b) => keyName(a).localeCompare(keyName(b), "de"), tip: p => p.nick ? "Spitzname: " + p.nick : "" },
      { k: "first", l: "Vorname", w: 115, e: "text", v: p => esc(p.first || ""), sort: (a, b) => (a.first || "~").localeCompare(b.first || "~", "de") },
      { k: "group", l: "Gruppe", w: 110, e: "group", v: p => esc(p.group || ""), sort: (a, b) => (a.group || "~").localeCompare(b.group || "~", "de") },
      { k: "tel", l: "Telefon", w: 150, e: "text", v: p => esc(p.tel || "") + ((p.tels || []).length ? ` <small class="mut">+${p.tels.length}</small>` : ""), sort: (a, b) => (a.tel || "~").localeCompare(b.tel || "~") },
      { k: "email", l: "E-Mail", w: 200, e: "text", v: p => esc(p.email || ""), sort: (a, b) => (a.email || "~").localeCompare(b.email || "~") },
      { k: "cyc", l: "Rhythmus", w: 115, e: "cyc", v: p => p.death ? '<span class="mut">verstorben</span>' : esc(cycLabel(p.cyc || "nie")), sort: (a, b) => CYCLES.indexOf(a.cyc || "nie") - CYCLES.indexOf(b.cyc || "nie") },
      { k: "lastc", l: "Zuletzt", w: 100, v: p => { const l = lastCall(p); return l ? esc(agoText(l)) : '<span class="mut">noch nie</span>'; }, sort: (a, b) => (lastCall(a) || "0").localeCompare(lastCall(b) || "0") },
      { k: "next", l: "Nächster Anruf", w: 115, v: p => { const st = callState(p), d = nextDue(p); return !d || p.arch || p.death ? '<span class="mut">—</span>' : st === "late" ? '<span class="late">überfällig</span>' : st === "due" ? "<b>heute</b>" : esc(fmtDate(d)); }, sort: (a, b) => (nextDue(a) || "9999").localeCompare(nextDue(b) || "9999") },
      { k: "bday", l: "Geburtstag", w: 100, e: "bday", get: p => p.bday || "", v: p => { const b = nb(p), n = b ? diffDays(today(), b) : null; return esc(bdTxt(p)) + (n === 0 ? ' <b class="late">heute</b>' : ""); }, sort: (a, b) => (nb(a) || "9999").localeCompare(nb(b) || "9999") },
      { k: "ort", l: "Ort", w: 0, v: p => esc(city(p)), sort: (a, b) => (city(a) || "~").localeCompare(city(b) || "~", "de") }
    ],
    order: () => pRows().map(p => p.id),
    commit(p, k, v) {
      v = String(v).trim();
      if (k === "first" || k === "last") { const o = { first: p.first, last: p.last, [k]: v }; if (!o.first && !o.last) return "Ein Name muss bleiben"; p[k] = v; }
      else if (k === "email") { const w = v && L.checkEmail(v); if (w && !ask(w + "\n\nTrotzdem so speichern?")) return "Nicht gespeichert"; p.email = v; }
      else if (k === "tel") p.tel = v;
      else if (k === "group") { p.group = v; if (v && !S.groups.includes(v)) S.groups.push(v); }
      else if (k === "cyc") { if (!p.death) p.cyc = v; }
      else if (k === "bday") { const b = L.parseBday(v); if (b === null) return "Geburtstag bitte als TT.MM.JJJJ, z. B. 07.04.1964"; p.bday = b; }
    }
  };
  function pRows() {
    const ql = q.trim().toLowerCase(), t = cfTest();
    const l = S.people.filter(p => t(p) && (!ql || (fullName(p) + " " + (p.group || "") + " " + (p.nick || "") + " " + (p.tel || "") + " " + (p.email || "") + " " + (p.woher || "") + " " + (p.job || "") + " " + (p.addr || "")).toLowerCase().includes(ql) || fuzzyHas(fullName(p) + " " + (p.nick || "") + " " + (p.job || ""), ql)));
    return sortRows("p", l);
  }
  function contactsHTML() {
    for (const id of [...SEL.p]) if (!S.people.some(p => p.id === id)) SEL.p.delete(id);
    if (view === "akte" && cur && !SEL.p.has(cur)) { SEL.p.clear(); SEL.p.add(cur); ANCH.p = cur; }
    const list = pRows();
    const head = `<div class="dthead"><b>${esc(cfLabel())}</b><span>${pl(list.length, "Kontakt", "Kontakte")}${q ? ` mit „${esc(q)}“` : ""}</span><span class="dthint">Doppelklick auf eine Zelle ändert sie direkt · Enter übernimmt · Tab springt weiter</span></div>`;
    const grid = gridHTML("p", list, { drag: 1, empty: S.people.length ? "Niemand gefunden." : "Noch keine Kontakte. „Neuer Kontakt“ oder eine vCard-Datei ins Fenster ziehen." });
    let det = "";
    if (SEL.p.size > 1) det = multiPHTML();
    else if (pNew) det = `<div class="dtph">${ic("newp", 30)}<div><h2>Neuer Kontakt</h2><p>Alle Felder auf einen Blick. Tab springt weiter, Strg+S speichert.</p></div><span class="dtchg" id="dtchg"${fDirty ? "" : " hidden"}>● Geändert – Strg+S speichert</span></div>` + pFormHTML(null);
    else { const p = view === "akte" && S.people.find(x => x.id === cur); det = p ? pDetailHTML(p) : noneHTML("people", "Kein Kontakt ausgewählt", "Links in der Tabelle einen Kontakt anklicken. Mit Strg oder Umschalt mehrere wählen."); }
    return paneLayout(head, grid, det, "pl");
  }
  function multiPHTML() {
    const ps = selOf("p");
    return `<div class="dtph">${ic("people", 30)}<div><h2>${pl(ps.length, "Kontakt", "Kontakte")} ausgewählt</h2><p>${esc(ps.slice(0, 8).map(fullName).join(", "))}${ps.length > 8 ? " …" : ""}</p></div></div>
      <div class="dtfg dtpad"><div class="fs">Für alle ausgewählten ändern</div>
      <div class="f w"><label>Gruppe</label><select data-dt="mgroup"><option value="__">wählen …</option><option value="">keine Gruppe</option>${S.groups.map(g => `<option>${esc(g)}</option>`).join("")}</select></div>
      <div class="f w"><label>Anruf-Rhythmus</label><select data-dt="mcyc"><option value="__">wählen …</option>${CYCLES.map(c => `<option value="${esc(c)}">${esc(cycLabel(c))}</option>`).join("")}</select></div>
      <div class="dtformfoot full"><button class="pb" data-act="dtparch">${ps.every(p => p.arch) ? "Zurückholen" : "Archivieren …"}</button><button class="pb" data-act="dtdel">Löschen …</button><button class="pb" data-act="dtcsv">Als Excel-Tabelle speichern</button><span class="dtgrow"></span><button class="pb" data-act="dtselnone">Auswahl aufheben</button></div></div>
      <p class="dtmut dtpad">Tipp: Die ausgewählten Kontakte links auf eine Gruppe oder ins Archiv ziehen.</p>`;
  }
  function pDetailHTML(p) {
    const kids = S.people.filter(x => x.parent === p.id);
    const n = { calls: (p.calls || []).length, notes: (p.notes || []).length + (p.ask || []).filter(a => !a.done).length, fam: (p.kin || []).length + kids.length + (p.parent ? 1 : 0), gifts: (p.gifts || []).length, docs: S.docs.filter(d => d.ref === p.id).length };
    const T = [["allg", "Allgemein"], ["calls", "Anrufe"], ["notes", "Notizen & Nachfragen"], ["fam", "Familie"], ["gifts", "Geschenke"], ["docs", "Dokumente"]];
    const st = callState(p), due = nextDue(p);
    const sub = [p.group, p.death ? "verstorben" : cycLabel(p.cyc || "nie"), due && !p.arch && !p.death ? (st === "late" ? "Anruf überfällig" : st === "due" ? "heute anrufen" : "nächster Anruf " + fmtDate(due)) : "", p.arch ? "im Archiv" : ""].filter(Boolean).join(" · ");
    let body = "";
    if (ptab === "allg") body = pFormHTML(p);
    else if (ptab === "calls") { const c = (p.calls || []).slice().sort((a, b) => (b.d + (b.t || "")).localeCompare(a.d + (a.t || ""))); body = `<div class="dtpad"><div class="dtbtnrow top"><button class="pb pri" data-act="dtplog">Anruf eintragen …</button>${p.tel ? `<button class="pb" data-act="dtpcall">Jetzt anrufen</button>` : ""}</div>${miniTbl([["Datum", 120], ["Uhrzeit", 70], ["Ergebnis"], ["", 34]], c.map(x => `<tr><td>${esc(fmtDate(x.d))}</td><td>${esc(x.t || "")}</td><td>${x.ok ? "erreicht" : '<span class="mut">nicht erreicht</span>'}${x.n ? " · " + esc(x.n) : ""}</td><td><button class="xb" data-act="dtpldel" data-k="calls" data-id="${esc(x.id || x.d)}" title="Löschen">✕</button></td></tr>`), "Noch kein Anruf eingetragen.")}</div>`; }
    else if (ptab === "notes") body = `<div class="dtpad">${listBlock(p, "ask", "Offene Nachfragen", "z. B. fragen, wie die Reha läuft")}${listBlock(p, "notes", "Notizen", "Neue Notiz eintippen und Enter")}</div>`;
    else if (ptab === "gifts") body = `<div class="dtpad"><label class="dtchk"><input type="checkbox" data-dt="pgift"${p.gift ? " checked" : ""}> Zum Geburtstag ein Geschenk besorgen (Erinnerung ${S.settings.giftLead || 14} Tage vorher)</label>${listBlock(p, "gifts", "Geschenkideen", "z. B. Kochkurs")}</div>`;
    else if (ptab === "fam") { const par = p.parent && S.people.find(x => x.id === p.parent); body = `<div class="dtpad"><table class="dtg mini dtkv"><tbody>${par ? `<tr><td style="width:150px">Kind von</td><td><button class="lnk" data-act="person" data-id="${par.id}">${esc(fullName(par))}</button></td></tr>` : ""}${kids.map(k => `<tr><td style="width:150px">Kind</td><td><button class="lnk" data-act="person" data-id="${k.id}">${esc(fullName(k))}</button></td></tr>`).join("")}</tbody></table><div class="dtlegacy">${typeof kinBlock === "function" ? kinBlock(p) : ""}</div><p class="dtmut">„Kind von“ stellst du im Reiter Allgemein ein.</p></div>`; }
    else if (ptab === "docs") { const ds = S.docs.filter(d => d.ref === p.id); body = `<div class="dtpad"><div class="dtbtnrow top"><button class="pb" data-act="pdffor" data-id="${p.id}">PDF hinzufügen …</button></div>${docTable(ds)}</div>`; }
    return `<div class="dtph">${avHTML(p)}<div><h2>${esc(fullName(p))}</h2><p>${esc(sub)}</p></div><span class="dtchg" id="dtchg"${fDirty ? "" : " hidden"}>● Geändert – Strg+S speichert</span></div>
      <div class="dttabs" role="tablist">${T.map(([k, l]) => `<button role="tab" data-act="dtptab" data-k="${k}" aria-selected="${ptab === k}">${l}${n[k] ? ` <small>(${n[k]})</small>` : ""}</button>`).join("")}</div>${body}`;
  }
  function listBlock(p, k, title, ph) {
    const l = (p[k] || []).slice(); if (k === "ask") l.sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
    return `<div class="dtblock"><div class="dtblockh">${esc(title)} <small>${l.length || ""}</small></div><form class="dtadd" data-form="dtpl" data-k="${k}"><input placeholder="${esc(ph)}" aria-label="${esc(title)} hinzufügen" autocomplete="off"><button class="pb">Hinzufügen</button></form>
      ${l.length ? `<table class="dtg mini"><tbody>${l.map(x => `<tr${x.done ? ' class="done"' : ""}>${k === "ask" ? `<td style="width:26px"><input type="checkbox" data-dt="askdone" data-id="${x.id}"${x.done ? " checked" : ""} aria-label="erledigt"></td>` : ""}<td>${esc(x.t)}</td><td style="width:100px" class="mut">${esc(fmtDate(x.d || ""))}</td><td style="width:34px"><button class="xb" data-act="dtpldel" data-k="${k}" data-id="${x.id}" title="Löschen">✕</button></td></tr>`).join("")}</tbody></table>` : ""}</div>`;
  }
  const telRowF = (n, l) => `<div class="f w pf-telrow"><label>Weitere Nummer</label><div class="dtin3"><input class="pf-teln" value="${esc(n || "")}" autocomplete="off"><select class="pf-tell" aria-label="Art">${opt([["", "Art"], ...TELL.map(x => [x, x])], l)}</select><button type="button" class="xb" data-act="dtpfrm" title="Entfernen">✕</button></div></div>`;
  const mailRowF = m => `<div class="f w pf-mailrow"><label>Weitere E-Mail</label><div class="dtin3"><input class="pf-mailn" value="${esc(m || "")}" autocomplete="off"><button type="button" class="xb" data-act="dtpfrm" title="Entfernen">✕</button></div></div>`;
  function pFormHTML(p) {
    const v = p || { first: "", last: "", cyc: "monatlich", group: cf.startsWith("g:") ? cf.slice(2) : "", gift: false };
    const lc = p && lastCall(p);
    const dl = (id, list) => `<datalist id="${id}">${list.map(x => `<option value="${esc(x)}">`).join("")}</datalist>`;
    return `<form class="dtpform dtfg" data-id="${p ? p.id : "new"}" autocomplete="off" onsubmit="return false">
      <div class="fs">Name</div>
      <div class="f"><label for="pf-first">Vorname</label><input id="pf-first" value="${esc(v.first || "")}"></div>
      <div class="f"><label for="pf-last">Nachname</label><input id="pf-last" value="${esc(v.last || "")}"></div>
      <div class="f"><label for="pf-nick">Spitzname</label><input id="pf-nick" value="${esc(v.nick || "")}" placeholder="für die Sprache"></div>
      <div class="f"><label>Profilbild</label>${p ? `<button type="button" class="pb sm" data-act="avpick" data-id="${p.id}">${p.pic ? "Ändern …" : "Bild wählen …"}</button>` : '<span class="dtro mut">nach dem Speichern</span>'}</div>
      <div class="fs">Erreichbarkeit</div>
      <div class="f"><label for="pf-tel">Telefon</label><div class="dtin2"><input id="pf-tel" value="${esc(v.tel || "")}" placeholder="+49 …"><select id="pf-tell" aria-label="Art der Nummer">${opt([["", "Art"], ...TELL.map(x => [x, x])], v.telL || "")}</select></div></div>
      <div class="f"><label for="pf-email">E-Mail</label><input id="pf-email" value="${esc(v.email || "")}" placeholder="name@beispiel.de"></div>
      <div class="pf-tels full">${(v.tels || []).map(x => telRowF(x.n, x.l)).join("")}</div>
      <div class="pf-mails full">${(v.emails || []).map(mailRowF).join("")}</div>
      <div class="f w"><label></label><div class="dtbtnrow tight"><button type="button" class="lnk" data-act="dtpfadd" data-k="tel">+ weitere Nummer</button><button type="button" class="lnk" data-act="dtpfadd" data-k="mail">+ weitere E-Mail</button></div></div>
      <div class="f w"><label for="pf-addr">Adresse</label><input id="pf-addr" value="${esc(v.addr || "")}" placeholder="Straße Nr., PLZ Ort"></div>
      <div class="fs">Mirella kümmert sich</div>
      <div class="f"><label for="pf-group">Gruppe</label><select id="pf-group">${opt([["", "keine Gruppe"], ...[...new Set(S.groups.concat(v.group ? [v.group] : []))].map(g => [g, g]), ["__new", "Neue Gruppe …"]], v.group || "")}</select></div>
      <div class="f"><label for="pf-cyc">Anruf-Rhythmus</label><select id="pf-cyc"${v.death ? " disabled" : ""}>${opt(CYCLES.map(c => [c, cycLabel(c)]), v.cyc || "nie")}</select></div>
      <div class="f"><label for="pf-woher">Woher bekannt</label><input id="pf-woher" list="pf-woher-l" value="${esc(v.woher || "")}">${dl("pf-woher-l", woherAll())}</div>
      <div class="f"><label for="pf-lunch">Treffen</label><select id="pf-lunch">${opt([["", "nie"], ...Object.keys(LUNCH).map(c => [c, c])], v.lunch || "")}</select></div>
      <div class="f"><label for="pf-job">Beruf</label><input id="pf-job" list="pf-job-l" value="${esc(v.job || "")}">${dl("pf-job-l", jobAll())}</div>
      <div class="f"><label>Zuletzt erreicht</label><span class="dtro">${lc ? esc(agoText(lc) + " (" + fmtDate(lc) + ")") : "noch nie"}</span></div>
      <div class="fs">Geburtstag und Familie</div>
      <div class="f"><label for="pf-bday">Geburtstag</label><input id="pf-bday" value="${esc(L.bdayToInput(v.bday || ""))}" placeholder="TT.MM.JJJJ" maxlength="10"></div>
      <div class="f"><label for="pf-gift">Geschenk</label><label class="dtchk"><input type="checkbox" id="pf-gift"${v.gift ? " checked" : ""}> besorgen (${S.settings.giftLead || 14} Tage vorher)</label></div>
      <div class="f"><label for="pf-parent">Kind von</label><input id="pf-parent" list="pf-parent-l" value="${esc(v.parent ? fullName(S.people.find(x => x.id === v.parent) || {}) : "")}" placeholder="Name des Elternteils">${dl("pf-parent-l", S.people.filter(x => !x.arch && !x.parent && (!p || x.id !== p.id)).map(fullName))}</div>
      <div class="f"><label for="pf-death">Verstorben am</label><input id="pf-death" value="${esc(L.bdayToInput(v.death || ""))}" placeholder="TT.MM.JJJJ" maxlength="10"></div>
      ${p ? "" : `<div class="f w"><label for="pf-note">Erste Notiz</label><input id="pf-note" placeholder="Was du dir merken willst"></div>`}
      <div class="dtformfoot full">${p ? `<button type="button" class="pb" data-act="dtplog">Anruf eintragen …</button><button type="button" class="pb" data-act="dtparch">${p.arch ? "Zurückholen" : "Archivieren …"}</button><button type="button" class="pb" data-act="dtdel">Löschen …</button>` : ""}<span class="dtgrow"></span><button type="button" class="pb" data-act="dtpdiscard">Verwerfen (Esc)</button><button type="button" class="pb pri" data-act="dtpsave">Speichern (Strg+S)</button></div>
    </form>`;
  }
  function pFormRead() {
    const g = id => document.getElementById(id), val = id => (g(id) ? g(id).value.trim() : "");
    const bd = L.parseBday(val("pf-bday")), dd = L.parseBday(val("pf-death"));
    if (!val("pf-first") && !val("pf-last")) return { err: "Bitte einen Namen eintragen", f: "pf-first" };
    if (bd === null) return { err: "Geburtstag bitte als TT.MM.JJJJ, z. B. 07.04.1964", f: "pf-bday" };
    if (dd === null) return { err: "Todestag bitte als TT.MM.JJJJ", f: "pf-death" };
    const tels = $$(".dtpform .pf-telrow").map(r => ({ n: r.querySelector(".pf-teln").value.trim(), l: r.querySelector(".pf-tell").value })).filter(x => x.n);
    const emails = [...new Set($$(".dtpform .pf-mailn").map(i => i.value.trim()).filter(Boolean))];
    const d = { first: val("pf-first"), last: val("pf-last"), nick: val("pf-nick"), tel: val("pf-tel"), telL: val("pf-tell"), tels, email: val("pf-email"), emails, addr: val("pf-addr"), group: val("pf-group"), cyc: g("pf-cyc").value, woher: val("pf-woher"), lunch: val("pf-lunch"), job: val("pf-job"), bday: bd || "", gift: g("pf-gift").checked, death: dd || "" };
    if (!d.tel && tels.length) { const f = tels.shift(); d.tel = f.n; d.telL = f.l; d.tels = tels; }
    if (!d.email && emails.length) { d.email = emails.shift(); d.emails = emails; }
    if (d.death) { d.cyc = "nie"; d.gift = false; }
    d._parent = val("pf-parent"); d._note = val("pf-note");
    return { d };
  }
  function pFormSave() {
    const form = $(".dtpform"); if (!form) return true;
    const r = pFormRead(); if (r.err) { origToast(r.err); const f = document.getElementById(r.f); if (f) f.focus(); return false; }
    const d = r.d, id = form.dataset.id === "new" ? null : form.dataset.id;
    const w = d.email && L.checkEmail(d.email); if (w && !ask(w + "\n\nTrotzdem so speichern?")) return false;
    if (d.group === "__new") d.group = "";
    if (d.group && !S.groups.includes(d.group)) S.groups.push(d.group);
    if (typeof pickRemember === "function") { pickRemember("woher", d.woher); pickRemember("job", d.job); }
    if (d._parent) { const par = S.people.find(x => x.id !== id && normName(fullName(x)) === normName(d._parent)); if (!par) { origToast("„" + d._parent + "“ steht nicht in Mirella. Bitte aus der Liste wählen."); const f = document.getElementById("pf-parent"); if (f) f.focus(); return false; } d.parent = par.id; } else d.parent = "";
    const note = d._note; delete d._parent; delete d._note;
    let p;
    if (id) { p = S.people.find(x => x.id === id); if (!p) return true; Object.assign(p, d); }
    else {
      const dups = findDups(d, null);
      if (dups.length && !ask(`Gibt es schon: ${dups.map(fullName).join(", ")}.\n\nTrotzdem neu anlegen?`)) return false;
      p = Object.assign({ id: uid(), created: today(), calls: [], notes: [], ask: [], gifts: [] }, d);
      if (note) p.notes.unshift({ id: uid(), t: note, d: today() });
      S.people.push(p); pNew = false; SEL.p.clear(); SEL.p.add(p.id); ANCH.p = p.id; cur = p.id; view = "akte";
    }
    fDirty = false; lastMsg = "Gespeichert: " + fullName(p); save(); render(true); origToast(lastMsg); scrollSel();
    return true;
  }
  /* Beim Verlassen eines geänderten Formulars: automatisch speichern, nichts geht verloren */
  function leaveForms(tb, id) {
    const pf = $(".dtpform"); if (fDirty && pf && !(tb === "p" && pf.dataset.id === id)) { if (!pFormSave()) return false; }
    const ifm = $(".dtiform"); if (iDirty && ifm && !(tb === "i" && ifm.dataset.id === id)) { if (!iFormSave()) return false; }
    return true;
  }
  const markDirty = () => { const c = $("#dtchg"); if (c) c.hidden = false; };
  document.addEventListener("input", e => {
    if (!on || !e.target.closest) return;
    if (e.target.closest(".dtpform")) { fDirty = true; markDirty(); }
    if (e.target.closest(".dtiform")) { iDirty = true; markDirty(); }
    if (["pf-bday", "pf-death"].includes(e.target.id) && !(e.inputType || "").startsWith("delete")) { const f = L.fmtBdayInput(e.target.value); if (f !== e.target.value) e.target.value = f; }
  });
  document.addEventListener("change", e => {
    if (!on || !e.target.closest) return;
    if (e.target.closest(".dtpform")) {
      fDirty = true; markDirty();
      if (e.target.id === "pf-group" && e.target.value === "__new") { const g = (prompt("Name der neuen Gruppe") || "").trim(); if (g) { const o = document.createElement("option"); o.value = o.textContent = g; e.target.insertBefore(o, e.target.lastElementChild); e.target.value = g; } else e.target.value = ""; }
    }
    if (e.target.closest(".dtiform")) { iDirty = true; markDirty(); iFormRefresh(); }
  });

  function setPGroup(ps, g) { if (!ps.length) return; ps.forEach(p => { p.group = g; }); if (g && !S.groups.includes(g)) S.groups.push(g); lastMsg = `${pl(ps.length, "Kontakt", "Kontakte")} → ${g || "ohne Gruppe"}`; save(); render(true); origToast(lastMsg + " · Strg+Z macht es rückgängig"); }
  function setPCyc(ps, c) { ps = ps.filter(p => !p.death); if (!ps.length) return; ps.forEach(p => { p.cyc = c; }); lastMsg = `${pl(ps.length, "Kontakt", "Kontakte")}: ${cycLabel(c)}`; save(); render(true); origToast(lastMsg); }
  function archP(ps) {
    if (!ps.length) return;
    if (ps.every(p => p.arch)) { ps.forEach(p => { delete p.arch; p.streakBase = failStreak(p); }); lastMsg = `${pl(ps.length, "Kontakt", "Kontakte")} zurückgeholt`; }
    else { if (!ask(`${ps.length === 1 ? fullName(ps[0]) : pl(ps.length, "Kontakt", "Kontakte")} archivieren? Mirella erinnert dann nicht mehr an Anrufe und Geburtstage. Notizen und Verlauf bleiben.`)) return; ps.forEach(p => { p.arch = today(); }); lastMsg = `${pl(ps.length, "Kontakt", "Kontakte")} archiviert`; }
    SEL.p.clear(); fDirty = false; save(); if (view === "akte") view = "menschen"; render(true); origToast(lastMsg);
  }
  function delP(ps) {
    if (!ps.length) return;
    if (!ask(ps.length === 1 ? `${fullName(ps[0])} wirklich löschen? Notizen und Anrufverlauf gehen mit.` : `${ps.length} Kontakte wirklich löschen? Notizen und Anrufverlauf gehen mit.`)) return;
    ps.forEach(p => dropPerson(p)); SEL.p.clear(); fDirty = false; lastMsg = `${pl(ps.length, "Kontakt", "Kontakte")} gelöscht`; save(); view = "menschen"; render(true); origToast(lastMsg + " · Strg+Z holt zurück");
  }
  function exportCSV() {
    const ps = SEL.p.size > 1 ? selOf("p") : pRows();
    const cols = [["Nachname", p => p.last], ["Vorname", p => p.first], ["Spitzname", p => p.nick], ["Gruppe", p => p.group], ["Telefon", p => p.tel], ["Weitere Nummern", p => (p.tels || []).map(x => x.n).join(" / ")], ["E-Mail", p => p.email], ["Adresse", p => p.addr], ["Geburtstag", p => bdTxt(p)], ["Rhythmus", p => cycLabel(p.cyc || "nie")], ["Zuletzt angerufen", p => lastCall(p) ? fmtDate(lastCall(p)) : ""], ["Woher", p => p.woher], ["Beruf", p => p.job], ["Archiv", p => p.arch ? "ja" : ""]];
    const q2 = s => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;
    const csv = "﻿" + [cols.map(c => q2(c[0])).join(";"), ...ps.map(p => cols.map(c => q2(c[1](p))).join(";"))].join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = `Mirella_Kontakte_${today()}.csv`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    origToast(`${pl(ps.length, "Kontakt", "Kontakte")} als Excel-Tabelle (CSV) gespeichert`);
  }

  /* ================================================================
     AUFGABEN
     ================================================================ */
  let tf = "", showDoneT = false;
  const nextMonday = () => { const d = D(today()), k = ((8 - d.getDay()) % 7) || 7; return addDays(today(), k); };
  const prioTxt = x => { const p = prioOf(x); return p ? `<i class="dtdot" style="--c:${p[2]}"></i>${esc(p[1])}` : ""; };
  TB.t = {
    name: x => x.t,
    find: id => S.todos.find(x => x.id === id),
    cols: () => [
      { k: "done", l: "", w: 30, cls: "cbx", v: x => `<button class="box" role="checkbox" aria-checked="${!!x.done}" aria-label="erledigt" data-act="toggle" data-id="${x.id}"></button>` },
      { k: "t", l: "Betreff", w: 0, e: "text", v: x => esc(x.t) + (x.note ? ' <small class="mut" title="Hat eine Notiz">✎</small>' : "") + (x.auto ? ' <small class="tag" title="Automatisch von Mirella aus einem Eintrag">auto</small>' : "") + (x.nerv ? ' <small class="tag" title="Nerv-Modus">Nerv</small>' : "") },
      { k: "date", l: "Fällig", w: 105, e: "date", v: x => x.date ? `<span class="${!x.done && x.date < today() ? "late" : ""}">${esc(x.date === today() ? "heute" : fmtDate(x.date))}</span>` : (x.trig === "verlassen" ? '<span class="mut">beim Losgehen</span>' : "") },
      { k: "time", l: "Uhrzeit", w: 75, e: "time", v: x => esc(x.time || "") },
      { k: "prio", l: "Priorität", w: 95, e: "prio", v: prioTxt },
      { k: "area", l: "Bereich", w: 165, e: "area", v: x => { const A = x.area && areaById(x.area); return A ? `<i class="dtdot sq" style="--c:${A.c}"></i>${esc(A.n)}` : ""; } },
      { k: "rep", l: "Wiederholung", w: 115, e: "rep", v: x => x.rep && x.rep !== "nie" ? esc(x.rep) : "" },
      { k: "pid", l: "Person", w: 150, v: x => { const p = x.pid && S.people.find(y => y.id === x.pid); return p ? esc(fullName(p)) : ""; } }
    ],
    order: () => tGroups().rows.filter(r => r.id).map(r => r.id),
    commit(x, k, v) {
      if (k === "t") { v = v.trim(); if (!v) return "Der Betreff darf nicht leer sein"; x.t = v; }
      else if (k === "prio") x.prio = v ? +v : "";
      else if (k === "rep") { x.rep = v; if (v !== "nie" && !x.date) x.date = today(); }
      else x[k] = v;
    }
  };
  function tGroups() {
    const t = today(), tm = addDays(t, 1), wk = addDays(t, 7), ql = q.trim().toLowerCase();
    const flt = x => x.list === "todo" && (!tf || x.area === tf.slice(2)) && (!ql || (x.t + " " + (x.note || "")).toLowerCase().includes(ql));
    const open = S.todos.filter(x => !x.done && flt(x));
    const by = (a, b) => ((a.date || "9999") + (a.time || "99")).localeCompare((b.date || "9999") + (b.time || "99")) || byPrio(a, b);
    const G = [["Überfällig", open.filter(x => x.date && x.date < t), null], ["Heute", open.filter(x => x.date === t), t], ["Morgen", open.filter(x => x.date === tm), tm], ["Nächste 7 Tage", open.filter(x => x.date > tm && x.date <= wk), null], ["Später", open.filter(x => x.date > wk), nextMonday()], ["Ohne Datum", open.filter(x => !x.date), ""]];
    const done = S.todos.filter(x => x.done && flt(x)).sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || ""));
    const rows = [];
    G.forEach(([l, items, drop]) => { if (!items.length && drop == null) return; rows.push({ gh: l, n: items.length, drop: drop != null ? "d:" + drop : null, hint: items.length ? "" : "Aufgaben hierher ziehen" }); items.sort(by).forEach(x => rows.push(Object.assign(x, { _cls: x.date && x.date < t ? "lt" : "" }))); });
    if (done.length) { rows.push({ gh: "Erledigt", n: done.length, fold: "dtdone", open: showDoneT }); if (showDoneT) done.slice(0, 300).forEach(x => rows.push(Object.assign(x, { _cls: "done" }))); }
    return { rows, nOpen: open.length };
  }
  function todosHTML() {
    for (const id of [...SEL.t]) if (!S.todos.some(x => x.id === id)) SEL.t.delete(id);
    const { rows, nOpen } = tGroups(), A = tf && areaById(tf.slice(2));
    const head = `<div class="dthead"><b>${A ? "Aufgaben · " + esc(A.n) : "Alle Aufgaben"}</b><span>${pl(nOpen, "offene Aufgabe", "offene Aufgaben")}</span><span class="dthint">Neue Aufgabe in der ersten Zeile eintippen, z. B. „Steuer abgeben morgen um 9“</span></div>`;
    const top = `<tr class="qa"><td></td><td colspan="7"><form data-form="dtquick"><input id="dtquick" placeholder="Hier klicken, um eine Aufgabe hinzuzufügen …" autocomplete="off" aria-label="Neue Aufgabe"></form></td></tr>`;
    const grid = gridHTML("t", rows, { drag: 1, top, empty: "Keine Aufgaben." });
    const one = SEL.t.size === 1 && S.todos.find(x => x.id === [...SEL.t][0]);
    let det;
    if (SEL.t.size > 1) det = `<div class="dtph">${ic("task", 30)}<div><h2>${pl(SEL.t.size, "Aufgabe", "Aufgaben")} ausgewählt</h2><p>Für alle auf einmal</p></div></div><div class="dtpad"><div class="dtbtnrow col"><button class="pb" data-act="dttdone">Alle erledigt</button><button class="pb" data-act="dttmove" data-d="${today()}">Auf heute</button><button class="pb" data-act="dttmove" data-d="${addDays(today(), 1)}">Auf morgen</button><button class="pb" data-act="dttmove" data-d="${nextMonday()}">Auf nächsten Montag</button><button class="pb" data-act="dtdel">Löschen …</button></div><p class="dtmut">Tipp: Aufgaben auf „Heute“, „Morgen“ oder „Ohne Datum“ ziehen, oder links auf einen Bereich.</p></div>`;
    else if (one) det = tFormHTML(one);
    else det = noneHTML("task", "Keine Aufgabe ausgewählt", "Eine Zeile anklicken. Doppelklick auf eine Zelle ändert sie direkt.");
    return paneLayout(head, grid, det, "tl");
  }
  function tFormHTML(x) {
    const p = x.pid && S.people.find(y => y.id === x.pid), docs = S.docs.filter(d => d.ref === x.id), it = x.ref && S.items.find(i => i.id === x.ref);
    return `<div class="dtph"><button class="box big" role="checkbox" aria-checked="${!!x.done}" aria-label="Erledigt" data-act="toggle" data-id="${x.id}"></button><div><h2>${esc(x.t)}</h2><p>${esc([x.date ? "fällig " + fmtDate(x.date) + (x.time ? " um " + x.time : "") : "ohne Datum", x.done ? "erledigt " + fmtDate(x.doneAt || "") : ""].filter(Boolean).join(" · "))}</p></div></div>
    <div class="dtinsp dtfg" data-id="${x.id}">
      <div class="fs">Aufgabe</div>
      <div class="f w"><label>Betreff</label><input data-dt="t" value="${esc(x.t)}"></div>
      <div class="f"><label>Fällig am</label><input type="date" data-dt="date" value="${esc(x.date || "")}"></div>
      <div class="f"><label>Uhrzeit</label><input type="time" data-dt="time" value="${esc(x.time || "")}"></div>
      <div class="f"><label>Priorität</label><select data-dt="prio">${opt([["", "keine"], ...PRIOS.map(([v, l]) => [v, l])], x.prio || "")}</select></div>
      <div class="f"><label>Wiederholung</label><select data-dt="rep">${opt(REPS.map(r => [r, r]), x.rep || "nie")}</select></div>
      <div class="f"><label>Bereich</label><select data-dt="area">${opt([["", "kein Bereich"], ...AREAS.map(a => [a.id, a.n])], x.area || "")}</select></div>
      <div class="f"><label>Nerv-Modus</label><label class="dtchk"><input type="checkbox" data-dt="nerv"${x.nerv ? " checked" : ""}> meldet sich, bis es erledigt ist</label></div>
      ${p || it || x.ort ? `<div class="fs">Verknüpft</div>` : ""}
      ${p ? `<div class="f w"><label>Person</label><button class="lnk" data-act="person" data-id="${p.id}">${esc(fullName(p))}</button></div>` : ""}
      ${it ? `<div class="f w"><label>Gehört zu</label><button class="lnk" data-act="dtitem" data-id="${it.id}">${esc(kindTitle(it.kind, it))} (${esc(KINDS[it.kind].n)})</button></div>` : ""}
      ${x.ort ? `<div class="f w"><label>Ort</label><span class="dtro">${esc(x.ort)}</span></div>` : ""}
      <div class="fs">Notiz</div>
      <div class="f w"><label>Notiz und Links</label><textarea data-dt="note" rows="7">${esc(x.note || "")}</textarea></div>
      ${docs.length ? `<div class="f w"><label>Anhänge</label><div>${docTable(docs)}</div></div>` : ""}
      <div class="dtformfoot full"><button class="pb" data-act="dttedit">Weitere Felder …</button><button class="pb" data-act="pdffor" data-id="${x.id}">PDF anhängen …</button><button class="pb" data-act="dtdel">Löschen …</button><span class="dtgrow"></span><span class="dtmut">Änderungen werden sofort gespeichert.</span></div>
    </div>`;
  }
  function moveT(ts, d) { if (!ts.length) return; ts.forEach(x => { x.date = d; if (!d) x.time = ""; }); lastMsg = `${pl(ts.length, "Aufgabe", "Aufgaben")} ${d ? "auf " + relDate(d) : "ohne Datum"}`; save(); render(true); origToast(lastMsg); }
  function doneT(ts) { ts.filter(x => !x.done).forEach(x => toggleTodo(x.id)); }
  function delT(ts) {
    if (!ts.length) return;
    if (!ask(ts.length === 1 ? `„${ts[0].t}“ löschen?` : `${ts.length} Einträge löschen?`)) return;
    const ids = new Set(ts.map(x => x.id)); S.todos = S.todos.filter(x => !ids.has(x.id)); SEL.t.clear(); SEL.s.clear(); CUR.t = null; CUR.s = null;
    lastMsg = `${pl(ts.length, "Eintrag", "Einträge")} gelöscht`; save(); render(true); origToast(lastMsg + " · Strg+Z holt zurück");
  }

  /* ================================================================
     EINKAUF
     ================================================================ */
  TB.s = {
    name: x => x.t,
    find: id => S.todos.find(x => x.id === id),
    cols: () => [
      { k: "done", l: "", w: 30, cls: "cbx", v: x => `<button class="box" role="checkbox" aria-checked="${!!x.done}" aria-label="im Wagen" data-act="toggle" data-id="${x.id}"></button>` },
      { k: "t", l: "Artikel", w: 0, e: "text", v: x => esc(x.t) },
      { k: "qty", l: "Menge", w: 85, e: "num", cls: "r", v: x => x.qty ? esc(String(x.qty).replace(".", ",")) : "" },
      { k: "unit", l: "Einheit", w: 95, e: "text", v: x => esc(x.unit || "") },
      { k: "grp", l: "Warengruppe", w: 210, v: x => { const g = L.shopGroup(x.t, S.settings.shopGrp); return esc((g.ic ? g.ic + " " : "") + g.n); } }
    ],
    order: () => sRows().filter(r => r.id).map(r => r.id),
    commit(x, k, v) { if (k === "t") { v = v.trim(); if (!v) return "Bitte einen Artikel eintragen"; x.t = v; } else if (k === "qty") { const n = parseAmount(v); x.qty = n || null; } else x[k] = v.trim(); }
  };
  function sRows() {
    const all = S.todos.filter(t => t.list === "einkauf" && !t.arch), ql = q.trim().toLowerCase();
    const l = all.filter(t => !ql || t.t.toLowerCase().includes(ql)), by = {}, order = L.SHOPGROUPS.map(g => g[0]).concat("Sonstiges");
    l.filter(t => !t.done).forEach(t => { const g = L.shopGroup(t.t, S.settings.shopGrp); (by[g.n] = by[g.n] || []).push(t); });
    const rows = []; order.concat(Object.keys(by).filter(n => !order.includes(n))).filter(n => by[n]).forEach(n => { rows.push({ gh: n, n: by[n].length }); by[n].forEach(t => rows.push(Object.assign(t, { _cls: "" }))); });
    const got = l.filter(t => t.done); if (got.length) { rows.push({ gh: "Im Wagen", n: got.length }); got.forEach(t => rows.push(Object.assign(t, { _cls: "done" }))); }
    return rows;
  }
  function shopHTML() {
    for (const id of [...SEL.s]) if (!S.todos.some(x => x.id === id)) SEL.s.delete(id);
    const rows = sRows(), open = S.todos.filter(t => t.list === "einkauf" && !t.done && !t.arch), got = S.todos.filter(t => t.list === "einkauf" && t.done && !t.arch);
    const head = `<div class="dthead"><b>Einkaufsliste</b><span>${pl(open.length, "Artikel offen", "Artikel offen")}${got.length ? ` · ${got.length} im Wagen` : ""}</span><span class="dthint">Mehrere auf einmal: „Milch, Butter und 6 Eier“</span></div>`;
    const top = `<tr class="qa"><td></td><td colspan="4"><form data-form="shop"><input id="shopin" placeholder="Hier klicken, um Artikel hinzuzufügen …" autocomplete="off" aria-label="Artikel hinzufügen"></form></td></tr>`;
    const grid = gridHTML("s", rows, { top, empty: "Die Einkaufsliste ist leer." });
    const openK = new Set(open.map(x => x.t.trim().toLowerCase()));
    const freq = Object.entries(S.shopFreq || {}).filter(([k]) => !openK.has(k.toLowerCase())).sort((a, b) => b[1] - a[1]).slice(0, 24);
    const det = `<div class="dtph">${ic("cart", 30)}<div><h2>Einkauf</h2><p>${pl(open.length, "Artikel", "Artikel")} auf der Liste · ${got.length} im Wagen</p></div></div><div class="dtpad">
      <div class="dtblock"><div class="dtblockh">Einkauf abschließen</div><div class="dtbtnrow col"><button class="pb pri" data-act="shopdone"${got.length ? "" : " disabled"}>Einkauf fertig (${got.length} im Wagen)</button><button class="pb" data-act="cleardone"${got.length ? "" : " disabled"}>Abgehakte von der Liste löschen …</button><button class="pb" data-act="savetpl"${open.length ? "" : " disabled"}>Aktuelle Liste als Vorlage speichern …</button></div></div>
      <div class="dtblock"><div class="dtblockh">Oft gekauft <small>Klick setzt es auf die Liste</small></div>${freq.length ? `<div class="dtchips">${freq.map(([k, n]) => `<button class="chipx" data-act="shopadd" data-t="${esc(k)}" title="${n}-mal gekauft">+ ${esc(k)}</button>`).join("")}</div>` : '<p class="dtmut">Noch nichts. Mirella merkt sich, was du kaufst.</p>'}</div>
      <div class="dtblock"><div class="dtblockh">Vorlagen</div>${(S.shopTpl || []).length ? `<table class="dtg mini"><tbody>${S.shopTpl.map(t => `<tr><td>${esc(t.n)}</td><td class="mut" style="width:80px">${pl(t.items.length, "Artikel", "Artikel")}</td><td style="width:100px"><button class="pb sm" data-act="usetpl" data-id="${t.id}">Auf die Liste</button></td><td style="width:34px"><button class="xb" data-act="deltpl" data-id="${t.id}" title="Vorlage löschen">✕</button></td></tr>`).join("")}</tbody></table>` : '<p class="dtmut">Noch keine Vorlage, z. B. „Wocheneinkauf“.</p>'}</div></div>`;
    return paneLayout(head, grid, det, "sl");
  }

  /* ================================================================
     ÜBERSICHT (Heute) – Tabellen statt Karten
     ================================================================ */
  function dashHTML() {
    const t = today(), d0 = new Date(), h = d0.getHours();
    const calls = callsForToday(), due = S.todos.filter(x => x.list === "todo" && !x.done && x.trig !== "verlassen" && ((x.date && x.date <= t) || (+x.prio === 1 && !x.date))).sort(byPrio);
    const bd = S.people.filter(p => !p.arch && !p.death).map(p => [p, nb(p)]).filter(([, b]) => b && diffDays(t, b) <= 30).sort((a, b) => a[1].localeCompare(b[1]));
    const ev = eventsRange(t, addDays(t, 7), true), evs = []; Object.keys(ev).sort().forEach(k => ev[k].forEach(e => { if (e.c !== "anruf" && e.k !== "Erledigt") evs.push(Object.assign({ d: k }, e)); }));
    const fr = []; S.items.filter(x => x.kind === "vertrag" || x.kind === "versicherung").forEach(it => { const st = L.contractStatus(it, t); if (st && st.deadline && diffDays(t, st.deadline) <= 90) fr.push({ d: st.deadline, t: kindTitle(it.kind, it) + " – kündbar bis", id: it.id, k: "i" }); });
    S.docs.filter(x => x.until && diffDays(t, x.until) <= 60).forEach(x => fr.push({ d: x.until, t: x.name + " – gültig bis", id: x.id, k: "d" }));
    fr.sort((a, b) => a.d.localeCompare(b.d));
    const br = typeof latestBriefing === "function" ? latestBriefing() : null;
    const shopN = S.todos.filter(x => x.list === "einkauf" && !x.done && !x.arch).length;
    const ym = t.slice(0, 7), spent = monthSum(ym), inc = +S.settings.income || 0, fix = fixCosts().total;
    const panel = (title, n, inner, more) => `<section class="dtpanel"><div class="dtpanelh"><b>${title}</b><span>${n || ""}</span>${more ? `<button class="lnk" data-act="dtnav" data-n="${more}">alle anzeigen</button>` : ""}</div>${inner}</section>`;
    const wx = typeof WX !== "undefined" && WX && WX.cur ? `${Math.round(WX.cur.temperature_2m)} °C, ${WXC(WX.cur.weather_code)[1]}` : "";
    return `<div class="dtdash" data-k="dash">
      <div class="dtdashh"><div><h1>${h < 11 ? "Guten Morgen" : h < 17 ? "Hallo" : "Guten Abend"}${S.settings.name ? ", " + esc(S.settings.name) : ""}</h1><p>${WDL[d0.getDay()]}, ${d0.getDate()}. ${MN[d0.getMonth()]} ${d0.getFullYear()} · KW ${isoWeek(t)}${wx ? " · " + esc(wx) : ""}</p></div>
        <div class="dtkpis"><button data-act="dtnav" data-n="p:dran"><b>${calls.length}</b><span>Anrufe heute</span></button><button data-act="dtnav" data-n="t:"><b>${due.length}</b><span>Aufgaben fällig</span></button><button data-act="dtnav" data-n="p:bday"><b>${bd.filter(([, b]) => diffDays(t, b) <= 14).length}</b><span>Geburtstage (14 Tage)</span></button><button data-act="dtnav" data-n="s"><b>${shopN}</b><span>Einkauf offen</span></button><button data-act="dtnav" data-n="b:geld:exp"><b>${esc(eur(spent).replace(",00", ""))}</b><span>Ausgaben ${MN[d0.getMonth()]}</span></button></div></div>
      <div class="dtpanels">
      ${panel("Anrufe heute", calls.length, miniTbl([["Name"], ["Telefon", 140], ["Rhythmus", 110], ["Zuletzt", 105], ["", 180]], calls.map(p => `<tr data-act="person" data-id="${p.id}" class="lnkrow"><td><b>${esc(fullName(p))}</b></td><td>${esc(p.tel || "")}</td><td>${esc(cycLabel(p.cyc))}</td><td>${lastCall(p) ? esc(agoText(lastCall(p))) : "noch nie"}</td><td class="r"><button class="pb sm" data-act="call" data-id="${p.id}">Anrufen</button> <button class="pb sm" data-act="logcall" data-id="${p.id}">Eintragen …</button></td></tr>`), "Heute sind keine Anrufe dran."), "p:dran")}
      ${panel("Fällige Aufgaben", due.length, miniTbl([["", 30], ["Betreff"], ["Fällig", 95], ["Bereich", 140]], due.map(x => `<tr class="lnkrow" data-act="dtopent" data-id="${x.id}"><td><button class="box" role="checkbox" aria-checked="false" data-act="toggle" data-id="${x.id}" aria-label="erledigt"></button></td><td>${prioOf(x) ? `<i class="dtdot" style="--c:${prioOf(x)[2]}"></i>` : ""}${esc(x.t)}</td><td class="${x.date && x.date < t ? "late" : ""}">${x.date ? esc(x.date === t ? "heute" : fmtDate(x.date)) : ""}</td><td>${x.area && areaById(x.area) ? esc(areaById(x.area).n) : ""}</td></tr>`), "Nichts fällig."), "t:")}
      ${panel("Nächste 7 Tage", evs.length, miniTbl([["Datum", 100], ["Zeit", 55], ["Art", 120], ["Was"]], evs.slice(0, 40).map(e => `<tr class="lnkrow" data-act="${esc(e.act)}" data-id="${esc(e.id)}"><td>${esc(e.d === t ? "heute" : fmtDate(e.d))}</td><td>${esc(e.time || "")}</td><td><i class="dtdot ev-${esc(e.c)}"></i>${esc(e.k)}</td><td>${esc(e.t)}</td></tr>`), "Keine Termine in den nächsten 7 Tagen."), "k")}
      ${panel("Geburtstage (30 Tage)", bd.length, miniTbl([["Datum", 100], ["Name"], ["wird", 50], ["in", 80]], bd.map(([p, b]) => { const n = diffDays(t, b), a = ageAt(p, b); return `<tr class="lnkrow" data-act="person" data-id="${p.id}"><td>${esc(fmtDate(b))}</td><td>${n === 0 ? "<b>" : ""}${esc(fullName(p))}${n === 0 ? "</b>" : ""}</td><td>${a || ""}</td><td class="${n === 0 ? "late" : ""}">${n === 0 ? "heute" : "in " + pl(n, "Tag", "Tagen")}</td></tr>`; }), "Keine Geburtstage in den nächsten 30 Tagen."), "p:bday")}
      ${panel("Fristen und Dokumente", fr.length, miniTbl([["Datum", 100], ["Was"]], fr.slice(0, 20).map(f => `<tr class="lnkrow" data-act="${f.k === "i" ? "dtitem" : "dtdoc"}" data-id="${f.id}"><td class="${f.d < t ? "late" : ""}">${esc(fmtDate(f.d))}</td><td>${esc(f.t)}</td></tr>`), "Keine Fristen in den nächsten 90 Tagen."))}
      ${panel("Mirella", "", `<table class="dtg mini dtkv"><tbody>
        <tr class="lnkrow" data-act="dtnav" data-n="brief"><td style="width:150px">Tages-Briefing</td><td>${br ? `<b>${esc(briefTitle(br))}</b> · ${esc(briefWhen(br))}${br.read ? "" : ' <small class="tag">neu</small>'}` : '<span class="mut">noch keins</span>'}</td></tr>
        <tr class="lnkrow" data-act="dtnav" data-n="s"><td>Einkaufsliste</td><td>${pl(shopN, "Artikel offen", "Artikel offen")}</td></tr>
        <tr class="lnkrow" data-act="dtnav" data-n="b:geld:exp"><td>Geld im ${MN[d0.getMonth()]}</td><td>${esc(eur(spent))} ausgegeben${inc ? ` · übrig ${esc(eur(inc - fix - spent))}` : ""}</td></tr>
        <tr class="lnkrow" data-act="dtnav" data-n="w"><td>Wetter</td><td>${esc(wx || "Wetter anzeigen")}</td></tr>
        <tr class="lnkrow" data-act="dtsync"><td>Abgleich</td><td>${esc(typeof syOn === "function" && syOn() ? (SY.status || "angemeldet") : "nur auf diesem Gerät")}</td></tr></tbody></table>`)}
      </div></div>`;
  }

  /* ================================================================
     BEREICHE (je Art eine Tabelle mit Formular)
     ================================================================ */
  const BSUB = {};
  let iNew = null, iDirty = false;
  const kindsOf = id => Object.keys(KINDS).filter(k => KINDS[k].area === id);
  const PLURAL = { vertrag: "Verträge", versicherung: "Versicherungen", fahrzeug: "Fahrzeuge", zaehler: "Zähler", wohnung: "Wohnung & Vermieter", geraet: "Geräte", arzt: "Ärzte & Ansprechpartner", vorsorge: "Vorsorge-Termine", supplement: "Supplements", reise: "Reisen", ansprech: "Ansprechpartner", erstattung: "Auslagen zum Erstatten", verein: "Vereine & Kurse", ausruestung: "Ausrüstung" };
  const plural = k => PLURAL[k] || KINDS[k].n;
  function subsOf(id) {
    if (id === "geld") return [["exp", "Ausgaben"], ["fix", "Fixkosten"], ["goals", "Sparziele"], ...kindsOf(id).map(k => ["k:" + k, plural(k)]), ["erin", "Erinnerungen"], ["notes", "Notizen"], ["docs", "Dokumente"]];
    if (id === "doku") return [["docs", "Alle Dokumente"], ["erin", "Erinnerungen"], ["notes", "Notizen"]];
    if (id === "wecker") return [["wecker", "Wecker"], ["erin", "Erinnerungen"]];
    return [...kindsOf(id).map(k => ["k:" + k, plural(k)]), ["erin", "Erinnerungen"], ["notes", "Notizen"], ["docs", "Dokumente"]];
  }
  const bsub = () => { if (!area || !areaById(area)) return ""; const s = subsOf(area); if (!BSUB[area] || !s.some(x => x[0] === BSUB[area])) BSUB[area] = s[0][0]; return BSUB[area]; };
  const subCount = (id, k) => k.startsWith("k:") ? S.items.filter(x => x.kind === k.slice(2)).length : k === "erin" ? S.todos.filter(t => t.area === id && t.list === "todo" && !t.done).length : k === "notes" ? S.notes.filter(n => n.area === id).length : k === "docs" ? (id === "doku" ? S.docs.length : S.docs.filter(d => d.area === id).length) : k === "exp" ? S.expenses.filter(e => e.d.startsWith(finM)).length : k === "fix" ? fixCosts().list.length : k === "goals" ? (S.goals || []).length : k === "wecker" ? (S.alarms || []).length : 0;
  const fmtVal = (f, v) => { if (v === "" || v == null || v === false) return ""; if (f.t === "date") return fmtD(v); if (f.t === "month") return v.split("-").reverse().join("/"); if (f.t === "money") return eur(+v); if (f.t === "chk") return v ? "ja" : ""; if (f.t === "sel") return (f.o.find(o => String(o[0]) === String(v)) || [0, v])[1]; if (f.t === "ref") { const x = S.items.find(y => y.id === v); return x ? kindTitle(x.kind, x) : ""; } return String(v); };
  const isContract = k => k === "vertrag" || k === "versicherung";
  TB.i = {
    name: it => kindTitle(it.kind, it),
    find: id => S.items.find(x => x.id === id),
    cols: () => {
      const k = (bsub() || "").slice(2), K = KINDS[k]; if (!K) return [];
      const fs = K.fields.filter(f => !["area", "chk"].includes(f.t) && !f.third && !f.newOnly && f.k !== "note").slice(0, 6);
      const cols = fs.map((f, i) => ({ k: f.k, l: f.l.replace(/\s*\(.*\)$/, "").replace(/ in €$/, "").replace(/ €$/, ""), w: i === 0 ? 0 : f.t === "money" || f.t === "num" ? 95 : f.t === "date" || f.t === "month" ? 100 : f.t === "time" ? 70 : 140, cls: f.t === "money" || f.t === "num" ? "r" : "", e: ["text", "tel", "num", "money", "date", "time"].includes(f.t) || (f.t === "sel" && f.o) ? (f.t === "money" ? "num" : f.t === "tel" ? "text" : f.t === "sel" ? "sel" : f.t) : null, o: f.o, f, v: it => i === 0 ? `<b>${esc(f.k === "name" ? kindTitle(k, it) : fmtVal(f, it[f.k]))}</b>` : esc(fmtVal(f, it[f.k])), sort: (a, b) => String(a[f.k] == null ? "~" : a[f.k]).localeCompare(String(b[f.k] == null ? "~" : b[f.k]), "de", { numeric: true }) }));
      if (K.monthly) cols.push({ k: "_m", l: "pro Monat", w: 95, cls: "r", v: it => { const m = K.monthly(it); return m ? esc(eur(m)) : ""; }, sort: (a, b) => (K.monthly(a) || 0) - (K.monthly(b) || 0) });
      cols.push({ k: "_s", l: isContract(k) ? "Kündigung" : "Stand", w: 240, v: it => { if (isContract(k)) { const st = L.contractStatus(it, today()); if (!st) return '<span class="mut">keine Laufzeit</span>'; const warn = st.deadline && st.days <= lead(it); return `<span class="${warn ? "late" : ""}">${esc(st.deadline ? "kündbar bis " + fmtD(st.deadline) : st.text)}</span>`; } let s = ""; try { s = K.sub ? K.sub(it) : ""; } catch (_) { } return `<span class="mut">${esc(s)}</span>`; } });
      return cols;
    },
    order: () => iRows().map(x => x.id),
    commit(it, k, v) {
      const K = KINDS[it.kind], f = K.fields.find(x => x.k === k); if (!f) return;
      v = String(v).trim();
      if (f.req && !v) return `„${f.l}“ darf nicht leer sein`;
      if (f.t === "num" || f.t === "money") { if (v === "") it[k] = ""; else { const n = parseAmount(v); if (n == null) return "Bitte eine Zahl eintragen"; it[k] = n; } }
      else if (f.t === "sel" && f.o && typeof f.o[0][0] === "number") it[k] = +v;
      else it[k] = v;
    },
    after(it) { const old = JSON.parse(JSON.stringify(it)); if (KINDS[it.kind].onSave) KINDS[it.kind].onSave(it, false, old); syncAuto(it); }
  };
  function iRows() { const k = (bsub() || "").slice(2), ql = q.trim().toLowerCase(); return sortRows("i", S.items.filter(x => x.kind === k && (!ql || JSON.stringify(x).toLowerCase().includes(ql)))); }
  function areaHead(A) {
    const sub = bsub(), subs = subsOf(A.id);
    const sick = A.id === "gesund" && S.sick ? ` · <span class="late">krank gemeldet${S.sick.until ? " bis " + esc(fmtDate(S.sick.until)) : ""}</span>` : "";
    return `<div class="dthead"><span class="aic big" style="--ac:${A.c}">${IC[A.ic] || ""}</span><b>${esc(A.n)}</b><span>${esc(typeof areaSummary === "function" ? areaSummary(A.id) || "" : "")}${sick}</span></div><div class="dttabs sub" role="tablist">${subs.map(([k, l]) => { const n = subCount(A.id, k); return `<button role="tab" data-act="dtbsub" data-k="${k}" aria-selected="${sub === k}">${esc(l)}${n ? ` <small>(${n})</small>` : ""}</button>`; }).join("")}</div>`;
  }
  function areaHTML() {
    const A = areaById(area); if (!A) { view = "heute"; return dashHTML(); }
    const sub = bsub(), head = areaHead(A);
    if (sub === "wecker") return `<div class="dtview">${head}<div class="dtbody"><section class="dtpane dtsingle dtlegacy" data-k="wk"><div class="dtnarrow">${AREA_VIEW.wecker ? AREA_VIEW.wecker() : ""}</div></section></div></div>`;
    if (sub.startsWith("k:")) {
      const k = sub.slice(2), K = KINDS[k];
      for (const id of [...SEL.i]) if (!S.items.some(x => x.id === id && x.kind === k)) SEL.i.delete(id);
      const rows = iRows(), one = SEL.i.size === 1 && S.items.find(x => x.id === [...SEL.i][0]);
      let foot = "";
      if (K.monthly && rows.length) { const sum = rows.reduce((a, x) => a + (K.monthly(x) || 0), 0); foot = `<div class="dtsum">${pl(rows.length, "Eintrag", "Einträge")} · zusammen im Monat <b>${esc(eur(sum))}</b> · im Jahr <b>${esc(eur(sum * 12))}</b></div>`; }
      const grid = gridHTML("i", rows, { empty: `Noch keine ${plural(k)}. Oben auf „Neu: ${K.n}“. ${K.d || ""}` }) + foot;
      const det = iNew === k ? iFormHTML(k, null) : SEL.i.size > 1 ? `<div class="dtph">${ic("list", 30)}<div><h2>${SEL.i.size} ausgewählt</h2><p>${esc(plural(k))}</p></div></div><div class="dtpad"><div class="dtbtnrow"><button class="pb" data-act="dtdel">Löschen …</button><button class="pb" data-act="dtselnone">Auswahl aufheben</button></div></div>` : one ? iFormHTML(k, one) : noneHTML("doc", "Nichts ausgewählt", `${K.d || ""}. Eine Zeile anklicken oder oben auf „Neu: ${K.n}“.`);
      return paneLayout(head, grid, det, "il" + k);
    }
    if (sub === "erin") return erinHTML(head, A);
    if (sub === "notes") return notesHTML(head, A);
    if (sub === "docs") return docsPaneHTML(head, A);
    if (sub === "exp") return expHTML(head);
    if (sub === "fix") return fixHTML(head);
    if (sub === "goals") return goalsPaneHTML(head);
    return paneLayout(head, "", null, "x");
  }
  function erinHTML(head, A) {
    const l = S.todos.filter(t => t.area === A.id && t.list === "todo" && !t.done).sort((a, b) => ((a.date || "9999") + (a.time || "")).localeCompare((b.date || "9999") + (b.time || "")));
    const grid = `<table class="dtg"><thead><tr><th style="width:30px"></th><th>Betreff</th><th style="width:110px">Fällig</th><th style="width:75px">Uhrzeit</th><th style="width:120px">Wiederholung</th><th style="width:200px">Gehört zu</th></tr></thead><tbody>${l.map(x => { const it = x.ref && S.items.find(i => i.id === x.ref); return `<tr class="lnkrow" data-act="dtopent" data-id="${x.id}"><td><button class="box" role="checkbox" aria-checked="false" data-act="toggle" data-id="${x.id}" aria-label="erledigt"></button></td><td>${esc(x.t)}${x.auto ? ' <small class="tag">auto</small>' : ""}</td><td class="${x.date && x.date < today() ? "late" : ""}">${x.date ? esc(fmtDate(x.date)) : ""}</td><td>${esc(x.time || "")}</td><td>${x.rep && x.rep !== "nie" ? esc(x.rep) : ""}</td><td>${it ? esc(kindTitle(it.kind, it)) : ""}</td></tr>`; }).join("")}</tbody></table>${l.length ? "" : '<div class="dtempty">Keine offenen Erinnerungen.</div>'}`;
    const det = `<div class="dtph">${ic("bell", 30)}<div><h2>Erinnerungen ${esc(A.n)}</h2><p>${pl(l.length, "offene Erinnerung", "offene Erinnerungen")}</p></div></div><div class="dtpad"><div class="dtbtnrow col"><button class="pb pri" data-act="newtodo" data-area="${A.id}">Neue Erinnerung …</button><button class="pb" data-act="dtnav" data-n="t:a:${A.id}">In den Aufgaben bearbeiten</button></div><p class="dtmut">Mit „auto“ markierte Erinnerungen legt Mirella selbst an, z. B. Kündigungsfristen, TÜV oder Zähler ablesen. Klick auf eine Zeile öffnet sie in den Aufgaben.</p></div>`;
    return paneLayout(head, grid, det, "er");
  }
  /* Formular für einen Eintrag: alle Felder der Art, Beschriftung links */
  function fieldF(f, v, it) {
    const id = "i-" + f.k, val = v == null ? "" : v, hide = f.only && !f.only(it || {}) ? " hidden" : "", wide = f.t === "area" || !f.half;
    let ctl;
    if (f.t === "chk") ctl = `<label class="dtchk"><input type="checkbox" id="${id}"${val ? " checked" : ""}> ja</label>`;
    else if (f.t === "sel") ctl = `<select id="${id}">${opt(f.o, val)}</select>`;
    else if (f.t === "ref") ctl = `<select id="${id}">${opt([["", "–"], ...S.items.filter(x => x.kind === f.ref).map(x => [x.id, kindTitle(x.kind, x)])], val)}</select>`;
    else if (f.t === "area") ctl = `<textarea id="${id}" rows="4">${esc(val)}</textarea>`;
    else { const type = { date: "date", month: "month", time: "time", tel: "tel" }[f.t] || "text"; ctl = `<input id="${id}" type="${type}" autocomplete="off" value="${esc(f.t === "money" && val !== "" ? String(val).replace(".", ",") : val)}" placeholder="${esc(f.ph || "")}"${f.t === "num" || f.t === "money" ? ' inputmode="decimal" class="num"' : ""}>`; }
    return `<div class="f${wide ? " w" : ""}" data-fk="${f.k}"${hide}><label for="${id}">${esc(f.l)}${f.req ? " *" : ""}</label>${ctl}</div>`;
  }
  function iFormHTML(kind, it) {
    const K = KINDS[kind], v = it ? Object.assign({}, it) : {};
    if (!it) K.fields.forEach(f => { if (v[f.k] == null && f.def != null) v[f.k] = typeof f.def === "function" ? f.def() : f.def; else if (v[f.k] == null && f.t === "sel" && f.o) v[f.k] = f.o[0][0]; });
    const fs = K.fields.filter(f => !(f.newOnly && it));
    const thirds = fs.filter(f => f.third);
    const body = `<div class="fs">${esc(K.n)}</div>` + fs.filter(f => !f.third).map(f => fieldF(f, v[f.k], v)).join("") + (thirds.length ? `<div class="f w"><label>Einnahme</label><div class="dtbtnrow tight">${thirds.map(x => `<label class="dtchk"><input type="checkbox" id="i-${x.k}"${v[x.k] ? " checked" : ""}> ${esc(x.l)}</label>`).join("")}</div></div>` : "");
    let extra = "", sub = "";
    if (it) {
      try { sub = K.sub ? K.sub(it) : ""; } catch (_) { }
      const todos = S.todos.filter(t => t.ref === it.id && !t.done).sort((a, b) => (a.date || "").localeCompare(b.date || "")), docs = S.docs.filter(d => d.ref === it.id);
      if (kind === "zaehler") { const r = (it.reads || []).slice().sort((a, b) => a.d < b.d ? 1 : -1), u = KINDS.zaehler.unit ? KINDS.zaehler.unit(it) : ""; extra += `<div class="dtblock"><div class="dtblockh">Zählerstände <small>${typeof consumption === "function" ? esc(consumption(it) || "") : ""}</small></div><form class="dtadd" data-form="dtread"><input placeholder="Stand heute (${esc(u)})" inputmode="decimal" aria-label="Zählerstand"><button class="pb">Eintragen</button></form>${r.length ? `<table class="dtg mini"><thead><tr><th style="width:120px">Datum</th><th class="r">Stand</th><th class="r">Verbrauch seit davor</th><th style="width:34px"></th></tr></thead><tbody>${r.map((x, i) => { const prev = r[i + 1]; return `<tr><td>${esc(fmtD(x.d))}</td><td class="r">${esc((+x.v).toLocaleString("de-DE"))} ${esc(u)}</td><td class="r mut">${prev ? esc((+x.v - +prev.v).toLocaleString("de-DE")) + " " + esc(u) : ""}</td><td><button class="xb" data-act="dtreaddel" data-d="${esc(x.d)}" data-v="${esc(String(x.v))}" title="Löschen">✕</button></td></tr>`; }).join("")}</tbody></table>` : ""}</div>`; }
      if (kind === "reise") extra += `<div class="dtblock"><div class="dtblockh">Packliste <small>${(it.pack || []).filter(p => p.done).length}/${(it.pack || []).length}</small></div><div class="dtpack">${(it.pack || []).map(p => `<label class="dtchk${p.done ? " done" : ""}"><input type="checkbox" data-dt="pack" data-p="${p.id}"${p.done ? " checked" : ""}> ${esc(p.t)}</label>`).join("")}</div><form class="dtadd" data-form="dtpack"><input placeholder="Weiteres zum Einpacken" aria-label="Packliste ergänzen"><button class="pb">Hinzufügen</button></form></div>`;
      if (kind === "supplement") { let l = null; try { l = L.supplyLeft(it, today()); } catch (_) { } extra += `<div class="dtblock"><div class="dtblockh">Vorrat</div><p>${l ? `noch etwa ${Math.round(l.left)} Stück, reicht ${pl(l.days, "Tag", "Tage")}` : "Vorrat eintragen, dann erinnert Mirella ans Nachbestellen."}</p><button class="pb sm" data-act="restock" data-id="${it.id}">Nachgekauft …</button></div>`; }
      extra += `<div class="dtblock"><div class="dtblockh">Erinnerungen von Mirella <small>${todos.length || ""}</small></div>${todos.length ? `<table class="dtg mini"><tbody>${todos.map(t => `<tr class="lnkrow" data-act="dtopent" data-id="${t.id}"><td>${esc(t.t)}</td><td style="width:120px" class="${t.date && t.date < today() ? "late" : ""}">${esc(t.date ? relDate(t.date) : "")}${t.time ? " " + esc(t.time) : ""}</td></tr>`).join("")}</tbody></table>` : '<p class="dtmut">Gerade keine. Mirella legt sie an, sobald Fristen nahen.</p>'}</div>`;
      extra += `<div class="dtblock"><div class="dtblockh">${kind === "versicherung" ? "Police und Unterlagen" : kind === "vertrag" ? "Vertrag und Unterlagen" : "Dokumente"} <small>${docs.length || ""}</small></div><div class="dtbtnrow top"><button class="pb sm" data-act="pdffor" data-id="${it.id}">PDF hinzufügen …</button><button class="pb sm" data-act="docfor" data-id="${it.id}">Bild / Scan …</button></div>${docTable(docs)}</div>`;
    }
    const st = it && isContract(kind) ? L.contractStatus(it, today()) : null;
    const telN = it && (it.tel || it.hotline || it.shopTel), web = it && it.web;
    return `<div class="dtph"><span class="dtkic">${K.ic}</span><div><h2>${it ? esc(kindTitle(kind, it)) : "Neu: " + esc(K.n)}</h2><p>${esc(st ? (st.deadline ? "Kündigen bis " + fmtD(st.deadline) + " · " : "") + st.text : sub || K.d || "")}${it && K.monthly && K.monthly(it) ? " · " + esc(eur(K.monthly(it))) + " im Monat" : ""}</p></div><span class="dtchg" id="dtchg"${iDirty ? "" : " hidden"}>● Geändert – Strg+S speichert</span></div>
      <form class="dtiform dtfg" data-id="${it ? it.id : "new"}" data-kind="${kind}" autocomplete="off" onsubmit="return false">${body}
      <div class="dtformfoot full">${it ? `<button type="button" class="pb" data-act="dtdel">Löschen …</button>` : ""}${telN ? `<a class="pb" href="tel:${esc(intlTel(telN))}">Anrufen</a>` : ""}${web ? `<a class="pb" href="${esc(/^https?:/.test(web) ? web : "https://" + web)}" target="_blank" rel="noopener">Website öffnen</a>` : ""}<span class="dtgrow"></span><button type="button" class="pb" data-act="dtidiscard">Verwerfen (Esc)</button><button type="button" class="pb pri" data-act="dtisave">Speichern (Strg+S)</button></div></form>
      ${extra ? `<div class="dtpad">${extra}</div>` : ""}`;
  }
  function iFormRefresh() { const f = $(".dtiform"); if (!f) return; const kind = f.dataset.kind, c0 = readItem(kind); KINDS[kind].fields.forEach(x => { if (!x.only) return; const el = f.querySelector(`[data-fk="${x.k}"]`); if (el) el.hidden = !x.only(c0); }); }
  function iFormSave() {
    const f = $(".dtiform"); if (!f) return true;
    const kind = f.dataset.kind, id = f.dataset.id === "new" ? null : f.dataset.id, K = KINDS[kind], data = readItem(kind);
    const miss = K.fields.find(x => x.req && !data[x.k]); if (miss) { origToast(`Bitte „${miss.l}“ ausfüllen`); const el = document.getElementById("i-" + miss.k); if (el) el.focus(); return false; }
    let it = id && S.items.find(x => x.id === id); const old = it ? JSON.parse(JSON.stringify(it)) : null, isNew = !it;
    if (it) Object.assign(it, data); else { it = Object.assign({ id: uid(), kind, created: today() }, data); S.items.push(it); }
    if (K.onSave) K.onSave(it, isNew, old);
    syncAuto(it); iDirty = false; iNew = null; SEL.i.clear(); SEL.i.add(it.id); CUR.i = it.id; ANCH.i = it.id;
    const n = S.todos.filter(t => t.ref === it.id && t.auto && !t.done).length;
    lastMsg = `Gespeichert: ${kindTitle(kind, it)}`; save(); render(true); origToast(lastMsg + (n && isNew ? ` · ${n} Erinnerung${n > 1 ? "en" : ""} angelegt` : "")); scrollSel();
    return true;
  }
  /* Notizen je Bereich */
  TB.n = { name: n => n.t, find: id => S.notes.find(x => x.id === id), cols: () => [{ k: "d", l: "Datum", w: 110, e: "date", v: n => esc(fmtDate(n.d)), sort: (a, b) => (a.d || "").localeCompare(b.d || "") }, { k: "t", l: "Notiz", w: 0, e: "text", v: n => esc(n.t), sort: (a, b) => a.t.localeCompare(b.t, "de") }], order: () => nRows().map(n => n.id), commit(n, k, v) { v = v.trim(); if (k === "t" && !v) return "Die Notiz darf nicht leer sein"; n[k] = v; } };
  const nRows = () => sortRows("n", S.notes.filter(n => n.area === area && (!q || n.t.toLowerCase().includes(q.toLowerCase()))));
  function notesHTML(head, A) {
    const top = `<tr class="qa"><td colspan="2"><form data-form="dtnote"><input id="dtnotein" placeholder="${esc(typeof notePh === "function" ? notePh(A.id) : "Neue Notiz")} – eintippen und Enter" autocomplete="off" aria-label="Neue Notiz"></form></td></tr>`;
    return paneLayout(head, gridHTML("n", nRows(), { top, empty: "Noch keine Notizen." }), `<div class="dtph">${ic("note", 30)}<div><h2>Notizen ${esc(A.n)}</h2><p>${pl(S.notes.filter(n => n.area === A.id).length, "Notiz", "Notizen")}</p></div></div><div class="dtpad"><p class="dtmut">Kurze Vermerke mit Datum, z. B. „Kündigung abgeschickt“. Doppelklick ändert Text oder Datum, Entf löscht (mit Nachfrage).</p></div>`, "nl");
  }
  /* Dokumente */
  TB.d = {
    name: d => d.name, find: id => S.docs.find(x => x.id === id),
    cols: () => [
      { k: "name", l: "Name", w: 0, e: "text", v: d => `<b>${esc(d.name)}</b>`, sort: (a, b) => a.name.localeCompare(b.name, "de") },
      ...(area === "doku" ? [{ k: "area", l: "Bereich", w: 160, e: "darea", v: d => esc((areaById(d.area) || areaById("doku")).n), sort: (a, b) => (a.area || "").localeCompare(b.area || "") }] : []),
      { k: "folder", l: "Ordner / Art", w: 150, e: "text", v: d => esc(d.folder || ""), sort: (a, b) => (a.folder || "~").localeCompare(b.folder || "~", "de") },
      { k: "ref", l: "Gehört zu", w: 180, v: d => { const it = d.ref && (S.items.find(x => x.id === d.ref) || S.people.find(x => x.id === d.ref) || S.todos.find(x => x.id === d.ref)); return it ? esc(it.kind ? kindTitle(it.kind, it) : it.first != null ? fullName(it) : it.t) : ""; } },
      { k: "until", l: "Gültig bis", w: 105, e: "date", v: d => d.until ? `<span class="${d.until < today() ? "late" : ""}">${esc(fmtDate(d.until))}</span>` : "", sort: (a, b) => (a.until || "9999").localeCompare(b.until || "9999") },
      { k: "created", l: "Abgelegt", w: 105, v: d => esc(fmtDate(d.created || "")), sort: (a, b) => (a.created || "").localeCompare(b.created || "") }
    ],
    order: () => dRows().map(d => d.id),
    commit(d, k, v) { v = v.trim(); if (k === "name" && !v) return "Bitte einen Namen eintragen"; d[k] = v; }
  };
  const dRows = () => { const ql = q.toLowerCase(); return sortRows("d", S.docs.filter(d => (area === "doku" || d.area === area) && (!ql || (d.name + " " + (d.folder || "") + " " + (d.text || "")).toLowerCase().includes(ql)))); };
  function docTable(ds) { return ds.length ? `<table class="dtg mini"><tbody>${ds.map(d => `<tr class="lnkrow" data-act="viewphoto" data-id="${esc(d.photo || "")}"><td>${ic("doc", 13)} ${esc(d.name)}</td><td style="width:105px" class="mut">${esc(fmtDate(d.created || ""))}</td></tr>`).join("")}</tbody></table>` : '<p class="dtmut">Noch nichts abgelegt.</p>'; }
  function docsPaneHTML(head, A) {
    for (const id of [...SEL.d]) if (!S.docs.some(x => x.id === id)) SEL.d.delete(id);
    const one = SEL.d.size === 1 && S.docs.find(x => x.id === [...SEL.d][0]);
    const det = one ? `<div class="dtph"><span class="dtkic">${ic("doc", 22)}</span><div><h2>${esc(one.name)}</h2><p>${esc([one.folder, one.until ? "gültig bis " + fmtDate(one.until) : "", "abgelegt " + fmtDate(one.created || "")].filter(Boolean).join(" · "))}</p></div></div>
      <div class="dtpad"><div class="dtbtnrow top"><button class="pb pri" data-act="viewphoto" data-id="${esc(one.photo || "")}">Öffnen</button><button class="pb" data-act="editdoc" data-id="${one.id}">Bearbeiten …</button><button class="pb" data-act="dtdel">Löschen …</button></div>
      <div class="dtpreview"><img class="thumbimg" data-thumb="${esc(one.photo || "")}" alt=""></div>${one.text ? `<div class="dtblock"><div class="dtblockh">Erkannter Text</div><pre class="dtpre">${esc(one.text.slice(0, 4000))}</pre></div>` : ""}</div>`
      : noneHTML("doc", "Kein Dokument ausgewählt", "Dateien (PDF oder Bild) einfach ins Fenster ziehen, oder oben „PDF ablegen“.");
    return paneLayout(head, gridHTML("d", dRows(), { empty: "Noch keine Dokumente." }), det, "dl" + A.id);
  }
  /* Finanzen: Ausgaben, Fixkosten, Sparziele */
  TB.e = {
    name: e => e.shop || e.cat, find: id => S.expenses.find(x => x.id === id),
    cols: () => [
      { k: "d", l: "Datum", w: 110, e: "date", v: e => esc(fmtDate(e.d)), sort: (a, b) => a.d.localeCompare(b.d) },
      { k: "shop", l: "Wo / wofür", w: 0, e: "text", v: e => esc(e.shop || ""), sort: (a, b) => (a.shop || "~").localeCompare(b.shop || "~", "de") },
      { k: "cat", l: "Kategorie", w: 220, e: "cat", v: e => `<i class="dtdot sq" style="--c:${catColor(e.cat)}"></i>${esc(e.cat || "")}`, sort: (a, b) => (a.cat || "").localeCompare(b.cat || "", "de") },
      { k: "amount", l: "Betrag", w: 110, e: "num", cls: "r", get: e => e.amount, v: e => esc(eur(+e.amount)), sort: (a, b) => a.amount - b.amount },
      { k: "photo", l: "Beleg", w: 70, v: e => e.photo ? `<button class="lnk" data-act="viewphoto" data-id="${esc(e.photo)}">ansehen</button>` : "" }
    ],
    order: () => eRows().map(e => e.id),
    commit(e, k, v) { if (k === "amount") { const n = parseAmount(v); if (n == null) return "Bitte einen Betrag eintragen, z. B. 12,50"; e.amount = n; } else if (k === "d") { if (!v) return "Bitte ein Datum wählen"; e.d = v; } else e[k] = String(v).trim(); }
  };
  const eRows = () => { const ql = q.toLowerCase(); return sortRows("e", S.expenses.filter(e => e.d.startsWith(finM) && (!finCat || e.cat === finCat) && (!ql || ((e.shop || "") + " " + e.cat).toLowerCase().includes(ql)))); };
  function finSummary() {
    const ym = finM, month = S.expenses.filter(e => e.d.startsWith(ym)), sum = month.reduce((a, e) => a + +e.amount, 0), fix = fixCosts(), inc = +S.settings.income || 0, left = inc - fix.total - sum;
    const cats = {}; month.forEach(e => cats[e.cat] = (cats[e.cat] || 0) + +e.amount);
    const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]), bud = S.settings.budgets || {}, max = Math.max(1, ...sorted.map(x => x[1]));
    const hist = []; for (let i = 5; i >= 0; i--) { const k = addMonths(ym + "-15", -i).slice(0, 7); hist.push({ k, v: monthSum(k) }); }
    const maxH = Math.max(1, ...hist.map(h => h.v));
    return `<div class="dtph">${ic("euro", 30)}<div><h2>${MN[+ym.slice(5) - 1]} ${ym.slice(0, 4)}</h2><p>Monatsübersicht</p></div></div><div class="dtpad">
      <table class="dtg mini dtkv"><tbody><tr><td>Einnahmen im Monat</td><td class="r">${inc ? esc(eur(inc)) : `<button class="lnk" data-act="tabset" data-k="geld" data-t="Finanzen">eintragen …</button>`}</td></tr><tr><td>Fixkosten (Verträge, Miete …)</td><td class="r">− ${esc(eur(fix.total))}</td></tr><tr><td>Ausgaben ${MN[+ym.slice(5) - 1]}</td><td class="r">− ${esc(eur(sum))}</td></tr><tr class="tot"><td><b>Übrig</b></td><td class="r ${inc && left < 0 ? "late" : ""}"><b>${inc ? esc(eur(left)) : "–"}</b></td></tr></tbody></table>
      <div class="dtblock"><div class="dtblockh">Nach Kategorie ${finCat ? `<button class="lnk" data-act="fincat" data-c="">alle zeigen</button>` : "<small>Klick filtert die Tabelle</small>"}</div>${sorted.length ? `<table class="dtg mini"><tbody>${sorted.map(([c, v]) => { const b = +bud[c]; return `<tr class="lnkrow${finCat === c ? " sel" : ""}" data-act="fincat" data-c="${esc(c)}"><td style="width:180px"><i class="dtdot sq" style="--c:${catColor(c)}"></i>${esc(c)}</td><td><span class="dtbar"><i style="width:${Math.min(100, Math.round(v / (b || max) * 100))}%;background:${b && v > b ? "var(--dtlate)" : catColor(c)}"></i></span></td><td class="r" style="width:130px">${esc(eur(v))}${b ? ` <small class="mut">/ ${esc(eur(b))}</small>` : ""}</td></tr>`; }).join("")}</tbody></table>` : '<p class="dtmut">Keine Ausgaben in diesem Monat.</p>'}</div>
      <div class="dtblock"><div class="dtblockh">Letzte 6 Monate</div><div class="dthist">${hist.map(h => `<div title="${MN[+h.k.slice(5) - 1]} ${h.k.slice(0, 4)}: ${eur(h.v)}"><span>${h.v ? Math.round(h.v) : ""}</span><i style="height:${Math.max(2, Math.round(h.v / maxH * 80))}px"${h.k === ym ? ' class="on"' : ""}></i><small>${MN[+h.k.slice(5) - 1].slice(0, 3)}</small></div>`).join("")}</div></div>
    </div>`;
  }
  function expHTML(head) {
    for (const id of [...SEL.e]) if (!S.expenses.some(x => x.id === id)) SEL.e.delete(id);
    const [y, m] = finM.split("-").map(Number), rows = eRows(), sum = rows.reduce((a, e) => a + +e.amount, 0);
    const bar = `<div class="dtsubbar"><button class="pb sm" data-act="finm" data-n="-1" title="Vormonat">‹</button><b>${MN[m - 1]} ${y}</b><button class="pb sm" data-act="finm" data-n="1" title="Nächster Monat">›</button>${finCat ? `<span class="dtfilter">Kategorie: ${esc(finCat)} <button class="xb" data-act="fincat" data-c="" title="Filter aufheben">✕</button></span>` : ""}<span class="dtgrow"></span><span>${pl(rows.length, "Ausgabe", "Ausgaben")} · zusammen <b>${esc(eur(sum))}</b></span></div>`;
    const top = `<tr class="qa"><td colspan="5"><form data-form="dtexp" class="dtexpq"><input type="date" id="dtexp-d" value="${today().startsWith(finM) ? today() : finM + "-01"}" aria-label="Datum"><input id="dtexp-s" placeholder="Wo / wofür, z. B. REWE" aria-label="Wo" autocomplete="off"><select id="dtexp-c" aria-label="Kategorie">${opt(catList().map(c => [c, c]), S.settings.lastCat || catList()[0])}</select><input id="dtexp-a" placeholder="Betrag" inputmode="decimal" aria-label="Betrag" autocomplete="off"><button class="pb sm pri">Hinzufügen</button></form></td></tr>`;
    return paneLayout(head + bar, gridHTML("e", rows, { top, empty: "Keine Ausgaben in diesem Monat." }), finSummary(), "el");
  }
  function fixHTML(head) {
    const f = fixCosts();
    const rows = f.list.slice().sort((a, b) => b.m - a.m).map(x => `<tr class="lnkrow" data-act="dtitem" data-id="${x.it.id}"><td><b>${esc(kindTitle(x.it.kind, x.it))}</b></td><td>${esc(KINDS[x.it.kind].n)}${x.it.art ? " · " + esc(x.it.art) : ""}</td><td>${esc((areaById(KINDS[x.it.kind].area) || {}).n || "")}</td><td class="r">${esc(eur(x.m))}</td><td class="r">${esc(eur(x.m * 12))}</td></tr>`).join("");
    return paneLayout(head, `<table class="dtg"><thead><tr><th>Name</th><th style="width:220px">Art</th><th style="width:180px">Bereich</th><th style="width:120px" class="r">pro Monat</th><th style="width:120px" class="r">pro Jahr</th></tr></thead><tbody>${rows}${f.list.length ? `<tr class="tot"><td colspan="3"><b>Zusammen</b></td><td class="r"><b>${esc(eur(f.total))}</b></td><td class="r"><b>${esc(eur(f.total * 12))}</b></td></tr>` : ""}</tbody></table>${f.list.length ? "" : '<div class="dtempty">Noch keine festen Kosten. Verträge, Versicherungen, Miete und Vereine laufen hier automatisch mit.</div>'}`, finSummary(), "fx");
  }
  TB.g = {
    name: g => g.n, find: id => (S.goals || []).find(x => x.id === id),
    cols: () => [
      { k: "n", l: "Sparziel", w: 0, e: "text", v: g => `<b>${esc(g.n)}</b>` },
      { k: "saved", l: "Gespart", w: 120, e: "num", cls: "r", v: g => esc(eur(+g.saved || 0)) },
      { k: "target", l: "Ziel", w: 120, e: "num", cls: "r", v: g => esc(eur(+g.target || 0)) },
      { k: "_r", l: "Fehlt noch", w: 120, cls: "r", v: g => esc(eur(Math.max(0, (+g.target || 0) - (+g.saved || 0)))) },
      { k: "until", l: "Bis", w: 100, v: g => g.until ? esc(MN[+g.until.slice(5, 7) - 1].slice(0, 3) + " " + g.until.slice(0, 4)) : "" },
      { k: "_p", l: "Fortschritt", w: 200, v: g => { const p = g.target ? Math.min(100, Math.round(g.saved / g.target * 100)) : 0; return `<span class="dtbar"><i style="width:${p}%;background:${p >= 100 ? "var(--dtok)" : "var(--dtink)"}"></i></span> ${p} %`; } }
    ],
    order: () => (S.goals || []).map(g => g.id),
    commit(g, k, v) { if (k === "n") { v = v.trim(); if (!v) return "Bitte einen Namen eintragen"; g.n = v; } else { const n = parseAmount(v); if (n == null) return "Bitte einen Betrag eintragen"; g[k] = n; } }
  };
  function goalsPaneHTML(head) {
    const one = SEL.g.size === 1 && (S.goals || []).find(x => x.id === [...SEL.g][0]);
    const det = one ? `<div class="dtph"><span class="dtkic">${ic("goal", 22)}</span><div><h2>${esc(one.n)}</h2><p>${esc(eur(one.saved || 0))} von ${esc(eur(one.target || 0))}</p></div></div><div class="dtpad"><div class="dtbtnrow top"><button class="pb pri" data-act="goaladd" data-id="${one.id}">Einzahlen / Abheben …</button><button class="pb" data-act="goaledit" data-id="${one.id}">Bearbeiten …</button><button class="pb" data-act="goaldel" data-id="${one.id}">Löschen …</button></div><p class="dtmut">Doppelklick auf „Gespart“ oder „Ziel“ in der Tabelle ändert den Betrag direkt.</p></div>` : `<div class="dtph">${ic("goal", 30)}<div><h2>Sparziele</h2><p>${pl((S.goals || []).length, "Sparziel", "Sparziele")}</p></div></div><div class="dtpad"><button class="pb pri" data-act="goalnew">Neues Sparziel …</button><p class="dtmut">Zum Beispiel Urlaub, neues E-Bike oder ein Notgroschen.</p></div>`;
    return paneLayout(head, gridHTML("g", S.goals || [], { empty: "Noch kein Sparziel." }), det, "gl");
  }

  /* ================================================================
     BRIEFINGS
     ================================================================ */
  TB.r = {
    name: b => briefTitle(b), find: id => S.briefings.find(x => x.id === id),
    cols: () => [
      { k: "read", l: "", w: 30, cls: "cbx", v: b => b.read ? "" : '<i class="dtnew" title="noch nicht gelesen"></i>' },
      { k: "d", l: "Datum", w: 130, v: b => esc(fmtDate(b.d)), sort: (a, b) => (a.d + (a.time || "")).localeCompare(b.d + (b.time || "")) },
      { k: "time", l: "Uhrzeit", w: 80, v: b => esc(b.time || "") },
      { k: "t", l: "Briefing", w: 0, v: b => b.read ? esc(briefTitle(b)) : `<b>${esc(briefTitle(b))}</b>` },
      { k: "src", l: "Herkunft", w: 150, v: b => b.remote ? "automatisch" : "selbst abgelegt" },
      { k: "pdf", l: "Datei", w: 190, v: b => b.remote ? (b.pdf ? "PDF" : '<span class="mut">kommt noch</span>') : esc(b.name || "") }
    ],
    order: () => rRows().map(b => b.id), commit() { }
  };
  const rRows = () => sortRows("r", S.briefings.slice());
  function briefHTML() {
    for (const id of [...SEL.r]) if (!S.briefings.some(x => x.id === id)) SEL.r.delete(id);
    const l = rRows(), one = SEL.r.size === 1 && S.briefings.find(x => x.id === [...SEL.r][0]);
    const head = `<div class="dthead"><b>Briefings</b><span>${pl(l.length, "Briefing", "Briefings")} · ${S.briefings.filter(b => !b.read).length} ungelesen</span><span class="dthint">Kommt jeden Tag um 8 Uhr automatisch. Jedes Briefing bleibt 7 Tage.</span></div>`;
    let det;
    if (one) {
      const src = one.remote && one.pdf ? webBase() + one.pdf : "";
      det = `<div class="dtph">${ic("doc", 30)}<div><h2>${esc(briefTitle(one))}</h2><p>${esc(briefWhen(one))}${one.name && !one.remote ? " · " + esc(one.name) : ""}</p></div></div>
        <div class="dtpad"><div class="dtbtnrow top"><button class="pb pri" data-act="openbrief" data-id="${esc(one.id)}">In neuem Fenster öffnen</button>${one.remote ? "" : `<button class="pb" data-act="dtdel">Löschen …</button>`}</div></div>
        ${src ? `<iframe class="dtpdfv" src="${esc(src)}#view=FitH" title="Briefing"></iframe>` : `<p class="dtmut dtpad">${one.remote ? "Das PDF wird gerade abgelegt und ist in wenigen Minuten da." : "Zum Ansehen „Öffnen“ klicken."}</p>`}`;
    } else det = noneHTML("doc", "Kein Briefing ausgewählt", "Eine Zeile anklicken: Das PDF erscheint hier rechts.");
    return paneLayout(head, gridHTML("r", l, { empty: "Noch keine Briefings." }), det, "rl");
  }

  /* ================================================================
     WETTER – Tabellen Stunde für Stunde und 7 Tage
     ================================================================ */
  let wxLoading = false;
  function wxHTML() {
    const head0 = `<div class="dthead"><b>Wetter</b>`;
    if (!WX || !WX.cur) {
      if (!wxLoading) { wxLoading = true; Promise.resolve(loadWeather(true)).catch(() => { }).then(() => { wxLoading = false; if (on && view === "wetter" && WX && WX.cur) render(true); }); }
      return `<div class="dtview">${head0}<span>wird geladen …</span></div><div class="dtbody"><section class="dtpane dtsingle" data-k="wx"><div class="dtpad"><div id="wx"><p class="dtmut">Wetter wird geladen. Falls nichts kommt: Mirella braucht den Standort.</p></div><button class="pb" data-act="wxhere">Standort freigeben</button></div></section></div></div>`;
    }
    const c = WX.cur, hr = WX.hourly || {}, dl = WX.daily || {}, t = hr.time || [];
    const i0 = Math.max(0, t.findIndex(x => x >= wxNowIso()));
    const hrows = []; let lastD = "";
    for (let i = i0; i < Math.min(t.length, i0 + 36); i++) {
      const d = t[i].slice(0, 10); if (d !== lastD) { hrows.push(`<tr class="gh"><td colspan="8"><b>${esc(d === today() ? "Heute" : relDate(d))}</b><span>${esc(fmtDate(d))}</span></td></tr>`); lastD = d; }
      const [e, txt] = WXC((hr.weather_code || [])[i]), pp = (hr.precipitation_probability || [])[i], mm = (hr.precipitation || [])[i];
      hrows.push(`<tr${pp >= 50 ? ' class="wet"' : ""}><td>${esc(t[i].slice(11, 16))}</td><td>${e} ${esc(txt)}</td><td class="r"><b>${Math.round((hr.temperature_2m || [])[i])} °</b></td><td class="r">${Math.round((hr.apparent_temperature || [])[i])} °</td><td class="r">${pp != null ? pp + " %" : ""}</td><td class="r">${mm ? String(mm).replace(".", ",") + " mm" : ""}</td><td class="r">${(hr.wind_gusts_10m || [])[i] != null ? Math.round(hr.wind_gusts_10m[i]) + " km/h" : ""}</td><td class="r">${(hr.uv_index || [])[i] != null ? Math.round(hr.uv_index[i]) : ""}</td></tr>`);
    }
    const drows = (dl.time || []).map((d, i) => { const [e, txt] = WXC((dl.weather_code || [])[i]); return `<tr><td><b>${esc(i === 0 ? "Heute" : WDL[D(d).getDay()])}</b></td><td>${esc(fmtDate(d))}</td><td>${e} ${esc(txt)}</td><td class="r">${Math.round((dl.temperature_2m_min || [])[i])} °</td><td class="r"><b>${Math.round((dl.temperature_2m_max || [])[i])} °</b></td><td class="r">${(dl.precipitation_probability_max || [])[i] ?? ""} %</td><td class="r">${(dl.precipitation_sum || [])[i] ? String(dl.precipitation_sum[i]).replace(".", ",") + " mm" : ""}</td><td>${esc(((dl.sunrise || [])[i] || "").slice(11, 16))} – ${esc(((dl.sunset || [])[i] || "").slice(11, 16))}</td><td class="r">${(dl.uv_index_max || [])[i] != null ? Math.round(dl.uv_index_max[i]) : ""}</td></tr>`; }).join("");
    const [ce, ctxt] = WXC(c.weather_code);
    let rain = ""; try { const r0 = typeof wxRainText === "function" ? wxRainText() : ""; rain = typeof r0 === "string" ? r0.replace(/<[^>]+>/g, "") : ""; } catch (_) { }
    const list = `<div class="dtpad"><div class="dtblock"><div class="dtblockh">Stunde für Stunde</div><table class="dtg mini dtwx"><thead><tr><th style="width:70px">Zeit</th><th>Wetter</th><th style="width:80px" class="r">Temperatur</th><th style="width:80px" class="r">gefühlt</th><th style="width:80px" class="r">Regen</th><th style="width:80px" class="r">Menge</th><th style="width:90px" class="r">Böen</th><th style="width:50px" class="r">UV</th></tr></thead><tbody>${hrows.join("")}</tbody></table></div></div>`;
    const det = `<div class="dtph"><span class="dtwxbig">${ce}</span><div><h2>${Math.round(c.temperature_2m)} °C · ${esc(ctxt)}</h2><p>${esc(WX.place || "")} · Stand ${esc(new Date(WX.t).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }))} Uhr</p></div></div>
      <div class="dtpad"><table class="dtg mini dtkv"><tbody><tr><td>Gefühlt</td><td class="r">${Math.round(c.apparent_temperature)} °C</td></tr><tr><td>Luftfeuchte</td><td class="r">${c.relative_humidity_2m != null ? c.relative_humidity_2m + " %" : "–"}</td></tr><tr><td>Wind / Böen</td><td class="r">${Math.round(c.wind_speed_10m || 0)} / ${Math.round(c.wind_gusts_10m || 0)} km/h</td></tr>${rain ? `<tr><td>Regen</td><td class="r">${esc(rain)}</td></tr>` : ""}</tbody></table>
      <div class="dtblock"><div class="dtblockh">Die nächsten Tage</div><table class="dtg mini"><thead><tr><th style="width:90px">Tag</th><th style="width:90px">Datum</th><th>Wetter</th><th class="r" style="width:50px">min</th><th class="r" style="width:50px">max</th><th class="r" style="width:55px">Regen</th><th class="r" style="width:65px">Menge</th><th style="width:100px">Sonne</th><th class="r" style="width:35px">UV</th></tr></thead><tbody>${drows}</tbody></table></div></div>`;
    return `<div class="dtview">${head0}<span>${esc(WX.place || "")} · jetzt ${Math.round(c.temperature_2m)} °C, ${esc(ctxt)}</span><span class="dthint">Daten von Open-Meteo, alle 30 Minuten neu</span></div><div class="dtbody wxbody"><section class="dtpane dtlist" data-k="wxl">${list}</section><div class="dtsplit" role="separator"></div><aside class="dtpane dtdetail wide" data-k="wxd">${det}</aside></div></div>`;
  }

  /* ================================================================
     EINSTELLUNGEN – links die Abschnitte, rechts die Optionen
     ================================================================ */
  function setHTML() {
    const s0 = setSec; let idx = "";
    setSec = ""; try { idx = ORIG.einstellungen.call(R); } catch (_) { } finally { setSec = s0; }
    const tmp = document.createElement("div"); tmp.innerHTML = idx;
    const secs = []; tmp.querySelectorAll(".sethead2, .drow[data-k]").forEach(n => { if (n.classList.contains("sethead2")) secs.push({ h: n.textContent.trim() }); else secs.push({ k: n.dataset.k, l: ((n.querySelector("b") || n).textContent || "").trim(), s: ((n.querySelector("small") || {}).textContent || "").trim() }); });
    const foot = ((tmp.querySelector(".swipehint") || {}).textContent || "").trim();
    if (!setSec || !SETS[setSec]) setSec = (secs.find(x => x.k) || { k: "heute" }).k;
    const curS = secs.find(x => x.k === setSec) || { l: setLabel(setSec), s: "" };
    let body = ""; try { body = ORIG.einstellungen.call(R); } catch (e) { body = `<p>Fehler: ${esc(e.message)}</p>`; }
    body = body.replace(/^\s*<div class="top">[\s\S]*?<\/span><\/div>/, "").replace(/<p class="big">[\s\S]*?<\/p>/, "");
    const nav = secs.map(x => x.h ? `<div class="dtseth">${esc(x.h)}</div>` : `<button class="dti${x.k === setSec ? " on" : ""}" data-act="dtsetsec" data-k="${esc(x.k)}" title="${esc(x.s)}"><span class="l">${esc(x.l)}</span></button>`).join("");
    return `<div class="dtview"><div class="dthead"><b>Einstellungen</b><span>${esc(curS.l)}</span><span class="dthint">Änderungen gelten sofort</span></div><div class="dtbody"><nav class="dtpane dtsetnav" data-k="sn">${nav}<p class="dtmut dtpad">${esc(foot)}</p></nav><section class="dtpane dtset" data-k="sb_${esc(setSec)}"><div class="dtsetin"><div class="dtph flat"><div><h2>${esc(curS.l)}</h2><p>${esc(curS.s)}</p></div></div><div class="dtsetbody">${body}</div></div></section></div></div>`;
  }
  /* Ältere Seiten (z. B. Auswertungen, Wecker): im Programm-Rahmen, ohne App-Kopf */
  function legacyHTML(title, sub, inner, k) {
    inner = String(inner || "").replace(/^\s*<div class="top">[\s\S]*?<\/span><\/div>/, "").replace(/<p class="big"[^>]*>[\s\S]*?<\/p>/, "");
    return `<div class="dtview"><div class="dthead"><b>${esc(title)}</b><span>${esc(sub || "")}</span></div><div class="dtbody"><section class="dtpane dtsingle dtlegacy" data-k="${k}"><div class="dtnarrow">${inner}</div></section></div></div>`;
  }

  /* ================================================================
     ANSICHTEN EINHÄNGEN
     ================================================================ */
  const ORIG = { menschen: R.menschen, akte: R.akte, todos: R.todos, heute: R.heute, kalender: R.kalender, bereich: R.bereich, briefings: R.briefings, wetter: R.wetter, einstellungen: R.einstellungen, auswertungen: R.auswertungen };
  R.menschen = function () { return on ? contactsHTML() : ORIG.menschen.apply(this, arguments); };
  R.akte = function () {
    if (!on) return ORIG.akte.apply(this, arguments);
    const p = S.people.find(x => x.id === cur); if (!p) { view = "menschen"; return contactsHTML(); }
    if (!pRows().some(x => x.id === cur)) { cf = p.arch ? "arch" : "all"; q = ""; }
    return contactsHTML();
  };
  R.todos = function () { if (!on || shopMode) return ORIG.todos.apply(this, arguments); return todoList === "einkauf" ? shopHTML() : todosHTML(); };
  R.heute = function () { return on ? dashHTML() : ORIG.heute.apply(this, arguments); };
  R.bereich = function () { return on ? areaHTML() : ORIG.bereich.apply(this, arguments); };
  R.briefings = function () { return on ? briefHTML() : ORIG.briefings.apply(this, arguments); };
  if (ORIG.wetter) R.wetter = function () { return on ? wxHTML() : ORIG.wetter.apply(this, arguments); };
  R.einstellungen = function () { return on ? setHTML() : ORIG.einstellungen.apply(this, arguments); };
  R.karten = function () { return on ? kartenHTML() : legacyHTML("Karten durchgehen", "", '<p class="hint">Das Durchgehen der Karten gibt es am iPhone (Kontakte) und am PC im breiten Fenster.</p>', "kd"); };
  if (ORIG.auswertungen) R.auswertungen = function () {
    if (!on) return ORIG.auswertungen.apply(this, arguments);
    if (typeof auswStats !== "function") return legacyHTML("Auswertungen", "Wie oft du wen erreichst, Geld und mehr", ORIG.auswertungen.apply(this, arguments), "aw");
    const st = auswStats();
    return `<div class="dtdash" data-k="aw"><div class="dtdashh"><div><h1>Auswertungen</h1><p>Was sich aus deinen Einträgen ablesen lässt. Gerechnet wird auf diesem Gerät.</p></div></div>
      <div class="dtpanels">${st.map(s => `<section class="dtpanel"><div class="dtpanelh"><b>${esc(s.h)}</b><span>${s.rows.length}</span></div><table class="dtg mini dtkv dtaw"><thead><tr><th>Kennzahl</th><th style="text-align:right">Wert</th></tr></thead><tbody>${s.rows.map(r => `<tr><td>${esc(r[0])}${r[2] ? ` <span class="mut">· ${esc(String(r[2]))}</span>` : ""}</td><td style="text-align:right"><b>${esc(String(r[1]))}</b></td></tr>`).join("")}</tbody></table></section>`).join("")}</div></div>`;
  };
  R.kalender = function () {
    if (!on) return ORIG.kalender.apply(this, arguments);
    const k = ORIG.kalender.apply(this, arguments).replace(topbar("Kalender"), "");
    const lbl = { tag: "Tag", woche: "Woche", monat: "Monat", liste: "Liste" }[calView] || "";
    return `<div class="dtview"><div class="dthead"><b>Kalender</b><span>${esc(lbl)} · ${esc(MN[calM] + " " + calY)}</span><span class="dthint">Aufgaben im Monat auf einen anderen Tag ziehen · Rechtsklick auf einen Tag: neuer Eintrag</span></div><div class="dtbody"><section class="dtpane dtcal" data-k="cl" data-cv="${esc(calView)}">${k}</section></div></div>`;
  };
  function calDecorate() {
    const pane = $("#screen .dtcal"); if (!pane || calView !== "monat") return;
    const n = new Date(calY, calM + 1, 0).getDate(), ev = eventsRange(iso(new Date(calY, calM, 1, 12)), iso(new Date(calY, calM, n, 12)));
    for (const b of $$("#screen .mc[data-d]")) {
      b.dataset.drop = "d:" + b.dataset.d;
      const e = ev[b.dataset.d] || []; if (!e.length) continue;
      const box = document.createElement("span"); box.className = "mcev";
      box.innerHTML = e.slice(0, 5).map(x => `<i class="ev-${esc(x.c)}"${x.act === "edittodo" ? ` draggable="true" data-tid="${esc(x.id)}" title="Ziehen, um den Tag zu ändern"` : ""}>${esc((x.time ? x.time + " " : "") + x.t)}</i>`).join("") + (e.length > 5 ? `<i class="more">+ ${e.length - 5} weitere</i>` : "");
      b.appendChild(box);
    }
    const mg = pane.querySelector(".mg"); if (!mg) return;
    const side = document.createElement("aside"); side.className = "dtcalside";
    let x = mg.nextElementSibling; while (x) { const nx = x.nextElementSibling; side.appendChild(x); x = nx; }
    const wrap = document.createElement("div"); wrap.className = "dtcalwrap"; mg.parentNode.insertBefore(wrap, mg); wrap.appendChild(mg); wrap.appendChild(side);
  }

  /* ================================================================
     KARTEN DURCHGEHEN (wie am iPhone, Fortschritt geteilt, siehe karten.js)
     ================================================================ */
  let kdTab = "karten", kdPid = null, kdQ = "", kdM = null;
  const kdRows = () => { const ql = q.trim().toLowerCase(); return KA.queue().map(c => Object.assign(c, { id: KA.cKey(c) })).filter(c => !ql || ((c.b ? c.title : fullName(c)) + " " + (c.tel || "") + " " + (c.org || "")).toLowerCase().includes(ql)); };
  const kdName = c => c.b ? KA.bName(c) || c.title : fullName(c) || "(ohne Namen)";
  TB.k = {
    name: c => kdName(c),
    find: id => kdRows().find(c => c.id === id),
    cols: () => [
      { k: "n", l: "Name", w: 220, v: c => `<b>${esc(kdName(c))}</b>${c.org && c.org !== fullName(c) ? ` <small class="mut">${esc(c.org)}</small>` : ""}` },
      { k: "src", l: "Woher", w: 160, v: c => c.b ? "Geburtstags-Kalender" : "iPhone-Telefonbuch" },
      { k: "tel", l: "Nummer", w: 160, v: c => esc(c.tel || "") + ((c.tels || []).length ? ` <small class="mut">+${c.tels.length}</small>` : "") },
      { k: "bday", l: "Geburtstag", w: 110, v: c => esc(c.b ? KA.fmtMd(c.md) + (c.year || "") : KA.fmtB(c.bday || "")) },
      { k: "hit", l: "Mögliche Treffer", w: 0, v: c => { const h = KA.cands(c, kdCache); return h.length ? `<span class="late">${pl(h.length, "Treffer", "Treffer")}</span> <small class="mut">${esc(h.slice(0, 2).map(x => x.e.name).join(", "))}</small>` : '<span class="mut">—</span>'; } }
    ],
    order: () => kdRows().map(c => c.id)
  };
  let kdCache = null;
  const kdEnt = (id, list) => { if (id.startsWith("p:")) { const p = S.people.find(x => x.id === id.slice(2)); return p ? KA.ent(p, "p") : null; } const c = (list || KA.queue()).find(x => KA.cKey(x) === id); return c ? KA.ent(c, c.b ? "b" : "c") : null; };
  const entSub = e => e.kind === "b" ? "Geburtstag im Kalender am " + KA.fmtMd(e.x.md) + (e.x.year || "") : [e.kind === "p" ? "schon in Mirella" : "weiterer Eintrag im Telefonbuch", e.x.tel, ...(e.x.tels || []).map(t => t.n), e.x.email, e.x.bday ? "Geburtstag " + KA.fmtB(e.x.bday) : ""].filter(Boolean).join(" · ");
  function kdCardHTML(c) {
    const rows = c.b ? [["Geburtstag", KA.fmtMd(c.md) + (c.year || "")], ["Eintrag im Kalender", c.title], ["Woher", "Nur im Geburtstags-Kalender, kein Eintrag im Telefonbuch"]]
      : [c.org ? ["Firma", c.org] : null, c.tel ? [c.telL || "Nummer", c.tel] : null, ...(c.tels || []).map(t => [t.l || "Nummer", t.n]), ...[...new Set([c.email, ...(c.emails || [])].filter(Boolean))].map(m => ["E-Mail", m]), c.bday ? ["Geburtstag", KA.fmtB(c.bday) + (c.bsrc ? " (aus dem Kalender: „" + c.bsrc + "“)" : "")] : null, c.addr ? ["Adresse", c.addr] : null].filter(Boolean);
    return `<table class="dtg mini dtkv"><tbody>${rows.length ? rows.map(([l, v]) => `<tr><td style="width:150px">${esc(l)}</td><td>${esc(v)}</td></tr>`).join("") : '<tr><td class="mut">Ohne Nummer, E-Mail und Geburtstag</td></tr>'}</tbody></table>`;
  }
  function kdHits(c, list) {
    const ql = normName(kdQ), qd = kdQ.replace(/\D/g, ""), me = KA.cKey(c);
    if (ql.length < 2 && qd.length < 3) return `<p class="dtmut">Mindestens zwei Buchstaben oder drei Ziffern. Gesucht wird in Mirella, im Telefonbuch und im Geburtstags-Kalender.</p>`;
    const all = S.people.filter(p => !p.arch).map(p => KA.ent(p, "p")).concat(list.filter(x => KA.cKey(x) !== me && !(c.b && x.b)).map(x => KA.ent(x, x.b ? "b" : "c")));
    const hits = all.filter(e => (ql.length >= 2 && (normName(e.name).includes(ql) || fuzzyHas(e.name + " " + (e.x.org || "") + " " + (e.kind === "b" ? e.x.title : ""), ql))) || (qd.length >= 3 && [e.x.tel, ...((e.x.tels || []).map(t => t.n))].some(n => (n || "").replace(/\D/g, "").includes(qd)))).slice(0, 30);
    return hits.length ? `<table class="dtg mini"><thead><tr><th>Name</th><th>Was</th><th style="width:110px"></th></tr></thead><tbody>${hits.map(e => `<tr><td><b>${esc(e.name)}</b></td><td class="mut">${esc(entSub(e))}</td><td><button class="pb sm" data-act="dtkmerge" data-k="${esc(e.id)}">${e.kind === "b" || c.b ? "Geburtstag …" : "Verbinden …"}</button></td></tr>`).join("")}</tbody></table>` : '<p class="dtmut">Niemand gefunden.</p>';
  }
  function kdDetail(list) {
    if (kdPid) {
      const p = S.people.find(x => x.id === kdPid);
      if (p) return `<div class="dtph">${avHTML(p)}<div><h2>${esc(fullName(p))} ist drin</h2><p>Jetzt kurz pflegen, dann ist der Kontakt fertig und kommt nicht wieder als Karte.${p.local ? " Ohne Nummer, deshalb steht er nur in Mirella." : ""}</p></div><span class="dtchg" id="dtchg"${fDirty ? "" : " hidden"}>● Geändert – Strg+S speichert</span></div>${pFormHTML(p).replace(/<button type="button" class="pb" data-act="dtplog">[\s\S]*?data-act="dtdel">Löschen …<\/button>/, "")}<div class="dtpad"><div class="dtbtnrow"><span class="dtgrow"></span><button class="pb pri" data-act="dtkdone">Fertig, nächste Karte</button></div></div>`;
      kdPid = null;
    }
    if (SEL.k.size > 1) {
      const l = selOf("k"), ph = l.filter(c => !c.b);
      return `<div class="dtph">${ic("people", 30)}<div><h2>${pl(l.length, "Karte", "Karten")} ausgewählt</h2><p>${esc(l.slice(0, 8).map(kdName).join(", "))}${l.length > 8 ? " …" : ""}</p></div></div><div class="dtpad"><div class="dtbtnrow col"><button class="pb" data-act="dtknicht">Alle nicht in Mirella …</button><button class="pb" data-act="dtklater">Alle später</button>${ph.length ? `<button class="pb" data-act="dtkdel">${ph.length === 1 ? "Ganz löschen …" : ph.length + " ganz löschen …"}</button>` : ""}<button class="pb" data-act="dtselnone">Auswahl aufheben</button></div><p class="dtmut">„Rein in Mirella“ und Verbinden gehen nur einzeln, damit nichts falsch zusammenkommt.</p></div>`;
    }
    const c = CUR.k && list.find(x => KA.cKey(x) === CUR.k);
    if (!c) return noneHTML("people", "Keine Karte ausgewählt", "Links eine Karte anklicken. Mit Strg oder Umschalt mehrere wählen.");
    const cands = KA.cands(c, list), lock = cands.length > 0;
    return `<div class="dtph">${ic(c.b ? "gift" : "people", 30)}<div><h2>${esc(kdName(c))}</h2><p>${c.b ? "Nur im Geburtstags-Kalender" : "Aus dem iPhone-Telefonbuch, noch nicht in Mirella"}</p></div></div>
      <div class="dtpad">${kdCardHTML(c)}
      <div class="dtblock"><div class="dtblockh">1. Gehört das zu einem anderen Eintrag?</div>
      ${cands.length ? `<p class="dtmut">Mirella hat ${cands.length === 1 ? "einen möglichen Treffer" : cands.length + " mögliche Treffer"} gefunden. Bitte bei jedem entscheiden.</p><table class="dtg mini"><thead><tr><th>Name</th><th>Was</th><th>Grund</th><th style="width:260px"></th></tr></thead><tbody>${cands.map(x => `<tr><td><b>${esc(x.e.name)}</b></td><td class="mut">${esc(entSub(x.e))}</td><td>${esc(x.w)}</td><td><div class="dtbtnrow tight"><button class="pb sm pri" data-act="dtkmerge" data-k="${esc(x.e.id)}">${x.e.kind === "b" || c.b ? "Geburtstag übernehmen …" : "Verbinden …"}</button><button class="pb sm" data-act="dtknotsame" data-k="${esc(x.e.id)}">Nicht dieselbe Person</button></div></td></tr>`).join("")}</tbody></table>` : '<p class="dtmut">Mirella hat keinen passenden Eintrag gefunden.</p>'}
      <form class="dtadd" data-form="dtkq" onsubmit="return false"><input id="dtkq" placeholder="Selbst suchen und verbinden: Name oder Nummer" value="${esc(kdQ)}" autocomplete="off" aria-label="Selbst suchen und verbinden"></form><div id="dtkql">${kdQ ? kdHits(c, list) : ""}</div></div>
      <div class="dtblock"><div class="dtblockh">2. Was soll mit ${c.b ? "diesem Geburtstag" : "diesem Eintrag"} passieren?</div>
      ${lock ? '<p class="dtmut">„Rein in Mirella“ geht, sobald du oben bei jedem Treffer entschieden hast.</p>' : ""}
      <div class="dtbtnrow"><button class="pb${lock ? "" : " pri"}" data-act="dtkrein"${lock ? " disabled" : ""}>Rein in Mirella${c.b ? " (ohne Nummer)" : ""}</button><button class="pb" data-act="dtknicht">Nicht in Mirella</button><button class="pb" data-act="dtklater">Später</button>${c.b ? "" : '<button class="pb" data-act="dtkdel">Ganz löschen …</button>'}</div>
      <p class="dtmut">${c.b ? "„Nicht in Mirella“ lässt den Kalender, wie er ist." : "„Nicht in Mirella“ lässt den Eintrag im Telefonbuch und fragt nie wieder. Verbinden und Löschen im Telefonbuch macht dein iPhone, sobald du Mirella dort öffnest."}</p></div></div>`;
  }
  /* Doppelte Kontakte in Mirella */
  function dupPairs() {
    const pairs = [], seen = new Set(), ns = new Set(S.settings.notSame || []);
    for (const p of S.people) { if (seen.has(p.id) || p.arch) continue; for (const d of findDups(p, p.id)) { if (seen.has(d.id) || d.arch) continue; if (KA.nsHas(ns, KA.ent(p, "p"), KA.ent(d, "p"))) continue; pairs.push([p, d, KA.matchWhy(KA.ent(p, "p"), KA.ent(d, "p")) || "Ähnlich"]); } seen.add(p.id); }
    return pairs;
  }
  function dupHTML() {
    const pairs = dupPairs(), info = p => [p.tel, p.email, p.bday ? "Geburtstag " + KA.fmtB(p.bday) : "", p.group].filter(Boolean).join(" · ");
    return pairs.length ? `<table class="dtg"><thead><tr><th style="width:240px">Kontakt 1 (bleibt)</th><th style="width:240px">Kontakt 2</th><th style="width:200px">Grund</th><th></th></tr></thead><tbody>${pairs.map(([a, b, w]) => `<tr><td><button class="lnk" data-act="person" data-id="${a.id}"><b>${esc(fullName(a))}</b></button><br><small class="mut">${esc(info(a))}</small></td><td><button class="lnk" data-act="person" data-id="${b.id}"><b>${esc(fullName(b))}</b></button><br><small class="mut">${esc(info(b))}</small></td><td>${esc(w)}</td><td><div class="dtbtnrow tight"><button class="pb sm pri" data-act="dtpmerge" data-a="${a.id}" data-b="${b.id}">Zusammenführen …</button><button class="pb sm" data-act="dtpmerge" data-a="${b.id}" data-b="${a.id}">Andersherum …</button><button class="pb sm" data-act="dtpnotsame" data-a="${a.id}" data-b="${b.id}">Nicht dieselbe Person</button></div></td></tr>`).join("")}</tbody></table>` : `<div class="dtempty">Keine doppelten Kontakte in Mirella gefunden.</div>`;
  }
  function kartenHTML() {
    const list = KA.queue(); kdCache = list;
    for (const id of [...SEL.k]) if (!list.some(c => KA.cKey(c) === id)) SEL.k.delete(id);
    if (CUR.k && !list.some(c => KA.cKey(c) === CUR.k) && !kdPid) { CUR.k = null; }
    if (!CUR.k && !kdPid && list.length && kdTab === "karten") { CUR.k = KA.cKey(list[0]); SEL.k.clear(); SEL.k.add(CUR.k); }
    const wait = KA.waiting().length, box = S.kbox, pairs = kdTab === "dup" ? dupPairs().length : null;
    const tabs = `<div class="dttabs" role="tablist"><button role="tab" data-act="dtktab" data-k="karten" aria-selected="${kdTab === "karten"}">Karten aus iPhone <small>(${list.length})</small></button><button role="tab" data-act="dtktab" data-k="dup" aria-selected="${kdTab === "dup"}">Doppelte in Mirella</button></div>`;
    const sub = !box ? "noch keine Karten vom iPhone" : `${pl(list.length, "Karte", "Karten")} offen · Stand iPhone ${new Date(box.at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}${wait ? ` · ${pl(wait, "Entscheidung wartet", "Entscheidungen warten")} aufs iPhone` : ""}`;
    const head = `<div class="dthead"><b>Karten durchgehen</b><span>${esc(kdTab === "dup" ? pl(pairs, "mögliches Paar", "mögliche Paare") : sub)}</span><span class="dthint">Gleicher Fortschritt wie auf dem iPhone · Verbinden und Löschen nur per Klick, mit Rückfrage</span></div>${tabs}`;
    if (kdTab === "dup") return `<div class="dtview">${head}<div class="dtbody"><section class="dtpane dtsingle" data-k="kdup">${dupHTML()}</section></div></div>`;
    if (!box) return `<div class="dtview">${head}<div class="dtbody"><section class="dtpane dtsingle" data-k="kd">${noneHTML("phone", "Noch keine Karten vom iPhone", "Öffne Mirella einmal auf dem iPhone (ab Version 0.40.1). Dann liest es Telefonbuch und Geburtstags-Kalender und die offenen Karten erscheinen hier.")}</section></div></div>`;
    const grid = gridHTML("k", list.map(c => Object.assign(c, { id: KA.cKey(c) })).filter(c => !q || ((c.b ? c.title : fullName(c)) + " " + (c.tel || "") + " " + (c.org || "")).toLowerCase().includes(q.trim().toLowerCase())), { empty: list.length ? "Nichts gefunden." : "Alles durchgegangen. Neue Einträge im Telefonbuch erscheinen hier, sobald das iPhone sie gelesen hat." });
    return paneLayout(head, grid, kdDetail(list), "kd");
  }
  /* Entscheidungen */
  const kdCard = () => (kdCache || KA.queue()).find(c => KA.cKey(c) === CUR.k) || null;
  let kdSnap = [];
  const kdPre = () => { kdSnap = TB.k.order(); };
  const kdNext = key => { const now = new Set(TB.k.order()), i = kdSnap.indexOf(key); let n = null; for (let j = i + 1; j < kdSnap.length && !n; j++) if (now.has(kdSnap[j]) && kdSnap[j] !== key) n = kdSnap[j]; for (let j = i - 1; j >= 0 && !n; j--) if (now.has(kdSnap[j]) && kdSnap[j] !== key) n = kdSnap[j]; CUR.k = n; SEL.k.clear(); if (n) SEL.k.add(n); kdQ = ""; };
  const bLinksS = () => (S.settings.bdayLinks = S.settings.bdayLinks || {});
  function kdDone(msg, key) { if (key) kdNext(key); lastMsg = msg; save(); render(true); origToast(msg + " · Strg+Z macht es rückgängig"); scrollSel(); }
  function kdMergeSheet() {
    const list = KA.queue(), c = list.find(x => KA.cKey(x) === kdM.c), o = kdM && kdEnt(kdM.o, list); if (!c || !o) { closeAll(); return; }
    const me = KA.ent(c, c.b ? "b" : "c"), bd = c.b || o.kind === "b";
    const lines = e => e.kind === "b" ? ["Geburtstag " + KA.fmtMd(e.x.md) + (e.x.year || ""), "aus deinem Geburtstags-Kalender"] : [e.x.org, ...[e.x.tel, ...(e.x.tels || []).map(t => t.n)].filter(Boolean), ...[...new Set([e.x.email, ...(e.x.emails || [])].filter(Boolean))], e.x.bday ? "Geburtstag " + KA.fmtB(e.x.bday) : "", e.kind === "p" ? "schon in Mirella" : "im iPhone-Telefonbuch"].filter(Boolean);
    const box = e => `<td style="vertical-align:top;width:50%"><b>${esc(e.name)}</b>${lines(e).map(l => `<br><small class="mut">${esc(l)}</small>`).join("")}</td>`;
    let mid = "", foot = "";
    if (bd) {
      const b = c.b ? me : o, t = c.b ? o : me;
      mid = `<p>Der Geburtstag <b>${esc(KA.fmtMd(b.x.md) + (b.x.year || ""))}</b> wird bei <b>${esc(t.name)}</b> eingetragen${t.x.bday && t.x.bday.slice(5) !== b.x.md ? `. Achtung: Dort steht bisher ${esc(KA.fmtB(t.x.bday))}, das bleibt stehen` : ""}. Der Kalender-Eintrag bleibt, wie er ist, und kommt nicht mehr als eigene Karte.</p>`;
    } else {
      const diff = normName(me.name) !== normName(o.name);
      if (diff) mid = `<p class="dtlabel">Welcher Name soll bleiben?</p><div class="dtbtnrow tight">${[["c", me.name], ["o", o.name]].map(([k, n]) => `<label class="dtchk"><input type="radio" name="kdname" data-act="dtkmname" data-n="${k}"${kdM.name === k ? " checked" : ""}> ${esc(n)}</label>`).join("")}</div>`;
      const keepName = diff ? (kdM.name === "o" ? o.name : me.name) : me.name;
      const tels = [...new Map([...(kdM.name === "o" ? [o, me] : [me, o])].flatMap(e => [e.x.tel, ...(e.x.tels || []).map(t => t.n)]).filter(Boolean).map(n => [telKey(n) || n, n])).values()];
      const mails = [...new Set([me, o].flatMap(e => [e.x.email, ...(e.x.emails || [])]).filter(Boolean).map(m => m.toLowerCase()))];
      const bdy = (kdM.name === "o" ? o.x.bday || me.x.bday : me.x.bday || o.x.bday) || "";
      mid += `<p class="dtlabel">So steht es danach da</p><table class="dtg mini dtkv"><tbody><tr><td><b>${esc(keepName)}</b>${tels.map(n => `<br><small>${esc(n)}</small>`).join("")}${mails.map(m => `<br><small>${esc(m)}</small>`).join("")}${bdy ? `<br><small>Geburtstag ${esc(KA.fmtB(bdy))}</small>` : ""}</td></tr></tbody></table>`;
      const two = o.kind === "c" || (o.kind === "p" && o.x.appleId && o.x.appleId !== c.appleId);
      foot = `<p class="dtmut">${two ? "<b>Im iPhone-Telefonbuch</b> bleibt ein Eintrag mit allen Nummern, der zweite wird dort gelöscht. Das macht dein iPhone, sobald du Mirella dort öffnest." : "<b>Im iPhone-Telefonbuch</b> wird nichts gelöscht. Der Eintrag gehört danach zu dem Kontakt in Mirella."}</p>`;
    }
    openSheet(`<p class="stitle">${bd ? "Geburtstag übernehmen?" : "Diese beiden verbinden?"}</p><table class="dtg mini"><tbody><tr>${box(me)}${box(o)}</tr></tbody></table>${mid}${foot}<div class="row2"><button class="btn" data-act="cancel">Abbrechen</button><button class="btn pri" data-act="dtkmergego">${bd ? "Ja, übernehmen" : "Ja, verbinden"}</button></div>`);
  }
  function kdMerge(c, o, nameFrom) {
    const ck = KA.ckey(c), key = KA.cKey(c);
    if (c.b && o.kind === "b") return;
    if (c.b) {
      if (o.kind === "p") { const p = o.x; bLinksS()[c.key] = p.id; KA.bApply(c, p); KA.addJob("blink", { key: c.key, pid: p.id }); return kdDone("Der Geburtstag steht jetzt bei " + fullName(p), key); }
      KA.addJob("bcard", { key: c.key, aid: o.x.appleId, ck: KA.ckey(o.x), b: { title: c.title, md: c.md, year: c.year || 0 }, name: o.name });
      kdNext(key); CUR.k = "a:" + o.x.appleId; SEL.k.clear(); SEL.k.add(CUR.k); return kdDone("Geburtstag übernommen. Der Kalender bleibt, wie er ist.");
    }
    if (o.kind === "b") { KA.addJob("bcard", { key: o.x.key, aid: c.appleId, ck, b: { title: o.x.title, md: o.x.md, year: o.x.year || 0 }, name: fullName(c) }); return kdDone("Geburtstag übernommen. Der Kalender bleibt, wie er ist."); }
    if (o.kind === "p") {
      const p = o.x, cn = { first: c.first, last: c.last };
      mergeInto(p, c, KA.extraLabel(c, p));
      if (nameFrom === "c" && (cn.first || cn.last)) { p.first = cn.first; p.last = cn.last; }
      if (!p.appleId) { p.appleId = c.appleId; delete p.local; }
      if (c.bk) bLinksS()[c.bk] = p.id;
      KA.addJob("link", { aid: c.appleId, ck, pid: p.id, key: c.bk || "", name: fullName(p) });
      return kdDone("Verbunden mit " + fullName(p), key);
    }
    const other = o.x, keep = nameFrom === "o" ? other : c, drop = keep === c ? other : c, nm = nameFrom === "o" ? other : c;
    KA.addJob("merge2", { keep: { aid: keep.appleId, ck: KA.ckey(keep) }, drop: { aid: drop.appleId, ck: KA.ckey(drop) }, dropData: JSON.parse(JSON.stringify(drop)), first: nm.first || "", last: nm.last || "", name: fullName(nm) });
    kdNext(key); CUR.k = "a:" + keep.appleId; SEL.k.clear(); SEL.k.add(CUR.k);
    kdDone("Verbunden: " + fullName(nm));
  }
  function kdTake(c) {
    let p;
    const base = { id: uid(), created: today(), calls: [], notes: [], ask: [], gifts: [], cyc: "nie", group: "", gift: false, nick: "", rev: today() };
    if (c.b) { const nm = (KA.bName(c) || c.title).split(" "); p = Object.assign(base, { first: nm.shift() || c.title, last: nm.join(" "), tel: "", email: "", bday: (c.year || 1604) + "-" + c.md, addr: "", local: true }); bLinksS()[c.key] = p.id; KA.addJob("blink", { key: c.key, pid: p.id }); }
    else {
      p = Object.assign(base, { appleId: c.appleId, first: c.first, last: c.last, tel: c.tel, telL: c.telL || "", tels: c.tels || [], email: c.email, emails: [...new Set((c.emails || []).filter(m => m && m.toLowerCase() !== (c.email || "").toLowerCase()))], bday: c.bday, addr: c.addr });
      if (c.bk) bLinksS()[c.bk] = p.id;
      KA.addJob("take", { aid: c.appleId, ck: KA.ckey(c), pid: p.id, key: c.bk || "", name: fullName(p) });
    }
    S.people.push(p); return p;
  }
  function kdNicht(cs) {
    for (const c of cs) {
      if (c.b) { bLinksS()[c.key] = "x"; KA.addJob("bx", { key: c.key }); continue; }
      const ck = KA.ckey(c), ign = (S.settings.appleIgnored = S.settings.appleIgnored || []);
      for (const k of [c.appleId, ck]) if (!ign.includes(k)) ign.push(k);
      if (c.bk) { bLinksS()[c.bk] = "x"; KA.addJob("bx", { key: c.bk }); }
      KA.addJob("ign", { aid: c.appleId, ck, name: fullName(c) });
    }
  }
  Object.assign(ACT, {
    dtktab: el => { kdTab = el.dataset.k; render(true); },
    dtkmerge: el => { const c = kdCard(), o = kdEnt(el.dataset.k || ""); if (!c || !o) return; const me = KA.ent(c, c.b ? "b" : "c"); kdM = { c: KA.cKey(c), o: o.id, name: c.b || o.kind === "b" ? "c" : o.kind === "p" ? "o" : KA.nameToks(o.name).length < KA.nameToks(me.name).length ? "o" : "c" }; kdMergeSheet(); },
    dtkmname: el => { if (!kdM) return; kdM.name = el.dataset.n; kdMergeSheet(); },
    dtkmergego: () => { kdPre(); const list = KA.queue(), c = kdM && list.find(x => KA.cKey(x) === kdM.c), o = kdM && kdEnt(kdM.o, list); if (!c || !o) { closeAll(); return; } const nm = kdM.name; kdM = null; closeAll(); kdQ = ""; kdMerge(c, o, nm); },
    dtknotsame: el => { const c = kdCard(), o = kdEnt(el.dataset.k || ""); if (!c || !o) return; const keys = KA.nsKeys(KA.ent(c, c.b ? "b" : "c"), o), ns = (S.settings.notSame = S.settings.notSame || []); keys.forEach(k => { if (!ns.includes(k)) ns.push(k); }); KA.addJob("ns", { keys }); kdDone("Gemerkt: gehört nicht zusammen"); },
    dtkrein: () => { kdPre(); const c = kdCard(); if (!c) return; if (KA.cands(c).length) { origToast("Erst bitte oben entscheiden: verbinden oder nicht dieselbe Person"); return; } const key = KA.cKey(c); const p = kdTake(c); kdNext(key); kdPid = p.id; fDirty = false; lastMsg = fullName(p) + " ist in Mirella"; save(); render(true); origToast(lastMsg); setTimeout(() => { const f = $("#pf-cyc"); if (f && !f.disabled) f.focus(); }, 30); },
    dtkdone: () => { if (fDirty && !pFormSave()) return; kdPid = null; fDirty = false; render(true); scrollSel(); },
    dtknicht: () => { kdPre(); const l = SEL.k.size > 1 ? selOf("k") : [kdCard()].filter(Boolean); if (!l.length) return; if (l.length > 1 && !ask(`${l.length} Karten nicht in Mirella übernehmen? Sie bleiben im Telefonbuch und im Kalender und kommen nicht wieder.`)) return; kdNicht(l); const key = l.length === 1 ? KA.cKey(l[0]) : null; if (!key) { SEL.k.clear(); CUR.k = null; } kdDone(l.length === 1 ? (l[0].b ? "Kommt nicht nach Mirella. Der Kalender bleibt." : "Bleibt im Telefonbuch, kommt nicht nach Mirella") : pl(l.length, "Karte", "Karten") + " nicht übernommen", key); },
    dtklater: () => { kdPre(); const l = SEL.k.size > 1 ? selOf("k") : [kdCard()].filter(Boolean); if (!l.length) return; const t = Date.now(); l.forEach((c, i) => KA.addJob("later", { k: KA.cKey(c), at: t + i })); const key = l.length === 1 ? KA.cKey(l[0]) : null; if (!key) { SEL.k.clear(); CUR.k = null; } kdDone(l.length === 1 ? "Kommt am Ende nochmal" : pl(l.length, "Karte", "Karten") + " ans Ende gestellt", key); },
    dtkdel: () => {
      kdPre();
      const l = (SEL.k.size > 1 ? selOf("k") : [kdCard()].filter(Boolean)).filter(c => !c.b); if (!l.length) return;
      if (!ask(l.length === 1 ? `„${fullName(l[0])}“ ganz löschen?\n\nDer Eintrag verschwindet aus dem iPhone-Telefonbuch und über iCloud von deinen anderen Geräten. Das macht dein iPhone, sobald du Mirella dort öffnest.` : `${l.length} Einträge ganz löschen?\n\n${l.slice(0, 10).map(fullName).join(", ")}${l.length > 10 ? " …" : ""}\n\nSie verschwinden aus dem iPhone-Telefonbuch und über iCloud von deinen anderen Geräten. Das macht dein iPhone, sobald du Mirella dort öffnest.`)) return;
      l.forEach(c => KA.addJob("del", { aid: c.appleId, ck: KA.ckey(c), name: fullName(c) }));
      const key = l.length === 1 ? KA.cKey(l[0]) : null; if (!key) { SEL.k.clear(); CUR.k = null; }
      kdDone(l.length === 1 ? "Wird gelöscht, auch im Telefonbuch" : pl(l.length, "Eintrag", "Einträge") + " werden gelöscht, auch im Telefonbuch", key);
    },
    dtpmerge: el => {
      const a = S.people.find(x => x.id === el.dataset.a), b = S.people.find(x => x.id === el.dataset.b); if (!a || !b) return;
      const two = a.appleId && b.appleId && a.appleId !== b.appleId;
      if (!ask(`${fullName(b)} in ${fullName(a)} zusammenführen?\n\nEs bleibt ${fullName(a)} mit allen Nummern, Notizen und Anrufen. Der zweite Eintrag wird gelöscht.${two ? "\n\nAuch im iPhone-Telefonbuch bleibt dann nur ein Eintrag. Das macht dein iPhone, sobald du Mirella dort öffnest." : ""}`)) return;
      const bAid = b.appleId, bCk = KA.ckey(b);
      mergeInto(a, b);
      for (const k of ["calls", "notes", "ask", "gifts"]) { const ids = new Set((a[k] || []).map(x => x.id)); for (const x of b[k] || []) if (!x.id || !ids.has(x.id)) (a[k] = a[k] || []).push(x); }
      const links = bLinksS(); for (const k of Object.keys(links)) if (links[k] === b.id) links[k] = a.id;
      S.todos.forEach(t => { if (t.pid === b.id) t.pid = a.id; }); S.docs.forEach(d => { if (d.ref === b.id) d.ref = a.id; });
      dropPerson(b);
      if (two) KA.addJob("pmerge", { keep: a.id, drop: b.id, dropAid: bAid, dck: bCk, name: fullName(a) });
      lastMsg = "Zusammengeführt: " + fullName(a); save(); render(true); origToast(lastMsg + " · Strg+Z macht es rückgängig");
    },
    dtpnotsame: el => { const a = S.people.find(x => x.id === el.dataset.a), b = S.people.find(x => x.id === el.dataset.b); if (!a || !b) return; const keys = KA.nsKeys(KA.ent(a, "p"), KA.ent(b, "p")), ns = (S.settings.notSame = S.settings.notSame || []); keys.forEach(k => { if (!ns.includes(k)) ns.push(k); }); KA.addJob("ns", { keys }); lastMsg = "Gemerkt: gehört nicht zusammen"; save(); render(true); origToast(lastMsg); }
  });
  document.addEventListener("input", e => { if (on && e.target.id === "dtkq") { kdQ = e.target.value; const c = kdCard(), l = $("#dtkql"); if (c && l) l.innerHTML = kdQ ? kdHits(c, kdCache || KA.queue()) : ""; } });

  /* ================================================================
     MENÜLEISTE, SYMBOLLEISTE, ORDNER-BAUM, STATUSLEISTE
     ================================================================ */
  const mod = () => view === "karten" ? "kd" : view === "akte" || view === "menschen" ? "p" : view === "todos" ? (todoList === "einkauf" ? "s" : "t") : view === "kalender" ? "k" : view === "heute" ? "h" : view === "bereich" ? "b" : view === "briefings" ? "r" : view === "wetter" ? "w" : view === "einstellungen" ? "set" : "x";
  function go(n) {
    if (!leaveForms()) return;
    if (shopMode) { shopMode = false; wakeLock(false); }
    closeAll(); setFrom = null; ED = null; q = ""; finCat = "";
    if (n === "h") view = "heute";
    else if (n === "p" || n.startsWith("p:")) { if (n.length > 2) { cf = n.slice(2); SEL.p.clear(); view = "menschen"; } else { const one = SEL.p.size === 1 && S.people.find(p => p.id === [...SEL.p][0]); if (one) { cur = one.id; view = "akte"; } else view = "menschen"; } pNew = false; }
    else if (n === "t" || n.startsWith("t:")) { tf = n.slice(2); todoList = "todo"; view = "todos"; }
    else if (n === "s") { todoList = "einkauf"; view = "todos"; }
    else if (n === "k") { if (view !== "kalender") { calView = S.settings.calStart || "monat"; selDate = today(); calY = +selDate.slice(0, 4); calM = +selDate.slice(5, 7) - 1; } view = "kalender"; }
    else if (n.startsWith("b:")) { const parts = n.split(":"); area = parts[1]; if (parts.length > 2) BSUB[area] = parts.slice(2).join(":"); view = "bereich"; iNew = null; }
    else if (n === "brief") view = "briefings";
    else if (n === "w") { try { wxFrom = "drawer"; } catch (_) { } view = "wetter"; }
    else if (n === "ausw") view = "auswertungen";
    else if (n === "kd" || n === "kdup") { kdTab = n === "kd" ? "karten" : "dup"; kdPid = null; view = "karten"; }
    else if (n === "set") view = "einstellungen";
    render();
    const sc = $("#screen"); if (sc) sc.scrollTop = 0;
  }
  function counts() {
    const t = today();
    return { h: callsForToday().length + S.todos.filter(x => x.list === "todo" && !x.done && x.date && x.date <= t).length, p: S.people.filter(p => !p.arch).length, t: S.todos.filter(x => x.list === "todo" && !x.done).length, s: S.todos.filter(x => x.list === "einkauf" && !x.done && !x.arch).length };
  }
  function treeHTML() {
    const m = mod(), c = counts(), fold = k => !!P.fold[k];
    const grpN = g => S.people.filter(p => !p.arch && p.group === g).length;
    const it = (n, label, icon, cnt, onNow, lvl, drop, extra) => `<button class="dti${onNow ? " on" : ""}" data-act="dtnav" data-n="${esc(n)}" style="--l:${lvl || 0}"${drop != null ? ` data-drop="${esc(drop)}"` : ""}${extra || ""}><span class="tw"></span><span class="ic">${icon}</span><span class="l">${esc(label)}</span>${cnt ? `<span class="n">${cnt}</span>` : ""}</button>`;
    const node = (k, n, label, icon, cnt, onNow, lvl, kids, open) => { const isOpen = open != null ? open : !fold(k); return `<div class="dtnode"><button class="dti${onNow ? " on" : ""}" data-act="dtnav" data-n="${esc(n)}" style="--l:${lvl || 0}"><span class="tw" data-act="dttw" data-k="${k}">${isOpen ? "▾" : "▸"}</span><span class="ic">${icon}</span><span class="l">${esc(label)}</span>${cnt ? `<span class="n">${cnt}</span>` : ""}</button>${isOpen ? kids : ""}</div>`; };
    const inP = m === "p";
    const kontakte = CF.map(([k, l, icn, t]) => it("p:" + k, l, ic(icn, 14), S.people.filter(t).length || "", inP && cf === k, 1)).join("")
      + node("gruppen", "p:all", "Gruppen", ic("folder", 14), "", false, 1, S.groups.map(g => it("p:g:" + g, g, ic("folder", 14), grpN(g) || "", inP && cf === "g:" + g, 2, "g:" + g, ` data-grp="${esc(g)}"`)).join("") + it("p:nogrp", "Ohne Gruppe", ic("none", 14), S.people.filter(p => !p.arch && !p.group).length || "", inP && cf === "nogrp", 2, "g:") + `<button class="dti add" data-act="dtnewgrp" style="--l:2"><span class="tw"></span><span class="ic">${ic("plus", 14)}</span><span class="l">Neue Gruppe …</span></button>`)
      + it("p:arch", "Archiv", ic("arch", 14), S.people.filter(p => p.arch).length || "", inP && cf === "arch", 1, "arch")
      + it("kd", "Karten durchgehen", ic("check", 14), KA.queue().length || "", m === "kd" && kdTab === "karten", 1)
      + it("kdup", "Doppelte zusammenführen", ic("people", 14), "", m === "kd" && kdTab === "dup", 1);
    const aufgaben = AREAS.map(A => { const n = S.todos.filter(t => t.area === A.id && !t.done && t.list === "todo").length; return it("t:a:" + A.id, A.n, `<i class="dtdot sq" style="--c:${A.c}"></i>`, n || "", m === "t" && tf === "a:" + A.id, 1, "a:" + A.id); }).join("");
    const bereiche = AREAS.map(A => { const here = m === "b" && area === A.id, open = fold("b_" + A.id) ? false : here || !!P.fold["o_" + A.id]; return node("b_" + A.id, "b:" + A.id, A.n, `<span class="aic" style="--ac:${A.c}">${IC[A.ic] || ""}</span>`, "", here && !open, 1, subsOf(A.id).map(([k, l]) => it("b:" + A.id + ":" + k, l, "", subCount(A.id, k) || "", here && bsub() === k, 2)).join(""), open); }).join("");
    return `<div class="dttree" role="tree">
      ${it("h", "Übersicht (Heute)", ic("sun", 14), c.h || "", m === "h", 0)}
      ${node("kontakte", "p", "Kontakte", ic("people", 14), c.p, false, 0, kontakte)}
      ${node("aufgaben", "t:", "Aufgaben", ic("task", 14), c.t, m === "t" && !tf, 0, aufgaben)}
      ${it("s", "Einkaufsliste", ic("cart", 14), c.s || "", m === "s", 0)}
      ${it("k", "Kalender", ic("cal", 14), "", m === "k", 0)}
      ${node("bereiche", "b:" + (area || "geld"), "Bereiche", ic("folder", 14), "", false, 0, bereiche)}
      ${it("brief", "Briefings", ic("doc", 14), S.briefings.filter(b => !b.read).length || "", m === "r", 0)}
      ${it("w", "Wetter", ic("cloud", 14), "", m === "w", 0)}
      ${R.auswertungen ? it("ausw", "Auswertungen", ic("chart", 14), "", view === "auswertungen", 0) : ""}
    </div>
    <div class="dttreefoot">${installEvt ? `<button class="pb pri sm" data-act="dtinstall" style="width:100%;margin-bottom:4px">Als Windows-App installieren</button>` : ""}${it("set", "Einstellungen", ic("gear", 14), "", m === "set", 0)}</div>`;
  }
  /* Symbolleiste je Ansicht: Gruppen mit großen und kleinen Knöpfen */
  function RIBBON() {
    const m = mod(), b = (k, l, act, data, dis, title) => ({ k, l, act, data: data || {}, dis, title });
    const pOne = SEL.p.size === 1 && view === "akte" ? S.people.find(x => x.id === cur) : null, pAny = SEL.p.size > 0;
    const tAny = SEL.t.size > 0;
    const G = [];
    if (m === "p") {
      G.push({ l: "Neu und Speichern", big: [b("newp", "Neuer Kontakt", "dtnewp", {}, false, "Neuer Kontakt (N)")], small: [b("save", "Speichern", "dtpsave", {}, !fDirty && !pNew, "Speichern (Strg+S)"), b("del", "Löschen", "dtdel", {}, !pAny, "Löschen (Entf)")] });
      G.push({ l: "Kontakt aufnehmen", big: [b("phone", "Anrufen", "dtpcall", {}, !(pOne && pOne.tel))], small: [b("check", "Anruf eintragen", "dtplog", {}, !pOne), b("wa", "WhatsApp", "dtpwa", {}, !(pOne && pOne.tel)), b("mail", "E-Mail", "dtpmail", {}, !(pOne && pOne.email))] });
      G.push({ l: "Ordnen", small: [b("folder", "Gruppe ▾", "dtpgrpmenu", {}, !pAny), b("cycle", "Rhythmus ▾", "dtpcycmenu", {}, !pAny), b("arch", cf === "arch" ? "Zurückholen" : "Archivieren", "dtparch", {}, !pAny)] });
      G.push({ l: "Daten", small: [b("imp", "vCard importieren …", "importvcf"), b("exp", "Als Excel-Tabelle speichern", "dtcsv"), b("print", "Drucken …", "dtprint")] });
    } else if (m === "kd") {
      const kc = kdTab === "karten" && !kdPid && SEL.k.size ? selOf("k") : [], one = kc.length === 1 ? kc[0] : null;
      if (kdTab === "karten") {
        G.push({ l: "Karte", big: [b("newp", "Rein in Mirella", "dtkrein", {}, !one || KA.cands(one).length > 0, "Übernehmen und gleich pflegen")], small: [b("none", "Nicht in Mirella", "dtknicht", {}, !kc.length), b("next", "Später", "dtklater", {}, !kc.length), b("del", "Ganz löschen …", "dtkdel", {}, !kc.some(c => !c.b), "Auch im iPhone-Telefonbuch (Entf)")] });
        if (kdPid) G.push({ l: "Pflege", big: [b("check", "Fertig, nächste Karte", "dtkdone")], small: [b("save", "Speichern", "dtpsave", {}, !fDirty, "Speichern (Strg+S)")] });
      }
      G.push({ l: "Durchgehen", small: [Object.assign(b("list", "Karten aus iPhone", "dtktab", { k: "karten" }), { on: kdTab === "karten" }), Object.assign(b("people", "Doppelte in Mirella", "dtktab", { k: "dup" }), { on: kdTab === "dup" }), b("sync", "Jetzt abgleichen", "dtsync")] });
    } else if (m === "t") {
      G.push({ l: "Neu", big: [b("newt", "Neue Aufgabe", "dtnewt", {}, false, "Neue Aufgabe mit allen Feldern")], small: [b("check", "Erledigt", "dttdone", {}, !tAny, "Erledigt (Leertaste)"), b("del", "Löschen", "dtdel", {}, !tAny, "Löschen (Entf)")] });
      G.push({ l: "Verschieben", small: [b("today", "Auf heute", "dttmove", { d: today() }, !tAny), b("next", "Auf morgen", "dttmove", { d: addDays(today(), 1) }, !tAny), b("cal", "Nächster Montag", "dttmove", { d: nextMonday() }, !tAny)] });
      G.push({ l: "Ordnen", small: [b("flag", "Priorität ▾", "dttprio", {}, !tAny), b("folder", "Bereich ▾", "dttarea", {}, !tAny), b("list", showDoneT ? "Erledigte ausblenden" : "Erledigte zeigen", "dtdone")] });
      G.push({ l: "Daten", small: [b("print", "Drucken …", "dtprint")] });
    } else if (m === "s") {
      G.push({ l: "Neu", big: [b("plus", "Artikel hinzufügen", "dtshopfocus")], small: [b("del", "Löschen", "dtdel", {}, !SEL.s.size)] });
      G.push({ l: "Einkauf", small: [b("check", "Einkauf fertig", "shopdone", {}, !S.todos.some(t => t.list === "einkauf" && t.done && !t.arch)), b("clean", "Abgehakte löschen …", "cleardone", {}, !S.todos.some(t => t.list === "einkauf" && t.done)), b("tpl", "Als Vorlage speichern …", "savetpl")] });
      G.push({ l: "Daten", small: [b("print", "Drucken …", "dtprint")] });
    } else if (m === "k") {
      G.push({ l: "Neu", big: [b("newt", "Neuer Eintrag", "dtcalnew")] });
      G.push({ l: "Gehe zu", big: [b("today", "Heute", "mptoday")], small: [b("prev", "Zurück", "cstep", { n: "-1" }), b("next", "Weiter", "cstep", { n: "1" }), b("cal", "Monat wählen …", "mpick")] });
      G.push({ l: "Anordnen", small: [["tag", "Tag"], ["woche", "Woche"], ["monat", "Monat"], ["liste", "Liste"]].map(([v, l]) => Object.assign(b("cal", l, "calview", { cv: v }), { on: calView === v })) });
    } else if (m === "b") {
      const A = areaById(area), sub = bsub(), ks = kindsOf(area);
      if (sub.startsWith("k:") || (ks.length && !["exp", "fix", "goals", "notes", "docs", "erin"].includes(sub))) {
        const curK = sub.startsWith("k:") ? sub.slice(2) : ks[0], rest = ks.filter(k => k !== curK);
        if (curK) G.push({ l: "Neu", big: [b("plus", "Neu: " + KINDS[curK].n, "dtinew", { k: curK })], small: rest.slice(0, 3).map(k => b("plus", "Neu: " + KINDS[k].n, "dtinew", { k })) });
        if (sub.startsWith("k:")) G.push({ l: "Eintrag", small: [b("save", "Speichern", "dtisave", {}, !(iDirty || iNew), "Speichern (Strg+S)"), b("del", "Löschen", "dtdel", {}, !SEL.i.size, "Löschen (Entf)"), b("pdf", "PDF anhängen …", "dtipdf", {}, SEL.i.size !== 1)] });
      }
      if (area === "geld") G.push({ l: "Geld", big: [b("euro", "Neue Ausgabe", "dtexpfocus")], small: [b("cam", "Beleg (Bild) …", "photo", { kind: "beleg" }), b("goal", "Neues Sparziel …", "goalnew"), b("del", "Löschen", "dtdel", {}, !(sub === "exp" ? SEL.e.size : sub === "goals" ? SEL.g.size : 0))] });
      if (sub === "exp" || sub === "fix") G.push({ l: "Monat", small: [b("prev", "Vormonat", "finm", { n: "-1" }), b("next", "Nächster Monat", "finm", { n: "1" })] });
      if (area === "gesund") G.push({ l: "Gesundheit", big: [b("sick", S.sick ? "Wieder gesund" : "Ich bin krank …", S.sick ? "dtwell" : "krank")] });
      if (sub === "notes") G.push({ l: "Notizen", big: [b("note", "Neue Notiz", "dtnotefocus")], small: [b("del", "Löschen", "dtdel", {}, !SEL.n.size)] });
      if (sub === "docs") G.push({ l: "Dokumente", big: [b("pdf", "PDF ablegen", "dtpdf")], small: [b("cam", "Bild / Scan …", "dtimg"), b("del", "Löschen", "dtdel", {}, !SEL.d.size)] });
      G.push({ l: "Bereich", small: [b("bell", "Neue Erinnerung …", "newtodo", { area }), b("note", "Notiz …", "dtbnote"), b("gear", "Einstellungen …", "dtsetarea", { k: area })] });
    } else if (m === "h") {
      G.push({ l: "Neu", big: [b("newp", "Neuer Kontakt", "dtnewp"), b("newt", "Neue Aufgabe", "dtnewt")], small: [b("cart", "Einkauf …", "dtshopfocus"), b("euro", "Ausgabe …", "dtexpgo"), b("cal", "Termin …", "dtcalnew")] });
      G.push({ l: "Mirella", small: [b("sync", "Jetzt abgleichen", "dtsync"), b("doc", "Briefings", "dtnav", { n: "brief" }), b("cloud", "Wetter", "dtnav", { n: "w" })] });
    } else if (m === "r") {
      G.push({ l: "Briefing", big: [b("open", "Öffnen", "dtbopen", {}, SEL.r.size !== 1)], small: [b("pdf", "Briefing ablegen (PDF) …", "addbrief"), b("del", "Löschen", "dtdel", {}, !SEL.r.size || selOf("r").some(x => x.remote))] });
    } else if (m === "w") {
      G.push({ l: "Wetter", big: [b("sync", "Aktualisieren", "dtwxload")], small: [b("pin", "Standort neu bestimmen", "wxhere")] });
    } else if (m === "set") {
      G.push({ l: "Daten", small: [b("save", "Sicherung speichern …", "export"), b("imp", "Sicherung laden …", "import"), b("sync", "Jetzt abgleichen", "dtsync")] });
    } else {
      G.push({ l: "Gehe zu", big: [b("sun", "Übersicht", "dtnav", { n: "h" })], small: [b("people", "Kontakte", "dtnav", { n: "p" }), b("task", "Aufgaben", "dtnav", { n: "t:" })] });
    }
    G.push({ l: "Ansicht", small: [Object.assign(b("side", "Ordner-Baum", "dtnavtog", {}, false, "Strg+B"), { on: !!P.nav }), Object.assign(b("panel", "Detailbereich", "dtdet", {}, false, "Strg+I"), { on: !!P.det }), b("search", "Suchen (Strg+K)", "dtpal")] });
    return G;
  }
  function ribbonHTML() {
    const btn = (x, big) => `<button class="rb${big ? " big" : ""}${x.on ? " on" : ""}" data-act="${x.act}"${Object.entries(x.data).map(([k, v]) => ` data-${k}="${esc(String(v))}"`).join("")}${x.dis ? " disabled" : ""}${x.title ? ` title="${esc(x.title)}"` : ""}>${ic(x.k, big ? 22 : 15)}<span>${esc(x.l)}</span></button>`;
    const tableMod = ["p", "t", "s", "b", "r"].includes(mod());
    return `<div class="rgroups">${RIBBON().map(g => `<div class="rg"><div class="rgb">${(g.big || []).map(x => btn(x, 1)).join("")}${(g.small || []).length ? `<div class="rcol">${g.small.map(x => btn(x)).join("")}</div>` : ""}</div><div class="rgl">${esc(g.l)}</div></div>`).join("")}</div>
      <div class="rright">${tableMod ? `<label class="rsearch">${ic("search", 14)}<input id="q" type="search" placeholder="${esc({ p: cfLabel(), t: "Aufgaben", s: "Einkauf", b: (areaById(area) || {}).n || "Bereich", r: "Briefings" }[mod()] || "")} durchsuchen (Strg+F)" value="${esc(q)}" autocomplete="off"></label>` : `<button class="rsearch" data-act="dtpal">${ic("search", 14)}<span>Suchen und Befehle (Strg+K)</span></button>`}<span class="rmic" title="Mit Sprache eingeben (Strg+M)"></span></div>`;
  }
  function MENUS() {
    const m = mod(), inP = m === "p", inT = m === "t";
    const tb = curTb(), hasSel = !!(tb && SEL[tb] && SEL[tb].size);
    const ps = selOf("p"), ts = selOf("t"), pOne = inP && ps.length === 1 ? ps[0] : null;
    const grpItems = [["keine Gruppe", "", () => setPGroup(selOf("p"), "")], "-", ...S.groups.map(g => [g, "", () => setPGroup(selOf("p"), g), true, ps.length && ps.every(x => x.group === g)]), "-", ["Neue Gruppe …", "", () => { const g = (prompt("Name der neuen Gruppe") || "").trim(); if (g) setPGroup(selOf("p"), g); }]];
    const cycItems = CYCLES.map(c => [cycLabel(c), "", () => setPCyc(selOf("p"), c), true, ps.length && ps.every(x => (x.cyc || "nie") === c)]);
    const prioItems = [...PRIOS.map(([v, l]) => [l, "", () => { selOf("t").forEach(y => { y.prio = v; }); lastMsg = "Priorität " + l; save(); render(true); }]), ["keine", "", () => { selOf("t").forEach(y => { y.prio = ""; }); lastMsg = "Priorität entfernt"; save(); render(true); }]];
    const areaItems = [["kein Bereich", "", () => { selOf("t").forEach(y => { y.area = ""; }); save(); render(true); }], "-", ...AREAS.map(A => [A.n, "", () => { selOf("t").forEach(y => { y.area = A.id; }); lastMsg = "Bereich " + A.n; save(); render(true); }])];
    const moveItems = [["Heute", "", () => moveT(selOf("t"), today())], ["Morgen", "", () => moveT(selOf("t"), addDays(today(), 1))], ["Nächsten Montag", "", () => moveT(selOf("t"), nextMonday())], ["In einem Monat", "", () => moveT(selOf("t"), addMonths(today(), 1))], "-", ["Ohne Datum", "", () => moveT(selOf("t"), "")]];
    return [
      ["Datei", [
        ["Neu", "", [["Kontakt", "N", () => ACT.dtnewp()], ["Aufgabe", "", () => ACT.dtnewt()], ["Artikel auf die Einkaufsliste", "", () => ACT.dtshopfocus()], ["Termin / Erinnerung", "", () => todoForm(null, { date: selDate || today() })], ["Ausgabe", "", () => ACT.dtexpgo()], ["Notiz in einem Bereich", "", () => ACT.dtbnote()], "-", ...Object.keys(KINDS).map(k => [KINDS[k].n + " (" + areaById(KINDS[k].area).n + ")", "", () => ACT.dtinew({ dataset: { k } })])]],
        ["Speichern", "Strg+S", saveAny],
        "-",
        ["Kontakte importieren (vCard) …", "", () => ACT.importvcf()],
        ["Kontakte als Excel-Tabelle speichern", "", () => { if (!inP) go("p"); exportCSV(); }],
        ["PDF / Dokument ablegen …", "", () => ACT.dtpdf()],
        ["Briefing ablegen (PDF) …", "", () => ACT.addbrief()],
        "-",
        ["Sicherung speichern …", "", () => ACT.export()],
        ["Sicherung laden …", "", () => ACT.import()],
        ["Sicherung auf dem PC (OneDrive) …", "", () => ACT.pcbackup()],
        "-",
        ["Drucken …", "Strg+P", () => window.print()],
        ...(installEvt ? [["Als Windows-App installieren", "", () => ACT.dtinstall()]] : [])
      ]],
      ["Bearbeiten", [
        ["Rückgängig", "Strg+Z", undo, UNDO.length > 0],
        ["Wiederholen", "Strg+Y", redo, REDO.length > 0],
        "-",
        ["Zelle ändern", "F2", () => editActive(), !!(tb && curOf(tb))],
        ["Löschen …", "Entf", () => ACT.dtdel(), hasSel],
        "-",
        ["Alles auswählen", "Strg+A", selectAll, !!tb],
        ["Auswahl aufheben", "Esc", () => ACT.dtselnone(), hasSel],
        "-",
        ["Durchsuchen", "Strg+F", focusFind, !!tb],
        ["Suchen und Befehle", "Strg+K", () => palette()]
      ]],
      ["Ansicht", [
        ["Übersicht (Heute)", "Strg+1", () => go("h"), true, m === "h"],
        ["Kontakte", "Strg+2", () => go("p"), true, inP],
        ["Aufgaben", "Strg+3", () => go("t:"), true, inT],
        ["Einkaufsliste", "Strg+4", () => go("s"), true, m === "s"],
        ["Kalender", "Strg+5", () => go("k"), true, m === "k"],
        ["Bereiche", "", AREAS.map(A => [A.n, "", () => go("b:" + A.id), true, m === "b" && area === A.id])],
        ["Briefings", "", () => go("brief"), true, m === "r"],
        ["Wetter", "", () => go("w"), true, m === "w"],
        "-",
        ["Ordner-Baum", "Strg+B", () => ACT.dtnavtog(), true, !!P.nav],
        ["Detailbereich", "Strg+I", () => ACT.dtdet(), true, !!P.det],
        ...(inT ? [["Erledigte Aufgaben zeigen", "", () => ACT.dtdone(), true, showDoneT]] : []),
        ...(m === "k" ? ["-", ...[["tag", "Tag"], ["woche", "Woche"], ["monat", "Monat"], ["liste", "Liste"]].map(([v, l]) => ["Kalender: " + l, "", () => ACT.calview({ dataset: { cv: v } }), true, calView === v])] : [])
      ]],
      ["Kontakt", [
        ["Neuer Kontakt", "N", () => ACT.dtnewp()],
        "-",
        ["Anrufen", "", () => ACT.dtpcall(), !!(pOne && pOne.tel)],
        ["Anruf eintragen …", "", () => ACT.dtplog(), !!pOne],
        ["WhatsApp öffnen", "", () => ACT.dtpwa(), !!(pOne && pOne.tel)],
        ["E-Mail schreiben", "", () => ACT.dtpmail(), !!(pOne && pOne.email)],
        "-",
        ["Gruppe", "", grpItems, inP && ps.length > 0],
        ["Anruf-Rhythmus", "", cycItems, inP && ps.length > 0],
        [ps.length && ps.every(p => p.arch) ? "Aus dem Archiv zurückholen" : "Archivieren …", "", () => archP(selOf("p")), inP && ps.length > 0],
        ["Löschen …", "Entf", () => delP(selOf("p")), inP && ps.length > 0],
        "-",
        ["Gruppe umbenennen …", "", () => renameGroup(cf.slice(2)), cf.startsWith("g:")],
        ["Karten durchgehen (iPhone-Kontakte, Geburtstage)", "", () => go("kd")],
        ["Doppelte Kontakte zusammenführen", "", () => go("kdup")]
      ]],
      ["Aufgabe", [
        ["Neue Aufgabe", "", () => ACT.dtnewt()],
        "-",
        ["Erledigt", "Leertaste", () => doneT(selOf("t")), inT && ts.length > 0],
        ["Verschieben", "", moveItems, inT && ts.length > 0],
        ["Priorität", "", prioItems, inT && ts.length > 0],
        ["Bereich", "", areaItems, inT && ts.length > 0],
        ["Weitere Felder …", "", () => ACT.dttedit(), inT && ts.length === 1],
        ["Löschen …", "Entf", () => delT(selOf("t")), inT && ts.length > 0]
      ]],
      ["Extras", [
        ["Jetzt abgleichen", "", () => ACT.dtsync(), typeof syOn === "function" && syOn()],
        ["Briefings", "", () => go("brief")],
        ["Wetter", "", () => go("w")],
        ...(R.auswertungen ? [["Auswertungen", "", () => go("ausw")]] : []),
        "-",
        ["Einstellungen …", "Strg+,", () => go("set")]
      ]],
      ["Hilfe", [
        ["Tastenkürzel", "?", keysSheet],
        ["Fragen und Hilfe …", "", () => ACT.search ? ACT.search() : searchOpen("")],
        "-",
        ["Über Mirella", "", about]
      ]]
    ];
  }
  function statusHTML() {
    const m = mod(); let mid = "";
    if (m === "p") mid = `${esc(cfLabel())}: ${pl(pRows().length, "Kontakt", "Kontakte")}`;
    else if (m === "t") mid = pl(S.todos.filter(x => x.list === "todo" && !x.done).length, "offene Aufgabe", "offene Aufgaben");
    else if (m === "s") mid = pl(counts().s, "Artikel", "Artikel") + " auf der Liste";
    else if (m === "b") mid = esc(((areaById(area) || {}).n || "") + " › " + ((subsOf(area).find(x => x[0] === bsub()) || [])[1] || ""));
    else if (m === "r") mid = pl(S.briefings.length, "Briefing", "Briefings");
    const tb = curTb(), n = tb && SEL[tb] ? SEL[tb].size : 0;
    const sy = typeof syOn === "function" && syOn() ? (SY.status || "Angemeldet") : "Nur auf diesem Gerät";
    return `<span class="sy${typeof SY !== "undefined" && SY.busy ? " busy" : ""}"><i></i>${esc(sy)}</span>${mid ? `<span>${mid}</span>` : ""}${n ? `<span>${n} ausgewählt</span>` : ""}<span class="hint">${tb ? "Doppelklick/F2: Zelle ändern · Tab: weiter · Strg+S: speichern · Entf: löschen" : "Strg+K: Suchen und Befehle · ?: Tastenkürzel"}</span><span class="r">${UNDO.length ? "Strg+Z: Rückgängig · " : ""}Mirella ${esc(VERSION)}</span>`;
  }
  function el(id, tag, cls) { let x = document.getElementById(id); if (!x) { x = document.createElement(tag); x.id = id; x.className = cls; $("#phone").insertBefore(x, $("#phone").firstChild); } return x; }
  const micHome = () => { const mic = $("#mic"), bar = $(".tabbar"); if (mic && bar && !bar.contains(mic)) bar.insertBefore(mic, bar.children[2] || null); };
  function shell() {
    root.classList.toggle("dtnonav", !P.nav);
    const mb = el("dtmenu", "header", "dtmenubar");
    mb.innerHTML = `<nav class="dtmenus" role="menubar" aria-label="Menü">${MENUS().map(([l], i) => `<button class="dtm${menuIdx === i ? " open" : ""}" role="menuitem" aria-haspopup="true" data-mi="${i}">${l}</button>`).join("")}</nav><span class="dtapp"><img src="./logo-final.svg" alt="">Mirella</span>`;
    const rb = el("dtribbon", "div", "dtribbon");
    const qa = document.activeElement && document.activeElement.id === "q", qs = qa ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
    micHome(); rb.innerHTML = ribbonHTML(); const slot = rb.querySelector(".rmic"); if (slot && $("#mic")) slot.appendChild($("#mic"));
    if (qa) { const qi = $("#q"); if (qi) { qi.focus(); try { qi.setSelectionRange(qs[0], qs[1]); } catch (_) { } } }
    if (mb.nextSibling !== rb) mb.after(rb);
    const nav = el("dtnav", "aside", "dtnav"); nav.setAttribute("aria-label", "Ordner");
    const st = (nav.querySelector(".dttree") || {}).scrollTop || 0; nav.innerHTML = treeHTML(); const t2 = nav.querySelector(".dttree"); if (t2) t2.scrollTop = st;
    const sb = el("dtstatus", "footer", "dtstatus"); sb.innerHTML = statusHTML();
    const tt = { h: "Übersicht", p: "Kontakte", t: "Aufgaben", s: "Einkaufsliste", k: "Kalender", b: (areaById(area) || {}).n || "Bereich", r: "Briefings", w: "Wetter", set: "Einstellungen" }[mod()] || "";
    const pc = view === "akte" && S.people.find(p => p.id === cur);
    document.title = (pc ? fullName(pc) + " – " : "") + (tt ? tt + " – " : "") + "Mirella";
  }
  function unshell() { micHome(); ["dtmenu", "dtribbon", "dtnav", "dtstatus"].forEach(id => { const x = document.getElementById(id); if (x) x.remove(); }); closeMenu(); closeCtx(); const p0 = document.getElementById("dtpal"); if (p0) p0.remove(); document.title = "Mirella"; }

  /* ---------- Aufklapp- und Rechtsklick-Menüs ---------- */
  let menuIdx = -1;
  function openMenu(i) {
    closeCtx(); const M = MENUS()[i]; if (!M) return;
    const btn = document.querySelector(`.dtm[data-mi="${i}"]`); if (!btn) return;
    closeMenu(); menuIdx = i; btn.classList.add("open");
    const r = btn.getBoundingClientRect(); popup(M[1], r.left, r.bottom, "dtdrop");
  }
  function closeMenu() { menuIdx = -1; document.querySelectorAll(".dtm.open").forEach(b => b.classList.remove("open")); document.querySelectorAll(".dtpop.dtdrop").forEach(x => x.remove()); }
  function closeCtx() { document.querySelectorAll(".dtpop.dtctx").forEach(x => x.remove()); }
  function popup(items, x, y, cls) {
    const box = document.createElement("div"); box.className = "dtpop " + (cls || ""); box.setAttribute("role", "menu"); box.dataset.id = Math.random().toString(36).slice(2);
    const acts = [];
    box.innerHTML = items.map(it => {
      if (it === "-") return '<div class="dtpsep" role="separator"></div>';
      const [l, k, fn, en = true, chk] = it, i = acts.push(it) - 1, sub = Array.isArray(fn);
      return `<button class="dtpi${sub ? " sub" : ""}" role="menuitem" data-i="${i}"${en ? "" : " disabled"}><span class="ck">${chk ? "✓" : ""}</span><span class="l">${esc(l)}</span><span class="k">${sub ? "▸" : esc(k || "")}</span></button>`;
    }).join("");
    document.body.appendChild(box);
    const w = box.offsetWidth, h = box.offsetHeight;
    box.style.left = Math.max(2, Math.min(x, innerWidth - w - 4)) + "px"; box.style.top = Math.max(2, Math.min(y, innerHeight - h - 4)) + "px";
    box.addEventListener("click", e => { const b2 = e.target.closest(".dtpi"); if (!b2 || b2.disabled) return; const it = acts[+b2.dataset.i]; if (Array.isArray(it[2])) return; closeMenu(); closeCtx(); it[2](); });
    box.addEventListener("mouseover", e => {
      const b2 = e.target.closest(".dtpi"); if (!b2) return;
      box.querySelectorAll(".dtpi.hov").forEach(z => z.classList.remove("hov")); b2.classList.add("hov");
      document.querySelectorAll(".dtpop").forEach(p => { if (p !== box && p.dataset.parent === box.dataset.id) p.remove(); });
      const it = acts[+b2.dataset.i];
      if (it && Array.isArray(it[2]) && !b2.disabled) { const r = b2.getBoundingClientRect(); const s2 = popup(it[2], r.right - 2, r.top - 4, (cls || "") + " dtsub"); s2.dataset.parent = box.dataset.id; }
    });
    return box;
  }
  function popKeys(e) {
    const boxes = [...document.querySelectorAll(".dtpop")]; if (!boxes.length) return false;
    const box = boxes[boxes.length - 1], items = [...box.querySelectorAll(".dtpi:not([disabled])")];
    const i = items.findIndex(x => x.classList.contains("hov"));
    const mark = j => { const t = items[(j + items.length) % items.length]; if (t) t.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); };
    if (e.key === "ArrowDown") { mark(i + 1); return true; }
    if (e.key === "ArrowUp") { mark(i < 0 ? items.length - 1 : i - 1); return true; }
    if (e.key === "ArrowRight") { if (i >= 0 && items[i].classList.contains("sub")) { const all = document.querySelectorAll(".dtpop"), last = all[all.length - 1]; if (last !== box) { const f = last.querySelector(".dtpi:not([disabled])"); if (f) f.classList.add("hov"); } } else if (menuIdx >= 0) openMenu((menuIdx + 1) % MENUS().length); return true; }
    if (e.key === "ArrowLeft") { if (box.classList.contains("dtsub")) box.remove(); else if (menuIdx >= 0) openMenu((menuIdx + MENUS().length - 1) % MENUS().length); return true; }
    if (e.key === "Enter" || e.key === " ") { if (i >= 0) items[i].click(); return true; }
    if (e.key === "Escape") { closeMenu(); closeCtx(); return true; }
    return false;
  }
  document.addEventListener("contextmenu", e => {
    if (!on || root.classList.contains("zlocked")) return;
    if (e.target.closest("input,textarea,select,a[href]")) return;
    const row = e.target.closest("tr[data-act=dtrow]"), day = e.target.closest(".mc[data-d]"), ng = e.target.closest(".dti[data-grp]");
    let items = null;
    if (row) {
      const tb = row.dataset.tb, id = row.dataset.id;
      if (!SEL[tb].has(id)) { if (!leaveForms(tb, id)) return; SEL[tb].clear(); SEL[tb].add(id); ANCH[tb] = id; setCur(tb, id); render(true); }
      const td = e.target.closest("td[data-c]"); if (td) ACOL[tb] = +td.dataset.c;
      items = ctxItems(tb, id, td);
    } else if (day) { const d = day.dataset.d; items = [["Neuer Eintrag am " + fmtDate(d), "", () => todoForm(null, { date: d })], ["Tagesansicht", "", () => { selDate = d; calView = "tag"; render(); }]]; }
    else if (ng) { const g = ng.dataset.grp; items = [["Gruppe anzeigen", "", () => go("p:g:" + g)], ["Umbenennen …", "", () => renameGroup(g)]]; }
    if (!items) return;
    e.preventDefault(); closeMenu(); closeCtx(); popup(items, e.clientX, e.clientY, "dtctx");
  });
  function ctxItems(tb, id, td) {
    const col = td && TB[tb].cols()[+td.dataset.c], edit = col && col.e ? [["„" + col.l + "“ ändern", "F2", () => startEdit(tb, id, col.k)], "-"] : [];
    if (tb === "p") { const ps = selOf("p"), p = ps.length === 1 ? ps[0] : null, M = MENUS()[3][1]; return [...edit, ...(p ? [["Anrufen", "", () => ACT.dtpcall(), !!p.tel], ["Anruf eintragen …", "", () => ACT.dtplog()], ["WhatsApp öffnen", "", () => ACT.dtpwa(), !!p.tel], ["E-Mail schreiben", "", () => ACT.dtpmail(), !!p.email], "-"] : []), ...M.slice(7, 11)]; }
    if (tb === "t") { const M = MENUS()[4][1]; return [...edit, ...M.slice(2)]; }
    if (tb === "s") return [...edit, ["Im Wagen / wieder offen", "Leertaste", () => selOf("s").forEach(x => toggleTodo(x.id))], ["Löschen …", "Entf", () => ACT.dtdel()]];
    if (tb === "i") return [...edit, ["Formular öffnen", "Enter", () => { const f = $(".dtiform input,.dtiform select"); if (f) f.focus(); }], ["PDF hinzufügen …", "", () => ACT.pdffor({ dataset: { id } })], ["Bild / Scan …", "", () => ACT.docfor({ dataset: { id } })], "-", ["Löschen …", "Entf", () => ACT.dtdel()]];
    if (tb === "d") { const d = TB.d.find(id); return [...edit, ["Öffnen", "Enter", () => viewPhoto(d.photo)], ["Bearbeiten …", "", () => ACT.editdoc({ dataset: { id } })], "-", ["Löschen …", "Entf", () => ACT.dtdel()]]; }
    if (tb === "k") { const l = selOf("k"), one = l.length === 1 ? l[0] : null; return [["Rein in Mirella", "", () => ACT.dtkrein(), !!one && !KA.cands(one).length], ["Nicht in Mirella", "", () => ACT.dtknicht()], ["Später", "", () => ACT.dtklater()], "-", ["Ganz löschen …", "Entf", () => ACT.dtkdel(), l.some(c => !c.b)]]; }
    if (tb === "r") { const b = TB.r.find(id); return [["Öffnen", "Enter", () => openBrief(id)], ...(b && !b.remote ? ["-", ["Löschen …", "Entf", () => ACT.dtdel()]] : [])]; }
    return [...edit, ["Löschen …", "Entf", () => ACT.dtdel()]];
  }
  function renameGroup(g) {
    if (!g) return;
    const n = (prompt(`Neuer Name für die Gruppe „${g}“`, g) || "").trim(); if (!n || n === g) return;
    S.people.forEach(p => { if (p.group === g) p.group = n; }); S.groups = [...new Set(S.groups.map(x => x === g ? n : x))];
    if (cf === "g:" + g) cf = "g:" + n; lastMsg = "Gruppe umbenannt: " + n; save(); render(true); origToast(lastMsg);
  }

  /* ---------- Ziehen und Ablegen ---------- */
  let drag = null;
  const dragClear = () => { drag = null; root.classList.remove("dtdrag-p", "dtdrag-t"); document.querySelectorAll(".dropon").forEach(x => x.classList.remove("dropon")); };
  document.addEventListener("dragstart", e => {
    if (!on || !e.target.closest) return;
    const row = e.target.closest("tr[data-act=dtrow]"), ev = e.target.closest("[data-tid]");
    if (row && (row.dataset.tb === "p" || row.dataset.tb === "t")) { const tb = row.dataset.tb, id = row.dataset.id; drag = { k: tb, ids: SEL[tb].has(id) ? [...SEL[tb]] : [id] }; }
    else if (ev) drag = { k: "t", ids: [ev.dataset.tid] };
    else return;
    e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", drag.ids.join(","));
    const n = drag.ids.length, lab = document.createElement("div"); lab.className = "dtdraglab";
    lab.textContent = drag.k === "p" ? (n === 1 ? fullName(TB.p.find(drag.ids[0]) || {}) : n + " Kontakte") : (n === 1 ? (TB.t.find(drag.ids[0]) || {}).t : n + " Aufgaben");
    document.body.appendChild(lab); e.dataTransfer.setDragImage(lab, 10, 10); setTimeout(() => lab.remove(), 0);
    root.classList.add("dtdrag-" + drag.k);
  });
  document.addEventListener("dragend", dragClear);
  const dropOk = t => { if (!drag || !t) return false; const d = t.dataset.drop; return drag.k === "p" ? (d.startsWith("g:") || d === "arch") : (d.startsWith("d:") || d.startsWith("a:")); };
  document.addEventListener("dragover", e => {
    if (!on) return;
    if (!drag) { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) { e.preventDefault(); fileHint(true); } return; }
    const t = e.target.closest && e.target.closest("[data-drop]");
    document.querySelectorAll(".dropon").forEach(x => { if (x !== t) x.classList.remove("dropon"); });
    if (dropOk(t)) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; t.classList.add("dropon"); }
  });
  document.addEventListener("drop", e => {
    if (!on) return;
    if (!drag) { if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) { e.preventDefault(); fileHint(false); dropFiles([...e.dataTransfer.files]); } return; }
    const t = e.target.closest && e.target.closest("[data-drop]"); if (!dropOk(t)) { dragClear(); return; }
    e.preventDefault(); const d = t.dataset.drop, { k, ids } = drag; dragClear();
    if (k === "p") { const ps = S.people.filter(p => ids.includes(p.id)); if (d === "arch") { const a = ps.filter(p => !p.arch); if (a.length) archP(a); } else setPGroup(ps, d.slice(2)); }
    else { const ts = S.todos.filter(x => ids.includes(x.id)); if (d.startsWith("d:")) moveT(ts, d.slice(2)); else { const A = areaById(d.slice(2)); ts.forEach(x => { x.area = A.id; }); lastMsg = `${pl(ts.length, "Aufgabe", "Aufgaben")} → ${A.n}`; save(); render(true); origToast(lastMsg); } }
  });
  let fhT = null;
  function fileHint(show) {
    let h = document.getElementById("dtfilehint");
    if (show) { if (!h) { h = document.createElement("div"); h.id = "dtfilehint"; h.innerHTML = `<div><b>Loslassen zum Übernehmen</b><span>vCard (.vcf) → Kontakte · PDF oder Bild → als Dokument ablegen · Sicherung (.json) → laden</span></div>`; document.body.appendChild(h); } clearTimeout(fhT); fhT = setTimeout(() => fileHint(false), 300); }
    else if (h) h.remove();
  }
  function feed(id, files) { const inp = document.getElementById(id); if (!inp) return; const dt = new DataTransfer(); files.forEach(f => dt.items.add(f)); inp.files = dt.files; inp.dispatchEvent(new Event("change", { bubbles: true })); }
  function dropFiles(files) {
    const f = files[0], n = (f.name || "").toLowerCase(), isPdf = /\.pdf$/.test(n) || f.type === "application/pdf";
    if (/\.vcf$/.test(n) || /vcard/.test(f.type)) return feed("f-vcf", [f]);
    if (/\.json$/.test(n)) { if (ask("Diese Sicherung laden? Mirella fragt danach noch einmal nach, bevor etwas ersetzt wird.")) feed("f-import", [f]); return; }
    if (isPdf && view === "briefings") return feed("f-brief", files);
    if (/^image\//.test(f.type) || isPdf) {
      if (view === "akte" && !isPdf && S.people.some(p => p.id === cur) && ask(`Als Profilbild für ${fullName(S.people.find(p => p.id === cur))} nehmen?`)) { avFor = cur; return feed("f-avatar", [f]); }
      const tb = curTb(), id = tb && curOf(tb); pdfRef = (tb === "i" || tb === "t" || tb === "p") && id ? id : "";
      return isPdf ? feed("f-doc", [f]) : feed("f-lib", [f]);
    }
    toast("Diese Datei kenne ich nicht. Geht: vCard, Bild, PDF oder Mirella-Sicherung.");
  }

  /* ---------- Befehlssuche (Strg+K) ---------- */
  function palette(pre) {
    closeMenu(); closeCtx();
    let box = document.getElementById("dtpal"); if (box) box.remove();
    box = document.createElement("div"); box.id = "dtpal"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Suchen und Befehle");
    box.innerHTML = `<div class="dtpalbox"><div class="dtpalin">${ic("search", 16)}<input id="dtpalq" placeholder="Kontakt, Aufgabe, Vertrag, Dokument oder Befehl …" autocomplete="off" spellcheck="false"></div><div class="dtpallist" role="listbox"></div><div class="dtpalfoot"><span><kbd>↑</kbd><kbd>↓</kbd> wählen</span><span><kbd>Enter</kbd> öffnen</span><span><kbd>Esc</kbd> schließen</span></div></div>`;
    document.body.appendChild(box);
    const inp = box.querySelector("#dtpalq"), lst = box.querySelector(".dtpallist"); let res = [], sel = 0;
    const cmds = []; const walk = (items, pre0) => items.forEach(it => { if (it === "-" || it[3] === false) return; if (Array.isArray(it[2])) walk(it[2], pre0 + " › " + it[0]); else cmds.push({ g: "Befehle", l: it[0], s: pre0 + (it[1] ? " · " + it[1] : ""), f: it[2] }); });
    MENUS().forEach(([m, items]) => walk(items, m));
    AREAS.forEach(A => subsOf(A.id).forEach(([k, l]) => cmds.push({ g: "Befehle", l: A.n + " › " + l, s: "Bereich öffnen", f: () => go("b:" + A.id + ":" + k) })));
    const go2 = r => { box.remove(); r.f(); };
    const draw = () => {
      const v = inp.value.trim().toLowerCase(), hit = s => !v || s.toLowerCase().includes(v) || (v.length > 2 && fuzzyHas(s, v));
      const ps = v ? S.people.filter(p => hit(fullName(p) + " " + (p.nick || "") + " " + (p.group || "") + " " + (p.tel || ""))).slice(0, 8).map(p => ({ g: "Kontakte", l: fullName(p), s: [p.group, p.tel, p.arch ? "Archiv" : ""].filter(Boolean).join(" · "), f: () => openPerson(p.id) })) : [];
      const ts = v ? S.todos.filter(x => hit(x.t)).sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0)).slice(0, 6).map(x => ({ g: x.list === "einkauf" ? "Einkauf" : "Aufgaben", l: x.t, s: x.done ? "erledigt" : x.date ? relDate(x.date) : "ohne Datum", f: () => openTodo(x.id) })) : [];
      const its = v ? S.items.filter(x => KINDS[x.kind] && hit(kindTitle(x.kind, x) + " " + (x.art || "") + " " + (x.nr || ""))).slice(0, 6).map(x => ({ g: "Bereiche", l: kindTitle(x.kind, x), s: KINDS[x.kind].n + " · " + areaById(KINDS[x.kind].area).n, f: () => openItem(x.id) })) : [];
      const ds = v ? S.docs.filter(d => hit(d.name + " " + (d.folder || ""))).slice(0, 5).map(d => ({ g: "Dokumente", l: d.name, s: (areaById(d.area) || {}).n || "", f: () => openDoc(d.id) })) : [];
      const cs = cmds.filter(c => hit(c.l + " " + c.s)).slice(0, v ? 8 : 14);
      res = [...ps, ...ts, ...its, ...ds, ...cs];
      if (v) res.push({ g: "Mehr", l: `Überall suchen nach „${inp.value.trim()}“`, s: "Notizen, Hilfe, alles", f: () => searchOpen(inp.value.trim()) });
      sel = Math.min(sel, Math.max(0, res.length - 1));
      let lastG = "";
      lst.innerHTML = res.map((r, i) => { const h2 = r.g !== lastG ? `<div class="dtpalg">${r.g}</div>` : ""; lastG = r.g; return h2 + `<button class="dtpalr${i === sel ? " on" : ""}" data-i="${i}" role="option"><b>${esc(r.l)}</b><small>${esc(r.s || "")}</small></button>`; }).join("") || '<div class="dtempty">Nichts gefunden</div>';
    };
    inp.addEventListener("input", () => { sel = 0; draw(); });
    inp.addEventListener("keydown", e => {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(res.length - 1, sel + 1); draw(); const o = lst.querySelector(".on"); if (o) o.scrollIntoView({ block: "nearest" }); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); const o = lst.querySelector(".on"); if (o) o.scrollIntoView({ block: "nearest" }); }
      else if (e.key === "Enter") { e.preventDefault(); if (res[sel]) go2(res[sel]); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); box.remove(); }
    });
    lst.addEventListener("click", e => { const b2 = e.target.closest(".dtpalr"); if (b2) go2(res[+b2.dataset.i]); });
    box.addEventListener("mousedown", e => { if (e.target === box) box.remove(); });
    if (pre) inp.value = pre; draw(); inp.focus();
  }
  function openPerson(id) { if (!leaveForms()) return; closeAll(); q = ""; const p = S.people.find(x => x.id === id); if (!p) return; if (!cfTest()(p)) cf = p.arch ? "arch" : "all"; cur = id; SEL.p.clear(); SEL.p.add(id); ANCH.p = id; view = "akte"; pNew = false; render(); scrollSel(); }
  function openTodo(id) { const x = S.todos.find(y => y.id === id); if (!x || !leaveForms()) return; closeAll(); q = ""; tf = ""; if (x.list === "einkauf") { todoList = "einkauf"; view = "todos"; SEL.s.clear(); SEL.s.add(id); CUR.s = id; } else { todoList = "todo"; view = "todos"; if (x.done) showDoneT = true; SEL.t.clear(); SEL.t.add(id); CUR.t = id; } render(); scrollSel(); }
  function openItem(id) { const it = S.items.find(x => x.id === id); if (!it || !leaveForms()) return; closeAll(); q = ""; area = KINDS[it.kind].area; BSUB[area] = "k:" + it.kind; view = "bereich"; iNew = null; SEL.i.clear(); SEL.i.add(id); CUR.i = id; render(); scrollSel(); }
  function openDoc(id) { const d = S.docs.find(x => x.id === id); if (!d || !leaveForms()) return; closeAll(); q = ""; area = d.area && areaById(d.area) ? d.area : "doku"; BSUB[area] = "docs"; view = "bereich"; SEL.d.clear(); SEL.d.add(id); CUR.d = id; render(); scrollSel(); }

  /* ---------- Hilfen ---------- */
  function keysSheet() {
    const K = [["Alt", "Menüleiste mit der Tastatur"], ["Strg + K", "Suchen und Befehle (Kontakte, Aufgaben, Verträge, Dokumente)"], ["Strg + 1 … 5", "Übersicht, Kontakte, Aufgaben, Einkauf, Kalender"], ["N", "Neu (passend zur Ansicht)"], ["Strg + F", "Tabelle durchsuchen"], ["↑ ↓", "Zeile wechseln (mit Umschalt: mehrere)"], ["← →", "Spalte wechseln"], ["F2 oder Enter", "Zelle ändern"], ["Enter / Tab", "In der Zelle: übernehmen / zur nächsten Zelle"], ["Strg + S", "Formular speichern (sonst: abgleichen)"], ["Esc", "Verwerfen, Auswahl aufheben"], ["Entf", "Löschen (mit Nachfrage)"], ["Leertaste", "Aufgabe erledigt"], ["Strg + A", "Alles auswählen"], ["Strg + Z / Strg + Y", "Rückgängig / Wiederholen"], ["Strg + B / Strg + I", "Ordner-Baum / Detailbereich ein und aus"], ["Strg + M", "Mit Sprache eingeben"], ["Strg + P", "Drucken"], ["Rechtsklick", "Mehr an Zeile, Tag oder Gruppe"], ["Ziehen", "Kontakte auf Gruppen, Aufgaben auf Tage und Bereiche, Dateien ins Fenster"]];
    openSheet(`<p class="stitle">Tastenkürzel</p><div class="dtkeys">${K.map(([k, t]) => `<div><kbd>${esc(k)}</kbd><span>${esc(t)}</span></div>`).join("")}</div><div class="row2"><button class="btn pri" data-close="sheet">Schließen</button></div>`);
  }
  function about() { openSheet(`<p class="stitle">Über Mirella</p><p>Mirella ${esc(VERSION)} · Programm für den Computer.</p><p class="hint">Läuft im Browser und lässt sich als Windows-App installieren. Updates kommen von allein, die Daten gleichen sich mit iPhone und iPad ab.</p><div class="row2"><button class="btn pri" data-close="sheet">Schließen</button></div>`); }
  function focusFind() { const i = $("#q"); if (i) { i.focus(); i.select(); } else palette(); }
  function selectAll() { const tb = curTb(); if (!tb) return; TB[tb].order().forEach(id => SEL[tb].add(id)); render(true); }
  function editActive() { const tb = curTb(), id = tb && curOf(tb); if (!id) return; const cols = TB[tb].cols(); let c = cols[ACOL[tb] || 0]; if (!c || !c.e) c = cols.find(x => x.e); if (c) startEdit(tb, id, c.k); }
  function saveAny() { if (fDirty || pNew) return pFormSave(); if (iDirty || iNew) return iFormSave(); if (typeof sync === "function" && typeof syOn === "function" && syOn()) { sync(true); origToast("Gespeichert und abgeglichen"); } else origToast("Alles ist gespeichert."); }

  /* ---------- Aktionen ---------- */
  Object.assign(ACT, {
    dtnav: el => go(el.dataset.n),
    dttw: (el, e) => { if (e && e.stopPropagation) e.stopPropagation(); const k = el.dataset.k; if (k.startsWith("b_")) { const id = k.slice(2), here = mod() === "b" && area === id, open = P.fold[k] ? false : here || !!P.fold["o_" + id]; if (open) { P.fold[k] = 1; delete P.fold["o_" + id]; } else { delete P.fold[k]; P.fold["o_" + id] = 1; } } else P.fold[k] = !P.fold[k]; pSave(); shell(); },
    dtrow: (el, e) => {
      if (e && e.target.closest && e.target.closest("button,a,input,select,textarea")) return;
      const tb = el.dataset.tb, id = el.dataset.id, td = e && e.target.closest && e.target.closest("td[data-c]"), plain = !(e && (e.ctrlKey || e.metaKey || e.shiftKey));
      if (td) ACOL[tb] = +td.dataset.c;
      if (ED) commitEdit();
      /* Doppelklick selbst erkennen: beim ersten Klick wird die Zeile neu gezeichnet */
      const now = Date.now(), key = tb + "|" + id + "|" + (td ? td.dataset.c : "");
      if (plain && lastClk.k === key && now - lastClk.t < 500) { lastClk = {}; rowDbl(tb, id, td ? +td.dataset.c : -1); return; }
      lastClk = { k: key, t: now };
      if (plain && SEL[tb].size === 1 && SEL[tb].has(id) && curOf(tb) === id) { $$("#screen td.ac").forEach(x => x.classList.remove("ac")); const c = TB[tb].cols()[ACOL[tb] || 0]; if (td && c && c.e) td.classList.add("ac"); return; }
      pick(tb, id, e);
    },
    dtsort: el => { const tb = el.dataset.tb, k = el.dataset.k, s = SORT[tb] || {}; SORT[tb] = { k, d: s.k === k ? -(s.d || 1) : 1 }; render(true); },
    dtnewgrp: () => { const g = (prompt("Name der neuen Gruppe, z. B. Paddeln") || "").trim(); if (!g) return; if (!S.groups.includes(g)) S.groups.push(g); lastMsg = "Neue Gruppe: " + g; save(); go("p:g:" + g); origToast(lastMsg + ". Kontakte einfach hierher ziehen."); },
    dtnewp: () => { if (!leaveForms()) return; closeAll(); q = ""; pNew = true; fDirty = false; ptab = "allg"; SEL.p.clear(); if (!P.det) { P.det = 1; pSave(); } view = "menschen"; render(true); setTimeout(() => { const f = $("#pf-first"); if (f) f.focus(); }, 30); },
    dtnewt: () => todoForm(null, { area: tf ? tf.slice(2) : "" }),
    dtcalnew: () => todoForm(null, { date: (view === "kalender" && selDate) || today() }),
    dtpsave: () => pFormSave(),
    dtpdiscard: () => { fDirty = false; pNew = false; render(true); origToast("Änderungen verworfen"); },
    dtptab: el => { if (fDirty && !pFormSave()) return; ptab = el.dataset.k; render(true); },
    dtpfadd: el => { const box = $(el.dataset.k === "tel" ? ".dtpform .pf-tels" : ".dtpform .pf-mails"); if (!box) return; const tmp = document.createElement("div"); tmp.innerHTML = el.dataset.k === "tel" ? telRowF("", "") : mailRowF(""); const n = tmp.firstElementChild; box.appendChild(n); n.querySelector("input").focus(); fDirty = true; markDirty(); },
    dtpfrm: el => { const r = el.closest(".pf-telrow,.pf-mailrow"); if (r) { r.remove(); fDirty = true; markDirty(); } },
    dtpcall: () => { const p = selOf("p")[0]; if (p) ACT.call({ dataset: { id: p.id } }, { stopPropagation() { }, preventDefault() { }, target: document.body }); },
    dtplog: () => { const p = selOf("p")[0] || S.people.find(x => x.id === cur); if (p) callResult(p, false); },
    dtpwa: () => { const p = selOf("p")[0]; if (p && p.tel) window.open("https://wa.me/" + waNum(p.tel), "_blank", "noopener"); },
    dtpmail: () => { const p = selOf("p")[0]; if (p && p.email) location.href = "mailto:" + p.email; },
    dtparch: () => archP(selOf("p")),
    dtpgrpmenu: el => { const r = el.getBoundingClientRect(); closeCtx(); popup(MENUS()[3][1][7][2], r.left, r.bottom, "dtctx"); },
    dtpcycmenu: el => { const r = el.getBoundingClientRect(); closeCtx(); popup(MENUS()[3][1][8][2], r.left, r.bottom, "dtctx"); },
    dttprio: el => { const r = el.getBoundingClientRect(); closeCtx(); popup(MENUS()[4][1][4][2], r.left, r.bottom, "dtctx"); },
    dttarea: el => { const r = el.getBoundingClientRect(); closeCtx(); popup(MENUS()[4][1][5][2], r.left, r.bottom, "dtctx"); },
    dtcsv: () => exportCSV(),
    dtprint: () => window.print(),
    dtsync: () => { if (typeof sync === "function" && typeof syOn === "function" && syOn()) sync(true); else origToast("Nicht angemeldet: Einstellungen › Konto & Abgleich"); },
    dttdone: () => doneT(selOf("t")),
    dttedit: () => { const x = selOf("t")[0]; if (x) todoForm(x); },
    dttmove: el => moveT(selOf("t"), el.dataset.d),
    dtdone: () => { showDoneT = !showDoneT; render(true); },
    dtopent: el => openTodo(el.dataset.id),
    dtitem: el => openItem(el.dataset.id),
    dtdoc: el => openDoc(el.dataset.id),
    dtshopfocus: () => { if (mod() !== "s") go("s"); setTimeout(() => { const i = $("#shopin"); if (i) i.focus(); }, 30); },
    dtexpgo: () => { go("b:geld:exp"); setTimeout(() => { const i = $("#dtexp-s"); if (i) i.focus(); }, 40); },
    dtexpfocus: () => { if (!(mod() === "b" && area === "geld" && bsub() === "exp")) go("b:geld:exp"); setTimeout(() => { const i = $("#dtexp-s"); if (i) i.focus(); }, 40); },
    dtnotefocus: () => setTimeout(() => { const i = $("#dtnotein"); if (i) i.focus(); }, 20),
    dtbnote: () => { const a0 = mod() === "b" ? area : "haus"; go("b:" + a0 + ":notes"); setTimeout(() => { const i = $("#dtnotein"); if (i) i.focus(); }, 40); },
    dtpdf: () => { pdfRef = ""; const f = $("#f-doc"); if (f) { f.value = ""; f.click(); } },
    dtimg: () => { const f = $("#f-lib"); if (f) { f.value = ""; f.click(); } },
    dtipdf: () => { const it = selOf("i")[0]; if (it) ACT.pdffor({ dataset: { id: it.id } }); },
    dtbsub: el => { if (!leaveForms()) return; BSUB[area] = el.dataset.k; iNew = null; q = ""; ED = null; render(); },
    dtinew: el => { if (!leaveForms()) return; closeAll(); const k = el.dataset.k; area = KINDS[k].area; BSUB[area] = "k:" + k; view = "bereich"; q = ""; iNew = k; iDirty = false; SEL.i.clear(); if (!P.det) { P.det = 1; pSave(); } render(); setTimeout(() => { const f = $(".dtiform input, .dtiform select"); if (f) f.focus(); }, 30); },
    dtisave: () => iFormSave(),
    dtidiscard: () => { iDirty = false; iNew = null; render(true); origToast("Änderungen verworfen"); },
    dtreaddel: el => { const it = TB.i.find(CUR.i); if (!it || !ask(`Stand ${el.dataset.v} vom ${fmtD(el.dataset.d)} löschen?`)) return; it.reads = (it.reads || []).filter(r => !(r.d === el.dataset.d && String(r.v) === el.dataset.v)); syncAuto(it); lastMsg = "Zählerstand gelöscht"; save(); render(true); },
    dtpldel: el => { const p = S.people.find(x => x.id === cur); if (!p) return; const k = el.dataset.k, l = p[k] || [], x = l.find(y => (y.id || y.d) === el.dataset.id); if (!x || !ask(k === "calls" ? `Anruf vom ${fmtDate(x.d)} löschen?` : `„${x.t}“ löschen?`)) return; p[k] = l.filter(y => y !== x); lastMsg = "Gelöscht"; save(); render(true); },
    dtsetsec: el => { setSec = el.dataset.k; setFrom = null; render(); const s = $("#screen .dtset"); if (s) s.scrollTop = 0; },
    dtsetarea: el => { go("set"); setSec = el.dataset.k; render(); },
    dtwell: () => { if (ACT.sickend) ACT.sickend(); else if (ACT.healthy) ACT.healthy(); else origToast("Über Gesundheit › Ich bin krank beenden"); },
    dtbopen: () => { const b = selOf("r")[0]; if (b) openBrief(b.id); },
    dtwxload: () => { origToast("Wetter wird neu geladen …"); Promise.resolve(loadWeather(true)).catch(() => { }).then(() => { if (on && view === "wetter") render(true); }); },
    dtselnone: () => { const tb = curTb(); if (!tb) return; SEL[tb].clear(); if (tb === "p") view = "menschen"; else CUR[tb] = null; render(true); },
    dtdel: () => {
      const tb = curTb(); if (!tb) return; const l = selOf(tb); if (!l.length) return;
      if (tb === "p") return delP(l);
      if (tb === "k") return ACT.dtkdel();
      if (tb === "t" || tb === "s") return delT(l);
      if (tb === "i") { if (!ask(l.length === 1 ? `„${kindTitle(l[0].kind, l[0])}“ löschen? Die offenen Erinnerungen dazu gehen mit.` : `${l.length} Einträge löschen? Die offenen Erinnerungen dazu gehen mit.`)) return; const ids = new Set(l.map(x => x.id)); S.items = S.items.filter(x => !ids.has(x.id)); S.todos = S.todos.filter(t => !(ids.has(t.ref) && !t.done)); SEL.i.clear(); iDirty = false; }
      else if (tb === "e") { if (!ask(l.length === 1 ? `Ausgabe ${l[0].shop || l[0].cat} (${eur(l[0].amount)}) löschen?` : `${l.length} Ausgaben löschen?`)) return; const ids = new Set(l.map(x => x.id)); S.expenses = S.expenses.filter(x => !ids.has(x.id)); SEL.e.clear(); }
      else if (tb === "g") { if (!ask(l.length === 1 ? `Sparziel „${l[0].n}“ löschen?` : `${l.length} Sparziele löschen?`)) return; const ids = new Set(l.map(x => x.id)); S.goals = (S.goals || []).filter(x => !ids.has(x.id)); SEL.g.clear(); }
      else if (tb === "n") { if (!ask(l.length === 1 ? `Notiz „${l[0].t}“ löschen?` : `${l.length} Notizen löschen?`)) return; const ids = new Set(l.map(x => x.id)); S.notes = S.notes.filter(x => !ids.has(x.id)); SEL.n.clear(); }
      else if (tb === "d") { if (!ask(l.length === 1 ? `„${l[0].name}“ löschen? Die Datei wird mit gelöscht.` : `${l.length} Dokumente löschen? Die Dateien werden mit gelöscht.`)) return; const ids = new Set(l.map(x => x.id)); l.forEach(x => { if (x.photo) Promise.resolve(photoDel(x.photo)).catch(() => { }); }); S.docs = S.docs.filter(x => !ids.has(x.id)); SEL.d.clear(); }
      else if (tb === "r") { const own = l.filter(b => !b.remote); if (!own.length) { origToast("Automatische Briefings löscht Mirella nach 7 Tagen von selbst."); return; } if (!ask(own.length === 1 ? "Briefing löschen?" : `${own.length} Briefings löschen?`)) return; const ids = new Set(own.map(x => x.id)); own.forEach(b => Promise.resolve(photoDel(b.id)).catch(() => { })); S.briefings = S.briefings.filter(x => !ids.has(x.id)); SEL.r.clear(); }
      lastMsg = "Gelöscht"; save(); render(true); origToast("Gelöscht · Strg+Z holt zurück");
    },
    dtdet: () => { P.det = P.det ? 0 : 1; pSave(); render(true); },
    dtnavtog: () => { P.nav = P.nav ? 0 : 1; pSave(); shell(); },
    dtpal: () => palette(),
    dtinstall: async () => { if (!installEvt) return; const e = installEvt; installEvt = null; try { e.prompt(); const r = await e.userChoice; if (r && r.outcome === "accepted") toast("Mirella ist jetzt als App auf dem PC"); } catch (_) { } shell(); }
  });

  /* ---------- Formulare in Tabellen und Detailbereich ---------- */
  document.addEventListener("submit", e => {
    const f = e.target; if (!on || !f.dataset) return;
    const k = f.dataset.form; if (!["dtquick", "dtpl", "dtnote", "dtexp", "dtread", "dtpack"].includes(k)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (k === "dtexp") {
      const a = parseAmount($("#dtexp-a").value); if (a == null) { origToast("Bitte den Betrag eintragen"); $("#dtexp-a").focus(); return; }
      const ex = { id: uid(), d: $("#dtexp-d").value || today(), amount: a, shop: $("#dtexp-s").value.trim(), cat: $("#dtexp-c").value, photo: null };
      S.expenses.push(ex); S.settings.lastCat = ex.cat; finM = ex.d.slice(0, 7); lastMsg = "Ausgabe " + eur(a); save(); render(true); origToast("Gespeichert: " + eur(a)); const i = $("#dtexp-s"); if (i) i.focus(); return;
    }
    const inp = f.querySelector("input"), v = inp ? inp.value.trim() : ""; if (!v) return;
    if (k === "dtquick") {
      const w = parseWhen(v) || {}, t = cap((w.rest || v).trim()) || v;
      const x = { id: uid(), t, list: "todo", done: false, created: today(), date: w.trig === "verlassen" ? "" : (w.date || ""), time: w.trig === "verlassen" ? "" : (w.time || ""), trig: w.trig || "zeit", rep: "nie", area: tf ? tf.slice(2) : "", nerv: false, prio: "", ort: "", note: "" };
      S.todos.push(x); SEL.t.clear(); SEL.t.add(x.id); CUR.t = x.id; lastMsg = "Neue Aufgabe: " + t; save(); render(true);
      origToast(`Eingetragen: ${t}${x.date ? " · " + relDate(x.date) : ""}${x.time ? " " + x.time : ""}`); const i = $("#dtquick"); if (i) i.focus(); return;
    }
    if (k === "dtpl") { const p = S.people.find(x => x.id === cur); if (!p) return; const key = f.dataset.k; p[key] = p[key] || []; const it = { id: uid(), t: v, d: today() }; if (key === "notes") p[key].unshift(it); else p[key].push(it); lastMsg = "Hinzugefügt: " + v; save(); render(true); const i = $(`form[data-form="dtpl"][data-k="${key}"] input`); if (i) i.focus(); return; }
    if (k === "dtnote") { S.notes.push({ id: uid(), area, t: v, d: today() }); lastMsg = "Notiz: " + v; save(); render(true); const i = $("#dtnotein"); if (i) i.focus(); return; }
    if (k === "dtread") { const it = TB.i.find(CUR.i), n = parseAmount(v); if (!it || n == null) { origToast("Bitte eine Zahl eintragen"); return; } it.reads = it.reads || []; it.reads.push({ d: today(), v: n }); syncAuto(it); lastMsg = "Zählerstand " + n; save(); render(true); origToast("Zählerstand gespeichert"); return; }
    if (k === "dtpack") { const it = TB.i.find(CUR.i); if (!it) return; (it.pack = it.pack || []).push({ id: uid(), t: v, done: false }); lastMsg = "Packliste: " + v; save(); render(true); const i = $('form[data-form="dtpack"] input'); if (i) i.focus(); return; }
  }, true);
  document.addEventListener("change", e => {
    const t = e.target; if (!on || !t.dataset || !t.dataset.dt) return;
    const k = t.dataset.dt;
    if (k === "mgroup" || k === "mcyc") { if (t.value === "__") return; const ps = selOf("p"); if (!ask(`${pl(ps.length, "Kontakt bekommt", "Kontakte bekommen")} ${k === "mgroup" ? (t.value ? "die Gruppe „" + t.value + "“" : "keine Gruppe") : "den Rhythmus „" + cycLabel(t.value) + "“"}. Einverstanden?`)) { t.value = "__"; return; } return k === "mgroup" ? setPGroup(ps, t.value) : setPCyc(ps, t.value); }
    if (k === "askdone") { const p = S.people.find(x => x.id === cur), a = p && (p.ask || []).find(x => x.id === t.dataset.id); if (a) { a.done = t.checked; save(); render(true); } return; }
    if (k === "pgift") { const p = S.people.find(x => x.id === cur); if (p) { p.gift = t.checked; save(); render(true); } return; }
    if (k === "pack") { const it = TB.i.find(CUR.i), p = it && (it.pack || []).find(x => x.id === t.dataset.p); if (p) { p.done = t.checked; save(); render(true); } return; }
    const box = t.closest(".dtinsp"); if (!box) return;
    const x = S.todos.find(y => y.id === box.dataset.id); if (!x) return;
    if (k === "t") { const v = t.value.trim(); if (!v) { t.value = x.t; return; } x.t = v; }
    else if (k === "nerv") x.nerv = t.checked;
    else if (k === "prio") x.prio = t.value ? +t.value : "";
    else if (k === "rep") { x.rep = t.value; if (x.rep !== "nie" && !x.date) x.date = today(); }
    else x[k] = t.value;
    lastMsg = "Gespeichert: " + x.t; save(); render(true);
  });

  /* ---------- Splitter, Doppelklick ---------- */
  document.addEventListener("pointerdown", e => {
    const s = e.target.closest && e.target.closest(".dtsplit"); if (!on || !s) return;
    e.preventDefault(); s.setPointerCapture(e.pointerId); root.classList.add("dtresizing");
    const r = s.parentNode.getBoundingClientRect();
    const mv = ev => { P.dw = Math.round(Math.max(360, Math.min(r.width - 420, r.right - ev.clientX))); $("#screen").style.setProperty("--dtdw", P.dw + "px"); };
    const up = () => { s.removeEventListener("pointermove", mv); s.removeEventListener("pointerup", up); root.classList.remove("dtresizing"); pSave(); };
    s.addEventListener("pointermove", mv); s.addEventListener("pointerup", up);
  });
  document.addEventListener("dblclick", e => {
    if (!on || !e.target.closest) return;
    if (e.target.closest(".dtsplit")) { P.dw = 560; pSave(); $("#screen").style.setProperty("--dtdw", "560px"); return; }
  });
  let lastClk = {};
  function rowDbl(tb, id, ci) {
    const col = ci >= 0 ? TB[tb].cols()[ci] : null;
    if (col && col.e) { ACOL[tb] = ci; startEdit(tb, id, col.k); }
    else if (tb === "t") { const x = TB.t.find(id); if (x) todoForm(x); }
    else if (tb === "d") { const d = TB.d.find(id); if (d && d.photo) viewPhoto(d.photo); }
    else if (tb === "r") openBrief(id);
    else { const f = $(".dtdetail input, .dtdetail select"); if (f) f.focus(); }
  }

  /* ---------- Menüleiste mit der Maus ---------- */
  document.addEventListener("mousedown", e => {
    if (!on || !e.target.closest) return;
    const m = e.target.closest(".dtm");
    if (m) { e.preventDefault(); const i = +m.dataset.mi; if (menuIdx === i) closeMenu(); else openMenu(i); return; }
    if (!e.target.closest(".dtpop")) { closeMenu(); closeCtx(); }
  }, true);
  document.addEventListener("mouseover", e => { if (!on || menuIdx < 0 || !e.target.closest) return; const m = e.target.closest(".dtm"); if (m && +m.dataset.mi !== menuIdx) openMenu(+m.dataset.mi); });
  window.addEventListener("blur", () => { closeMenu(); closeCtx(); });
  window.addEventListener("resize", () => { closeMenu(); closeCtx(); });

  /* ---------- Tastatur ---------- */
  const typing = t => t && t.closest && t.closest("input,textarea,select,[contenteditable=true]");
  let altAlone = false;
  document.addEventListener("keyup", e => { if (!on) return; if (e.key === "Alt" && altAlone) { e.preventDefault(); if (menuIdx >= 0) closeMenu(); else { openMenu(0); const f = document.querySelector(".dtdrop .dtpi:not([disabled])"); if (f) f.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); } } altAlone = false; });
  document.addEventListener("keydown", e => {
    if (!on || root.classList.contains("zlocked")) return;
    altAlone = e.key === "Alt";
    if (document.querySelector(".dtpop") && popKeys(e)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (document.getElementById("dtpal")) return;
    if (e.target.classList && e.target.classList.contains("dtcell")) return;
    const sheetOpen = $("#sheet").classList.contains("open"), ctrl = e.ctrlKey || e.metaKey, k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if (ctrl && k === "Enter" && sheetOpen) { const b2 = [...$$("#sheetbody .btn.pri")].filter(x => x.offsetParent).pop(); if (b2) { e.preventDefault(); b2.click(); } return; }
    if (ctrl && !e.altKey) {
      if (k === "k") { stop(); palette(); return; }
      if (k === "s") { stop(); if (sheetOpen) { const b2 = [...$$("#sheetbody .btn.pri")].filter(x => x.offsetParent).pop(); if (b2) b2.click(); return; } saveAny(); return; }
      if (k === ",") { stop(); go("set"); return; }
      if (sheetOpen) return;
      if (/^[1-5]$/.test(k)) { stop(); go(["h", "p", "t:", "s", "k"][+k - 1]); return; }
      if (k === "b") { stop(); ACT.dtnavtog(); return; }
      if (k === "i") { stop(); ACT.dtdet(); return; }
      if (k === "m") { stop(); const mic = $("#mic"); if (mic) mic.click(); return; }
      if (k === "f") { stop(); focusFind(); return; }
      if (k === "p") { stop(); window.print(); return; }
      if (typing(e.target)) return;
      if (k === "z" && !e.shiftKey) { stop(); undo(); return; }
      if (k === "y" || (k === "z" && e.shiftKey)) { stop(); redo(); return; }
      if (k === "a" && curTb()) { stop(); selectAll(); return; }
      return;
    }
    if (k === "Escape" && !sheetOpen && typing(e.target) && e.target.closest(".dtpform,.dtiform")) { stop(); if (e.target.closest(".dtpform")) ACT.dtpdiscard(); else ACT.dtidiscard(); return; }
    if (e.altKey || typing(e.target) || sheetOpen || document.querySelector(".pdfview,.zv,.imgfull,#zgate")) return;
    const tb = curTb();
    if (k === "Escape") { if (tb && SEL[tb].size) { stop(); ACT.dtselnone(); } else if (fDirty || pNew) { stop(); ACT.dtpdiscard(); } return; }
    if (k === "?") { e.preventDefault(); keysSheet(); return; }
    if (k === "/") { e.preventDefault(); palette(); return; }
    if (k === "n") {
      e.preventDefault(); const m = mod();
      if (m === "p" || m === "h") ACT.dtnewp(); else if (m === "s") ACT.dtshopfocus(); else if (m === "k") ACT.dtcalnew(); else if (m === "t") { const i = $("#dtquick"); i ? i.focus() : todoForm(null); }
      else if (m === "b") { const s2 = bsub(); if (s2.startsWith("k:")) ACT.dtinew({ dataset: { k: s2.slice(2) } }); else if (s2 === "exp") ACT.dtexpfocus(); else if (s2 === "notes") ACT.dtnotefocus(); else if (s2 === "goals") ACT.goalnew(); else if (s2 === "docs") ACT.dtpdf(); else todoForm(null, { area }); }
      else if (m === "r") ACT.addbrief(); else todoForm(null);
      return;
    }
    if (!tb) return;
    const id = curOf(tb);
    if ((k === "F2" || k === "Enter") && id) { e.preventDefault(); if (tb === "r") { openBrief(id); return; } if (tb === "d" && k === "Enter") { const d = TB.d.find(id); if (d) viewPhoto(d.photo); return; } if (tb === "i" && k === "Enter") { const f = $(".dtiform input,.dtiform select"); if (f) f.focus(); return; } editActive(); return; }
    if (k === "Delete") { if (SEL[tb].size) { e.preventDefault(); ACT.dtdel(); } return; }
    if (k === " " && (tb === "t" || tb === "s") && SEL[tb].size) { e.preventDefault(); const l = selOf(tb); if (l.length === 1 && l[0].done) toggleTodo(l[0].id); else if (tb === "t") doneT(l); else l.forEach(x => toggleTodo(x.id)); return; }
    if (k === "ArrowLeft" || k === "ArrowRight") { if (!id) return; e.preventDefault(); const n = TB[tb].cols().length; ACOL[tb] = Math.max(0, Math.min(n - 1, (ACOL[tb] || 0) + (k === "ArrowRight" ? 1 : -1))); render(true); scrollSel(); return; }
    if (k === "ArrowDown" || k === "ArrowUp" || k === "Home" || k === "End") {
      e.preventDefault(); const list = TB[tb].order(); if (!list.length) return;
      const i = list.indexOf(id);
      const j = k === "Home" ? 0 : k === "End" ? list.length - 1 : i < 0 ? (k === "ArrowDown" ? 0 : list.length - 1) : Math.max(0, Math.min(list.length - 1, i + (k === "ArrowDown" ? 1 : -1)));
      const nid = list[j]; if (!leaveForms(tb, nid)) return;
      if (e.shiftKey) SEL[tb].add(nid); else { SEL[tb].clear(); SEL[tb].add(nid); ANCH[tb] = nid; }
      setCur(tb, nid); if (tb === "p") pNew = false; if (tb === "i") iNew = null;
      if (tb === "r") { const b = S.briefings.find(x => x.id === nid); if (b && !b.read) { b.read = true; origSaveDt(); base = snap(); } }
      render(true); scrollSel();
    }
  }, true);
  document.addEventListener("keydown", e => { if (on && e.key === "ArrowDown" && e.target.id === "q") e.target.blur(); });

  /* ---------- Rendern ---------- */
  const origRender = render;
  render = function (keepScroll) {
    if (!on) return origRender.apply(this, arguments);
    const panes = {}; $$("#screen .dtpane[data-k], #screen .dtdash[data-k]").forEach(p => { panes[p.dataset.k] = [p.scrollTop, p.scrollLeft]; });
    const keepP = fDirty && $(".dtpform"), keepI = iDirty && $(".dtiform");
    const key = view + "|" + todoList + "|" + (view === "bereich" ? area + bsub() : "") + "|" + (view === "einstellungen" ? setSec : "");
    const r = origRender.apply(this, arguments);
    const sc = $("#screen"); sc.dataset.view = view; sc.style.setProperty("--dtdw", P.dw + "px");
    sc.classList.toggle("dtpanes", !!sc.querySelector(":scope > .dtview, :scope > .dtdash"));
    sc.classList.toggle("dtold", !sc.classList.contains("dtpanes"));
    if (view === "kalender") calDecorate();
    if (keepP) { const nf = $(".dtpform"); if (nf && nf.dataset.id === keepP.dataset.id) nf.replaceWith(keepP); }
    if (keepI) { const nf = $(".dtiform"); if (nf && nf.dataset.id === keepI.dataset.id) nf.replaceWith(keepI); }
    if (key === lastKey || keepScroll) $$("#screen .dtpane[data-k], #screen .dtdash[data-k]").forEach(p => { const v = panes[p.dataset.k]; if (v) { p.scrollTop = v[0]; p.scrollLeft = v[1]; } });
    lastKey = key;
    shell(); if (typeof loadThumbs === "function") loadThumbs();
    return r;
  };
  if (typeof syStatus === "function") { const os = syStatus; syStatus = function () { const r = os.apply(this, arguments); if (on) { const sb = document.getElementById("dtstatus"); if (sb) sb.innerHTML = statusHTML(); } return r; }; }
  window.addEventListener("beforeunload", e => { if (on && (fDirty || iDirty)) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- Ein / Aus je nach Fenstergröße ---------- */
  function apply() {
    const want = !!(MQ && MQ.matches) && !NATIVE;
    if (want === on) { root.classList.toggle("dtready", on); return; }
    on = want; root.classList.toggle("dt", on);
    if (on) { closeAll(); base = snap(); }
    else { unshell(); const sc = $("#screen"); delete sc.dataset.view; sc.classList.remove("dtpanes", "dtold"); }
    if (typeof S !== "undefined" && S) render(true);
    root.classList.toggle("dtready", on); if (!on) root.classList.remove("dtboot");
  }
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; if (on) shell(); });
  window.addEventListener("appinstalled", () => { installEvt = null; if (on) shell(); });
  if (MQ) { if (MQ.addEventListener) MQ.addEventListener("change", apply); else if (MQ.addListener) MQ.addListener(apply); }
  HOOKS.start.push(apply);
})();
