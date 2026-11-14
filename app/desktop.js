/* Mirella – Programm-Ansicht für den Windows-Computer (Wunsch Felix 14.11.: „wie ein Computerprogramm,
   nicht wie die App in groß“). Vorbild sind Desktop-Programme wie Outlook, Explorer oder Things:
   Menüleiste, Seitenleiste, Liste mit Detailbereich, Statusleiste, Rechtsklick-Menüs, Ziehen und Ablegen,
   Mehrfachauswahl mit Strg/Umschalt, Tastenkürzel, Befehlssuche (Strg+K) und Rückgängig (Strg+Z).
   Greift nur im Browser auf einem breiten Bildschirm mit Maus (ab 1100 Pixel). iPhone-App, iPad und
   schmales Fenster bleiben unverändert. Daten und Abgleich sind dieselben: Diese Datei liest und schreibt
   nur über die bestehenden Funktionen (save, render, personForm, todoForm …). */
"use strict";
(function () {
  if (NATIVE) return;
  const MQ = window.matchMedia ? window.matchMedia("(min-width: 1100px) and (pointer: fine)") : null;
  const root = document.documentElement;
  let on = false, installEvt = null, lastView = "", ctxOpen = null;

  /* ---------- Einstellungen der Oberfläche (nur dieses Gerät) ---------- */
  const PK = "mirella.desktop";
  let P = { nav: 1, det: 1, dw: 440, fold: {} };
  try { P = Object.assign(P, JSON.parse(localStorage.getItem(PK) || "{}")); } catch (_) { }
  const pSave = () => { try { localStorage.setItem(PK, JSON.stringify(P)); } catch (_) { } };

  /* ---------- Kleine Symbole ---------- */
  const sv = (d, w) => `<svg viewBox="0 0 24 24" width="${w || 16}" height="${w || 16}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const I = {
    plus: sv('<path d="M12 5v14M5 12h14"/>'),
    phone: sv('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
    log: sv('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/><path d="M15 3l2 2 4-4" transform="translate(0 2)"/>'),
    pen: sv('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
    arch: sv('<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/>'),
    trash: sv('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
    check: sv('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    search: sv('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'),
    undo: sv('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
    side: sv('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>'),
    panel: sv('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>'),
    mic: sv('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
    cart: sv('<circle cx="9" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/><path d="M2 3h3l2.6 12.2a1 1 0 0 0 1 .8h9.7a1 1 0 0 0 1-.8L21 7H6"/>'),
    star: sv('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
    gift: sv('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8c-2-4-6-4-6-1.5S10 8 12 8c2 0 6 1 6-1.5S14 4 12 8"/>'),
    group: sv('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    all: sv('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.2A5 5 0 0 1 21 19"/>'),
    none: sv('<circle cx="12" cy="12" r="8"/><path d="M6.5 17.5l11-11"/>'),
    doc: sv('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'),
    chev: sv('<path d="M9 6l6 6-6 6"/>', 12),
    cmd: sv('<path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z"/>', 14)
  };

  /* ================================================================
     Rückgängig / Wiederholen (Strg+Z, Strg+Y): jede gespeicherte Änderung
     in diesem Fenster lässt sich zurücknehmen. Kommt ein Abgleich von einem
     anderen Gerät, beginnt die Liste neu (sonst würde man fremde Änderungen zurückdrehen).
     ================================================================ */
  const UNDO = [], REDO = [];
  let base = null, lastMsg = "";
  const snap = () => { try { return JSON.stringify(S); } catch (_) { return null; } };
  const origSaveDt = save;
  save = function () {
    const r = origSaveDt.apply(this, arguments);
    if (on) {
      const now = snap();
      if (base && now && now !== base) { UNDO.push({ s: base, m: lastMsg }); if (UNDO.length > 40) UNDO.shift(); REDO.length = 0; }
      base = now;
    } else base = null;
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
    base = snap(); origSaveDt(); closeAll();
    if (cur && !S.people.some(p => p.id === cur) && view === "akte") view = "menschen";
    render(true);
    origToast((word === "undo" ? "Rückgängig" : "Wiederholt") + (e.m ? ": " + e.m.replace(/^Gespeichert:?\s*/, "") : ""));
  }
  const undo = () => restore(UNDO, REDO, "undo"), redo = () => restore(REDO, UNDO, "redo");

  /* ================================================================
     Kontakte: Liste mit Detailbereich
     ================================================================ */
  let cf = "all", sortK = "name", sortDir = 1, anchorP = null;
  const selP = new Set();
  const keyName = p => ((p.last || p.first || "") + " " + (p.first || "")).trim();
  const nb = p => { try { return nextBirthday(p); } catch (_) { return null; } };
  const isDran = p => !p.arch && ["late", "due"].includes(callState(p));
  const bdaySoon = p => { const b = !p.arch && !p.death && nb(p); return b && diffDays(today(), b) <= 30; };
  const CF = () => [
    ["all", "Alle Kontakte", I.all, p => !p.arch],
    ["dran", "Heute anrufen", I.phone, isDran],
    ["bday", "Geburtstag bald", I.gift, bdaySoon]
  ];
  function cfTest() {
    if (cf === "arch") return p => !!p.arch;
    if (cf === "nogrp") return p => !p.arch && !p.group;
    if (cf.startsWith("g:")) { const g = cf.slice(2); return p => !p.arch && p.group === g; }
    return (CF().find(x => x[0] === cf) || CF()[0])[3];
  }
  const cfLabel = () => cf === "arch" ? "Archiv" : cf === "nogrp" ? "Ohne Gruppe" : cf.startsWith("g:") ? cf.slice(2) : (CF().find(x => x[0] === cf) || CF()[0])[1];
  const COLS = [
    ["name", "Name", (a, b) => keyName(a).localeCompare(keyName(b), "de"), 1],
    ["group", "Gruppe", (a, b) => (a.group || "~").localeCompare(b.group || "~", "de"), 1],
    ["tel", "Telefon", (a, b) => (a.tel || "~").localeCompare(b.tel || "~"), 0],
    ["cyc", "Rhythmus", (a, b) => CYCLES.indexOf(a.cyc || "nie") - CYCLES.indexOf(b.cyc || "nie"), 0],
    ["last", "Zuletzt", (a, b) => (lastCall(a) || "0").localeCompare(lastCall(b) || "0"), 0],
    ["next", "Nächster Anruf", (a, b) => (nextDue(a) || "9999").localeCompare(nextDue(b) || "9999"), 1],
    ["bday", "Geburtstag", (a, b) => (nb(a) || "9999").localeCompare(nb(b) || "9999"), 1],
    ["woher", "Woher · Beruf", (a, b) => ((a.woher || "") + (a.job || "") || "~").localeCompare((b.woher || "") + (b.job || "") || "~", "de"), 0]
  ];
  const cols = () => COLS.filter(c => c[3] || !P.det);
  function pRows() {
    const ql = q.trim().toLowerCase(), t = cfTest();
    const l = S.people.filter(p => t(p) && (!ql || (fullName(p) + " " + (p.group || "") + " " + (p.nick || "") + " " + (p.tel || "") + " " + (p.email || "") + " " + (p.woher || "") + " " + (p.job || "") + " " + (p.addr || "")).toLowerCase().includes(ql) || fuzzyHas(fullName(p) + " " + (p.nick || "") + " " + (p.job || ""), ql)));
    const col = COLS.find(c => c[0] === sortK) || COLS[0];
    return l.sort((a, b) => sortDir * col[2](a, b) || keyName(a).localeCompare(keyName(b), "de"));
  }
  function pCell(k, p) {
    const t = today();
    if (k === "name") return `<td class="nm"><div class="nmi">${avHTML(p)}<span><b>${esc(fullName(p))}</b>${p.nick ? `<small>${esc(p.nick)}</small>` : ""}</span></div></td>`;
    if (k === "group") return `<td>${p.group ? esc(p.group) : '<span class="mut">—</span>'}</td>`;
    if (k === "tel") return `<td class="tel">${p.tel ? esc(p.tel) : '<span class="mut">—</span>'}</td>`;
    if (k === "cyc") return `<td>${p.death ? '<span class="mut">verstorben</span>' : esc(cycLabel(p.cyc || "nie"))}</td>`;
    if (k === "last") { const lc = lastCall(p); return `<td>${lc ? esc(agoText(lc)) : '<span class="mut">noch nie</span>'}</td>`; }
    if (k === "next") { const st = callState(p), due = nextDue(p); return `<td>${due && !p.arch ? `<span class="pill ${st === "late" ? "late" : st === "due" ? "acc" : ""}">${esc(st === "late" ? "überfällig" : relDate(due))}</span>` : '<span class="mut">—</span>'}</td>`; }
    if (k === "bday") { const b = nb(p), bd = (p.bday || "").split("-").map(Number), n = b ? diffDays(t, b) : null; return `<td class="bd">${p.bday ? `${bd[2]}.${bd[1]}.${n === 0 ? " <b class='dthot'>heute</b>" : n != null && n <= 30 ? ` <small>in ${n} T.</small>` : ""}` : '<span class="mut">—</span>'}</td>`; }
    if (k === "woher") return `<td class="wo">${esc([p.woher, p.job].filter(Boolean).join(" · ")) || '<span class="mut">—</span>'}</td>`;
    return "<td></td>";
  }
  function contactsHTML(akte) {
    const list = pRows(), ids = new Set(list.map(p => p.id));
    for (const id of [...selP]) if (!S.people.some(p => p.id === id)) selP.delete(id);
    const one = selP.size === 1 ? S.people.find(p => p.id === [...selP][0]) : null;
    const tb = `<div class="dttool" role="toolbar" aria-label="Kontakte">
      <button class="dtb pri" data-act="dtnewp" title="Neuer Kontakt (N)">${I.plus}<span>Neuer Kontakt</span></button>
      <span class="dtsep"></span>
      <button class="dtb" data-act="dtpcall" title="Anrufen"${one && one.tel ? "" : " disabled"}>${I.phone}<span>Anrufen</span></button>
      <button class="dtb" data-act="dtplog" title="Anruf eintragen"${one ? "" : " disabled"}>${I.log}<span>Anruf eintragen</span></button>
      <button class="dtb" data-act="dtpedit" title="Bearbeiten (F2)"${one ? "" : " disabled"}>${I.pen}<span>Bearbeiten</span></button>
      <button class="dtb" data-act="dtparch" title="${cf === "arch" ? "Zurückholen" : "Archivieren"}"${selP.size ? "" : " disabled"}>${I.arch}<span>${cf === "arch" ? "Zurückholen" : "Archivieren"}</span></button>
      <button class="dtb" data-act="dtdel" title="Löschen (Entf)"${selP.size ? "" : " disabled"}>${I.trash}</button>
      <span class="dtgrow"></span>
      <label class="dtfind">${I.search}<input id="q" type="search" placeholder="${esc(cfLabel())} filtern  (Strg+F)" aria-label="Kontakte filtern" value="${esc(q)}" autocomplete="off"></label>
      <button class="dtb ic" data-act="dtdet" aria-pressed="${!!P.det}" title="Detailbereich ein/aus (Strg+I)">${I.panel}</button>
    </div>`;
    const cs = cols();
    const head = `<thead><tr>${cs.map(([k, l]) => `<th${k === "name" ? ' class="nm"' : ""}><button data-act="dtsort" data-k="${k}" aria-sort="${sortK === k ? (sortDir > 0 ? "ascending" : "descending") : "none"}">${l}<i>${sortK === k ? (sortDir > 0 ? "▲" : "▼") : ""}</i></button></th>`).join("")}</tr></thead>`;
    const body = list.map(p => `<tr class="${selP.has(p.id) ? "sel" : ""}${p.id === cur && akte ? " cur" : ""}${p.death ? " dead" : ""}" data-act="dtprow" data-id="${p.id}" draggable="true">${cs.map(c => pCell(c[0], p)).join("")}</tr>`).join("");
    const table = list.length ? `<table class="dtgrid">${head}<tbody>${body}</tbody></table>` : `<div class="dtempty">${S.people.length ? (q ? "Niemand gefunden." : "In dieser Ansicht ist niemand.") : "Noch keine Kontakte. Oben auf „Neuer Kontakt“ oder eine vCard-Datei einfach ins Fenster ziehen."}</div>`;
    let det = "";
    if (P.det) {
      if (selP.size > 1) det = multiPHTML();
      else if (akte && S.people.some(p => p.id === cur)) det = `<div class="dtakte">${origAkte()}</div>`;
      else det = `<div class="dtnone">${I.all.replace(/16/g, "40")}<p>Kontakt auswählen</p><small>Mit Strg oder Umschalt mehrere auswählen. Kontakte lassen sich auf eine Gruppe links ziehen.</small></div>`;
    }
    void ids;
    return `<div class="dtview">${tb}<div class="dtbody">
      <section class="dtpane dtlist" data-k="pl" aria-label="Kontaktliste">${table}</section>
      ${P.det ? `<div class="dtsplit" data-split="1" role="separator" aria-orientation="vertical" title="Ziehen, um die Breite zu ändern"></div><aside class="dtpane dtdetail" data-k="pd" aria-label="Kontakt-Akte">${det}</aside>` : ""}
    </div></div>`;
  }
  function multiPHTML() {
    const ps = S.people.filter(p => selP.has(p.id));
    return `<div class="dtmulti"><h3>${pl(ps.length, "Kontakt", "Kontakte")} ausgewählt</h3>
      <div class="dtavs">${ps.slice(0, 18).map(p => `<span title="${esc(fullName(p))}">${avHTML(p)}</span>`).join("")}${ps.length > 18 ? `<span class="more">+${ps.length - 18}</span>` : ""}</div>
      <label class="dtfld"><span>Gruppe für alle</span><select data-dt="mgroup"><option value="__">Gruppe wählen …</option><option value="">keine Gruppe</option>${S.groups.map(g => `<option>${esc(g)}</option>`).join("")}</select></label>
      <label class="dtfld"><span>Anruf-Rhythmus für alle</span><select data-dt="mcyc"><option value="__">Rhythmus wählen …</option>${CYCLES.map(c => `<option value="${esc(c)}">${esc(cycLabel(c))}</option>`).join("")}</select></label>
      <div class="dtbtns"><button class="dtb" data-act="dtparch">${I.arch}<span>${cf === "arch" ? "Zurückholen" : "Archivieren"}</span></button><button class="dtb" data-act="dtdel">${I.trash}<span>Löschen</span></button><button class="dtb" data-act="dtselnone">Auswahl aufheben</button></div>
      <p class="dthint">Tipp: Ausgewählte Kontakte links auf eine Gruppe oder ins Archiv ziehen.</p></div>`;
  }
  const selPeople = () => S.people.filter(p => selP.has(p.id));
  function setPGroup(ps, g) { ps.forEach(p => { p.group = g; if (g && !S.groups.includes(g)) S.groups.push(g); }); lastMsg = `${pl(ps.length, "Kontakt", "Kontakte")} → ${g || "ohne Gruppe"}`; save(); render(true); origToast(lastMsg + " · Strg+Z macht es rückgängig"); }
  function setPCyc(ps, c) { ps = ps.filter(p => !p.death); if (!ps.length) return; ps.forEach(p => { p.cyc = c; }); lastMsg = `${pl(ps.length, "Kontakt", "Kontakte")}: ${cycLabel(c)}`; save(); render(true); origToast(lastMsg); }
  function archP(ps) {
    if (!ps.length) return;
    const back = ps.every(p => p.arch);
    if (back) { ps.forEach(p => { delete p.arch; p.streakBase = failStreak(p); }); lastMsg = `${pl(ps.length, "Kontakt", "Kontakte")} zurückgeholt`; }
    else {
      if (!ask(`${ps.length === 1 ? fullName(ps[0]) : pl(ps.length, "Kontakt", "Kontakte")} archivieren? Mirella erinnert dann nicht mehr an Anrufe und Geburtstage. Notizen und Verlauf bleiben, du kannst jederzeit zurückholen.`)) return;
      ps.forEach(p => { p.arch = today(); }); lastMsg = `${pl(ps.length, "Kontakt", "Kontakte")} archiviert`;
    }
    selP.clear(); save(); if (view === "akte") view = "menschen"; render(true); origToast(lastMsg);
  }
  function delP(ps) {
    if (!ps.length) return;
    if (!ask(ps.length === 1 ? `${fullName(ps[0])} wirklich löschen? Notizen und Anrufverlauf gehen mit.` : `${ps.length} Kontakte wirklich löschen? Notizen und Anrufverlauf gehen mit.`)) return;
    ps.forEach(p => dropPerson(p)); selP.clear(); draftClear(); lastMsg = `${pl(ps.length, "Kontakt", "Kontakte")} gelöscht`; save(); closeSheet(); view = "menschen"; render(true); origToast(lastMsg + " · Strg+Z holt zurück");
  }
  function pickP(id, e) {
    const list = pRows().map(p => p.id);
    if (e && (e.ctrlKey || e.metaKey)) { selP.has(id) ? selP.delete(id) : selP.add(id); anchorP = id; }
    else if (e && e.shiftKey && anchorP && list.includes(anchorP)) { const a = list.indexOf(anchorP), b = list.indexOf(id); selP.clear(); list.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(x => selP.add(x)); }
    else { selP.clear(); selP.add(id); anchorP = id; }
    if (selP.has(id)) { cur = id; view = "akte"; } else if (!selP.size) view = "menschen";
    render(true); scrollSel();
  }

  /* ================================================================
     To-dos: gruppierte Liste mit Detailbereich (Eigenschaften direkt änderbar)
     ================================================================ */
  let curT = null, anchorT = null, showDoneT = false;
  const selT = new Set();
  const nextMonday = () => { const d = D(today()), k = ((8 - d.getDay()) % 7) || 7; return addDays(today(), k); };
  function tGroups() {
    const t = today(), tm = addDays(t, 1), wk = addDays(t, 7), ql = q.trim().toLowerCase();
    const open = S.todos.filter(x => x.list === "todo" && !x.done && (!ql || (x.t + " " + (x.note || "")).toLowerCase().includes(ql)));
    const by = (a, b) => ((a.date || "9999") + (a.time || "99")).localeCompare((b.date || "9999") + (b.time || "99")) || byPrio(a, b);
    const G = [
      ["late", "Überfällig", open.filter(x => x.date && x.date < t), null],
      ["today", "Heute", open.filter(x => x.date === t), t],
      ["tm", "Morgen", open.filter(x => x.date === tm), tm],
      ["week", "Nächste 7 Tage", open.filter(x => x.date > tm && x.date <= wk), null],
      ["later", "Später", open.filter(x => x.date > wk), nextMonday()],
      ["nodate", "Ohne Datum", open.filter(x => !x.date), ""]
    ].map(g => (g[2].sort(by), g));
    const done = S.todos.filter(x => x.list === "todo" && x.done && (!ql || x.t.toLowerCase().includes(ql))).sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || ""));
    return { G, done };
  }
  const tOrder = () => { const { G, done } = tGroups(); return G.flatMap(g => g[2]).concat(showDoneT ? done.slice(0, 200) : []).map(x => x.id); };
  function tRow(x) {
    const pr = prioOf(x), A = x.area && areaById(x.area), p = x.pid && S.people.find(y => y.id === x.pid), t = today();
    const dd = x.date ? (x.date === t ? "heute" : x.date === addDays(t, 1) ? "morgen" : fmtDate(x.date)) : "";
    return `<div class="dtt${selT.has(x.id) ? " sel" : ""}${x.done ? " done" : ""}${x.date && x.date < t && !x.done ? " late" : ""}" data-act="dttrow" data-id="${x.id}" draggable="true" role="row">
      <button class="box" role="checkbox" aria-checked="${!!x.done}" aria-label="${esc(x.t)} abhaken" data-act="toggle" data-id="${x.id}"></button>
      ${pr ? `<i class="dtprio" style="--pc:${pr[2]}" title="Priorität ${esc(pr[1])}"></i>` : '<i class="dtprio none"></i>'}
      <span class="tt">${esc(x.t)}${x.note ? ' <small class="mut" title="Hat eine Notiz">✎</small>' : ""}</span>
      <span class="meta">${x.rep && x.rep !== "nie" ? `<span title="Wiederholt ${esc(x.rep)}">↻ ${esc(x.rep)}</span>` : ""}${p ? `<span>${esc(fullName(p))}</span>` : ""}${A ? `<span class="dtarea" style="--ac:${A.c}">${esc(A.n.split(" ")[0])}</span>` : ""}${x.trig === "verlassen" ? "<span>beim Losgehen</span>" : ""}</span>
      <span class="dd">${esc(dd)}${x.time ? " " + esc(x.time) : ""}</span></div>`;
  }
  function todosHTML() {
    const { G, done } = tGroups();
    for (const id of [...selT]) if (!S.todos.some(x => x.id === id)) selT.delete(id);
    if (curT && !S.todos.some(x => x.id === curT)) curT = null;
    const one = selT.size === 1 ? S.todos.find(x => x.id === [...selT][0]) : null;
    const nOpen = G.reduce((a, g) => a + g[2].length, 0);
    const tb = `<div class="dttool" role="toolbar" aria-label="To-dos">
      <button class="dtb pri" data-act="dtnewt" title="Neue Aufgabe mit allen Feldern (N)">${I.plus}<span>Neue Aufgabe</span></button>
      <form class="dtquick" data-form="dtquick"><input id="dtquick" placeholder="Schnell eintippen, z. B. „Steuer abgeben morgen um 9“ und Enter" aria-label="Neue Aufgabe schnell eintragen" autocomplete="off"></form>
      <span class="dtsep"></span>
      <button class="dtb" data-act="dttdone" title="Erledigt (Leertaste)"${selT.size ? "" : " disabled"}>${I.check}<span>Erledigt</span></button>
      <button class="dtb" data-act="dttedit" title="Bearbeiten (F2)"${one ? "" : " disabled"}>${I.pen}<span>Bearbeiten</span></button>
      <button class="dtb" data-act="dtdel" title="Löschen (Entf)"${selT.size ? "" : " disabled"}>${I.trash}</button>
      <label class="dtfind sm">${I.search}<input id="q" type="search" placeholder="Filtern (Strg+F)" aria-label="Aufgaben filtern" value="${esc(q)}" autocomplete="off"></label>
      <button class="dtb ic" data-act="dtdet" aria-pressed="${!!P.det}" title="Detailbereich ein/aus (Strg+I)">${I.panel}</button>
    </div>`;
    const grp = ([k, l, items, drop]) => (items.length || drop != null) ? `<div class="dttg${items.length ? "" : " empty"}"${drop != null ? ` data-drop="d:${drop}"` : ""}><div class="dttgh"><b>${l}</b><span>${items.length || ""}</span>${drop != null && !items.length ? '<small>hierher ziehen</small>' : ""}</div>${items.map(tRow).join("")}</div>` : "";
    const list = `${G.map(grp).join("")}
      ${done.length ? `<div class="dttg"><button class="dttgh dtfold" data-act="dtdone" aria-expanded="${showDoneT}"><b>Erledigt</b><span>${done.length}</span><small>${showDoneT ? "ausblenden" : "anzeigen"}</small></button>${showDoneT ? done.slice(0, 200).map(tRow).join("") : ""}</div>` : ""}
      ${!nOpen && !done.length ? `<div class="dtempty">Keine Aufgaben. Oben schnell eintippen oder auf „Neue Aufgabe“.</div>` : ""}`;
    let det = "";
    if (P.det) {
      if (selT.size > 1) det = `<div class="dtmulti"><h3>${pl(selT.size, "Aufgabe", "Aufgaben")} ausgewählt</h3>
        <div class="dtbtns col"><button class="dtb" data-act="dttdone">${I.check}<span>Alle erledigt</span></button><button class="dtb" data-act="dttmove" data-d="${today()}">Auf heute</button><button class="dtb" data-act="dttmove" data-d="${addDays(today(), 1)}">Auf morgen</button><button class="dtb" data-act="dttmove" data-d="${nextMonday()}">Auf nächsten Montag</button><button class="dtb" data-act="dtdel">${I.trash}<span>Löschen</span></button><button class="dtb" data-act="dtselnone">Auswahl aufheben</button></div>
        <p class="dthint">Tipp: Aufgaben auf „Heute“, „Morgen“ oder „Ohne Datum“ ziehen, oder links auf einen Bereich.</p></div>`;
      else if (one) det = tDetail(one);
      else det = `<div class="dtnone">${I.check.replace(/16/g, "40")}<p>Aufgabe auswählen</p><small>Doppelklick öffnet alle Felder. Rechtsklick zeigt mehr.</small></div>`;
    }
    return `<div class="dtview">${tb}<div class="dtbody">
      <section class="dtpane dttodos" data-k="tl" aria-label="Aufgaben">${list}</section>
      ${P.det ? `<div class="dtsplit" data-split="1" role="separator" aria-orientation="vertical"></div><aside class="dtpane dtdetail" data-k="td" aria-label="Aufgabe">${det}</aside>` : ""}
    </div></div>`;
  }
  function tDetail(x) {
    const p = x.pid && S.people.find(y => y.id === x.pid), docs = S.docs.filter(d => d.ref === x.id);
    return `<div class="dtinsp" data-id="${x.id}">
      <div class="dtinsph"><button class="box" role="checkbox" aria-checked="${!!x.done}" aria-label="Erledigt" data-act="toggle" data-id="${x.id}"></button><textarea class="dttitle" data-dt="t" rows="2" aria-label="Aufgabe">${esc(x.t)}</textarea></div>
      <div class="dtgrid2">
        <label class="dtfld"><span>Datum</span><input type="date" data-dt="date" value="${esc(x.date || "")}"></label>
        <label class="dtfld"><span>Uhrzeit</span><input type="time" data-dt="time" value="${esc(x.time || "")}"></label>
        <label class="dtfld"><span>Priorität</span><select data-dt="prio"><option value="">keine</option>${PRIOS.map(([v, l]) => `<option value="${v}"${+x.prio === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="dtfld"><span>Wiederholen</span><select data-dt="rep">${REPS.map(r => `<option${r === (x.rep || "nie") ? " selected" : ""}>${r}</option>`).join("")}</select></label>
        <label class="dtfld wide"><span>Bereich</span><select data-dt="area"><option value="">kein Bereich</option>${AREAS.map(a => `<option value="${a.id}"${a.id === x.area ? " selected" : ""}>${esc(a.n)}</option>`).join("")}</select></label>
      </div>
      <label class="dtchk"><input type="checkbox" data-dt="nerv"${x.nerv ? " checked" : ""}><span>Nerv-Modus (meldet sich, bis es erledigt ist)</span></label>
      ${p ? `<div class="dtfld"><span>Person</span><button class="dtlink" data-act="person" data-id="${p.id}">${avHTML(p)} ${esc(fullName(p))}</button></div>` : ""}
      ${x.ort ? `<div class="dtfld"><span>Ort</span><div>${esc(x.ort)}</div></div>` : ""}
      <label class="dtfld"><span>Notiz und Links</span><textarea data-dt="note" rows="6" placeholder="Notiz …">${esc(x.note || "")}</textarea></label>
      ${docs.length ? `<div class="dtfld"><span>Anhänge</span>${docs.map(docRow).join("")}</div>` : ""}
      <div class="dtbtns"><button class="dtb" data-act="dttedit">${I.pen}<span>Alle Felder …</span></button><button class="dtb" data-act="dtdel">${I.trash}<span>Löschen</span></button></div>
      <p class="dthint">Änderungen hier werden sofort gespeichert. Angelegt ${esc(fmtDate(x.created || today()))}${x.done && x.doneAt ? ", erledigt " + esc(fmtDate(x.doneAt)) : ""}.</p></div>`;
  }
  function pickT(id, e) {
    const list = tOrder();
    if (e && (e.ctrlKey || e.metaKey)) { selT.has(id) ? selT.delete(id) : selT.add(id); anchorT = id; }
    else if (e && e.shiftKey && anchorT && list.includes(anchorT)) { const a = list.indexOf(anchorT), b = list.indexOf(id); selT.clear(); list.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(x => selT.add(x)); }
    else { selT.clear(); selT.add(id); anchorT = id; }
    curT = selT.has(id) ? id : null;
    render(true); scrollSel();
  }
  const selTodos = () => S.todos.filter(x => selT.has(x.id));
  function moveT(ts, d) { if (!ts.length) return; ts.forEach(x => { x.date = d; if (!d) x.time = ""; }); lastMsg = `${pl(ts.length, "Aufgabe", "Aufgaben")} ${d ? "auf " + relDate(d) : "ohne Datum"}`; save(); render(true); origToast(lastMsg); }
  function doneT(ts) { ts.filter(x => !x.done).forEach(x => toggleTodo(x.id)); }
  function delT(ts) {
    if (!ts.length) return;
    if (!ask(ts.length === 1 ? `„${ts[0].t}“ löschen?` : `${ts.length} Aufgaben löschen?`)) return;
    const ids = new Set(ts.map(x => x.id)); S.todos = S.todos.filter(x => !ids.has(x.id)); selT.clear(); curT = null;
    lastMsg = `${pl(ts.length, "Aufgabe", "Aufgaben")} gelöscht`; save(); render(true); origToast(lastMsg + " · Strg+Z holt zurück");
  }

  /* ================================================================
     Heute als Übersicht in Kacheln, Einkauf und Kalender
     ================================================================ */
  const origMenschen = R.menschen, origAkte = R.akte, origTodos = R.todos, origHeute = R.heute, origKal = R.kalender;
  R.menschen = function () { return on ? contactsHTML(false) : origMenschen.apply(this, arguments); };
  R.akte = function () {
    if (!on) return origAkte.apply(this, arguments);
    const p = S.people.find(x => x.id === cur); if (!p) { view = "menschen"; return contactsHTML(false); }
    if (!selP.has(cur)) { selP.clear(); selP.add(cur); anchorP = cur; }
    if (!pRows().some(x => x.id === cur)) { cf = p.arch ? "arch" : "all"; q = ""; }
    return contactsHTML(true);
  };
  R.todos = function () {
    if (!on || shopMode) return origTodos.apply(this, arguments);
    if (todoList !== "einkauf") return todosHTML();
    const top = topbar("To-dos"), b = origTodos.apply(this, arguments).replace(top, "").replace(todoSeg(true), "");
    return `<div class="dtview"><div class="dttool" role="toolbar" aria-label="Einkauf"><b class="dttitle2">${I.cart} Einkaufsliste</b><span class="dtgrow"></span><button class="dtb" data-act="savetpl" title="Liste als Vorlage speichern">Als Vorlage speichern</button></div><div class="dtbody"><section class="dtpane dtsingle" data-k="sh"><div class="dtnarrow">${b}</div></section></div></div>`;
  };
  R.heute = function () {
    if (!on) return origHeute.apply(this, arguments);
    return `<div class="dtview"><div class="dtbody"><section class="dtpane dtsingle" data-k="hd"><div class="dtdash">${origHeute.apply(this, arguments)}</div></section></div></div>`;
  };
  R.kalender = function () {
    if (!on) return origKal.apply(this, arguments);
    const k = origKal.apply(this, arguments).replace(topbar("Kalender"), "");
    return `<div class="dtview"><div class="dttool" role="toolbar" aria-label="Kalender"><button class="dtb pri" data-act="newtodo" data-d="${esc(selDate)}" title="Neuer Eintrag am ausgewählten Tag (N)">${I.plus}<span>Neuer Eintrag</span></button><span class="dtsep"></span><button class="dtb" data-act="mptoday">Heute</button><span class="dtgrow"></span><span class="dthint" style="margin:0">Aufgaben lassen sich im Monat auf einen anderen Tag ziehen.</span></div><div class="dtbody"><section class="dtpane dtcal" data-k="cl" data-cv="${esc(calView)}">${k}</section></div></div>`;
  };
  /* Heute: Abschnitte als Kacheln nebeneinander (wie ein Dashboard) */
  function dashCards() {
    const box = $("#screen .dtdash"); if (!box) return;
    const kids = [...box.children]; let head = document.createElement("div"); head.className = "dthead";
    const cols = document.createElement("div"); cols.className = "dtcols";
    let card = null;
    for (const el of kids) {
      if (el.classList.contains("top")) { el.remove(); continue; }
      if (el.classList.contains("sec")) { card = document.createElement("section"); card.className = "dtcard"; cols.appendChild(card); }
      (card || head).appendChild(el);
    }
    box.innerHTML = ""; box.appendChild(head); box.appendChild(cols);
  }
  /* Monat: Einträge im Tag, Aufgaben ziehbar; der gewählte Tag steht rechts daneben */
  function calDecorate() {
    const pane = $("#screen .dtcal"); if (!pane) return;
    if (calView === "monat") {
      const n = new Date(calY, calM + 1, 0).getDate();
      const ev = eventsRange(iso(new Date(calY, calM, 1, 12)), iso(new Date(calY, calM, n, 12)));
      for (const b of $$("#screen .mc[data-d]")) {
        b.dataset.drop = "d:" + b.dataset.d;
        const e = ev[b.dataset.d] || []; if (!e.length) continue;
        const box = document.createElement("span"); box.className = "mcev";
        box.innerHTML = e.slice(0, 4).map(x => `<i class="ev-${x.c}"${x.act === "edittodo" ? ` draggable="true" data-tid="${esc(x.id)}" title="Ziehen, um den Tag zu ändern"` : ""}>${esc((x.time ? x.time + " " : "") + x.t)}</i>`).join("") + (e.length > 4 ? `<i class="more">+ ${e.length - 4} weitere</i>` : "");
        b.appendChild(box);
      }
      const mg = pane.querySelector(".mg"); if (!mg) return;
      const side = document.createElement("aside"); side.className = "dtcalside";
      let x = mg.nextElementSibling; while (x) { const nx = x.nextElementSibling; side.appendChild(x); x = nx; }
      const wrap = document.createElement("div"); wrap.className = "dtcalwrap";
      mg.parentNode.insertBefore(wrap, mg); wrap.appendChild(mg); wrap.appendChild(side);
    }
  }

  /* ================================================================
     Menüleiste, Seitenleiste, Statusleiste
     ================================================================ */
  const MODS = [["heute", "Heute", IC.sun, "1"], ["menschen", "Kontakte", IC.people, "2"], ["todos", "To-dos", IC.check, "3"], ["einkauf", "Einkauf", I.cart, "4"], ["kalender", "Kalender", IC.cal, "5"]];
  const modOf = () => view === "akte" || view === "menschen" ? "menschen" : view === "todos" ? (todoList === "einkauf" ? "einkauf" : "todos") : view;
  function goMod(m) {
    if (shopMode) { shopMode = false; wakeLock(false); }
    closeAll(); setFrom = null; q = "";
    if (m === "einkauf") { todoList = "einkauf"; view = "todos"; }
    else if (m === "todos") { todoList = "todo"; view = "todos"; }
    else if (m === "menschen") { view = selP.size === 1 && S.people.some(p => p.id === [...selP][0]) ? (cur = [...selP][0], "akte") : "menschen"; }
    else if (m === "kalender") { if (view !== "kalender") { calView = S.settings.calStart || "monat"; selDate = today(); calY = +selDate.slice(0, 4); calM = +selDate.slice(5, 7) - 1; } view = "kalender"; }
    else view = m;
    render();
  }
  function counts() {
    const t = today();
    return {
      heute: callsForToday().length + S.todos.filter(x => x.list === "todo" && !x.done && x.date && x.date <= t).length,
      menschen: S.people.filter(p => !p.arch).length,
      todos: S.todos.filter(x => x.list === "todo" && !x.done).length,
      einkauf: S.todos.filter(x => x.list === "einkauf" && !x.done && !x.arch).length
    };
  }
  function navHTML() {
    const m = modOf(), c = counts(), fold = k => !!P.fold[k];
    const grpN = g => S.people.filter(p => !p.arch && p.group === g).length;
    const inC = view === "menschen" || view === "akte";
    const item = (act, extra, ic, label, n, curOn, drop) => `<button class="dtnavi${curOn ? " on" : ""}" data-act="${act}" ${extra}${drop ? ` data-drop="${esc(drop)}"` : ""}${curOn ? ' aria-current="true"' : ""}><span class="ic">${ic}</span><span class="l">${esc(label)}</span>${n ? `<span class="n">${n}</span>` : ""}</button>`;
    const sec = (k, label, body) => `<div class="dtnavsec"><button class="dtnavh" data-act="dtfold" data-k="${k}" aria-expanded="${!fold(k)}"><span class="cv">${I.chev}</span>${label}</button>${fold(k) ? "" : `<div class="dtnavb">${body}</div>`}</div>`;
    const grps = S.groups.filter(g => grpN(g) || S.people.some(p => p.group === g));
    return `<div class="dtnavs">
      <div class="dtnavmods">${MODS.map(([k, l, ic, key]) => item("dtmod", `data-m="${k}" title="${l} (Strg+${key})"`, ic, l, k === "kalender" ? "" : c[k] || "", m === k, null)).join("")}</div>
      ${sec("kontakte", "Kontakte", CF().map(([k, l, ic, t]) => item("dtcf", `data-cf="${k}"`, ic, l, S.people.filter(t).length || "", inC && cf === k, null)).join("")
        + grps.map(g => item("dtcf", `data-cf="g:${esc(g)}"`, I.group, g, grpN(g) || "", inC && cf === "g:" + g, "g:" + g)).join("")
        + item("dtcf", 'data-cf="nogrp"', I.none, "Ohne Gruppe", S.people.filter(p => !p.arch && !p.group).length || "", inC && cf === "nogrp", "g:")
        + item("dtcf", 'data-cf="arch"', I.arch, "Archiv", S.people.filter(p => p.arch).length || "", inC && cf === "arch", "arch")
        + `<button class="dtnavi add" data-act="dtnewgrp"><span class="ic">${I.plus}</span><span class="l">Neue Gruppe …</span></button>`)}
      ${sec("bereiche", "Bereiche", AREAS.map(A => { const n = S.todos.filter(t => t.area === A.id && !t.done && t.list === "todo").length; return item("area", `data-id="${A.id}"`, `<span class="aic" style="--ac:${A.c}">${IC[A.ic]}</span>`, A.n, n || "", view === "bereich" && area === A.id, "a:" + A.id); }).join(""))}
      ${sec("mehr", "Mehr", item("go", 'data-v="briefings"', IC.doku, "Briefings", S.briefings.filter(b => !b.read).length || "", view === "briefings", null)
        + item("wxdrawer", "", IC.cloud, "Wetter", "", view === "wetter", null)
        + (R.auswertungen ? item("go", 'data-v="auswertungen"', I.star, "Auswertungen", "", view === "auswertungen", null) : ""))}
    </div>
    <div class="dtnavfoot">${installEvt ? `<button class="dtb pri" data-act="dtinstall" style="width:100%;justify-content:center">Als Windows-App installieren</button>` : ""}${item("go", 'data-v="einstellungen" title="Einstellungen (Strg+,)"', IC.gear, "Einstellungen", "", view === "einstellungen", null)}</div>`;
  }
  /* Menüs: [Text, Kürzel, Aktion, aktiv?, Haken?] – "-" ist ein Trennstrich */
  function MENUS() {
    const inC = view === "menschen" || view === "akte", inT = view === "todos" && todoList === "todo";
    const hasSel = (inC && selP.size) || (inT && selT.size);
    const one = (inC && selP.size === 1) || (inT && selT.size === 1);
    return [
      ["Datei", [
        ["Neuer Kontakt", "N", () => personForm(null)],
        ["Neue Aufgabe", "", () => todoForm(null)],
        ["Auf die Einkaufsliste …", "", () => { goMod("einkauf"); setTimeout(() => { const i = $("#shopin"); i && i.focus(); }, 30); }],
        ["Mit Sprache eingeben", "Strg+M", () => $("#mic").click()],
        "-",
        ["Kontakte importieren (vCard) …", "", () => ACT.importvcf()],
        ["Sicherung speichern …", "", () => ACT.export()],
        ["Sicherung laden …", "", () => ACT.import()],
        "-",
        ["Jetzt abgleichen", "Strg+S", () => { if (typeof sync === "function") sync(true); }, typeof syOn === "function" && syOn()],
        ["Drucken …", "Strg+P", () => window.print()],
        ...(installEvt ? ["-", ["Als Windows-App installieren", "", () => ACT.dtinstall()]] : [])
      ]],
      ["Bearbeiten", [
        ["Rückgängig", "Strg+Z", undo, UNDO.length > 0],
        ["Wiederholen", "Strg+Y", redo, REDO.length > 0],
        "-",
        ["Bearbeiten", "F2", () => ACT.dtedit(), !!one],
        ["Löschen", "Entf", () => ACT.dtdel(), !!hasSel],
        "-",
        ["Alles auswählen", "Strg+A", selectAll, inC || inT],
        ["Auswahl aufheben", "Esc", () => ACT.dtselnone(), !!hasSel],
        "-",
        ["Filtern", "Strg+F", focusFind, inC || view === "todos"],
        ["Suchen und Befehle", "Strg+K", palette]
      ]],
      ["Ansicht", [
        ...MODS.map(([k, l, , key]) => [l, "Strg+" + key, () => goMod(k), true, modOf() === k]),
        "-",
        ["Seitenleiste", "Strg+B", () => { P.nav = P.nav ? 0 : 1; pSave(); shell(); }, true, !!P.nav],
        ["Detailbereich", "Strg+I", () => ACT.dtdet(), true, !!P.det],
        ...(view === "todos" && todoList === "todo" ? [["Erledigte zeigen", "", () => ACT.dtdone(), true, showDoneT]] : []),
        ...(view === "kalender" ? ["-", ...[["tag", "Tag"], ["woche", "Woche"], ["monat", "Monat"], ["liste", "Liste"]].map(([v, l]) => ["Kalender: " + l, "", () => { calView = v; render(); }, true, calView === v])] : [])
      ]],
      ["Gehe zu", [
        ...AREAS.map(A => [A.n, "", () => { area = A.id; view = "bereich"; closeAll(); render(); }]),
        "-",
        ["Briefings", "", () => ACT.go({ dataset: { v: "briefings" } })],
        ["Wetter", "", () => ACT.wxdrawer && ACT.wxdrawer()],
        "-",
        ["Einstellungen", "Strg+,", () => ACT.go({ dataset: { v: "einstellungen" } })]
      ]],
      ["Hilfe", [
        ["Tastenkürzel", "?", keysSheet],
        ["Fragen und Hilfe", "", () => ACT.search()],
        "-",
        ["Über Mirella", "", about]
      ]]
    ];
  }
  function menubarHTML() {
    return `<div class="dtlogo"><img src="./logo-final.svg" alt=""><b>Mirella</b></div>
      <nav class="dtmenus" role="menubar" aria-label="Menü">${MENUS().map(([l], i) => `<button class="dtm" role="menuitem" aria-haspopup="true" data-mi="${i}">${l}</button>`).join("")}</nav>
      <button class="dtcmd" data-act="dtpal" title="Suchen und Befehle (Strg+K)">${I.search}<span>Suchen oder Befehl eingeben …</span><kbd>Strg K</kbd></button>
      <span class="dtgrow"></span>
      <span class="dtmicslot"></span>`;
  }
  function statusHTML() {
    let mid = "";
    const v = modOf();
    if (v === "menschen") { const n = pRows().length; mid = `${esc(cfLabel())}: ${pl(n, "Kontakt", "Kontakte")}${selP.size > 1 ? ` · ${selP.size} ausgewählt` : ""}`; }
    else if (v === "todos") { const n = S.todos.filter(x => x.list === "todo" && !x.done).length; mid = `${pl(n, "offene Aufgabe", "offene Aufgaben")}${selT.size > 1 ? ` · ${selT.size} ausgewählt` : ""}`; }
    else if (v === "einkauf") mid = `${pl(counts().einkauf, "Artikel", "Artikel")} auf der Liste`;
    else if (v === "kalender") mid = `${selDate ? esc(fmtDate(selDate)) : ""}`;
    const sy = typeof syOn === "function" && syOn() ? (SY.status || "Angemeldet") : "Nur auf diesem Gerät";
    return `<span class="dtsy${typeof SY !== "undefined" && SY.busy ? " busy" : ""}"><i></i>${esc(sy)}</span><span class="dtmid">${mid}</span><span class="dtgrow"></span>${UNDO.length ? '<span class="dtund">Strg+Z: Rückgängig</span>' : ""}<span>Mirella ${esc(VERSION)}</span>`;
  }
  function el(id, tag, cls) {
    let x = document.getElementById(id);
    if (!x) { x = document.createElement(tag); x.id = id; x.className = cls; $("#phone").insertBefore(x, $("#phone").firstChild); }
    return x;
  }
  const micHome = () => { const mic = $("#mic"), bar = $(".tabbar"); if (mic && bar && !bar.contains(mic)) bar.insertBefore(mic, bar.children[2]); };
  function shell() {
    root.classList.toggle("dtnonav", !P.nav);
    const mb = el("dtmenu", "header", "dtmenubar");
    if (!mb.dataset.built) { micHome(); mb.innerHTML = menubarHTML(); mb.dataset.built = "1"; mb.querySelector(".dtmicslot").appendChild($("#mic")); }
    const nav = el("dtnav", "aside", "dtnav"); nav.setAttribute("aria-label", "Seitenleiste");
    const st = (nav.querySelector(".dtnavs") || {}).scrollTop || 0;
    nav.innerHTML = navHTML();
    const s2 = nav.querySelector(".dtnavs"); if (s2) s2.scrollTop = st;
    const sb = el("dtstatus", "footer", "dtstatus"); sb.innerHTML = statusHTML();
    const t = { heute: "Heute", menschen: "Kontakte", todos: "To-dos", einkauf: "Einkauf", kalender: "Kalender", einstellungen: "Einstellungen", briefings: "Briefings", bereich: (areaById(area) || {}).n || "Bereich" }[modOf()];
    document.title = (view === "akte" && S.people.find(p => p.id === cur) ? fullName(S.people.find(p => p.id === cur)) + " – " : "") + (t ? t + " – " : "") + "Mirella";
  }
  function unshell() {
    micHome();
    ["dtmenu", "dtnav", "dtstatus"].forEach(id => { const x = document.getElementById(id); if (x) x.remove(); });
    closeMenu(); closeCtx(); const pl0 = document.getElementById("dtpal"); if (pl0) pl0.remove();
    document.title = "Mirella";
  }

  /* ---------- Aufklapp-Menüs ---------- */
  let menuIdx = -1;
  function openMenu(i) {
    closeCtx(); const M = MENUS()[i]; if (!M) return;
    const btn = document.querySelector(`.dtm[data-mi="${i}"]`); if (!btn) return;
    closeMenu(); menuIdx = i; btn.classList.add("open");
    const r = btn.getBoundingClientRect();
    popup(M[1], r.left, r.bottom + 2, "dtdrop");
  }
  function closeMenu() { menuIdx = -1; document.querySelectorAll(".dtm.open").forEach(b => b.classList.remove("open")); document.querySelectorAll(".dtpop.dtdrop").forEach(x => x.remove()); }
  /* Gemeinsam für Menüleiste und Rechtsklick: Liste mit Untermenüs (▸) */
  function popup(items, x, y, cls, parent) {
    const box = document.createElement("div"); box.className = "dtpop " + (cls || ""); box.setAttribute("role", "menu");
    const acts = [];
    box.innerHTML = items.map(it => {
      if (it === "-") return '<div class="dtpsep" role="separator"></div>';
      const [l, k, fn, en = true, chk] = it, i = acts.push(it) - 1, sub = Array.isArray(fn);
      return `<button class="dtpi${sub ? " sub" : ""}" role="menuitem${chk != null ? "checkbox" : ""}" data-i="${i}"${en ? "" : " disabled"}${chk != null ? ` aria-checked="${!!chk}"` : ""}><span class="ck">${chk ? "✓" : ""}</span><span class="l">${esc(l)}</span><span class="k">${sub ? "▸" : esc(k || "")}</span></button>`;
    }).join("");
    document.body.appendChild(box);
    const w = box.offsetWidth, h = box.offsetHeight;
    box.style.left = Math.max(4, Math.min(x, innerWidth - w - 6)) + "px";
    box.style.top = Math.max(4, Math.min(y, innerHeight - h - 6)) + "px";
    box.addEventListener("click", e => {
      const b = e.target.closest(".dtpi"); if (!b || b.disabled) return;
      const it = acts[+b.dataset.i]; if (Array.isArray(it[2])) return;
      closeMenu(); closeCtx(); it[2]();
    });
    box.addEventListener("mouseover", e => {
      const b = e.target.closest(".dtpi"); if (!b) return;
      box.querySelectorAll(".dtpi.hov").forEach(x => x.classList.remove("hov")); b.classList.add("hov");
      document.querySelectorAll(".dtpop").forEach(p => { if (p !== box && p.dataset.parent === (box.dataset.id || "")) p.remove(); });
      const it = acts[+b.dataset.i];
      if (it && Array.isArray(it[2]) && !b.disabled) { const r = b.getBoundingClientRect(); const s = popup(it[2], r.right - 2, r.top - 5, cls + " dtsub", box); s.dataset.parent = box.dataset.id; }
    });
    box.dataset.id = Math.random().toString(36).slice(2);
    if (!parent) setTimeout(() => { const f = box.querySelector(".dtpi:not([disabled])"); if (f && cls.includes("dtdrop") === false) f.classList.add("hov"); }, 0);
    return box;
  }
  function popKeys(e) {
    const boxes = [...document.querySelectorAll(".dtpop")]; if (!boxes.length) return false;
    const box = boxes[boxes.length - 1], items = [...box.querySelectorAll(".dtpi:not([disabled])")];
    let i = items.findIndex(x => x.classList.contains("hov"));
    const mark = j => { items.forEach(x => x.classList.remove("hov")); const t = items[(j + items.length) % items.length]; if (t) { t.classList.add("hov"); t.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); } };
    if (e.key === "ArrowDown") { mark(i + 1); return true; }
    if (e.key === "ArrowUp") { mark(i < 0 ? items.length - 1 : i - 1); return true; }
    if (e.key === "ArrowRight") { if (i >= 0 && items[i].classList.contains("sub")) { const s = document.querySelectorAll(".dtpop"); const last = s[s.length - 1]; if (last !== box) { const f = last.querySelector(".dtpi:not([disabled])"); f && f.classList.add("hov"); } } else if (menuIdx >= 0) openMenu((menuIdx + 1) % MENUS().length); return true; }
    if (e.key === "ArrowLeft") { if (box.classList.contains("dtsub")) box.remove(); else if (menuIdx >= 0) openMenu((menuIdx + MENUS().length - 1) % MENUS().length); return true; }
    if (e.key === "Enter" || e.key === " ") { if (i >= 0) items[i].click(); return true; }
    if (e.key === "Escape") { closeMenu(); closeCtx(); return true; }
    return false;
  }

  /* ---------- Rechtsklick ---------- */
  function closeCtx() { ctxOpen = null; document.querySelectorAll(".dtpop.dtctx").forEach(x => x.remove()); }
  function ctxPerson(id) {
    if (!selP.has(id)) { selP.clear(); selP.add(id); anchorP = id; cur = id; view = "akte"; render(true); }
    const ps = selPeople(), p = ps.length === 1 ? ps[0] : null, arch = ps.every(x => x.arch);
    const grpItems = [["keine Gruppe", "", () => setPGroup(ps, ""), true, ps.every(x => !x.group)], "-", ...S.groups.map(g => [g, "", () => setPGroup(ps, g), true, ps.every(x => x.group === g)]), "-", ["Neue Gruppe …", "", () => { const g = (prompt("Name der neuen Gruppe") || "").trim(); if (g) setPGroup(ps, g); }]];
    const cycItems = CYCLES.map(c => [cycLabel(c), "", () => setPCyc(ps, c), true, ps.every(x => (x.cyc || "nie") === c)]);
    const items = p ? [
      ["Anrufen", "", () => ACT.call({ dataset: { id: p.id } }, { stopPropagation() { } }), !!p.tel],
      ["Anruf eintragen …", "", () => callResult(p, false)],
      ...(p.tel ? [["WhatsApp öffnen", "", () => window.open("https://wa.me/" + waNum(p.tel), "_blank", "noopener")]] : []),
      ...(p.email ? [["E-Mail schreiben", "", () => { location.href = "mailto:" + p.email; }]] : []),
      "-",
      ["Bearbeiten …", "F2", () => personForm(p)],
      ["Profilbild …", "", () => ACT.avpick({ dataset: { id: p.id } })],
      ["Gruppe", "", grpItems],
      ["Anruf-Rhythmus", "", cycItems],
      "-",
      [arch ? "Aus dem Archiv zurückholen" : "Archivieren …", "", () => archP(ps)],
      ["Löschen …", "Entf", () => delP(ps)]
    ] : [
      ["Gruppe", "", grpItems],
      ["Anruf-Rhythmus", "", cycItems],
      "-",
      [arch ? "Alle zurückholen" : `${ps.length} archivieren …`, "", () => archP(ps)],
      [`${ps.length} löschen …`, "Entf", () => delP(ps)]
    ];
    return items;
  }
  function ctxTodo(id) {
    if (!selT.has(id)) { selT.clear(); selT.add(id); anchorT = id; curT = id; render(true); }
    const ts = selTodos(), x = ts.length === 1 ? ts[0] : null, t = today();
    return [
      [x && x.done ? "Wieder offen" : "Erledigt", "Leertaste", () => x && x.done ? toggleTodo(x.id) : doneT(ts)],
      ...(x ? [["Bearbeiten …", "F2", () => todoForm(x)]] : []),
      "-",
      ["Verschieben", "", [["Heute", "", () => moveT(ts, t)], ["Morgen", "", () => moveT(ts, addDays(t, 1))], ["Übermorgen", "", () => moveT(ts, addDays(t, 2))], ["Nächsten Montag", "", () => moveT(ts, nextMonday())], ["In einem Monat", "", () => moveT(ts, addMonths(t, 1))], "-", ["Ohne Datum", "", () => moveT(ts, "")]]],
      ["Priorität", "", [...PRIOS.map(([v, l]) => [l, "", () => { ts.forEach(y => { y.prio = v; }); lastMsg = "Priorität " + l; save(); render(true); }, true, ts.every(y => +y.prio === v)]), ["keine", "", () => { ts.forEach(y => { y.prio = ""; }); save(); render(true); }, true, ts.every(y => !y.prio)]]],
      ["Bereich", "", [["kein Bereich", "", () => { ts.forEach(y => { y.area = ""; }); save(); render(true); }, true, ts.every(y => !y.area)], "-", ...AREAS.map(A => [A.n, "", () => { ts.forEach(y => { y.area = A.id; }); lastMsg = "Bereich " + A.n; save(); render(true); }, true, ts.every(y => y.area === A.id)])]],
      "-",
      [ts.length > 1 ? `${ts.length} löschen …` : "Löschen …", "Entf", () => delT(ts)]
    ];
  }
  document.addEventListener("contextmenu", e => {
    if (!on || root.classList.contains("zlocked")) return;
    if (e.target.closest("input,textarea,select,a[href]")) return; // dort das normale Menü (Kopieren, Einfügen …)
    const pr = e.target.closest("[data-act=dtprow]"), tr = e.target.closest("[data-act=dttrow]"), day = e.target.closest(".mc[data-d]"), ng = e.target.closest(".dtnavi[data-cf^='g:']");
    let items = null;
    if (pr) items = ctxPerson(pr.dataset.id);
    else if (tr) items = ctxTodo(tr.dataset.id);
    else if (day) { const d = day.dataset.d; items = [["Neuer Eintrag am " + fmtDate(d), "", () => todoForm(null, { date: d })], ["Tagesansicht", "", () => { selDate = d; calView = "tag"; render(); }]]; }
    else if (ng) { const g = ng.dataset.cf.slice(2); items = [["Gruppe anzeigen", "", () => ng.click()], ["Umbenennen …", "", () => renameGroup(g)]]; }
    if (!items) return;
    e.preventDefault(); closeMenu(); closeCtx();
    ctxOpen = popup(items, e.clientX, e.clientY, "dtctx");
  });
  function renameGroup(g) {
    const n = (prompt(`Neuer Name für die Gruppe „${g}“`, g) || "").trim(); if (!n || n === g) return;
    S.people.forEach(p => { if (p.group === g) p.group = n; });
    S.groups = [...new Set(S.groups.map(x => x === g ? n : x))];
    if (cf === "g:" + g) cf = "g:" + n; lastMsg = `Gruppe umbenannt: ${n}`; save(); render(true); origToast(lastMsg);
  }

  /* ---------- Ziehen und Ablegen ---------- */
  let drag = null;
  document.addEventListener("dragstart", e => {
    if (!on) return;
    const pr = e.target.closest && e.target.closest("[data-act=dtprow]"), tr = e.target.closest && e.target.closest("[data-act=dttrow]"), ev = e.target.closest && e.target.closest("[data-tid]");
    if (pr) { const id = pr.dataset.id; const ids = selP.has(id) ? [...selP] : [id]; drag = { k: "p", ids }; }
    else if (tr) { const id = tr.dataset.id; const ids = selT.has(id) ? [...selT] : [id]; drag = { k: "t", ids }; }
    else if (ev) drag = { k: "t", ids: [ev.dataset.tid] };
    else return;
    e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", drag.k + ":" + drag.ids.join(","));
    const n = drag.ids.length, lab = document.createElement("div"); lab.className = "dtdraglab";
    lab.textContent = drag.k === "p" ? (n === 1 ? fullName(S.people.find(p => p.id === drag.ids[0]) || {}) : n + " Kontakte") : (n === 1 ? (S.todos.find(x => x.id === drag.ids[0]) || {}).t : n + " Aufgaben");
    document.body.appendChild(lab); e.dataTransfer.setDragImage(lab, 10, 10); setTimeout(() => lab.remove(), 0);
    root.classList.add("dtdragging", "dtdrag-" + drag.k);
  });
  const dragClear = () => { drag = null; root.classList.remove("dtdragging", "dtdrag-p", "dtdrag-t"); document.querySelectorAll(".dropon").forEach(x => x.classList.remove("dropon")); };
  document.addEventListener("dragend", dragClear);
  const dropOk = (t) => { if (!drag || !t) return false; const d = t.dataset.drop; return drag.k === "p" ? (d.startsWith("g:") || d === "arch") : (d.startsWith("d:") || d.startsWith("a:")); };
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
    const t = e.target.closest && e.target.closest("[data-drop]"); if (!dropOk(t)) return;
    e.preventDefault(); const d = t.dataset.drop, ids = drag.ids, kind = drag.k; dragClear(); drag = { k: kind, ids };
    if (drag.k === "p") {
      const ps = S.people.filter(p => ids.includes(p.id));
      if (d === "arch") { if (ps.every(p => p.arch)) return; selP.clear(); ps.forEach(p => selP.add(p.id)); archP(ps.filter(p => !p.arch)); }
      else setPGroup(ps, d.slice(2));
    } else {
      const ts = S.todos.filter(x => ids.includes(x.id));
      if (d.startsWith("d:")) moveT(ts, d.slice(2));
      else { const A = areaById(d.slice(2)); ts.forEach(x => { x.area = A.id; }); lastMsg = `${pl(ts.length, "Aufgabe", "Aufgaben")} → ${A.n}`; save(); render(true); origToast(lastMsg); }
    }
    drag = null;
  });
  /* Dateien ins Fenster ziehen: vCard → Kontakte, Sicherung (.json) → laden, Bild/PDF → Dokument erkennen */
  let fhT = null;
  function fileHint(show) {
    let h = document.getElementById("dtfilehint");
    if (show) { if (!h) { h = document.createElement("div"); h.id = "dtfilehint"; h.innerHTML = `<div><b>Loslassen zum Übernehmen</b><span>vCard (.vcf) → Kontakte · Bild oder PDF → als Dokument erkennen · Sicherung (.json) → laden</span></div>`; document.body.appendChild(h); } clearTimeout(fhT); fhT = setTimeout(() => fileHint(false), 300); }
    else if (h) h.remove();
  }
  function feed(id, files) { const inp = document.getElementById(id); if (!inp) return; const dt = new DataTransfer(); files.forEach(f => dt.items.add(f)); inp.files = dt.files; inp.dispatchEvent(new Event("change", { bubbles: true })); }
  function dropFiles(files) {
    const f = files[0], n = (f.name || "").toLowerCase();
    if (/\.vcf$/.test(n) || /vcard/.test(f.type)) return feed("f-vcf", [f]);
    if (/\.json$/.test(n)) { if (ask("Diese Sicherung laden? Mirella fragt danach noch einmal nach, bevor etwas ersetzt wird.")) feed("f-import", [f]); return; }
    if (/^image\//.test(f.type) || /\.pdf$/.test(n) || f.type === "application/pdf") {
      if ((view === "akte") && /^image\//.test(f.type) && S.people.some(p => p.id === cur) && ask(`Als Profilbild für ${fullName(S.people.find(p => p.id === cur))} nehmen?`)) { avFor = cur; return feed("f-avatar", [f]); }
      return /\.pdf$/.test(n) || f.type === "application/pdf" ? feed("f-doc", [f]) : feed("f-lib", [f]);
    }
    toast("Diese Datei kenne ich nicht. Geht: vCard, Bild, PDF oder Mirella-Sicherung.");
  }

  /* ---------- Befehlssuche (Strg+K) ---------- */
  function palette(pre) {
    closeMenu(); closeCtx();
    let box = document.getElementById("dtpal"); if (box) box.remove();
    box = document.createElement("div"); box.id = "dtpal"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Suchen und Befehle");
    box.innerHTML = `<div class="dtpalbox"><div class="dtpalin">${I.search}<input id="dtpalq" placeholder="Kontakt, Aufgabe oder Befehl … (z. B. „neue Aufgabe“, „Anna“, „Archiv“)" autocomplete="off" spellcheck="false"></div><div class="dtpallist" role="listbox"></div><div class="dtpalfoot"><span><kbd>↑</kbd><kbd>↓</kbd> wählen</span><span><kbd>Enter</kbd> öffnen</span><span><kbd>Esc</kbd> schließen</span></div></div>`;
    document.body.appendChild(box);
    const inp = box.querySelector("#dtpalq"), lst = box.querySelector(".dtpallist");
    let res = [], sel = 0;
    const cmds = [];
    MENUS().forEach(([m, items]) => items.forEach(it => { if (it === "-" || Array.isArray(it[2]) || it[3] === false) return; cmds.push({ g: "Befehle", l: it[0], s: m + (it[1] ? " · " + it[1] : ""), f: it[2] }); }));
    const go = r => { box.remove(); r.f(); };
    const draw = () => {
      const v = inp.value.trim().toLowerCase();
      res = [];
      const hit = s => !v || s.toLowerCase().includes(v) || (v.length > 2 && fuzzyHas(s, v));
      const ps = S.people.filter(p => v && hit(fullName(p) + " " + (p.nick || "") + " " + (p.group || "") + " " + (p.tel || ""))).slice(0, 8).map(p => ({ g: "Kontakte", l: fullName(p), s: [p.group, p.tel, p.arch ? "Archiv" : ""].filter(Boolean).join(" · "), av: avHTML(p), f: () => { closeAll(); cur = p.id; view = "akte"; render(); scrollSel(); } }));
      const ts = S.todos.filter(x => v && x.list === "todo" && hit(x.t)).sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0)).slice(0, 6).map(x => ({ g: "Aufgaben", l: x.t, s: (x.done ? "erledigt" : x.date ? relDate(x.date) : "ohne Datum"), f: () => { closeAll(); todoList = "todo"; view = "todos"; q = ""; if (x.done) showDoneT = true; selT.clear(); selT.add(x.id); curT = x.id; render(); scrollSel(); } }));
      const cs = cmds.filter(c => hit(c.l + " " + c.s)).slice(0, v ? 8 : 14);
      res = [...ps, ...ts, ...cs];
      if (v) res.push({ g: "Mehr", l: `Überall suchen nach „${inp.value.trim()}“`, s: "Notizen, Bereiche, Dokumente, Hilfe", f: () => searchOpen(inp.value.trim()) });
      sel = Math.min(sel, Math.max(0, res.length - 1));
      let lastG = "";
      lst.innerHTML = res.map((r, i) => { const h = r.g !== lastG ? `<div class="dtpalg">${r.g}</div>` : ""; lastG = r.g; return h + `<button class="dtpalr${i === sel ? " on" : ""}" data-i="${i}" role="option" aria-selected="${i === sel}">${r.av || ""}<span><b>${esc(r.l)}</b><small>${esc(r.s || "")}</small></span></button>`; }).join("") || '<div class="dtempty">Nichts gefunden</div>';
    };
    inp.addEventListener("input", () => { sel = 0; draw(); });
    inp.addEventListener("keydown", e => {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(res.length - 1, sel + 1); draw(); lst.querySelector(".on")?.scrollIntoView({ block: "nearest" }); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); lst.querySelector(".on")?.scrollIntoView({ block: "nearest" }); }
      else if (e.key === "Enter") { e.preventDefault(); if (res[sel]) go(res[sel]); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); box.remove(); }
    });
    lst.addEventListener("click", e => { const b = e.target.closest(".dtpalr"); if (b) go(res[+b.dataset.i]); });
    box.addEventListener("mousedown", e => { if (e.target === box) box.remove(); });
    if (pre) inp.value = pre;
    draw(); inp.focus();
    loadThumbs();
  }

  /* ---------- Hilfen ---------- */
  function keysSheet() {
    const K = [["Strg + K", "Suchen und Befehle"], ["Strg + 1 … 5", "Heute, Kontakte, To-dos, Einkauf, Kalender"], ["N", "Neu anlegen (passend zur Ansicht)"], ["Strg + M", "Mit Sprache eingeben"], ["Strg + F", "Liste filtern"], ["↑ ↓", "In der Liste wandern (mit Umschalt: mehrere wählen)"], ["Strg / Umschalt + Klick", "Mehrere auswählen"], ["Strg + A", "Alles auswählen"], ["F2 oder Enter", "Bearbeiten"], ["Entf", "Löschen (mit Nachfrage)"], ["Leertaste", "Aufgabe erledigt"], ["Strg + Z / Strg + Y", "Rückgängig / Wiederholen"], ["Strg + S", "Jetzt abgleichen"], ["Strg + B / Strg + I", "Seitenleiste / Detailbereich ein/aus"], ["Strg + Enter", "Im offenen Fenster speichern"], ["Esc", "Schließen, Auswahl aufheben"], ["Rechtsklick", "Mehr Möglichkeiten an Kontakt, Aufgabe, Tag, Gruppe"], ["Ziehen", "Kontakte auf Gruppen/Archiv, Aufgaben auf Tage/Bereiche, Dateien ins Fenster"]];
    openSheet(`<p class="stitle">Tastenkürzel und Tricks</p><div class="dtkeys">${K.map(([k, t]) => `<div><kbd>${esc(k)}</kbd><span>${esc(t)}</span></div>`).join("")}</div><div class="row2"><button class="btn pri" data-close="sheet">Schließen</button></div>`);
  }
  function about() {
    openSheet(`<p class="stitle">Über Mirella</p><p style="margin:0 0 10px">Mirella ${esc(VERSION)} · Programm-Ansicht für den Computer.</p><p class="hint" style="margin:0 0 12px">Läuft im Browser und lässt sich als Windows-App installieren (Datei › Als Windows-App installieren). Updates kommen von allein, Daten gleichen sich mit iPhone und iPad ab.</p><div class="row2"><button class="btn pri" data-close="sheet">Schließen</button></div>`);
  }
  function focusFind() { const i = $("#q"); if (i) { i.focus(); i.select(); } else palette(); }
  function selectAll() {
    if (view === "menschen" || view === "akte") { pRows().forEach(p => selP.add(p.id)); if (selP.size === 1) { cur = [...selP][0]; view = "akte"; } render(true); }
    else if (view === "todos" && todoList === "todo") { tOrder().forEach(id => selT.add(id)); render(true); }
  }
  function scrollSel() { requestAnimationFrame(() => { const r = $("#screen .dtgrid tr.sel, #screen .dtt.sel"); if (r) r.scrollIntoView({ block: "nearest" }); }); }

  /* ---------- Aktionen ---------- */
  Object.assign(ACT, {
    dtmod: el => goMod(el.dataset.m),
    dtcf: el => { cf = el.dataset.cf; q = ""; selP.clear(); closeAll(); view = "menschen"; render(); },
    dtfold: el => { P.fold[el.dataset.k] = !P.fold[el.dataset.k]; pSave(); shell(); },
    dtnewgrp: () => { const g = (prompt("Name der neuen Gruppe, z. B. Paddeln") || "").trim(); if (!g) return; if (!S.groups.includes(g)) S.groups.push(g); lastMsg = "Neue Gruppe: " + g; save(); cf = "g:" + g; view = "menschen"; render(); origToast(lastMsg + ". Kontakte einfach hierher ziehen."); },
    dtprow: (el, e) => { if (e && e.target.closest && e.target.closest("button,a,input,select")) return; pickP(el.dataset.id, e); },
    dttrow: (el, e) => { if (e && e.target.closest && e.target.closest("button,a,input,select,textarea")) return; pickT(el.dataset.id, e); },
    dtsort: el => { const k = el.dataset.k; if (sortK === k) sortDir = -sortDir; else { sortK = k; sortDir = 1; } render(true); },
    dtnewp: () => personForm(null),
    dtnewt: () => todoForm(null),
    dtpcall: () => { const p = selPeople()[0]; if (p) ACT.call({ dataset: { id: p.id } }, { stopPropagation() { } }); },
    dtplog: () => { const p = selPeople()[0]; if (p) callResult(p, false); },
    dtpedit: () => { const p = selPeople()[0]; if (p) personForm(p); },
    dtparch: () => archP(selPeople()),
    dttdone: () => doneT(selTodos()),
    dttedit: () => { const x = selTodos()[0] || S.todos.find(y => y.id === curT); if (x) todoForm(x); },
    dttmove: el => moveT(selTodos(), el.dataset.d),
    dtdone: () => { showDoneT = !showDoneT; render(true); },
    dtedit: () => { if (view === "menschen" || view === "akte") ACT.dtpedit(); else if (view === "todos") ACT.dttedit(); },
    dtdel: () => { if (view === "menschen" || view === "akte") delP(selPeople()); else if (view === "todos" && todoList === "todo") delT(selTodos()); },
    dtselnone: () => { if (view === "menschen" || view === "akte") { selP.clear(); view = "menschen"; } else { selT.clear(); curT = null; } render(true); },
    dtdet: () => { P.det = P.det ? 0 : 1; pSave(); render(true); },
    dtpal: () => palette(),
    dtinstall: async () => { if (!installEvt) return; const e = installEvt; installEvt = null; try { e.prompt(); const r = await e.userChoice; if (r && r.outcome === "accepted") toast("Mirella ist jetzt als App auf dem PC"); } catch (_) { } shell(); }
  });

  /* Schnell-Eingabe für Aufgaben: „Steuer abgeben morgen um 9“ */
  document.addEventListener("submit", e => {
    const f = e.target; if (!on || f.dataset.form !== "dtquick") return;
    e.preventDefault(); e.stopImmediatePropagation();
    const v = ($("#dtquick").value || "").trim(); if (!v) return;
    const w = parseWhen(v), t = cap((w.rest || v).trim()) || v;
    const x = { id: uid(), t, list: "todo", done: false, created: today(), date: w.trig === "verlassen" ? "" : w.date, time: w.trig === "verlassen" ? "" : w.time, trig: w.trig || "zeit", rep: "nie", area: "", nerv: false, prio: "", ort: "", note: "" };
    S.todos.push(x); selT.clear(); selT.add(x.id); curT = x.id; lastMsg = "Neue Aufgabe: " + t;
    save(); render(true); origToast(`Eingetragen: ${t}${x.date ? " · " + relDate(x.date) : ""}${x.time ? " " + x.time : ""}`);
    const i = $("#dtquick"); if (i) i.focus(); scrollSel();
  }, true);
  /* Detailbereich der Aufgabe: Änderungen sofort speichern */
  document.addEventListener("change", e => {
    const t = e.target; if (!on || !t.dataset || !t.dataset.dt) return;
    const k = t.dataset.dt;
    if (k === "mgroup" || k === "mcyc") { if (t.value === "__") return; const ps = selPeople(); if (!ask(`${pl(ps.length, "Kontakt bekommt", "Kontakte bekommen")} ${k === "mgroup" ? (t.value ? "die Gruppe „" + t.value + "“" : "keine Gruppe") : "den Rhythmus „" + cycLabel(t.value) + "“"}. Einverstanden?`)) { t.value = "__"; return; } return k === "mgroup" ? setPGroup(ps, t.value) : setPCyc(ps, t.value); }
    const box = t.closest(".dtinsp"); if (!box) return;
    const x = S.todos.find(y => y.id === box.dataset.id); if (!x) return;
    if (k === "t") { const v = t.value.trim(); if (!v) { t.value = x.t; return; } x.t = v; }
    else if (k === "nerv") x.nerv = t.checked;
    else if (k === "prio") x.prio = t.value ? +t.value : "";
    else if (k === "rep") { x.rep = t.value; if (x.rep !== "nie" && !x.date) x.date = today(); }
    else x[k] = t.value;
    lastMsg = "Gespeichert: " + x.t; save(); render(true);
  });
  document.addEventListener("keydown", e => { if (on && e.key === "Enter" && !e.shiftKey && e.target.classList && e.target.classList.contains("dttitle")) { e.preventDefault(); e.target.blur(); } });

  /* ---------- Splitter: Breite des Detailbereichs ziehen ---------- */
  document.addEventListener("pointerdown", e => {
    const s = e.target.closest && e.target.closest(".dtsplit"); if (!on || !s) return;
    e.preventDefault(); s.setPointerCapture(e.pointerId); root.classList.add("dtresizing");
    const body = s.parentNode, r = body.getBoundingClientRect();
    const mv = ev => { P.dw = Math.round(Math.max(320, Math.min(r.width - 380, r.right - ev.clientX))); $("#screen").style.setProperty("--dtdw", P.dw + "px"); };
    const up = () => { s.removeEventListener("pointermove", mv); s.removeEventListener("pointerup", up); root.classList.remove("dtresizing"); pSave(); };
    s.addEventListener("pointermove", mv); s.addEventListener("pointerup", up);
  });
  document.addEventListener("dblclick", e => {
    if (!on) return;
    if (e.target.closest(".dtsplit")) { P.dw = 440; pSave(); $("#screen").style.setProperty("--dtdw", "440px"); return; }
    if (e.target.closest("button,a,input,select,textarea")) return;
    const pr = e.target.closest("[data-act=dtprow]"), tr = e.target.closest("[data-act=dttrow]");
    if (pr) { const p = S.people.find(x => x.id === pr.dataset.id); if (p) personForm(p); }
    else if (tr) { const x = S.todos.find(y => y.id === tr.dataset.id); if (x) todoForm(x); }
  });

  /* ---------- Menüleiste bedienen ---------- */
  document.addEventListener("mousedown", e => {
    if (!on) return;
    const m = e.target.closest && e.target.closest(".dtm");
    if (m) { e.preventDefault(); const i = +m.dataset.mi; if (menuIdx === i) closeMenu(); else openMenu(i); return; }
    if (!(e.target.closest && e.target.closest(".dtpop"))) { closeMenu(); closeCtx(); }
  }, true);
  document.addEventListener("mouseover", e => { if (!on || menuIdx < 0) return; const m = e.target.closest && e.target.closest(".dtm"); if (m && +m.dataset.mi !== menuIdx) openMenu(+m.dataset.mi); });
  window.addEventListener("blur", () => { closeMenu(); closeCtx(); });
  window.addEventListener("resize", () => { closeMenu(); closeCtx(); });

  /* ---------- Tastatur ---------- */
  const typing = t => t && t.closest && t.closest("input,textarea,select,[contenteditable=true]");
  document.addEventListener("keydown", e => {
    if (!on || root.classList.contains("zlocked")) return;
    if (document.querySelector(".dtpop") && popKeys(e)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (document.getElementById("dtpal")) return;
    const sheetOpen = $("#sheet").classList.contains("open"), ctrl = e.ctrlKey || e.metaKey, k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (ctrl && k === "Enter" && sheetOpen) { const b = [...$$("#sheetbody .btn.pri")].filter(x => x.offsetParent).pop(); if (b) { e.preventDefault(); b.click(); } return; }
    if (ctrl && !e.altKey) {
      const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
      if (k === "k") { stop(); palette(); return; }
      if (k === "s") { stop(); if (typeof sync === "function" && syOn()) sync(true); else toast("Nur auf diesem Gerät gespeichert. Abgleich: Einstellungen › Konto."); return; }
      if (k === ",") { stop(); ACT.go({ dataset: { v: "einstellungen" } }); return; }
      if (sheetOpen) return;
      if (/^[1-5]$/.test(k)) { stop(); goMod(MODS[+k - 1][0]); return; }
      if (k === "b") { stop(); P.nav = P.nav ? 0 : 1; pSave(); shell(); return; }
      if (k === "i") { stop(); ACT.dtdet(); return; }
      if (k === "m") { stop(); $("#mic").click(); return; }
      if (k === "f") { stop(); focusFind(); return; }
      if (typing(e.target)) return;
      if (k === "z" && !e.shiftKey) { stop(); undo(); return; }
      if (k === "y" || (k === "z" && e.shiftKey)) { stop(); redo(); return; }
      if (k === "a" && (view === "menschen" || view === "akte" || (view === "todos" && todoList === "todo"))) { stop(); selectAll(); return; }
      return;
    }
    if (e.altKey || typing(e.target) || sheetOpen || document.querySelector(".pdfview,.zv,.imgfull,#zgate")) return;
    const inC = view === "menschen" || view === "akte", inT = view === "todos" && todoList === "todo";
    if (k === "Escape") { if ((inC && selP.size) || (inT && selT.size)) { e.stopImmediatePropagation(); ACT.dtselnone(); } return; }
    if (k === "?") { e.preventDefault(); keysSheet(); return; }
    if (k === "/") { e.preventDefault(); palette(); return; }
    if (k === "n") { e.preventDefault(); if (inC) personForm(null); else if (view === "todos" && todoList === "einkauf") { const i = $("#shopin"); i && i.focus(); } else if (view === "kalender") todoForm(null, { date: selDate }); else if (inT) { const i = $("#dtquick"); i ? i.focus() : todoForm(null); } else plusAction(); return; }
    if (k === "F2" || (k === "Enter" && (inC ? selP.size === 1 : inT && selT.size === 1))) { e.preventDefault(); ACT.dtedit(); return; }
    if (k === "Delete") { if ((inC && selP.size) || (inT && selT.size)) { e.preventDefault(); ACT.dtdel(); } return; }
    if (k === " " && inT && selT.size) { e.preventDefault(); const ts = selTodos(); if (ts.length === 1 && ts[0].done) toggleTodo(ts[0].id); else doneT(ts); return; }
    if ((k === "ArrowDown" || k === "ArrowUp") && (inC || inT)) {
      e.preventDefault();
      const list = inC ? pRows().map(p => p.id) : tOrder(); if (!list.length) return;
      const now = inC ? (view === "akte" ? cur : null) : curT, i = list.indexOf(now);
      const j = i < 0 ? (k === "ArrowDown" ? 0 : list.length - 1) : Math.max(0, Math.min(list.length - 1, i + (k === "ArrowDown" ? 1 : -1)));
      const id = list[j];
      if (inC) { if (e.shiftKey) { selP.add(id); } else { selP.clear(); selP.add(id); anchorP = id; } cur = id; view = "akte"; }
      else { if (e.shiftKey) selT.add(id); else { selT.clear(); selT.add(id); anchorT = id; } curT = id; }
      render(true); scrollSel();
    }
  }, true);
  /* Pfeil runter im Filterfeld springt in die Liste */
  document.addEventListener("keydown", e => { if (on && e.key === "ArrowDown" && e.target.id === "q") { e.target.blur(); } });

  /* ---------- Rendern ---------- */
  const origRender = render;
  render = function (keepScroll) {
    if (!on) return origRender.apply(this, arguments);
    const panes = {}; $$("#screen .dtpane[data-k]").forEach(p => { panes[p.dataset.k] = p.scrollTop; });
    const sameView = lastView === view + "|" + todoList;
    const r = origRender.apply(this, arguments);
    const sc = $("#screen"); sc.dataset.view = view; sc.dataset.mod = modOf(); sc.style.setProperty("--dtdw", P.dw + "px");
    sc.classList.toggle("dtpanes", !!sc.querySelector(":scope > .dtview"));
    if (view === "heute") dashCards();
    if (view === "kalender") calDecorate();
    if (sameView || keepScroll) $$("#screen .dtpane[data-k]").forEach(p => { if (panes[p.dataset.k] != null) p.scrollTop = panes[p.dataset.k]; });
    lastView = view + "|" + todoList;
    shell();
    return r;
  };
  /* Abgleich-Status unten links aktuell halten */
  if (typeof syStatus === "function") { const os = syStatus; syStatus = function () { const r = os.apply(this, arguments); if (on) { const sb = document.getElementById("dtstatus"); if (sb) sb.innerHTML = statusHTML(); } return r; }; }

  /* ---------- Einschalten / Ausschalten je nach Fenstergröße ---------- */
  function apply() {
    const want = !!(MQ && MQ.matches);
    if (want === on) return;
    on = want; root.classList.toggle("dt", on);
    if (on) { closeAll(); base = snap(); }
    else { unshell(); const sc = $("#screen"); delete sc.dataset.view; delete sc.dataset.mod; sc.classList.remove("dtpanes"); }
    if (typeof S !== "undefined" && S) render(true);
  }
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; if (on) shell(); });
  window.addEventListener("appinstalled", () => { installEvt = null; if (on) shell(); });
  if (MQ) { if (MQ.addEventListener) MQ.addEventListener("change", apply); else if (MQ.addListener) MQ.addListener(apply); }
  HOOKS.start.push(apply);
})();
