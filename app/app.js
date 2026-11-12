/* Mirella – die persönliche Sekretärin (Web-App, läuft auf dem Gerät, Abgleich über sync.js)
   Daten: localStorage "mirella.v1", Fotos/PDFs: IndexedDB "mirella" / "photos".
   Weitere Teile: logik.js (Rechnen), bereiche.js (Rubriken), scan.js (Briefe), wecker.js, suche.js. */
"use strict";
const VERSION = "0.33";
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
const pl = (n, one, many) => n + " " + (n === 1 ? one : many);
const eur = n => (+n || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

/* ---------- Daten ---------- */
const CYCLES = ["wöchentlich", "alle 2 Wochen", "monatlich", "vierteljährlich", "halbjährlich", "jährlich", "nie"];
const cycLabel = c => c === "nie" || c === "nur Geburtstag" ? "nie anrufen" : c;
const noCycle = c => !c || c === "nie" || c === "nur Geburtstag";
const BASEGROUPS = ["Familie", "Freunde", "Bekannte", "Geschäftlich"];
const PRIOS = [[1, "Hoch", "#C2372D"], [2, "Mittel", "#D98E04"], [3, "Niedrig", "#2E7BBF"]];
const prioOf = t => PRIOS.find(p => p[0] === +t.prio) || null;
const byPrio = (a, b) => (+a.prio || 9) - (+b.prio || 9);
const REPS = ["nie", "täglich", "wöchentlich", "alle 2 Wochen", "monatlich", "vierteljährlich", "jährlich"];
const BASECATS = ["Lebensmittel & Supermarkt", "Getränke", "Bäcker & Metzger", "Restaurant & Café", "Tanken & Auto", "Kleidung", "Drogerie & Gesundheit", "Haushalt & Wohnen", "Hobby & Sport", "Freizeit & Ausgehen", "Reisen", "Geschenke", "Technik & Abos", "Sonstiges"];
const catList = () => [...new Set([...BASECATS, ...((S && S.settings.cats) || []), ...((S && S.expenses.map(e => e.cat)) || [])].filter(Boolean))];
const FOLDERS = ["Brief", "Rechnung", "Bescheid", "Vertrag", "Versicherung", "Kontoauszug", "Lohnabrechnung", "Steuer", "Ausweis & Urkunde", "Garantie & Kaufbeleg", "Gesundheit", "Sonstiges"];
/* Ordner: feste plus eigene (S.folders); „＋ Eigener Ordner …“ legt einen neuen an */
const allFolders = () => [...new Set([...FOLDERS, ...(S.folders || [])])];
const folderOpts = sel => [...new Set([...allFolders(), sel || "Sonstiges"])].filter(Boolean).map(x => `<option${x === sel ? " selected" : ""}>${esc(x)}</option>`).join("") + '<option value="__new">＋ Eigener Ordner …</option>';
document.addEventListener("change", e => { const el = e.target; if (!el.matches || !el.matches("#d-folder,#dd-folder") || el.value !== "__new") return; const n = (prompt("Name des neuen Ordners, z. B. „Zahnarzt“ oder „Steuer 2026“") || "").trim(); if (!n) { el.selectedIndex = 0; return; } S.folders = S.folders || []; if (!allFolders().includes(n)) S.folders.push(n); save(); el.innerHTML = folderOpts(n); el.dataset.touched = 1; });
const IC = {
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 16V11l2-5h10l2 5v5"/><path d="M3 16h18v3H3zM7 19v2M17 19v2"/><circle cx="7.5" cy="13.5" r="1"/><circle cx="16.5" cy="13.5" r="1"/></svg>',
  geld: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M17 6.5A7 7 0 1 0 17 17.5"/><path d="M4 10h9M4 14h9"/></svg>',
  gesund: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  haus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/></svg>',
  doku: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
  frei: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15.5v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0v5l-8 5v2l8-2.5v5.5l-2.5 2v1.5l4-1 4 1V20l-2.5-2v-5.5z"/></svg>',
  arbeit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/></svg>',
  sport: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6c3 3 3 9.8 0 12.8M18.4 5.6c-3 3-3 9.8 0 12.8"/></svg>',
  vertrag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10v18H7z"/><path d="M10 8h4M10 12h4M10 16l1.5 1.5L15 14"/></svg>',
  wecker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M4 4.5l3-2M20 4.5l-3-2"/></svg>',
  such: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>',
  cam: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  call: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.2A5 5 0 0 1 21 19"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 12l3 3 5-6"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.4 10 4.25 4.25 0 0 0 7 18.5z"/><path d="M9.5 14.5l2 2 3.5-4"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.2"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
};
/* Reihenfolge = Wichtigkeit im Alltag; Dokumente, Reisen und Briefings bewusst hinten */
const AREAS = [
  { id: "wecker", n: "Wecker", ic: "wecker", c: "#5B5BD6" },
  { id: "geld", n: "Finanzen", ic: "geld", c: "#2E8B4E" },
  { id: "vertrag", n: "Verträge & Versicherungen", ic: "vertrag", c: "#2E7BBF" },
  { id: "gesund", n: "Gesundheit", ic: "gesund", c: "#C2416B" },
  { id: "haus", n: "Zuhause", ic: "haus", c: "#C27A1A" },
  { id: "auto", n: "Auto & E-Bike", ic: "auto", c: "#4D6A84" },
  { id: "arbeit", n: "Arbeit", ic: "arbeit", c: "#7A4FB5" },
  { id: "sport", n: "Sport & Hobby", ic: "sport", c: "#138A8A" },
  { id: "doku", n: "Dokumente", ic: "doku", c: "#8A6A3D" },
  { id: "frei", n: "Reisen", ic: "frei", c: "#0E8FB8" }
];
const areaById = id => AREAS.find(a => a.id === id);
/* Andere Teile (bereiche.js, wecker.js …) hängen sich hier ein */
const HOOKS = { heute: [], heuteTop: [], events: [], start: [], search: [], menschenTop: [] };

function blank() {
  return {
    v: 1,
    settings: {
      name: "Felix", maxCalls: 3, retryWorkdays: 2, giveUp: 5, giftLead: 14, callFrom: 8, callTo: 18, callDays: [1, 2, 3, 4, 5], msgFrom: 8, msgTo: 21, msgDays: [0, 1, 2, 3, 4, 5, 6], roundLead: 183, roundAges: [18, 20, 30, 40, 50, 60, 70, 80, 90, 100], wxHint: { regen: 1, schnee: 1, gewitter: 1, frost: 1, sturm: 1, wind: 1, hitze: 1, jacke: 1, zwiebel: 1, uv: 1, nebel: 1 }, shopHistDays: 90,
      cats: [], wxName: "", wxLat: null, wxLon: null, showBrief: 1, showWx: 1,
      nerv: { anrufe: 1, aufgaben: 1, geburtstage: 1, fristen: 1, supplements: 1 }, nervEvery: 30, nervSound: 1,
      calFilter: { geb: 1, erin: 1, todo: 1, anruf: 1, treff: 1 }, calStart: "monat",
      income: 0, budgets: {}, contractLead: 30, huLead: 28, pcEvery: 0, pcLast: "", washMin: 120, suppMorning: "07:30", suppNoon: "12:30", suppEvening: "21:00",
      homeAddr: "", homeLat: null, homeLon: null, prepMin: 30, bufMin: 10, alarmCount: 3, alarmGap: 5, gmapsKey: ""
    },
    briefings: [],
    people: [], todos: [], expenses: [], goals: [], sick: null, docs: [], notes: [], items: [], alarms: [], shopTpl: [], shopFreq: {}, shopUnits: {}, folders: [], groups: BASEGROUPS.slice(), goneP: []
  };
}
let S;
function load() {
  try { const raw = localStorage.getItem(KEY); S = raw ? JSON.parse(raw) : blank(); } catch (_) { S = blank(); }
  const b = blank();
  for (const k of Object.keys(b)) if (S[k] == null) S[k] = b[k];
  S.settings = Object.assign(b.settings, S.settings || {});
  for (const k of ["nerv", "calFilter", "wxHint"]) S.settings[k] = Object.assign({}, b.settings[k], S.settings[k] || {});
  migrate();
}
/* Ältere Stände an die neue Struktur anpassen (läuft bei jedem Start, ändert nur, was nötig ist) */
function migrate() {
  S.people.forEach(p => { if (p.cyc === "nur Geburtstag") p.cyc = "nie"; });
  const OLD = ["Paddeln", "Fußball München", "Stammtisch", "Arbeit"], used = new Set(S.people.map(p => p.group).filter(Boolean));
  S.groups = [...new Set([...BASEGROUPS, ...(S.groups || []).filter(g => !OLD.includes(g) || used.has(g)), ...used])];
}
/* Einmalig (Wunsch Felix 12.11.): Supplements als ganz normale tägliche To-dos mit Nerv-Modus.
   Läuft erst, wenn die Daten da sind, legt nichts doppelt an und kommt nicht wieder, wenn Felix sie löscht. */
function suppTodosAnlegen() {
  if (S.settings.suppTodos || S.people.length < 5) return false;
  const T = [["Supplements morgens: Kreatin, Multivitamin, Omega-3", S.settings.suppMorning || "07:30"], ["Magnesium-Bisglycinat nehmen", "15:00"]];
  for (const [t, time] of T) if (!S.todos.some(x => x.t.toLowerCase() === t.toLowerCase())) S.todos.push({ id: uid(), t, pid: "", list: "todo", done: false, created: today(), date: today(), time, trig: "zeit", rep: "täglich", area: "gesund", nerv: true, prio: "", ort: "" });
  S.settings.suppTodos = 1; save(); return true;
}
function save() {
  for (const p of S.people) { if (p.tel && p.tel[0] !== "+") p.tel = telNice(p.tel); if (p.tels) for (const x of p.tels) if (x.n && x.n[0] !== "+") x.n = telNice(x.n); }
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
/* Profilbild oder Initialen */
const avHTML = (p, cls = "") => `<span class="av${cls}">${p.pic ? `<img class="avimg" data-thumb="${esc(p.pic)}" alt="">` : esc(initials(p))}</span>`;
const initials = p => ((p.first || "")[0] || "" + "") .toUpperCase() + ((p.last || "")[0] || "").toUpperCase() || "?";
function lastCall(p, okOnly = true) { const c = (p.calls || []).filter(x => !okOnly || x.ok).sort((a, b) => a.d < b.d ? 1 : -1)[0]; return c ? c.d : null; }
/* Fehlversuche in Folge (neueste zuerst, bis zum letzten Erreichen) */
function failStreak(p) { let n = 0; for (const c of (p.calls || []).slice().sort((a, b) => a.d < b.d ? 1 : a.d > b.d ? -1 : 0)) { if (c.ok) break; n++; } return n; }
/* Nerven hört auf: nach so vielen Fehlversuchen hintereinander (Einstellung), bis du „weiter versuchen“ oder „archivieren“ wählst */
function gaveUp(p) { const g = +S.settings.giveUp || 0; return g > 0 && failStreak(p) - (+p.streakBase || 0) >= g; }
function nextDue(p) {
  if (p.arch || p.death || gaveUp(p)) return null;
  if (noCycle(p.cyc)) return null;
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
/* Anrufplan: höchstens maxCalls pro Werktag; Überzählige rutschen auf die nächsten Werktage. „Vorziehen“ holt weitere auf heute. */
/* Anruftage (0 = So … 6 = Sa), einstellbar unter Einstellungen › Kontakte */
const callDays = () => (Array.isArray(S.settings.callDays) && S.settings.callDays.length ? S.settings.callDays : [1, 2, 3, 4, 5]).map(Number);
const msgDays = () => (Array.isArray(S.settings.msgDays) && S.settings.msgDays.length ? S.settings.msgDays : [0, 1, 2, 3, 4, 5, 6]).map(Number);
const addCallDays = (s, n) => { let d = s; const ds = callDays(); while (n > 0) { d = addDays(d, 1); if (ds.includes(D(d).getDay())) n--; } return d; };
const WDS = [[1, "Mo"], [2, "Di"], [3, "Mi"], [4, "Do"], [5, "Fr"], [6, "Sa"], [0, "So"]];
const dayLabel = ds => { const s = WDS.filter(([d]) => ds.includes(d)).map(x => x[1]); if (s.length === 7) return "jeden Tag"; if (s.join() === "Mo,Di,Mi,Do,Fr") return "Mo–Fr"; return s.join(", ") || "nie"; };
const setDays = (k, label, cur) => `<div class="set" style="display:block"><span>${label}<small>${esc(dayLabel(cur))}</small></span><div class="daychips">${WDS.map(([d, l]) => `<button class="chip2" data-act="setday" data-k="${k}" data-d="${d}" aria-pressed="${cur.includes(d)}">${l}</button>`).join("")}</div></div>`;
function callsToday() { const t = today(); return S.people.filter(p => (p.calls || []).some(c => c.d === t)).length; }
function callPlanMap() {
  const t = today(), due = S.people.filter(p => { const d = nextDue(p); return d && d <= t; }).sort((a, b) => nextDue(a) < nextDue(b) ? -1 : 1);
  const pull = S.pull && S.pull.d === t ? S.pull.ids : [], map = {};
  const rest = due.filter(p => !pull.includes(p.id));
  Object.assign(map, L.callPlan(rest.map(p => p.id), t, +S.settings.maxCalls || 3, Math.max(0, callsToday() - pull.filter(id => S.people.some(p => p.id === id && (p.calls || []).some(c => c.d === t))).length), 0, callDays()));
  pull.forEach(id => { const p = S.people.find(x => x.id === id); if (p && !(p.calls || []).some(c => c.d === t && c.ok)) map[id] = t; });
  return map;
}
function callsForToday() { const m = callPlanMap(), t = today(); return S.people.filter(p => m[p.id] === t).sort((a, b) => (nextDue(a) || "9999") < (nextDue(b) || "9999") ? -1 : 1); }
function pullPool() { const m = callPlanMap(), t = today(); return S.people.filter(p => !(p.calls || []).some(c => c.d === t)).filter(p => m[p.id] ? m[p.id] > t : (nextDue(p) && nextDue(p) > t && diffDays(t, nextDue(p)) <= 21)).sort((a, b) => (m[a.id] || nextDue(a)) < (m[b.id] || nextDue(b)) ? -1 : 1); }
function planLabel(p) { const m = callPlanMap()[p.id]; if (!m) return null; const n = diffDays(today(), m); return n <= 0 ? "heute" : n === 1 ? "morgen" : fmtDate(m).replace(/^(\w+)\.?,? /, "$1. "); }
/* Treffen vereinbaren (früher „Mittagessen“): eigener Rhythmus je Kontakt, unabhängig von den Anrufen. Die Feldnamen lunch… bleiben, damit alte Daten und die PC-Sicherung passen. */
const LUNCH = { "monatlich": 1, "alle 2 Monate": 2, "vierteljährlich": 3, "halbjährlich": 6, "jährlich": 12 };
function lunchDue(p) {
  if (!LUNCH[p.lunch] || p.arch || p.death) return null;
  let due = p.lunchLast ? addMonths(p.lunchLast, LUNCH[p.lunch]) : today();
  if (p.lunchSnooze && p.lunchSnooze > due) due = p.lunchSnooze;
  return due;
}
function callState(p) { const d = nextDue(p); if (!d) return "none"; const n = diffDays(today(), d); return n < 0 ? "late" : n === 0 ? "due" : n <= 3 ? "soon" : "ok"; }
function nextBirthday(p) {
  if (!p.bday || p.arch || p.death) return null;
  const [, m, d] = p.bday.split("-").map(Number); if (!m || !d) return null;
  const t = today(), y = +t.slice(0, 4);
  let s = `${y}-${pad(m)}-${pad(d)}`; if (s < t) s = `${y + 1}-${pad(m)}-${pad(d)}`;
  return s;
}
/* Familie am Kontakt (Kinder, Partner) ohne eigenen Kontakt: p.kin = [{id, name, rel, bday, death}] */
const KINREL = ["Kind", "Partner/in", "Elternteil", "Sonstige"];
const TELL = ["Handy", "Privat", "Geschäft", "Festnetz"];
function kinSoon(maxDays) {
  const t = today(), out = [];
  for (const p of S.people) { if (p.arch) continue; for (const k of p.kin || []) { const b = nextBirthday({ bday: k.bday, death: k.death }); if (b && diffDays(t, b) <= maxDays) out.push({ p, k, b }); } }
  return out.sort((a, b) => a.b < b.b ? -1 : 1);
}
/* Kinder als eigene Kontakte (nur in Mirella, ohne Nummer): kind.parent = id des Elternteils */
const kidsOf = p => S.people.filter(x => x.parent === p.id && !x.arch);
/* Kontakt entfernen und merken, damit er über den Abgleich von einem anderen Gerät nicht zurückkommt */
function dropPerson(p) { S.people = S.people.filter(x => x !== p); (S.goneP = S.goneP || []).push(p.id); S.people.forEach(x => { if (x.parent === p.id) delete x.parent; }); }
function kidForm(parentId) {
  const p = S.people.find(x => x.id === parentId); if (!p) return;
  openSheet(`<p class="stitle">Kind von ${esc(fullName(p))}</p><p class="hint" style="margin-top:0">Bekommt einen eigenen Kontakt in Mirella, ohne Nummer. Im iPhone-Telefonbuch steht das Kind nicht.</p>
  <div class="fgrid"><div class="fld"><label for="kd-first">Vorname</label><input id="kd-first" placeholder="z. B. Lena" autocomplete="off"></div><div class="fld"><label for="kd-last">Nachname</label><input id="kd-last" value="${esc(p.last || "")}" autocomplete="off"></div></div>
  <div class="fld"><label for="kd-bday">Geburtstag</label><input id="kd-bday" inputmode="numeric" maxlength="10" placeholder="TT.MM.JJJJ" autocomplete="off"></div>
  <div class="row2"><button class="btn" data-act="cancel">Abbrechen</button><button class="btn pri" data-act="kidsave" data-id="${p.id}">Speichern</button></div>`, () => $("#kd-first").focus());
}
function kinBlock(p) {
  const ks = p.kin || [], kids = kidsOf(p), par = p.parent && S.people.find(x => x.id === p.parent);
  return `${par ? `<div class="block"><div class="listrow"><span class="grow" role="button" tabindex="0" data-act="person" data-id="${par.id}" style="cursor:pointer">Kind von ${esc(fullName(par))}<small>antippen für die Akte</small></span><span class="chev">›</span></div></div>` : ""}${ks.length ? `<div class="block"><div class="bh"><h4>Familie</h4><button class="mini" data-act="kinedit" data-id="">+ Kind oder Angehörigen</button></div>${ks.length ? ks.map(k => { const nb = nextBirthday({ bday: k.bday, death: k.death }), age = nb && ageAt(k, nb); return `<div class="listrow"><span class="grow" role="button" tabindex="0" data-act="kinedit" data-id="${k.id}" style="cursor:pointer">${esc(k.name)}${k.rel ? " · " + esc(k.rel) : ""}<small>${k.bday ? "* " + esc(longDate(k.bday)) + (age ? " · wird " + age : "") : "Geburtstag fehlt noch"}${k.death ? " · † " + esc(longDate(k.death)) : ""}</small></span></div>`; }).join("") : '<p class="swipehint" style="text-align:left;margin:0">Kinder oder Partner mit Geburtstag, ohne eigenen Kontakt. Mirella erinnert trotzdem.</p>'}</div>` : ""}`;
}
function kinForm(id) {
  const p = S.people.find(x => x.id === cur); if (!p) return; const k = (p.kin || []).find(x => x.id === id) || { name: "", rel: "Kind", bday: "", death: "" };
  openSheet(`<p class="stitle">${id ? "Angehörigen ändern" : "Kind oder Angehörigen eintragen"}</p><p class="hint" style="margin-top:0">Gehört zu ${esc(fullName(p))}. Bekommt keinen eigenen Kontakt, der Geburtstag steht aber im Kalender und auf Heute.</p>
  <div class="fld"><label for="k-name">Name</label><input id="k-name" value="${esc(k.name)}" placeholder="z. B. Maja" autocomplete="off"></div>
  <div class="fld"><label for="k-rel">Wer ist das?</label><select id="k-rel">${KINREL.map(r => `<option${k.rel === r ? " selected" : ""}>${r}</option>`).join("")}</select></div>
  <div class="fgrid"><div class="fld"><label for="k-bday">Geburtstag</label><input id="k-bday" inputmode="numeric" maxlength="10" placeholder="TT.MM.JJJJ" value="${esc(L.bdayToInput(k.bday))}" autocomplete="off"></div><div class="fld"><label for="k-death">Verstorben am</label><input id="k-death" inputmode="numeric" maxlength="10" placeholder="nur falls zutreffend" value="${esc(L.bdayToInput(k.death || ""))}" autocomplete="off"></div></div>
  <div class="row2">${id ? `<button class="btn danger" data-act="kindel" data-id="${id}" style="flex:none">Löschen</button>` : ""}<button class="btn" data-act="cancel">Abbrechen</button><button class="btn pri" data-act="kinsave" data-id="${id || ""}">Speichern</button></div>`, () => {
    for (const q of ["#k-bday", "#k-death"]) $(q).addEventListener("input", e => { if (e.inputType && e.inputType.startsWith("delete")) return; const el = e.target, f = L.fmtBdayInput(el.value); if (f !== el.value) el.value = f; });
  });
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
  if (t.list === "einkauf" && t.done) { const k = t.t.trim(); S.shopFreq[k] = (S.shopFreq[k] || 0) + 1; }
  save(); render();
}

/* Einkaufsliste: „2 Liter Milch“ -> Milch, Menge 2 l. Steht es schon drauf, wird nur die Menge erhöht. */
function addShop(t, qty, unit) {
  const pq = qty != null ? { qty, unit: unit || "", t: cap(String(t).trim()) } : L.parseQty(t);
  const k = (pq.t || "").trim().toLowerCase(); if (!k) return false;
  const ex = S.todos.find(x => x.list === "einkauf" && !x.done && !x.arch && x.t.trim().toLowerCase() === k);
  if (ex) { if (!pq.qty) return false; ex.qty = (+ex.qty || (ex.unit ? 0 : 1)) + pq.qty; if (pq.unit) ex.unit = pq.unit; return true; }
  if (!pq.qty && !pq.unit) { const du = L.defUnit(pq.t, S.shopUnits); if (du) { pq.qty = du.qty; pq.unit = du.unit; } }
  S.todos.push({ id: uid(), t: pq.t, qty: pq.qty || null, unit: pq.unit || "", list: "einkauf", done: false, created: today() }); return true;
}
function isoWeek(s) { const d = D(s); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); const w1 = new Date(d.getFullYear(), 0, 4, 12); return 1 + Math.round(((d - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7); }

/* ---------- Zustand ---------- */
let akteOpen = {}, akteOpenFor = null;
let view = "heute", cur = null, area = null, todoList = "todo", calY, calM, selDate, calView = "monat", q = "", showDone = false, grpFilter = "", showAllCalls = false, allCallsFor = null, setSec = "", setFrom = null, setIdxY = 0, showArch = false, showShopHist = 0;
{ const t = new Date(); calY = t.getFullYear(); calM = t.getMonth(); selDate = today(); }

/* ---------- Bausteine ---------- */
/* Kopfzeile: links Logo (öffnet die Einstellungen genau dieser Seite) + Titel, rechts Suche, Kamera, „Mirella“ + Logo (alle Bereiche) */
const setKeyFor = () => ({ heute: "heute", briefings: "heute", auswertungen: "heute", menschen: "kontakte", akte: "kontakte", todos: "todos", kalender: "kalender", bereich: area }[view] || "");
function topbar(t, setKey) {
  const k = setKey || setKeyFor();
  return `<div class="top">${k ? `<button class="tleft tsetbtn" data-act="tabset" data-k="${esc(k)}" data-t="${esc(t)}" aria-label="Einstellungen für ${esc(t)}"><span class="logobtn"><img src="./logo-final.svg" alt=""></span><p class="big">${esc(t)}</p></button>` : `<span class="tleft"><p class="big">${esc(t)}</p></span>`}<span class="tright"><button class="iconbtn camtop" data-act="search" aria-label="Suchen oder Mirella fragen">${IC.such}</button><button class="iconbtn camtop" data-act="photo" aria-label="Foto oder Brief an Mirella">${IC.cam}</button><button class="brandbtn" data-act="drawer" aria-label="Menü mit allen Bereichen öffnen"><b>Mirella</b><img src="./logo-final.svg" alt=""></button></span></div>`;
}
function subtop(backLabel, backAct, right = "") {
  return `<div class="top"><button class="back" data-act="${backAct}" style="margin:0">‹ ${esc(backLabel)}</button><span class="tright">${right}<button class="brandbtn" data-act="drawer" aria-label="Menü öffnen"><b>Mirella</b><img src="./logo-final.svg" alt=""></button></span></div>`;
}
function pill(st, p) {
  if ((st === "late" || st === "due") && p) { const l = planLabel(p); if (l && l !== "heute") return `<span class="pill">${esc(l)}</span>`; }
  if (st === "late") return '<span class="pill late">heute · überfällig</span>';
  if (st === "due") return '<span class="pill acc">heute</span>';
  if (st === "soon") return '<span class="pill">bald</span>';
  return p ? `<span class="pill">${esc(cycLabel(p.cyc))}</span>` : "";
}
function personCard(p, withCall) {
  const st = callState(p), due = nextDue(p);
  const sub = st === "none" ? (p.group || "") : `${cycLabel(p.cyc)} · zuletzt ${agoText(lastCall(p))}`;
  const callBtn = p.tel ? `<button class="call" aria-label="${esc(fullName(p))} anrufen: ${esc(p.tel)}" data-act="dialnow" data-id="${p.id}">${IC.call}</button>` : `<button class="call" aria-label="Nummer für ${esc(fullName(p))} eintragen" data-act="call" data-id="${p.id}">${IC.call}</button>`;
  return `<div class="card ${withCall ? "due" : ""}" role="button" tabindex="0" data-act="${withCall ? "callmenu" : "person"}" data-id="${p.id}">${avHTML(p)}<span style="min-width:0"><div class="t">${esc(fullName(p))}</div><div class="s">${esc(withCall && p.tel ? p.tel + " · " + sub : sub)}</div></span>${withCall ? callBtn : (st === "none" ? "" : pill(st, p))}</div>`;
}
function todoRow(t) {
  const pr = !t.done && prioOf(t), shop = t.list === "einkauf", q = shop ? L.qtyLabel(t) : "";
  const right = shop ? (t.done ? "" : `<span class="qbtns"><button class="mini" data-act="qty" data-id="${t.id}" data-n="-1" aria-label="weniger">−</button><button class="mini" data-act="qty" data-id="${t.id}" data-n="1" aria-label="mehr">+</button></span>`) : todoPersonBtn(t);
  return `<div class="todo ${t.done ? "done" : ""}${pr ? " prio" : ""}" data-swipe="deltodo" data-id="${t.id}"${pr ? ` style="--pc:${pr[2]}"` : ""}><button class="box" role="checkbox" aria-checked="${!!t.done}" aria-label="${esc(t.t)} abhaken" data-act="toggle" data-id="${t.id}"></button><div role="button" tabindex="0" data-act="edittodo" data-id="${t.id}"><div class="tt">${q ? `<b class="qty">${esc(q)}</b> ` : ""}${esc(t.t)}${pr ? ` <span class="ppill">${pr[1]}</span>` : ""}</div>${todoMeta(t) ? `<div class="meta">${esc(todoMeta(t))}</div>` : ""}${t.ort && !t.done ? `<div class="meta">📍 ${esc(t.ort)}${t.los ? " · los um " + esc(t.los) + " (" + t.fahrt + " Min.)" : t.tripErr && t.time ? " · Fahrzeit fehlt: " + esc(t.tripErr) : ""}</div>` : ""}</div>${t.ort && !t.done ? routeBtn(t.ort) : ""}${right}<button class="del" data-act="deltodo" data-id="${t.id}" aria-label="${esc(t.t)} löschen">✕</button></div>`;
}
/* Routen-Symbol: öffnet Apple Karten mit der Route vom jetzigen Standort zur Adresse */
const ROUTE_IC = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2 22 12 12 22 2 12z"/><path d="M8.5 13.5v-2a1 1 0 0 1 1-1H15"/><path d="m13 8.5 2 2-2 2"/></svg>';
const routeBtn = (addr, label) => addr ? `<a class="mini route" href="https://maps.apple.com/?daddr=${encodeURIComponent(addr)}&dirflg=d" aria-label="Route zu ${esc(addr)}">${ROUTE_IC}${label ? " " + label : ""}</a>` : "";
/* Ort nachschlagen: aus „Tati-Café Stuttgart“ wird Name mit Straße und Ort */
async function placeFind(q) {
  try {
    const lat = S.settings.wxLat || 48.8, lon = S.settings.wxLon || 9.2, r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=de&limit=1&lat=${lat}&lon=${lon}`), f = ((await r.json()).features || [])[0]; if (!f) return "";
    const a = f.properties || {}, street = [a.street, a.housenumber].filter(Boolean).join(" ");
    return [a.name, street, [a.postcode, a.city || a.town || a.village].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  } catch (_) { return ""; }
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
    const dueCalls = callsForToday();
    const shownCalls = dueCalls, doneCalls = callsToday(), pool = pullPool();
    const leave = S.todos.filter(x => x.list === "todo" && !x.done && x.trig === "verlassen");
    const lunches = S.people.filter(p => { const d = lunchDue(p); return d && d <= t; });
    const dueTodos = S.todos.filter(x => x.list === "todo" && !x.done && x.trig !== "verlassen" && ((x.date && x.date <= t) || (+x.prio === 1 && !x.date))).sort((a, b) => (a.date + (a.time || "")) < (b.date + (b.time || "")) ? -1 : 1);
    const bdays = S.people.filter(p => !heuteSkip(p)).map(p => [p, nextBirthday(p)]).filter(([, b]) => b && diffDays(t, b) <= S.settings.giftLead).sort((a, b) => a[1] < b[1] ? -1 : 1);
    const docs = S.docs.filter(x => x.until && diffDays(t, x.until) <= 60).sort((a, b) => a.until < b.until ? -1 : 1);
    const shop = S.todos.filter(x => x.list === "einkauf" && !x.done).length;
    const asks = [];
    S.people.forEach(p => !p.arch && (p.ask || []).forEach(a => { if (!a.done) asks.push([p, a]); }));
    const counts = [];
    if (dueCalls.length) counts.push(dueCalls.length === 1 ? "ein Anruf" : dueCalls.length + " Anrufe");
    if (lunches.length) counts.push(lunches.length === 1 ? "ein Treffen zum Vereinbaren" : lunches.length + " Treffen zum Vereinbaren");
    if (dueTodos.length) counts.push(dueTodos.length === 1 ? "eine Aufgabe" : dueTodos.length + " Aufgaben");
    const nB = bdays.filter(([, b]) => b === t).length; if (nB) counts.push(nB === 1 ? "ein Geburtstag" : nB + " Geburtstage");
    const one = counts.length === 1 && /^ein/.test(counts[0]);
    const summary = counts.length ? `Heute ${one ? "steht" : "stehen"} ${counts.length > 1 ? counts.slice(0, -1).join(", ") + " und " + counts.slice(-1) : counts[0]} an.` : (S.people.length || S.todos.length ? "Heute ist nichts fällig. Genieß den Tag." : "Leg los: Tipp unten aufs Mikrofon und sag zum Beispiel „Milch auf die Einkaufsliste“.");
    let h2 = `${topbar("Heute")}<div class="date">${WDL[d.getDay()]}, ${d.getDate()}. ${MN[d.getMonth()]} · KW ${isoWeek(t)}</div><p class="big">${greet}${S.settings.name ? ", " + esc(S.settings.name) : ""}. ${summary}</p>`;
    const dr = draftGet();
    if (dr) h2 += `<div class="card due" role="button" tabindex="0" data-act="resumedraft"><span class="av">✎</span><span style="min-width:0"><div class="t">Unfertig: ${esc(dr.title || "Eingabe")}</div><div class="s">Antippen und weiter ausfüllen</div></span><button class="rowdel" data-act="dropdraft" aria-label="Verwerfen">✕</button></div>`;
    if (S.sick && S.sick.to >= t) h2 += `<div class="card due"><span class="av">🤒</span><span style="min-width:0;flex:1"><div class="t">Gute Besserung!</div><div class="s" style="white-space:normal">Anrufe sind pausiert bis ${esc(fmtDate(S.sick.to))}, kurier dich aus.</div><div class="actrow"><button class="mini" data-act="wellagain">Wieder gesund</button></div></span></div>`;
    h2 += HOOKS.heuteTop.map(f => f()).join("");
    if (S.settings.showWx) h2 += `<div id="wx">${wxHTML()}</div>`;
    const br = S.settings.showBrief ? latestBriefing() : null;
    if (br) h2 += `<div class="sec"><span class="label">Dein Briefing</span><span class="label">${esc(relDate(br.d))}${br.time ? " " + esc(br.time) : ""}</span></div>${briefCard(br)}`;
    if (!S.people.length && !S.todos.length) {
      h2 += `<div class="block"><h4>So fängst du an</h4><ul><li><b>Kontakte:</b> unten auf „Kontakte“ und dann auf +, oder in den Einstellungen deine Kontakte als vCard importieren.</li><li><b>Sprechen:</b> der runde Knopf unten. Beispiele: „Erinnere mich morgen um 9 an die Steuer“, „Hab mit Tim telefoniert“, „Butter und Eier auf die Einkaufsliste“.</li><li><b>Foto:</b> die Kamera oben rechts, für Belege, Dokumente oder Einkaufszettel.</li><li><b>Mirella</b> oben rechts öffnet alle Bereiche. Das <b>Logo links</b> öffnet die Einstellungen der jeweiligen Seite.</li><li><b>Lupe</b> oben: alles durchsuchen oder Mirella fragen, wie etwas geht.</li></ul></div>`;
    }
    if (leave.length) h2 += `<div class="sec"><span class="label">Bevor du losgehst</span></div><div class="morning">${leave.map(x => `<label class="chk"><input type="checkbox" data-act="toggle" data-id="${x.id}"><span>${esc(x.t)}</span></label>`).join("")}</div>`;
    if (dueCalls.length || doneCalls) h2 += `<div class="sec"><span class="label">Anrufe</span><span class="label">${dueCalls.length ? dueCalls.length + " heute" : ""}${doneCalls ? (dueCalls.length ? " · " : "") + doneCalls + " erledigt" : ""}</span></div>${dueCalls.map(p => personCard(p, true)).join("")}${!dueCalls.length ? `<div class="swipehint" style="text-align:left">Für heute alle Anrufe geschafft. 👍</div>` : ""}${pool.length && dueCalls.length < 2 ? `<button class="btn" data-act="pullcalls" style="width:100%;margin-top:6px">Weitere Anrufe vorziehen (${Math.min(pool.length, +S.settings.maxCalls || 3)} von ${pool.length})</button>` : ""}`;
    if (lunches.length) h2 += `<div class="sec"><span class="label">Treffen vereinbaren</span><span class="label">${lunches.length}</span></div>${lunches.map(p => `<div class="card" role="button" tabindex="0" data-act="person" data-id="${p.id}">${avHTML(p)}<span style="min-width:0;flex:1"><div class="t">${esc(fullName(p))}</div><div class="s">${esc(p.lunch)} · ${p.lunchLast ? "zuletzt " + esc(fmtDate(p.lunchLast)) : "noch nie"}</div><div class="actrow"><button class="mini" data-act="lunchset" data-id="${p.id}">Termin steht</button><button class="mini" data-act="lunchlater" data-id="${p.id}">Später</button></div></span></div>`).join("")}`;
    const quit = S.people.filter(p => !p.arch && gaveUp(p));
    if (quit.length) h2 += `<div class="sec"><span class="label">Mirella nervt hier nicht mehr</span></div>${quit.map(p => `<div class="card">${avHTML(p)}<span style="min-width:0;flex:1"><div class="t">${esc(fullName(p))}</div><div class="s" style="white-space:normal">${failStreak(p)}-mal hintereinander nicht erreicht. Weiter versuchen oder ins Archiv?</div><div class="actrow"><button class="mini" data-act="giveon" data-id="${p.id}">Weiter versuchen</button><button class="mini" data-act="archperson" data-id="${p.id}">Archivieren</button></div></span></div>`).join("")}`;
    const kins = kinSoon(S.settings.giftLead).filter(x => !heuteSkip(x.p));
    if (dueTodos.length) h2 += `<div class="sec"><span class="label">Aufgaben</span><span class="label">${dueTodos.length}</span></div>${dueTodos.sort(byPrio).map(todoRow).join("")}`;
    const bToday = bdays.filter(([, b]) => b === t), bSoon = bdays.filter(([, b]) => b !== t), bCard = ([p, b]) => { const n = diffDays(t, b), age = ageAt(p, b); return `<div class="card ${n === 0 ? "due" : ""}" role="button" tabindex="0" data-act="person" data-id="${p.id}">${avHTML(p)}<span style="min-width:0"><div class="t">${esc(fullName(p))}${age ? ` wird ${age}` : ""}</div><div class="s">${n === 0 ? "heute! Gratulieren" : (n === 1 ? "morgen" : "in " + n + " Tagen") + " · " + fmtDate(b)}${p.gift && n > 0 ? " · Geschenk besorgen" : ""}</div></span>${n === 0 ? '<span class="pill acc">heute</span>' : p.gift ? '<span class="pill">Geschenk</span>' : ""}</div>`; };
    if (bToday.length) h2 += `<div class="sec"><span class="label">Heute Geburtstag</span></div>${bToday.map(bCard).join("")}`;
    if (shop) h2 += `<div class="sec"><span class="label">Einkaufsliste</span></div><div class="card" role="button" tabindex="0" data-act="shoplist"><span class="av">🛒</span><span><div class="t">${shop} ${shop === 1 ? "Sache" : "Sachen"} offen</div><div class="s">Antippen für die Liste</div></span><button class="mini" data-act="shopmode" data-on="1">Einkaufen gehen</button></div>`;
    if (kins.length) h2 += `<div class="sec"><span class="label">Geburtstage in der Familie</span></div>${kins.map(({ p, k, b }) => { const n = diffDays(t, b), age = ageAt(k, b); return `<div class="card ${n === 0 ? "due" : ""}" role="button" tabindex="0" data-act="person" data-id="${p.id}"><span class="av">🎂</span><span style="min-width:0"><div class="t">${esc(k.name)}${age ? ` wird ${age}` : ""}</div><div class="s">${esc(k.rel || "Familie")} von ${esc(fullName(p))} · ${n === 0 ? "heute!" : n === 1 ? "morgen" : "in " + n + " Tagen"}</div></span><span class="chev">›</span></div>`; }).join("")}`;
    if (bSoon.length) h2 += `<div class="sec"><span class="label">Geburtstage</span></div>${bSoon.map(bCard).join("")}`;
    const rounds = S.people.map(p => [p, (+S.settings.roundLead ? L.roundBday(p.bday, t, +S.settings.roundLead, S.settings.roundAges) : null)]).filter(([p, r]) => r && !p.death && !heuteSkip(p) && r.days > S.settings.giftLead && p.roundAck !== r.date).sort((a, b) => a[1].days - b[1].days);
    if (rounds.length) h2 += `<div class="sec"><span class="label">Runde Geburtstage</span></div>${rounds.map(([p, r]) => { const mo = Math.round(r.days / 30.4); return `<div class="card round" role="button" tabindex="0" data-act="person" data-id="${p.id}"><span class="av">🎉</span><span style="min-width:0"><div class="t">Achtung: ${esc(p.first || fullName(p))} wird ${r.age}</div><div class="s">${mo >= 5 ? "in einem halben Jahr" : mo >= 2 ? "in " + mo + " Monaten" : "in " + r.days + " Tagen"} · ${esc(fmtDate(r.date))}. Zeit für eine Idee.</div></span><button class="mini" data-act="roundack" data-id="${p.id}" data-d="${r.date}">Notiert</button></div>`; }).join("")}`;
    const md = t.slice(5), mem = [];
    S.people.forEach(p => { if (!p.death || p.arch) return; if (p.death.slice(5) === md) mem.push([p, "Todestag"]); if (p.bday && p.bday.slice(5) === md) mem.push([p, "Geburtstag"]); });
    if (mem.length) h2 += `<div class="sec"><span class="label">In Gedenken</span></div>${mem.map(([p, k]) => `<div class="card" role="button" tabindex="0" data-act="person" data-id="${p.id}"><span class="av">🕯️</span><span style="min-width:0"><div class="t">${esc(fullName(p))}</div><div class="s">heute ${k}</div></span></div>`).join("")}`;
    h2 += HOOKS.heute.map(f => f()).join("");
    if (asks.length) h2 += `<div class="sec"><span class="label">Nachfragen</span></div>${asks.slice(0, 5).map(([p, a]) => `<div class="card" role="button" tabindex="0" data-act="person" data-id="${p.id}">${avHTML(p)}<span style="min-width:0"><div class="t">${esc(fullName(p))}</div><div class="s">${esc(a.t)}</div></span></div>`).join("")}`;
    if (docs.length) h2 += `<div class="sec"><span class="label">Dokumente laufen ab</span></div>${docs.map(x => `<div class="card" role="button" tabindex="0" data-act="area" data-id="doku"><span class="av">${IC.doku}</span><span style="min-width:0"><div class="t">${esc(x.name)}</div><div class="s">gültig bis ${esc(fmtDate(x.until))}</div></span>${x.until < t ? '<span class="pill late">abgelaufen</span>' : '<span class="pill">bald</span>'}</div>`).join("")}`;
    return h2;
  },
  menschen() {
    const ql = q.trim().toLowerCase();
    let list = S.people.filter(p => !p.arch && (!grpFilter || p.group === grpFilter) && (!ql || (fullName(p) + " " + (p.group || "") + " " + (p.nick || "") + " " + (p.tel || "") + " " + (p.woher || "") + " " + (p.job || "")).toLowerCase().includes(ql) || fuzzyHas(fullName(p) + " " + (p.nick || "") + " " + (p.job || ""), ql)));
    const grps = S.groups.filter(g => S.people.some(p => p.group === g));
    const rank = p => { const d = nextDue(p); return d || "9999"; }, az = (S.settings.peopleSort || "az") === "az";
    const key = p => (p.last || p.first || "").trim(), letter = p => { const c = key(p).normalize("NFD").replace(/[̀-ͯ]/g, "").charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : "#"; };
    list = az ? list.sort((a, b) => key(a).localeCompare(key(b), "de") || fullName(a).localeCompare(fullName(b), "de")) : list.sort((a, b) => rank(a) < rank(b) ? -1 : rank(a) > rank(b) ? 1 : fullName(a).localeCompare(fullName(b), "de"));
    let body = "", have = new Set();
    if (az) { let cur0 = ""; for (const p of list) { const l = letter(p); if (l !== cur0) { cur0 = l; have.add(l); body += `<div class="sec" id="az-${l === "#" ? "x" : l}"><span class="label">${l}</span></div>`; } body += personCard(p, false); } }
    else body = list.map(p => personCard(p, false)).join("");
    return `${topbar("Kontakte")}${HOOKS.menschenTop.map(f => f()).join("")}<input class="search" id="q" type="search" placeholder="Suchen: Name, Nummer, Gruppe, Beruf oder woher" aria-label="Suchen" value="${esc(q)}">
    ${grps.length ? `<div class="chips"><button class="chip2" data-act="grpf" data-g="" aria-pressed="${!grpFilter}">Alle</button>${grps.map(g => `<button class="chip2" data-act="grpf" data-g="${esc(g)}" aria-pressed="${grpFilter === g}">${esc(g)}</button>`).join("")}</div>` : ""}
    <div class="seg" style="margin-bottom:8px"><button data-act="psort" data-m="az" aria-pressed="${az}">A bis Z</button><button data-act="psort" data-m="dran" aria-pressed="${!az}">Wer ist dran</button></div>
    ${az ? "" : `<div class="sec"><span class="label">Wer zuerst dran ist</span><span class="label">${list.length}</span></div>`}
    <div class="${az && list.length > 12 ? "haskaz" : ""}">${list.length ? body : empty(S.people.length ? "Niemand gefunden." : "Noch keine Kontakte. Tipp auf +, oder importiere sie in den Einstellungen (vCard).")}</div>
    ${az && list.length > 12 ? `<div class="azbar" id="azbar" aria-label="Zum Buchstaben springen">${"ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("").map(l => `<span data-l="${l}" class="${have.has(l) ? "" : "off"}">${l}</span>`).join("")}</div>` : ""}
    ${(() => { const ar = S.people.filter(p => p.arch && (!ql || fullName(p).toLowerCase().includes(ql))).sort((a, b) => fullName(a).localeCompare(fullName(b), "de")); return ar.length ? `<div class="sec"><button class="mini" data-act="showarch" style="border:0;background:none;padding:0"><span class="label">Archiv (${ar.length}) ${showArch ? "▾" : "▸"}</span></button></div>${showArch ? ar.map(p => `<div class="listrow"><span class="grow" role="button" data-act="person" data-id="${p.id}" style="cursor:pointer">${esc(fullName(p))}<small>archiviert${p.arch && p.arch !== 1 ? " am " + esc(fmtDate(p.arch)) : ""} · keine Anrufe, keine Geburtstage</small></span><button class="mini" data-act="unarchperson" data-id="${p.id}">Zurückholen</button></div>`).join("") : ""}` : ""; })()}`;
  },
  akte() {
    const p = S.people.find(x => x.id === cur); if (!p) { view = "menschen"; return R.menschen(); }
    if (allCallsFor !== p.id) showAllCalls = false;
    const st = callState(p), due = nextDue(p), nb = nextBirthday(p);
    if (akteOpenFor !== p.id) { akteOpenFor = p.id; akteOpen = {}; }
    const list = (h, k, emptyT, ph) => {
      const l = p[k] || [], act = k === "ask" ? l.filter(x => !x.done) : l, last = k === "notes" ? act[0] : act[act.length - 1];
      if (!akteOpen[k]) return `<button class="aline" data-act="akteopen" data-k="${k}"><span class="at"><b>${h}</b><span class="an">${act.length || ""}</span></span><span class="as">${last ? esc(last.t) : emptyT}</span><span class="chev">▸</span></button>`;
      return listFull(h, k, emptyT, ph);
    };
    const listFull = (h, k, emptyT, ph) => `<div class="block"><div class="bh"><h4>${h}</h4><button class="mini" data-act="akteopen" data-k="${k}">Zuklappen</button></div>${(p[k] || []).length ? (p[k]).map(x => `<div class="listrow">${k === "ask" ? `<button class="box" role="checkbox" aria-checked="${!!x.done}" data-act="askdone" data-id="${x.id}" aria-label="erledigt"></button>` : ""}<span class="grow" ${x.done ? 'style="text-decoration:line-through;color:var(--ink-3)"' : ""}>${esc(x.t)}${x.d ? `<small>${esc(fmtDate(x.d))}</small>` : ""}</span><button class="rowdel" data-act="delakte" data-k="${k}" data-id="${x.id}" aria-label="löschen">✕</button></div>`).join("") : `<div class="emptyline">${emptyT}</div>`}<form class="shoprow" data-form="akte" data-k="${k}" style="margin-top:8px"><input class="search" style="margin:0" placeholder="${ph}" aria-label="${h} hinzufügen"><button class="btn pri" style="flex:none">+</button></form></div>`;
    const calls = (p.calls || []).slice().sort((a, b) => a.d < b.d ? 1 : -1);
    return `${subtop("Kontakte", "go\" data-v=\"menschen")}
    <div class="hero${p.death ? " dead" : ""}"><button class="heroedit" data-act="editperson" data-id="${p.id}" aria-label="Kontakt bearbeiten">${IC.pen}<span>Bearbeiten</span></button><button class="avbtn" data-act="avpick" data-id="${p.id}" aria-label="Profilbild ${p.pic ? "ändern" : "hinzufügen"}">${avHTML(p)}<span class="avcam">${IC.cam}</span></button><h3>${esc(fullName(p))}</h3><p>${esc(p.death ? [p.group, "verstorben"].filter(Boolean).join(" · ") : [p.group, cycLabel(p.cyc)].filter(Boolean).join(" · "))}</p>${p.woher || p.job ? `<p>${esc([p.woher ? "Kennen uns: " + p.woher : "", p.job ? "Beruf: " + p.job : ""].filter(Boolean).join(" · "))}</p>` : ""}
    ${p.tel ? `<button class="bigcall" data-act="call" data-id="${p.id}">${IC.call} ${esc(p.tel)}${p.telL ? ` <small style="font-weight:500;opacity:.8">· ${esc(p.telL)}</small>` : ""}</button>` : `<button class="bigcall" data-act="editperson" data-id="${p.id}">Telefonnummer eintragen</button>`}
    ${(p.tels || []).map(x => `<a class="mini" href="tel:${esc(intlTel(x.n))}" style="text-decoration:none;display:block;margin:0 0 6px">${IC.call} ${esc(x.n)}${x.l ? " · " + esc(x.l) : ""}</a>`).join("")}
    <div class="callrow"><button class="mini" data-act="logcall" data-id="${p.id}">Anruf eintragen</button>${p.tel ? `<a class="mini" href="sms:${esc(p.tel.replace(/\s/g, ""))}" style="text-decoration:none">Nachricht</a><a class="mini" href="https://wa.me/${esc(waNum(p.tel))}" style="text-decoration:none">WhatsApp</a>` : ""}${p.email ? `<a class="mini" href="mailto:${esc(p.email)}" style="text-decoration:none">E-Mail</a>` : ""}${st !== "none" ? `<button class="mini" data-act="snooze" data-id="${p.id}">Später</button>` : ""}</div></div>
    ${p.death ? "" : p.arch ? `<div class="hint"><b>Im Archiv.</b> Mirella erinnert nicht an Anrufe und Geburtstage. <button class="mini" data-act="unarchperson" data-id="${p.id}">Zurückholen</button></div>` : nextCallBlock(p)}
    ${bdayBlock(p, nb)}
    ${kinBlock(p)}
    <div class="alines">${list("Offene Nachfragen", "ask", "Nichts offen", "z. B. fragen, wie die Reha läuft")}
    ${list("Notizen", "notes", "Noch keine Notizen", "Neue Notiz")}
    ${list("Geschenkideen", "gifts", "Noch keine Ideen", "z. B. Kochkurs")}</div>
    <div class="block"><div class="bh"><h4>Zuletzt angerufen</h4><span class="label">${calls.length ? calls.length + (calls.length === 1 ? " Anruf" : " Anrufe") : ""}</span></div>${calls.length ? (showAllCalls ? calls : calls.slice(0, 3)).map(c => `<div class="listrow"><span class="grow">${esc(fmtDate(c.d))}${c.t ? " · " + esc(c.t) : ""}<small>${c.ok ? "erreicht" : "nicht erreicht"} · ${esc(agoText(c.d))}</small></span><button class="rowdel" data-act="delcall" data-id="${c.id}" aria-label="löschen">✕</button></div>`).join("") + (calls.length > 3 ? `<button class="mini" data-act="allcalls" data-id="${p.id}" style="margin-top:8px">${showAllCalls ? "Nur die letzten 3" : "Alle anzeigen (" + calls.length + ")"}</button>` : "") : '<div class="emptyline">Noch kein Anruf eingetragen</div>'}</div>
    ${contactBlock(p)}`;
  },
  todos() {
    const isShop = todoList === "einkauf";
    const all = S.todos.filter(t => t.list === todoList);
    if (isShop) return `${topbar("To-dos")}${todoSeg(true)}${shopView(all)}`;
    const open = all.filter(t => !t.done).concat(typeof suppTodos === "function" ? suppTodos() : []).sort((a, b) => ((a.date || "9999") + (a.time || "")) < ((b.date || "9999") + (b.time || "")) ? -1 : 1).sort(byPrio);
    const doneToday = all.filter(t => t.done && t.doneAt === today());
    const older = all.filter(t => t.done && t.doneAt !== today()).sort((a, b) => (a.doneAt || "") < (b.doneAt || "") ? 1 : -1);
    return `${topbar("To-dos")}${todoSeg(false)}
    ${open.length ? open.map(t => t.supp ? suppTodoRow(t) : todoRow(t)).join("") : empty(doneToday.length ? "Alles erledigt für heute. Stark!" : "Keine offenen Aufgaben. Neu per + oder per Mikrofon.")}
    ${doneToday.length ? `<div class="sec"><span class="label">Heute erledigt</span><span class="label">${doneToday.length}</span></div>${doneToday.map(todoRow).join("")}` : ""}
    ${todoInsights(all)}
    ${older.length ? `<div class="sec"><button class="mini" data-act="showdone">${showDone ? "Erledigte ausblenden" : "Alle erledigten zeigen (" + older.length + ")"}</button></div>${showDone ? older.slice(0, 100).map(todoRow).join("") : ""}` : ""}`;
  },
  kalender() {
    const f = S.settings.calFilter, dd = D(selDate);
    const seg = `<div class="seg">${[["tag", "Tag"], ["woche", "Woche"], ["monat", "Monat"], ["liste", "Liste"]].map(([v, l]) => `<button data-act="calview" data-cv="${v}" aria-pressed="${calView === v}">${l}</button>`).join("")}</div>`;
    const filt = `<div class="chips calfilt">${CALF.map(([k, l]) => `<button class="chip2 cf-${k}" data-act="calf" data-k="${k}" aria-pressed="${!!(f[k] ?? 1)}"><i></i>${l}</button>`).join("")}</div>`;
    let title = "", sub = "";
    if (calView === "tag") { title = `${WDL[dd.getDay()]}, ${dd.getDate()}. ${MN[dd.getMonth()]}`; sub = `${dd.getFullYear()} · KW ${isoWeek(selDate)}`; }
    else if (calView === "woche") { const mo = weekStart(selDate), su = addDays(mo, 6); title = `KW ${isoWeek(mo)}`; sub = `${D(mo).getDate()}. ${MN[D(mo).getMonth()].slice(0, 3)} bis ${D(su).getDate()}. ${MN[D(su).getMonth()].slice(0, 3)} ${D(su).getFullYear()}`; }
    else if (calView === "monat") { title = `${MN[calM]} ${calY}`; sub = `KW ${isoWeek(iso(new Date(calY, calM, 1, 12)))} bis ${isoWeek(iso(new Date(calY, calM + 1, 0, 12)))}`; }
    else { title = "Nächste 60 Tage"; sub = "ab heute"; }
    const nav = `<div class="mnav">${calView !== "liste" ? `<button class="iconbtn" data-act="cstep" data-n="-1" aria-label="Zurück">‹</button>` : "<span></span>"}<button class="mtitle" data-act="mpick" aria-label="Monat und Jahr wählen">${esc(title)} <span class="chev2">▾</span><small>${esc(sub)}</small></button>${calView !== "liste" ? `<button class="iconbtn" data-act="cstep" data-n="1" aria-label="Weiter">›</button>` : "<span></span>"}</div>`;
    const dayList = k => { const e = eventsRange(k, k)[k] || []; return e.length ? e.map(evRow).join("") : '<div class="ev" style="color:var(--ink-3)">Nichts geplant</div>'; };
    let body = "";
    if (calView === "monat") {
      const first = new Date(calY, calM, 1), off = (first.getDay() + 6) % 7, n = new Date(calY, calM + 1, 0).getDate();
      const ev = eventsRange(iso(new Date(calY, calM, 1, 12)), iso(new Date(calY, calM, n, 12)));
      body = '<div class="mg kw">' + ["KW", "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(x => `<div class="mh">${x}</div>`).join("");
      if (off) body += `<div class="kwc">${isoWeek(iso(new Date(calY, calM, 1, 12)))}</div>`;
      for (let i = 0; i < off; i++) body += "<div></div>";
      for (let d = 1; d <= n; d++) { const k = iso(new Date(calY, calM, d, 12)), e = ev[k] || []; if ((off + d - 1) % 7 === 0) body += `<div class="kwc">${isoWeek(k)}</div>`; body += `<button class="mc${k === today() ? " today" : ""}${k === selDate ? " sel" : ""}" data-act="selday" data-d="${k}" aria-label="${d}. ${MN[calM]}"><span>${d}</span><span class="dots">${[...new Set(e.map(x => x.c))].slice(0, 4).map(c => `<i class="d-${c}"></i>`).join("")}</span></button>`; }
      body += "</div>" + filt;
      body += `<div class="sec"><span class="label">${WDL[dd.getDay()]}, ${dd.getDate()}. ${MN[dd.getMonth()]} · KW ${isoWeek(selDate)}</span><button class="mini" data-act="newtodo" data-d="${selDate}">+ Eintrag</button></div>` + dayList(selDate);
    } else if (calView === "tag") {
      body = `<div class="sec"><span class="label">${selDate === today() ? "Heute" : relDate(selDate)}</span><button class="mini" data-act="newtodo" data-d="${selDate}">+ Eintrag</button></div>` + dayList(selDate);
    } else if (calView === "woche") {
      const mo = weekStart(selDate), ev = eventsRange(mo, addDays(mo, 6));
      for (let i = 0; i < 7; i++) { const k = addDays(mo, i), d = D(k); body += `<div class="cal-day${k === today() ? " is-today" : ""}"><button class="d" data-act="dayview" data-d="${k}" style="background:none;border:0;padding:0;text-align:left;cursor:pointer">${WD[d.getDay()]}<b>${d.getDate()}</b>${MN[d.getMonth()].slice(0, 3)}</button><div>${(ev[k] || []).map(evRow).join("") || '<div class="ev" style="color:var(--ink-3)">–</div>'}</div></div>`; }
    } else {
      const from = today(), to = addDays(from, 60), ev = eventsRange(from, to);
      const keys = Object.keys(ev).sort();
      let lastW = null;
      body = keys.length ? keys.map(k => { const d = D(k), w = isoWeek(k), wh = w !== lastW ? `<div class="sec"><span class="label">Kalenderwoche ${w}</span></div>` : ""; lastW = w; return wh + `<div class="cal-day"><div class="d">${WD[d.getDay()]}<b>${d.getDate()}</b>${MN[d.getMonth()].slice(0, 3)}</div><div>${ev[k].map(evRow).join("")}</div></div>`; }).join("") : empty("In den nächsten 60 Tagen steht nichts an.");
    }
    return topbar("Kalender") + seg + nav + body + (calView === "monat" ? "" : filt) + '<p class="swipehint" style="margin-top:14px">Wischen oder Pfeile: blättern · Tipp auf den Titel: Monat und Jahr wählen</p>';
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
    <p class="hint">Dein Briefing kommt einmal am Tag automatisch, jeden Tag um 8 Uhr (spätestens bis 9 Uhr ist es hier). Antippen öffnet das PDF. Jedes Briefing bleibt 7 Tage hier und wird danach automatisch gelöscht, auch selbst abgelegte PDFs.</p>
    ${body || empty("Noch keine Briefings abgelegt.")}`;
  },
  einstellungen() {
    if (setSec && SETS[setSec]) {
      const lab = setLabel(setSec);
      return `${setFrom ? subtop(setFrom.t, "setback") : subtop("Einstellungen", "setsec\" data-k=\"")}<p class="big">${esc(lab)}</p>${SETS[setSec]()}`;
    }
    const row = (k, ic, n, sub) => `<button class="drow" data-act="setsec" data-k="${k}">${ic}<span class="dt"><b>${esc(n)}</b><small>${esc(sub)}</small></span><span class="chev">›</span></button>`;
    const ico = s2 => `<span class="setic">${s2}</span>`;
    return `${subtop("Zurück", "go\" data-v=\"heute")}<p class="big">Einstellungen</p>
    <div class="sethead2">Seiten</div>
    ${row("heute", IC.sun, "Heute", "Name, Wetter, Briefing")}
    ${row("kontakte", IC.people, "Kontakte", "Anrufe, Geburtstage, Gruppen, Import")}
    ${row("todos", IC.check, "To-dos & Einkauf", "Prioritäten, Einkaufs-Vorlagen")}
    ${row("kalender", IC.cal, "Kalender", "Filter, Startansicht")}
    <div class="sethead2">Bereiche</div>
    ${AREAS.map(A => row(A.id, IC[A.ic], A.n, (typeof AREA_SUB !== "undefined" && AREA_SUB[A.id]) || "")).join("")}
    <div class="sethead2">Mirella</div>
    ${row("nerv", IC.bell, "Nerv-Modus", "was dich erinnert, bis es erledigt ist")}
    ${row("konto", IC.cloud, "Konto & Abgleich", typeof syOn === "function" && syOn() ? "angemeldet" : "nicht angemeldet")}
    ${row("sicherung", IC.save, "Datensicherung", "speichern und zurückholen")}
    ${row("info", IC.info, "Über Mirella", "Version, was noch kommt, alles löschen")}
    <p class="swipehint">Mirella ${VERSION} · ${S.people.length} Kontakte · ${S.todos.length} Einträge · ${S.docs.length} Dokumente</p>`;
  }
};
const SETNAMES = { heute: "Heute", kontakte: "Kontakte", todos: "To-dos & Einkauf", kalender: "Kalender", nerv: "Nerv-Modus", konto: "Konto & Abgleich", sicherung: "Datensicherung", info: "Über Mirella" };
const setLabel = k => SETNAMES[k] || (areaById(k) ? areaById(k).n : "Einstellungen");
/* Bausteine für Einstellungen */
const setSel = (k, label, hint, opts) => { const v = getSet(k); return `<div class="set"><span>${label}<small>${hint}</small></span><select data-set="${k}"${opts.some(o => typeof o[0] === "string") ? ' data-str="1"' : ""}>${opts.map(([o, l]) => `<option value="${o}"${String(v) === String(o) ? " selected" : ""}>${l}</option>`).join("")}</select></div>`; };
const setTgl = (k, label, hint) => `<label class="set"><span>${label}<small>${hint || ""}</small></span><input type="checkbox" class="sw" data-set="${k}"${getSet(k) ? " checked" : ""}></label>`;
const setTxt = (k, label, hint, ph, type = "text") => `<div class="set"><span>${label}<small>${hint || ""}</small></span><input class="setin" type="${type}" data-set="${k}" value="${esc(getSet(k) == null ? "" : getSet(k))}" placeholder="${esc(ph || "")}"${type === "number" ? ' inputmode="decimal" data-num="1"' : ""}></div>`;
const setH = t => `<div class="sec sethead"><span class="label">${t}</span></div>`;
function getSet(k) { return k.split(".").reduce((o, x) => o == null ? o : o[x], S.settings); }
function putSet(k, v) { const ks = k.split("."), last = ks.pop(); let o = S.settings; for (const x of ks) o = o[x] = o[x] || {}; o[last] = v; }
const SETS = {
  heute() {
    const s = S.settings;
    return `${setH("Begrüßung")}${setTxt("name", "Dein Name", "für die Begrüßung auf „Heute“", "z. B. Felix")}
    ${setH("Wetter")}${setTgl("showWx", "Wetter auf „Heute“", "jetzt, tagsüber und nachts, mit Hinweisen")}
    ${setH("Wetter-Hinweise")}${[["regen", "☂️ Regen: Schirm"], ["schnee", "🌨️ Schnee"], ["gewitter", "⛈️ Gewitter"], ["frost", "❄️ Frost und Glätte"], ["sturm", "💨 Sturm"], ["wind", "🌬️ Wind"], ["hitze", "🥵 Hitze: trinken"], ["jacke", "🧥 Kalt: warme Jacke"], ["zwiebel", "🧣 Großer Temperatur-Unterschied"], ["uv", "🧴 Sonne: Sonnencreme"], ["nebel", "🌫️ Nebel"]].map(([k, l]) => setTgl("wxHint." + k, l, "")).join("")}
    <div class="set"><span>Wetter-Ort<small>${s.wxName === "deinem Standort" ? "dein Standort (gespeichert)" : s.wxName ? esc(s.wxName) : "noch nicht festgelegt"}</small></span><button class="mini" data-act="wxhere">${s.wxLat != null && s.wxName === "deinem Standort" ? "Standort neu bestimmen" : "Standort nutzen"}</button></div>
    <form class="shoprow" data-form="wxplace" style="margin:8px 0"><input class="search" style="margin:0" placeholder="Oder Ort eintippen, z. B. Remseck" aria-label="Wetter-Ort"><button class="btn pri" style="flex:none">OK</button></form>
    ${setH("Briefing")}${setTgl("showBrief", "Neuestes Briefing auf „Heute“", "Tipp darauf öffnet direkt das PDF")}
    <p class="hint">Dein Briefing kommt einmal am Tag automatisch als PDF, jeden Tag um 8 Uhr (spätestens bis 9 Uhr ist es da). Sie bleiben 7 Tage und werden dann gelöscht.</p>`;
  },
  kontakte() {
    const ages = S.settings.roundAges || [];
    return `${setH("Anrufe")}${setSel("maxCalls", "Anrufe pro Tag", "höchstens so viele auf „Heute“", [[1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"], [7, "7"], [10, "10"], [99, "kein Limit"]])}
    ${setDays("callDays", "Anruftage", callDays())}
    ${setSel("callFrom", "Anrufen ab", "an den Anruftagen", [[6, "6 Uhr"], [7, "7 Uhr"], [8, "8 Uhr"], [9, "9 Uhr"], [10, "10 Uhr"], [11, "11 Uhr"], [12, "12 Uhr"], [13, "13 Uhr"], [14, "14 Uhr"]])}${setSel("callTo", "Anrufen bis", "an den Anruftagen", [[12, "12 Uhr"], [13, "13 Uhr"], [14, "14 Uhr"], [15, "15 Uhr"], [16, "16 Uhr"], [17, "17 Uhr"], [18, "18 Uhr"], [19, "19 Uhr"], [20, "20 Uhr"], [21, "21 Uhr"], [22, "22 Uhr"]])}
    ${setSel("retryWorkdays", "Nicht erreicht", "neuer Versuch nach", [[1, "1 Anruftag"], [2, "2 Anruftagen"], [3, "3 Anruftagen"], [5, "5 Anruftagen"], [10, "10 Anruftagen"]])}${setSel("giveUp", "Nerven aufhören", "nach so vielen Fehlversuchen hintereinander", [[0, "nie"], [2, "2 Versuchen"], [3, "3 Versuchen"], [4, "4 Versuchen"], [5, "5 Versuchen"], [8, "8 Versuchen"], [10, "10 Versuchen"]])}
    ${setH("Nachrichten und Gruppen")}${setDays("msgDays", "Nachrichten-Tage", msgDays())}
    ${setSel("msgFrom", "Nachrichten ab", "Gruppen, Geburtstage, Aufgaben", [[6, "6 Uhr"], [7, "7 Uhr"], [8, "8 Uhr"], [9, "9 Uhr"], [10, "10 Uhr"], [11, "11 Uhr"], [12, "12 Uhr"]])}${setSel("msgTo", "Nachrichten bis", "Gruppen, Geburtstage, Aufgaben", [[17, "17 Uhr"], [18, "18 Uhr"], [19, "19 Uhr"], [20, "20 Uhr"], [21, "21 Uhr"], [22, "22 Uhr"], [23, "23 Uhr"]])}
    ${setH("Nerv-Modus für Kontakte")}${setTgl("nerv.anrufe", "Fällige Anrufe", "nerven, bis du angerufen hast")}${setTgl("nerv.geburtstage", "Geburtstage", "am Tag selbst, bis du gratuliert hast")}${setSel("nervEvery", "Erneut melden", "solange Mirella offen ist", [[5, "alle 5 Minuten"], [10, "alle 10 Minuten"], [15, "alle 15 Minuten"], [30, "alle 30 Minuten"], [60, "jede Stunde"], [120, "alle 2 Stunden"]])}
    <button class="btn" data-act="setsec" data-k="nerv" style="width:100%;margin:6px 0">Alle Nerv-Einstellungen</button>
    ${setH("Geburtstage")}${setSel("giftLead", "Geburtstage", "so früh auf „Heute“ zeigen", [[1, "1 Tag vorher"], [3, "3 Tage vorher"], [7, "7 Tage vorher"], [10, "10 Tage vorher"], [14, "14 Tage vorher"], [21, "21 Tage vorher"], [30, "30 Tage vorher"]])}
    ${setSel("roundLead", "Runde Geburtstage", "so früh auf „Heute“ zeigen", [[0, "gar nicht"], [30, "1 Monat vorher"], [61, "2 Monate vorher"], [91, "3 Monate vorher"], [183, "6 Monate vorher"], [274, "9 Monate vorher"], [365, "1 Jahr vorher"]])}
    <div class="set" style="display:block"><span>Welche gelten als rund?<small>${esc(ages.join(", ") || "keine")}</small></span><div class="daychips">${[18, 20, 25, 30, 40, 50, 60, 65, 70, 75, 80, 90, 100].map(a => `<button class="chip2" data-act="setage" data-a="${a}" aria-pressed="${ages.includes(a)}">${a}</button>`).join("")}</div></div>
    ${setH("Gruppen")}<div class="chips">${S.groups.map(g => `<span class="chip2" aria-pressed="false">${esc(g)}${BASEGROUPS.includes(g) ? "" : ` <button class="xbtn" data-act="delgroup" data-g="${esc(g)}" aria-label="${esc(g)} entfernen">✕</button>`}</span>`).join("")}</div>
    <form class="shoprow" data-form="group" style="margin:8px 0"><input class="search" style="margin:0" placeholder="Eigene Gruppe, z. B. Paddeln" aria-label="Neue Gruppe"><button class="btn pri" style="flex:none">+</button></form>
    ${setH("Importieren und aufräumen")}
    <button class="btn" data-act="dupscan" style="width:100%;margin-bottom:8px">Doppelte Kontakte suchen</button>
    <button class="btn" data-act="importvcf" style="width:100%">Kontakte importieren (vCard .vcf)</button>
    <p class="hint">Am PC auf icloud.com › Kontakte alle markieren und „vCard exportieren“, Datei aufs iPhone (z. B. per AirDrop oder Dateien-App) und hier auswählen. Namen, Telefonnummern und Geburtstage werden übernommen, Doppelte übersprungen. In der iPhone-App liest Mirella die Kontakte später direkt.</p>`;
  },
  todos() {
    return `${setH("Nerv-Modus für Aufgaben")}${setTgl("nerv.aufgaben", "Aufgaben mit Nerv-Modus", "und alle mit Priorität Hoch, bis erledigt")}${setTgl("nerv.fristen", "Fristen", "Kündigungen, TÜV, Rechnungen, Ablauf von Dokumenten")}${setTgl("nerv.supplements", "Supplements", "morgens und abends, bis abgehakt")}${setSel("nervEvery", "Erneut melden", "solange Mirella offen ist", [[5, "alle 5 Minuten"], [10, "alle 10 Minuten"], [15, "alle 15 Minuten"], [30, "alle 30 Minuten"], [60, "jede Stunde"], [120, "alle 2 Stunden"]])}
    <p class="hint">Neue Aufgaben haben den Nerv-Modus standardmäßig an. Alles zum Nerv-Modus auch unter Einstellungen › Nerv-Modus.</p>
    ${setH("Prioritäten")}<p class="hint" style="margin-top:0">Jede Aufgabe kann eine Stufe bekommen. Hoch steht immer oben und erscheint auf „Heute“, auch ohne Datum.</p>
    ${PRIOS.map(([, n, c]) => `<div class="set"><span><i class="pdot" style="background:${c}"></i> ${n}</span></div>`).join("")}
    ${setH("Einkaufs-Vorlagen")}${S.shopTpl.length ? S.shopTpl.map(t => `<div class="listrow"><span class="grow">${esc(t.n)}<small>${t.items.length} Artikel: ${esc(t.items.slice(0, 5).map(i => i.t).join(", "))}${t.items.length > 5 ? " …" : ""}</small></span><button class="rowdel" data-act="deltpl" data-id="${t.id}" aria-label="Vorlage löschen">✕</button></div>`).join("") : '<p class="hint" style="margin-top:0">Noch keine Vorlage. In der Einkaufsliste unten „Liste als Vorlage speichern“ tippen.</p>'}
    ${setH("Waschmaschine")}${setSel("washMin", "„Waschmaschine läuft“", "dann erinnere ich dich nach", [[60, "1 Stunde"], [90, "1,5 Stunden"], [120, "2 Stunden"], [150, "2,5 Stunden"], [180, "3 Stunden"]])}`;
  },
  kalender() {
    return `${setH("Anzeigen")}${CALF.map(([k, l]) => setTgl("calFilter." + k, l, "im Kalender zeigen")).join("")}
    ${setSel("calStart", "Startansicht", "beim Öffnen des Kalenders", [["tag", "Tag"], ["woche", "Woche"], ["monat", "Monat"], ["liste", "Liste"]])}`;
  },
  nerv() {
    return `<p class="hint" style="margin-top:0">Was hier eingeschaltet ist, lässt dich nicht in Ruhe: Beim Öffnen von Mirella kommt ein Fenster, das erst weggeht, wenn du „Erledigt“ oder „Später“ tippst, und solange Mirella offen ist, meldet sie sich mit Ton immer wieder. Anrufe nur ${esc(dayLabel(callDays()))} von ${S.settings.callFrom} bis ${S.settings.callTo} Uhr, Nachrichten und Geburtstage ${esc(dayLabel(msgDays()))} von ${S.settings.msgFrom} bis ${S.settings.msgTo} Uhr (einstellbar unter Kontakte).</p>
    ${setH("Was soll nerven?")}${setTgl("nerv.anrufe", "Fällige Anrufe", "bis du angerufen hast")}${setTgl("nerv.aufgaben", "Aufgaben mit Nerv-Modus", "und alle mit Priorität Hoch")}${setTgl("nerv.geburtstage", "Geburtstage", "am Tag selbst, bis du gratuliert hast")}${setTgl("nerv.fristen", "Fristen", "Kündigungen, TÜV, Rechnungen, Ablauf von Dokumenten")}${setTgl("nerv.supplements", "Supplements", "morgens und abends, bis abgehakt")}
    ${setH("Wie oft?")}${setSel("nervEvery", "Erneut melden", "solange Mirella offen ist", [[5, "alle 5 Minuten"], [10, "alle 10 Minuten"], [15, "alle 15 Minuten"], [30, "alle 30 Minuten"], [60, "jede Stunde"], [120, "alle 2 Stunden"]])}${setTgl("nervSound", "Mit Ton", "kurzer Ton beim Melden")}
    <p class="hint">Richtig laut und auch bei geschlossener App geht das erst in der iPhone-App (TestFlight) mit echten Mitteilungen. Die Einstellungen hier gelten dann automatisch auch dort.</p>`;
  },
  konto() { return typeof syBlock === "function" ? syBlock().replace('<div class="sec sethead"><span class="label">Konto und Abgleich</span></div>', "") : '<p class="hint">Abgleich ist nicht geladen.</p>'; },
  sicherung() {
    const last = S.settings.pcLast;
    return `${setH("Sicherung für den PC")}<p class="hint" style="margin-top:0">Ein ZIP mit allem: <b>Excel</b> mit allen Kontakten und Infos (plus Aufgaben, Einkauf, Verträge, Ausgaben), <b>alle PDFs und Fotos</b> sauber benannt und nach Bereich und Ordner sortiert, und die Datei zum Wiederherstellen. Funktioniert ohne Supabase und ohne Mirella.</p>
    <button class="btn pri" data-act="pcbackup" style="width:100%">PC-Sicherung jetzt erstellen</button><p class="swipehint" id="pcb-state" style="text-align:left">${last ? "Letzte PC-Sicherung: " + esc(relDate(last)) : "Noch keine PC-Sicherung gemacht."}</p>
    <p class="hint">Danach im Teilen-Fenster „In Dateien sichern“ › <b>OneDrive</b> › CoWork › Private App › 05_Sicherung wählen.</p>
    <p class="hint"><b>Automatisch jede Nacht:</b> Das kleine PC-Programm (im GitHub-Ordner tools/pc-sicherung, einmal <b>EINRICHTEN.cmd</b> doppelklicken) holt alles selbst vom Server in den Ordner 05_Sicherung. Dann musst du hier nichts mehr tun.</p>
    ${setH("Sicherungsdatei (nur für Mirella)")}<div class="row2" style="margin-top:0"><button class="btn" data-act="export">Sicherung speichern</button><button class="btn" data-act="import">Sicherung laden</button></div>
    <p class="hint">Mit Anmeldung sichert Mirella jede Woche automatisch auf dem Server. Zusätzlich kannst du jederzeit eine Sicherungsdatei speichern, z. B. in iCloud Drive, und sie mit „Sicherung laden“ zurückholen.</p>`;
  },
  info() {
    return `${setH("Was noch kommt")}<p class="hint" style="margin-top:0">Mit der iPhone-App (TestFlight): echte Mitteilungen auch bei geschlossener App, richtiger Wecker, Dokumenten-Scanner mit automatischer Kantenerkennung, iPhone-Kontakte und Kalender direkt. Mit dem Claude-Schlüssel: Briefe und Belege werden von KI gelesen und Fragen frei beantwortet.</p>
    ${setH("Gefahrenzone")}<button class="btn danger" data-act="wipe" style="width:100%">Alle Daten auf diesem Gerät löschen</button>
    <p class="swipehint">Mirella ${VERSION} · ${S.people.length} Kontakte · ${S.todos.length} Einträge · ${S.docs.length} Dokumente · ${S.items.length} Einträge in Bereichen</p>`;
  }
};
function latestBriefing() { return S.briefings.slice().sort((a, b) => (b.d + (b.time || "")).localeCompare(a.d + (a.time || "")))[0] || null; }
/* Seit 11.11.2026 gibt es nur noch ein Briefing pro Tag (8 Uhr, Mo–So); ältere Einträge behalten ihren Namen */
function briefTitle(b) { return b.kind === "nachmittag" ? "Nachmittags-Briefing" : b.kind === "wochenende" ? "Wochenend-Briefing" : b.kind === "morgen" && b.d < "2026-11-11" ? "Morning Briefing" : "Tages-Briefing"; }
function briefCard(b, del) {
  if (b.remote) return `<div class="card ${b.read ? "" : "due"}" role="button" tabindex="0" data-act="openbrief" data-id="${esc(b.id)}"><span class="av">${IC.doku}</span><span style="min-width:0"><div class="t">${esc(briefTitle(b))}</div><div class="s">${esc(briefWhen(b))} · ${b.pdf ? "PDF öffnen" : "PDF wird noch abgelegt"}</div></span>${b.read ? '<span class="pill">PDF</span>' : '<span class="pill acc">neu</span>'}</div>`;
  return `<div class="card ${b.read ? "" : "due"}" role="button" tabindex="0" data-act="openbrief" data-id="${esc(b.id)}"><span class="av">${IC.doku}</span><span style="min-width:0"><div class="t">${esc(briefTitle(b))}</div><div class="s">${esc(fmtDate(b.d))}${b.time ? " · " + esc(b.time) : ""} · ${esc(b.name)}</div></span>${b.read ? (del ? `<button class="rowdel" data-act="delbrief" data-id="${b.id}" aria-label="löschen">✕</button>` : '<span class="pill">PDF</span>') : '<span class="pill acc">neu</span>'}</div>`;
}
async function addBriefings(files) {
  let n = 0;
  for (const f of files) {
    const m = f.name.match(/(\d{4})-(\d{2})-(\d{2})/) || f.name.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    let d = m ? (m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[2]}-${m[1]}`) : iso(new Date(f.lastModified || Date.now()));
    const lm = new Date(f.lastModified || Date.now());
    const kind = "tag";
    const time = String(lm.getHours()).padStart(2, "0") + ":" + String(lm.getMinutes()).padStart(2, "0");
    const id = "br_" + uid();
    try { await photoPut(id, f); } catch (_) { toast("Konnte " + f.name + " nicht speichern"); continue; }
    S.briefings.push({ id, d, time, kind, name: f.name.replace(/\.pdf$/i, ""), type: f.type || "application/pdf", read: false }); n++;
  }
  save(); view = "briefings"; render(); toast(n === 1 ? "Briefing abgelegt" : n + " Briefings abgelegt");
}
async function openBrief(id) {
  const b = S.briefings.find(x => x.id === id); if (!b) return;
  if (b.remote) { if (!b.pdf) { toast("Das PDF ist noch nicht da. Es kommt in wenigen Minuten."); return; } b.read = true; save(); render(true); window.open(webBase() + b.pdf, "_blank", "noopener"); return; }
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

/* In der iPhone-App liegen die Dateien im Paket, Briefings kommen aber immer frisch von der Website */
function webBase() { return NATIVE ? "https://felix260796.github.io/mirella/" : "./"; }
/* Automatische Briefings: ein Zeitplan legt sie aus Gmail in briefings.json ab */
function briefWhen(b) { const d = new Date(b.d + "T12:00"); const t = new Date(); t.setHours(12,0,0,0); const diff = Math.round((t - d) / 864e5); return (diff === 0 ? "heute" : diff === 1 ? "gestern" : d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })) + (b.time ? ", " + b.time + " Uhr" : ""); }
async function syncBriefings() {
  try {
    const r = await fetch(webBase() + "briefings.json?t=" + Date.now(), { cache: "no-store" }); if (!r.ok) return;
    const j = await r.json(); let neu = 0;
    for (const it of j.items || []) {
      const ex = S.briefings.find(b => b.id === "gm_" + it.id);
      if (ex) { Object.assign(ex, { d: it.d, time: it.time, kind: it.kind, pdf: it.pdf || ex.pdf }); delete ex.quote; delete ex.url; continue; }
      S.briefings.push({ id: "gm_" + it.id, remote: true, d: it.d, time: it.time, kind: it.kind, title: "Briefing", pdf: it.pdf, name: "Briefing", read: false }); neu++;
    }
    const ids = new Set((j.items || []).map(it => "gm_" + it.id));
    const before = S.briefings.length;
    S.briefings = S.briefings.filter(b => !b.remote || ids.has(b.id));
    if (neu || S.briefings.length !== before) { save(); if (!$("#sheet").classList.contains("open")) render(true); }
  } catch (_) { }
}
/* Briefings bleiben eine Woche, danach räumt Mirella sie automatisch weg */
function pruneBriefings() {
  const old = S.briefings.filter(b => diffDays(b.d, today()) > 7); if (!old.length) return;
  old.forEach(b => { if (!b.remote) photoDel(b.id).catch(() => { }); });
  S.briefings = S.briefings.filter(b => !old.includes(b)); save();
}

/* ---------- Wetter (Open-Meteo, ohne Schlüssel) ---------- */
const WXC = c => c === 0 ? ["☀️", "klar"] : c <= 2 ? ["🌤️", "leicht bewölkt"] : c === 3 ? ["☁️", "bewölkt"] : c <= 48 ? ["🌫️", "Nebel"] : c <= 57 ? ["🌦️", "Nieselregen"] : c <= 67 ? ["🌧️", "Regen"] : c <= 77 ? ["🌨️", "Schnee"] : c <= 82 ? ["🌧️", "Schauer"] : c <= 86 ? ["🌨️", "Schneeschauer"] : ["⛈️", "Gewitter"];
let WX = null;
try { WX = JSON.parse(localStorage.getItem("mirella.wx") || "null"); } catch (_) { }
function wxHTML() {
  if (!WX || !WX.cur) return `<div class="morning" style="border-color:var(--line)"><div class="wx"><span style="font-size:28px">🌡️</span><div><span style="font-size:14px">Wetter wird geladen …</span><small>Falls nichts kommt: Einstellungen › Wetter-Ort festlegen.</small></div></div></div>`;
  const [ic, txt] = WXC(WX.cur.weather_code), dl = WX.daily || {}, nowH = new Date().getHours();
  const dn = L.wxDayNight(WX.hourly || {}, today(), nowH), on = S.settings.wxHint || {};
  const r = n => n == null ? "–" : Math.round(n) + "°";
  const dayMax = dn.dayMax != null ? dn.dayMax : (dl.temperature_2m_max || [])[0], nightMin = dn.nightMin != null ? dn.nightMin : (dl.temperature_2m_min || [])[0];
  const hints = dn.hints.filter(h => on[h.k] === undefined || !!on[h.k]);
  // kompakt, alle Hinweise direkt sichtbar; antippen öffnet die ausführliche Wetterseite
  return `<div class="wxc" role="button" tabindex="0" data-act="wetter" aria-label="Ausführliches Wetter öffnen"><div class="wxrow"><span class="wxic">${ic}</span><span class="tmp">${Math.round(WX.cur.temperature_2m)}°</span><span class="wxtxt"><span>${esc(txt)} · Regen ${(dl.precipitation_probability_max || [])[0] ?? 0} %</span><small>☀️ ${r(dn.dayMin)} bis ${r(dayMax)}  ·  🌙 ${r(nightMin)} bis ${r(dn.nightMax)}</small></span></div>
  ${hints.length ? `<div class="wxhints">${hints.map(h => `<div>${h.ic} ${esc(h.t)}</div>`).join("")}</div>` : ""}<div class="wxmorel">Ausführliches Wetter ›</div></div>`;
}
/* Standort: einmal erlauben, dann dauerhaft gespeichert (kein erneutes Nachfragen) */
function geoOnce() {
  return new Promise(res => {
    const G = NATIVE && window.Capacitor.Plugins.Geolocation;
    if (G) { // echte App: Apples Standortabfrage, einmal erlauben unter Einstellungen › Mirella
      return G.requestPermissions().then(() => G.getCurrentPosition({ timeout: 10000, maximumAge: 24 * 3600e3 })).then(pos => {
        S.settings.wxLat = +pos.coords.latitude.toFixed(3); S.settings.wxLon = +pos.coords.longitude.toFixed(3); S.settings.wxName = "deinem Standort"; S.settings.geoAsked = true; save();
        res({ lat: S.settings.wxLat, lon: S.settings.wxLon, place: S.settings.wxName });
      }).catch(e => { S.settings.geoAsked = true; save(); res({ err: /denied|permission/i.test(String(e && e.message)) ? "denied" : "fail" }); });
    }
    if (!navigator.geolocation) return res({ err: "none" });
    navigator.geolocation.getCurrentPosition(pos => {
      S.settings.wxLat = +pos.coords.latitude.toFixed(3); S.settings.wxLon = +pos.coords.longitude.toFixed(3); S.settings.wxName = "deinem Standort"; S.settings.geoAsked = true; save();
      res({ lat: S.settings.wxLat, lon: S.settings.wxLon, place: S.settings.wxName });
    }, e => { S.settings.geoAsked = true; save(); res({ err: e && e.code === 1 ? "denied" : "fail" }); }, { timeout: 10000, maximumAge: 24 * 3600e3 });
  });
}
const GEO_HELP = "Standort ist für Mirella gesperrt. iPhone: Einstellungen › Datenschutz & Sicherheit › Ortungsdienste › Safari-Websites › „Beim Verwenden der App“. Dann in Safari auf „aA“ › Website-Einstellungen › Standort › „Erlauben“. Die App auf dem Home-Bildschirm hat ihre eigene Freigabe, getrennt von Safari. Fragt sie nicht nach: in Mirella zuerst Einstellungen › „Sicherung speichern“, dann das Mirella-Icon löschen, die Seite in Safari neu „Zum Home-Bildschirm“ hinzufügen, Sicherung laden und hier nochmal tippen. Oder unter Einstellungen einfach einen Ort eintippen.";
async function wxCoords() {
  if (S.settings.wxLat != null) return { lat: S.settings.wxLat, lon: S.settings.wxLon, place: S.settings.wxName };
  if (S.settings.geoAsked) { // nicht erneut nachfragen, außer iOS meldet die Freigabe inzwischen als erteilt
    let st = null; if (NATIVE) st = "granted"; else try { st = navigator.permissions ? (await navigator.permissions.query({ name: "geolocation" })).state : null; } catch (_) { }
    if (st !== "granted") return null;
  }
  wxCoords.p = wxCoords.p || geoOnce();
  const g = await wxCoords.p; return g.err ? null : g;
}
async function loadWeather(force) {
  if (!force && WX && WX.hourly && WX.hourly.precipitation && WX.daily && WX.daily.sunrise && Date.now() - WX.t < 30 * 60e3) return;
  const c = await wxCoords(); if (!c) { const el = $("#wx"); if (el && (!WX || !WX.cur)) el.innerHTML = `<button class="btn" data-act="wxhere" style="width:100%">📍 Wetter: Standort für Mirella freigeben</button><div class="hint" style="margin-top:6px">Oder unter Einstellungen › Wetter einen Ort eintippen, dann braucht Mirella keinen Standort.</div>`; return; }
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,apparent_temperature,weather_code,is_day,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_gusts_10m,uv_index,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,precipitation_hours,weather_code,sunrise,sunset,uv_index_max&minutely_15=precipitation&forecast_minutely_15=12&timezone=Europe%2FBerlin&forecast_days=8`);
    const j = await r.json(); if (!j.current) throw new Error();
    WX = { t: Date.now(), place: c.place, cur: j.current, daily: j.daily, hourly: j.hourly, minutely_15: j.minutely_15 };
    try { localStorage.setItem("mirella.wx", JSON.stringify(WX)); } catch (_) { }
    const el = $("#wx"); if (el) el.innerHTML = view === "wetter" ? "" : wxHTML();
    if (view === "wetter") render(true);
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
/* Datum ausgeschrieben: „20. März 1999“ (ohne Jahr, wenn unbekannt) */
function longDate(s) { if (!s) return ""; const [y, m, d] = s.split("-").map(Number); return `${d}. ${MN[m - 1]}${y && y !== 1604 ? " " + y : ""}`; }
function bdayBlock(p, nb) {
  if (p.death) {
    if (!p.bday && !p.death) return "";
    return `<div class="block"><h4>Lebensdaten</h4><div class="kvgrid"><div><span class="k">Geboren</span><b>${p.bday ? "* " + esc(longDate(p.bday)) : "–"}</b></div><div><span class="k">Gestorben</span><b>† ${esc(longDate(p.death))}</b></div></div></div>`;
  }
  if (!nb) return "";
  const a = ageAt(p, nb), n = diffDays(today(), nb), isT = nb === today();
  const line = isT ? `🎂 Heute ${a ? "wird " + (p.first || "") + " " + a + " Jahre alt" : "ist Geburtstag"}!` : `${a ? `Wird ${a} Jahre alt` : "Nächster Geburtstag"} am ${esc(fmtDate(nb))}, ${n === 1 ? "morgen" : "in " + n + " Tagen"}`;
  const round = a && !isT ? (a === 18 || (S.settings.roundAges || []).includes(a) || a % 10 === 0) : false;
  return `<div class="block"><h4>Geburtstag</h4><div class="kvgrid"><div><span class="k">Geboren</span><b>${esc(longDate(p.bday))}</b></div>${a ? `<div><span class="k">Alter</span><b>${isT ? a : a - 1} Jahre</b></div>` : ""}</div><div class="bdline${isT ? " today" : ""}${round ? " round" : ""}">${round ? "🎉 " : ""}${line}</div>${p.gift ? `<div class="bdline">Geschenk-Erinnerung ${S.settings.giftLead} Tage vorher</div>` : ""}${n <= 1 && p.tel ? `<button class="btn" data-act="gruss" data-id="${p.id}" style="width:100%;margin-top:10px">💬 Glückwunsch schreiben</button>` : ""}</div>`;
}
/* Geburtstagsgruß: Mirella schreibt vor, WhatsApp oder Nachrichten öffnen sich mit Text und Empfänger. Gesendet wird erst, wenn du selbst auf Senden tippst. */
function grussForm(p) {
  const a = ageAt(p, nextBirthday(p) || today()), nm = p.nick || p.first || fullName(p);
  const txt = `Alles Gute zum ${a && (a % 10 === 0 || a === 18) ? a + ". " : ""}Geburtstag, ${nm}! 🎉 Ich wünsche dir einen richtig schönen Tag und alles Liebe fürs neue Lebensjahr.`;
  const canKi = (typeof kiOn === "function" && kiOn()) || typeof window.appleKi === "function";
  openSheet(`<p class="stitle">Glückwunsch an ${esc(fullName(p))}</p><div class="fld"><label for="gr-t">Dein Text (kannst du ändern)</label><textarea id="gr-t" rows="6">${esc(txt)}</textarea></div>
  ${canKi ? `<button class="btn" data-act="grusski" data-id="${p.id}" style="width:100%;margin-bottom:8px">✦ Mirella schreibt es persönlicher</button>` : ""}
  <div class="row2"><button class="btn pri" data-act="grusssend" data-id="${p.id}" data-via="wa">WhatsApp</button><button class="btn pri" data-act="grusssend" data-id="${p.id}" data-via="sms">Nachricht</button></div>
  <p class="hint">Es öffnet sich die App mit dem Text. Abgeschickt wird erst, wenn du dort auf Senden tippst.</p>`);
}
/* So wird eine Nummer gespeichert und gezeigt: „0163 123“ wird „+49 163 123“. Kurze Nummern ohne 0 (110, 116117) bleiben, wie sie sind. */
/* Schlüssel, die ein Dienst abgelehnt hat. Gespeichert wird nur eine Prüfsumme des Schlüssels, damit Mirella erkennt,
   ob inzwischen ein neuer eingetragen ist. Gefragt wird dann beim nächsten Öffnen der App. */
const KEYBAD = "mirella.keybad";
const keySum = k => { let h = 5381; const s = String(k || ""); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
function keyBadGet() { try { return JSON.parse(localStorage.getItem(KEYBAD) || "{}"); } catch (_) { return {}; } }
function keyBad(kind, key, bad) { const o = keyBadGet(); if (bad) o[kind] = keySum(key); else delete o[kind]; try { localStorage.setItem(KEYBAD, JSON.stringify(o)); } catch (_) { } }
const keyIsBad = (kind, key) => !!key && keyBadGet()[kind] === keySum(key);
/* Eingabefeld für Schlüssel: über die volle Breite, darunter „Einfügen“ (ersetzt alles) und „Löschen“ (leert das Feld, mit Rückfrage).
   set = Name der Einstellung, die beim Ändern sofort gespeichert wird (sonst speichert der Knopf des Fensters). */
function keyField(id, label, opt = {}) {
  return `<div class="fld keyfld"><label for="${id}">${label}</label>${opt.warn ? `<small class="fwarn">${opt.warn}</small>` : ""}${opt.note ? `<small class="keynote">${opt.note}</small>` : ""}<input id="${id}" class="keyin" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="${esc(opt.ph || "")}" value="${esc(opt.value || "")}"${opt.set ? ` data-set="${opt.set}"` : ""}><div class="keybtns"><button type="button" class="btn" data-act="keypaste" data-for="${id}">Einfügen</button><button type="button" class="btn" data-act="keyclear" data-for="${id}">Löschen</button></div></div>`;
}
/* Antippen eines Schlüssel-Felds markiert gleich alles, damit Einfügen den alten Schlüssel ganz ersetzt */
document.addEventListener("focusin", e => { if (e.target.classList && e.target.classList.contains("keyin")) setTimeout(() => { try { e.target.select(); } catch (_) { } }, 0); });
function telNice(t) { t = String(t || "").trim(); if (!t || t.startsWith("+")) return t; if (t.startsWith("00")) return "+" + t.slice(2).trim(); if (/^0\d/.test(t)) return "+49 " + t.slice(1).replace(/^[\s\-/()]+/, ""); return t; }
function intlTel(t) { let n = (t || "").replace(/[^\d+]/g, ""); if (n.startsWith("00")) n = "+" + n.slice(2); else if (n.startsWith("0")) n = "+49" + n.slice(1); return n; }
/* Kontaktdaten: jede Zeile gleich aufgebaut (Bezeichnung, Wert, Knopf) */
function contactBlock(p) {
  const rows = [];
  if (p.tel) rows.push(["Telefon", esc(p.tel), `<a class="mini" href="tel:${esc(intlTel(p.tel))}">Anrufen</a>`]);
  for (const m of [p.email, ...(p.emails || [])].filter(Boolean)) rows.push(["E-Mail", esc(m), `<a class="mini" href="mailto:${esc(m)}">Schreiben</a>`]);
  if (p.addr) rows.push(["Adresse", esc(p.addr), routeBtn(p.addr, "Route")]);
  if (p.nick) rows.push(["Spitzname", esc(p.nick), ""]);
  if (p.job) rows.push(["Beruf", esc(p.job), ""]);
  if (!rows.length) return "";
  return `<div class="block"><h4>Kontakt</h4>${rows.map(([k, v, b]) => `<div class="kvrow"><span class="k">${k}</span><span class="v">${v}</span>${b}</div>`).join("")}</div>`;
}
function nextCallBlock(p) {
  const due = nextDue(p), st = callState(p), last = lastCall(p), lastAny = lastCall(p, false);
  if (!due) return `<div class="nextcall"><div><div class="label">Nächster Anruf</div><b>kein fester Rhythmus</b><small>Unter „Bearbeiten“ einen Rhythmus wählen, dann plant Mirella die Anrufe.</small></div></div>`;
  const n = diffDays(today(), due), big = st === "late" ? `seit ${-n} ${-n === 1 ? "Tag" : "Tagen"} fällig` : n === 0 ? "heute" : n === 1 ? "morgen" : `in ${n} Tagen`;
  return `<div class="nextcall ${st}"><div><div class="label">Nächster Anruf</div><b>${esc(big)}</b><small>${st === "late" ? "fällig seit " : ""}${esc(fmtDate(due))} · ${esc(p.cyc)}${p.snooze && p.snooze >= today() ? " · verschoben" : ""}</small></div><div class="nc-r"><div class="label">Zuletzt erreicht</div><b style="font-size:16px">${esc(last ? relDate(last) : "noch nie")}</b>${lastAny && lastAny !== last ? `<small>Versuch ${esc(relDate(lastAny))}</small>` : ""}</div></div>`;
}
function waNum(tel) { let n = tel.replace(/[^\d+]/g, ""); if (n.startsWith("+")) return n.slice(1); if (n.startsWith("00")) return n.slice(2); if (n.startsWith("0")) return "49" + n.slice(1); return n; }
function notePh(id) { return { auto: "z. B. getankt, 58.900 km, 72 €", geld: "z. B. Handyvertrag gekündigt zum 31.3.", gesund: "z. B. Zahnarzt: alles gut", haus: "z. B. Zählerstand Strom 19.310", frei: "z. B. Skiurlaub gebucht, 13.–20.2.", arbeit: "z. B. Jahresgespräch im Januar", sport: "z. B. Paddeln: neues Paddel gekauft", doku: "z. B. Pass beantragt" }[id] || "Notiz"; }
function docRow(d) { return `<div class="listrow"><button data-act="viewphoto" data-id="${d.photo || ""}" style="border:0;padding:0;background:none" aria-label="Foto ansehen"><img class="thumbimg" data-thumb="${d.photo || ""}" alt=""></button><span class="grow">${esc(d.name)}<small>${esc([d.folder, d.until ? "gültig bis " + fmtDate(d.until) : "", fmtDate(d.created)].filter(Boolean).join(" · "))}</small></span><button class="rowdel" data-act="deldoc" data-id="${d.id}" aria-label="löschen">✕</button></div>`; }
/* docsHTML() und financeHTML() stehen in bereiche.js */
const CALF = [["geb", "Geburtstage"], ["erin", "Erinnerungen"], ["todo", "To-dos"], ["anruf", "Anrufe"], ["treff", "Treffen"]];
const weekStart = k => addDays(k, -((D(k).getDay() + 6) % 7));
function eventsRange(from, to, all) {
  const f = all ? { geb: 1, erin: 1, todo: 1, anruf: 1, termin: 1, treff: 1 } : S.settings.calFilter;
  const ev = {}, add = (d, c, k, t, act, id, time) => { if ((f[c] ?? 1) && d >= from && d <= to) (ev[d] = ev[d] || []).push({ c, k, t, act, id, time: time || "" }); };
  for (const t of S.todos) {
    if (t.list !== "todo" || !t.date) continue;
    const c = t.kind === "treff" ? "treff" : t.area || t.ref ? "erin" : "todo";
    if (t.done) { add(t.date, c, "Erledigt", t.t, "edittodo", t.id); continue; }
    let d = t.date, guard = 0;
    while (d && d <= to && guard++ < 400) { add(d, c, c === "treff" ? "Treffen" : t.area ? areaById(t.area)?.n.split(" ")[0] || "Erinnerung" : "To-do", t.t, "edittodo", t.id, t.time); if (!t.rep || t.rep === "nie") break; d = stepRep(d, t.rep); }
  }
  for (const p of S.people) {
    if (p.bday) { const [, m, dd] = p.bday.split("-"); for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) add(`${y}-${m}-${dd}`, "geb", p.death ? "Gedenken" : "Geburtstag", fullName(p) + (p.death ? " · Geburtstag" : ageAt(p, `${y}-${m}-${dd}`) ? " wird " + ageAt(p, `${y}-${m}-${dd}`) : ""), "person", p.id); }
    if (p.death) { const [, m, dd] = p.death.split("-"); for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) add(`${y}-${m}-${dd}`, "geb", "Gedenken", fullName(p) + " · Todestag", "person", p.id); }
    for (const k of p.arch ? [] : p.kin || []) {
      if (k.bday) { const [, m, dd] = k.bday.split("-"); for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) add(`${y}-${m}-${dd}`, "geb", k.death ? "Gedenken" : "Geburtstag", k.name + " (" + (k.rel || "Familie") + " von " + fullName(p) + ")" + (!k.death && ageAt(k, `${y}-${m}-${dd}`) > 0 ? " wird " + ageAt(k, `${y}-${m}-${dd}`) : ""), "person", p.id); }
      if (k.death) { const [, m, dd] = k.death.split("-"); for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) add(`${y}-${m}-${dd}`, "geb", "Gedenken", k.name + " · Todestag", "person", p.id); }
    }
    const due = nextDue(p); if (due) add(due < today() ? today() : due, "anruf", "Anruf", fullName(p), "person", p.id);
    const ld = lunchDue(p); if (ld) add(ld < today() ? today() : ld, "treff", "Treffen vereinbaren", fullName(p), "person", p.id);
    for (const c of p.calls || []) add(c.d, "anruf", "Anruf", fullName(p) + (c.ok ? " · erreicht" : " · nicht erreicht"), "person", p.id);
  }
  for (const d of S.docs) if (d.until) add(d.until, "erin", "Frist", d.name, "area", d.area || "doku");
  HOOKS.events.flatMap(f => f(from, to)).forEach(e => add(e.d, e.c || "erin", e.k, e.t, e.act, e.id, e.time));
  for (const k of Object.keys(ev)) ev[k].sort((a, b) => (a.time || "99") < (b.time || "99") ? -1 : 1);
  return ev;
}
function evRow(e) { return `<div class="ev ev-${e.c}" role="button" tabindex="0" data-act="${e.act}" data-id="${e.id}" style="cursor:pointer"><i>${e.time ? esc(e.time) + " · " : ""}${esc(e.k)}</i>${esc(e.t)}</div>`; }

/* ---------- Rendern ---------- */
function render(keepScroll) {
  const sc = $("#screen"), st = sc.scrollTop;
  sc.innerHTML = R[view]();
  sc.scrollTop = keepScroll ? st : 0;
  const tabView = view === "akte" ? "menschen" : view;
  $$(".tab").forEach(b => b.dataset.v === tabView ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
  $("#plus").hidden = !["menschen", "todos", "kalender", "bereich"].includes(view); // auf „Heute“ steckt das Plus im Mikro
  if (view === "heute" || view === "wetter") loadWeather();
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
  $("#sheetbody").innerHTML = html; sheetDirty = false;
  const sh = $("#sheet"); sh.classList.add("open"); sh.setAttribute("aria-hidden", "false"); sh.scrollTop = 0;
  $("#scrim").classList.add("open");
  if (after) after();
  const box = $("#sheetbody [data-draft]");
  if (box && draftApply(box.dataset.draft)) { box.dispatchEvent(new CustomEvent("draftapplied")); toast("Deine letzte Eingabe ist wieder da"); }
}
/* ---------- Entwürfe: jede Eingabe wird sofort gemerkt, nichts geht verloren ---------- */
const DRAFT = "mirella.draft";
let sheetDirty = false;
function draftSave() {
  const box = $("#sheetbody [data-draft]"); if (!box || !$("#sheet").classList.contains("open")) return;
  const vals = {}; box.querySelectorAll("input[id],select[id],textarea[id]").forEach(el => { if (el.type !== "file") vals[el.id] = el.type === "checkbox" ? el.checked : el.value; });
  sheetDirty = true;
  try { localStorage.setItem(DRAFT, JSON.stringify({ k: box.dataset.draft, vals, t: Date.now(), title: ($("#sheetbody .stitle") || {}).textContent || "" })); } catch (_) { }
}
function draftGet(k) { try { const d = JSON.parse(localStorage.getItem(DRAFT) || "null"); return d && (!k || d.k === k) && Date.now() - d.t < 3 * 864e5 ? d : null; } catch (_) { return null; } }
function draftClear() { sheetDirty = false; try { localStorage.removeItem(DRAFT); } catch (_) { } }
function draftApply(k) {
  const d = draftGet(k); if (!d) return false;
  for (const [id, val] of Object.entries(d.vals)) { const el = document.getElementById(id); if (!el) continue; if (el.type === "checkbox") el.checked = !!val; else el.value = val; }
  sheetDirty = true; return true;
}
/* Öffnet nach einem Neustart das Formular, in dem zuletzt etwas eingetragen wurde */
function draftResume() {
  const d = draftGet(); if (!d) return;
  const [kind, id, sub] = d.k.split(":");
  if (kind === "person") personForm(id === "new" ? null : S.people.find(x => x.id === id));
  else if (kind === "todo") todoForm(id === "new" ? null : S.todos.find(x => x.id === id));
  else if (kind === "item" && typeof itemForm === "function") itemForm(id, sub === "new" ? null : S.items.find(x => x.id === sub));
  else if (kind === "wecker" && typeof weckerForm === "function") weckerForm(id === "new" ? null : S.alarms.find(x => x.id === id));
  else if (kind === "exp") expenseForm();
  else draftClear();
}
function closeSheet(byUser) {
  if (byUser && sheetDirty && $("#sheetbody [data-draft]")) toast("Entwurf gemerkt. Beim nächsten Öffnen ist alles wieder da.");
  if (sheetCleanup) { const f = sheetCleanup; sheetCleanup = null; f(); }
  const sh = $("#sheet"); sh.classList.remove("open"); sh.setAttribute("aria-hidden", "true");
  if (!$("#drawer").classList.contains("open")) $("#scrim").classList.remove("open");
  document.activeElement && document.activeElement.blur && document.activeElement.blur();
}
function drawerHTML() {
  const nb = S.briefings.filter(b => !b.read).length;
  const brief = `<button class="drow" data-act="go" data-v="briefings">${IC.doku}<span class="dt"><b>Briefings</b><small>${S.briefings.length ? "Diese Woche: " + S.briefings.filter(b => isoWeek(b.d) === isoWeek(today()) && b.d.slice(0, 4) === today().slice(0, 4)).length + " · neuestes " + relDate(latestBriefing().d) : "Noch keine Briefings"}</small></span>${nb ? `<span class="pill acc">${nb}</span>` : ""}<span class="chev">›</span></button><button class="drow" data-act="go" data-v="auswertungen">${IC.doku}<span class="dt"><b>Auswertungen</b><small>Aufgaben, Anrufe, Einkauf, Geld: was deine Einträge zeigen</small></span><span class="chev">›</span></button>`;
  return wxRow() + AREAS.map(A => {
    const open = S.todos.filter(t => t.area === A.id && !t.done && t.list === "todo");
    const late = open.some(t => t.date && t.date < today());
    const sub = A.id === "doku" ? pl(S.docs.length, "Dokument", "Dokumente") : A.id === "geld" ? `${eur(S.expenses.filter(e => e.d.startsWith(today().slice(0, 7))).reduce((a, e) => a + +e.amount, 0))} diesen Monat` : open.length ? open[0].t : "Notizen, Erinnerungen, Fotos";
    return `<button class="drow" data-act="area" data-id="${A.id}"><span class="aic" style="--ac:${A.c}">${IC[A.ic]}</span><span class="dt"><b>${esc(A.n)}</b><small>${esc(sub)}</small></span>${open.length ? `<span class="pill ${late ? "late" : "acc"}">${open.length}</span>` : ""}<span class="chev">›</span></button>`;
  }).join("") + brief;
}
function wxRow() {
  const sub = WX && WX.cur ? `${Math.round(WX.cur.temperature_2m)}° · ${WXC(WX.cur.weather_code)[1]} · Regen ${((WX.daily || {}).precipitation_probability_max || [])[0] ?? 0} %` : "Regen Stunde für Stunde, 7 Tage";
  return `<button class="drow" data-act="wxdrawer"><span class="aic" style="--ac:#3E8FD0">${IC.cloud}</span><span class="dt"><b>Wetter</b><small>${esc(sub)}</small></span><span class="chev">›</span></button>`;
}
function openDrawer() { closeSheet(); $("#dbody").innerHTML = drawerHTML(); $("#drawer").classList.add("open"); $("#drawer").setAttribute("aria-hidden", "false"); $("#scrim").classList.add("open"); }
function closeDrawer() { $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true"); if (!$("#sheet").classList.contains("open")) $("#scrim").classList.remove("open"); }
function closeAll(byUser) { closeSheet(byUser); closeDrawer(); $("#scrim").classList.remove("open"); }
/* Sicherheitsrückfrage vor jedem Löschen */
function ask(msg) { try { return window.confirm(msg); } catch (_) { return false; } }
function calStep(n) {
  if (calView === "monat") return shiftMonth(n);
  selDate = addDays(selDate, calView === "woche" ? 7 * n : n); calY = +selDate.slice(0, 4); calM = +selDate.slice(5, 7) - 1; render();
}
function monthPicker(y) {
  openSheet(`<p class="stitle">Monat wählen</p><div class="mnav"><button class="iconbtn" data-act="mpy" data-y="${y - 1}" aria-label="Vorheriges Jahr">‹</button><b style="font-family:var(--f-display);font-size:22px">${y}</b><button class="iconbtn" data-act="mpy" data-y="${y + 1}" aria-label="Nächstes Jahr">›</button></div>
  <div class="mpick">${MN.map((m, i) => `<button class="btn${y === calY && i === calM ? " pri" : ""}" data-act="mpset" data-y="${y}" data-m="${i}">${m.slice(0, 3)}</button>`).join("")}</div>
  <div class="row2"><button class="btn" data-act="mptoday">Heute</button><button class="btn" data-close="sheet">Schließen</button></div>`);
}
function plusAction() {
  if (view === "menschen") personForm(null);
  else if (view === "todos" && todoList === "einkauf") { const i = $("#shopin"); i && i.focus(); }
  else if (view === "kalender") { if (typeof plusMenu === "function") plusMenu("kalender"); else todoForm(null, { date: selDate }); }
  else if (view === "bereich") { if (typeof plusMenu === "function") plusMenu(area); else todoForm(null, { area }); }
  else if (view === "heute" && typeof plusMenu === "function") plusMenu("heute");
  else todoForm(null);
}

/* ---------- Formulare ---------- */
function todoForm(t, preset = {}) {
  const v = t || Object.assign({ t: "", date: "", time: "", rep: "nie", nerv: true, trig: "zeit", area: "", prio: "" }, preset);
  openSheet(`<div data-draft="todo:${t ? t.id : "new"}"><p class="stitle">${t ? "Aufgabe bearbeiten" : preset.area ? "Neue Erinnerung" : "Neue Aufgabe"}</p>
  <div class="fld"><label for="a-what">Was?</label><input id="a-what" value="${esc(v.t)}" placeholder="z. B. Waschmaschine ausräumen"></div>
  <div class="fld"><label>Priorität</label><div class="pick3" id="a-prio-pick">${[["", "Keine", ""], ...PRIOS].map(([k, n, c]) => `<button type="button" data-act="pickprio" data-p="${k}" aria-pressed="${String(v.prio || "") === String(k)}"${c ? ` style="--pc:${c}"` : ""}>${c ? '<i class="pdot"></i>' : ""}${n}</button>`).join("")}</div><input type="hidden" id="a-prio" value="${esc(v.prio || "")}"></div>
  <div class="fld"><label for="a-trig">Wann erinnern?</label><select id="a-trig"><option value="zeit"${v.trig !== "verlassen" ? " selected" : ""}>An einem Tag</option><option value="verlassen"${v.trig === "verlassen" ? " selected" : ""}>Bevor ich losgehe (auf „Heute“ oben)</option></select></div>
  <div class="fgrid" id="f-time"${v.trig === "verlassen" ? " hidden" : ""}><div class="fld"><label for="a-date">Datum (leer = ohne Termin)</label><input type="date" id="a-date" value="${esc(v.date || "")}"></div><div class="fld"><label for="a-time">Uhrzeit</label><input type="time" id="a-time" value="${esc(v.time || "")}"></div></div>
  <div class="fld" style="position:relative"><label for="a-ort">Wo? (leer lassen, wenn egal)</label><input id="a-ort" value="${esc(v.ort || "")}" placeholder="z. B. Tati-Café Stuttgart" autocomplete="off"><div id="a-ort-sug" class="sug" hidden></div>${v.ort ? `<div style="margin-top:6px">${routeBtn(v.ort, "Route dorthin")}</div>` : ""}</div>
  <div class="fgrid"><div class="fld"><label for="a-rep">Wiederholen</label><select id="a-rep">${REPS.map(r => `<option${r === (v.rep || "nie") ? " selected" : ""}>${r}</option>`).join("")}</select></div>
  <div class="fld"><label for="a-area">Bereich</label><select id="a-area"><option value="">kein Bereich</option>${AREAS.map(a => `<option value="${a.id}"${a.id === v.area ? " selected" : ""}>${esc(a.n)}</option>`).join("")}</select></div></div>
  <label class="tgl big"><input type="checkbox" id="a-nerv"${v.nerv ? " checked" : ""}><span><b>Nerv-Modus</b><small>meldet sich, bis es erledigt ist. Zum Ausschalten Haken wegnehmen.</small></span></label>
  ${t ? todoDocs(t) : ""}
  ${t && t.date ? `<button class="btn" data-act="ics" data-id="${t.id}" style="width:100%;margin-top:8px">⏰ Zusätzlich als Wecker in den iPhone-Kalender</button>` : ""}
  <div class="row2">${t ? `<button class="btn danger" data-act="deltodo" data-id="${t.id}" style="flex:none">Löschen</button>` : ""}<button class="btn" data-act="cancel">Abbrechen</button><button class="btn pri" data-act="savetodo" data-id="${t ? t.id : ""}">Speichern</button></div></div>`,
    () => { $("#a-trig").onchange = e => { $("#f-time").hidden = e.target.value === "verlassen"; }; addrSuggest($("#a-ort"), $("#a-ort-sug"), true); });
}
function todoDocs(t) {
  const docs = S.docs.filter(d => d.ref === t.id);
  return `${docs.length ? `<div style="margin-top:8px">${docs.map(docRow).join("")}</div>` : ""}<div class="docmini"><span>Anhang:</span><button type="button" data-act="pdffor" data-id="${t.id}">PDF</button><button type="button" data-act="docfortodo" data-id="${t.id}">Foto / Scan</button></div>`;
}
function saveTodo(id) {
  const w = $("#a-what").value.trim(); if (!w) { toast("Bitte eintragen, was zu tun ist"); return; }
  const trig = $("#a-trig").value;
  const data = { t: w, trig, date: trig === "verlassen" ? "" : $("#a-date").value, time: trig === "verlassen" ? "" : $("#a-time").value, rep: $("#a-rep").value, area: $("#a-area").value, nerv: $("#a-nerv").checked, prio: $("#a-prio").value ? +$("#a-prio").value : "", ort: $("#a-ort") ? ($("#a-ort").dataset.label || $("#a-ort").value.trim()) : "" };
  if (data.rep !== "nie" && !data.date && trig !== "verlassen") data.date = today();
  if (id) Object.assign(S.todos.find(x => x.id === id), data);
  else S.todos.push(Object.assign({ id: uid(), list: "todo", done: false, created: today() }, data));
  if (data.ort && !($("#a-ort").dataset.label) && !/\d{5}/.test(data.ort)) { const nt = id ? S.todos.find(x => x.id === id) : S.todos[S.todos.length - 1], was = data.ort; placeFind(was).then(full => { if (full && nt.ort === was) { nt.ort = full; save(); render(true); } }); }
  draftClear(); save(); closeSheet(); render(true); toast("Gespeichert: " + w);
}
const todoSeg = isShop => `<div class="seg"><button data-act="todolist" data-l="todo" aria-pressed="${!isShop}">Aufgaben</button><button data-act="todolist" data-l="einkauf" aria-pressed="${isShop}">Einkaufsliste</button></div>`;
/* Einkaufsliste nach Warengruppen; Abgehaktes bleibt sichtbar, bis „Einkauf fertig“ */
let shopMode = false, shopLock = null;
function wakeLock(on) {
  try { if (on && navigator.wakeLock && !shopLock) navigator.wakeLock.request("screen").then(l => { shopLock = l; l.addEventListener("release", () => { shopLock = null; }); }).catch(() => { }); else if (!on && shopLock) { shopLock.release(); shopLock = null; } } catch (_) { }
}
document.addEventListener("visibilitychange", () => { if (shopMode && document.visibilityState === "visible") wakeLock(true); });
/* Einkaufsmodus: nur die Liste, große Zeilen, ganze Zeile antippen = in den Wagen, Bildschirm bleibt an */
function shopModeView(cur) {
  const order = L.SHOPGROUPS.map(g => g[0]).concat("Sonstiges"), by = {};
  cur.forEach(t => { const g = L.shopGroup(t.t); (by[g.n] = by[g.n] || { ic: g.ic, l: [] }).l.push(t); });
  const got = cur.filter(t => t.done).length, all = cur.length, pct = all ? Math.round(100 * got / all) : 0;
  const groups = order.filter(n => by[n]).map(n => { const g = by[n], l = g.l.slice().sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
    return `<div class="smgrp"><div class="smgh">${g.ic} ${esc(n)}</div>${l.map(t => `<button class="smrow${t.done ? " done" : ""}" data-act="toggle" data-id="${t.id}" aria-pressed="${!!t.done}"><span class="smbox">${t.done ? "✓" : ""}</span><span class="smt">${L.qtyLabel(t) ? `<b>${esc(L.qtyLabel(t))}</b> ` : ""}${esc(t.t)}</span></button>`).join("")}</div>`; }).join("");
  return `<div class="smhead"><div><b>🛒 Einkaufsmodus</b><small>${got} von ${all} im Wagen</small></div><button class="mini" data-act="shopmode" data-on="0">Beenden</button></div>
  <div class="smbar"><i style="width:${pct}%"></i></div>
  ${all ? groups : empty("Die Einkaufsliste ist leer.")}
  ${got ? `<button class="btn pri" data-act="shopdone" style="width:100%;margin:14px 0 4px;padding:16px">Einkauf fertig (${got} im Wagen${all - got ? ", " + (all - got) + (all - got === 1 ? " bleibt" : " bleiben") + " auf der Liste" : ""})</button>` : `<p class="swipehint">Tipp eine Zeile an, wenn die Sache im Wagen liegt. Der Bildschirm bleibt dabei an.</p>`}`;
}
function shopView(all) {
  const cur = all.filter(t => !t.arch), open = cur.filter(t => !t.done), got = cur.filter(t => t.done);
  if (shopMode) return shopModeView(cur);
  const order = L.SHOPGROUPS.map(g => g[0]).concat("Sonstiges"), by = {};
  cur.forEach(t => { const g = L.shopGroup(t.t); (by[g.n] = by[g.n] || { ic: g.ic, l: [] }).l.push(t); });
  const groups = order.filter(n => by[n]).map(n => { const g = by[n], l = g.l.slice().sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0)), o = l.filter(t => !t.done).length;
    return `<div class="shopgrp${o ? "" : " alldone"}"><div class="sgh"><span>${g.ic} ${esc(n)}</span><span class="sgn">${o ? o + " offen" : "✓ alles"}</span></div>${l.map(todoRow).join("")}</div>`; }).join("");
  return `${cur.length ? `<button class="btn pri shopgo" data-act="shopmode" data-on="1">🛒 Einkaufen gehen<small>Einkaufsmodus: große Liste zum Abhaken</small></button>` : ""}<form class="shoprow" data-form="shop" style="margin-bottom:8px"><input class="search" id="shopin" style="margin:0" placeholder="z. B. 2 Liter Milch, Butter" aria-label="Artikel" enterkeyhint="done"><button class="btn pri" style="flex:none" aria-label="Hinzufügen">+</button><button class="btn" type="button" data-act="shopphoto" style="flex:none" aria-label="Einkaufszettel fotografieren">📷</button></form>
    ${cur.length ? groups : empty("Die Einkaufsliste ist leer. Tipp oben ein, sprich es ein, oder fotografier deinen Einkaufszettel.")}
    ${got.length ? `<button class="btn pri" data-act="shopdone" style="width:100%;margin:10px 0 4px">Einkauf fertig (${got.length} im Wagen${open.length ? ", " + open.length + (open.length === 1 ? " bleibt" : " bleiben") : ""})</button><p class="swipehint">Abgehaktes bleibt sichtbar, bis du hier tippst. Danach landet es in deinem Einkaufs-Verlauf.</p>` : ""}
    ${shopExtras(open)}
    ${shopHistory(all)}`;
}
/* Frühere Einkäufe: alles, was mit „Einkauf fertig“ abgeschlossen wurde, nach Tag */
function shopHistory(all) {
  const old = all.filter(t => t.arch && t.done), by = {};
  old.forEach(t => { const d = t.doneAt || t.created || "früher"; (by[d] = by[d] || []).push(t); });
  const days = Object.keys(by).sort().reverse();
  if (!days.length) return "";
  return `<div class="block" style="margin-top:12px"><button class="bh" data-act="shophist" style="width:100%;border:0;background:none;padding:0;font:inherit;color:inherit;cursor:pointer"><h4>Frühere Einkäufe</h4><span class="label">${days.length} ${days.length === 1 ? "Einkauf" : "Einkäufe"} ${showShopHist ? "▾" : "▸"}</span></button>
  ${showShopHist ? days.slice(0, showShopHist === 2 ? 999 : 8).map(d => `<div class="shophd"><span class="label">${d === "früher" ? "früher" : esc(fmtDate(d))}${d !== "früher" ? " · " + esc(relDate(d)) : ""}</span><span class="label">${by[d].length} Artikel</span></div>${by[d].map(t => `<div class="listrow"><span class="grow">${esc(t.t)}${L.qtyLabel(t) ? `<small>${esc(L.qtyLabel(t))}</small>` : ""}</span><button class="mini" data-act="shopagain" data-id="${t.id}" aria-label="${esc(t.t)} wieder auf die Liste">+ wieder</button></div>`).join("")}`).join("") + (days.length > 8 && showShopHist !== 2 ? `<button class="btn" data-act="shophistall" style="width:100%;margin-top:8px">Alle ${days.length} Einkäufe zeigen</button>` : "") : ""}</div>`;
}
/* Mirella merkt: kleine Auswertungen aus erledigten Aufgaben */
function todoInsights(all) {
  const t = today(), wk = addDays(t, -6), done = all.filter(x => x.done && x.doneAt);
  if (done.length < 3) return "";
  const week = done.filter(x => x.doneAt >= wk), late = done.filter(x => x.date && x.doneAt > x.date), out = [];
  out.push(`Diese Woche hast du <b>${week.length}</b> Aufgabe${week.length === 1 ? "" : "n"} erledigt.`);
  if (done.length >= 5) { const p = Math.round(100 * (done.length - late.length) / done.length); out.push(`<b>${p} %</b> davon pünktlich.${p < 70 ? " Tipp: Gib Aufgaben ein realistisches Datum oder eine Priorität, dann erinnert Mirella rechtzeitig." : ""}`); }
  const ar = {}; late.forEach(x => { if (x.area) ar[x.area] = (ar[x.area] || 0) + 1; }); const worst = Object.entries(ar).sort((a, b) => b[1] - a[1])[0];
  if (worst && worst[1] >= 2 && areaById(worst[0])) out.push(`Bei <b>${esc(areaById(worst[0]).n)}</b> wird es öfter knapp. Vielleicht dort früher erinnern lassen?`);
  const open = all.filter(x => !x.done && x.date && x.date < addDays(t, -7)); if (open.length) out.push(`${open.length} Aufgabe${open.length === 1 ? " ist" : "n sind"} seit über einer Woche überfällig. Erledigen, neu planen oder löschen?`);
  return `<div class="insight"><div class="ih">💡 Mirella merkt</div>${out.map(x => `<p>${x}</p>`).join("")}</div>`;
}
function shopRhythm() {
  const by = {}; S.todos.filter(x => x.list === "einkauf" && x.done && x.doneAt).forEach(x => { const k = x.t.trim().toLowerCase(); (by[k] = by[k] || { n: x.t, d: [] }).d.push(x.doneAt); });
  return Object.values(by).map(o => { const d = [...new Set(o.d)].sort(); if (d.length < 3) return null; const gaps = d.slice(1).map((x, i) => diffDays(d[i], x)), avg = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length), last = d[d.length - 1]; return { n: o.n, avg, due: diffDays(last, today()) >= avg }; }).filter(Boolean).sort((a, b) => a.avg - b.avg);
}
function shopItemForm(t) {
  openSheet(`<div data-draft="shop:${t.id}"><p class="stitle">Artikel</p>
  <div class="fld"><label for="s-what">Was?</label><input id="s-what" value="${esc(t.t)}"></div>
  <div class="fgrid"><div class="fld"><label for="s-qty">Menge</label><input id="s-qty" inputmode="decimal" value="${esc(t.qty ? String(t.qty).replace(".", ",") : "")}" placeholder="z. B. 2"></div><div class="fld"><label for="s-unit">Einheit</label><select id="s-unit">${["", "Stk.", "g", "kg", "l", "ml", "Pck.", "Fl.", "Dose", "Glas", "Becher", "Bund", "Kasten", "Netz", "Rolle", "Tafel", "Tüte"].map(u => `<option value="${u}"${u === (t.unit || "") ? " selected" : ""}>${u || "–"}</option>`).join("")}</select></div></div>
  <div class="row2"><button class="btn danger" data-act="deltodo" data-id="${t.id}" style="flex:none">Löschen</button><button class="btn" data-act="cancel">Abbrechen</button><button class="btn pri" data-act="saveshop" data-id="${t.id}">Speichern</button></div></div>`);
}
function shopExtras(open) {
  const openK = new Set(open.map(x => x.t.trim().toLowerCase()));
  const freq = Object.entries(S.shopFreq || {}).filter(([k]) => !openK.has(k.toLowerCase())).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const rh = shopRhythm().filter(r => r.due && !openK.has(r.n.trim().toLowerCase())).slice(0, 8);
  return `${rh.length ? `<div class="sec"><span class="label">Wohl bald wieder fällig</span><span class="label">nach deinem Rhythmus</span></div><div class="chips">${rh.map(r => `<button class="chip2" data-act="shopadd" data-t="${esc(r.n)}">+ ${esc(r.n)} <small>alle ~${r.avg} T.</small></button>`).join("")}</div>` : ""}
  ${freq.length ? `<div class="sec"><span class="label">Oft gekauft</span><span class="label">antippen = drauf</span></div><div class="chips">${freq.map(([k]) => `<button class="chip2" data-act="shopadd" data-t="${esc(k)}">+ ${esc(k)}</button>`).join("")}</div>` : ""}
  <div class="sec"><span class="label">Vorlagen</span><span class="label">für wiederkehrende Einkäufe</span></div>
  ${S.shopTpl.length ? `<div class="chips">${S.shopTpl.map(t => `<span class="tplchip"><button class="chip2" data-act="usetpl" data-id="${t.id}">🧺 ${esc(t.n)} (${t.items.length})</button><button class="tplx" data-act="deltpl" data-id="${t.id}" aria-label="Vorlage ${esc(t.n)} löschen">✕</button></span>`).join("")}</div>` : '<p class="hint" style="margin-top:0">Lege z. B. „Wocheneinkauf“ oder „Grillen“ an: einmal die Liste füllen, dann als Vorlage speichern. Ein Tipp holt später alles wieder drauf.</p>'}
  ${open.length ? `<button class="btn" data-act="savetpl" style="width:100%;margin-top:6px">Aktuelle Liste als Vorlage speichern</button>` : ""}`;
}
/* Bausteine für das Kontakt-Formular */
const telArt = (id, val, cls) => `<select ${id ? `id="${id}"` : ""} class="lblsel ${cls || ""}" aria-label="Art der Nummer"><option value="">Art wählen</option>${TELL.map(x => `<option${val === x ? " selected" : ""}>${x}</option>`).join("")}</select>`;
const telRow = (n, l) => `<div class="xrow"><div class="xlab">Weitere Nummer (${telArt("", l || "", "telx-l")})</div><div class="xin"><input class="telx-n" type="tel" inputmode="tel" value="${esc(n || "")}" placeholder="weitere Nummer" autocomplete="off" aria-label="Weitere Nummer"><button type="button" class="xdel" data-act="rowdel" aria-label="Diese Nummer entfernen">✕</button></div></div>`;
const mailRow = m => `<div class="xrow"><div class="xin"><input class="mailx" type="email" inputmode="email" autocapitalize="off" value="${esc(m || "")}" placeholder="weitere E-Mail" autocomplete="off" aria-label="Weitere E-Mail"><button type="button" class="xdel" data-act="rowdel" aria-label="Diese E-Mail entfernen">✕</button></div></div>`;
const entryHint = (l, one, many) => (l || []).length ? `<small class="fhint">Schon da: ${l.length === 1 ? "1 " + one : l.length + " " + many}. Die stehen in der Akte.</small>` : "";
/* Ein kompaktes Feld: Antippen öffnet die Auswahl, „Eigene …“ macht daraus ein Textfeld. Der Wert steht immer im Eingabefeld mit der Kennung id. */
function pickField(id, opts, val, none, kind) {
  const list = [...new Set(opts.concat(val ? [val] : []))];
  return `<select id="${id}-s" data-pick="${id}" data-kind="${kind || ""}"><option value="">${esc(none)}</option>${list.map(o => `<option value="${esc(o)}"${o === val ? " selected" : ""}>${esc(o)}</option>`).join("")}<option value="__own">Eigene …</option></select><input id="${id}" type="hidden" value="${esc(val)}">`;
}
/* Eigene Einträge merkt sich Mirella sofort und dauerhaft, damit sie beim nächsten Kontakt wieder zur Auswahl stehen */
const PICKQ = { group: "Name der eigenen Gruppe, z. B. Paddeln", woher: "Woher kennst du ihn oder sie? Eigene Angabe, z. B. Bundeswehr", job: "Beruf, z. B. Elektriker" };
function pickRemember(kind, v) {
  if (!v) return;
  if (kind === "group") { if (!S.groups.includes(v)) S.groups.push(v); }
  else if (kind === "woher" || kind === "job") { const k = kind === "woher" ? "wohers" : "jobs", l = S.settings[k] = S.settings[k] || []; if (!l.includes(v) && !(kind === "woher" ? WOHER : JOBS).includes(v)) l.push(v); }
  else return;
  save();
}
function pickSet(sl, v) { if (v && ![...sl.options].some(o => o.value === v)) { const o = document.createElement("option"); o.value = o.textContent = v; sl.insertBefore(o, sl.options[sl.options.length - 1]); } sl.value = v || ""; }
/* nach dem Wiederherstellen von Eingaben: Auswahl wieder passend zum gemerkten Wert zeigen */
function pickSync() { for (const sl of $$("select[data-pick]")) { const i = document.getElementById(sl.dataset.pick); if (i) pickSet(sl, i.value); } }
document.addEventListener("change", e => { if (e.target && e.target.id === "kp-gift") { const b = document.getElementById("kp-gideabox"); if (b) b.hidden = !e.target.checked; } });
document.addEventListener("change", e => {
  const t = e.target; if (!t || !t.dataset || !t.dataset.pick) return;
  const i = document.getElementById(t.dataset.pick); if (!i) return;
  if (t.value === "__own") {
    const v = (prompt(PICKQ[t.dataset.kind] || "Eigene Angabe") || "").trim().slice(0, 40);
    if (!v) { pickSet(t, i.value); return; }
    pickRemember(t.dataset.kind, v); pickSet(t, v); i.value = v;
  } else i.value = t.value;
  i.dispatchEvent(new Event("input", { bubbles: true }));
});
/* Woher kenne ich jemanden: feste Auswahl, damit sich danach suchen und filtern lässt. Eigene Angaben kommen dazu. */
const WOHER = ["Schule", "Studium", "Ausbildung", "Arbeit", "Geschäftlich", "Verein", "Sport", "Nachbarschaft", "Familie", "Freundeskreis", "Urlaub", "Über die Kinder"];
const woherAll = () => [...new Set(WOHER.concat(S.settings.wohers || [], S.people.map(x => (x.woher || "").trim()).filter(Boolean)))];
/* Beruf: grobe Richtung zur Auswahl, eigene (auch genaue wie „Elektriker“) kommen dazu. Danach lässt sich suchen und fragen. */
const JOBS = ["Handwerk", "Vertrieb", "Einzelhandel", "Büro und Verwaltung", "Technik und IT", "Gesundheit und Pflege", "Schule und Erziehung", "Gastronomie", "Bau", "Bank und Versicherung", "Selbstständig", "Studium oder Ausbildung", "Im Ruhestand"];
const jobAll = () => [...new Set(JOBS.concat(S.settings.jobs || [], S.people.map(x => (x.job || "").trim()).filter(Boolean)))];
const woherChips = (inp, cur) => `<div class="chips woher" data-for="${inp}" style="margin-top:6px">${woherAll().map(w => `<button type="button" class="chip2" data-act="woherset" data-t="${inp}" data-w="${esc(w)}" aria-pressed="${w === cur}">${esc(w)}</button>`).join("")}</div>`;
function personForm(p) {
  const v = p || { first: "", last: "", tel: "", email: "", cyc: "monatlich", group: "Freunde", bday: "", gift: false, addr: "", nick: "" };
  const tl = L.splitTel(v.tel);
  openSheet(`<div data-draft="person:${p ? p.id : "new"}"><p class="stitle">${p ? "Kontakt bearbeiten" : "Neuer Kontakt"}</p>
  <div class="fgrid"><div class="fld"><label for="c-first">Vorname</label><input id="c-first" value="${esc(v.first)}" autocomplete="off" autocapitalize="words"></div><div class="fld"><label for="c-last">Nachname</label><input id="c-last" value="${esc(v.last)}" autocomplete="off" autocapitalize="words"></div></div>
  <div class="fld"><div class="lblrow">Telefon (${telArt("c-tell", v.telL || "")})</div><div class="telrow telcc"><select id="c-cc" aria-label="Land und Vorwahl">${L.COUNTRIES.map(c => `<option value="${c.p}"${c.p === tl.p ? " selected" : ""}>${c.f} ${c.p}</option>`).join("")}</select><input id="c-tel" type="tel" inputmode="tel" value="${esc(tl.n)}" placeholder="151 2345678" aria-label="Telefonnummer"></div><div class="fwarn" id="w-tel" hidden></div>
  <div id="c-tels">${(v.tels || []).map(x => telRow(x.n, x.l)).join("")}</div><button type="button" class="mini plusline" data-act="teladd">+ weitere Nummer</button></div>
  <div class="fld"><label for="c-mail">E-Mail</label><input id="c-mail" type="email" inputmode="email" autocapitalize="off" value="${esc(v.email || "")}" placeholder="name@beispiel.de"><div class="fwarn" id="w-mail" hidden></div>
  <div id="c-mails">${(v.emails || []).map(mailRow).join("")}</div><button type="button" class="mini plusline" data-act="mailadd">+ weitere E-Mail</button></div>
  <div class="fgrid"><div class="fld"><label for="c-grp-s">Gruppe</label>${pickField("c-grp", S.groups, v.group || "", "keine", "group")}</div><div class="fld"><label for="c-woher-s">Woher bekannt?</label>${pickField("c-woher", woherAll(), v.woher || "", "keine Angabe", "woher")}</div></div>
  <div class="fld"><label for="c-job-s">Beruf (heute oder früher)</label>${pickField("c-job", jobAll(), v.job || "", "keine Angabe", "job")}</div>
  <div class="fgrid"><div class="fld"><label for="c-cyc">Anrufen</label><select id="c-cyc">${CYCLES.map(c => `<option value="${c}"${c === (noCycle(v.cyc) && p ? "nie" : v.cyc) ? " selected" : ""}>${cycLabel(c)}</option>`).join("")}</select></div><div class="fld"><label for="c-lunch">Treffen vereinbaren</label><select id="c-lunch"><option value="">nie</option>${Object.keys(LUNCH).map(c => `<option value="${c}"${c === v.lunch ? " selected" : ""}>${c}</option>`).join("")}</select></div></div>
  <div class="fgrid"><div class="fld"><label for="c-bday">Geburtstag</label><input id="c-bday" inputmode="numeric" maxlength="10" placeholder="TT.MM.JJJJ" value="${esc(L.bdayToInput(v.bday))}" autocomplete="off"></div><div class="fld"><label for="c-nick">Spitzname (für Sprache)</label><input id="c-nick" value="${esc(v.nick || "")}" placeholder="z. B. Oma"></div></div>
  <label class="tgl" style="margin:-2px 0 10px"><input type="checkbox" id="c-gift"${v.gift ? " checked" : ""}> Zum Geburtstag ein Geschenk besorgen (Erinnerung ${S.settings.giftLead} Tage vorher)</label>
  <div class="fld" style="position:relative"><label for="c-addr">Adresse</label><input id="c-addr" value="${esc(v.addr || "")}" autocomplete="off" placeholder="Straße eintippen, Vorschläge erscheinen"><div id="addr-sug" class="sug" hidden></div></div>
  <div class="fld"><label for="c-note">Notiz</label><input id="c-note" placeholder="Was du dir merken willst" autocomplete="off">${p ? entryHint(p.notes, "Notiz", "Notizen") : ""}</div>
  <div class="fld" id="c-gideabox"${v.gift ? "" : " hidden"}><label for="c-gidea">Geschenkidee</label><input id="c-gidea" placeholder="z. B. Kochkurs" autocomplete="off">${p ? entryHint(p.gifts, "Idee", "Ideen") : ""}</div>
  <div class="fld"><label for="c-ask">Offene Nachfrage</label><input id="c-ask" placeholder="z. B. fragen, wie die Reha läuft" autocomplete="off">${p ? entryHint((p.ask || []).filter(x => !x.done), "Nachfrage", "Nachfragen") : ""}</div>
  ${(() => { const par = p && p.parent ? fullName(S.people.find(x => x.id === p.parent) || {}) : "", dth = L.bdayToInput(v.death || ""); return `<div class="plusrow"><button type="button" class="mini" data-act="plusshow" data-t="c-parentbox"${par ? " hidden" : ""}>+ Kind von …</button><button type="button" class="mini" data-act="plusshow" data-t="c-deathbox"${dth ? " hidden" : ""}>+ Verstorben</button></div>
  <div class="fld" id="c-parentbox"${par ? "" : " hidden"}><label for="c-parent">Kind von</label><input id="c-parent" list="c-parent-l" value="${esc(par)}" placeholder="Name des Elternteils" autocomplete="off"><datalist id="c-parent-l">${S.people.filter(x => !x.arch && !x.parent && (!p || x.id !== p.id)).map(x => `<option value="${esc(fullName(x))}">`).join("")}</datalist></div>
  <div class="fld" id="c-deathbox"${dth ? "" : " hidden"}><label for="c-death">Verstorben am</label><input id="c-death" inputmode="numeric" maxlength="10" placeholder="TT.MM.JJJJ" value="${esc(dth)}" autocomplete="off"></div>`; })()}
  <div id="dup-warn"></div>
  ${p ? "" : `<div class="fld"><label for="c-last-call">Zuletzt angerufen (wenn bekannt)</label><input id="c-last-call" type="date"></div>`}
  ${p ? `<button class="btn" data-act="${p.arch ? "unarchperson" : "archperson"}" data-id="${p.id}" style="width:100%;margin-bottom:8px">${p.arch ? "Aus dem Archiv zurückholen" : "Archivieren (nicht mehr erinnern, Verlauf bleibt)"}</button>` : ""}<div class="row2">${p ? `<button class="btn danger" data-act="delperson" data-id="${p.id}" style="flex:none">Löschen</button>` : ""}<button class="btn" data-act="cancel">Abbrechen</button><button class="btn pri" data-act="saveperson" data-id="${p ? p.id : ""}">Speichern</button></div>
  <p class="swipehint">Deine Eingaben werden laufend gemerkt. Schließt sich das Fenster, ist beim nächsten Öffnen alles wieder da.</p></div>`,
    () => {
      addrSuggest($("#c-addr"), $("#addr-sug"));
      const chk = () => { const wm = L.checkEmail($("#c-mail").value), wt = L.checkTel($("#c-cc").value, $("#c-tel").value); $("#w-mail").hidden = !wm; $("#w-mail").textContent = wm ? "⚠ " + wm : ""; $("#w-tel").hidden = !wt; $("#w-tel").textContent = wt ? "⚠ " + wt : ""; };
      ["#c-mail", "#c-tel"].forEach(q => $(q).addEventListener("blur", chk)); $("#c-cc").addEventListener("change", chk); if ($("#c-mail").value || $("#c-tel").value) chk();
      $("#c-gift").addEventListener("change", e => { $("#c-gideabox").hidden = !e.target.checked; });
      $("#c-death").addEventListener("input", e => { if (e.inputType && e.inputType.startsWith("delete")) return; const el = e.target, f = L.fmtBdayInput(el.value); if (f !== el.value) el.value = f; });
      $("#c-bday").addEventListener("input", e => { if (e.inputType && e.inputType.startsWith("delete")) return; const el = e.target, f = L.fmtBdayInput(el.value); if (f !== el.value) el.value = f; });
      $("#sheetbody [data-draft]").addEventListener("draftapplied", () => { pickSync(); $("#c-gideabox").hidden = !$("#c-gift").checked; for (const k of ["c-parent", "c-death"]) if ($("#" + k) && $("#" + k).value) { $("#" + k + "box").hidden = false; } });
    });
}
function grpChips(sel) { return S.groups.map(g => `<button type="button" class="chip2" data-act="pickgrp" data-g="${esc(g)}" aria-pressed="${g === sel}">${esc(g)}</button>`).join("") + `<button type="button" class="chip2" data-act="newgrp">+ Eigene</button>`; }
let addrTimer = null;
function addrSuggest(inp, box, places) {
  inp.addEventListener("input", () => {
    clearTimeout(addrTimer); const q = inp.value.trim(); delete inp.dataset.lat; delete inp.dataset.lon; delete inp.dataset.label;
    if (q.length < 4) { box.hidden = true; return; }
    addrTimer = setTimeout(async () => {
      try {
        const lat = S.settings.wxLat || 48.8, lon = S.settings.wxLon || 9.2;
        const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=de&limit=${places ? 7 : 5}&lat=${lat}&lon=${lon}`);
        const j = await r.json(), seen = new Set(), list = [];
        for (const f of j.features || []) { const a = places ? placeLabel(f.properties) : fmtAddr(f.properties); if (!a || seen.has(a)) continue; seen.add(a); list.push({ a, c: f.geometry && f.geometry.coordinates }); }
        if (!list.length || inp.value.trim() !== q) { box.hidden = true; return; }
        box.innerHTML = list.map(x => `<button type="button" data-addr="${esc(x.a)}"${x.c ? ` data-lat="${x.c[1]}" data-lon="${x.c[0]}"` : ""}>${esc(x.a)}</button>`).join(""); box.hidden = false;
      } catch (_) { box.hidden = true; }
    }, 350);
  });
  box.addEventListener("click", e => { const b = e.target.closest("[data-addr]"); if (!b) return; inp.value = b.dataset.addr; if (b.dataset.lat) { inp.dataset.lat = b.dataset.lat; inp.dataset.lon = b.dataset.lon; inp.dataset.label = b.dataset.addr; } box.hidden = true; });
}
/* Ort mit Namen: „Alte Wache, Marktplatz 1, 70173 Stuttgart“ */
function placeLabel(a) {
  const adr = fmtAddr(a); if (!a || !a.name || !a.street || adr.startsWith(a.name)) return adr;
  return a.name + ", " + adr;
}
function fmtAddr(a) {
  if (!a) return "";
  const street = a.street ? a.street + (a.housenumber ? " " + a.housenumber : "") : (a.name || "");
  const town = [a.postcode, a.city || a.town || a.village || a.district].filter(Boolean).join(" ");
  const out = [street, town].filter(Boolean).join(", ");
  return a.country && a.country !== "Deutschland" ? out + ", " + a.country : out;
}
const normName = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
/* Ähnliche Schreibweise: ein Buchstabe anders, vertauscht, zu viel oder zu wenig („Doga“ und „Doha“, „Mayer“ und „Maier“ erst ab vier Buchstaben) */
function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) { let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prevPrev[j - 2] + 1); cur[j] = v; if (v < best) best = v; }
    if (best > max) return max + 1;
    var prevPrev = prev; prev = cur;
  }
  return prev[b.length];
}
/* 2 = gleich, 1 = ähnlich, 0 = verschieden */
function wordSim(a, b) {
  if (a === b || a === b + "s" || b === a + "s") return 2;
  const m = Math.min(a.length, b.length); if (m < 4) return 0;
  if (a.startsWith(b) || b.startsWith(a)) return 1;
  const mx = m >= 6 ? 2 : 1; return lev(a, b, mx) <= mx ? 1 : 0;
}
/* Sucht q in einem Text: zuerst wörtlich, sonst Wort für Wort mit ähnlicher Schreibweise */
function fuzzyHas(text, q) {
  const t = normName(text), ql = normName(q); if (!ql) return false;
  if (t.includes(ql)) return true;
  const tw = t.split(" ");
  return ql.split(" ").every(w => tw.some(x => x.includes(w) || wordSim(w, x)));
}
const telKey = t => { const d = (t || "").replace(/\D/g, "").replace(/^(0049|49)/, "0"); return d.length >= 7 ? d.slice(-9) : ""; };
function findDups(d, exceptId) {
  const n1 = normName(d.first + " " + d.last), n2 = normName(d.last + " " + d.first), tk = telKey(d.tel), em = (d.email || "").trim().toLowerCase();
  return S.people.filter(p => p.id !== exceptId && (
    (n1.length > 2 && (normName(fullName(p)) === n1 || normName(fullName(p)) === n2)) ||
    (tk && (telKey(p.tel) === tk || (p.tels || []).some(x => telKey(x.n) === tk))) || (em && (p.email || "").toLowerCase() === em)));
}
/* Kontakte, die auf „Heute“ nichts zu suchen haben (die iPhone-App blendet hier ungeprüfte, übernommene Kontakte aus) */
let heuteSkip = () => false;
function mergeInto(t, src, label) {
  for (const k of ["first", "last", "tel", "email", "addr", "bday", "nick", "group", "woher", "job"]) if (!t[k] && src[k]) t[k] = src[k];
  // andere Nummern gehen nicht verloren: sie stehen als weitere Nummer am Kontakt
  for (const x of [src.tel ? { n: src.tel, l: label || "" } : null, ...(src.tels || [])]) {
    if (!x || !telKey(x.n) || telKey(x.n) === telKey(t.tel) || (t.tels || []).some(y => telKey(y.n) === telKey(x.n))) continue;
    (t.tels = t.tels || []).push({ n: x.n, l: x.l || "" });
  }
  for (const m of [src.email, ...(src.emails || [])]) { if (!m) continue; const ml = m.toLowerCase(); if (ml === (t.email || "").toLowerCase() || (t.emails || []).some(x => x.toLowerCase() === ml)) continue; (t.emails = t.emails || []).push(m); }
  // Hat der andere Eintrag einen anderen Geburtstag oder Todestag, geht der nicht verloren: er kommt als Angehöriger in die Familie
  if ((src.bday && t.bday && src.bday.slice(5) !== t.bday.slice(5)) || (src.death && src.death !== t.death && normName(src.first || "") !== normName(t.first || ""))) {
    const nm = fullName(src); if (!(t.kin || []).some(k => normName(k.name) === normName(nm))) (t.kin = t.kin || []).push({ id: uid(), name: nm, rel: "Sonstige", bday: src.bday && src.bday !== t.bday ? src.bday : "", death: src.death || "" });
  }
  for (const k of src.kin || []) if (!(t.kin || []).some(x => normName(x.name) === normName(k.name))) (t.kin = t.kin || []).push(k);
  if (noCycle(t.cyc) && src.cyc) t.cyc = src.cyc;
  t.gift = t.gift || !!src.gift;
  for (const k of ["calls", "notes", "ask", "gifts"]) t[k] = [...(t[k] || []), ...(src[k] || [])];
  if (src.id) S.todos.forEach(x => { if (x.pid === src.id) x.pid = t.id; });
}
function readPersonForm() {
  const bd = L.parseBday($("#c-bday").value), dd = L.parseBday($("#c-death").value);
  return { death: dd || "", deathBad: dd === null, first: $("#c-first").value.trim(), last: $("#c-last").value.trim(), tel: L.joinTel($("#c-cc").value, $("#c-tel").value), email: $("#c-mail").value.trim(), cyc: $("#c-cyc").value, lunch: $("#c-lunch") ? $("#c-lunch").value : "", group: $("#c-grp").value.trim(), job: $("#c-job") ? $("#c-job").value.trim() : "", bday: bd || "", bdayBad: bd === null, gift: $("#c-gift").checked, addr: $("#c-addr").value.trim(), nick: $("#c-nick").value.trim(), telL: $("#c-tell") ? $("#c-tell").value : "", tels: $("#c-tels") ? $$("#c-tels .xrow").map(r => ({ n: r.querySelector(".telx-n").value.trim(), l: r.querySelector(".telx-l").value })).filter(x => x.n) : null, emails: $("#c-mails") ? [...new Set($$("#c-mails .mailx").map(i => i.value.trim()).filter(Boolean))] : null, newNote: $("#c-note") ? $("#c-note").value.trim() : "", newGift: $("#c-gidea") ? $("#c-gidea").value.trim() : "", newAsk: $("#c-ask") ? $("#c-ask").value.trim() : "", woher: $("#c-woher") ? $("#c-woher").value.trim() : "", parentName: $("#c-parent") ? $("#c-parent").value.trim() : null };
}
function savePerson(id) {
  const data = readPersonForm(), first = data.first, last = data.last;
  if (!first && !last) { toast("Bitte einen Namen eintragen"); return; }
  if (data.bdayBad) { toast("Geburtstag bitte als TT.MM.JJJJ, z. B. 07041964"); return; }
  if (data.deathBad) { toast("Todestag bitte als TT.MM.JJJJ, z. B. 14022019"); return; }
  delete data.bdayBad; delete data.deathBad;
  if (data.death) { data.cyc = "nie"; data.gift = false; }
  const warn = [L.checkEmail(data.email), L.checkTel($("#c-cc").value, $("#c-tel").value)].filter(Boolean);
  if (warn.length && !savePerson.force && !ask(warn.join("\n") + "\n\nTrotzdem so speichern?")) return;
  if (data.group && !S.groups.includes(data.group)) S.groups.push(data.group);
  pickRemember("woher", data.woher); pickRemember("job", data.job);
  const dups = findDups(data, id);
  if (dups.length && !savePerson.force) {
    $("#dup-warn").innerHTML = `<div class="hint" style="border:1px solid var(--late)"><b>Gibt es schon?</b> ${dups.map(d => esc(fullName(d)) + (d.tel ? " · " + esc(d.tel) : "")).join(", ")}<div class="row2" style="margin-top:8px;flex-wrap:wrap"><button class="btn" data-act="dupmerge" data-id="${dups[0].id}" data-self="${id || ""}">Zusammenführen</button><button class="btn" data-act="dupforce" data-id="${id || ""}">Trotzdem speichern</button></div></div>`;
    $("#dup-warn").scrollIntoView({ block: "center" }); return;
  }
  savePerson.force = false;
  { // Nummern und E-Mails: jede Zeile im Formular zählt. Ist die erste Nummer leer, rückt die nächste nach.
    if (data.tels === null) delete data.tels; else { if (!data.tel && data.tels.length) { const f = data.tels.shift(); data.tel = f.n; data.telL = f.l; } data.tels = data.tels.filter((x, k, a) => telKey(x.n) !== telKey(data.tel) && a.findIndex(y => telKey(y.n) === telKey(x.n)) === k); }
    if (data.emails === null) delete data.emails; else { if (!data.email && data.emails.length) data.email = data.emails.shift(); data.emails = data.emails.filter(m => m.toLowerCase() !== (data.email || "").toLowerCase()); }
  }
  const extra = { n: data.newNote, g: data.newGift, a: data.newAsk }; delete data.newNote; delete data.newGift; delete data.newAsk;
  { // Kind von: Verweis auf das Elternteil (das Kind steht dann nur in Mirella, nicht im Telefonbuch)
    const pn = data.parentName; delete data.parentName;
    if (pn !== null) {
      if (!pn) data.parent = "";
      else { const par = S.people.find(x => x.id !== id && normName(fullName(x)) === normName(pn)); if (!par) { toast("„" + pn + "“ steht nicht in Mirella. Bitte das Elternteil aus der Liste wählen."); return; } data.parent = par.id; if (!data.tel) data.local = true; }
    }
  }
  savePerson.last = data;
  const addExtra = t => { if (extra.n) (t.notes = t.notes || []).unshift({ id: uid(), t: extra.n, d: today() }); if (extra.g) { if (data.gift) (t.gifts = t.gifts || []).push({ id: uid(), t: extra.g, d: today() }); else (t.notes = t.notes || []).unshift({ id: uid(), t: "Geschenkidee: " + extra.g, d: today() }); } if (extra.a) (t.ask = t.ask || []).push({ id: uid(), t: extra.a, d: today() }); };
  if (id) { const t = S.people.find(x => x.id === id); Object.assign(t, data); addExtra(t); }
  else {
    const p = Object.assign({ id: uid(), created: today(), calls: [], notes: [], ask: [], gifts: [] }, data);
    const lc = $("#c-last-call") && $("#c-last-call").value; if (lc) p.calls.push({ id: uid(), d: lc, ok: true });
    addExtra(p);
    S.people.push(p); cur = p.id; view = "akte";
  }
  draftClear(); save(); closeSheet(); render(); toast("Gespeichert: " + [first, last].join(" ").trim());
}
function callMenu(p) {
  const tel = p.tel ? intlTel(p.tel) : "";
  openSheet(`<p class="stitle">${esc(fullName(p))}</p><p class="swipehint" style="text-align:left;margin:0 0 10px">${esc(cycLabel(p.cyc))} · zuletzt ${esc(agoText(lastCall(p)))}</p>
  <div style="display:grid;gap:8px">${tel ? `<a class="btn pri" href="tel:${esc(tel)}" data-act="dial" data-id="${p.id}" style="text-decoration:none;text-align:center">📞 ${esc(p.tel)} anrufen</a>` : `<button class="btn" data-act="call" data-id="${p.id}">Telefonnummer eintragen</button>`}
  <button class="btn" data-act="callok" data-id="${p.id}">✓ Erledigt, erreicht</button><button class="btn" data-act="callno" data-id="${p.id}">Probiert, nicht erreicht</button><button class="btn" data-act="snooze" data-id="${p.id}">Später anrufen</button><button class="btn" data-act="person" data-id="${p.id}">Zum Kontaktprofil</button></div>`);
}
let pendingCall = null, avFor = null;
/* Profilbild: quadratisch zuschneiden, verkleinern, ablegen (gleicht mit dem Server ab) */
async function setAvatar(file) {
  const p = S.people.find(x => x.id === avFor); if (!p || !file) return;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => createImageBitmap(file));
    const side = Math.min(bmp.width, bmp.height), N = Math.min(480, side), c = document.createElement("canvas"); c.width = c.height = N;
    c.getContext("2d").drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, N, N);
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.86)), id = "av_" + uid(), old = p.pic;
    await photoPut(id, blob); p.pic = id; save(); if (old) photoDel(old).catch(() => { });
    render(true); toast("Profilbild gespeichert");
  } catch (_) { toast("Bild konnte nicht gelesen werden"); }
}
document.addEventListener("change", e => { if (e.target.id === "f-avatar" && e.target.files[0]) setAvatar(e.target.files[0]); });
function callResult(p, autoDial) {
  openSheet(`<p class="stitle">Anruf mit ${esc(fullName(p))}</p><p class="swipehint" style="text-align:left;margin:0 0 10px">Wie ist es gelaufen?</p>
  <div style="display:grid;gap:8px"><button class="btn pri" data-act="callok" data-id="${p.id}">Erreicht</button><button class="btn" data-act="callno" data-id="${p.id}">Nicht erreicht (neuer Versuch ${relDate(addCallDays(today(), +S.settings.retryWorkdays || 2))})</button><button class="btn" data-act="snooze" data-id="${p.id}">Später</button><button class="btn" data-close="sheet" style="background:none;border:0">Abbrechen</button></div>`);
  if (autoDial && p.tel) location.href = "tel:" + intlTel(p.tel);
}
function snoozeForm(p) {
  const opts = [["morgen", addDays(today(), 1)], ["in 3 Tagen", addDays(today(), 3)], ["in 1 Woche", addDays(today(), 7)], ["in 3 Wochen", addDays(today(), 21)], ["in 2 Monaten", addMonths(today(), 2)]];
  openSheet(`<p class="stitle">${esc(fullName(p))} später anrufen</p><div style="display:grid;gap:8px">${opts.map(([l, d]) => `<button class="btn" data-act="dosnooze" data-id="${p.id}" data-d="${d}">${l} <small style="font-weight:400;color:var(--ink-3)">· ${fmtDate(d)}</small></button>`).join("")}<button class="btn" data-close="sheet" style="background:none;border:0">Abbrechen</button></div>`);
}
function expenseForm(pre = {}) {
  openSheet(`<div data-draft="exp:new"><p class="stitle">Neue Ausgabe</p>
  <div class="fgrid"><div class="fld"><label for="e-amt">Betrag in €</label><input id="e-amt" inputmode="decimal" value="${esc(pre.amount || "")}" placeholder="0,00"></div><div class="fld"><label for="e-date">Datum</label><input id="e-date" type="date" value="${today()}"></div></div>
  <div class="fld"><label for="e-shop">Wo / wofür</label><input id="e-shop" value="${esc(pre.shop || "")}" placeholder="z. B. REWE"></div>
  <div class="fld"><label for="e-cat">Kategorie</label><select id="e-cat">${catList().map(c => `<option${c === (pre.cat || "Lebensmittel & Supermarkt") ? " selected" : ""}>${c}</option>`).join("")}</select></div>
  <div class="row2"><button class="btn" data-act="cancel">Abbrechen</button><button class="btn pri" data-act="saveexp">Speichern</button></div></div>`);
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
  if (k === "dokument") f = `<div class="fld"><label for="d-name">Name</label><input id="d-name" placeholder="z. B. Reisepass"></div><div class="fgrid"><div class="fld"><label for="d-folder">Ordner</label><select id="d-folder">${folderOpts("")}</select></div><div class="fld"><label for="d-until">Gültig bis (freiwillig)</label><input id="d-until" type="date"></div></div>`;
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
const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
/* Nach dem Diktieren das Mikrofon wieder freigeben, damit Musik oder ein Hörbuch von selbst weiterläuft */
function audioFree() {
  clearTimeout(audioFree.t);
  audioFree.t = setTimeout(() => { if (recOn || rec) return; const SY = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.MirellaSystem; if (SY && SY.audioRelease) SY.audioRelease().catch(() => { }); }, 1500);
}
/* In der echten iPhone-App gibt es kein Web-Speech: dort übernimmt Apples Spracherkennung (Capacitor-Plugin) */
class NativeSR {
  constructor() { this.P = window.Capacitor.Plugins.SpeechRecognition; this.lang = "de-DE"; this.subs = []; }
  async start() {
    try {
      const perm = await this.P.requestPermissions();
      if (perm && perm.speechRecognition && perm.speechRecognition !== "granted") { this.onerror && this.onerror({ error: "not-allowed" }); this.onend && this.onend(); return; }
      this.subs.push(await this.P.addListener("partialResults", d => { const t = (d.matches || [])[0] || ""; this.onresult && this.onresult({ results: [Object.assign([{ transcript: t }], { isFinal: false })] }); }));
      this.subs.push(await this.P.addListener("listeningState", d => { if (d.status === "stopped") this._end(); }));
      await this.P.start({ language: this.lang, partialResults: true, popup: false, maxResults: 1 });
    } catch (e) { this.onerror && this.onerror({ error: String(e && e.message || e) }); this._end(); }
  }
  _end() { this.subs.forEach(s => s.remove && s.remove()); this.subs = []; this.onend && this.onend(); audioFree(); }
  stop() { this.P.stop().catch(() => { }); }
  abort() { this.P.stop().catch(() => { }); this.subs.forEach(s => s.remove && s.remove()); this.subs = []; audioFree(); }
}
const SR = NATIVE && window.Capacitor.Plugins && window.Capacitor.Plugins.SpeechRecognition ? NativeSR : (window.SpeechRecognition || window.webkitSpeechRecognition);
let rec = null, recOn = false, finalText = "";
function voiceStart() {
  vMore = null;
  finalText = "";
  openSheet(`<p class="stitle">Sag es Mirella</p>
  <div class="vstate"><span class="vdot" id="v-dot"></span><span id="v-state">${SR ? "Ich höre zu …" : "Tippe ins Feld und nutze das Mikrofon auf der Tastatur."}</span></div>
  <div class="fld"><textarea id="v-text" placeholder="z. B. Erinnere mich morgen um 9 an die Steuer. Butter und Eier auf die Einkaufsliste. Hab mit Tim telefoniert, er fliegt Freitag nach China."></textarea></div>
  <div class="row2" style="margin-top:4px">${SR ? `<button class="btn" data-act="vagain" style="flex:none" aria-label="Nochmal sprechen">🎙 Nochmal</button>` : ""}<button class="btn" data-close="sheet">Abbrechen</button><button class="btn pri" data-act="vnext">Weiter</button></div>
  ${view === "heute" ? `<button class="btn" data-act="vplus" style="width:100%;margin-top:8px">+ Lieber von Hand anlegen</button>` : ""}
  <p class="swipehint" style="margin-top:12px">Sprich in ganzen Sätzen. Danach zeige ich dir, was ich verstanden habe, und du kannst alles ändern.</p>`,
    () => { if (SR) recStart(); else $("#v-text").focus(); });
  sheetCleanup = recStop;
}
function recStart() {
  recStop(); recStart.n = 0;
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
      if (e.error === "not-allowed" || e.error === "service-not-allowed") st.textContent = (NATIVE ? "Mikrofon ist nicht erlaubt. iPhone: Einstellungen › Apps › Mirella › Mikrofon und Spracherkennung einschalten." : "Mikrofon ist nicht erlaubt. iPhone: Einstellungen › Apps › Safari › Mikrofon › Erlauben.") + " Solange kannst du tippen oder das Tastatur-Mikrofon nutzen.";
      else if (e.error === "no-speech") st.textContent = "Ich habe nichts gehört. Tippe auf „Nochmal“.";
      else st.textContent = "Spracheingabe gerade nicht möglich (" + e.error + "). Tippe oder nutze das Tastatur-Mikrofon.";
    };
    let failed = false; const prevErr = rec.onerror; rec.onerror = e => { failed = true; prevErr(e); };
    rec.onend = () => {
      // Länger am Stück zuhören: Macht das iPhone nach einer Pause Schluss und es kam neuer Text dazu, hört Mirella gleich weiter zu (höchstens 8 Mal).
      const ta0 = $("#v-text");
      if (NATIVE && !failed && ta0 && ta0.value.trim() !== base.trim() && recStart.n < 8) { recStart.n++; rec = null; recOn = false; setTimeout(() => { if ($("#v-text") && !recOn) { const n = recStart.n; recStart(); recStart.n = n; } }, 200); return; }
      recOn = false; const d = $("#v-dot"), st = $("#v-state"), m = $("#mic"); d && d.classList.remove("on"); m.classList.remove("rec"); if (st && st.textContent.startsWith("Ich höre")) st.textContent = "Fertig zugehört. Prüfen und auf „Weiter“ tippen."; };
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
/* Weiterreden nach „Das habe ich verstanden“: „mach die Uhrzeit auf 18 Uhr“ ändert den letzten Eintrag, alles andere kommt dazu */
let vMore = null;
function amendLocal(items, corr) {
  const w = parseWhen(corr); let mt;
  if (!w.time) { // „auf 18 Uhr“, „lieber 19:30“, „halb sieben“ – ohne „um“
    const NUM = { eins: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12 };
    if ((mt = w.rest.match(/\bhalb (\d{1,2}|[a-zäöüß]+)\b/i)) && (+mt[1] || NUM[mt[1].toLowerCase()])) { let h = (+mt[1] || NUM[mt[1].toLowerCase()]) - 1; if (h < 7) h += 12; w.time = pad(h) + ":30"; w.rest = w.rest.replace(mt[0], " "); }
    else if ((mt = w.rest.match(/\b(\d{1,2})[:.](\d{2})(\s*uhr)?\b/i) || w.rest.match(/\b(\d{1,2})()\s*uhr(?:\s*(\d{1,2}))?\b/i)) && +mt[1] <= 23) { const mi = +(mt[2] || (/^\d+$/.test(mt[3] || "") ? mt[3] : 0)); if (mi < 60) { w.time = pad(+mt[1]) + ":" + pad(mi); w.rest = w.rest.replace(mt[0], " "); } }
  }
  const last = [...items].reverse().find(x => x.type === "todo"), words = w.rest.replace(/\b(mach|mache|bitte|doch|die|den|das|uhrzeit|zeit|datum|auf|statt|lieber|nicht|sondern|ändere|aender|verschieb|verschiebe|es|ihn|sie|und|hey|ey|eher|termin|aufgabe)\b/gi, " ").trim();
  if (last && (w.date || w.time) && words.split(/\s+/).filter(Boolean).length <= 2) {
    const dateSaid = /heute|morgen|übermorgen|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|woche|tag|monat|\d\.|nachher|später|gleich|stunde|minute/i.test(corr);
    if (w.time) last.time = w.time; if (w.date && (dateSaid || !last.date)) last.date = w.date; return items;
  }
  const add = understand(corr); return items.concat(add.length ? add : [{ type: "todo", t: cap(corr), date: "", time: "", trig: "" }]);
}
function voiceReview() {
  recStop();
  const txt = ($("#v-text").value || "").trim();
  if (!txt) { toast("Noch nichts gesagt oder getippt"); return; }
  if (/^(ich bin|bin) (heute |jetzt |leider )*(krank|erkältet|krankgeschrieben)\b/i.test(txt)) { voiceReview.lastTxt = txt; return sickForm(); }
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
    ${it.type === "todo" ? `<div class="pg"><input type="date" data-pf="date" value="${esc(it.date || "")}" aria-label="Datum"><input type="time" data-pf="time" value="${esc(it.time || "")}" aria-label="Uhrzeit"></div>${it.trig === "verlassen" ? '<div class="swipehint" style="text-align:left;margin:0">bevor du losgehst</div>' : ""}${it.ort ? `<div class="swipehint" style="text-align:left;margin:0">📍 ${esc(it.ort)} (Adresse sucht Mirella beim Speichern)</div>` : ""}` : ""}
    ${it.type === "expense" ? `<div class="pg"><input data-pf="amount" inputmode="decimal" value="${it.amount != null ? String(it.amount).replace(".", ",") : ""}" placeholder="Betrag €" aria-label="Betrag"><select data-pf="cat" style="background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:8px;font:inherit;font-size:14px;margin-bottom:6px">${catList().map(c => `<option${c === it.cat ? " selected" : ""}>${c}</option>`).join("")}</select></div>` : ""}
  </div>`).join("") || empty("Alles weggelassen.")}</div>
  <button class="btn" data-act="vmore" style="width:100%;margin-bottom:8px">🎙 Weiterreden: ändern oder ergänzen</button>
  <div class="row2"><button class="btn" data-act="vback" style="flex:none">‹ Zurück</button><button class="btn" data-close="sheet">Abbrechen</button><button class="btn pri" data-act="vsave"${pending.length ? "" : " disabled"}>Speichern</button></div>`);
  sheetCleanup = null;
  $("#pitems").addEventListener("change", e => { const el = e.target, box = el.closest(".pitem"); if (!box) return; const it = pending[+box.dataset.i]; readPItem(box, it); if (el.dataset.pf === "type") { it.type = el.value; reviewRender(txt); } });
  $("#pitems").addEventListener("input", e => { const box = e.target.closest(".pitem"); if (box) readPItem(box, pending[+box.dataset.i]); });
  voiceReview.lastTxt = txt;
}
function readPItem(box, it) {
  box.querySelectorAll("[data-pf]").forEach(el => { const k = el.dataset.pf; if (k === "type") return; if (k === "ok") it.ok = el.value === "1"; else if (k === "amount") it.amount = parseAmount(el.value); else it[k] = el.value; });
}
function voiceSave() {
  $$("#pitems .pitem").forEach(b => readPItem(b, pending[+b.dataset.i]));
  let n = 0; const miss = [];
  for (const it of pending) {
    if (it.type === "shop" && it.t) { if (addShop(it.t)) n++; }
    else if (it.type === "todo" && it.t) { S.todos.push({ id: uid(), t: it.t, pid: it.pid || "", list: "todo", done: false, created: today(), date: it.trig === "verlassen" ? "" : it.date || "", time: it.time || "", trig: it.trig || "zeit", rep: "nie", area: "", nerv: true, ort: it.ort || "" }); if (it.ort) { const nt = S.todos[S.todos.length - 1]; placeFind(it.ort).then(full => { if (full) { nt.ort = full; save(); render(true); } }); } n++; }
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
/* Krank-Modus: Anrufe pausieren, an Arbeitgeber und Arzt denken */
function sickForm() {
  openSheet(`<p class="stitle">Gute Besserung! Wie lange ungefähr?</p><p class="hint" style="margin-top:0">Mirella schiebt deine Anrufe so lange nach hinten und legt dir die wichtigen Schritte als Aufgaben an.</p><div style="display:grid;gap:8px">${[[1, "Heute"], [3, "Ein paar Tage (3 Werktage)"], [5, "Eine Woche"], [10, "Zwei Wochen"]].map(([n, l]) => `<button class="btn" data-act="dosick" data-n="${n}">${l} <small style="font-weight:400;color:var(--ink-3)">· bis ${fmtDate(addWorkdays(today(), n - 1))}</small></button>`).join("")}<button class="btn" data-close="sheet" style="background:none;border:0">Abbrechen</button></div>`);
}
function sickStart(n) {
  const t = today(), to = addWorkdays(t, Math.max(0, n - 1)), back = addWorkdays(to, 1);
  let moved = 0;
  S.people.forEach(p => { const d = nextDue(p); if (d && d <= to) { p.snooze = back; p.sickSnooze = back; moved++; } });
  const add = (txt, prio) => { if (!S.todos.some(x => x.list === "todo" && !x.done && x.t === txt)) S.todos.push({ id: uid(), t: txt, list: "todo", done: false, created: t, date: t, area: "gesund", prio: prio || 2 }); };
  const wd = new Date().getDay(); if (wd > 0 && wd < 6) add("Arbeitgeber Bescheid geben, dass ich krank bin", 1);
  add(n >= 3 ? "Arzttermin ausmachen (Krankschreibung ab dem 4. Tag nötig)" : "Arzt anrufen, falls es nicht besser wird");
  S.sick = { from: t, to };
  save(); closeSheet(); render(); toast(`Gute Besserung! ${moved ? moved + (moved === 1 ? " Anruf" : " Anrufe") + " verschoben auf " + fmtDate(back) : "Keine Anrufe in der Zeit"}`);
}
function sickEnd() {
  S.people.forEach(p => { if (p.sickSnooze) { if (p.snooze === p.sickSnooze) p.snooze = null; delete p.sickSnooze; } });
  S.sick = null; save(); render(); toast("Schön, dass es dir besser geht. Anrufe laufen wieder normal");
}
function logCall(p, ok, silent) {
  p.calls = p.calls || []; p.calls.push({ id: uid(), d: today(), ok });
  p.snooze = ok ? null : addCallDays(today(), +S.settings.retryWorkdays || 2);
  if (ok) p.streakBase = 0;
  if (!silent) { save(); closeSheet(); render(true); toast(ok ? `${p.first || fullName(p)} erreicht. Nächster Anruf ${relDate(nextDue(p) || today())}` : gaveUp(p) ? `${failStreak(p)}-mal nicht erreicht: Mirella hört bei ${p.first || fullName(p)} auf zu nerven` : `Neuer Versuch ${relDate(p.snooze)}`); }
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
  const json = JSON.stringify({ app: "Mirella", version: VERSION, exported: new Date().toISOString(), data: noKeys(S), photos });
  const name = `Mirella-Sicherung_${today()}.json`, file = new File([json], name, { type: "application/json" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === "AbortError") return; } }
  const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
/* Für Sicherungen: Kopie der Daten ohne Schlüssel (Google Maps). Schlüssel gehören nur auf das Gerät. */
function noKeys(d) { const c = JSON.parse(JSON.stringify(d)); if (c.settings) delete c.settings.gmapsKey; return c; }
async function importData(file) {
  try {
    const j = JSON.parse(await file.text()); if (!j || !j.data || !Array.isArray(j.data.people)) throw new Error();
    if (!confirm(`Sicherung vom ${new Date(j.exported).toLocaleString("de-DE")} laden? Die Daten auf diesem Gerät werden ersetzt.`)) return;
    await photoClear(); for (const [k, u] of Object.entries(j.photos || {})) await photoPut(k, await dataURLToBlob(u));
    const gk = S.settings.gmapsKey || (j.data.settings || {}).gmapsKey || "";
    S = Object.assign(blank(), j.data); S.settings = Object.assign(blank().settings, j.data.settings || {}, { gmapsKey: gk });
    save(); view = "heute"; render(); toast("Sicherung geladen");
  } catch (_) { toast("Das ist keine gültige Mirella-Sicherung"); }
}

/* ---------- Klicks ---------- */
const ACT = {
  ics: el => icsOpen(S.todos.find(x => x.id === el.dataset.id)),
  openbrief: (el, e) => { if (e.target.closest('[data-act="delbrief"]')) return; openBrief(el.dataset.id); },
  delbrief: async (el, e) => { e.stopPropagation(); if (!ask("Briefing löschen?")) return; await photoDel(el.dataset.id); S.briefings = S.briefings.filter(b => b.id !== el.dataset.id); save(); render(true); },
  addbrief: () => { const f = $("#f-brief"); f.value = ""; f.click(); },
  wxhere: async () => { toast("Standort wird bestimmt …"); const g = await geoOnce(); if (g.err) { openSheet(`<p class="stitle">Standort nicht freigegeben</p><p class="hint">${esc(g.err === "denied" ? GEO_HELP : "Standort konnte gerade nicht bestimmt werden. Bitte nochmal versuchen oder einen Ort eintippen.")}</p><div class="row2"><button class="btn" data-close="sheet">OK</button></div>`); return; } WX = null; render(true); loadWeather(true); toast("Standort gespeichert, Mirella fragt nicht mehr nach"); },
  dupforce: el => { savePerson.force = true; savePerson(el.dataset.id); },
  dupmerge: el => {
    const t = S.people.find(x => x.id === el.dataset.id), selfId = el.dataset.self;
    const data = readPersonForm(); delete data.bdayBad; delete data.deathBad;
    if (selfId) { const me = S.people.find(x => x.id === selfId); Object.assign(me, data); mergeInto(t, me); dropPerson(me); } else mergeInto(t, data);
    draftClear(); save(); closeSheet(); cur = t.id; view = "akte"; render(); toast("Zusammengeführt: " + fullName(t));
  },
  dupscan: () => {
    const pairs = [], seen = new Set();
    for (const p of S.people) { if (seen.has(p.id)) continue; for (const d of findDups(p, p.id)) { if (seen.has(d.id)) continue; pairs.push([p, d]); } seen.add(p.id); }
    openSheet(`<p class="stitle">Doppelte Kontakte</p>${pairs.length ? pairs.map(([a, b]) => `<div class="pitem"><div><b>${esc(fullName(a))}</b>${a.tel ? " · " + esc(a.tel) : ""}</div><div><b>${esc(fullName(b))}</b>${b.tel ? " · " + esc(b.tel) : ""}</div><div class="row2" style="margin-top:8px"><button class="btn pri" data-act="dodupmerge" data-a="${a.id}" data-b="${b.id}">Zusammenführen</button></div></div>`).join("") : empty("Keine doppelten Kontakte gefunden.")}<div class="row2"><button class="btn" data-close="sheet">Schließen</button></div>`);
  },
  dodupmerge: el => { const a = S.people.find(x => x.id === el.dataset.a), b = S.people.find(x => x.id === el.dataset.b); if (!a || !b || !ask(`${fullName(b)} in ${fullName(a)} zusammenführen? Der zweite Eintrag wird dabei gelöscht.`)) return; mergeInto(a, b); dropPerson(b); save(); toast("Zusammengeführt: " + fullName(a)); ACT.dupscan(); },
  go: el => { closeAll(); setFrom = null; if (shopMode) { shopMode = false; wakeLock(false); } view = el.dataset.v; if (view === "einstellungen") setSec = el.dataset.k || ""; render(); },
  drawer: () => openDrawer(),
  photo: el => photoStart(el.dataset.kind, el.dataset.area || (view === "bereich" ? area : null)),
  pickcam: () => { const f = $("#f-cam"); f.value = ""; f.click(); },
  picklib: () => { const f = $("#f-lib"); f.value = ""; f.click(); },
  photokind: el => { photoCtx.kind = el.dataset.k; photoForm(); },
  photosave: () => photoSave(),
  viewphoto: el => viewPhoto(el.dataset.id),
  person: el => { closeAll(); cur = el.dataset.id; view = "akte"; render(); },
  area: el => { area = el.dataset.id; closeDrawer(); view = "bereich"; render(); },
  call: (el, e) => { e.stopPropagation(); const p = S.people.find(x => x.id === el.dataset.id); if (!p) return; if (!p.tel) { personForm(p); toast("Erst eine Telefonnummer eintragen"); return; } callResult(p, true); },
  logcall: el => callResult(S.people.find(x => x.id === el.dataset.id), false),
  callok: el => logCall(S.people.find(x => x.id === el.dataset.id), true),
  dial: () => { },
  avpick: el => { const p = S.people.find(x => x.id === el.dataset.id); if (!p) return; avFor = p.id;
    if (!p.pic) { const f = $("#f-avatar"); f.value = ""; f.click(); return; }
    openSheet(`<p class="stitle">Profilbild</p><div style="display:grid;gap:8px"><button class="btn pri" data-act="avnew">Neues Bild wählen</button><button class="btn danger" data-act="avdel">Bild entfernen</button><button class="btn" data-close="sheet">Abbrechen</button></div>`); },
  avnew: () => { closeSheet(); const f = $("#f-avatar"); f.value = ""; f.click(); },
  avdel: () => { const p = S.people.find(x => x.id === avFor); if (!p || !ask("Profilbild wirklich entfernen?")) return; const old = p.pic; delete p.pic; save(); photoDel(old).catch(() => { }); closeSheet(); render(true); toast("Profilbild entfernt"); },
  // Telefon-Symbol: sofort wählen (iPhone zeigt die Nummer mit „Anrufen“), danach fragt Mirella, wie es lief
  dialnow: el => { const p = S.people.find(x => x.id === el.dataset.id); if (!p || !p.tel) return; pendingCall = p.id; location.href = "tel:" + intlTel(p.tel); },
  pcbackup: () => { if (view !== "einstellungen" || setSec !== "sicherung") { setFrom = view === "einstellungen" ? null : { v: view, area, cur, t: "Zurück", y: $("#screen").scrollTop }; view = "einstellungen"; setSec = "sicherung"; closeAll(); render(); } window.pcBackup && window.pcBackup(); },
  roundack: (el, e) => { e.stopPropagation(); const p = S.people.find(x => x.id === el.dataset.id); if (!p) return; p.roundAck = el.dataset.d; save(); render(true); toast("Gemerkt. Am Geburtstag erinnere ich dich wie gewohnt."); },
  callmenu: el => callMenu(S.people.find(x => x.id === el.dataset.id)),
  pullcalls: () => { const t = today(), pool = pullPool().slice(0, +S.settings.maxCalls || 3); S.pull = S.pull && S.pull.d === t ? S.pull : { d: t, ids: [] }; pool.forEach(p => { if (!S.pull.ids.includes(p.id)) S.pull.ids.push(p.id); }); save(); render(true); toast(pool.length + " weitere Anrufe für heute"); },
  callno: el => logCall(S.people.find(x => x.id === el.dataset.id), false),
  snooze: el => snoozeForm(S.people.find(x => x.id === el.dataset.id)),
  dosnooze: el => { const p = S.people.find(x => x.id === el.dataset.id); p.snooze = el.dataset.d; save(); closeSheet(); render(true); toast(`${fullName(p)}: ${relDate(p.snooze)} wieder dran`); },
  delcall: el => { if (!ask("Diesen Anruf aus dem Verlauf löschen?")) return; const p = S.people.find(x => x.id === cur); p.calls = p.calls.filter(c => c.id !== el.dataset.id); save(); render(true); },
  akteopen: el => { akteOpen[el.dataset.k] = !akteOpen[el.dataset.k]; render(true); },
  allcalls: el => { showAllCalls = !showAllCalls; allCallsFor = el.dataset.id; render(true); },
  grpf: el => { grpFilter = el.dataset.g; render(true); },
  setday: el => { const k = el.dataset.k, d = +el.dataset.d, cur = (k === "callDays" ? callDays() : msgDays()).slice(); const i = cur.indexOf(d); if (i >= 0) { if (cur.length === 1) { toast("Mindestens ein Tag muss bleiben"); return; } cur.splice(i, 1); } else cur.push(d); S.settings[k] = cur.sort(); save(); render(true); },
  setage: el => { const a = +el.dataset.a, cur = (S.settings.roundAges || []).slice(); const i = cur.indexOf(a); if (i >= 0) cur.splice(i, 1); else cur.push(a); S.settings.roundAges = cur.sort((x, y) => x - y); save(); render(true); },
  shophist: () => { showShopHist = showShopHist ? 0 : 1; render(true); },
  shophistall: () => { showShopHist = 2; render(true); },
  shopagain: el => { const t = S.todos.find(x => x.id === el.dataset.id); if (!t) return; if (!(t.qty ? addShop(t.t, t.qty, t.unit) : addShop(t.t))) { toast("Schon auf der Liste: " + t.t); return; } save(); render(true); toast(t.t + " wieder auf der Liste"); },
  showarch: () => { showArch = !showArch; render(true); },
  giveon: el => { const p = S.people.find(x => x.id === el.dataset.id); p.streakBase = failStreak(p); p.snooze = null; save(); render(true); toast(`${fullName(p)}: Mirella versucht es weiter im Rhythmus`); },
  archperson: el => { const p = S.people.find(x => x.id === el.dataset.id); if (!p || !ask(`${fullName(p)} archivieren? Mirella erinnert dann nicht mehr an Anrufe und Geburtstage. Notizen und Verlauf bleiben, du kannst jederzeit zurückholen.`)) return; p.arch = today(); draftClear(); save(); closeSheet(); if (view === "akte") view = "menschen"; render(true); toast("Archiviert: " + fullName(p)); },
  unarchperson: el => { const p = S.people.find(x => x.id === el.dataset.id); if (!p) return; delete p.arch; p.streakBase = failStreak(p); save(); closeSheet(); render(true); toast("Zurückgeholt: " + fullName(p)); },
  krank: () => sickForm(),
  dosick: el => sickStart(+el.dataset.n),
  wellagain: () => sickEnd(),
  pickgrp: el => { $("#c-grp").value = el.dataset.g; $$("#c-grps [data-act=pickgrp]").forEach(b => b.setAttribute("aria-pressed", b === el)); draftSave(); },
  newgrp: () => { const g = (prompt("Name der neuen Gruppe, z. B. Paddeln") || "").trim(); if (!g) return; if (!S.groups.includes(g)) S.groups.push(g); save(); $("#c-grp").value = g; $("#c-grps").innerHTML = grpChips(g); draftSave(); },
  delgroup: el => { const g = el.dataset.g, n = S.people.filter(p => p.group === g).length; if (!ask(`Gruppe „${g}“ entfernen?${n ? ` ${n} Kontakt${n > 1 ? "e verlieren" : " verliert"} die Gruppe.` : ""}`)) return; S.groups = S.groups.filter(x => x !== g); S.people.forEach(p => { if (p.group === g) p.group = ""; }); save(); render(true); },
  pickprio: el => { $("#a-prio").value = el.dataset.p; $$("#a-prio-pick button").forEach(b => b.setAttribute("aria-pressed", b === el)); draftSave(); },
  qty: el => { const t = S.todos.find(x => x.id === el.dataset.id); if (!t) return; const n = (+t.qty || (t.unit ? 0 : 1)) + (+el.dataset.n) * (["g", "ml"].includes(t.unit) ? 100 : 1); t.qty = n > 0 ? n : null; if (!t.qty && ["g", "ml", "kg", "l"].includes(t.unit)) t.unit = ""; save(); render(true); },
  saveshop: el => { const t = S.todos.find(x => x.id === el.dataset.id); if (!t) return; const w = $("#s-what").value.trim(); if (!w) { toast("Bitte eintragen, was"); return; } t.t = w; t.qty = parseAmount($("#s-qty").value) || null; t.unit = $("#s-unit").value; if (t.unit) { S.shopUnits = S.shopUnits || {}; S.shopUnits[w.toLowerCase()] = { qty: 1, unit: t.unit }; } draftClear(); save(); closeSheet(); render(true); },
  shopadd: el => { addShop(el.dataset.t); save(); render(true); toast("Drauf: " + el.dataset.t); },
  savetpl: () => { const items = S.todos.filter(x => x.list === "einkauf" && !x.done).map(x => ({ t: x.t, qty: x.qty || null, unit: x.unit || "" })); if (!items.length) return; const n = (prompt("Name der Vorlage, z. B. Wocheneinkauf") || "").trim(); if (!n) return; const ex = S.shopTpl.find(t => t.n.toLowerCase() === n.toLowerCase()); if (ex) { if (!ask(`Vorlage „${ex.n}“ gibt es schon. Ersetzen?`)) return; ex.items = items; } else S.shopTpl.push({ id: uid(), n, items }); save(); render(true); toast("Vorlage gespeichert: " + n); },
  usetpl: el => { const t = S.shopTpl.find(x => x.id === el.dataset.id); if (!t) return; let n = 0; t.items.forEach(i => { if (addShop(i.t, i.qty, i.unit)) n++; }); save(); render(true); toast(n ? `${n} Artikel aus „${t.n}“ drauf` : "Steht schon alles drauf"); },
  deltpl: el => { const t = S.shopTpl.find(x => x.id === el.dataset.id); if (!t || !ask(`Vorlage „${t.n}“ löschen?`)) return; S.shopTpl = S.shopTpl.filter(x => x !== t); save(); render(true); },
  cstep: el => calStep(+el.dataset.n),
  calf: el => { const k = el.dataset.k; S.settings.calFilter[k] = (S.settings.calFilter[k] ?? 1) ? 0 : 1; save(); render(true); },
  dayview: el => { selDate = el.dataset.d; calView = "tag"; render(); },
  mpick: () => monthPicker(calY),
  mpy: el => monthPicker(+el.dataset.y),
  mpset: el => { calY = +el.dataset.y; calM = +el.dataset.m; selDate = iso(new Date(calY, calM, 1, 12)); if (today().startsWith(`${calY}-${pad(calM + 1)}`)) selDate = today(); if (calView === "liste") calView = "monat"; closeSheet(); render(); },
  mptoday: () => { selDate = today(); calY = +selDate.slice(0, 4); calM = +selDate.slice(5, 7) - 1; closeSheet(); render(); },
  tabset: el => { setFrom = { v: view, area, cur, t: el.dataset.t || "Zurück", y: $("#screen").scrollTop }; setSec = el.dataset.k; view = "einstellungen"; closeAll(); render(); },
  setsec: el => { const sc = $("#screen"), k = el.dataset.k || ""; if (k && !setSec) setIdxY = sc.scrollTop; setFrom = null; setSec = k; render(); if (!k) sc.scrollTop = setIdxY; },
  setback: () => { const f = setFrom || { v: "heute" }; setFrom = null; setSec = ""; view = f.v; if (f.area) area = f.area; if (f.cur) cur = f.cur; render(); $("#screen").scrollTop = f.y || 0; },
  cancel: () => { if (sheetDirty && $("#sheetbody [data-draft]") && !ask("Eingaben verwerfen?")) return; draftClear(); closeSheet(); },
  resumedraft: (el, e) => { if (e.target.closest('[data-act="dropdraft"]')) return; draftResume(); },
  dropdraft: (el, e) => { if (!ask("Unfertige Eingabe verwerfen?")) return; draftClear(); render(true); },
  editperson: el => personForm(S.people.find(x => x.id === el.dataset.id)),
  saveperson: el => savePerson(el.dataset.id),
  kinedit: el => kinForm(el.dataset.id),
  kinsave: el => {
    const p = S.people.find(x => x.id === cur); if (!p) return; const name = $("#k-name").value.trim(), bd = L.parseBday($("#k-bday").value), dd = L.parseBday($("#k-death").value);
    if (!name) { toast("Bitte einen Namen eintragen"); return; } if (bd === null || dd === null) { toast("Datum bitte als TT.MM.JJJJ, z. B. 07042024"); return; }
    p.kin = p.kin || []; let k = p.kin.find(x => x.id === el.dataset.id); if (!k) { k = { id: uid() }; p.kin.push(k); }
    Object.assign(k, { name, rel: $("#k-rel").value, bday: bd || "", death: dd || "" }); save(); closeSheet(); render(true); toast(name + " gespeichert");
  },
  kindel: el => { const p = S.people.find(x => x.id === cur), k = p && (p.kin || []).find(x => x.id === el.dataset.id); if (!k || !ask(`${k.name} aus der Familie von ${fullName(p)} löschen?`)) return; p.kin = p.kin.filter(x => x !== k); save(); closeSheet(); render(true); },
  psort: el => { S.settings.peopleSort = el.dataset.m; save(); render(); },
  delperson: el => { const p = S.people.find(x => x.id === el.dataset.id); if (!ask(fullName(p) + " wirklich löschen? Notizen und Anrufverlauf gehen mit.")) return; dropPerson(p); draftClear(); save(); closeSheet(); view = "menschen"; render(); toast("Gelöscht"); },
  askdone: el => { const p = S.people.find(x => x.id === cur), a = p.ask.find(x => x.id === el.dataset.id); a.done = !a.done; save(); render(true); },
  delakte: el => { const p = S.people.find(x => x.id === cur), it = p[el.dataset.k].find(x => x.id === el.dataset.id); if (!it || !ask(`„${it.t}“ löschen?`)) return; p[el.dataset.k] = p[el.dataset.k].filter(x => x !== it); save(); render(true); },
  toggle: el => toggleTodo(el.dataset.id),
  edittodo: el => { const t = S.todos.find(x => x.id === el.dataset.id); if (!t) return; if (t.list === "einkauf") shopItemForm(t); else todoForm(t); },
  deltodo: el => { const t = S.todos.find(x => x.id === el.dataset.id); if (!t || !ask(`„${t.t}“ löschen?`)) return; S.todos = S.todos.filter(x => x !== t); draftClear(); save(); closeSheet(); render(true); toast("Gelöscht"); },
  savetodo: el => saveTodo(el.dataset.id),
  newtodo: el => todoForm(null, { date: el.dataset.d || "", area: el.dataset.area || "" }),
  todolist: el => { if (shopMode) { shopMode = false; wakeLock(false); } todoList = el.dataset.l; showDone = false; render(); },
  showdone: () => { showDone = !showDone; render(true); },
  shopdone: () => { const got = S.todos.filter(t => t.list === "einkauf" && t.done && !t.arch); got.forEach(t => { t.arch = 1; }); if (shopMode) { shopMode = false; wakeLock(false); } save(); render(true); toast(`Einkauf erledigt: ${got.length} Artikel im Verlauf gespeichert`); },
  cleardone: () => { const n = S.todos.filter(t => t.list === "einkauf" && t.done).length; if (!ask(`${n} erledigte Artikel von der Liste löschen?`)) return; S.todos = S.todos.filter(t => !(t.list === "einkauf" && t.done)); save(); render(true); },
  shoplist: () => { todoList = "einkauf"; view = "todos"; render(); },
  shopmode: el => { shopMode = el.dataset.on === "1"; wakeLock(shopMode); todoList = "einkauf"; view = "todos"; render(); $("#screen").scrollTop = 0; },
  mstep: el => shiftMonth(+el.dataset.n),
  calview: el => { calView = el.dataset.cv; if (calView === "monat") { calY = +selDate.slice(0, 4); calM = +selDate.slice(5, 7) - 1; } render(); },
  selday: el => { selDate = el.dataset.d; render(true); },
  newexp: () => expenseForm(),
  saveexp: () => { const a = parseAmount($("#e-amt").value); if (a == null) { toast("Bitte den Betrag eintragen"); return; } S.expenses.push({ id: uid(), d: $("#e-date").value || today(), amount: a, shop: $("#e-shop").value.trim(), cat: $("#e-cat").value, photo: null }); draftClear(); save(); closeSheet(); render(true); toast("Gespeichert: " + eur(a)); },
  delexp: async el => { const e = S.expenses.find(x => x.id === el.dataset.id); if (!ask(`Ausgabe ${e.shop || e.cat} (${eur(e.amount)}) löschen?`)) return; if (e.photo) await photoDel(e.photo); S.expenses = S.expenses.filter(x => x !== e); save(); render(true); },
  deldoc: async el => { const d = S.docs.find(x => x.id === el.dataset.id); if (!ask(`„${d.name}“ löschen? Das Foto wird mit gelöscht.`)) return; if (d.photo) await photoDel(d.photo); S.docs = S.docs.filter(x => x !== d); save(); render(true); },
  delnote: el => { const n = S.notes.find(x => x.id === el.dataset.id); if (!n || !ask(`Notiz „${n.t}“ löschen?`)) return; S.notes = S.notes.filter(x => x !== n); save(); render(true); },
  vagain: () => recStart(),
  kidnew: el => kidForm(el.dataset.id),
  vplus: () => { closeSheet(); setTimeout(() => { if (typeof plusMenu === "function") plusMenu("heute"); else todoForm(null); }, 60); },
  teladd: () => { const b = $("#c-tels"); if (!b) return; b.insertAdjacentHTML("beforeend", telRow("", "")); const i = b.lastElementChild.querySelector("input"); if (i) i.focus(); },
  mailadd: () => { const b = $("#c-mails"); if (!b) return; b.insertAdjacentHTML("beforeend", mailRow("")); const i = b.lastElementChild.querySelector("input"); if (i) i.focus(); },
  rowdel: el => { const r = el.closest(".xrow"); if (!r) return; const i = r.querySelector("input"); if (i && i.value.trim() && !ask("„" + i.value.trim() + "“ entfernen?")) return; r.remove(); sheetDirty = true; },
  plusshow: el => { const b = document.getElementById(el.dataset.t); if (b) { b.hidden = false; const i = b.querySelector("input,textarea,select"); if (i) i.focus(); } el.hidden = true; },
  woherset: el => { const i = document.getElementById(el.dataset.t); if (!i) return; i.value = i.value.trim() === el.dataset.w ? "" : el.dataset.w; i.dispatchEvent(new Event("input", { bubbles: true })); el.parentNode.querySelectorAll(".chip2").forEach(c => c.setAttribute("aria-pressed", String(c.dataset.w === i.value))); },
  kidsave: el => {
    const par = S.people.find(x => x.id === el.dataset.id), first = $("#kd-first").value.trim(), bd = L.parseBday($("#kd-bday").value); if (!par || !first) { toast("Bitte den Vornamen eintragen"); return; }
    if (bd === null) { toast("Geburtstag bitte als TT.MM.JJJJ"); return; }
    S.people.push({ id: uid(), created: today(), calls: [], notes: [], ask: [], gifts: [], cyc: "nie", group: par.group || "", gift: true, addr: "", first, last: $("#kd-last").value.trim(), tel: "", email: "", bday: bd || "", parent: par.id, local: true, rev: today() });
    save(); closeSheet(); render(true); toast(first + " ist als Kind von " + (par.first || fullName(par)) + " eingetragen");
  },
  lunchset: el => {
    const p = S.people.find(x => x.id === el.dataset.id); if (!p) return;
    let d = addDays(today(), 7); while ([0, 6].includes(D(d).getDay())) d = addDays(d, 1);
    openSheet(`<p class="stitle">Treffen mit ${esc(p.first || fullName(p))}</p>
    <div class="fgrid"><div class="fld"><label for="lu-date">Wann?</label><input type="date" id="lu-date" value="${d}"></div><div class="fld"><label for="lu-time">Uhrzeit</label><input type="time" id="lu-time" value="12:00"></div></div>
    <div class="fld" style="position:relative"><label for="lu-ort">Wo? (leer lassen, wenn noch offen)</label><input id="lu-ort" placeholder="z. B. Tati-Café Stuttgart" autocomplete="off"><div id="lu-ort-sug" class="sug" hidden></div></div>
    <div class="row2"><button class="btn" data-act="cancel">Abbrechen</button><button class="btn pri" data-act="lunchsave" data-id="${p.id}">Eintragen</button></div>`, () => addrSuggest($("#lu-ort"), $("#lu-ort-sug"), true));
  },
  lunchsave: el => {
    const p = S.people.find(x => x.id === el.dataset.id), d = $("#lu-date").value; if (!p || !d) { toast("Bitte ein Datum wählen"); return; }
    const o = $("#lu-ort"), ort = o.dataset.label || o.value.trim();
    const nt = { id: uid(), t: "Treffen mit " + fullName(p), kind: "treff", pid: p.id, list: "todo", done: false, created: today(), date: d, time: $("#lu-time").value || "", trig: "zeit", rep: "nie", area: "", nerv: false, ort };
    S.todos.push(nt); p.lunchLast = d; delete p.lunchSnooze;
    if (ort && !o.dataset.label) placeFind(ort).then(full => { if (full) { nt.ort = full; save(); render(true); } });
    save(); closeSheet(); render(true); toast(`Eingetragen für ${relDate(d)}. Danach erinnert Mirella ${p.lunch} wieder.`);
  },
  lunchlater: el => { const p = S.people.find(x => x.id === el.dataset.id); if (!p) return; p.lunchSnooze = addDays(today(), 14); save(); render(true); toast("In 2 Wochen erinnert Mirella wieder"); },
  vnext: () => voiceReview(),
  vback: () => { const t = voiceReview.lastTxt || ""; voiceStart(); recStop(); $("#v-text").value = t; $("#v-state").textContent = "Ändern oder auf „Nochmal“ tippen."; },
  gruss: el => { const p = S.people.find(x => x.id === el.dataset.id); if (p) grussForm(p); },
  grusssend: el => { const p = S.people.find(x => x.id === el.dataset.id), t = ($("#gr-t").value || "").trim(); if (!p || !t) return; const n = intlTel(p.tel); closeSheet(); location.href = el.dataset.via === "wa" ? "https://wa.me/" + n.replace("+", "") + "?text=" + encodeURIComponent(t) : "sms:" + n + "&body=" + encodeURIComponent(t); },
  grusski: async el => {
    const p = S.people.find(x => x.id === el.dataset.id); if (!p) return; el.disabled = true; el.textContent = "Mirella schreibt …";
    const a = ageAt(p, nextBirthday(p) || today()), notes = (S.notes || []).filter(x => x.pid === p.id).slice(-5).map(x => x.t).join("; ");
    const system = `Du schreibst für ${S.settings.name || "Felix"} einen kurzen, herzlichen Geburtstagsgruß auf Deutsch in du-Form für WhatsApp. Zwei bis vier Sätze, natürlich und persönlich, höchstens zwei Emojis, keine Floskeln, kein Gedicht. Gib nur den Text zurück, ohne Anführungszeichen.`;
    const user = `Empfänger: ${p.nick || p.first || fullName(p)}${a ? ", wird " + a : ""}${p.woher ? ". Woher wir uns kennen: " + p.woher : ""}${(p.groups || []).length ? ". Gruppe: " + p.groups.join(", ") : ""}${notes ? ". Notizen: " + notes : ""}.`;
    try { const t = typeof kiOn === "function" && kiOn() ? await kiCall({ system, user, hard: false, maxTokens: 600 }) : await window.appleKi(system, user); if (t && $("#gr-t")) $("#gr-t").value = String(t).trim(); } catch (e) { toast(e && e.message || "Das hat nicht geklappt"); }
    el.disabled = false; el.textContent = "✦ Nochmal anders";
  },
  vsave: () => voiceSave(),
  vmore: () => { $$("#pitems .pitem").forEach(b => readPItem(b, pending[+b.dataset.i])); const m = { txt: voiceReview.lastTxt || "", items: pending.slice() }; voiceStart(); vMore = m; const st = $("#sheetbody .stitle"); if (st) st.textContent = "Was soll ich ändern oder ergänzen?"; const ta = $("#v-text"); if (ta) ta.placeholder = "z. B. Mach die Uhrzeit auf 18 Uhr. Oder: Und noch Milch auf die Einkaufsliste."; },
  pdel: el => { $$("#pitems .pitem").forEach(b => readPItem(b, pending[+b.dataset.i])); pending.splice(+el.dataset.i, 1); reviewRender(voiceReview.lastTxt); },
  importvcf: () => { const f = $("#f-vcf"); f.value = ""; f.click(); },
  export: () => exportData(),
  import: () => { const f = $("#f-import"); f.value = ""; f.click(); },
  wipe: async () => { if (!ask("Wirklich ALLE Daten auf diesem Gerät löschen? Das geht nicht rückgängig.") || !ask("Ganz sicher? Kontakte, Aufgaben, Dokumente und Fotos sind dann weg.")) return; S = blank(); save(); await photoClear(); view = "heute"; render(); toast("Alles gelöscht"); }
};
/* Knöpfe am Schlüssel-Feld */
ACT.keypaste = async el => {
  const inp = document.getElementById(el.dataset.for); if (!inp) return;
  let t = "";
  try { t = await navigator.clipboard.readText(); } catch (_) { }
  t = String(t || "").replace(/\s+/g, "");
  if (!t) { inp.value = ""; inp.focus(); toast("Zwischenablage leer. Halte das Feld gedrückt und tippe auf Einfügen."); return; }
  inp.value = t; inp.dispatchEvent(new Event("change", { bubbles: true }));
  toast("Eingefügt, endet auf " + t.slice(-4));
};
ACT.keyclear = el => {
  const inp = document.getElementById(el.dataset.for); if (!inp || !inp.value) { inp && inp.focus(); return; }
  if (!ask("Den Schlüssel in diesem Feld löschen?")) return;
  inp.value = ""; inp.dispatchEvent(new Event("change", { bubbles: true })); inp.focus();
};
document.addEventListener("click", e => {
  const c = e.target.closest("[data-close]");
  if (c) { c.dataset.close === "drawer" ? closeDrawer() : closeSheet(true); return; }
  if (e.target.id === "scrim") { closeAll(true); return; }
  const tab = e.target.closest(".tab");
  if (tab) { if (shopMode && tab.dataset.v !== "todos") { shopMode = false; wakeLock(false); } if (tab.dataset.v === "kalender" && view !== "kalender") { calView = S.settings.calStart || "monat"; selDate = today(); calY = +selDate.slice(0, 4); calM = +selDate.slice(5, 7) - 1; } view = tab.dataset.v; q = ""; grpFilter = ""; closeAll(true); render(); return; }
  if (e.target.closest("#mic")) { if ($("#sheet").classList.contains("open") && $("#v-text")) { closeSheet(); return; } voiceStart(); return; }
  if (e.target.closest("#plus")) { plusAction(); return; }
  const a = e.target.closest("[data-act]");
  if (a && Date.now() - swipeAt < 450 && !a.classList.contains("swdel")) { e.preventDefault(); return; } // gerade gewischt: kein Antippen auslösen
  if (a && ACT[a.dataset.act]) {
    if (a.tagName === "INPUT" && a.type === "checkbox") return; // über "change"
    if (a.dataset.act === "dial") { e.stopPropagation(); pendingCall = a.dataset.id; closeSheet(); return; } // tel:-Link normal öffnen
    e.preventDefault(); ACT[a.dataset.act](a, e);
  }
});
/* Nach dem Telefonat zurück in Mirella: gleich fragen, wie es lief */
document.addEventListener("visibilitychange", () => { if (!document.hidden && pendingCall) { const p = S.people.find(x => x.id === pendingCall); pendingCall = null; if (p) setTimeout(() => callResult(p, false), 400); } });
document.addEventListener("change", e => {
  const el = e.target;
  if (el.matches('input[type=checkbox][data-act="toggle"]')) { toggleTodo(el.dataset.id); return; }
  if (el.dataset.set) {
    const k = el.dataset.set;
    const v = el.type === "checkbox" ? (el.checked ? 1 : 0) : el.tagName === "SELECT" && !el.dataset.str ? +el.value : el.dataset.num ? (parseAmount(el.value) || 0) : el.value.trim();
    putSet(k, v); save(); toast("Gespeichert");
    if (k === "gmapsKey") { if (v && typeof window.mirellaKeyCheck === "function") setTimeout(() => window.mirellaKeyCheck(true), 300); else if (!v) setTimeout(() => render(true), 300); }
    return;
  }
  if (el.closest && el.closest("#sheetbody [data-draft]")) draftSave();
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
        S.people.push({ id: uid(), created: today(), calls: [], notes: [], ask: [], gifts: [], cyc: "nie", group: "", gift: false, addr: "", ...c }); added++;
      }
      save(); view = "menschen"; render(); toast(`${pl(added, "Kontakt", "Kontakte")} übernommen${skipped ? ", " + skipped + " schon vorhanden (ergänzt)" : ""}. Anruf-Rhythmus je Person unter „Bearbeiten“.`);
    }).catch(() => toast("Datei konnte nicht gelesen werden"));
  }
});
document.addEventListener("input", e => {
  if (e.target.closest && e.target.closest("#sheetbody [data-draft]")) draftSave();
  if (e.target.id === "q") { q = e.target.value; const pos = e.target.selectionStart; render(true); const i = $("#q"); i.focus(); try { i.setSelectionRange(pos, pos); } catch (_) { } }
});
document.addEventListener("submit", e => {
  const f = e.target; e.preventDefault();
  const inp = f.querySelector("input"), v = inp ? inp.value.trim() : "";
  if (!v) return;
  if (f.dataset.form === "shop") { const dup = splitItems(v).filter(t => !addShop(t)); if (dup.length) toast("Schon auf der Liste: " + dup.join(", ")); save(); render(true); const i = $("#shopin"); i && i.focus(); return; }
  if (f.dataset.form === "akte") { const p = S.people.find(x => x.id === cur), k = f.dataset.k; p[k] = p[k] || []; p[k].unshift({ id: uid(), t: v, d: today() }); save(); render(true); toast("Hinzugefügt"); return; }
  if (f.dataset.form === "wxplace") { setWxPlace(v); return; }
  if (f.dataset.form === "group") { if (!S.groups.includes(v)) S.groups.push(v); save(); render(true); toast("Gruppe hinzugefügt: " + v); return; }
  if (f.dataset.form === "cat") { S.settings.cats = [...new Set([...(S.settings.cats || []), v])]; save(); render(true); toast("Kategorie hinzugefügt: " + v); return; }
  if (f.dataset.form === "note") { S.notes.push({ id: uid(), area, t: v, d: today() }); save(); render(true); toast("Notiz gespeichert"); }
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { document.querySelectorAll(".pdfview,.imgfull,.zv").forEach(x => x.remove()); closeAll(true); return; }
  if ((e.key === "Enter" || e.key === " ") && e.target.matches("[role=button][data-act]")) { e.preventDefault(); e.target.click(); }
});
function shiftMonth(k) { calM += k; if (calM < 0) { calM = 11; calY--; } if (calM > 11) { calM = 0; calY++; } selDate = iso(new Date(calY, calM, 1, 12)); if (today().startsWith(`${calY}-${pad(calM + 1)}`)) selDate = today(); render(); }
let tx = null, ty = null;
/* A–Z-Leiste: Finger drauf und ziehen springt zum Buchstaben */
function azGo(e) {
  const t = e.touches ? e.touches[0] : e, el = document.elementFromPoint(t.clientX, t.clientY), sp = el && el.closest && el.closest("#azbar span"); if (!sp) return;
  const l = sp.dataset.l; let tgt = document.getElementById("az-" + (l === "#" ? "x" : l));
  if (!tgt) { const all = [...document.querySelectorAll('[id^="az-"]')]; tgt = all.find(x => x.id.slice(3) > l) || all[all.length - 1]; }
  const first = document.querySelector("#azbar span");
  if (sp === first) { const sc = $("#screen"); if (sc) sc.scrollTop = 0; window.scrollTo(0, 0); } else if (tgt) tgt.scrollIntoView({ block: "start" });
  let pop = document.querySelector(".azpop"); if (!pop) { pop = document.createElement("div"); pop.className = "azpop"; document.body.appendChild(pop); } pop.textContent = l;
}
const azEnd = () => { const p = document.querySelector(".azpop"); if (p) p.remove(); };
document.addEventListener("touchstart", e => { if (e.target.closest("#azbar")) azGo(e); }, { passive: true });
document.addEventListener("touchmove", e => { if (e.target.closest && e.target.closest("#azbar")) azGo(e); }, { passive: true });
document.addEventListener("touchend", azEnd); document.addEventListener("touchcancel", azEnd);
document.addEventListener("click", e => { if (e.target.closest("#azbar")) { azGo(e); setTimeout(azEnd, 500); } });
/* Wischen nach links auf einer Zeile: roter Löschen-Knopf. Gelöscht wird erst nach Tipp darauf und Nachfrage. */
let swp = null, swipeAt = 0;
function swipeClose() { document.querySelectorAll(".swiped").forEach(x => { x.classList.remove("swiped"); x.style.transform = ""; const b = x.querySelector(":scope > .swdel"); if (b) b.remove(); }); }
document.addEventListener("touchstart", e => { if (!e.target.closest(".swdel")) swipeClose(); const row = e.target.closest("[data-swipe]"); swp = row && e.touches.length === 1 ? { row, x: e.touches[0].clientX, y: e.touches[0].clientY, on: false } : null; }, { passive: true });
document.addEventListener("touchmove", e => {
  if (!swp) return; const dx = e.touches[0].clientX - swp.x, dy = e.touches[0].clientY - swp.y;
  if (!swp.on) { if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { swp = null; return; } if (dx < -14 && Math.abs(dx) > Math.abs(dy) * 1.5) swp.on = true; else return; }
  swp.row.style.transform = `translateX(${Math.max(-104, Math.min(0, dx))}px)`;
}, { passive: true });
document.addEventListener("touchend", e => {
  if (!swp || !swp.on) { swp = null; return; } const row = swp.row, dx = e.changedTouches[0].clientX - swp.x; swp = null; swipeAt = Date.now();
  if (dx > -52) { row.style.transform = ""; return; }
  row.classList.add("swiped"); row.style.transform = "translateX(-104px)";
  const b = document.createElement("button"); b.className = "swdel"; b.dataset.act = row.dataset.swipe; b.dataset.id = row.dataset.id; b.textContent = "Löschen"; row.appendChild(b);
});
$("#screen").addEventListener("touchstart", e => { if (view === "kalender" && calView !== "liste") { tx = e.touches[0].clientX; ty = e.touches[0].clientY; } else tx = null; }, { passive: true });
$("#screen").addEventListener("touchend", e => { if (tx === null) return; const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) calStep(dx < 0 ? 1 : -1); tx = null; });
/* Wisch nach unten auf dem Sheet-Kopf schließt */
let sy = null;
$("#sheet").addEventListener("touchstart", e => { sy = $("#sheet").scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
$("#sheet").addEventListener("touchend", e => { if (sy !== null && e.changedTouches[0].clientY - sy > 120 && !e.target.closest("textarea,input,select,.scanbox")) closeSheet(true); sy = null; });
/* Wie eine App: kein Zoomen, kein Verrutschen der Seite (auch nach Kamera oder Tastatur) */
["gesturestart", "gesturechange", "gestureend"].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false }));
document.addEventListener("touchmove", e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
let lastTouch = 0;
document.addEventListener("touchend", e => { const n = Date.now(); if (n - lastTouch < 300 && !e.target.closest("input,textarea,select,.call,a[href^='tel:']")) e.preventDefault(); lastTouch = n; }, { passive: false });
const unshift = () => { if (!document.activeElement || !document.activeElement.matches("input,textarea,select")) { if (window.scrollY || window.scrollX) window.scrollTo(0, 0); } };
window.addEventListener("scroll", unshift, { passive: true });
document.addEventListener("focusout", () => setTimeout(unshift, 60));
if (window.visualViewport) window.visualViewport.addEventListener("resize", () => setTimeout(unshift, 60));
document.addEventListener("visibilitychange", () => { if (!document.hidden) { unshift(); if (!$("#sheet").classList.contains("open") && !document.querySelector(".pdfview,.zv")) { render(true); loadWeather(); syncBriefings(); } } });

/* ---------- Start (wenn alle Teile geladen sind) ---------- */
load();
function start() {
  render();
  loadWeather();
  pruneBriefings(); syncBriefings();
  HOOKS.start.forEach(f => { try { f(); } catch (e) { console.error(e); } });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else setTimeout(start, 0);
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("./sw.js").catch(() => { });

/* ---------- Erklärtexte zugeklappt (Wunsch Felix): Es steht nur „So funktioniert’s“ da, der Text klappt beim Antippen auf ----------
   Gilt für alle längeren Hinweise. Meldungen mit Zahlen oder Zustand, Warnungen und Hinweise mit Knöpfen bleiben offen sichtbar. */
const HOW_KEEP = /^(\d|Angemeldet|Bisher|Wecker:|Apple-KI|Nächstes|Gerade|Dein Geburtstags-Kalender|Ich sehe|Es wartet|Mirella hat|Das fehlt|Jetzt kurz|„Rein|„Nicht|Im iPhone-Telefonbuch|Im Telefonbuch|Neu aufsetzen|Gibt es schon|Standort|Aus den angehakten|Nummer)/;
function howFold(root) {
  for (const h of (root || document).querySelectorAll(".hint:not([data-how])")) {
    h.dataset.how = "1";
    const t = h.textContent.trim();
    if (t.length < 110 || HOW_KEEP.test(t) || h.querySelector("button,input,select,a,details") || /border/.test(h.getAttribute("style") || "") || h.closest("details,.nerv,.wres")) continue;
    const d = document.createElement("details"); d.className = "how"; d.dataset.how = "1";
    const sm = document.createElement("summary"); sm.textContent = "So funktioniert’s";
    const body = document.createElement("div"); body.className = "hint"; body.dataset.how = "1";
    body.innerHTML = h.innerHTML.replace(/^\s*<b>So funktioniert[’']s:?<\/b>:?\s*/, "");
    d.append(sm, body); h.replaceWith(d);
  }
}
if (typeof MutationObserver !== "undefined") {
  let howT = 0;
  new MutationObserver(() => { if (howT) return; howT = setTimeout(() => { howT = 0; howFold(document); }, 0); }).observe(document.documentElement, { childList: true, subtree: true });
}
