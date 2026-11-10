/* Mirella – Arbeitsversion 0.8 (läuft komplett auf dem Gerät, ohne Server)
   Daten: localStorage "mirella.v1", Fotos: IndexedDB "mirella" / "photos".
   Später ersetzt der Supabase-Sync (v0.7) die lokale Speicherung. */
"use strict";
const VERSION = "0.9.1";
const KEY = "mirella.v1";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- Datum ---------- */
const MN = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const WDL = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const pad = n => String(n).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const D = s => new Date(s + "T12:00:00");
const today = () => iso(new Date());
const addDays = (s, n) => { const d = D(s); d.setDate(d.getDate() + n); return iso(d); };
const addMonths = (s, n) => { const d = D(s), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return iso(d); };
const diffDays = (a, b) => Math.round((D(b) - D(a)) / 864e5);
const addWorkdays = (s, n) => { let d = s; while (n > 0) { d = addDays(d, 1); const w = D(d).getDay(); if (w !== 0 && w !== 6) n--; } return d; };
const fmtDate = s => { if (!s) return ""; const d = D(s); return `${WD[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear() !== new Date().getFullYear() ? d.getFullYear() : ""}`; };
const relDate = s => { const n = diffDays(today(), s); if (n === 0) return "heute"; if (n === 1) return "morgen"; if (n === -1) return "gestern"; if (n > 1 && n < 7) return WDL[D(s).getDay()]; if (n < 0) return `vor ${-n} Tagen`; return fmtDate(s); };
const agoText = s => { if (!s) return "noch nie"; const n = diffDays(s, today()); if (n <= 0) return "heute"; if (n === 1) return "gestern"; if (n < 14) return `vor ${n} Tagen`; if (n < 60) return `vor ${Math.round(n / 7)} Wochen`; if (n < 365) return `vor ${Math.round(n / 30)} Monaten`; const y = Math.floor(n / 365); return y === 1 ? "vor über einem Jahr" : `vor ${y} Jahren`; };
const eur = n => (+n || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

/* ---------- Daten ---------- */
const CYCLES = ["wöchentlich", "alle 2 Wochen", "monatlich", "vierteljährlich", "halbjährlich", "jährlich", "nur Geburtstag"];
const REPS = ["nie", "täglich", "wöchentlich", "alle 2 Wochen", "monatlich", "vierteljährlich", "jährlich"];
const BASECATS = ["Lebensmittel & Supermarkt", "Getränke", "Bäcker & Metzger", "Restaurant & Café", "Tanken & Auto", "Kleidung", "Drogerie & Gesundheit", "Haushalt & Wohnen", "Hobby & Sport", "Freizeit & Ausgehen", "Reisen", "Geschenke", "Technik & Abos", "Sonstiges"];
const catList = () => [...new Set([...BASECATS, ...((S && S.settings.cats) || []), ...((S && S.expenses.map(e => e.cat)) || [])].filter(Boolean))];
const FOLDERS = ["Ausweise", "Wohnen", "Auto", "Gesundheit", "Verträge & Garantien", "Arbeit & Steuer", "Sonstiges"];
const IC = {
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 16V11l2-5h10l2 5v5"/><path d="M3 16h18v3H3zM7 19v2M17 19v2"/><circle cx="7.5" cy="13.5" r="1"/><circle cx="16.5" cy="13.5" r="1"/></svg>',
  geld: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M17 6.5A7 7 0 1 0 17 17.5"/><path d="M4 10h9M4 14h9"/></svg>',
  gesund: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  haus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/></svg>',
  doku: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
  frei: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15.5v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0v5l-8 5v2l8-2.5v5.5l-2.5 2v1.5l4-1 4 1V20l-2.5-2v-5.5z"/></svg>',
  arbeit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/></svg>',
  sport: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6c3 3 3 9.8 0 12.8M18.4 5.6c-3 3-3 9.8 0 12.8"/></svg>',
  cam: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  call: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>'
};
const AREAS = [
  { id: "geld", n: "Finanzen & Verträge", ic: "geld" },
  { id: "doku", n: "Dokumente", ic: "doku" },
  { id: "auto", n: "Auto & E-Bike", ic: "auto" },
  { id: "gesund", n: "Gesundheit", ic: "gesund" },
  { id: "haus", n: "Zuhause", ic: "haus" },
  { id: "frei", n: "Reisen", ic: "frei" },
  { id: "arbeit", n: "Arbeit", ic: "arbeit" },
  { id: "sport", n: "Sport & Hobby", ic: "sport" }
];
const areaById = id => AREAS.find(a => a.id === id);

function blank() {
  return {
    v: 1,
    settings: { name: "Felix", maxCalls: 3, retryWorkdays: 2, giftLead: 14, callFrom: 8, callTo: 18, callWeekdays: true, cats: [], wxName: "", wxLat: null, wxLon: null },
    briefings: [],
    people: [], todos: [], expenses: [], docs: [], notes: [], groups: ["Familie", "Freunde", "Paddeln", "Fußball München", "Stammtisch", "Arbeit"]
  };
}
let S;
function load() {
  try { const raw = localStorage.getItem(KEY); S = raw ? JSON.parse(raw) : blank(); } catch (_) { S = blank(); }
  const b = blank();
  for (const k of Object.keys(b)) if (S[k] == null) S[k] = b[k];
  S.settings = Object.assign(b.settings, S.settings || {});
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); return true; }
  catch (e) { toast("Speichern fehlgeschlagen: Speicher voll?"); return false; }
}

