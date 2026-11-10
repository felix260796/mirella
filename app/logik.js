/* Mirella – reine Rechen-Logik ohne Bildschirm (im Browser als L.…, in Node per require für Tests).
   Geburtstag tippen, Telefon-Vorwahl, Mengen auf der Einkaufsliste, Vertragsfristen,
   Supplement-Vorrat, Weckzeit, Briefe einsortieren, Scan-Entzerrung. */
"use strict";
const L = (() => {
  const pad = n => String(n).padStart(2, "0");
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const D = s => new Date(s + "T12:00:00");
  const addDays = (s, n) => { const d = D(s); d.setDate(d.getDate() + n); return iso(d); };
  const addMonths = (s, n) => { const d = D(s), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return iso(d); };
  const diffDays = (a, b) => Math.round((D(b) - D(a)) / 864e5);

  /* ---------- Geburtstag ohne Kalender: 07041964 -> 07.04.1964 ---------- */
  function fmtBdayInput(raw) {
    const s = String(raw || "");
    // Mit Punkten getippt (7.4.1964): Teile einzeln auffüllen
    if (/\./.test(s)) {
      const parts = s.split(".").map(x => x.replace(/\D/g, ""));
      let d = parts[0] || "", m = parts[1] || "", y = parts.slice(2).join("");
      if (d.length > 2) { m = d.slice(2) + m; d = d.slice(0, 2); }
      if (m.length > 2) { y = m.slice(2) + y; m = m.slice(0, 2); }
      y = y.slice(0, 4);
      if (parts.length === 1 || (!m && parts.length === 2 && d.length === 2)) return d + (d.length === 2 ? "." : "");
      if (!y && m.length === 2 && parts.length <= 3) return d + "." + m + ".";
      return d + "." + m + (parts.length > 2 || y ? "." + y : "");
    }
    const g = s.replace(/\D/g, "").slice(0, 8);
    if (g.length <= 2) return g + (g.length === 2 ? "." : "");
    if (g.length <= 4) return g.slice(0, 2) + "." + g.slice(2) + (g.length === 4 ? "." : "");
    return g.slice(0, 2) + "." + g.slice(2, 4) + "." + g.slice(4);
  }
  /* "07.04.1964" -> "1964-04-07"; "07.04." -> "1604-04-07" (ohne Jahr, wie iPhone-Kontakte); "" -> ""; ungültig -> null */
  function parseBday(str, nowYear = new Date().getFullYear()) {
    const s = String(str || "").trim(); if (!s) return "";
    const m = s.match(/^(\d{1,2})\.(\d{1,2})\.?(\d{2}|\d{4})?$/); if (!m) return null;
    const d = +m[1], mo = +m[2]; let y = m[3] ? +m[3] : 1604;
    if (m[3] && m[3].length === 2) y = y + 2000 > nowYear ? 1900 + y : 2000 + y;
    if (mo < 1 || mo > 12 || d < 1) return null;
    const last = new Date(y === 1604 ? 2024 : y, mo, 0).getDate(); if (d > last) return null;
    if (y !== 1604 && (y < 1900 || y > nowYear)) return null;
    return `${y}-${pad(mo)}-${pad(d)}`;
  }
  function bdayToInput(isoStr) {
    if (!isoStr || !/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return "";
    const [y, m, d] = isoStr.split("-");
    return `${d}.${m}.` + (y === "1604" ? "" : y);
  }

  /* ---------- Telefon mit Ländervorwahl ---------- */
  const COUNTRIES = [
    ["DE", "Deutschland", "+49", "🇩🇪"], ["AT", "Österreich", "+43", "🇦🇹"], ["CH", "Schweiz", "+41", "🇨🇭"], ["IT", "Italien", "+39", "🇮🇹"],
    ["FR", "Frankreich", "+33", "🇫🇷"], ["ES", "Spanien", "+34", "🇪🇸"], ["NL", "Niederlande", "+31", "🇳🇱"], ["BE", "Belgien", "+32", "🇧🇪"],
    ["LU", "Luxemburg", "+352", "🇱🇺"], ["DK", "Dänemark", "+45", "🇩🇰"], ["PL", "Polen", "+48", "🇵🇱"], ["CZ", "Tschechien", "+420", "🇨🇿"],
    ["HR", "Kroatien", "+385", "🇭🇷"], ["GR", "Griechenland", "+30", "🇬🇷"], ["PT", "Portugal", "+351", "🇵🇹"], ["TR", "Türkei", "+90", "🇹🇷"],
    ["HU", "Ungarn", "+36", "🇭🇺"], ["RO", "Rumänien", "+40", "🇷🇴"], ["SE", "Schweden", "+46", "🇸🇪"], ["NO", "Norwegen", "+47", "🇳🇴"],
    ["GB", "Großbritannien", "+44", "🇬🇧"], ["US", "USA / Kanada", "+1", "🇺🇸"]
  ].map(([c, n, p, f]) => ({ c, n, p, f }));
  /* "0151 2345678" -> {p:"+49", n:"151 2345678"}; "+43 664 123" -> {p:"+43", n:"664 123"} */
  function splitTel(tel) {
    let t = String(tel || "").trim(); if (!t) return { p: "+49", n: "" };
    if (t.startsWith("00")) t = "+" + t.slice(2);
    if (t.startsWith("+")) {
      const digits = t.replace(/[^\d+]/g, "");
      const hit = COUNTRIES.slice().sort((a, b) => b.p.length - a.p.length).find(c => digits.startsWith(c.p));
      if (hit) { let rest = t.slice(1).replace(/^\s*/, ""); let need = hit.p.length - 1; let i = 0; while (need > 0 && i < rest.length) { if (/\d/.test(rest[i])) need--; i++; } rest = rest.slice(i).replace(/^[\s\-/()]+/, "").replace(/^\(?0\)?\s*/, ""); return { p: hit.p, n: rest }; }
      return { p: "+49", n: t };
    }
    return { p: "+49", n: t.replace(/^0+/, "") };
  }
  function joinTel(p, n) {
    const num = String(n || "").trim().replace(/^0+/, ""); if (!num) return "";
    if (num.startsWith("+")) return num;
    return (p || "+49") + " " + num;
  }

  /* ---------- Einkaufsliste: Menge erkennen ---------- */
  const NUMW = { ein: 1, eine: 1, einen: 1, zwei: 2, drei: 3, vier: 4, "fünf": 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, zwölf: 12, halbe: 0.5, halben: 0.5 };
  const UNITS = { g: "g", gramm: "g", kg: "kg", kilo: "kg", l: "l", liter: "l", ml: "ml", packung: "Pck.", packungen: "Pck.", pck: "Pck.", "pck.": "Pck.", pack: "Pck.", flasche: "Fl.", flaschen: "Fl.", dose: "Dose", dosen: "Dose", "stück": "Stk.", stk: "Stk.", "stk.": "Stk.", bund: "Bund", glas: "Glas", "gläser": "Glas", becher: "Becher", "tüte": "Tüte", "tüten": "Tüte", kasten: "Kasten", "kästen": "Kasten", netz: "Netz", rolle: "Rolle", rollen: "Rolle", tafel: "Tafel", tafeln: "Tafel" };
  function parseQty(text) {
    let s = String(text || "").trim().replace(/\s+/g, " "), q = null, unit = "", m;
    const num = w => { if (w == null) return null; const x = w.toLowerCase().replace(",", "."); if (/^\d+(\.\d+)?$/.test(x)) return +x; return NUMW[x] != null ? NUMW[x] : null; };
    if ((m = s.match(/^(\d+(?:[.,]\d+)?|[a-zäöüß]+)\s*(?:x|×|mal)?\s+(.+)$/i)) && num(m[1]) != null) { q = num(m[1]); s = m[2]; }
    else if ((m = s.match(/^(\d+(?:[.,]\d+)?)\s*(g|kg|l|ml|x)\s*(.+)$/i))) { q = num(m[1]); if (m[2].toLowerCase() !== "x") unit = UNITS[m[2].toLowerCase()]; s = m[3]; }
    else if ((m = s.match(/^(.+?)\s+(?:x\s*)?(\d+(?:[.,]\d+)?)\s*(g|kg|l|ml|stück|stk\.?|x)?$/i))) { q = num(m[2]); if (m[3] && m[3].toLowerCase() !== "x") unit = UNITS[m[3].toLowerCase()] || ""; s = m[1]; }
    if (q != null && !unit) { const w = s.split(" "); if (UNITS[w[0].toLowerCase()] && w.length > 1) { unit = UNITS[w[0].toLowerCase()]; s = w.slice(1).join(" "); } }
    s = s.replace(/^(ein|eine|einen|die|den|das|der|etwas|noch)\s+/i, "");
    if (q === 1 && !unit) q = null;
    return { qty: q, unit, t: cap(s) };
  }
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const qtyLabel = it => it && it.qty ? (String(it.qty).replace(".", ",") + (it.unit ? " " + it.unit : "×")) : "";

  /* ---------- Verträge: Laufzeit, Kündigungsfrist ---------- */
  const PERIODS = { "wöchentlich": 12 / 52, "monatlich": 1, "alle 2 Monate": 2, "vierteljährlich": 3, "halbjährlich": 6, "jährlich": 12 };
  const monthly = (amount, interval) => { const a = +String(amount || 0).replace(",", ".") || 0; const p = PERIODS[interval || "monatlich"] || 1; return Math.round(a / p * 100) / 100; };
  /* c: {end:"2027-03-31", renew: 12 (Monate, 0 = danach monatlich kündbar), noticeN: 3, noticeU: "Monate"|"Wochen"|"Tage"} */
  function contractStatus(c, t) {
    const n = +c.noticeN || 0, u = c.noticeU || "Monate";
    const un = n === 1 ? u.replace(/e$|en$/, "").replace("Monat", "Monat").replace("Woch", "Woche") : u;
    const minus = d => u === "Monate" ? addMonths(d, -n) : addDays(d, -(u === "Wochen" ? 7 * n : n));
    if (!c.end) return n ? { flexible: true, text: `jederzeit kündbar mit ${n} ${un} Frist` } : null;
    let end = c.end; const renew = c.renew == null || c.renew === "" ? 12 : +c.renew;
    if (minus(end) < t) {
      if (!renew) return { flexible: true, end: null, text: n ? `nach Mindestlaufzeit monatlich kündbar, Frist ${n} ${un}` : "monatlich kündbar" };
      let guard = 0; while (minus(end) < t && guard++ < 100) end = addMonths(end, renew);
    }
    const deadline = minus(end);
    return { end, deadline, days: diffDays(t, deadline), text: `kündbar bis ${deadline.split("-").reverse().join(".")} zum ${end.split("-").reverse().join(".")}` };
  }

  /* ---------- Wiederkehrend: nächstes Datum nach Monaten ---------- */
  function nextAfter(last, months, t) {
    if (!last) return t;
    let n = addMonths(last, +months || 12), guard = 0;
    return n;
  }

  /* ---------- Supplements: Vorrat ---------- */
  function perDay(s) { const k = (s.morgens ? 1 : 0) + (s.mittags ? 1 : 0) + (s.abends ? 1 : 0); return k * (+s.dose || 1); }
  function supplyLeft(s, t) {
    const pd = perDay(s); if (!pd || s.stock == null || s.stock === "") return null;
    const used = s.stockDate ? Math.max(0, diffDays(s.stockDate, t)) * pd : 0;
    const left = Math.max(0, (+s.stock) - used);
    return { left, days: Math.floor(left / pd), perDay: pd };
  }

  /* ---------- Wecker: Weckzeit aus Ankunft, Fahrzeit, Vorbereitung ---------- */
  function wakePlan({ date, arrive, travelMin, prepMin = 30, bufMin = 10, count = 3, gap = 5 }) {
    const [h, m] = String(arrive).split(":").map(Number);
    const a = new Date(D(date)); a.setHours(h, m, 0, 0);
    const leave = new Date(a - (Math.round(travelMin) + (+bufMin || 0)) * 60e3);
    const wake = new Date(leave - (+prepMin || 0) * 60e3);
    const times = [];
    for (let i = Math.max(1, +count || 1) - 1; i >= 0; i--) times.push(new Date(wake - i * (+gap || 5) * 60e3));
    const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return { leave: hm(leave), leaveDate: iso(leave), wake: hm(wake), wakeDate: iso(wake), alarms: times.map(hm) };
  }
  /* Ohne Live-Verkehr: Zuschlag für Berufsverkehr (Mo–Fr 6:30–9:00 und 16:00–18:30) */
  function trafficFactor(date, time) {
    const w = D(date).getDay(); if (w === 0 || w === 6) return 1.05;
    const [h, m] = String(time).split(":").map(Number); const x = h * 60 + m;
    if ((x >= 390 && x <= 540) || (x >= 960 && x <= 1110)) return 1.35;
    if (x < 330 || x > 1260) return 1.0;
    return 1.15;
  }

  /* ---------- Briefe: automatisch einsortieren ---------- */
  const RULES = [
    { area: "geld", type: "Steuer", re: /finanzamt|steuerbescheid|einkommensteuer|steuer-?id|elster|steuernummer|lohnsteuer/g, w: 3 },
    { area: "arbeit", type: "Lohnabrechnung", re: /lohnabrechnung|gehaltsabrechnung|entgeltabrechnung|verdienstabrechnung|brutto|netto-?bezüge/g, w: 3 },
    { area: "arbeit", type: "Brief", re: /arbeitgeber|arbeitsvertrag|personalabteilung|dienstreise|reisekosten/g, w: 2 },
    { area: "geld", type: "Kontoauszug", re: /kontoauszug|sparkasse|volksbank|kreditkarte|depot|iban|überweisung|lastschrift|bausparvertrag/g, w: 1 },
    { area: "vertrag", type: "Versicherung", re: /versicherung|versicherungsschein|police|versicherungsnummer|allianz|huk|ergo|axa|generali|devk|r\+v|signal iduna|haftpflicht|hausrat/g, w: 2 },
    { area: "vertrag", type: "Vertrag", re: /stadtwerke|stromliefer|gasliefer|abschlag|enbw|vattenfall|e\.on|strom|erdgas|telekom|vodafone|o2|1&1|mobilfunk|dsl|glasfaser|internet|tarif|mitgliedschaft|fitness|mcfit|rundfunk|beitragsservice|kündigung|vertragsnummer|kundennummer|laufzeit/g, w: 1 },
    { area: "gesund", type: "Gesundheit", re: /krankenkasse|aok|techniker|barmer|dak|ikk|knappschaft|arzt|praxis|befund|rezept|labor|zahnarzt|klinik|krankenhaus|impf|heil- und kostenplan|patient/g, w: 2 },
    { area: "haus", type: "Wohnen", re: /vermieter|mietvertrag|miete\b|nebenkosten|betriebskosten|hausverwaltung|wohnung|zählerstand|ablesung|heizkosten|hausmeister|schornsteinfeger/g, w: 2 },
    { area: "auto", type: "Auto", re: /kfz|fahrzeug|zulassung|tüv|dekra|hauptuntersuchung|werkstatt|audi|kennzeichen|bußgeld|verwarnung|anhörungsbogen|kfz-steuer|reifen|e-bike|fahrrad/g, w: 2 },
    { area: "frei", type: "Reise", re: /flug|buchungsbestätigung|hotel|booking|lufthansa|reiseunterlagen|check-in|boarding|ferienwohnung|mietwagen/g, w: 2 },
    { area: "doku", type: "Ausweis & Urkunde", re: /reisepass|personalausweis|führerschein|geburtsurkunde|meldebescheinigung|standesamt|bürgeramt/g, w: 3 },
    { area: "doku", type: "Garantie & Kaufbeleg", re: /garantie|kassenbon|kaufbeleg|gewährleistung|seriennummer/g, w: 1 }
  ];
  const BRANDS = /(finanzamt|sparkasse|volksbank|allianz|huk|ergo|axa|generali|devk|enbw|vattenfall|telekom|vodafone|o2|1&1|aok|techniker krankenkasse|barmer|dak|audi|lufthansa|stadtwerke [a-zäöüß]+|beitragsservice|mcfit|dekra|tüv)/i;
  function moneyIn(text) {
    const all = [...String(text).matchAll(/(?:eur|€)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})\s*(?:eur|€|euro)?/gi)].map(m => ({ v: +m[1].replace(/\./g, "").replace(",", "."), i: m.index, cur: /eur|€|euro/i.test(m[0]) }));
    if (!all.length) return null;
    const low = String(text).toLowerCase();
    const near = all.find(a => /(betrag|summe|zahlbar|gesamt|offen|fällig|rechnungsbetrag|zu zahlen)[^\n]{0,40}$/.test(low.slice(Math.max(0, a.i - 45), a.i)));
    return (near || all.filter(a => a.cur).sort((a, b) => b.v - a.v)[0] || all.sort((a, b) => b.v - a.v)[0]).v;
  }
  function datesIn(text, t) {
    const out = [];
    for (const m of String(text).matchAll(/(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4}|\d{2})\b/g)) {
      let y = +m[3]; if (y < 100) y += 2000; const d = +m[1], mo = +m[2];
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) out.push({ d: `${y}-${pad(mo)}-${pad(d)}`, i: m.index });
    }
    return out;
  }
  function dueIn(text, t) {
    const low = String(text).toLowerCase();
    const ds = datesIn(text, t).filter(x => x.d >= t);
    const hit = ds.find(x => /(bis zum|bis spätestens|spätestens|bis|frist|fällig|zahlbar|einspruch|innerhalb)[^\n]{0,30}$/.test(low.slice(Math.max(0, x.i - 40), x.i)));
    return hit ? hit.d : null;
  }
  function classifyDoc(text, t) {
    const low = String(text || "").toLowerCase();
    const score = {};
    for (const r of RULES) { const n = (low.match(r.re) || []).length; if (n) { const k = r.area + "|" + r.type; score[k] = (score[k] || 0) + n * r.w; } }
    const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
    const [area, type] = best ? best[0].split("|") : ["doku", "Brief"];
    const isBill = /rechnung|zahlbar|überweisen|mahnung|zahlungserinnerung|rechnungsbetrag/.test(low);
    const brand = (low.match(BRANDS) || [])[1];
    const kind = isBill ? "Rechnung" : /mahnung/.test(low) ? "Mahnung" : /bescheid/.test(low) ? "Bescheid" : type;
    const title = [/mahnung/.test(low) ? "Mahnung" : isBill ? "Rechnung" : /bescheid/.test(low) ? "Bescheid" : type, brand ? cap(brand.replace(/\b\w/g, c => c.toUpperCase())) : ""].filter(Boolean).join(" ");
    return { area, type: kind, title, sure: best ? Math.min(1, best[1] / 4) : 0, amount: moneyIn(text), due: dueIn(text, t || iso(new Date())) };
  }

  /* ---------- Scan: Viereck auf Rechteck entzerren (Homographie) ---------- */
  function homography(src, w, h) {
    // dest (0,0),(w,0),(w,h),(0,h) -> src p0..p3; liefert [a,b,c,d,e,f,g,h]
    const dst = [[0, 0], [w, 0], [w, h], [0, h]], A = [], B = [];
    for (let i = 0; i < 4; i++) {
      const [u, v] = dst[i], [x, y] = src[i];
      A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); B.push(x);
      A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); B.push(y);
    }
    for (let c = 0; c < 8; c++) {
      let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]]; [B[c], B[p]] = [B[p], B[c]];
      for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; B[r] -= f * B[c]; }
    }
    return B.map((b, i) => b / A[i][i]);
  }
  const mapPt = (H, u, v) => { const z = H[6] * u + H[7] * v + 1; return [(H[0] * u + H[1] * v + H[2]) / z, (H[3] * u + H[4] * v + H[5]) / z]; };

  /* ---------- Hilfe: „Wie funktioniert …?“ ---------- */
  function helpMatch(q, list) {
    const words = String(q || "").toLowerCase().replace(/[?!.,]/g, " ").split(/\s+/).filter(w => w.length > 2 && !/^(wie|was|wo|geht|das|der|die|den|ich|mit|und|eine?n?|kann|funktioniert|mache|machen|hey|mirella)$/.test(w));
    return list.map(h => ({ h, s: words.reduce((a, w) => a + (h.k.some(k => k.startsWith(w.slice(0, 5)) || w.startsWith(k.slice(0, 5))) ? 2 : 0) + (h.q.toLowerCase().includes(w) ? 1 : 0), 0) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).map(x => x.h);
  }

  return { pad, iso, D, addDays, addMonths, diffDays, fmtBdayInput, parseBday, bdayToInput, COUNTRIES, splitTel, joinTel, parseQty, qtyLabel, PERIODS, monthly, contractStatus, nextAfter, perDay, supplyLeft, wakePlan, trafficFactor, classifyDoc, moneyIn, dueIn, homography, mapPt, helpMatch };
})();
if (typeof module !== "undefined" && module.exports) module.exports = L;
