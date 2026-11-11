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


  /* ---------- Einkauf: Warengruppen und übliche Einheiten ---------- */
  const SHOPGROUPS = [
    ["Obst & Gemüse", "🥦", /apfel|äpfel|banane|birne|orange|zitrone|limette|traube|beere|kiwi|mango|ananas|melone|pfirsich|nektarine|pflaume|obst|gemüse|tomate(?!nmark)|gurke|paprika|salat|rucola|spinat|karotte|möhre|zwiebel|knoblauch|kartoffel|zucchini|aubergine|brokkoli|blumenkohl|kohl|lauch|porree|sellerie|pilz|champignon|avocado|ingwer|kräuter|petersilie|basilikum|schnittlauch|radieschen|mais|erbsen|bohnen|spargel|kürbis|süßkartoffel/],
    ["Brot & Backwaren", "🥖", /brot|brötchen|semmel|brezel|breze|toast|baguette|croissant|kuchen|laugen|knäcke|wrap|tortilla/],
    ["Milch, Käse & Eier", "🧀", /milch|butter|käse|kaese|joghurt|jogurt|quark|sahne|schmand|frischkäse|mozzarella|parmesan|feta|ei$|eier|skyr|kefir|buttermilch|margarine|creme fraiche|crème/],
    ["Fleisch, Wurst & Fisch", "🥩", /fleisch|hack|schwein|rind|lamm|gulasch|schnitzel|steak|hähnchen|hühnchen|huhn|pute|wurst|salami|schinken|speck|würstchen|bratwurst|lachs|fisch|thunfisch|garnele|aufschnitt|leberkäs/],
    ["Tiefkühl", "🧊", /tiefkühl|^tk |tk-|pizza|^eis$|speiseeis|eiscreme|pommes|fischstäbchen/],
    ["Getränke", "🥤", /wasser|sprudel|saft|cola|limo|bier|wein|sekt|schorle|getränk|eistee|energy|spezi|fanta|sprite|^mate$|club-mate/],
    ["Süßes & Snacks", "🍫", /schokolade|schoko|chips|keks|gummibär|bonbon|riegel|nüsse|nuss|erdnuss|salzstangen|popcorn|süßigkeit/],
    ["Vorrat & Konserven", "🥫", /nudel|pasta|spaghetti|reis|mehl|zucker|salz|pfeffer|gewürz|öl|essig|ketchup|senf|mayo|soße|sauce|brühe|dose|konserve|linsen|kichererbsen|haferflocken|müsli|cornflakes|honig|marmelade|nutella|aufstrich|kaffee|tee|kakao|backpulver|hefe|passierte|tomatenmark|pesto/],
    ["Drogerie & Hygiene", "🧴", /zahnpasta|zahnbürste|shampoo|duschgel|seife|deo|creme|rasier|toilettenpapier|klopapier|taschentuch|watte|pflaster|tampon|binde|windel|sonnencreme|lotion|haar/],
    ["Haushalt & Putzen", "🧽", /spülmittel|spül|tabs|waschmittel|weichspüler|reiniger|putz|schwamm|müllbeutel|mülltüte|küchenrolle|alufolie|frischhaltefolie|backpapier|batterie|glühbirne|kerze|serviette|zewa/]
  ];
  function shopGroup(t) {
    const s = " " + String(t || "").toLowerCase() + " ";
    for (const [n, ic, re] of SHOPGROUPS) if (re.test(s.trim())) return { n, ic };
    return { n: "Sonstiges", ic: "🛒" };
  }
  const DEFUNIT = [[/^eier$/, 1, "Pck."], [/^butter$/, 1, "Stk."], [/milch$/, 1, "l"], [/^(mehl|zucker|nudeln|spaghetti|reis|kaffee|toast|käse|aufschnitt|salami|schinken|haferflocken|müsli)$/, 1, "Pck."], [/^(joghurt|sahne|quark|schmand|frischkäse|skyr)$/, 1, "Becher"], [/^(brot|gurke|paprika|zucchini|avocado|mozzarella|baguette|salat|eisbergsalat|zitrone)$/, 1, "Stk."], [/^(bananen|tomaten|äpfel|kartoffeln|zwiebeln|möhren|karotten)$/, 1, "kg"], [/^(wasser|sprudel)$/, 1, "Kasten"], [/^(bier)$/, 1, "Kasten"], [/^(wein|saft|cola|öl|olivenöl)$/, 1, "Fl."], [/^(schokolade)$/, 1, "Tafel"], [/^(chips|gummibärchen)$/, 1, "Tüte"], [/^(küchenrolle|alufolie|frischhaltefolie|backpapier)$/, 1, "Rolle"], [/^(toilettenpapier|klopapier|taschentücher|spülmaschinentabs|müllbeutel)$/, 1, "Pck."], [/^(brötchen|semmeln)$/, 6, "Stk."]];
  function defUnit(t, learned) {
    const k = String(t || "").trim().toLowerCase();
    if (learned && learned[k]) return learned[k];
    for (const [re, q, u] of DEFUNIT) if (re.test(k)) return { qty: q, unit: u };
    return null;
  }


  /* Einkaufszettel-Foto: Zeilen in Artikel zerlegen */
  function parseShopLines(text) {
    const out = [], seen = new Set();
    String(text || "").split(/\r?\n|;|,(?!\d)/).forEach(line => {
      let x = line.replace(/^[\s\-–•*·•□☐☑✓✔>#.)\]]+/, "").replace(/[|_~^"“”„]/g, " ").replace(/\s+/g, " ").trim();
      if (x.length < 2 || !/[a-zäöüß]{2,}/i.test(x)) return;
      if (/^(einkauf|einkaufsliste|liste|rewe|edeka|aldi|lidl|summe|gesamt|datum|\d{1,2}\.\d{1,2})/i.test(x)) return;
      const letters = (x.match(/[a-zäöüß]/gi) || []).length; if (letters / x.length < 0.5) return;
      const pq = parseQty(x), k = pq.t.toLowerCase(); if (!k || seen.has(k)) return; seen.add(k); out.push(pq);
    });
    return out.slice(0, 40);
  }
  /* ---------- Eingaben prüfen ---------- */
  const MAILFIX = { "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gmail.de": "gmail.com", "gamil.com": "gmail.com", "gmx.dee": "gmx.de", "gmx.ed": "gmx.de", "gmc.de": "gmx.de", "web.dee": "web.de", "wbe.de": "web.de", "hotmial.com": "hotmail.com", "hotmail.de": null, "outlok.com": "outlook.com", "outlook.de": null, "icloud.de": "icloud.com", "iclod.com": "icloud.com", "icoud.com": "icloud.com", "yahooo.com": "yahoo.com", "t-onlien.de": "t-online.de", "tonline.de": "t-online.de" };
  function checkEmail(e) {
    const v = String(e || "").trim(); if (!v) return null;
    if (/\s/.test(v)) return "Die E-Mail enthält ein Leerzeichen.";
    const m = v.match(/^[^@]+@([^@]+)$/); if (!m) return v.includes("@") ? "Die E-Mail hat mehr als ein @." : "In der E-Mail fehlt das @.";
    const dom = m[1].toLowerCase();
    if (!/^[a-z0-9äöü-]+(\.[a-z0-9äöü-]+)*\.[a-z]{2,}$/.test(dom)) return "Nach dem @ fehlt etwas, z. B. „.de“ oder „.com“.";
    if (/\.\./.test(v) || /^\.|\.@/.test(v)) return "Die E-Mail hat einen Punkt an einer falschen Stelle.";
    if (MAILFIX[dom]) return `Meintest du „${v.split("@")[0]}@${MAILFIX[dom]}“?`;
    return null;
  }
  function checkTel(prefix, num) {
    const n = String(num || "").replace(/[^\d]/g, ""); if (!n) return null;
    if (/[a-z]/i.test(num)) return "In der Nummer stehen Buchstaben.";
    if (n.length < 5) return "Die Nummer ist zu kurz.";
    if ((prefix + n).replace(/\D/g, "").length > 15) return "Die Nummer ist zu lang.";
    if (prefix === "+49") {
      if (/^1[5-7]/.test(n) && (n.length < 10 || n.length > 11)) return "Eine Handynummer (015x, 016x, 017x) hat meist 10 bis 11 Ziffern ohne die 0.";
      if (/^0/.test(n)) return null;
    }
    return null;
  }

  /* ---------- Runde Geburtstage ---------- */
  function roundBday(bday, t, lead = 183, ages) {
    const y = +String(bday || "").slice(0, 4); if (!y || y < 1900) return null;
    const md = bday.slice(5); let ny = +t.slice(0, 4); if (`${ny}-${md}` < t) ny++;
    const next = `${ny}-${md}`, age = ny - y, d = diffDays(t, next);
    const ok = ages && ages.length ? ages.includes(age) : (age % 10 === 0 || age === 18);
    if (ok && age > 0 && d <= lead) return { date: next, age, days: d };
    return null;
  }

  /* ---------- Anrufplan: höchstens N pro Tag, nur Mo–Fr ---------- */
  function callPlan(ids, t, max, doneToday = 0, extra = 0, days = [1, 2, 3, 4, 5]) {
    const out = {}; let day = t, cap = Math.max(0, max - doneToday) + extra, used = 0;
    if (!days || !days.length) days = [1, 2, 3, 4, 5];
    const work = d => days.includes(D(d).getDay());
    if (!work(day)) cap = extra;
    for (const id of ids) {
      while (used >= cap) { day = addDays(day, 1); while (!work(day)) day = addDays(day, 1); cap = max; used = 0; }
      out[id] = day; used++;
    }
    return out;
  }

  /* ---------- Wetter: Tag/Nacht und Hinweise ----------
     hr: Open-Meteo hourly (time, temperature_2m, apparent_temperature, precipitation_probability, wind_gusts_10m, uv_index, weather_code)
     day: "JJJJ-MM-TT", nowH: Stunde jetzt. Tag = 7–20 Uhr, Nacht = 20 Uhr bis 7 Uhr am Folgetag. */
  /* Regen-Zeiträume aus Stundenwerten: zusammenhängende Stunden mit >= minP % oder messbarem Regen */
  function rainSpans(hr, fromIso, hours, minP) {
    const t = hr.time || [], P = hr.precipitation_probability || [], M = hr.precipitation || [], out = [];
    minP = minP == null ? 40 : minP;
    let i0 = t.findIndex(x => x >= fromIso); if (i0 < 0) return out;
    let cur = null;
    for (let i = i0; i < Math.min(t.length, i0 + hours); i++) {
      const wet = (P[i] || 0) >= minP || (M[i] || 0) >= 0.2;
      if (wet) {
        if (!cur) { cur = { from: t[i], to: t[i], maxP: 0, mm: 0 }; out.push(cur); }
        cur.to = t[i]; cur.maxP = Math.max(cur.maxP, P[i] || 0); cur.mm = Math.round((cur.mm + (M[i] || 0)) * 10) / 10;
      } else cur = null;
    }
    return out;
  }
  function wxDayNight(hr, day, nowH) {
    const t = hr.time || [], next = addDays(day, 1), dayI = [], nightI = [];
    t.forEach((x, i) => { const d = x.slice(0, 10), h = +x.slice(11, 13); if (d === day && h >= 7 && h < 20) dayI.push(i); if ((d === day && h >= 20) || (d === next && h < 7)) nightI.push(i); });
    const v = (k, ix, f) => { const a = ix.map(i => (hr[k] || [])[i]).filter(n => n != null); return a.length ? f(...a) : null; };
    const rest = dayI.filter(i => +t[i].slice(11, 13) >= nowH);
    const hints = [], H = (k, ic, txt) => hints.push({ k, ic, t: txt });
    const look = rest.length ? rest : dayI;
    const rainI = rest.find(i => (hr.precipitation_probability || [])[i] >= 50);
    const codes = look.map(i => (hr.weather_code || [])[i]);
    if (codes.some(c => c >= 95)) H("gewitter", "⛈️", "Gewitter möglich: draußen vorsichtig sein.");
    if (codes.some(c => (c >= 71 && c <= 77) || c === 85 || c === 86)) H("schnee", "🌨️", "Schnee: feste Schuhe, mehr Zeit für den Weg.");
    else if (rainI != null) { const h = +t[rainI].slice(11, 13); H("regen", "☂️", h <= nowH ? "Gerade Regen: Schirm mitnehmen." : `Ab ${h} Uhr Regen: Schirm mitnehmen.`); }
    const morningMin = v("temperature_2m", t.map((x, i) => i).filter(i => t[i].slice(0, 10) === day && +t[i].slice(11, 13) <= 9), Math.min);
    const nightMin = v("temperature_2m", nightI, Math.min);
    if (morningMin != null && morningMin <= 1 && nowH < 11) H("frost", "❄️", "Frost am Morgen: Glätte möglich, Scheibe kratzen einplanen.");
    else if (nightMin != null && nightMin <= 1) H("frost", "❄️", `Heute Nacht ${Math.round(nightMin)}°: morgen früh Glätte möglich.`);
    const gust = v("wind_gusts_10m", rest, Math.max);
    if (gust != null && gust >= 60) H("sturm", "💨", `Sturmböen bis ${Math.round(gust)} km/h: Fenster und Balkon sichern.`);
    else if (gust != null && gust >= 45) H("wind", "🌬️", `Windig, Böen bis ${Math.round(gust)} km/h.`);
    const dMax = v("temperature_2m", dayI, Math.max), feel = v("apparent_temperature", look, Math.min);
    if (dMax != null && dMax >= 30) H("hitze", "🥵", `Hitze bis ${Math.round(dMax)}°: viel trinken, Wasser mitnehmen.`);
    if (feel != null && feel < 5) H("jacke", "🧥", `Gefühlt nur ${Math.round(feel)}°: warme Jacke.`);
    else if (dMax != null && dMax < 10) H("jacke", "🧥", "Kühl: Jacke mitnehmen.");
    const dMin = v("temperature_2m", dayI, Math.min);
    if (dMax != null && dMin != null && dMax - dMin >= 10 && dMax >= 12) H("zwiebel", "🧣", `Großer Unterschied (${Math.round(dMin)}° bis ${Math.round(dMax)}°): Zwiebellook.`);
    const uv = v("uv_index", look, Math.max);
    if (uv != null && uv >= 6) H("uv", "🧴", `Starke Sonne (UV ${Math.round(uv)}): Sonnencreme und Sonnenbrille.`);
    else if (uv != null && uv >= 4 && dMax >= 18) H("uv", "😎", "Sonnig: Sonnenbrille einpacken.");
    if (codes.some(c => c === 45 || c === 48) && nowH < 12) H("nebel", "🌫️", "Nebel: vorsichtig fahren.");
    return { dayMax: dMax, dayMin: dMin, nightMin, nightMax: v("temperature_2m", nightI, Math.max), hints };
  }

  /* ---------- Hilfe: „Wie funktioniert …?“ ---------- */
  function helpMatch(q, list) {
    const words = String(q || "").toLowerCase().replace(/[?!.,]/g, " ").split(/\s+/).filter(w => w.length > 2 && !/^(wie|was|wo|geht|das|der|die|den|ich|mit|und|eine?n?|kann|funktioniert|mache|machen|hey|mirella)$/.test(w));
    return list.map(h => ({ h, s: words.reduce((a, w) => a + (h.k.some(k => k.startsWith(w.slice(0, 5)) || w.startsWith(k.slice(0, 5))) ? 2 : 0) + (h.q.toLowerCase().includes(w) ? 1 : 0), 0) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).map(x => x.h);
  }

  return { rainSpans, pad, iso, D, addDays, addMonths, diffDays, fmtBdayInput, parseBday, bdayToInput, COUNTRIES, splitTel, joinTel, parseQty, qtyLabel, PERIODS, monthly, contractStatus, nextAfter, perDay, supplyLeft, wakePlan, trafficFactor, classifyDoc, moneyIn, dueIn, homography, mapPt, helpMatch, SHOPGROUPS, shopGroup, defUnit, checkEmail, checkTel, roundBday, callPlan, parseShopLines, wxDayNight };
})();
if (typeof module !== "undefined" && module.exports) module.exports = L;