/* ---------- Fotos (IndexedDB) ---------- */
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open("mirella", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("photos");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function photoPut(id, blob) { const d = await db(); return new Promise((res, rej) => { const t = d.transaction("photos", "readwrite"); t.objectStore("photos").put(blob, id); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
async function photoGet(id) { const d = await db(); return new Promise((res, rej) => { const r = d.transaction("photos").objectStore("photos").get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function photoDel(id) { const d = await db(); return new Promise(res => { const t = d.transaction("photos", "readwrite"); t.objectStore("photos").delete(id); t.oncomplete = res; t.onerror = res; }); }
async function photoAll() { const d = await db(); return new Promise((res, rej) => { const out = {}; const r = d.transaction("photos").objectStore("photos").openCursor(); r.onsuccess = () => { const c = r.result; if (c) { out[c.key] = c.value; c.continue(); } else res(out); }; r.onerror = () => rej(r.error); }); }
async function photoClear() { const d = await db(); return new Promise(res => { const t = d.transaction("photos", "readwrite"); t.objectStore("photos").clear(); t.oncomplete = res; t.onerror = res; }); }
function shrink(file, max = 1600, q = 0.78) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob(b => b ? res(b) : rej(new Error("Bild konnte nicht gelesen werden")), "image/jpeg", q);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Bild konnte nicht gelesen werden")); };
    img.src = url;
  });
}
const blobToDataURL = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
const dataURLToBlob = async u => (await fetch(u)).blob();

/* ---------- Menschen ---------- */
const fullName = p => [p.first, p.last].filter(Boolean).join(" ") || "Ohne Namen";
const initials = p => ((p.first || "")[0] || "" + "") .toUpperCase() + ((p.last || "")[0] || "").toUpperCase() || "?";
function lastCall(p, okOnly = true) { const c = (p.calls || []).filter(x => !okOnly || x.ok).sort((a, b) => a.d < b.d ? 1 : -1)[0]; return c ? c.d : null; }
function nextDue(p) {
  if (!p.cyc || p.cyc === "nur Geburtstag") return null;
  const last = lastCall(p);
  let due;
  if (!last) due = (p.created || today()).slice(0, 10);
  else {
    const m = { "wöchentlich": [7, 0], "alle 2 Wochen": [14, 0], "monatlich": [0, 1], "vierteljährlich": [0, 3], "halbjährlich": [0, 6], "jährlich": [0, 12] }[p.cyc] || [0, 1];
    due = m[1] ? addMonths(last, m[1]) : addDays(last, m[0]);
  }
  if (p.snooze && p.snooze > due) due = p.snooze;
  return due;
}
function callState(p) { const d = nextDue(p); if (!d) return "none"; const n = diffDays(today(), d); return n < 0 ? "late" : n === 0 ? "due" : n <= 3 ? "soon" : "ok"; }
function nextBirthday(p) {
  if (!p.bday) return null;
  const [, m, d] = p.bday.split("-").map(Number); if (!m || !d) return null;
  const t = today(), y = +t.slice(0, 4);
  let s = `${y}-${pad(m)}-${pad(d)}`; if (s < t) s = `${y + 1}-${pad(m)}-${pad(d)}`;
  return s;
}
function ageAt(p, dateStr) { const y = +(p.bday || "").slice(0, 4); if (!y || y < 1900) return null; return +dateStr.slice(0, 4) - y; }
function findPersonsIn(text) {
  const t = " " + text.toLowerCase() + " ";
  const hits = [];
  for (const p of S.people) {
    const cands = [fullName(p), p.first, p.nick].filter(x => x && x.length > 1).map(x => x.toLowerCase());
    for (const c of cands) {
      const re = new RegExp("(^|[^a-zäöüß])" + c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(s)?([^a-zäöüß]|$)", "i");
      if (re.test(t)) { hits.push({ p, len: c.length, c }); break; }
    }
  }
  return hits.sort((a, b) => b.len - a.len);
}

/* ---------- Aufgaben ---------- */
function stepRep(date, rep) {
  return { "täglich": addDays(date, 1), "wöchentlich": addDays(date, 7), "alle 2 Wochen": addDays(date, 14), "monatlich": addMonths(date, 1), "vierteljährlich": addMonths(date, 3), "jährlich": addMonths(date, 12) }[rep] || null;
}
function todoMeta(t) {
  const parts = [];
  if (t.trig === "verlassen") parts.push("bevor du losgehst");
  if (t.date) parts.push(relDate(t.date) + (t.time ? ", " + t.time : ""));
  if (t.rep && t.rep !== "nie") parts.push(t.rep);
  if (t.nerv) parts.push("nervt bis erledigt");
  if (t.area) parts.push(areaById(t.area)?.n || "");
  if (t.pid) { const p = S.people.find(x => x.id === t.pid); if (p) parts.push(fullName(p)); }
  if (t.done && t.doneAt) parts.push("erledigt " + relDate(t.doneAt));
  return parts.filter(Boolean).join(" · ");
}
function toggleTodo(id) {
  const t = S.todos.find(x => x.id === id); if (!t) return;
  if (!t.done && t.rep && t.rep !== "nie" && t.date) {
    let n = stepRep(t.date, t.rep); while (n && n <= today()) n = stepRep(n, t.rep);
    t.date = n; save(); render(); toast("Erledigt. Nächstes Mal: " + fmtDate(n)); return;
  }
  t.done = !t.done; t.doneAt = t.done ? today() : null;
  if (t.list === "einkauf" && t.done) t.doneAt = today();
  save(); render();
}

function addShop(t) {
  const k = t.trim().toLowerCase(); if (!k) return false;
  if (S.todos.some(x => x.list === "einkauf" && !x.done && x.t.trim().toLowerCase() === k)) return false;
  S.todos.push({ id: uid(), t: t.trim(), list: "einkauf", done: false, created: today() }); return true;
}
function isoWeek(s) { const d = D(s); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); const w1 = new Date(d.getFullYear(), 0, 4, 12); return 1 + Math.round(((d - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7); }

/* ---------- Zustand ---------- */
let view = "heute", cur = null, area = null, todoList = "todo", calY, calM, selDate, calView = "monat", q = "", showDone = false;
{ const t = new Date(); calY = t.getFullYear(); calM = t.getMonth(); selDate = today(); }

/* ---------- Bausteine ---------- */
function topbar(t) {
  return `<div class="top"><p class="big">${esc(t)}</p><span class="tright"><button class="iconbtn camtop" data-act="photo" aria-label="Foto an Mirella">${IC.cam}</button><button class="brandbtn" data-act="drawer" aria-label="Menü mit allen Bereichen öffnen"><b>Mirella</b><img src="./logo-final.svg" alt=""></button></span></div>`;
}
function subtop(backLabel, backAct, right = "") {
  return `<div class="top"><button class="back" data-act="${backAct}" style="margin:0">‹ ${esc(backLabel)}</button><span class="tright">${right}<button class="brandbtn" data-act="drawer" aria-label="Menü öffnen"><img src="./logo-final.svg" alt=""></button></span></div>`;
}
function pill(st, p) {
  if (st === "late") return '<span class="pill late">überfällig</span>';
  if (st === "due") return '<span class="pill acc">heute</span>';
  if (st === "soon") return '<span class="pill">bald</span>';
  return p ? `<span class="pill">${esc(p.cyc || "")}</span>` : "";
}
function personCard(p, withCall) {
  const st = callState(p), due = nextDue(p);
  const sub = st === "none" ? (p.group || "") : `${p.cyc} · zuletzt ${agoText(lastCall(p))}`;
  return `<div class="card ${withCall ? "due" : ""}" role="button" tabindex="0" data-act="person" data-id="${p.id}"><span class="av">${esc(initials(p))}</span><span style="min-width:0"><div class="t">${esc(fullName(p))}</div><div class="s">${esc(sub)}</div></span>${withCall ? `<button class="call" aria-label="${esc(fullName(p))} anrufen" data-act="call" data-id="${p.id}">${IC.call}</button>` : (st === "none" ? "" : pill(st, p))}</div>`;
}
function todoRow(t) {
  return `<div class="todo ${t.done ? "done" : ""}"><button class="box" role="checkbox" aria-checked="${!!t.done}" aria-label="${esc(t.t)} abhaken" data-act="toggle" data-id="${t.id}"></button><div role="button" tabindex="0" data-act="edittodo" data-id="${t.id}"><div class="tt">${esc(t.t)}</div>${todoMeta(t) ? `<div class="meta">${esc(todoMeta(t))}</div>` : ""}</div>${todoPersonBtn(t)}<button class="del" data-act="deltodo" data-id="${t.id}" aria-label="${esc(t.t)} löschen">✕</button></div>`;
}
function todoPersonBtn(t) {
  const p = t.pid && S.people.find(x => x.id === t.pid); if (!p || t.done) return "";
  if (p.tel && /schreib|nachricht|whatsapp|antwort|melden/i.test(t.t)) return `<a class="mini" href="https://wa.me/${esc(waNum(p.tel))}" style="text-decoration:none;flex:none" aria-label="${esc(p.first)} schreiben">💬</a>`;
  if (p.tel) return `<button class="mini" data-act="call" data-id="${p.id}" style="flex:none" aria-label="${esc(p.first)} anrufen">📞</button>`;
  return `<button class="mini" data-act="person" data-id="${p.id}" style="flex:none">${esc(p.first || "Akte")}</button>`;
}
const empty = t => `<div class="empty">${t}</div>`;

/* ---------- Ansichten ---------- */
const R = {
  heute() {
    const t = today(), d = new Date(), h = d.getHours();
    const greet = h < 11 ? "Guten Morgen" : h < 17 ? "Hallo" : "Guten Abend";
    const dueCalls = S.people.filter(p => ["late", "due"].includes(callState(p))).sort((a, b) => nextDue(a) < nextDue(b) ? -1 : 1);
    const shownCalls = dueCalls.slice(0, S.settings.maxCalls);
    const leave = S.todos.filter(x => x.list === "todo" && !x.done && x.trig === "verlassen");
    const dueTodos = S.todos.filter(x => x.list === "todo" && !x.done && x.trig !== "verlassen" && x.date && x.date <= t).sort((a, b) => (a.date + (a.time || "")) < (b.date + (b.time || "")) ? -1 : 1);
    const bdays = S.people.map(p => [p, nextBirthday(p)]).filter(([, b]) => b && diffDays(t, b) <= S.settings.giftLead).sort((a, b) => a[1] < b[1] ? -1 : 1);
    const docs = S.docs.filter(x => x.until && diffDays(t, x.until) <= 60).sort((a, b) => a.until < b.until ? -1 : 1);
    const shop = S.todos.filter(x => x.list === "einkauf" && !x.done).length;
    const asks = [];
    S.people.forEach(p => (p.ask || []).forEach(a => { if (!a.done) asks.push([p, a]); }));
    const counts = [];
    if (dueCalls.length) counts.push(dueCalls.length === 1 ? "1 Anruf" : dueCalls.length + " Anrufe");
    if (dueTodos.length) counts.push(dueTodos.length === 1 ? "1 Aufgabe" : dueTodos.length + " Aufgaben");
    if (bdays.some(([, b]) => b === t)) counts.push("ein Geburtstag");
    const summary = counts.length ? `Heute stehen ${counts.length > 1 ? counts.slice(0, -1).join(", ") + " und " + counts.slice(-1) : counts[0]} an.` : (S.people.length || S.todos.length ? "Heute ist nichts fällig. Genieß den Tag." : "Leg los: Tipp unten aufs Mikrofon und sag zum Beispiel „Milch auf die Einkaufsliste“.");
    let h2 = `${topbar("Heute")}<div class="date">${WDL[d.getDay()]}, ${d.getDate()}. ${MN[d.getMonth()]} · KW ${isoWeek(t)}</div><p class="big">${greet}, ${esc(S.settings.name || "")}. ${summary}</p>`;
    h2 += `<div id="wx">${wxHTML()}</div>`;
    const br = latestBriefing();
    if (br) h2 += `<div class="sec"><span class="label">Dein Briefing</span><span class="label">${esc(relDate(br.d))}${br.time ? " " + esc(br.time) : ""}</span></div>${briefCard(br)}`;
    if (!S.people.length && !S.todos.length) {
      h2 += `<div class="block"><h4>So fängst du an</h4><ul><li><b>Menschen:</b> unten auf „Menschen“ und dann auf +, oder in den Einstellungen deine Kontakte als vCard importieren.</li><li><b>Sprechen:</b> der runde Knopf unten. Beispiele: „Erinnere mich morgen um 9 an die Steuer“, „Hab mit Tim telefoniert“, „Butter und Eier auf die Einkaufsliste“.</li><li><b>Foto:</b> die Kamera oben rechts, für Belege, Dokumente oder Einkaufszettel.</li><li><b>Wappen</b> oben rechts öffnet alle Bereiche und die Einstellungen.</li></ul></div>`;
    }
    if (leave.length) h2 += `<div class="sec"><span class="label">Bevor du losgehst</span></div><div class="morning">${leave.map(x => `<label class="chk"><input type="checkbox" data-act="toggle" data-id="${x.id}"><span>${esc(x.t)}</span></label>`).join("")}</div>`;
    if (dueCalls.length) h2 += `<div class="sec"><span class="label">Anrufe</span><span class="label">${dueCalls.length} fällig${dueCalls.length > shownCalls.length ? ", heute max. " + S.settings.maxCalls : ""}</span></div>${shownCalls.map(p => personCard(p, true)).join("")}${dueCalls.length > shownCalls.length ? `<button class="mini" data-act="go" data-v="menschen">${dueCalls.length - shownCalls.length} weitere in „Menschen“</button>` : ""}`;
    if (bdays.length) h2 += `<div class="sec"><span class="label">Geburtstage</span></div>${bdays.map(([p, b]) => { const n = diffDays(t, b), age = ageAt(p, b); return `<div class="card ${n === 0 ? "due" : ""}" role="button" tabindex="0" data-act="person" data-id="${p.id}"><span class="av">${esc(initials(p))}</span><span style="min-width:0"><div class="t">${esc(fullName(p))}${age ? ` wird ${age}` : ""}</div><div class="s">${n === 0 ? "heute! Gratulieren" : "in " + n + " Tagen · " + fmtDate(b)}${p.gift && n > 0 ? " · Geschenk besorgen" : ""}</div></span>${n === 0 ? '<span class="pill acc">heute</span>' : p.gift ? '<span class="pill">Geschenk</span>' : ""}</div>`; }).join("")}`;
    if (dueTodos.length) h2 += `<div class="sec"><span class="label">Aufgaben</span><span class="label">${dueTodos.length}</span></div>${dueTodos.map(todoRow).join("")}`;
    if (asks.length) h2 += `<div class="sec"><span class="label">Nachfragen</span></div>${asks.slice(0, 5).map(([p, a]) => `<div class="card" role="button" tabindex="0" data-act="person" data-id="${p.id}"><span class="av">${esc(initials(p))}</span><span style="min-width:0"><div class="t">${esc(fullName(p))}</div><div class="s">${esc(a.t)}</div></span></div>`).join("")}`;
    if (docs.length) h2 += `<div class="sec"><span class="label">Dokumente laufen ab</span></div>${docs.map(x => `<div class="card" role="button" tabindex="0" data-act="area" data-id="doku"><span class="av">${IC.doku}</span><span style="min-width:0"><div class="t">${esc(x.name)}</div><div class="s">gültig bis ${esc(fmtDate(x.until))}</div></span>${x.until < t ? '<span class="pill late">abgelaufen</span>' : '<span class="pill">bald</span>'}</div>`).join("")}`;
    if (shop) h2 += `<div class="sec"><span class="label">Einkaufsliste</span></div><div class="card" role="button" tabindex="0" data-act="shoplist"><span class="av">🛒</span><span><div class="t">${shop} ${shop === 1 ? "Sache" : "Sachen"} offen</div><div class="s">Antippen zum Einkaufen</div></span></div>`;
    return h2;
  },
  menschen() {
    const ql = q.trim().toLowerCase();
    let list = S.people.filter(p => !ql || (fullName(p) + " " + (p.group || "") + " " + (p.nick || "")).toLowerCase().includes(ql));
    const rank = p => { const d = nextDue(p); return d || "9999"; };
    list = list.sort((a, b) => rank(a) < rank(b) ? -1 : rank(a) > rank(b) ? 1 : fullName(a).localeCompare(fullName(b), "de"));
    return `${topbar("Menschen")}<input class="search" id="q" type="search" placeholder="Suchen: Name oder Gruppe" aria-label="Suchen" value="${esc(q)}">
    <div class="sec"><span class="label">Wer zuerst dran ist</span><span class="label">${list.length}</span></div>
    ${list.length ? list.map(p => personCard(p, false)).join("") : empty(S.people.length ? "Niemand gefunden." : "Noch keine Kontakte. Tipp auf +, oder importiere sie in den Einstellungen (vCard).")}`;
  },
  akte() {
    const p = S.people.find(x => x.id === cur); if (!p) { view = "menschen"; return R.menschen(); }
    const st = callState(p), due = nextDue(p), nb = nextBirthday(p);
    const list = (h, k, emptyT, ph) => `<div class="block"><div class="bh"><h4>${h}</h4></div>${(p[k] || []).length ? (p[k]).map(x => `<div class="listrow">${k === "ask" ? `<button class="box" role="checkbox" aria-checked="${!!x.done}" data-act="askdone" data-id="${x.id}" aria-label="erledigt"></button>` : ""}<span class="grow" ${x.done ? 'style="text-decoration:line-through;color:var(--ink-3)"' : ""}>${esc(x.t)}${x.d ? `<small>${esc(fmtDate(x.d))}</small>` : ""}</span><button class="rowdel" data-act="delakte" data-k="${k}" data-id="${x.id}" aria-label="löschen">✕</button></div>`).join("") : `<div class="swipehint" style="text-align:left;margin:0 0 6px">${emptyT}</div>`}<form class="shoprow" data-form="akte" data-k="${k}" style="margin-top:8px"><input class="search" style="margin:0" placeholder="${ph}" aria-label="${h} hinzufügen"><button class="btn pri" style="flex:none">+</button></form></div>`;
    const calls = (p.calls || []).slice().sort((a, b) => a.d < b.d ? 1 : -1);
    return `${subtop("Menschen", "go\" data-v=\"menschen", `<button class="mini" data-act="editperson" data-id="${p.id}">Bearbeiten</button>`)}
    <div class="hero"><span class="av">${esc(initials(p))}</span><h3>${esc(fullName(p))}</h3><p>${esc([p.group, p.cyc].filter(Boolean).join(" · "))}</p>
    ${p.tel ? `<button class="bigcall" data-act="call" data-id="${p.id}">${IC.call} ${esc(p.tel)}</button>` : `<button class="bigcall" data-act="editperson" data-id="${p.id}">Telefonnummer eintragen</button>`}
    <div class="callrow"><button class="mini" data-act="logcall" data-id="${p.id}">Anruf eintragen</button>${p.tel ? `<a class="mini" href="sms:${esc(p.tel.replace(/\s/g, ""))}" style="text-decoration:none">Nachricht</a><a class="mini" href="https://wa.me/${esc(waNum(p.tel))}" style="text-decoration:none">WhatsApp</a>` : ""}${p.email ? `<a class="mini" href="mailto:${esc(p.email)}" style="text-decoration:none">E-Mail</a>` : ""}${st !== "none" ? `<button class="mini" data-act="snooze" data-id="${p.id}">Später</button>` : ""}</div></div>
    ${nextCallBlock(p)}
    ${nb ? `<div class="block"><h4>Geburtstag</h4><div class="catrow"><span>${esc(fmtDate(nb))}${ageAt(p, nb) ? ", wird " + ageAt(p, nb) : ""}</span><span>in ${diffDays(today(), nb)} Tagen</span></div>${p.gift ? `<div class="swipehint" style="text-align:left;margin:6px 0 0">Geschenk-Erinnerung ${S.settings.giftLead} Tage vorher</div>` : ""}</div>` : ""}
    ${list("Offene Nachfragen", "ask", "Nichts offen", "z. B. fragen, wie die Reha läuft")}
    ${list("Notizen", "notes", "Noch keine Notizen", "Neue Notiz")}
    ${list("Geschenkideen", "gifts", "Noch keine Ideen", "z. B. Kochkurs")}
    <div class="block"><h4>Anrufverlauf</h4>${calls.length ? calls.slice(0, 12).map(c => `<div class="listrow"><span class="grow">${esc(fmtDate(c.d))}<small>${c.ok ? "erreicht" : "nicht erreicht"}</small></span><button class="rowdel" data-act="delcall" data-id="${c.id}" aria-label="löschen">✕</button></div>`).join("") : '<div class="swipehint" style="text-align:left;margin:0">Noch kein Anruf eingetragen</div>'}</div>
    ${p.addr || p.email ? `<div class="block"><h4>Kontakt</h4>${p.email ? `<div class="listrow"><span class="grow">${esc(p.email)}<small>E-Mail</small></span></div>` : ""}${p.addr ? `<div class="listrow"><span class="grow">${esc(p.addr)}<small>Adresse</small></span><a class="mini" href="https://maps.apple.com/?q=${encodeURIComponent(p.addr)}" style="text-decoration:none">Karte</a></div>` : ""}</div>` : ""}`;
  },
  todos() {
    const isShop = todoList === "einkauf";
    const all = S.todos.filter(t => t.list === todoList);
    const open = all.filter(t => !t.done).sort((a, b) => ((a.date || "9999") + (a.time || "")) < ((b.date || "9999") + (b.time || "")) ? -1 : 1);
    const done = all.filter(t => t.done).sort((a, b) => (a.doneAt || "") < (b.doneAt || "") ? 1 : -1);
    return `${topbar("To-dos")}<div class="seg"><button data-act="todolist" data-l="todo" aria-pressed="${!isShop}">Aufgaben</button><button data-act="todolist" data-l="einkauf" aria-pressed="${isShop}">Einkaufsliste</button></div>
    ${isShop ? `<form class="shoprow" data-form="shop" style="margin-bottom:8px"><input class="search" id="shopin" style="margin:0" placeholder="Artikel eintippen, z. B. Butter" aria-label="Artikel" enterkeyhint="done"><button class="btn pri" style="flex:none">+</button></form>` : ""}
    ${open.length ? open.map(todoRow).join("") : empty(isShop ? "Die Einkaufsliste ist leer." : "Keine offenen Aufgaben. Neu per + oder per Mikrofon.")}
    ${done.length ? `<div class="sec"><button class="mini" data-act="showdone">${showDone ? "Erledigte ausblenden" : "Erledigte zeigen (" + done.length + ")"}</button>${isShop ? `<button class="mini" data-act="cleardone">Erledigte löschen</button>` : ""}</div>${showDone ? done.slice(0, 50).map(todoRow).join("") : ""}` : ""}`;
  },
  kalender() {
    const nav = `<div class="mnav"><button class="iconbtn" data-act="mstep" data-n="-1" aria-label="Vorheriger Monat">‹</button><p class="big" style="margin:0;font-size:24px;text-align:center">${MN[calM]} ${calY}<small style="display:block;font-family:var(--f-mono);font-size:11px;color:var(--ink-3);font-weight:400">KW ${isoWeek(iso(new Date(calY, calM, 1, 12)))} bis ${isoWeek(iso(new Date(calY, calM + 1, 0, 12)))}</small></p><button class="iconbtn" data-act="mstep" data-n="1" aria-label="Nächster Monat">›</button></div>`;
    const seg = `<div class="seg"><button data-act="calview" data-cv="monat" aria-pressed="${calView === "monat"}">Monat</button><button data-act="calview" data-cv="liste" aria-pressed="${calView === "liste"}">Nächste 60 Tage</button></div>`;
    let body = "";
    if (calView === "monat") {
      const first = new Date(calY, calM, 1), off = (first.getDay() + 6) % 7, n = new Date(calY, calM + 1, 0).getDate();
      const ev = eventsRange(iso(new Date(calY, calM, 1, 12)), iso(new Date(calY, calM, n, 12)));
      body = '<div class="mg kw">' + ["KW", "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(x => `<div class="mh">${x}</div>`).join("");
      if (off) body += `<div class="kwc">${isoWeek(iso(new Date(calY, calM, 1, 12)))}</div>`;
      for (let i = 0; i < off; i++) body += "<div></div>";
      for (let d = 1; d <= n; d++) { const k = iso(new Date(calY, calM, d, 12)), e = ev[k] || []; if ((off + d - 1) % 7 === 0) body += `<div class="kwc">${isoWeek(k)}</div>`; body += `<button class="mc${k === today() ? " today" : ""}${k === selDate ? " sel" : ""}" data-act="selday" data-d="${k}" aria-label="${d}. ${MN[calM]}"><span>${d}</span><span class="dots">${e.slice(0, 3).map(() => "<i></i>").join("")}</span></button>`; }
      body += "</div>";
      const sd = eventsRange(selDate, selDate)[selDate] || [], dd = D(selDate);
      body += `<div class="sec"><span class="label">${WDL[dd.getDay()]}, ${dd.getDate()}. ${MN[dd.getMonth()]} · KW ${isoWeek(selDate)}</span><button class="mini" data-act="newtodo" data-d="${selDate}">+ Eintrag</button></div>` + (sd.length ? sd.map(evRow).join("") : '<div class="ev" style="color:var(--ink-3)">Nichts geplant</div>');
    } else {
      const from = today(), to = addDays(from, 60), ev = eventsRange(from, to);
      const keys = Object.keys(ev).sort();
      let lastW = null;
      body = keys.length ? keys.map(k => { const d = D(k), w = isoWeek(k), wh = w !== lastW ? `<div class="sec"><span class="label">Kalenderwoche ${w}</span></div>` : ""; lastW = w; return wh + `<div class="cal-day"><div class="d">${WD[d.getDay()]}<b>${d.getDate()}</b>${MN[d.getMonth()].slice(0, 3)}</div><div>${ev[k].map(evRow).join("")}</div></div>`; }).join("") : empty("In den nächsten 60 Tagen steht nichts an.");
    }
    return topbar("Kalender") + nav + seg + body + '<p class="swipehint" style="margin-top:14px">Wischen oder Pfeile: anderer Monat · Plus: neuer Eintrag</p>';
  },
  bereich() {
    const A = areaById(area); if (!A) { view = "heute"; return R.heute(); }
    const todos = S.todos.filter(t => t.area === A.id && t.list === "todo" && !t.done);
    const notes = S.notes.filter(n => n.area === A.id).sort((a, b) => a.d < b.d ? 1 : -1);
    const docs = S.docs.filter(d => (A.id === "doku" ? true : d.area === A.id));
    let extra = "";
    if (A.id === "geld") extra = financeHTML();
    if (A.id === "doku") extra = docsHTML();
    return `${subtop("Alle Bereiche", "drawer", `<button class="iconbtn camtop" data-act="photo" data-area="${A.id}" aria-label="Foto an Mirella">${IC.cam}</button>`)}
    <div class="ahero"><span class="av">${IC[A.ic]}</span><div><p class="big" style="margin:0;font-size:24px">${esc(A.n)}</p></div></div>
    ${extra}
    <div class="sec"><span class="label">Steht an</span><button class="mini" data-act="newtodo" data-area="${A.id}">+ Erinnerung</button></div>
    ${todos.length ? todos.map(todoRow).join("") : '<div class="swipehint" style="text-align:left">Nichts offen.</div>'}
    <div class="sec"><span class="label">Notizen und Verlauf</span><span class="label">${notes.length}</span></div>
    <form class="shoprow" data-form="note" style="margin-bottom:6px"><input class="search" style="margin:0" placeholder="${esc(notePh(A.id))}" aria-label="Notiz hinzufügen"><button class="btn pri" style="flex:none">+</button></form>
    ${notes.map(n => `<div class="listrow"><span class="grow">${esc(n.t)}<small>${esc(fmtDate(n.d))}</small></span><button class="rowdel" data-act="delnote" data-id="${n.id}" aria-label="löschen">✕</button></div>`).join("")}
    ${A.id !== "doku" ? `<div class="sec"><span class="label">Fotos und Dokumente</span><span class="label">${docs.length}</span></div>${docs.length ? docs.map(docRow).join("") : '<div class="swipehint" style="text-align:left">Noch nichts abgelegt. Oben auf die Kamera.</div>'}` : ""}`;
  },
  briefings() {
    const list = S.briefings.slice().sort((a, b) => (b.d + (b.time || "")).localeCompare(a.d + (a.time || "")));
    const tw = isoWeek(today()), ty = +today().slice(0, 4), lw = isoWeek(addDays(today(), -7));
    const grp = b => { const w = isoWeek(b.d); if (w === tw && diffDays(b.d, today()) < 7) return "Diese Woche (KW " + w + ")"; if (w === lw && diffDays(b.d, today()) < 14) return "Letzte Woche (KW " + w + ")"; return "KW " + w + " · " + b.d.slice(0, 4); };
    let last = null, body = "";
    for (const b of list) { const g = grp(b); if (g !== last) { body += `<div class="sec"><span class="label">${esc(g)}</span></div>`; last = g; } body += briefCard(b, true); }
    return `${subtop("Alle Bereiche", "drawer")}<p class="big" style="margin:0 0 4px">Briefings</p>
    <button class="btn pri" data-act="addbrief" style="width:100%;margin:8px 0">+ Briefing hinzufügen (PDF)</button>
    <p class="hint">So kommt das Briefing rein: in Gmail das PDF öffnen › Teilen › „In Dateien sichern“, dann hier auf „Briefing hinzufügen“. Mehrere auf einmal gehen auch. Automatisch aus Gmail holen kann Mirella erst mit dem Server.</p>
    ${body || empty("Noch keine Briefings abgelegt.")}`;
  },
  einstellungen() {
    const s = S.settings;
    const sel = (k, label, hint, opts) => `<div class="set"><span>${label}<small>${hint}</small></span><select data-set="${k}">${opts.map(([v, l]) => `<option value="${v}"${String(s[k]) === String(v) ? " selected" : ""}>${l}</option>`).join("")}</select></div>`;
    return `${subtop("Zurück", "go\" data-v=\"heute")}<p class="big">Einstellungen</p>
    <div class="set"><span>Dein Name<small>für die Begrüßung</small></span><input data-set="name" value="${esc(s.name)}" style="width:140px;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:6px 8px;font:inherit;font-size:16px"></div>
    ${sel("maxCalls", "Anrufe pro Tag", "höchstens so viele auf „Heute“", [[2, "2"], [3, "3"], [5, "5"], [99, "kein Limit"]])}
    ${sel("retryWorkdays", "Nicht erreicht", "neuer Versuch nach", [[1, "1 Werktag"], [2, "2 Werktagen"], [5, "1 Woche"]])}
    ${sel("giftLead", "Geburtstage", "so früh auf „Heute“ zeigen", [[7, "7 Tage vorher"], [14, "14 Tage vorher"], [21, "21 Tage vorher"]])}
    <div class="sec"><span class="label">Wetter</span></div>
    <div class="set"><span>Wetter-Ort<small>${s.wxName ? esc(s.wxName) : "aktueller Standort"}</small></span><button class="mini" data-act="wxhere">Standort nutzen</button></div>
    <form class="shoprow" data-form="wxplace" style="margin:8px 0"><input class="search" style="margin:0" placeholder="Oder Ort eintippen, z. B. Remseck" aria-label="Wetter-Ort"><button class="btn pri" style="flex:none">OK</button></form>
    <div class="sec"><span class="label">Ausgaben-Kategorien</span></div>
    <p class="hint" style="margin-top:0">${catList().map(esc).join(" · ")}</p>
    <form class="shoprow" data-form="cat" style="margin-bottom:8px"><input class="search" style="margin:0" placeholder="Eigene Kategorie, z. B. Haustier" aria-label="Neue Kategorie"><button class="btn pri" style="flex:none">+</button></form>
    <div class="sec"><span class="label">Kontakte</span></div>
    <button class="btn" data-act="dupscan" style="width:100%;margin-bottom:8px">Doppelte Kontakte suchen</button>
    <button class="btn" data-act="importvcf" style="width:100%">Kontakte importieren (vCard .vcf)</button>
    <p class="hint">Am PC auf icloud.com › Kontakte alle markieren und „vCard exportieren“, Datei aufs iPhone (z. B. per AirDrop oder Dateien-App) und hier auswählen. Namen, Telefonnummern und Geburtstage werden übernommen, Doppelte übersprungen.</p>
    <div class="sec"><span class="label">Datensicherung</span></div>
    <div class="row2" style="margin-top:0"><button class="btn" data-act="export">Sicherung speichern</button><button class="btn" data-act="import">Sicherung laden</button></div>
    <p class="hint">Deine Daten liegen nur auf diesem Gerät, in dieser App-Adresse. Speichere ab und zu eine Sicherung (z. B. in iCloud Drive). Auf einem anderen Gerät kannst du sie mit „Sicherung laden“ übernehmen. Der automatische Abgleich zwischen iPhone, iPad und PC kommt mit dem Server (Supabase).</p>
    <div class="sec"><span class="label">Was noch fehlt</span></div>
    <p class="hint">Push-Nachrichten, wenn die App geschlossen ist, Briefings aus Gmail und das automatische Lesen von Belegen per KI brauchen den Server und den Claude-Schlüssel. Bis dahin zeigt Mirella alles Fällige beim Öffnen.</p>
    <div class="sec"><span class="label">Gefahrenzone</span></div>
    <button class="btn danger" data-act="wipe" style="width:100%">Alle Daten auf diesem Gerät löschen</button>
    <p class="swipehint">Mirella ${VERSION} · ${S.people.length} Kontakte · ${S.todos.length} Einträge · ${S.docs.length} Dokumente</p>`;
  }
};
function latestBriefing() { return S.briefings.slice().sort((a, b) => (b.d + (b.time || "")).localeCompare(a.d + (a.time || "")))[0] || null; }
function briefCard(b, del) {
  return `<div class="card ${b.read ? "" : "due"}" role="button" tabindex="0" data-act="openbrief" data-id="${b.id}"><span class="av">${IC.doku}</span><span style="min-width:0"><div class="t">${esc(b.kind === "nachmittag" ? "Nachmittags-Briefing" : "Morning Briefing")}</div><div class="s">${esc(fmtDate(b.d))}${b.time ? " · " + esc(b.time) : ""} · ${esc(b.name)}</div></span>${b.read ? (del ? `<button class="rowdel" data-act="delbrief" data-id="${b.id}" aria-label="löschen">✕</button>` : '<span class="pill">PDF</span>') : '<span class="pill acc">neu</span>'}</div>`;
}
async function addBriefings(files) {
  let n = 0;
  for (const f of files) {
    const m = f.name.match(/(\d{4})-(\d{2})-(\d{2})/) || f.name.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    let d = m ? (m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[2]}-${m[1]}`) : iso(new Date(f.lastModified || Date.now()));
    const lm = new Date(f.lastModified || Date.now());
    const kind = /nachmittag|abend|16/i.test(f.name) ? "nachmittag" : /morgen|morning|06/i.test(f.name) ? "morgen" : (lm.getHours() >= 12 ? "nachmittag" : "morgen");
    const time = kind === "nachmittag" ? "16:00" : "06:00";
    const id = "br_" + uid();
    try { await photoPut(id, f); } catch (_) { toast("Konnte " + f.name + " nicht speichern"); continue; }
    S.briefings.push({ id, d, time, kind, name: f.name.replace(/\.pdf$/i, ""), type: f.type || "application/pdf", read: false }); n++;
  }
  save(); view = "briefings"; render(); toast(n === 1 ? "Briefing abgelegt" : n + " Briefings abgelegt");
}
async function openBrief(id) {
  const b = S.briefings.find(x => x.id === id); if (!b) return;
  const blob = await photoGet(id).catch(() => null); if (!blob) { toast("Datei nicht gefunden"); return; }
  b.read = true; save();
  const url = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: b.type }));
  if ((b.type || "").startsWith("image/")) { const o = document.createElement("div"); o.className = "imgfull"; o.innerHTML = `<img src="${url}" alt=""><button aria-label="Schließen">✕</button>`; o.onclick = () => o.remove(); document.body.appendChild(o); }
  else {
    const o = document.createElement("div"); o.className = "pdfview";
    o.innerHTML = `<div class="pdfbar"><b>${esc(b.name)}</b><a class="mini" href="${url}" target="_blank" rel="noopener" style="text-decoration:none">In Safari öffnen</a><button class="iconbtn" aria-label="Schließen">✕</button></div><iframe src="${url}" title="${esc(b.name)}"></iframe>`;
    o.querySelector("button").onclick = () => { o.remove(); render(true); };
    document.body.appendChild(o);
  }
}

/* ---------- Wetter (Open-Meteo, ohne Schlüssel) ---------- */
const WXC = c => c === 0 ? ["☀️", "klar"] : c <= 2 ? ["🌤️", "leicht bewölkt"] : c === 3 ? ["☁️", "bewölkt"] : c <= 48 ? ["🌫️", "Nebel"] : c <= 57 ? ["🌦️", "Nieselregen"] : c <= 67 ? ["🌧️", "Regen"] : c <= 77 ? ["🌨️", "Schnee"] : c <= 82 ? ["🌧️", "Schauer"] : c <= 86 ? ["🌨️", "Schneeschauer"] : ["⛈️", "Gewitter"];
let WX = null;
try { WX = JSON.parse(localStorage.getItem("mirella.wx") || "null"); } catch (_) { }
function wxHTML() {
  if (!WX || !WX.cur) return `<div class="morning" style="border-color:var(--line)"><div class="wx"><span style="font-size:28px">🌡️</span><div><span style="font-size:14px">Wetter wird geladen …</span><small>Falls nichts kommt: Einstellungen › Wetter-Ort festlegen.</small></div></div></div>`;
  const [ic, txt] = WXC(WX.cur.weather_code), dl = WX.daily, hint = [];
  const hr = WX.hourly || {}, nowH = new Date().getHours();
  let rainAt = null; (hr.time || []).forEach((t, i) => { const h = +t.slice(11, 13); if (rainAt === null && t.slice(0, 10) === today() && h >= nowH && hr.precipitation_probability[i] >= 50) rainAt = h; });
  if (rainAt !== null) hint.push(rainAt <= nowH ? "Gerade Regen: Schirm mitnehmen." : `Ab ${rainAt} Uhr Regen: Schirm mitnehmen.`);
  if (dl && dl.temperature_2m_max[0] < 8) hint.push("Kalt: warme Jacke.");
  if (dl && dl.temperature_2m_min[0] <= 0) hint.push("Frost möglich: Scheibe kratzen einplanen.");
  return `<div class="morning" style="border-color:var(--line)"><div class="wx"><span style="font-size:30px">${ic}</span><div><span class="tmp">${Math.round(WX.cur.temperature_2m)}°</span><small>${esc(txt)} in ${esc(WX.place || "deiner Nähe")} · heute ${Math.round(dl.temperature_2m_min[0])}° bis ${Math.round(dl.temperature_2m_max[0])}°, Regen ${dl.precipitation_probability_max[0] ?? 0} %</small></div></div>${hint.length ? `<div class="chk" style="display:block;color:var(--ink-2);font-size:13.5px">${esc(hint.join(" "))}</div>` : ""}</div>`;
}
async function wxCoords() {
  if (S.settings.wxLat != null) return { lat: S.settings.wxLat, lon: S.settings.wxLon, place: S.settings.wxName };
  let c = null; try { c = JSON.parse(localStorage.getItem("mirella.geo") || "null"); } catch (_) { }
  if (c && Date.now() - c.t < 6 * 3600e3) return c;
  if (!navigator.geolocation) return null;
  return new Promise(res => navigator.geolocation.getCurrentPosition(pos => {
    const g = { lat: +pos.coords.latitude.toFixed(3), lon: +pos.coords.longitude.toFixed(3), place: "deiner Nähe", t: Date.now() };
    try { localStorage.setItem("mirella.geo", JSON.stringify(g)); } catch (_) { } res(g);
  }, () => res(null), { timeout: 8000, maximumAge: 3600e3 }));
}
async function loadWeather(force) {
  if (!force && WX && Date.now() - WX.t < 30 * 60e3) return;
  const c = await wxCoords(); if (!c) { const el = $("#wx"); if (el && (!WX || !WX.cur)) el.innerHTML = `<div class="hint">Für das Wetter: Standort erlauben oder in den Einstellungen einen Ort eintragen.</div>`; return; }
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,weather_code&hourly=precipitation_probability&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=Europe%2FBerlin&forecast_days=1`);
    const j = await r.json(); if (!j.current) throw new Error();
    WX = { t: Date.now(), place: c.place, cur: j.current, daily: j.daily, hourly: j.hourly };
    try { localStorage.setItem("mirella.wx", JSON.stringify(WX)); } catch (_) { }
    const el = $("#wx"); if (el) el.innerHTML = wxHTML();
  } catch (_) { const el = $("#wx"); if (el && (!WX || !WX.cur)) el.innerHTML = `<div class="hint">Wetter gerade nicht erreichbar.</div>`; }
}
async function setWxPlace(q) {
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=de&countryCode=DE`);
    const j = await r.json(); const g = j.results && j.results[0];
    if (!g) { toast("Ort nicht gefunden"); return; }
    S.settings.wxLat = g.latitude; S.settings.wxLon = g.longitude; S.settings.wxName = g.name; save(); WX = null; render(true); loadWeather(true); toast("Wetter-Ort: " + g.name);
  } catch (_) { toast("Ortssuche gerade nicht erreichbar"); }
}

/* iPhone-Kalender-Wecker (.ics) als Ersatz für Push */
function icsFor(t) {
  const st = (t.date + "T" + (t.time || "09:00")).replace(/[-:]/g, "") + "00";
  const end = new Date(D(t.date).setHours(+(t.time || "09:00").slice(0, 2), +(t.time || "09:00").slice(3, 5) + 15)); const en = `${iso(end).replace(/-/g, "")}T${pad(end.getHours())}${pad(end.getMinutes())}00`;
  const e = s => s.replace(/[\\;,]/g, m => "\\" + m).replace(/\n/g, " ");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mirella//DE", "BEGIN:VEVENT", "UID:" + t.id + "@mirella", "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z", "DTSTART;TZID=Europe/Berlin:" + st, "DTEND;TZID=Europe/Berlin:" + en, "SUMMARY:" + e("Mirella: " + t.t), "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + e(t.t), "TRIGGER:-PT0M", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}
function icsOpen(t) { if (!t.date) { toast("Erst ein Datum eintragen"); return; } location.href = "data:text/calendar;charset=utf-8," + encodeURIComponent(icsFor(t)); }
function nextCallBlock(p) {
  const due = nextDue(p), st = callState(p), last = lastCall(p), lastAny = lastCall(p, false);
  if (!due) return `<div class="nextcall"><div><div class="label">Nächster Anruf</div><b>kein fester Rhythmus</b><small>Unter „Bearbeiten“ einen Rhythmus wählen, dann plant Mirella die Anrufe.</small></div></div>`;
  const n = diffDays(today(), due), big = st === "late" ? `seit ${-n} ${-n === 1 ? "Tag" : "Tagen"} fällig` : n === 0 ? "heute" : n === 1 ? "morgen" : `in ${n} Tagen`;
  return `<div class="nextcall ${st}"><div><div class="label">Nächster Anruf</div><b>${esc(big)}</b><small>${st === "late" ? "fällig seit " : ""}${esc(fmtDate(due))} · ${esc(p.cyc)}${p.snooze && p.snooze >= today() ? " · verschoben" : ""}</small></div><div class="nc-r"><div class="label">Zuletzt erreicht</div><b style="font-size:16px">${esc(last ? relDate(last) : "noch nie")}</b>${lastAny && lastAny !== last ? `<small>Versuch ${esc(relDate(lastAny))}</small>` : ""}</div></div>`;
}
function waNum(tel) { let n = tel.replace(/[^\d+]/g, ""); if (n.startsWith("+")) return n.slice(1); if (n.startsWith("00")) return n.slice(2); if (n.startsWith("0")) return "49" + n.slice(1); return n; }
function notePh(id) { return { auto: "z. B. getankt, 58.900 km, 72 €", geld: "z. B. Handyvertrag gekündigt zum 31.3.", gesund: "z. B. Zahnarzt: alles gut", haus: "z. B. Zählerstand Strom 19.310", frei: "z. B. Skiurlaub gebucht, 13.–20.2.", arbeit: "z. B. Jahresgespräch im Januar", sport: "z. B. Paddeln: neues Paddel gekauft", doku: "z. B. Pass beantragt" }[id] || "Notiz"; }
function docRow(d) { return `<div class="listrow"><button data-act="viewphoto" data-id="${d.photo || ""}" style="border:0;padding:0;background:none" aria-label="Foto ansehen"><img class="thumbimg" data-thumb="${d.photo || ""}" alt=""></button><span class="grow">${esc(d.name)}<small>${esc([d.folder, d.until ? "gültig bis " + fmtDate(d.until) : "", fmtDate(d.created)].filter(Boolean).join(" · "))}</small></span><button class="rowdel" data-act="deldoc" data-id="${d.id}" aria-label="löschen">✕</button></div>`; }
function docsHTML() {
  const by = {}; S.docs.forEach(d => (by[d.folder || "Sonstiges"] = by[d.folder || "Sonstiges"] || []).push(d));
  const keys = FOLDERS.filter(f => by[f]).concat(Object.keys(by).filter(k => !FOLDERS.includes(k)));
  return `<div class="sec"><span class="label">Deine Ablage</span><span class="label">${S.docs.length}</span></div>${keys.length ? keys.map(k => `<div class="block"><h4>${esc(k)}</h4>${by[k].map(docRow).join("")}</div>`).join("") : empty("Noch keine Dokumente. Oben auf die Kamera tippen.")}`;
}
function financeHTML() {
  const ym = today().slice(0, 7), month = S.expenses.filter(e => e.d.startsWith(ym)), sum = month.reduce((a, e) => a + +e.amount, 0);
  const cats = {}; month.forEach(e => cats[e.cat] = (cats[e.cat] || 0) + +e.amount);
  const max = Math.max(1, ...Object.values(cats));
  const list = S.expenses.slice().sort((a, b) => a.d < b.d ? 1 : -1).slice(0, 30);
  return `<div class="block"><div class="catrow"><span>Ausgegeben im ${MN[new Date().getMonth()]}</span><b>${eur(sum)}</b></div>
  ${Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<div class="catrow" style="margin-top:8px"><span>${esc(c)}</span><span>${eur(v)}</span></div><div class="bar"><i style="width:${Math.round(v / max * 100)}%"></i></div>`).join("") || '<div class="swipehint" style="text-align:left;margin:6px 0 0">Noch keine Ausgaben diesen Monat.</div>'}</div>
  <div class="row2" style="margin:0 0 6px"><button class="btn pri" data-act="photo" data-kind="beleg">📷 Beleg fotografieren</button><button class="btn" data-act="newexp">+ Ausgabe</button></div>
  ${list.length ? `<div class="sec"><span class="label">Letzte Ausgaben</span></div>${list.map(e => `<div class="listrow">${e.photo ? `<button data-act="viewphoto" data-id="${e.photo}" style="border:0;padding:0;background:none" aria-label="Beleg ansehen"><img class="thumbimg" data-thumb="${e.photo}" alt=""></button>` : ""}<span class="grow">${esc(e.shop || e.cat)}<small>${esc(fmtDate(e.d))} · ${esc(e.cat)}</small></span><b style="font-weight:600">${eur(e.amount)}</b><button class="rowdel" data-act="delexp" data-id="${e.id}" aria-label="löschen">✕</button></div>`).join("")}` : ""}`;
}
function eventsRange(from, to) {
  const ev = {}, add = (d, k, t, act, id) => { if (d >= from && d <= to) (ev[d] = ev[d] || []).push({ k, t, act, id }); };
  for (const t of S.todos) {
    if (t.list !== "todo" || !t.date) continue;
    if (t.done) { add(t.date, "Erledigt", t.t, "edittodo", t.id); continue; }
    let d = t.date, guard = 0;
    while (d && d <= to && guard++ < 400) { add(d, t.area ? areaById(t.area)?.n.split(" ")[0] || "Aufgabe" : "Aufgabe", t.t + (t.time ? " · " + t.time : ""), "edittodo", t.id); if (!t.rep || t.rep === "nie") break; d = stepRep(d, t.rep); }
  }
  for (const p of S.people) {
    if (p.bday) { const [, m, dd] = p.bday.split("-"); for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) add(`${y}-${m}-${dd}`, "Geburtstag", fullName(p), "person", p.id); }
    const due = nextDue(p); if (due) add(due < today() ? today() : due, "Anruf", fullName(p), "person", p.id);
    for (const c of p.calls || []) add(c.d, "Anruf", fullName(p) + (c.ok ? " · erreicht" : " · nicht erreicht"), "person", p.id);
  }
  for (const d of S.docs) if (d.until) add(d.until, "Ablauf", d.name, "area", "doku");
  return ev;
}
function evRow(e) { return `<div class="ev" role="button" tabindex="0" data-act="${e.act}" data-id="${e.id}" style="cursor:pointer"><i>${esc(e.k)}</i>${esc(e.t)}</div>`; }

/* ---------- Rendern ---------- */
function render(keepScroll) {
  const sc = $("#screen"), st = sc.scrollTop;
  sc.innerHTML = R[view]();
  sc.scrollTop = keepScroll ? st : 0;
  const tabView = view === "akte" ? "menschen" : view;
  $$(".tab").forEach(b => b.dataset.v === tabView ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
  $("#plus").hidden = !["menschen", "todos", "kalender", "bereich"].includes(view);
  if (view === "heute") loadWeather();
  loadThumbs();
}
async function loadThumbs() {
  for (const img of $$("img[data-thumb]")) {
    const id = img.dataset.thumb; if (!id) { img.style.visibility = "hidden"; continue; }
    try { const b = await photoGet(id); if (b) { img.src = URL.createObjectURL(b); } } catch (_) { }
  }
}
function toast(msg) { document.querySelectorAll(".toast").forEach(x => x.remove()); const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; $("#phone").appendChild(t); setTimeout(() => t.remove(), 2400); }

/* ---------- Sheet / Drawer ---------- */
let sheetCleanup = null;
function openSheet(html, after) {
  closeDrawer();
  if (sheetCleanup) { const f = sheetCleanup; sheetCleanup = null; f(); }
  $("#sheetbody").innerHTML = html;
  const sh = $("#sheet"); sh.classList.add("open"); sh.setAttribute("aria-hidden", "false"); sh.scrollTop = 0;
  $("#scrim").classList.add("open");
  if (after) after();
}
function closeSheet() {
  if (sheetCleanup) { const f = sheetCleanup; sheetCleanup = null; f(); }
  const sh = $("#sheet"); sh.classList.remove("open"); sh.setAttribute("aria-hidden", "true");
  if (!$("#drawer").classList.contains("open")) $("#scrim").classList.remove("open");
  document.activeElement && document.activeElement.blur && document.activeElement.blur();
}
function drawerHTML() {
  const nb = S.briefings.filter(b => !b.read).length;
  return `<button class="drow" data-act="go" data-v="briefings">${IC.doku}<span class="dt"><b>Briefings</b><small>${S.briefings.length ? "Diese Woche: " + S.briefings.filter(b => isoWeek(b.d) === isoWeek(today()) && b.d.slice(0, 4) === today().slice(0, 4)).length + " · neuestes " + relDate(latestBriefing().d) : "Noch keine Briefings"}</small></span>${nb ? `<span class="pill acc">${nb}</span>` : ""}<span class="chev">›</span></button>` + AREAS.map(A => {
    const open = S.todos.filter(t => t.area === A.id && !t.done && t.list === "todo");
    const late = open.some(t => t.date && t.date < today());
    const sub = A.id === "doku" ? `${S.docs.length} Dokumente` : A.id === "geld" ? `${eur(S.expenses.filter(e => e.d.startsWith(today().slice(0, 7))).reduce((a, e) => a + +e.amount, 0))} diesen Monat` : open.length ? open[0].t : "Notizen, Erinnerungen, Fotos";
    return `<button class="drow" data-act="area" data-id="${A.id}">${IC[A.ic]}<span class="dt"><b>${esc(A.n)}</b><small>${esc(sub)}</small></span>${open.length ? `<span class="pill ${late ? "late" : "acc"}">${open.length}</span>` : ""}<span class="chev">›</span></button>`;
  }).join("");
}
function openDrawer() { closeSheet(); $("#dbody").innerHTML = drawerHTML(); $("#drawer").classList.add("open"); $("#drawer").setAttribute("aria-hidden", "false"); $("#scrim").classList.add("open"); }
function closeDrawer() { $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true"); if (!$("#sheet").classList.contains("open")) $("#scrim").classList.remove("open"); }
function closeAll() { closeSheet(); closeDrawer(); $("#scrim").classList.remove("open"); }

/* ---------- Formulare ---------- */
function todoForm(t, preset = {}) {
  const v = t || Object.assign({ t: "", date: "", time: "", rep: "nie", nerv: false, trig: "zeit", area: "" }, preset);
  openSheet(`<p class="stitle">${t ? "Aufgabe bearbeiten" : "Neue Aufgabe"}</p>
  <div class="fld"><label for="a-what">Was?</label><input id="a-what" value="${esc(v.t)}" placeholder="z. B. Waschmaschine ausräumen"></div>
  <div class="fld"><label for="a-trig">Wann erinnern?</label><select id="a-trig"><option value="zeit"${v.trig !== "verlassen" ? " selected" : ""}>An einem Tag</option><option value="verlassen"${v.trig === "verlassen" ? " selected" : ""}>Bevor ich losgehe (auf „Heute“ oben)</option></select></div>
  <div class="fgrid" id="f-time"${v.trig === "verlassen" ? " hidden" : ""}><div class="fld"><label for="a-date">Datum (frei lassen = ohne Termin)</label><input type="date" id="a-date" value="${esc(v.date || "")}"></div><div class="fld"><label for="a-time">Uhrzeit</label><input type="time" id="a-time" value="${esc(v.time || "")}"></div></div>
  <div class="fgrid"><div class="fld"><label for="a-rep">Wiederholen</label><select id="a-rep">${REPS.map(r => `<option${r === (v.rep || "nie") ? " selected" : ""}>${r}</option>`).join("")}</select></div>
  <div class="fld"><label for="a-area">Bereich</label><select id="a-area"><option value="">kein Bereich</option>${AREAS.map(a => `<option value="${a.id}"${a.id === v.area ? " selected" : ""}>${esc(a.n)}</option>`).join("")}</select></div></div>
  <label class="tgl"><input type="checkbox" id="a-nerv"${v.nerv ? " checked" : ""}> Nerv-Modus: bleibt oben, bis es erledigt ist</label>
  ${t && t.date ? `<button class="btn" data-act="ics" data-id="${t.id}" style="width:100%;margin-top:8px">⏰ Zusätzlich als Wecker in den iPhone-Kalender</button>` : ""}
  <div class="row2">${t ? `<button class="btn danger" data-act="deltodo" data-id="${t.id}" style="flex:none">Löschen</button>` : ""}<button class="btn" data-close="sheet">Abbrechen</button><button class="btn pri" data-act="savetodo" data-id="${t ? t.id : ""}">Speichern</button></div>`,
    () => { $("#a-trig").onchange = e => { $("#f-time").hidden = e.target.value === "verlassen"; }; if (!t) $("#a-what").focus(); });
}
function saveTodo(id) {
  const w = $("#a-what").value.trim(); if (!w) { toast("Bitte eintragen, was zu tun ist"); $("#a-what").focus(); return; }
  const trig = $("#a-trig").value;
  const data = { t: w, trig, date: trig === "verlassen" ? "" : $("#a-date").value, time: trig === "verlassen" ? "" : $("#a-time").value, rep: $("#a-rep").value, area: $("#a-area").value, nerv: $("#a-nerv").checked };
  if (data.rep !== "nie" && !data.date && trig !== "verlassen") data.date = today();
  if (id) Object.assign(S.todos.find(x => x.id === id), data);
  else S.todos.push(Object.assign({ id: uid(), list: "todo", done: false, created: today() }, data));
  save(); closeSheet(); render(true); toast("Gespeichert: " + w);
}
function personForm(p) {
  const v = p || { first: "", last: "", tel: "", email: "", cyc: "monatlich", group: "Freunde", bday: "", gift: false, addr: "", nick: "" };
  openSheet(`<p class="stitle">${p ? "Kontakt bearbeiten" : "Neuer Kontakt"}</p>
  <div class="fgrid"><div class="fld"><label for="c-first">Vorname</label><input id="c-first" value="${esc(v.first)}" autocomplete="off"></div><div class="fld"><label for="c-last">Nachname</label><input id="c-last" value="${esc(v.last)}" autocomplete="off"></div></div>
  <div class="fld"><label for="c-tel">Telefon</label><input id="c-tel" type="tel" value="${esc(v.tel)}" placeholder="0151 …"></div>
  <div class="fld"><label for="c-mail">E-Mail</label><input id="c-mail" type="email" inputmode="email" autocapitalize="off" value="${esc(v.email || "")}" placeholder="name@beispiel.de"></div>
  <div class="fgrid"><div class="fld"><label for="c-cyc">Anrufen</label><select id="c-cyc">${CYCLES.map(c => `<option${c === v.cyc ? " selected" : ""}>${c}</option>`).join("")}</select></div>
  <div class="fld"><label for="c-grp">Gruppe</label><input id="c-grp" list="grps" value="${esc(v.group)}"><datalist id="grps">${S.groups.map(g => `<option value="${esc(g)}">`).join("")}</datalist></div></div>
  <div class="fgrid"><div class="fld"><label for="c-bday">Geburtstag</label><input id="c-bday" type="date" value="${esc(v.bday && v.bday.length === 10 ? v.bday : "")}"></div><div class="fld"><label for="c-nick">Spitzname (für Sprache)</label><input id="c-nick" value="${esc(v.nick || "")}" placeholder="z. B. Oma"></div></div>
  <label class="tgl"><input type="checkbox" id="c-gift"${v.gift ? " checked" : ""}> Geschenk besorgen (Erinnerung ${S.settings.giftLead} Tage vorher)</label>
  <div class="fld" style="margin-top:8px;position:relative"><label for="c-addr">Adresse</label><input id="c-addr" value="${esc(v.addr || "")}" autocomplete="off" placeholder="Straße eintippen, Vorschläge erscheinen"><div id="addr-sug" class="sug" hidden></div></div>
  <div id="dup-warn"></div>
  ${p ? "" : `<div class="fld"><label for="c-last-call">Zuletzt angerufen (wenn bekannt)</label><input id="c-last-call" type="date"></div>`}
  <div class="row2">${p ? `<button class="btn danger" data-act="delperson" data-id="${p.id}" style="flex:none">Löschen</button>` : ""}<button class="btn" data-close="sheet">Abbrechen</button><button class="btn pri" data-act="saveperson" data-id="${p ? p.id : ""}">Speichern</button></div>`,
    () => { if (!p) $("#c-first").focus(); addrSuggest($("#c-addr"), $("#addr-sug")); });
}
let addrTimer = null;
function addrSuggest(inp, box) {
  inp.addEventListener("input", () => {
    clearTimeout(addrTimer); const q = inp.value.trim();
    if (q.length < 4) { box.hidden = true; return; }
    addrTimer = setTimeout(async () => {
      try {
        const lat = S.settings.wxLat || 48.8, lon = S.settings.wxLon || 9.2;
        const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=de&limit=5&lat=${lat}&lon=${lon}`);
        const j = await r.json();
        const list = [...new Set((j.features || []).map(f => fmtAddr(f.properties)).filter(Boolean))];
        if (!list.length || inp.value.trim() !== q) { box.hidden = true; return; }
        box.innerHTML = list.map(a => `<button type="button" data-addr="${esc(a)}">${esc(a)}</button>`).join(""); box.hidden = false;
      } catch (_) { box.hidden = true; }
    }, 350);
  });
  box.addEventListener("click", e => { const b = e.target.closest("[data-addr]"); if (!b) return; inp.value = b.dataset.addr; box.hidden = true; });
}
function fmtAddr(a) {
  if (!a) return "";
  const street = a.street ? a.street + (a.housenumber ? " " + a.housenumber : "") : (a.name || "");
  const town = [a.postcode, a.city || a.town || a.village || a.district].filter(Boolean).join(" ");
  const out = [street, town].filter(Boolean).join(", ");
  return a.country && a.country !== "Deutschland" ? out + ", " + a.country : out;
}
const normName = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
const telKey = t => { const d = (t || "").replace(/\D/g, "").replace(/^(0049|49)/, "0"); return d.length >= 7 ? d.slice(-9) : ""; };
function findDups(d, exceptId) {
  const n1 = normName(d.first + " " + d.last), n2 = normName(d.last + " " + d.first), tk = telKey(d.tel), em = (d.email || "").trim().toLowerCase();
  return S.people.filter(p => p.id !== exceptId && (
    (n1.length > 2 && (normName(fullName(p)) === n1 || normName(fullName(p)) === n2)) ||
    (tk && telKey(p.tel) === tk) || (em && (p.email || "").toLowerCase() === em)));
}
function mergeInto(t, src) {
  for (const k of ["first", "last", "tel", "email", "addr", "bday", "nick", "group"]) if (!t[k] && src[k]) t[k] = src[k];
  if ((!t.cyc || t.cyc === "nur Geburtstag") && src.cyc) t.cyc = src.cyc;
  t.gift = t.gift || !!src.gift;
  for (const k of ["calls", "notes", "ask", "gifts"]) t[k] = [...(t[k] || []), ...(src[k] || [])];
  if (src.id) S.todos.forEach(x => { if (x.pid === src.id) x.pid = t.id; });
}
function savePerson(id) {
  const first = $("#c-first").value.trim(), last = $("#c-last").value.trim();
  if (!first && !last) { toast("Bitte einen Namen eintragen"); $("#c-first").focus(); return; }
  const data = { first, last, tel: $("#c-tel").value.trim(), email: $("#c-mail").value.trim(), cyc: $("#c-cyc").value, group: $("#c-grp").value.trim(), bday: $("#c-bday").value, gift: $("#c-gift").checked, addr: $("#c-addr").value.trim(), nick: $("#c-nick").value.trim() };
  if (data.group && !S.groups.includes(data.group)) S.groups.push(data.group);
  const dups = findDups(data, id);
  if (dups.length && !savePerson.force) {
    $("#dup-warn").innerHTML = `<div class="hint" style="border:1px solid var(--late)"><b>Gibt es schon?</b> ${dups.map(d => esc(fullName(d)) + (d.tel ? " · " + esc(d.tel) : "")).join(", ")}<div class="row2" style="margin-top:8px;flex-wrap:wrap"><button class="btn" data-act="dupmerge" data-id="${dups[0].id}" data-self="${id || ""}">Zusammenführen</button><button class="btn" data-act="dupforce" data-id="${id || ""}">Trotzdem speichern</button></div></div>`;
    $("#dup-warn").scrollIntoView({ block: "center" }); return;
  }
  savePerson.force = false;
  savePerson.last = data;
  if (id) Object.assign(S.people.find(x => x.id === id), data);
  else {
    const p = Object.assign({ id: uid(), created: today(), calls: [], notes: [], ask: [], gifts: [] }, data);
    const lc = $("#c-last-call") && $("#c-last-call").value; if (lc) p.calls.push({ id: uid(), d: lc, ok: true });
    S.people.push(p); cur = p.id; view = "akte";
  }
  save(); closeSheet(); render(); toast("Gespeichert: " + [first, last].join(" ").trim());
}
function callResult(p, autoDial) {
  openSheet(`<p class="stitle">Anruf mit ${esc(fullName(p))}</p><p class="swipehint" style="text-align:left;margin:0 0 10px">Wie ist es gelaufen?</p>
  <div style="display:grid;gap:8px"><button class="btn pri" data-act="callok" data-id="${p.id}">Erreicht</button><button class="btn" data-act="callno" data-id="${p.id}">Nicht erreicht (neuer Versuch in ${S.settings.retryWorkdays} ${S.settings.retryWorkdays == 1 ? "Werktag" : "Werktagen"})</button><button class="btn" data-act="snooze" data-id="${p.id}">Später</button><button class="btn" data-close="sheet" style="background:none;border:0">Abbrechen</button></div>`);
  if (autoDial && p.tel) location.href = "tel:" + p.tel.replace(/[^\d+]/g, "");
}
function snoozeForm(p) {
  const opts = [["morgen", addDays(today(), 1)], ["in 3 Tagen", addDays(today(), 3)], ["in 1 Woche", addDays(today(), 7)], ["in 3 Wochen", addDays(today(), 21)], ["in 2 Monaten", addMonths(today(), 2)]];
  openSheet(`<p class="stitle">${esc(fullName(p))} später anrufen</p><div style="display:grid;gap:8px">${opts.map(([l, d]) => `<button class="btn" data-act="dosnooze" data-id="${p.id}" data-d="${d}">${l} <small style="font-weight:400;color:var(--ink-3)">· ${fmtDate(d)}</small></button>`).join("")}<button class="btn" data-close="sheet" style="background:none;border:0">Abbrechen</button></div>`);
}
function expenseForm(pre = {}) {
  openSheet(`<p class="stitle">Neue Ausgabe</p>
  <div class="fgrid"><div class="fld"><label for="e-amt">Betrag in €</label><input id="e-amt" inputmode="decimal" value="${esc(pre.amount || "")}" placeholder="0,00"></div><div class="fld"><label for="e-date">Datum</label><input id="e-date" type="date" value="${today()}"></div></div>
  <div class="fld"><label for="e-shop">Wo / wofür</label><input id="e-shop" value="${esc(pre.shop || "")}" placeholder="z. B. REWE"></div>
  <div class="fld"><label for="e-cat">Kategorie</label><select id="e-cat">${catList().map(c => `<option${c === (pre.cat || "Lebensmittel & Supermarkt") ? " selected" : ""}>${c}</option>`).join("")}</select></div>
  <div class="row2"><button class="btn" data-close="sheet">Abbrechen</button><button class="btn pri" data-act="saveexp">Speichern</button></div>`, () => $("#e-amt").focus());
}
const parseAmount = s => { const n = parseFloat(String(s).replace(/\s|€/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")); return isNaN(n) ? null : Math.round(n * 100) / 100; };

/* ---------- Kamera ---------- */
let photoCtx = null;
function photoStart(kind, areaId) {
  photoCtx = { kind: kind || null, area: areaId || null, blob: null, url: null };
  openSheet(`<p class="stitle">Foto an Mirella</p>
  <p class="swipehint" style="text-align:left;margin:0 0 12px">Beleg, Dokument, Einkaufszettel oder etwas für einen Bereich.</p>
  <div style="display:grid;gap:8px"><button class="btn pri" data-act="pickcam">📷 Foto machen</button><button class="btn" data-act="picklib">Aus „Fotos“ wählen</button><button class="btn" data-close="sheet" style="background:none;border:0">Abbrechen</button></div>`);
}
async function photoChosen(file) {
  if (!file) return;
  try {
    toast("Foto wird vorbereitet …");
    const blob = await shrink(file);
    photoCtx = photoCtx || { kind: null, area: null };
    if (photoCtx.url) URL.revokeObjectURL(photoCtx.url);
    photoCtx.blob = blob; photoCtx.url = URL.createObjectURL(blob);
    photoForm();
  } catch (e) { toast(e.message || "Foto konnte nicht gelesen werden"); }
}
function photoForm() {
  const k = photoCtx.kind || (photoCtx.area === "doku" ? "dokument" : photoCtx.area && photoCtx.area !== "geld" ? "bereich" : "beleg");
  photoCtx.kind = k;
  const kinds = [["beleg", "Beleg / Rechnung"], ["dokument", "Dokument"], ["zettel", "Einkaufszettel"], ["bereich", "Für einen Bereich"]];
  let f = "";
  if (k === "beleg") f = `<div class="fgrid"><div class="fld"><label for="e-amt">Betrag in €</label><input id="e-amt" inputmode="decimal" placeholder="0,00"></div><div class="fld"><label for="e-date">Datum</label><input id="e-date" type="date" value="${today()}"></div></div><div class="fld"><label for="e-shop">Laden</label><input id="e-shop" placeholder="z. B. REWE"></div><div class="fld"><label for="e-cat">Kategorie</label><select id="e-cat">${catList().map(c => `<option>${c}</option>`).join("")}</select></div>`;
  if (k === "dokument") f = `<div class="fld"><label for="d-name">Name</label><input id="d-name" placeholder="z. B. Reisepass"></div><div class="fgrid"><div class="fld"><label for="d-folder">Ordner</label><select id="d-folder">${FOLDERS.map(x => `<option>${x}</option>`).join("")}</select></div><div class="fld"><label for="d-until">Gültig bis (freiwillig)</label><input id="d-until" type="date"></div></div>`;
  if (k === "zettel") f = `<div class="fld"><label for="z-items">Was steht drauf? Eine Zeile pro Artikel</label><textarea id="z-items" placeholder="Butter&#10;Brot&#10;Zwiebeln"></textarea></div><p class="hint">Tipp: Auf dem iPhone kannst du im Textfeld auf „Text scannen“ tippen (Feld gedrückt halten), dann liest das iPhone den Zettel selbst ab.</p>`;
  if (k === "bereich") f = `<div class="fld"><label for="b-area">Bereich</label><select id="b-area">${AREAS.filter(a => a.id !== "doku").map(a => `<option value="${a.id}"${a.id === photoCtx.area ? " selected" : ""}>${esc(a.n)}</option>`).join("")}</select></div><div class="fld"><label for="b-name">Was ist das?</label><input id="b-name" placeholder="z. B. Werkstattrechnung, Fahrzeugschein"></div><div class="fld"><label for="b-until">Gültig bis / Frist (freiwillig)</label><input id="b-until" type="date"></div>`;
  openSheet(`<p class="stitle">Wohin damit?</p><img class="photo-prev" src="${photoCtx.url}" alt="Dein Foto">
  <div class="pick">${kinds.map(([v, l]) => `<button data-act="photokind" data-k="${v}" aria-pressed="${v === k}">${l}</button>`).join("")}</div>
  ${f}
  <div class="row2"><button class="btn" data-close="sheet">Verwerfen</button><button class="btn pri" data-act="photosave">Ablegen</button></div>`);
  sheetCleanup = () => { };
}
async function photoSave() {
  const k = photoCtx.kind;
  if (k === "zettel") {
    const items = $("#z-items").value.split(/\n|,/).map(x => x.trim()).filter(Boolean);
    if (!items.length) { toast("Bitte mindestens einen Artikel eintragen"); return; }
    items.forEach(t => addShop(t));
    save(); closeSheet(); todoList = "einkauf"; view = "todos"; render(); toast(items.length + " auf die Einkaufsliste"); return;
  }
  const pid = "ph_" + uid();
  try { await photoPut(pid, photoCtx.blob); } catch (e) { toast("Foto konnte nicht gespeichert werden"); return; }
  if (k === "beleg") {
    const a = parseAmount($("#e-amt").value);
    if (a == null) { toast("Bitte den Betrag eintragen"); $("#e-amt").focus(); await photoDel(pid); return; }
    S.expenses.push({ id: uid(), d: $("#e-date").value || today(), amount: a, shop: $("#e-shop").value.trim(), cat: $("#e-cat").value, photo: pid });
    save(); closeSheet(); area = "geld"; view = "bereich"; render(); toast("Beleg abgelegt: " + eur(a)); return;
  }
  if (k === "dokument") {
    const name = $("#d-name").value.trim() || "Dokument vom " + fmtDate(today());
    S.docs.push({ id: uid(), name, folder: $("#d-folder").value, until: $("#d-until").value, photo: pid, created: today(), area: "doku" });
    save(); closeSheet(); area = "doku"; view = "bereich"; render(); toast("Abgelegt: " + name); return;
  }
  if (k === "bereich") {
    const ar = $("#b-area").value, name = $("#b-name").value.trim() || "Foto vom " + fmtDate(today());
    S.docs.push({ id: uid(), name, folder: areaById(ar).n, until: $("#b-until").value, photo: pid, created: today(), area: ar });
    save(); closeSheet(); area = ar; view = "bereich"; render(); toast("Abgelegt bei " + areaById(ar).n);
  }
}
async function viewPhoto(id) {
  if (!id) return;
  const b = await photoGet(id).catch(() => null); if (!b) { toast("Foto nicht gefunden"); return; }
  const u = URL.createObjectURL(b), o = document.createElement("div");
  o.className = "imgfull"; o.innerHTML = `<img src="${u}" alt=""><button aria-label="Schließen">✕</button>`;
  o.onclick = () => { URL.revokeObjectURL(u); o.remove(); };
  document.body.appendChild(o);
}

/* ---------- Sprache ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, recOn = false, finalText = "";
function voiceStart() {
  finalText = "";
  openSheet(`<p class="stitle">Sag es Mirella</p>
  <div class="vstate"><span class="vdot" id="v-dot"></span><span id="v-state">${SR ? "Ich höre zu …" : "Tippe ins Feld und nutze das Mikrofon auf der Tastatur."}</span></div>
  <div class="fld"><textarea id="v-text" placeholder="z. B. Erinnere mich morgen um 9 an die Steuer. Butter und Eier auf die Einkaufsliste. Hab mit Tim telefoniert, er fliegt Freitag nach China."></textarea></div>
  <div class="row2" style="margin-top:4px">${SR ? `<button class="btn" data-act="vagain" style="flex:none" aria-label="Nochmal sprechen">🎙 Nochmal</button>` : ""}<button class="btn" data-close="sheet">Abbrechen</button><button class="btn pri" data-act="vnext">Weiter</button></div>
  <p class="swipehint" style="margin-top:12px">Sprich in ganzen Sätzen. Danach zeige ich dir, was ich verstanden habe, und du kannst alles ändern.</p>`,
    () => { if (SR) recStart(); else $("#v-text").focus(); });
  sheetCleanup = recStop;
}
function recStart() {
  recStop();
  try {
    rec = new SR(); rec.lang = "de-DE"; rec.interimResults = true; rec.continuous = true;
    const base = $("#v-text").value ? $("#v-text").value.trim() + " " : "";
    rec.onresult = e => {
      let fin = "", inter = "";
      for (let i = 0; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) fin += r[0].transcript + " "; else inter += r[0].transcript; }
      const ta = $("#v-text"); if (ta) ta.value = (base + fin + inter).replace(/\s+/g, " ").trimStart();
    };
    rec.onerror = e => {
      const st = $("#v-state");
      if (!st) return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") st.textContent = "Mikrofon ist nicht erlaubt. iPhone: Einstellungen › Apps › Safari › Mikrofon › Erlauben. Solange kannst du tippen oder das Tastatur-Mikrofon nutzen.";
      else if (e.error === "no-speech") st.textContent = "Ich habe nichts gehört. Tippe auf „Nochmal“.";
      else st.textContent = "Spracheingabe gerade nicht möglich (" + e.error + "). Tippe oder nutze das Tastatur-Mikrofon.";
    };
    rec.onend = () => { recOn = false; const d = $("#v-dot"), st = $("#v-state"), m = $("#mic"); d && d.classList.remove("on"); m.classList.remove("rec"); if (st && st.textContent.startsWith("Ich höre")) st.textContent = "Fertig zugehört. Prüfen und auf „Weiter“ tippen."; };
    rec.start(); recOn = true;
    $("#v-dot") && $("#v-dot").classList.add("on"); $("#mic").classList.add("rec");
    $("#v-state") && ($("#v-state").textContent = "Ich höre zu … tippe auf „Weiter“, wenn du fertig bist.");
  } catch (e) {
    const st = $("#v-state"); if (st) st.textContent = "Spracheingabe nicht verfügbar. Tippe oder nutze das Tastatur-Mikrofon.";
  }
}
function recStop() { if (rec) { try { rec.onend = null; rec.abort(); } catch (_) { } } rec = null; recOn = false; $("#mic").classList.remove("rec"); }

/* Verstehen (ohne KI, feste Regeln) */
const NUMW = { ein: 1, eine: 1, einen: 1, einem: 1, einer: 1, zwei: 2, drei: 3, vier: 4, "fünf": 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, "zwölf": 12, "vierzehn": 14, "zwanzig": 20, "dreißig": 30, halb: 0.5 };
const WDN = ["sonntag", "montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag"];
const MNL = MN.map(m => m.toLowerCase());
function parseWhen(s) {
  let date = "", time = "", rest = s, trig = "";
  const cut = re => { const m = rest.match(re); if (m) rest = (rest.slice(0, m.index) + " " + rest.slice(m.index + m[0].length)).replace(/\s+/g, " "); return m; };
  let m;
  if ((m = cut(/\b(bevor ich (los|aus dem haus|raus)ge?he?|wenn ich (los|aus dem haus|raus)gehe|beim (losgehen|rausgehen))\b/i))) trig = "verlassen";
  if ((m = cut(/\bum (\d{1,2})(?:[:.](\d{2}))?\s*(uhr)?(\s*(\d{1,2}))?\b/i))) { let h = +m[1], mi = m[2] ? +m[2] : (m[5] && m[3] ? +m[5] : 0); if (h <= 23 && mi < 60) time = `${pad(h)}:${pad(mi)}`; }
  const rel = mins => { const n = new Date(Date.now() + mins * 60000); n.setMinutes(Math.ceil(n.getMinutes() / 15) * 15, 0, 0); return n; };
  if (!time && (m = cut(/\b(nachher|später|spaeter|in ein paar stunden)\b/i))) { let n = rel(120); if (n.getHours() >= 21 || n.getDate() !== new Date().getDate()) { n = new Date(); n.setDate(n.getDate() + 1); n.setHours(9, 0, 0, 0); } date = iso(n); time = `${pad(n.getHours())}:${pad(n.getMinutes())}`; }
  if (!time && (m = cut(/\bgleich\b/i))) { const n = rel(30); date = iso(n); time = `${pad(n.getHours())}:${pad(n.getMinutes())}`; }
  if (!time && (m = cut(/\bin\s+(?:einer\s+)?(\d+|[a-zäöüß]+)?\s*(halben\s+stunde|minute|minuten|stunde|stunden)\b/i))) { const u = m[2].toLowerCase(); const k = u.startsWith("halb") ? 30 : (/^\d+$/.test(m[1] || "") ? +m[1] : (NUMW[(m[1] || "eine").toLowerCase()] || 1)) * (u.startsWith("min") ? 1 : 60); const n = new Date(Date.now() + k * 60000); date = iso(n); time = `${pad(n.getHours())}:${pad(n.getMinutes())}`; }
  if ((m = cut(/\bheute\s+(abend|nachmittag|mittag|morgen|früh)\b/i))) { date = today(); if (!time) time = { abend: "19:00", nachmittag: "15:00", mittag: "12:00", morgen: "08:00", "früh": "08:00" }[m[1].toLowerCase()]; }
  if (!date && (m = cut(/\bübermorgen\b/i))) date = addDays(today(), 2);
  if (!date && (m = cut(/\bmorgen\s+(früh|abend|nachmittag|mittag)\b/i))) { date = addDays(today(), 1); if (!time) time = { abend: "19:00", nachmittag: "15:00", mittag: "12:00", "früh": "08:00" }[m[1].toLowerCase()]; }
  if (!date && (m = cut(/\bmorgen\b/i))) date = addDays(today(), 1);
  if (!date && (m = cut(/\bheute\b/i))) date = today();
  if (!date && (m = cut(/\bin\s+(\d+|[a-zäöüß]+)\s+(tag|tagen|woche|wochen|monat|monaten|jahr|jahren)\b/i))) {
    const n = /^\d+$/.test(m[1]) ? +m[1] : NUMW[m[1].toLowerCase()];
    if (n) { const u = m[2].toLowerCase(); date = u.startsWith("tag") ? addDays(today(), n) : u.startsWith("woche") ? addDays(today(), n * 7) : u.startsWith("monat") ? addMonths(today(), n) : addMonths(today(), 12 * n); }
  }
  if (!date && (m = cut(/\b(?:nächste|kommende)n?\s+woche\b/i))) { const d = D(today()); const k = ((8 - d.getDay()) % 7) || 7; date = addDays(today(), k); }
  if (!date && (m = cut(/\b(?:am\s+)?(?:nächsten\s+|kommenden\s+)?(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/i))) { const w = WDN.indexOf(m[1].toLowerCase()), d = D(today()).getDay(); let k = (w - d + 7) % 7; if (k === 0) k = 7; date = addDays(today(), k); }
  if (!date && (m = cut(/\b(?:am\s+)?(\d{1,2})\.\s?(\d{1,2})\.?(?:\s?(\d{2,4}))?\b/))) date = mkDate(+m[1], +m[2], m[3]);
  if (!date && (m = cut(new RegExp("\\b(?:am\\s+)?(\\d{1,2})\\.?\\s+(" + MNL.join("|") + ")(?:\\s+(\\d{4}))?\\b", "i")))) date = mkDate(+m[1], MNL.indexOf(m[2].toLowerCase()) + 1, m[3]);
  if (time && !date && !trig) { const n = new Date(), now = `${pad(n.getHours())}:${pad(n.getMinutes())}`; date = time <= now ? addDays(today(), 1) : today(); }
  return { date, time, trig, rest: rest.trim() };
}
function mkDate(d, mo, y) {
  if (!(d >= 1 && d <= 31 && mo >= 1 && mo <= 12)) return "";
  let yy = y ? +y : new Date().getFullYear(); if (yy < 100) yy += 2000;
  let s = `${yy}-${pad(mo)}-${pad(d)}`; if (!y && s < today()) s = `${yy + 1}-${pad(mo)}-${pad(d)}`;
  return s;
}
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
function cleanTask(s) {
  return cap(s.replace(/^\s*(und|also|bitte|ok(ay)?|mirella|hey|hallo|du)[,\s]+/i, "").replace(/^\s*(hey|hallo)\s+mirella[,\s]+/i, "")
    .replace(/\b(erinnere?|erinner)\s+mich\s*(bitte\s*)?(noch\s*)?(dran|daran)?\s*,?\s*(an\s+(den|die|das)?\s*|dass\s+|zu\s+)?/i, "")
    .replace(/^\s*(ich\s+)?(muss|sollte|will|möchte)\s+(noch\s+)?/i, "")
    .replace(/^\s*(nicht\s+vergessen|neue\s+aufgabe|aufgabe|to-?do)[:,]?\s*/i, "")
    .replace(/\s+(muss|sollte)\s+ich(\s+noch)?\b/i, "")
    .replace(/\b(bitte|noch)\b\s*$/i, "").replace(/^(dass ich|ich soll)\s+/i, "").replace(/^(dem|den|der|die|das)\s+/i, "").replace(/\b(ab|an|auf|aus|ein|mit|nach|vor|zurück|weg|zu|los|vorbei|hin|her|ran|raus|rein|um)zu([a-zäöüß]+en)$/i, "$1$2")
    .replace(/\s+([,.!?])/g, "$1").replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, "").replace(/\s+/g, " "));
}
function splitItems(s) { return s.split(/\s*,\s*|\s+und\s+|\s+sowie\s+/i).map(x => cap(x.replace(/^(noch|bitte|etwas|ein|eine|einen|zwei|drei|vier|fünf|die|den|das)\s+/i, "").replace(/\s+(drauf|darauf|hinzu|setzen|schreiben)$/i, "").replace(/[.!?]+$/, "").trim())).filter(x => x && x.length < 60); }
function guessCat(s) {
  const t = s.toLowerCase();
  if (/tank|aral|shell|esso|jet|benzin|diesel|werkstatt|auto|parken/.test(t)) return "Tanken & Auto";
  if (/restaurant|essen gegangen|pizza|café|cafe|kaffee getrunken|bar|döner|mittagessen/.test(t)) return "Restaurant & Café";
  if (/dm|rossmann|apotheke|drogerie/.test(t)) return "Drogerie & Gesundheit";
  if (/getränk|getraenk|kasten|wasser|bier|wein|saft|cola/.test(t)) return "Getränke";
  if (/bäcker|baecker|metzger|brezel|brötchen|semmel|wurst/.test(t)) return "Bäcker & Metzger";
  if (/rewe|edeka|aldi|lidl|kaufland|netto|penny|einkauf|lebensmittel|supermarkt/.test(t)) return "Lebensmittel & Supermarkt";
  if (/kino|konzert|ausgehen/.test(t)) return "Freizeit & Ausgehen";
  if (/geschenk/.test(t)) return "Geschenke";
  if (/klamotten|kleidung|schuhe|hose|jacke|zalando/.test(t)) return "Kleidung";
  if (/obi|baumarkt|ikea|haushalt|möbel/.test(t)) return "Haushalt & Wohnen";
  if (/sport|fitness|decathlon|paddel|fußball/.test(t)) return "Hobby & Sport";
  if (/hotel|flug|urlaub|reise|bahn/.test(t)) return "Reisen";
  if (/abo|netflix|spotify|handy|technik|amazon/.test(t)) return "Technik & Abos";
  return "Sonstiges";
}
function understand(text) {
  const items = [];
  let lastP = null;
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[^\d.][.!?;]|[!?;])\s+|\s+und dann\s+|\n+/i).map(s => s.trim()).filter(Boolean);
  for (let s of sentences) {
    const low = s.toLowerCase().replace(/[.!?]+$/, "");
    const persons = findPersonsIn(low);
    const p = persons[0] ? persons[0].p : null;
    if (p) lastP = p;
    let m;
    // Einkauf
    if (/einkaufsliste|einkaufszettel|^(wir brauchen|ich brauche|einkaufen|kaufen|besorgen)\b/.test(low)) {
      const VERB = /\b(setz(e|en)?|schreib(e|en)?|pack(e|en)?|tu|füg(e|en)?|hinzu|drauf|darauf|bitte|noch|mir|mal|auch|kannst du|könntest du|würdest du)\b/gi;
      const pats = [/(?:auf|in|zu)\s+(?:die|der|den|meine|meiner|meinen|unsere|unserer)?\s*einkauf(?:sliste|szettel)\s*[:,]?\s*(.+)$/i, /^(.+?)\s+(?:auf|in|zu)\s+(?:die|der|den|meine|meiner|meinen|unsere|unserer)?\s*einkauf(?:sliste|szettel)\b/i, /einkauf(?:sliste|szettel)\s*[:,]?\s+(.+)$/i, /^(?:wir brauchen|ich brauche|einkaufen|kaufen|besorgen)[:,]?\s+(.+)$/i];
      let list = [];
      for (const re of pats) { const mm = low.match(re); if (!mm) continue; list = splitItems(mm[1].replace(VERB, " ").replace(/\b(setzen|schreiben|packen|hinzufügen)\s*$/i, " ").replace(/\s+/g, " ").trim()); if (list.length) break; }
      if (list.length) { list.forEach(t => items.push({ type: "shop", t })); continue; }
    }
    // Ausgabe
    if ((m = low.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:euro|eur|€)/i)) && /(ausgegeben|bezahlt|gezahlt|gekostet|getankt|gekauft|eingekauft|für)/.test(low)) {
      const shop = (low.match(/\bbeim?\s+(?:der\s+|dem\s+)?([a-zäöüß][\wäöüß-]*)/i) || [])[1] || "";
      items.push({ type: "expense", amount: parseAmount(m[1]), shop: cap(shop), cat: guessCat(low), t: cap(s.replace(/[.!?]+$/, "")) });
      continue;
    }
    // Anruf
    const pp = p || (/^(er|sie|ihm|ihr)\b/.test(low) ? lastP : null);
    if (pp && /(nicht erreicht|nicht (ran|dran)gegangen|mailbox|ging keiner ran|nicht erreichbar)/.test(low)) { items.push({ type: "call", pid: pp.id, ok: false, t: "nicht erreicht" }); continue; }
    if (pp && /(telefoniert|angerufen|gesprochen|anruf erledigt)/.test(low) && !/(erinnere|muss|soll|anrufen\b)/.test(low)) {
      items.push({ type: "call", pid: pp.id, ok: true, t: "erreicht" });
      // Rest des Satzes als Notiz (z. B. "..., er fliegt Freitag nach China")
      const restNote = s.replace(/^.*?(telefoniert|angerufen|gesprochen)[,.\s]*/i, "").replace(/^(und\s+)?/i, "").trim();
      if (restNote.length > 3) items.push({ type: "note", pid: pp.id, t: cap(restNote.replace(/[.!?]+$/, "")) });
      continue;
    }
    // Notiz zu Person (Name oder "er/sie" nach einem Namen), solange es keine Erinnerung ist
    if (pp && !/(erinner|nicht vergessen|\bmuss\b|\bsollte\b|aufgabe|to-?do|anrufen|schreiben|gratulieren|besorgen|kaufen|zurückrufen|melden)/.test(low)) { items.push({ type: "note", pid: pp.id, t: cap(s.replace(/^notiz\s*(zu|für|bei)?\s*:?\s*/i, "").replace(/[.!?]+$/, "")) }); continue; }
    // Aufgabe / Erinnerung
    const w = parseWhen(s);
    const isTask = /(erinner|nicht vergessen|muss|sollte|aufgabe|to-?do|termin|anrufen|schreiben|kaufen|bezahlen|kündigen|buchen|abholen|bringen|melden|antworten|zurück)/.test(low) || w.date || w.trig;
    if (isTask) {
      const t = cleanTask(w.rest);
      if (t) { items.push({ type: "todo", t, date: w.date, time: w.time, trig: w.trig, pid: pp ? pp.id : "" }); continue; }
    }
    // Notiz zu Person
    if (pp) { items.push({ type: "note", pid: pp.id, t: cap(s.replace(/[.!?]+$/, "")) }); continue; }
    // Rest: Aufgabe ohne Termin
    const t = cleanTask(s); if (t) items.push({ type: "todo", t, date: "", time: "", trig: "" });
  }
  return items;
}
let pending = [];
function voiceReview() {
  recStop();
  const txt = ($("#v-text").value || "").trim();
  if (!txt) { toast("Noch nichts gesagt oder getippt"); return; }
  pending = understand(txt);
  if (!pending.length) pending = [{ type: "todo", t: cap(txt), date: "", time: "", trig: "" }];
  reviewRender(txt);
}
const TYPES = [["todo", "Aufgabe"], ["shop", "Einkauf"], ["note", "Notiz zu Person"], ["call", "Anruf"], ["expense", "Ausgabe"]];
function reviewRender(txt) {
  const pOpts = pid => `<option value="">Person wählen …</option>` + S.people.slice().sort((a, b) => fullName(a).localeCompare(fullName(b), "de")).map(p => `<option value="${p.id}"${p.id === pid ? " selected" : ""}>${esc(fullName(p))}</option>`).join("");
  openSheet(`<p class="stitle">Das habe ich verstanden</p><p class="quote" style="font-size:15px">„${esc(txt)}“</p>
  <div id="pitems">${pending.map((it, i) => `<div class="pitem" data-i="${i}"><div class="ph"><select data-pf="type" aria-label="Art">${TYPES.map(([v, l]) => `<option value="${v}"${v === it.type ? " selected" : ""}>${l}</option>`).join("")}</select><button class="rowdel" data-act="pdel" data-i="${i}" aria-label="Weglassen" style="margin-left:auto">✕</button></div>
    ${it.type === "note" || it.type === "call" ? `<select data-pf="pid" style="width:100%;margin-bottom:6px;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:8px;font:inherit;font-size:16px">${pOpts(it.pid)}</select>` : ""}
    ${it.type === "call" ? `<select data-pf="ok" style="width:100%;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:8px;font:inherit;font-size:16px"><option value="1"${it.ok !== false ? " selected" : ""}>erreicht</option><option value="0"${it.ok === false ? " selected" : ""}>nicht erreicht</option></select>` : `<input data-pf="t" value="${esc(it.t || "")}" aria-label="Text">`}
    ${it.type === "todo" ? `<div class="pg"><input type="date" data-pf="date" value="${esc(it.date || "")}" aria-label="Datum"><input type="time" data-pf="time" value="${esc(it.time || "")}" aria-label="Uhrzeit"></div>${it.trig === "verlassen" ? '<div class="swipehint" style="text-align:left;margin:0">bevor du losgehst</div>' : ""}` : ""}
    ${it.type === "expense" ? `<div class="pg"><input data-pf="amount" inputmode="decimal" value="${it.amount != null ? String(it.amount).replace(".", ",") : ""}" placeholder="Betrag €" aria-label="Betrag"><select data-pf="cat" style="background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:8px;font:inherit;font-size:14px;margin-bottom:6px">${catList().map(c => `<option${c === it.cat ? " selected" : ""}>${c}</option>`).join("")}</select></div>` : ""}
  </div>`).join("") || empty("Alles weggelassen.")}</div>
  <div class="row2"><button class="btn" data-act="vback" style="flex:none">‹ Zurück</button><button class="btn" data-close="sheet">Abbrechen</button><button class="btn pri" data-act="vsave"${pending.length ? "" : " disabled"}>Speichern</button></div>`);
  sheetCleanup = null;
  $("#pitems").addEventListener("change", e => { const el = e.target, box = el.closest(".pitem"); if (!box) return; const it = pending[+box.dataset.i]; readItem(box, it); if (el.dataset.pf === "type") { it.type = el.value; reviewRender(txt); } });
  $("#pitems").addEventListener("input", e => { const box = e.target.closest(".pitem"); if (box) readItem(box, pending[+box.dataset.i]); });
  voiceReview.lastTxt = txt;
}
function readItem(box, it) {
  box.querySelectorAll("[data-pf]").forEach(el => { const k = el.dataset.pf; if (k === "type") return; if (k === "ok") it.ok = el.value === "1"; else if (k === "amount") it.amount = parseAmount(el.value); else it[k] = el.value; });
}
function voiceSave() {
  $$("#pitems .pitem").forEach(b => readItem(b, pending[+b.dataset.i]));
  let n = 0; const miss = [];
  for (const it of pending) {
    if (it.type === "shop" && it.t) { if (addShop(it.t)) n++; }
    else if (it.type === "todo" && it.t) { S.todos.push({ id: uid(), t: it.t, pid: it.pid || "", list: "todo", done: false, created: today(), date: it.trig === "verlassen" ? "" : it.date || "", time: it.time || "", trig: it.trig || "zeit", rep: "nie", area: "", nerv: false }); n++; }
    else if (it.type === "note" || it.type === "call") {
      const p = S.people.find(x => x.id === it.pid); if (!p) { miss.push(it); continue; }
      if (it.type === "note" && it.t) { p.notes = p.notes || []; p.notes.unshift({ id: uid(), t: it.t, d: today() }); n++; }
      if (it.type === "call") { logCall(p, it.ok !== false, true); n++; }
    }
    else if (it.type === "expense") { if (it.amount == null) { miss.push(it); continue; } S.expenses.push({ id: uid(), d: today(), amount: it.amount, shop: it.shop || it.t || "", cat: it.cat || "Sonstiges", photo: null }); n++; }
  }
  if (miss.length) { toast("Bitte bei " + miss.length + " Eintrag" + (miss.length > 1 ? "en" : "") + " noch Person bzw. Betrag wählen"); return; }
  save(); closeSheet(); render(true); toast(n === 1 ? "1 Eintrag gespeichert" : n + " Einträge gespeichert");
}
function logCall(p, ok, silent) {
  p.calls = p.calls || []; p.calls.push({ id: uid(), d: today(), ok });
  p.snooze = ok ? null : addWorkdays(today(), +S.settings.retryWorkdays || 2);
  if (!silent) { save(); closeSheet(); render(true); toast(ok ? `${p.first || fullName(p)} erreicht. Nächster Anruf ${relDate(nextDue(p) || today())}` : `Neuer Versuch ${relDate(p.snooze)}`); }
}

/* ---------- vCard / Sicherung ---------- */
function parseVCF(text) {
  const out = [], cards = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/BEGIN:VCARD/i).slice(1);
  for (const c of cards) {
    const lines = c.split(/\r?\n/), get = re => { const l = lines.find(x => re.test(x)); return l ? l.slice(l.indexOf(":") + 1).trim() : ""; };
    const dec = s => s.replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\n/gi, " ");
    const n = get(/^(item\d+\.)?N[;:]/i).split(";").map(dec), fn = dec(get(/^(item\d+\.)?FN[;:]/i));
    let first = n[1] || "", last = n[0] || "";
    if (!first && !last && fn) { const parts = fn.split(" "); first = parts.shift(); last = parts.join(" "); }
    const telLines = lines.filter(x => /^(item\d+\.)?TEL[;:]/i.test(x));
    const pref = telLines.find(x => /CELL|IPHONE|MOBILE/i.test(x)) || telLines[0];
    const tel = pref ? pref.slice(pref.indexOf(":") + 1).replace(/^tel:/i, "").trim() : "";
    let bday = get(/^(item\d+\.)?BDAY/i).replace(/T.*$/, "");
    if (/^\d{8}$/.test(bday)) bday = `${bday.slice(0, 4)}-${bday.slice(4, 6)}-${bday.slice(6, 8)}`;
    if (/^--\d{4}$/.test(bday)) bday = `1604-${bday.slice(2, 4)}-${bday.slice(4, 6)}`;
    if (/^--\d{2}-\d{2}$/.test(bday)) bday = "1604" + bday.slice(1);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bday)) bday = "";
    const nick = dec(get(/^(item\d+\.)?NICKNAME/i));
    const email = get(/^(item\d+\.)?EMAIL/i).replace(/^mailto:/i, "");
    const adr = get(/^(item\d+\.)?ADR/i).split(";").map(dec);
    const addr = adr.length > 2 ? [adr[2], [adr[5], adr[3]].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "";
    if (first || last) out.push({ first: dec(first), last: dec(last), tel, bday, nick, email, addr });
  }
  return out;
}
async function exportData() {
  toast("Sicherung wird erstellt …");
  const photos = {}; try { const all = await photoAll(); for (const [k, b] of Object.entries(all)) photos[k] = await blobToDataURL(b); } catch (_) { }
  const json = JSON.stringify({ app: "Mirella", version: VERSION, exported: new Date().toISOString(), data: S, photos });
  const name = `Mirella-Sicherung_${today()}.json`, file = new File([json], name, { type: "application/json" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === "AbortError") return; } }
  const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
async function importData(file) {
  try {
    const j = JSON.parse(await file.text()); if (!j || !j.data || !Array.isArray(j.data.people)) throw new Error();
    if (!confirm(`Sicherung vom ${new Date(j.exported).toLocaleString("de-DE")} laden? Die Daten auf diesem Gerät werden ersetzt.`)) return;
    await photoClear(); for (const [k, u] of Object.entries(j.photos || {})) await photoPut(k, await dataURLToBlob(u));
    S = Object.assign(blank(), j.data); S.settings = Object.assign(blank().settings, j.data.settings || {});
    save(); view = "heute"; render(); toast("Sicherung geladen");
  } catch (_) { toast("Das ist keine gültige Mirella-Sicherung"); }
}

/* ---------- Klicks ---------- */
const ACT = {
  ics: el => icsOpen(S.todos.find(x => x.id === el.dataset.id)),
  openbrief: (el, e) => { if (e.target.closest('[data-act="delbrief"]')) return; openBrief(el.dataset.id); },
  delbrief: async (el, e) => { e.stopPropagation(); if (!confirm("Briefing löschen?")) return; await photoDel(el.dataset.id); S.briefings = S.briefings.filter(b => b.id !== el.dataset.id); save(); render(true); },
  addbrief: () => { const f = $("#f-brief"); f.value = ""; f.click(); },
  wxhere: () => { S.settings.wxLat = null; S.settings.wxLon = null; S.settings.wxName = ""; save(); try { localStorage.removeItem("mirella.geo"); } catch (_) { } WX = null; render(true); loadWeather(true); toast("Wetter nach Standort"); },
  dupforce: el => { savePerson.force = true; savePerson(el.dataset.id); },
  dupmerge: el => {
    const t = S.people.find(x => x.id === el.dataset.id), selfId = el.dataset.self;
    const f = $("#c-first"); const data = { first: f.value.trim(), last: $("#c-last").value.trim(), tel: $("#c-tel").value.trim(), email: $("#c-mail").value.trim(), cyc: $("#c-cyc").value, group: $("#c-grp").value.trim(), bday: $("#c-bday").value, gift: $("#c-gift").checked, addr: $("#c-addr").value.trim(), nick: $("#c-nick").value.trim() };
    if (selfId) { const me = S.people.find(x => x.id === selfId); Object.assign(me, data); mergeInto(t, me); S.people = S.people.filter(x => x !== me); } else mergeInto(t, data);
    save(); closeSheet(); cur = t.id; view = "akte"; render(); toast("Zusammengeführt: " + fullName(t));
  },
  dupscan: () => {
    const pairs = [], seen = new Set();
    for (const p of S.people) { if (seen.has(p.id)) continue; for (const d of findDups(p, p.id)) { if (seen.has(d.id)) continue; pairs.push([p, d]); } seen.add(p.id); }
    openSheet(`<p class="stitle">Doppelte Kontakte</p>${pairs.length ? pairs.map(([a, b]) => `<div class="pitem"><div><b>${esc(fullName(a))}</b>${a.tel ? " · " + esc(a.tel) : ""}</div><div><b>${esc(fullName(b))}</b>${b.tel ? " · " + esc(b.tel) : ""}</div><div class="row2" style="margin-top:8px"><button class="btn pri" data-act="dodupmerge" data-a="${a.id}" data-b="${b.id}">Zusammenführen</button></div></div>`).join("") : empty("Keine doppelten Kontakte gefunden.")}<div class="row2"><button class="btn" data-close="sheet">Schließen</button></div>`);
  },
  dodupmerge: el => { const a = S.people.find(x => x.id === el.dataset.a), b = S.people.find(x => x.id === el.dataset.b); if (!a || !b) return; mergeInto(a, b); S.people = S.people.filter(x => x !== b); save(); toast("Zusammengeführt: " + fullName(a)); ACT.dupscan(); },
  go: el => { closeAll(); view = el.dataset.v; render(); },
  drawer: () => openDrawer(),
  photo: el => photoStart(el.dataset.kind, el.dataset.area || (view === "bereich" ? area : null)),
  pickcam: () => { const f = $("#f-cam"); f.value = ""; f.click(); },
  picklib: () => { const f = $("#f-lib"); f.value = ""; f.click(); },
  photokind: el => { photoCtx.kind = el.dataset.k; photoForm(); },
  photosave: () => photoSave(),
  viewphoto: el => viewPhoto(el.dataset.id),
  person: el => { cur = el.dataset.id; view = "akte"; render(); },
  area: el => { area = el.dataset.id; closeDrawer(); view = "bereich"; render(); },
  call: (el, e) => { e.stopPropagation(); const p = S.people.find(x => x.id === el.dataset.id); if (!p) return; if (!p.tel) { personForm(p); toast("Erst eine Telefonnummer eintragen"); return; } callResult(p, true); },
  logcall: el => callResult(S.people.find(x => x.id === el.dataset.id), false),
  callok: el => logCall(S.people.find(x => x.id === el.dataset.id), true),
  callno: el => logCall(S.people.find(x => x.id === el.dataset.id), false),
  snooze: el => snoozeForm(S.people.find(x => x.id === el.dataset.id)),
  dosnooze: el => { const p = S.people.find(x => x.id === el.dataset.id); p.snooze = el.dataset.d; save(); closeSheet(); render(true); toast(`${fullName(p)}: ${relDate(p.snooze)} wieder dran`); },
  delcall: el => { const p = S.people.find(x => x.id === cur); p.calls = p.calls.filter(c => c.id !== el.dataset.id); save(); render(true); },
  editperson: el => personForm(S.people.find(x => x.id === el.dataset.id)),
  saveperson: el => savePerson(el.dataset.id),
  delperson: el => { const p = S.people.find(x => x.id === el.dataset.id); if (!confirm(fullName(p) + " wirklich löschen?")) return; S.people = S.people.filter(x => x !== p); save(); closeSheet(); view = "menschen"; render(); toast("Gelöscht"); },
  askdone: el => { const p = S.people.find(x => x.id === cur), a = p.ask.find(x => x.id === el.dataset.id); a.done = !a.done; save(); render(true); },
  delakte: el => { const p = S.people.find(x => x.id === cur); p[el.dataset.k] = p[el.dataset.k].filter(x => x.id !== el.dataset.id); save(); render(true); },
  toggle: el => toggleTodo(el.dataset.id),
  edittodo: el => { const t = S.todos.find(x => x.id === el.dataset.id); if (t && t.list === "einkauf") return; if (t) todoForm(t); },
  deltodo: el => { S.todos = S.todos.filter(x => x.id !== el.dataset.id); save(); closeSheet(); render(true); toast("Gelöscht"); },
  savetodo: el => saveTodo(el.dataset.id),
  newtodo: el => todoForm(null, { date: el.dataset.d || "", area: el.dataset.area || "" }),
  todolist: el => { todoList = el.dataset.l; showDone = false; render(); },
  showdone: () => { showDone = !showDone; render(true); },
  cleardone: () => { S.todos = S.todos.filter(t => !(t.list === "einkauf" && t.done)); save(); render(true); },
  shoplist: () => { todoList = "einkauf"; view = "todos"; render(); },
  mstep: el => shiftMonth(+el.dataset.n),
  calview: el => { calView = el.dataset.cv; render(); },
  selday: el => { selDate = el.dataset.d; render(true); },
  newexp: () => expenseForm(),
  saveexp: () => { const a = parseAmount($("#e-amt").value); if (a == null) { toast("Bitte den Betrag eintragen"); return; } S.expenses.push({ id: uid(), d: $("#e-date").value || today(), amount: a, shop: $("#e-shop").value.trim(), cat: $("#e-cat").value, photo: null }); save(); closeSheet(); render(true); toast("Gespeichert: " + eur(a)); },
  delexp: async el => { const e = S.expenses.find(x => x.id === el.dataset.id); if (!confirm("Ausgabe löschen?")) return; if (e.photo) await photoDel(e.photo); S.expenses = S.expenses.filter(x => x !== e); save(); render(true); },
  deldoc: async el => { const d = S.docs.find(x => x.id === el.dataset.id); if (!confirm(d.name + " löschen?")) return; if (d.photo) await photoDel(d.photo); S.docs = S.docs.filter(x => x !== d); save(); render(true); },
  delnote: el => { S.notes = S.notes.filter(x => x.id !== el.dataset.id); save(); render(true); },
  vagain: () => recStart(),
  vnext: () => voiceReview(),
  vback: () => { const t = voiceReview.lastTxt || ""; voiceStart(); recStop(); $("#v-text").value = t; $("#v-state").textContent = "Ändern oder auf „Nochmal“ tippen."; },
  vsave: () => voiceSave(),
  pdel: el => { $$("#pitems .pitem").forEach(b => readItem(b, pending[+b.dataset.i])); pending.splice(+el.dataset.i, 1); reviewRender(voiceReview.lastTxt); },
  importvcf: () => { const f = $("#f-vcf"); f.value = ""; f.click(); },
  export: () => exportData(),
  import: () => { const f = $("#f-import"); f.value = ""; f.click(); },
  wipe: async () => { if (!confirm("Wirklich ALLE Daten auf diesem Gerät löschen? Das geht nicht rückgängig.")) return; S = blank(); save(); await photoClear(); view = "heute"; render(); toast("Alles gelöscht"); }
};
document.addEventListener("click", e => {
  const c = e.target.closest("[data-close]");
  if (c) { c.dataset.close === "drawer" ? closeDrawer() : closeSheet(); return; }
  if (e.target.id === "scrim") { closeAll(); return; }
  const tab = e.target.closest(".tab");
  if (tab) { view = tab.dataset.v; q = ""; closeAll(); render(); return; }
  if (e.target.closest("#mic")) { if ($("#sheet").classList.contains("open") && $("#v-text")) { closeSheet(); return; } voiceStart(); return; }
  if (e.target.closest("#plus")) {
    if (view === "menschen") personForm(null);
    else if (view === "todos" && todoList === "einkauf") { const i = $("#shopin"); i && i.focus(); }
    else if (view === "kalender") todoForm(null, { date: selDate });
    else if (view === "bereich") todoForm(null, { area });
    else todoForm(null);
    return;
  }
  const a = e.target.closest("[data-act]");
  if (a && ACT[a.dataset.act]) {
    if (a.tagName === "INPUT" && a.type === "checkbox") return; // über "change"
    e.preventDefault(); ACT[a.dataset.act](a, e);
  }
});
document.addEventListener("change", e => {
  const el = e.target;
  if (el.matches('input[type=checkbox][data-act="toggle"]')) { toggleTodo(el.dataset.id); return; }
  if (el.dataset.set) { const k = el.dataset.set; S.settings[k] = el.tagName === "SELECT" ? +el.value : el.value.trim(); save(); toast("Gespeichert"); return; }
  if (el.id === "f-cam" || el.id === "f-lib") { photoChosen(el.files[0]); return; }
  if (el.id === "f-brief") { el.files.length && addBriefings([...el.files]); return; }
  if (el.id === "f-import") { el.files[0] && importData(el.files[0]); return; }
  if (el.id === "f-vcf") {
    const f = el.files[0]; if (!f) return;
    f.text().then(txt => {
      const list = parseVCF(txt); let added = 0, skipped = 0;
      for (const c of list) {
        const d0 = findDups(c, null)[0];
        if (d0) { mergeInto(d0, c); skipped++; continue; }
        S.people.push({ id: uid(), created: today(), calls: [], notes: [], ask: [], gifts: [], cyc: "nur Geburtstag", group: "", gift: false, addr: "", ...c }); added++;
      }
      save(); view = "menschen"; render(); toast(`${added} Kontakte übernommen${skipped ? ", " + skipped + " schon vorhanden (ergänzt)" : ""}. Anruf-Rhythmus je Person unter „Bearbeiten“.`);
    }).catch(() => toast("Datei konnte nicht gelesen werden"));
  }
});
document.addEventListener("input", e => {
  if (e.target.id === "q") { q = e.target.value; const pos = e.target.selectionStart; render(true); const i = $("#q"); i.focus(); try { i.setSelectionRange(pos, pos); } catch (_) { } }
});
document.addEventListener("submit", e => {
  const f = e.target; e.preventDefault();
  const inp = f.querySelector("input"), v = inp ? inp.value.trim() : "";
  if (!v) return;
  if (f.dataset.form === "shop") { const dup = splitItems(v).filter(t => !addShop(t)); if (dup.length) toast("Schon auf der Liste: " + dup.join(", ")); save(); render(true); const i = $("#shopin"); i && i.focus(); return; }
  if (f.dataset.form === "akte") { const p = S.people.find(x => x.id === cur), k = f.dataset.k; p[k] = p[k] || []; p[k].unshift({ id: uid(), t: v, d: today() }); save(); render(true); toast("Hinzugefügt"); return; }
  if (f.dataset.form === "wxplace") { setWxPlace(v); return; }
  if (f.dataset.form === "cat") { S.settings.cats = [...new Set([...(S.settings.cats || []), v])]; save(); render(true); toast("Kategorie hinzugefügt: " + v); return; }
  if (f.dataset.form === "note") { S.notes.push({ id: uid(), area, t: v, d: today() }); save(); render(true); toast("Notiz gespeichert"); }
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { document.querySelectorAll(".pdfview,.imgfull").forEach(x => x.remove()); closeAll(); return; }
  if ((e.key === "Enter" || e.key === " ") && e.target.matches("[role=button][data-act]")) { e.preventDefault(); e.target.click(); }
});
function shiftMonth(k) { calM += k; if (calM < 0) { calM = 11; calY--; } if (calM > 11) { calM = 0; calY++; } selDate = iso(new Date(calY, calM, 1, 12)); if (today().startsWith(`${calY}-${pad(calM + 1)}`)) selDate = today(); render(); }
let tx = null, ty = null;
$("#screen").addEventListener("touchstart", e => { if (view === "kalender" && calView === "monat") { tx = e.touches[0].clientX; ty = e.touches[0].clientY; } else tx = null; }, { passive: true });
$("#screen").addEventListener("touchend", e => { if (tx === null) return; const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) shiftMonth(dx < 0 ? 1 : -1); tx = null; });
/* Wisch nach unten auf dem Sheet-Kopf schließt */
let sy = null;
$("#sheet").addEventListener("touchstart", e => { sy = $("#sheet").scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
$("#sheet").addEventListener("touchend", e => { if (sy !== null && e.changedTouches[0].clientY - sy > 120 && !e.target.closest("textarea,input,select")) closeSheet(); sy = null; });
document.addEventListener("visibilitychange", () => { if (!document.hidden && !$("#sheet").classList.contains("open") && !document.querySelector(".pdfview")) { render(true); loadWeather(); } });

/* ---------- Start ---------- */
load();
render();
loadWeather();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("./sw.js").catch(() => { });
