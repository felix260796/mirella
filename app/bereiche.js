/* Mirella – Rubriken wie bei einer echten Sekretärin:
   Jede Rubrik hat eigene Einträge (Verträge, Fahrzeuge, Zähler, Ärzte, Supplements, Reisen …),
   das Plus öffnet erst eine Auswahl (keine Tastatur), und Mirella denkt mit:
   aus jedem Eintrag entstehen automatisch die passenden Erinnerungen (Kündigungsfrist, TÜV, Ablesen, Nachbestellen …). */
"use strict";

const fmtD = s => s ? s.split("-").reverse().join(".") : "";
const AREA_SUB = { wecker: "Vorbereitungszeit, Zuhause-Adresse, Verkehr", geld: "Einkommen, Kategorien, Budgets", vertrag: "Erinnerung vor Kündigungsfrist", gesund: "Einnahmezeiten Supplements", haus: "Zähler, Waschmaschine", auto: "Vorlauf TÜV und Inspektion", arbeit: "Erstattungen", sport: "Vereine und Ausrüstung", doku: "Ordner, Briefe einsortieren", frei: "Packliste" };
const OPT = a => a.map(x => Array.isArray(x) ? x : [x, x]);
const MONTHS_OPT = [[1, "jeden Monat"], [3, "alle 3 Monate"], [6, "alle 6 Monate"], [12, "jedes Jahr"], [24, "alle 2 Jahre"], [36, "alle 3 Jahre"]];
const NOTICE_U = OPT(["Tage", "Wochen", "Monate"]);
const RENEW = [[12, "um 12 Monate"], [24, "um 24 Monate"], [6, "um 6 Monate"], [1, "um 1 Monat"], [0, "danach monatlich kündbar"]];
const INTERVALS = OPT(Object.keys(L.PERIODS));
const lead = it => +it.lead || +S.settings.contractLead || 30;

/* ---------- Arten von Einträgen je Rubrik ---------- */
const contractFields = (arten, namePh) => [
  { k: "name", l: "Anbieter / Name", ph: namePh, req: 1 },
  { k: "art", l: "Art", t: "sel", o: OPT(arten) },
  { k: "cost", l: "Kosten in €", t: "money", half: 1 }, { k: "interval", l: "Zahlweise", t: "sel", o: INTERVALS, half: 1, def: "monatlich" },
  { k: "nr", l: "Kunden- / Vertragsnummer" },
  { k: "start", l: "Beginn", t: "date", half: 1 }, { k: "end", l: "Mindestlaufzeit bis", t: "date", half: 1 },
  { k: "renew", l: "Danach verlängert sich der Vertrag", t: "sel", o: RENEW, def: 12 },
  { k: "noticeN", l: "Kündigungsfrist", t: "num", half: 1, ph: "z. B. 3" }, { k: "noticeU", l: "Einheit", t: "sel", o: NOTICE_U, half: 1, def: "Monate" },
  { k: "lead", l: "Erinnern vor Ablauf der Frist", t: "sel", o: [[14, "2 Wochen vorher"], [30, "1 Monat vorher"], [60, "2 Monate vorher"], [90, "3 Monate vorher"]], def: () => S.settings.contractLead },
  { k: "hotline", l: "Hotline / Kontakt", t: "tel", half: 1 }, { k: "web", l: "Kundenportal / Kündigungslink", half: 1, ph: "https://…" },
  { k: "note", l: "Notiz", t: "area" }
];
const contractAuto = it => {
  const st = L.contractStatus(it, today()); if (!st || !st.deadline) return [];
  return [{ key: "kuend", date: addDays(st.deadline, -lead(it)), t: `${it.name}: bis ${fmtD(st.deadline)} kündigen, sonst Verlängerung bis ${fmtD(addMonths(st.end, +it.renew || 12))}`, nerv: !!S.settings.nerv.fristen, prio: 1 }];
};
const contractSub = it => { const st = L.contractStatus(it, today()); return [it.cost ? eur(+it.cost) + " " + (it.interval || "monatlich") : "", st ? st.text : "keine Laufzeit eingetragen"].filter(Boolean).join(" · "); };

const KINDS = {
  vertrag: {
    area: "vertrag", n: "Vertrag", ic: "📄", d: "Strom, Gas, Handy, Internet, Fitness, Abos",
    fields: contractFields(["Strom", "Gas", "Internet & Festnetz", "Handy", "Fitnessstudio", "Streaming & Abos", "Zeitung & Zeitschrift", "Rundfunkbeitrag", "Verein", "Leasing & Kredit", "Sonstiges"], "z. B. Telekom Mobilfunk"),
    sub: contractSub, auto: contractAuto, monthly: it => L.monthly(it.cost, it.interval)
  },
  versicherung: {
    area: "vertrag", n: "Versicherung", ic: "🛡️", d: "Haftpflicht, Hausrat, Kranken, BU …",
    fields: contractFields(["Haftpflicht", "Hausrat", "Krankenversicherung", "Zahnzusatz", "Berufsunfähigkeit", "Unfall", "Rechtsschutz", "Leben / Rente", "Reise", "Kfz", "Handy / Geräte", "Sonstige"], "z. B. HUK Haftpflicht").map(f => f.k === "nr" ? Object.assign({}, f, { l: "Versicherungsnummer" }) : f.k === "hotline" ? Object.assign({}, f, { l: "Schaden-Hotline" }) : f.k === "noticeN" ? Object.assign({}, f, { def: 3 }) : f.k === "interval" ? Object.assign({}, f, { def: "jährlich" }) : f),
    sub: contractSub, auto: contractAuto, monthly: it => L.monthly(it.cost, it.interval)
  },
  fahrzeug: {
    area: "auto", n: "Fahrzeug", ic: "🚗", d: "Auto oder E-Bike mit TÜV, Inspektion, Reifen",
    fields: [
      { k: "typ", l: "Was?", t: "sel", o: OPT(["Auto", "E-Bike", "Fahrrad", "Motorrad"]) },
      { k: "name", l: "Bezeichnung", ph: "z. B. Audi A6 Avant", req: 1 },
      { k: "kennz", l: "Kennzeichen", half: 1, only: it => it.typ === "Auto" || it.typ === "Motorrad" }, { k: "km", l: "Kilometerstand", t: "num", half: 1 },
      { k: "firm", l: "Firmenwagen (Vollwartung über die Firma)", t: "chk", only: it => it.typ === "Auto" },
      { k: "hu", l: "HU / TÜV fällig (Monat)", t: "month", only: it => it.typ === "Auto" || it.typ === "Motorrad" },
      { k: "insp", l: "Nächste Inspektion / Service", t: "date", half: 1 }, { k: "inspEvery", l: "Danach wieder", t: "sel", o: [[0, "–"], ...MONTHS_OPT.slice(3)], half: 1, def: 12 },
      { k: "tires", l: "An Reifenwechsel erinnern (Oktober und April)", t: "chk", only: it => it.typ !== "E-Bike" && it.typ !== "Fahrrad" },
      { k: "rahmen", l: "Rahmennummer (wichtig bei Diebstahl)", only: it => it.typ === "E-Bike" || it.typ === "Fahrrad" },
      { k: "akku", l: "Akku: im Winter drinnen lagern erinnern", t: "chk", only: it => it.typ === "E-Bike" },
      { k: "shop", l: "Werkstatt / Händler", half: 1 }, { k: "shopTel", l: "Telefon Werkstatt", t: "tel", half: 1 },
      { k: "note", l: "Notiz", t: "area" }
    ],
    sub: it => [it.kennz, it.firm ? "Firmenwagen" : "", it.hu ? "TÜV " + it.hu.split("-").reverse().join("/") : "", it.insp ? "Inspektion " + fmtD(it.insp) : "", it.km ? (+it.km).toLocaleString("de-DE") + " km" : ""].filter(Boolean).join(" · "),
    auto: it => {
      const out = [], who = it.firm ? " (Firma kümmert sich, Termin abstimmen)" : "";
      if (it.hu) { const d = it.hu + "-01"; out.push({ key: "hu", date: addDays(d, -(+S.settings.huLead || 28)), t: `${it.name}: HU/TÜV fällig im ${MN[+it.hu.slice(5, 7) - 1]}${who}`, nerv: !!S.settings.nerv.fristen }); }
      if (it.insp) out.push({ key: "insp", date: addDays(it.insp, -14), t: `${it.name}: Inspektion am ${fmtD(it.insp)}${who}` });
      if (it.tires) { const y = +today().slice(0, 4); const c = [`${y}-04-01`, `${y}-10-10`, `${y + 1}-04-01`].find(d => d >= addDays(today(), -20)); out.push({ key: "tires", date: c, t: `${it.name}: ${c.slice(5, 7) === "04" ? "Sommerreifen" : "Winterreifen"} drauf (von O bis O)` }); }
      if (it.akku) { const y = +today().slice(0, 4); const c = today() <= `${y}-11-01` ? `${y}-11-01` : `${y + 1}-11-01`; out.push({ key: "akku", date: c, t: `${it.name}: Akku über den Winter drinnen lagern, halb geladen` }); }
      return out;
    },
    done: (it, t) => { if (t.rkey === "insp" && +it.inspEvery) it.insp = addMonths(it.insp || today(), +it.inspEvery); if (t.rkey === "hu") it.hu = addMonths(it.hu + "-15", 24).slice(0, 7); }
  },
  zaehler: {
    area: "haus", n: "Zähler", ic: "🔌", d: "Strom, Gas, Wasser: ablesen mit Wiederholung",
    fields: [
      { k: "art", l: "Zähler", t: "sel", o: OPT(["Strom", "Gas", "Wasser kalt", "Wasser warm", "Heizung", "Sonstiges"]) },
      { k: "nr", l: "Zählernummer", half: 1 }, { k: "every", l: "Ablesen", t: "sel", o: MONTHS_OPT.slice(0, 4), half: 1, def: 6 },
      { k: "first", l: "Aktueller Stand (beim Anlegen)", t: "num", half: 1, newOnly: 1 }, { k: "firstD", l: "abgelesen am", t: "date", half: 1, newOnly: 1, def: () => today() },
      { k: "note", l: "Notiz (z. B. wo der Zähler hängt)", t: "area" }
    ],
    title: it => "Zähler " + (it.art || ""),
    unit: it => it.art === "Strom" ? "kWh" : it.art === "Heizung" ? "Einh." : "m³",
    sub: it => { const r = lastRead(it); return r ? `zuletzt ${(+r.v).toLocaleString("de-DE")} ${KINDS.zaehler.unit(it)} am ${fmtD(r.d)} · ${consumption(it) || "ablesen " + (MONTHS_OPT.find(m => m[0] == it.every) || [0, "alle 6 Monate"])[1]}` : "noch kein Stand"; },
    auto: it => { const r = lastRead(it); const next = r ? addMonths(r.d, +it.every || 6) : today(); return [{ key: "ablesen:" + next, date: next, t: `Zählerstand ${it.art || ""} ablesen und eintragen` }]; },
    done: (it, t) => { const v = prompt(`Zählerstand ${it.art || ""} (${KINDS.zaehler.unit(it)})?`); const n = parseAmount(v || ""); if (n != null) { it.reads = it.reads || []; it.reads.push({ d: today(), v: n }); toast("Zählerstand gespeichert"); } },
    onSave: (it, isNew) => { if (isNew && it.first !== "" && it.first != null) { it.reads = [{ d: it.firstD || today(), v: +it.first }]; } delete it.first; delete it.firstD; }
  },
  wohnung: {
    area: "haus", n: "Wohnung & Vermieter", ic: "🏠", d: "Miete, Nebenkosten, Ansprechpartner",
    fields: [
      { k: "name", l: "Vermieter / Hausverwaltung", req: 1 }, { k: "tel", l: "Telefon", t: "tel", half: 1 }, { k: "mail", l: "E-Mail", half: 1 },
      { k: "addr", l: "Adresse der Wohnung" },
      { k: "kalt", l: "Kaltmiete €", t: "money", half: 1 }, { k: "nk", l: "Nebenkosten €", t: "money", half: 1 },
      { k: "start", l: "Eingezogen am", t: "date", half: 1 }, { k: "kaution", l: "Kaution €", t: "money", half: 1 },
      { k: "nkab", l: "An Nebenkostenabrechnung erinnern (jährlich im Monat)", t: "sel", o: [[0, "nein"], ...MN.map((m, i) => [i + 1, m])], def: 0 },
      { k: "note", l: "Notiz (Hausmeister, Müll, Keller …)", t: "area" }
    ],
    title: it => "Wohnung · " + it.name,
    sub: it => [it.kalt || it.nk ? "Miete " + eur((+it.kalt || 0) + (+it.nk || 0)) + " warm" : "", it.tel].filter(Boolean).join(" · "),
    monthly: it => (+it.kalt || 0) + (+it.nk || 0),
    auto: it => { if (!+it.nkab) return []; const y = +today().slice(0, 4); let d = `${y}-${pad(+it.nkab)}-01`; if (d < addDays(today(), -30)) d = `${y + 1}-${pad(+it.nkab)}-01`; return [{ key: "nkab", date: d, t: `Nebenkostenabrechnung von ${it.name} da? Prüfen (Frist für Einwände 12 Monate)` }]; }
  },
  geraet: {
    area: "haus", n: "Gerät", ic: "🧺", d: "Waschmaschine, TV …: Garantie und Wartung",
    fields: [
      { k: "name", l: "Gerät", ph: "z. B. Waschmaschine Bosch", req: 1 },
      { k: "kauf", l: "Gekauft am", t: "date", half: 1 }, { k: "preis", l: "Preis €", t: "money", half: 1 },
      { k: "garantie", l: "Garantie bis", t: "date", half: 1 }, { k: "haendler", l: "Händler", half: 1 },
      { k: "wartung", l: "Wartung / Reinigung", t: "sel", o: [[0, "keine"], ...MONTHS_OPT], half: 1, def: 0 }, { k: "wlast", l: "zuletzt", t: "date", half: 1 },
      { k: "note", l: "Notiz (Modell, Seriennummer)", t: "area" }
    ],
    sub: it => [it.garantie ? (it.garantie < today() ? "Garantie abgelaufen" : "Garantie bis " + fmtD(it.garantie)) : "", +it.wartung ? "Wartung " + (MONTHS_OPT.find(m => m[0] == it.wartung) || [0, ""])[1] : ""].filter(Boolean).join(" · "),
    auto: it => { const o = []; if (it.garantie && it.garantie >= today()) o.push({ key: "gar", date: addDays(it.garantie, -30), t: `Garantie ${it.name} endet am ${fmtD(it.garantie)}: Mängel jetzt melden` }); if (+it.wartung) { const d = it.wlast ? addMonths(it.wlast, +it.wartung) : today(); o.push({ key: "wart:" + d, date: d, t: `${it.name}: Wartung / Reinigung` }); } return o; },
    done: (it, t) => { if (t.rkey.startsWith("wart")) it.wlast = today(); }
  },
  arzt: {
    area: "gesund", n: "Arzt / Ansprechpartner", ic: "🩺", d: "Hausarzt, Zahnarzt, Physio, Apotheke",
    fields: [
      { k: "name", l: "Name / Praxis", req: 1, ph: "z. B. Dr. Maier" }, { k: "fach", l: "Fachrichtung", t: "sel", o: OPT(["Hausarzt", "Zahnarzt", "Augenarzt", "Hautarzt", "Orthopäde", "HNO", "Frauenarzt / Urologe", "Physiotherapie", "Heilpraktiker", "Apotheke", "Krankenkasse", "Sonstige"]) },
      { k: "tel", l: "Telefon", t: "tel", half: 1 }, { k: "web", l: "Online-Termin (Link)", half: 1 },
      { k: "addr", l: "Adresse" }, { k: "note", l: "Notiz (Sprechzeiten, Patientennummer)", t: "area" }
    ],
    title: it => it.name, sub: it => [it.fach, it.tel].filter(Boolean).join(" · "), auto: () => []
  },
  vorsorge: {
    area: "gesund", n: "Wiederkehrender Termin", ic: "🦷", d: "Zahnreinigung, Check-up, Augen …",
    fields: [
      { k: "name", l: "Was?", ph: "z. B. Zahnreinigung", req: 1 },
      { k: "arzt", l: "Bei", t: "ref", ref: "arzt" },
      { k: "every", l: "Wie oft?", t: "sel", o: MONTHS_OPT.slice(1), half: 1, def: 6 }, { k: "last", l: "Zuletzt", t: "date", half: 1 },
      { k: "next", l: "Nächster Termin (wenn schon vereinbart)", t: "date", half: 1 }, { k: "nextT", l: "Uhrzeit", t: "time", half: 1 },
      { k: "note", l: "Notiz", t: "area" }
    ],
    sub: it => it.next ? `Termin ${fmtD(it.next)}${it.nextT ? " " + it.nextT : ""}` : it.last ? `fällig ${relDate(addMonths(it.last, +it.every || 6))} · zuletzt ${fmtD(it.last)}` : "noch nie eingetragen",
    auto: it => {
      const dr = it.arzt && S.items.find(x => x.id === it.arzt), bei = dr ? " bei " + dr.name : "";
      if (it.next) return [{ key: "termin:" + it.next, date: it.next, time: it.nextT || "", t: `${it.name}${bei}${it.nextT ? " um " + it.nextT : ""}`, pid: "" }, { key: "vorher:" + it.next, date: addDays(it.next, -1), t: `Morgen: ${it.name}${bei}` }];
      const due = it.last ? addMonths(it.last, +it.every || 6) : today();
      return [{ key: "vereinb:" + due, date: addDays(due, -14), t: `Termin für ${it.name}${bei} ausmachen${dr && dr.tel ? " (" + dr.tel + ")" : ""}` }];
    },
    done: (it, t) => { if (t.rkey.startsWith("termin")) { it.last = it.next; it.next = ""; it.nextT = ""; } else if (t.rkey.startsWith("vereinb")) { const d = prompt("Termin vereinbart? Datum eintragen (TT.MM.JJJJ), sonst leer lassen"); const p = d && d.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/); if (p) it.next = mkDate(+p[1], +p[2], p[3]); } }
  },
  supplement: {
    area: "gesund", n: "Supplement", ic: "💊", d: "Einnahmezeiten, Vorrat, Nachbestellen",
    fields: [
      { k: "name", l: "Name", ph: "z. B. Vitamin D3", req: 1 },
      { k: "morgens", l: "morgens", t: "chk", third: 1 }, { k: "mittags", l: "mittags", t: "chk", third: 1 }, { k: "abends", l: "abends", t: "chk", third: 1 },
      { k: "dose", l: "Stück pro Einnahme", t: "num", half: 1, def: 1 }, { k: "stock", l: "Vorrat (Stück)", t: "num", half: 1 },
      { k: "reorder", l: "Nachbestellen, wenn es noch so viele Tage reicht", t: "num", def: 14, ph: "z. B. 10" },
      { k: "shop", l: "Wo bestellen (Link oder Laden)" }, { k: "note", l: "Notiz (z. B. mit Essen)", t: "area" }
    ],
    sub: it => { const l = L.supplyLeft(it, today()); return [["morgens", "mittags", "abends"].filter(k => it[k]).join(" + ") || "keine Zeit", l ? `reicht noch ${l.days} Tage` : ""].filter(Boolean).join(" · "); },
    auto: it => { const l = L.supplyLeft(it, today()); if (!l) return []; const d = addDays(today(), Math.max(0, l.days - (+it.reorder || 14))); return [{ key: "nachbest:" + it.stockDate, date: d, t: `${it.name} nachbestellen${it.shop ? " (" + it.shop + ")" : ""}`, nerv: !!S.settings.nerv.supplements }]; },
    onSave: (it, isNew, old) => { if (isNew || !old || String(old.stock) !== String(it.stock)) it.stockDate = today(); },
    done: it => { const n = parseAmount(prompt(`Wie viele Stück ${it.name} sind neu dazugekommen?`) || ""); if (n) { const l = L.supplyLeft(it, today()); it.stock = (l ? l.left : 0) + n; it.stockDate = today(); toast("Vorrat aktualisiert"); } }
  },
  reise: {
    area: "frei", n: "Reise", ic: "✈️", d: "Daten, Buchung, Packliste, Check-in",
    fields: [
      { k: "name", l: "Wohin?", req: 1, ph: "z. B. Mallorca" }, { k: "art", l: "Art", t: "sel", o: OPT(["Urlaub", "Dienstreise", "Wochenende", "Familie besuchen"]) },
      { k: "von", l: "Von", t: "date", half: 1 }, { k: "bis", l: "Bis", t: "date", half: 1 },
      { k: "mit", l: "Anreise", t: "sel", o: OPT(["Flug", "Bahn", "Auto", "Bus", "Schiff"]), half: 1 }, { k: "abT", l: "Abfahrt / Abflug", t: "time", half: 1 },
      { k: "hotel", l: "Unterkunft" }, { k: "nr", l: "Buchungsnummer" }, { k: "note", l: "Notiz", t: "area" }
    ],
    sub: it => [it.von ? fmtD(it.von) + (it.bis ? " bis " + fmtD(it.bis) : "") : "", it.mit, it.pack ? `Packliste ${it.pack.filter(p => p.done).length}/${it.pack.length}` : ""].filter(Boolean).join(" · "),
    auto: it => {
      if (!it.von) return []; const o = [{ key: "pack", date: addDays(it.von, -3), t: `Packen für ${it.name} (Packliste in Reisen)` }];
      if (it.mit === "Flug") o.push({ key: "checkin", date: addDays(it.von, -1), t: `Online-Check-in für ${it.name}` });
      const pass = S.docs.find(d => /reisepass|personalausweis/i.test(d.name) && d.until);
      if (pass && pass.until < (it.bis || it.von)) o.push({ key: "pass", date: today(), t: `${pass.name} läuft vor der Reise nach ${it.name} ab (${fmtD(pass.until)})`, prio: 1 });
      return o;
    },
    onSave: (it, isNew) => { if (isNew) it.pack = PACK.map(t => ({ id: uid(), t, done: false })); }
  },
  ansprech: {
    area: "arbeit", n: "Ansprechpartner", ic: "👔", d: "Kollegen, Personalabteilung, Kunden",
    fields: [{ k: "name", l: "Name", req: 1 }, { k: "rolle", l: "Rolle / Abteilung" }, { k: "tel", l: "Telefon", t: "tel", half: 1 }, { k: "mail", l: "E-Mail", half: 1 }, { k: "note", l: "Notiz", t: "area" }],
    sub: it => [it.rolle, it.tel].filter(Boolean).join(" · "), auto: () => []
  },
  erstattung: {
    area: "arbeit", n: "Auslage zum Erstatten", ic: "🧾", d: "Reisekosten, Spesen: bis es zurück ist",
    fields: [{ k: "name", l: "Wofür?", req: 1, ph: "z. B. Hotel Hamburg" }, { k: "amount", l: "Betrag €", t: "money", half: 1 }, { k: "d", l: "Datum", t: "date", half: 1, def: () => today() }, { k: "status", l: "Stand", t: "sel", o: OPT(["offen", "eingereicht", "erstattet"]) }, { k: "note", l: "Notiz", t: "area" }],
    sub: it => [it.amount ? eur(+it.amount) : "", it.status || "offen", fmtD(it.d)].filter(Boolean).join(" · "),
    auto: it => it.status === "erstattet" ? [] : it.status === "eingereicht" ? [{ key: "zurueck", date: addDays(it.d || today(), 30), t: `Erstattung ${it.name} angekommen? (${eur(+it.amount || 0)})` }] : [{ key: "einreichen", date: addDays(it.d || today(), 3), t: `${it.name} zur Erstattung einreichen (${eur(+it.amount || 0)})` }],
    done: (it, t) => { it.status = t.rkey === "einreichen" ? "eingereicht" : "erstattet"; if (t.rkey === "einreichen") it.d = today(); }
  },
  verein: {
    area: "sport", n: "Verein / Kurs", ic: "🏅", d: "Training, Beitrag, Ansprechpartner",
    fields: [{ k: "name", l: "Name", req: 1, ph: "z. B. Kanu-Club" }, { k: "zeiten", l: "Trainingszeiten", ph: "z. B. Di + Do 19 Uhr" }, { k: "cost", l: "Beitrag €", t: "money", half: 1 }, { k: "interval", l: "Zahlweise", t: "sel", o: INTERVALS, half: 1, def: "jährlich" }, { k: "kontakt", l: "Ansprechpartner / Telefon" }, { k: "note", l: "Notiz", t: "area" }],
    sub: it => [it.zeiten, it.cost ? eur(+it.cost) + " " + (it.interval || "") : ""].filter(Boolean).join(" · "), monthly: it => L.monthly(it.cost, it.interval), auto: () => []
  },
  ausruestung: {
    area: "sport", n: "Ausrüstung", ic: "🛶", d: "Paddel, Rad, Sportsachen mit Garantie",
    fields: [{ k: "name", l: "Was?", req: 1 }, { k: "kauf", l: "Gekauft am", t: "date", half: 1 }, { k: "preis", l: "Preis €", t: "money", half: 1 }, { k: "garantie", l: "Garantie bis", t: "date" }, { k: "note", l: "Notiz", t: "area" }],
    sub: it => [it.kauf ? "gekauft " + fmtD(it.kauf) : "", it.garantie ? "Garantie bis " + fmtD(it.garantie) : ""].filter(Boolean).join(" · "),
    auto: it => it.garantie && it.garantie >= today() ? [{ key: "gar", date: addDays(it.garantie, -30), t: `Garantie ${it.name} endet am ${fmtD(it.garantie)}` }] : []
  }
};
const PACK = ["Ausweis / Reisepass", "Führerschein", "Krankenkassenkarte", "Ladekabel + Powerbank", "Kopfhörer", "Medikamente / Supplements", "Zahnbürste + Kulturbeutel", "Bargeld + Karte", "Unterhosen + Socken", "Schlafsachen", "Sonnenbrille", "Haustür: Fenster zu, Heizung runter"];
const kindTitle = (k, it) => (KINDS[k].title ? KINDS[k].title(it) : it.name) || KINDS[k].n;
const lastRead = it => (it.reads || []).slice().sort((a, b) => a.d < b.d ? 1 : -1)[0] || null;
function consumption(it) {
  const r = (it.reads || []).slice().sort((a, b) => a.d < b.d ? -1 : 1); if (r.length < 2) return "";
  const a = r[r.length - 2], b = r[r.length - 1], days = diffDays(a.d, b.d); if (days <= 0) return "";
  const pd = (b.v - a.v) / days;
  return `≈ ${Math.round(pd * 365).toLocaleString("de-DE")} ${KINDS.zaehler.unit(it)} im Jahr`;
}

/* ---------- Automatische Erinnerungen aus Einträgen ---------- */
const autoId = (it, key) => "au_" + it.id + "_" + key.replace(/[^\w-]/g, "");
function syncAuto(it) {
  const K = KINDS[it.kind]; if (!K) return;
  let want = []; try { want = (K.auto(it) || []).filter(r => r.date); } catch (e) { console.error(e); }
  const ids = new Set(want.map(r => autoId(it, r.key)));
  S.todos = S.todos.filter(t => !(t.ref === it.id && t.auto && !t.done && !ids.has(t.id)));
  for (const r of want) {
    const id = autoId(it, r.key), ex = S.todos.find(t => t.id === id);
    const data = { t: r.t, date: r.date, time: r.time || "", nerv: !!r.nerv, prio: r.prio || ex && ex.prio || "" };
    if (ex) { if (!ex.done) Object.assign(ex, data); continue; }
    S.todos.push(Object.assign({ id, ref: it.id, rkey: r.key, auto: 1, area: K.area, list: "todo", done: false, created: today(), trig: "zeit", rep: "nie" }, data));
  }
}
function syncAllAuto() { (S.items || []).forEach(syncAuto); S.todos = S.todos.filter(t => !t.ref || !t.auto || S.items.some(i => i.id === t.ref)); }
/* Abhaken einer automatischen Erinnerung: Eintrag weiterschreiben (z. B. Zahnreinigung „zuletzt“ = heute) */
const origToggle = toggleTodo;
toggleTodo = function (id) {
  const t = S.todos.find(x => x.id === id), wasDone = t && t.done;
  origToggle(id);
  if (t && !wasDone && t.done && t.ref) { const it = S.items.find(x => x.id === t.ref), K = it && KINDS[it.kind]; if (K && K.done) { K.done(it, t); syncAuto(it); save(); render(true); } }
};

/* ---------- Formular für Einträge ---------- */
function fieldHTML(f, v, it) {
  const id = "i-" + f.k, val = v == null ? "" : v, lab = `<label for="${id}">${esc(f.l)}</label>`;
  const inp = 'autocomplete="off"';
  if (f.t === "chk") return `<label class="tgl"><input type="checkbox" id="${id}"${val ? " checked" : ""}> ${esc(f.l)}</label>`;
  if (f.t === "sel") return `<div class="fld">${lab}<select id="${id}">${f.o.map(([o, l]) => `<option value="${esc(o)}"${String(o) === String(val) ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>`;
  if (f.t === "ref") { const list = S.items.filter(x => x.kind === f.ref); return `<div class="fld">${lab}<select id="${id}"><option value="">–</option>${list.map(x => `<option value="${x.id}"${x.id === val ? " selected" : ""}>${esc(kindTitle(x.kind, x))}</option>`).join("")}</select></div>`; }
  if (f.t === "area") return `<div class="fld">${lab}<textarea id="${id}" style="min-height:64px">${esc(val)}</textarea></div>`;
  const type = { date: "date", month: "month", time: "time", tel: "tel" }[f.t] || "text";
  const mode = f.t === "num" || f.t === "money" ? ' inputmode="decimal"' : f.t === "tel" ? ' inputmode="tel"' : "";
  return `<div class="fld">${lab}<input id="${id}" type="${type}"${mode} ${inp} value="${esc(f.t === "money" && val !== "" ? String(val).replace(".", ",") : val)}" placeholder="${esc(f.ph || "")}"></div>`;
}
function itemForm(kind, it, preset = {}) {
  const K = KINDS[kind]; if (!K) return;
  const v = it ? Object.assign({}, it) : Object.assign({}, preset);
  if (!it) K.fields.forEach(f => { if (v[f.k] == null && f.def != null) v[f.k] = typeof f.def === "function" ? f.def() : f.def; else if (v[f.k] == null && f.t === "sel" && f.o) v[f.k] = f.o[0][0]; });
  const fs = K.fields.filter(f => !(f.newOnly && it));
  let html = "", i = 0;
  while (i < fs.length) {
    const f = fs[i], hide = f.only && !f.only(v) ? " hidden" : "";
    if (f.third) { const g = []; while (i < fs.length && fs[i].third) g.push(fs[i++]); html += `<div class="fld"><label>Einnahme</label><div class="pick3">${g.map(x => `<label class="tgl box3"><input type="checkbox" id="i-${x.k}"${v[x.k] ? " checked" : ""}> ${esc(x.l)}</label>`).join("")}</div></div>`; continue; }
    if (f.half && fs[i + 1] && fs[i + 1].half) { const g = fs[i + 1], h2 = g.only && !g.only(v) ? " hidden" : ""; html += `<div class="fgrid"><div data-fk="${f.k}"${hide}>${fieldHTML(f, v[f.k], v)}</div><div data-fk="${g.k}"${h2}>${fieldHTML(g, v[g.k], v)}</div></div>`; i += 2; continue; }
    html += `<div data-fk="${f.k}"${hide}>${fieldHTML(f, v[f.k], v)}</div>`; i++;
  }
  openSheet(`<div data-draft="item:${kind}:${it ? it.id : "new"}"><p class="stitle">${K.ic} ${it ? esc(kindTitle(kind, it)) : "Neu: " + esc(K.n)}</p>${html}
    <div class="row2">${it ? `<button class="btn danger" data-act="delitem" data-id="${it.id}" style="flex:none">Löschen</button>` : ""}<button class="btn" data-act="cancel">Abbrechen</button><button class="btn pri" data-act="saveitem" data-k="${kind}" data-id="${it ? it.id : ""}">Speichern</button></div>
    <p class="swipehint">Mirella legt die passenden Erinnerungen automatisch an.</p></div>`, () => {
    const box = $("#sheetbody [data-draft]");
    const refresh = () => { const cur = readItem(kind); K.fields.forEach(f => { if (!f.only) return; const el = box.querySelector(`[data-fk="${f.k}"]`); if (el) el.hidden = !f.only(cur); }); };
    box.addEventListener("change", refresh); box.addEventListener("draftapplied", refresh);
  });
}
function readItem(kind) {
  const out = {};
  for (const f of KINDS[kind].fields) {
    const el = document.getElementById("i-" + f.k); if (!el) continue;
    out[f.k] = f.t === "chk" ? el.checked : f.t === "num" || f.t === "money" ? (el.value.trim() === "" ? "" : parseAmount(el.value)) : el.value.trim();
    if (f.t === "sel" && f.o && typeof f.o[0][0] === "number") out[f.k] = +out[f.k];
  }
  return out;
}
function saveItem(kind, id) {
  const K = KINDS[kind], data = readItem(kind);
  const miss = K.fields.find(f => f.req && !data[f.k]); if (miss) { toast(`Bitte „${miss.l}“ ausfüllen`); return; }
  let it = id && S.items.find(x => x.id === id); const old = it ? JSON.parse(JSON.stringify(it)) : null, isNew = !it;
  if (it) Object.assign(it, data); else { it = Object.assign({ id: uid(), kind, created: today() }, data); S.items.push(it); }
  if (K.onSave) K.onSave(it, isNew, old);
  syncAuto(it); draftClear(); save(); closeSheet(); area = K.area; view = "bereich"; render(true);
  const n = S.todos.filter(t => t.ref === it.id && t.auto && !t.done).length;
  toast(`Gespeichert: ${kindTitle(kind, it)}${n ? ` · ${n} Erinnerung${n > 1 ? "en" : ""} angelegt` : ""}`);
}

/* ---------- Plus: erst Auswahl, dann Formular ---------- */
const PLUS = {
  heute: [["todo", "✓", "Aufgabe", "mit Datum, Priorität, Nerv-Modus"], ["shop", "🛒", "Einkaufsliste", "Artikel mit Menge"], ["person", "👤", "Kontakt", "mit Anruf-Rhythmus und Geburtstag"], ["wecker", "⏰", "Wecker", "nach Ankunftszeit und Verkehr"], ["exp", "€", "Ausgabe", "Betrag und Kategorie"], ["brief", "✉️", "Brief oder Dokument ablegen", "fotografieren, Mirella sortiert ein"]],
  kalender: [["todoD", "📅", "Termin oder Erinnerung", "an diesem Tag"], ["person", "🎂", "Geburtstag", "als Kontakt anlegen"], ["wecker", "⏰", "Wecker", "nach Ankunftszeit und Verkehr"]],
  wecker: [["wecker", "⏰", "Neuer Wecker", "Ziel und Ankunft eingeben, Mirella rechnet"], ["rem", "🔔", "Erinnerung", "zu einer Uhrzeit"]],
  geld: [["beleg", "📷", "Beleg fotografieren", "Betrag und Kategorie eintragen"], ["exp", "€", "Ausgabe eintippen", "ohne Foto"], ["k:vertrag", "📄", "Fester Vertrag / Abo", "läuft als Fixkosten mit"], ["goal", "🎯", "Sparziel", "z. B. Urlaub, Notgroschen"], ["setgeld", "⚙", "Einkommen, Kategorien, Budgets", "in den Einstellungen"], ["rem", "🔔", "Erinnerung", "z. B. Überweisung"]],
  vertrag: [["k:vertrag", "📄", "Vertrag", "Strom, Gas, Handy, Internet, Fitness, Abo"], ["k:versicherung", "🛡️", "Versicherung", "Haftpflicht, Hausrat, Kranken …"], ["brief", "✉️", "Brief ablegen", "z. B. Preiserhöhung, Kündigungsbestätigung"], ["rem", "🔔", "Erinnerung", "z. B. Tarif vergleichen"]],
  gesund: [["krank", "🤒", "Ich bin krank", "Anrufe pausieren, Arbeitgeber und Arzt"], ["k:arzt", "🩺", "Arzt / Ansprechpartner", "Telefon, Adresse, Online-Termin"], ["k:vorsorge", "🦷", "Wiederkehrender Termin", "z. B. Zahnreinigung alle 6 Monate"], ["k:supplement", "💊", "Supplement", "Einnahmezeiten und Nachbestellen"], ["remT", "📅", "Einzelner Arzttermin", "Datum und Uhrzeit"], ["brief", "📄", "Befund oder Rezept ablegen", "fotografieren"], ["note", "✎", "Notiz", ""]],
  haus: [["k:zaehler", "🔌", "Zähler", "ablesen mit Wiederholung"], ["k:wohnung", "🏠", "Wohnung & Vermieter", "Miete, Nebenkosten, Kontakt"], ["k:geraet", "🧺", "Gerät", "Garantie und Wartung"], ["remR", "🔁", "Wiederkehrende Aufgabe", "z. B. Rauchmelder testen, jährlich"], ["brief", "✉️", "Brief ablegen", "z. B. Nebenkostenabrechnung"], ["note", "✎", "Notiz", ""]],
  auto: [["k:fahrzeug", "🚗", "Fahrzeug anlegen", "Auto oder E-Bike, TÜV, Inspektion, Reifen"], ["tank", "⛽", "Tanken / Kosten", "als Ausgabe"], ["remT", "🔧", "Werkstatt-Termin", "Datum und Uhrzeit"], ["brief", "📄", "Brief / Rechnung ablegen", "Werkstatt, Bußgeld, Zulassung"], ["note", "✎", "Notiz", "z. B. km-Stand"]],
  arbeit: [["k:ansprech", "👔", "Ansprechpartner", ""], ["k:erstattung", "🧾", "Auslage zum Erstatten", "Mirella erinnert, bis das Geld da ist"], ["remT", "📅", "Termin", ""], ["brief", "📄", "Lohnabrechnung / Brief", "fotografieren und ablegen"], ["note", "✎", "Notiz", ""]],
  sport: [["k:verein", "🏅", "Verein / Kurs", "Training und Beitrag"], ["k:ausruestung", "🛶", "Ausrüstung", "mit Garantie"], ["remR", "🔁", "Wiederkehrender Termin", "z. B. Training jede Woche"], ["note", "✎", "Notiz", ""]],
  doku: [["brief", "📷", "Brief / Dokument fotografieren", "Scan zuschneiden, Mirella sortiert ein"], ["lib", "🖼", "Aus „Fotos“ wählen", ""], ["pdf", "📎", "PDF oder Datei ablegen", "aus der Dateien-App"]],
  frei: [["k:reise", "✈️", "Reise", "Packliste, Check-in, Pass-Prüfung"], ["brief", "📄", "Buchung / Ticket ablegen", ""], ["note", "✎", "Notiz", ""]]
};
function plusMenu(key) {
  const list = PLUS[key] || [["rem", "🔔", "Erinnerung", ""], ["note", "✎", "Notiz", ""]];
  const A = areaById(key);
  openSheet(`<p class="stitle">${A ? esc(A.n) + ": was möchtest du anlegen?" : "Was möchtest du anlegen?"}</p><div class="plist">${list.map(([k, ic, n, d]) => `<button class="prow" data-act="plus" data-k="${k}" data-a="${esc(key)}"><span class="pic">${ic}</span><span><b>${esc(n)}</b>${d ? `<small>${esc(d)}</small>` : ""}</span><span class="chev">›</span></button>`).join("")}</div>`);
}
function plusDo(k, key) {
  const ar = areaById(key) ? key : "";
  if (k.startsWith("k:")) return itemForm(k.slice(2), null);
  ({
    todo: () => todoForm(null), todoD: () => todoForm(null, { date: selDate }),
    rem: () => todoForm(null, { area: ar, date: today() }), remT: () => todoForm(null, { area: ar, date: today(), time: "09:00" }), remR: () => todoForm(null, { area: ar, date: today(), rep: "jährlich" }),
    shop: () => { closeSheet(); todoList = "einkauf"; view = "todos"; render(); setTimeout(() => { const i = $("#shopin"); i && i.focus(); }, 50); },
    person: () => { if (view !== "menschen") { view = "menschen"; render(); } personForm(null); },
    wecker: () => typeof weckerForm === "function" ? weckerForm(null) : toast("Wecker nicht geladen"),
    krank: () => sickForm(), goal: () => goalForm(null),
    exp: () => expenseForm(), tank: () => expenseForm({ cat: "Tanken & Auto" }),
    beleg: () => photoStart("beleg", "geld"), brief: () => photoStart("dokument", ar || null), lib: () => { photoCtx = { kind: "dokument", area: null }; closeSheet(); ACT.picklib(); },
    pdf: () => { closeSheet(); const f = $("#f-doc"); f.value = ""; f.click(); },
    note: () => { closeSheet(); setTimeout(() => { const i = document.querySelector('[data-form="note"] input'); i && i.focus(); }, 50); },
    setgeld: () => { setFrom = { v: view, area, cur, t: "Finanzen" }; setSec = "geld"; view = "einstellungen"; closeAll(); render(); }
  }[k] || (() => toast("Kommt noch")))();
}

/* ---------- Seite einer Rubrik ---------- */
const AREA_VIEW = {};
let finM = today().slice(0, 7), finCat = "";
R.bereich = function () {
  const A = areaById(area); if (!A) { view = "heute"; return R.heute(); }
  const head = `${subtop("Alle Bereiche", "drawer", `<button class="iconbtn camtop" data-act="photo" data-area="${A.id}" aria-label="Foto oder Brief an Mirella">${IC.cam}</button>`)}
    <button class="ahero tsetbtn" data-act="tabset" data-k="${A.id}" data-t="${esc(A.n)}" aria-label="Einstellungen ${esc(A.n)}" style="--ac:${A.c || "var(--ink)"}"><span class="av">${IC[A.ic]}</span><span style="min-width:0;flex:1"><p class="big" style="margin:0;font-size:24px">${esc(A.n)}</p><span class="s" style="display:block">${esc(areaSummary(A.id))}</span></span><span class="setcue" aria-hidden="true">⚙</span></button>`;
  if (AREA_VIEW[A.id]) return head + AREA_VIEW[A.id]();
  const todos = S.todos.filter(t => t.area === A.id && t.list === "todo" && !t.done).sort((a, b) => (a.date || "9999") < (b.date || "9999") ? -1 : 1).sort(byPrio);
  const notes = S.notes.filter(n => n.area === A.id).sort((a, b) => a.d < b.d ? 1 : -1);
  const docs = S.docs.filter(d => d.area === A.id);
  let h = head;
  if (A.id === "geld") h += financeHTML();
  if (A.id === "doku") h += docsHTML();
  if (A.id === "gesund") h += suppToday(true);
  h += `<div class="sec"><span class="label">Steht an</span><span class="label">${todos.length || ""}</span></div>${todos.length ? todos.slice(0, 8).map(todoRow).join("") + (todos.length > 8 ? `<p class="swipehint">und ${todos.length - 8} weitere im Kalender</p>` : "") : '<div class="swipehint" style="text-align:left">Nichts offen. Mirella meldet sich, wenn etwas fällig wird.</div>'}`;
  const kinds = Object.keys(KINDS).filter(k => KINDS[k].area === A.id);
  for (const k of kinds) {
    const K = KINDS[k], list = S.items.filter(x => x.kind === k).sort((a, b) => kindTitle(k, a).localeCompare(kindTitle(k, b), "de"));
    h += `<div class="sec"><span class="label">${esc(K.n === "Vertrag" ? "Verträge" : K.n === "Versicherung" ? "Versicherungen" : K.n)}</span><button class="mini" data-act="newitem" data-k="${k}">+ ${esc(K.n)}</button></div>`;
    h += list.length ? list.map(itemCard).join("") : `<div class="swipehint" style="text-align:left">${esc(K.d)}</div>`;
    if (k === "vertrag" || k === "versicherung") { const sum = list.reduce((a, x) => a + (K.monthly ? K.monthly(x) : 0), 0); if (sum) h += `<div class="catrow" style="margin:4px 2px 0"><span>zusammen im Monat</span><b>${eur(sum)}</b></div>`; }
  }
  h += `<div class="sec"><span class="label">Notizen und Verlauf</span><span class="label">${notes.length || ""}</span></div>
    <form class="shoprow" data-form="note" style="margin-bottom:6px"><input class="search" style="margin:0" placeholder="${esc(notePh(A.id))}" aria-label="Notiz hinzufügen"><button class="btn pri" style="flex:none">+</button></form>
    ${notes.map(n => `<div class="listrow"><span class="grow">${esc(n.t)}<small>${esc(fmtDate(n.d))}</small></span><button class="rowdel" data-act="delnote" data-id="${n.id}" aria-label="löschen">✕</button></div>`).join("")}`;
  if (A.id !== "doku") h += `<div class="sec"><span class="label">Briefe und Dokumente</span><span class="label">${docs.length || ""}</span></div>${docs.length ? docs.sort((a, b) => (b.created || "").localeCompare(a.created || "")).map(docRow).join("") : '<div class="swipehint" style="text-align:left">Noch nichts abgelegt. Oben auf die Kamera oder auf +.</div>'}`;
  return h;
};
function itemCard(it) {
  const K = KINDS[it.kind]; let sub = ""; try { sub = K.sub ? K.sub(it) : ""; } catch (_) { }
  const st = (it.kind === "vertrag" || it.kind === "versicherung") ? L.contractStatus(it, today()) : null;
  const warn = st && st.deadline && st.days <= lead(it);
  return `<div class="card${warn ? " due" : ""}" role="button" tabindex="0" data-act="openitem" data-id="${it.id}"><span class="av">${K.ic}</span><span style="min-width:0"><div class="t">${esc(kindTitle(it.kind, it))}</div><div class="s">${esc(sub)}</div></span>${warn ? `<span class="pill late">Frist ${st.days} T.</span>` : '<span class="chev">›</span>'}</div>`;
}
function areaSummary(id) {
  const items = S.items.filter(x => KINDS[x.kind] && KINDS[x.kind].area === id), open = S.todos.filter(t => t.area === id && !t.done && t.list === "todo").length;
  const parts = [];
  if (id === "geld") { const m = monthSum(today().slice(0, 7)); parts.push(eur(m) + " ausgegeben diesen Monat"); }
  else if (id === "vertrag") { const f = fixCosts(); parts.push(`${items.length} ${items.length === 1 ? "Eintrag" : "Einträge"} · ${eur(f.total)} Fixkosten im Monat`); }
  else if (id === "doku") parts.push(`${S.docs.length} Dokumente`);
  else if (items.length) parts.push(items.length + (items.length === 1 ? " Eintrag" : " Einträge"));
  if (open) parts.push(open + " offen");
  return parts.join(" · ") || "Tipp auf + zum Anlegen";
}
/* Detailansicht eines Eintrags */
function itemDetail(it) {
  const K = KINDS[it.kind]; let extra = "";
  if (it.kind === "zaehler") {
    const r = (it.reads || []).slice().sort((a, b) => a.d < b.d ? 1 : -1);
    extra = `<div class="block"><div class="bh"><h4>Zählerstände</h4><button class="mini" data-act="addread" data-id="${it.id}">+ Stand</button></div>${r.length ? r.map(x => `<div class="listrow"><span class="grow">${(+x.v).toLocaleString("de-DE")} ${KINDS.zaehler.unit(it)}<small>${fmtD(x.d)}</small></span><button class="rowdel" data-act="delread" data-id="${it.id}" data-d="${x.d}" data-v="${x.v}" aria-label="löschen">✕</button></div>`).join("") : '<div class="swipehint" style="text-align:left">Noch kein Stand.</div>'}${consumption(it) ? `<p class="hint">${consumption(it)} (aus den letzten zwei Ständen)</p>` : ""}</div>`;
  }
  if (it.kind === "reise") {
    extra = `<div class="block"><div class="bh"><h4>Packliste</h4><span class="label">${(it.pack || []).filter(p => p.done).length}/${(it.pack || []).length}</span></div>${(it.pack || []).map(p => `<label class="chk${p.done ? " done" : ""}"><input type="checkbox" data-act="packtog" data-id="${it.id}" data-p="${p.id}"${p.done ? " checked" : ""}><span>${esc(p.t)}</span></label>`).join("")}<form class="shoprow" data-form="pack" data-id="${it.id}" style="margin-top:8px"><input class="search" style="margin:0" placeholder="Noch etwas einpacken …" aria-label="Packliste ergänzen"><button class="btn pri" style="flex:none">+</button></form></div>`;
  }
  if (it.kind === "supplement") { const l = L.supplyLeft(it, today()); extra = `<div class="block"><h4>Vorrat</h4>${l ? `<div class="catrow"><span>noch ${Math.round(l.left)} Stück</span><b>reicht ${l.days} Tage</b></div>` : '<p class="hint">Vorrat eintragen, dann erinnert Mirella rechtzeitig ans Nachbestellen.</p>'}<div class="set" style="margin-top:8px"><span>Nachbestellen erinnern<small>wenn es noch so viele Tage reicht</small></span><span style="display:flex;align-items:center;gap:6px"><button class="iconbtn" data-act="reord" data-id="${it.id}" data-n="-1" aria-label="weniger">−</button><b style="min-width:58px;text-align:center">${+it.reorder || 14} Tage</b><button class="iconbtn" data-act="reord" data-id="${it.id}" data-n="1" aria-label="mehr">+</button></span></div><button class="btn" data-act="restock" data-id="${it.id}" style="width:100%;margin-top:8px">Nachgekauft: Vorrat auffüllen</button></div>`; }
  const tel = it.tel || it.hotline || it.shopTel;
  const acts = [tel ? `<a class="mini" href="tel:${esc(tel.replace(/[^\d+]/g, ""))}" style="text-decoration:none">📞 Anrufen</a>` : "", it.web ? `<a class="mini" href="${esc(/^https?:/.test(it.web) ? it.web : "https://" + it.web)}" target="_blank" rel="noopener" style="text-decoration:none">Website</a>` : "", it.addr ? `<a class="mini" href="https://maps.apple.com/?q=${encodeURIComponent(it.addr)}" style="text-decoration:none">Karte</a>` : "", it.mail ? `<a class="mini" href="mailto:${esc(it.mail)}" style="text-decoration:none">E-Mail</a>` : ""].join("");
  const todos = S.todos.filter(t => t.ref === it.id && !t.done).sort((a, b) => (a.date || "") < (b.date || "") ? -1 : 1);
  const docs = S.docs.filter(d => d.ref === it.id);
  const rows = K.fields.filter(f => !["note"].includes(f.k) && it[f.k] !== "" && it[f.k] != null && it[f.k] !== false && !(f.only && !f.only(it)) && f.t !== "chk" && f.k !== "name").map(f => {
    let v = it[f.k]; if (f.t === "date") v = fmtD(v); if (f.t === "month") v = v.split("-").reverse().join("/"); if (f.t === "money") v = eur(+v); if (f.t === "sel") v = (f.o.find(o => String(o[0]) === String(v)) || [0, v])[1]; if (f.t === "ref") { const x = S.items.find(y => y.id === v); v = x ? kindTitle(x.kind, x) : ""; }
    return v ? `<dt>${esc(f.l)}</dt><dd>${esc(v)}</dd>` : "";
  }).join("");
  const st = (it.kind === "vertrag" || it.kind === "versicherung") ? L.contractStatus(it, today()) : null;
  openSheet(`<p class="stitle">${K.ic} ${esc(kindTitle(it.kind, it))}</p>
    ${st ? `<div class="nextcall${st.deadline && st.days <= lead(it) ? " late" : ""}"><div><div class="label">Kündigung</div><b style="font-size:19px">${esc(st.deadline ? "bis " + fmtD(st.deadline) : "flexibel")}</b><small>${esc(st.text)}</small></div>${K.monthly ? `<div class="nc-r"><div class="label">im Monat</div><b style="font-size:19px">${eur(K.monthly(it))}</b></div>` : ""}</div>` : ""}
    ${acts ? `<div class="callrow" style="justify-content:flex-start;margin:0 0 10px">${acts}</div>` : ""}
    ${rows ? `<dl class="kv block">${rows}</dl>` : ""}${it.note ? `<p class="hint">${esc(it.note)}</p>` : ""}
    ${extra}
    <div class="block"><h4>Erinnerungen</h4>${todos.length ? todos.map(t => `<div class="listrow"><span class="grow">${esc(t.t)}<small>${esc(relDate(t.date))}${t.time ? " · " + t.time : ""}</small></span></div>`).join("") : '<div class="swipehint" style="text-align:left;margin:0">Gerade keine. Mirella legt sie an, sobald Daten fehlen oder Fristen nahen.</div>'}</div>
    <div class="block"><div class="bh"><h4>${it.kind === "versicherung" ? "Police &amp; Unterlagen" : it.kind === "vertrag" ? "Vertrag &amp; Unterlagen" : "Dokumente"}</h4><span class="label">${docs.length || ""}</span></div>${docs.length ? docs.map(docRow).join("") : `<div class="swipehint" style="text-align:left;margin:0">${it.kind === "vertrag" || it.kind === "versicherung" ? "Leg hier das PDF oder ein Foto vom Vertrag ab, dann hast du es immer mit dem Eintrag zusammen." : "Noch nichts abgelegt."}</div>`}
    <div class="row2" style="margin-top:8px"><button class="btn" data-act="pdffor" data-id="${it.id}">📄 PDF hochladen</button><button class="btn" data-act="docfor" data-id="${it.id}">📷 Foto / Scan</button></div></div>
    <div class="row2"><button class="btn pri" data-act="edititem" data-id="${it.id}" style="width:100%">Bearbeiten</button></div>`);
  loadThumbs();
}

/* ---------- Finanzen ---------- */
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const OTHER = "#8C8C93";
function catColor(c) {
  const m = S.settings.catColor = S.settings.catColor || {};
  if (m[c] == null) { const used = Object.values(m); if (used.length < SERIES.length) m[c] = used.length; else return OTHER; }
  return SERIES[m[c]] || OTHER;
}
const monthSum = ym => S.expenses.filter(e => e.d.startsWith(ym)).reduce((a, e) => a + +e.amount, 0);
function fixCosts() {
  const list = S.items.filter(x => KINDS[x.kind] && KINDS[x.kind].monthly).map(x => ({ it: x, m: KINDS[x.kind].monthly(x) })).filter(x => x.m > 0).sort((a, b) => b.m - a.m);
  return { list, total: list.reduce((a, x) => a + x.m, 0) };
}
function donut(parts, total) {
  const R0 = 52, w = 16, C = 2 * Math.PI * R0; let off = 0;
  const segs = parts.map(p => { const len = Math.max(0, p.v / total * C - 2); const s2 = `<circle r="${R0}" cx="70" cy="70" fill="none" stroke="${p.col}" stroke-width="${w}" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"><title>${esc(p.c)}: ${eur(p.v)} (${Math.round(p.v / total * 100)} %)</title></circle>`; off += p.v / total * C; return s2; }).join("");
  return `<svg viewBox="0 0 140 140" width="120" height="120" role="img" aria-label="Ausgaben nach Kategorie">${segs}<text x="70" y="66" text-anchor="middle" font-size="11" fill="var(--ink-2)">ausgegeben</text><text x="70" y="84" text-anchor="middle" font-size="15" font-weight="600" fill="var(--ink)">${esc(eur(total).replace(",00", ""))}</text></svg>`;
}
function financeHTML() {
  const ym = finM, [y, m] = ym.split("-").map(Number), label = `${MN[m - 1]} ${y}`;
  const month = S.expenses.filter(e => e.d.startsWith(ym)), sum = month.reduce((a, e) => a + +e.amount, 0);
  const cats = {}; month.forEach(e => cats[e.cat] = (cats[e.cat] || 0) + +e.amount);
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, v]) => ({ c, v, col: catColor(c) }));
  let parts = sorted; if (parts.length > 8) { const rest = parts.slice(7).reduce((a, x) => a + x.v, 0); parts = parts.slice(0, 7).concat([{ c: "Weitere", v: rest, col: OTHER }]); }
  const fix = fixCosts(), inc = +S.settings.income || 0, left = inc - fix.total - sum;
  // Entwicklung: 6 Monate bis zum gewählten
  const hist = []; for (let i = 5; i >= 0; i--) { const k = addMonths(ym + "-15", -i).slice(0, 7); hist.push({ k, v: monthSum(k) }); }
  const prev = hist.slice(0, 5).filter(h => h.v > 0), avg = prev.length ? prev.reduce((a, h) => a + h.v, 0) / prev.length : 0;
  const maxH = Math.max(1, ...hist.map(h => h.v));
  const tips = [];
  const isCur = ym === today().slice(0, 7), proj = isCur && sum ? sum / +today().slice(8, 10) * new Date(y, m, 0).getDate() : sum;
  if (avg && sum && (!isCur || +today().slice(8, 10) >= 7)) { const d = Math.round((proj - avg) / avg * 100); tips.push((isCur ? "Hochgerechnet " : "") + (d > 10 ? `${d} % mehr als im Schnitt der letzten Monate (${eur(avg)}).` : d < -10 ? `${-d} % weniger als im Schnitt (${eur(avg)}). Gut so.` : `etwa wie im Schnitt (${eur(avg)}).`)); }
  if (avg && sorted[0]) { const catAvg = c => { const ks = hist.slice(0, 5).map(h => h.k); const vs = ks.map(k => S.expenses.filter(e => e.d.startsWith(k) && e.cat === c).reduce((a, e) => a + +e.amount, 0)); const n = prev.length || 1; return vs.reduce((a, b) => a + b, 0) / n; }; const jump = sorted.map(s2 => ({ c: s2.c, d: s2.v - catAvg(s2.c) })).sort((a, b) => b.d - a.d)[0]; if (jump && jump.d > 20) tips.push(`Am meisten mehr bei ${jump.c}: +${eur(jump.d)}.`); }
  const bud = S.settings.budgets || {}, over = sorted.filter(s2 => +bud[s2.c] && s2.v > +bud[s2.c]);
  over.forEach(o => tips.push(`Budget ${o.c} überschritten: ${eur(o.v)} von ${eur(+bud[o.c])}.`));
  if (isCur && sum) tips.push(`Bis Monatsende etwa ${eur(proj)}.`);
  const list = (finCat ? month.filter(e => e.cat === finCat) : month).slice().sort((a, b) => a.d < b.d ? 1 : -1);
  return `<div class="mnav" style="margin-top:0"><button class="iconbtn" data-act="finm" data-n="-1" aria-label="Vormonat">‹</button><b style="font-family:var(--f-display);font-size:20px">${label}</b><button class="iconbtn" data-act="finm" data-n="1" aria-label="Nächster Monat">›</button></div>
  <div class="tiles4">
    <div class="tile"><small>Einnahmen</small><b>${inc ? eur(inc) : '<button class="mini" data-act="setgo" data-k="geld">eintragen</button>'}</b></div>
    <div class="tile"><small>Fixkosten</small><b>${eur(fix.total)}</b></div>
    <div class="tile"><small>Ausgaben</small><b>${eur(sum)}</b></div>
    <div class="tile${inc && left < 0 ? " late" : ""}"><small>Übrig</small><b>${inc ? eur(left) : "–"}</b></div>
  </div>
  ${tips.length ? `<div class="hint"><b>Mirella sagt:</b> ${esc(tips.join(" "))}</div>` : ""}
  <div class="block"><h4>Wofür im ${MN[m - 1]}</h4>${sum ? `<div class="donutrow">${donut(parts, sum)}<div class="legend">${parts.map(p => `<button class="lg" data-act="fincat" data-c="${esc(p.c === "Weitere" ? "" : p.c)}" aria-pressed="${finCat === p.c}"><i style="background:${p.col}"></i><span>${esc(p.c)}</span><b>${Math.round(p.v / sum * 100)} %</b></button>`).join("")}</div></div>
    ${sorted.map(s2 => { const b = +bud[s2.c]; return `<div class="catrow" style="margin-top:8px"><span><i class="pdot" style="background:${s2.col}"></i> ${esc(s2.c)}</span><span>${eur(s2.v)}${b ? " / " + eur(b) : ""}</span></div><div class="bar"><i style="width:${Math.min(100, Math.round(s2.v / (b || sorted[0].v) * 100))}%;background:${b && s2.v > b ? "var(--late)" : s2.col}"></i></div>`; }).join("")}` : '<div class="swipehint" style="text-align:left;margin:0">Noch keine Ausgaben in diesem Monat. Beleg fotografieren oder per Sprache: „35 Euro beim REWE ausgegeben“.</div>'}</div>
  <div class="block"><div class="bh"><h4>Entwicklung</h4><span class="label">6 Monate</span></div><div class="hbars">${hist.map(h => `<div class="hb" title="${MN[+h.k.slice(5) - 1]}: ${eur(h.v)}"><span class="hv">${h.v ? Math.round(h.v) : ""}</span><i style="height:${Math.max(2, Math.round(h.v / maxH * 90))}px"${h.k === ym ? ' class="cur"' : ""}></i><small>${MN[+h.k.slice(5) - 1].slice(0, 3)}</small></div>`).join("")}</div>${avg ? `<p class="swipehint" style="text-align:left">Schnitt der Vormonate: ${eur(avg)}</p>` : ""}</div>
  ${fix.list.length ? `<div class="block"><div class="bh"><h4>Fixkosten im Monat</h4><b>${eur(fix.total)}</b></div>${fix.list.map(x => `<div class="listrow" role="button" data-act="openitem" data-id="${x.it.id}" style="cursor:pointer"><span class="grow">${esc(kindTitle(x.it.kind, x.it))}<small>${esc(x.it.art || KINDS[x.it.kind].n)}</small></span><span>${eur(x.m)}</span></div>`).join("")}<p class="swipehint" style="text-align:left">Im Jahr: ${eur(fix.total * 12)}</p></div>` : `<p class="hint">Trag deine Verträge unter „Verträge & Versicherungen“ ein, dann rechnet Mirella die Fixkosten automatisch mit.</p>`}
  ${goalsHTML(left)}
  <div class="row2" style="margin:0 0 6px"><button class="btn pri" data-act="photo" data-kind="beleg">📷 Beleg fotografieren</button><button class="btn" data-act="newexp">+ Ausgabe</button></div>
  ${list.length ? `<div class="sec"><span class="label">${finCat ? esc(finCat) : "Ausgaben im " + MN[m - 1]}</span>${finCat ? `<button class="mini" data-act="fincat" data-c="">alle zeigen</button>` : `<span class="label">${list.length}</span>`}</div>${list.map(e => `<div class="listrow">${e.photo ? `<button data-act="viewphoto" data-id="${e.photo}" style="border:0;padding:0;background:none" aria-label="Beleg ansehen"><img class="thumbimg" data-thumb="${e.photo}" alt=""></button>` : ""}<span class="grow">${esc(e.shop || e.cat)}<small>${esc(fmtDate(e.d))} · ${esc(e.cat)}</small></span><b style="font-weight:600">${eur(e.amount)}</b><button class="rowdel" data-act="delexp" data-id="${e.id}" aria-label="löschen">✕</button></div>`).join("")}` : ""}`;
}

/* ---------- Sparziele ---------- */
function goalsHTML(left) {
  const gs = S.goals || [];
  const rows = gs.map(g => {
    const pct = g.target ? Math.min(100, Math.round(g.saved / g.target * 100)) : 0, rest = Math.max(0, g.target - g.saved);
    let per = "";
    if (g.until && rest) { const [y, m] = g.until.split("-").map(Number), [ty, tm] = today().slice(0, 7).split("-").map(Number); const mo = Math.max(1, (y - ty) * 12 + (m - tm)); per = ` · ${eur(rest / mo)} pro Monat bis ${MN[m - 1]} ${y}`; }
    return `<div class="catrow" style="margin-top:8px"><span>${esc(g.n)}</span><span>${eur(g.saved)} / ${eur(g.target)}</span></div><div class="bar"><i style="width:${pct}%;background:${pct >= 100 ? "var(--ok, #2E8B4E)" : "var(--ink)"}"></i></div><div class="goalrow"><small>${pct >= 100 ? "Geschafft! 🎉" : `noch ${eur(rest)}${per}`}</small><button class="mini" data-act="goaladd" data-id="${g.id}">+ Einzahlen</button><button class="mini" data-act="goaledit" data-id="${g.id}">Ändern</button></div>`;
  }).join("");
  const need = gs.filter(g => g.until && g.target > g.saved).reduce((a, g) => { const [y, m] = g.until.split("-").map(Number), [ty, tm] = today().slice(0, 7).split("-").map(Number); return a + (g.target - g.saved) / Math.max(1, (y - ty) * 12 + (m - tm)); }, 0);
  const tip = need && +S.settings.income ? `<p class="goaltip">Für alle Ziele brauchst du etwa ${eur(need)} im Monat${left > 0 ? `, übrig sind diesen Monat ${eur(left)}` : ""}.</p>` : "";
  return `<div class="block"><div class="bh"><h4>Sparziele</h4><button class="mini" data-act="goalnew">+ Ziel</button></div>${rows || '<div class="swipehint" style="text-align:left;margin:0">Noch kein Sparziel. Zum Beispiel Urlaub, neues E-Bike oder ein Notgroschen von drei Monatsgehältern.</div>'}${tip}</div>`;
}
function goalForm(g) {
  const v = g || { n: "", target: "", saved: 0, until: "" };
  openSheet(`<p class="stitle">${g ? "Sparziel ändern" : "Neues Sparziel"}</p>
  <div class="fld"><label for="g-n">Wofür?</label><input id="g-n" value="${esc(v.n)}" placeholder="z. B. Skiurlaub"></div>
  <div class="fgrid"><div class="fld"><label for="g-t">Ziel in €</label><input id="g-t" inputmode="decimal" value="${v.target ? String(v.target).replace(".", ",") : ""}" placeholder="0"></div><div class="fld"><label for="g-s">Schon gespart</label><input id="g-s" inputmode="decimal" value="${v.saved ? String(v.saved).replace(".", ",") : ""}" placeholder="0"></div></div>
  <div class="fld"><label for="g-u">Bis wann? (freiwillig)</label><input id="g-u" type="month" value="${esc(v.until || "")}"></div>
  <div class="row2">${g ? `<button class="btn danger" data-act="goaldel" data-id="${g.id}" style="flex:none">Löschen</button>` : ""}<button class="btn" data-act="cancel">Abbrechen</button><button class="btn pri" data-act="goalsave" data-id="${g ? g.id : ""}">Speichern</button></div>`);
}

/* ---------- Dokumente: nach Bereich und Art geordnet ---------- */
function docsHTML() {
  const by = {}; S.docs.forEach(d => { const a = d.area && areaById(d.area) ? d.area : "doku"; (by[a] = by[a] || []).push(d); });
  const keys = AREAS.map(a => a.id).filter(k => by[k]);
  const soon = S.docs.filter(d => d.until && diffDays(today(), d.until) <= 60).sort((a, b) => a.until < b.until ? -1 : 1);
  return `${soon.length ? `<div class="sec"><span class="label">Läuft bald ab</span></div>${soon.map(docRow).join("")}` : ""}
  <div class="sec sethead"><span class="label">Deine Ablage</span><span class="label">${S.docs.length}</span></div>${keys.length ? keys.map(k => { const A = areaById(k), types = {}; by[k].forEach(d => (types[d.folder || "Sonstiges"] = types[d.folder || "Sonstiges"] || []).push(d)); return `<details class="fold"${keys.length < 3 ? " open" : ""}><summary class="foldh">${IC[A.ic].replace("<svg", '<svg width="20" height="20"')} ${esc(k === "doku" ? "Allgemein" : A.n)}<span class="n">${by[k].length}</span></summary><div style="padding:0 14px 8px">${Object.entries(types).map(([t, l]) => `<div class="label" style="margin:10px 0 2px">${esc(t)}</div>${l.sort((a, b) => (b.created || "").localeCompare(a.created || "")).map(docRow).join("")}`).join("")}</div></details>`; }).join("") : empty("Noch keine Dokumente. Auf + tippen und einen Brief fotografieren: Mirella schneidet ihn zu, liest ihn und legt ihn in den richtigen Ordner.")}`;
}

/* ---------- Supplements heute ---------- */
const suppSlot = () => { const h = new Date().getHours(); return h < 11 ? "morgens" : h < 16 ? "mittags" : "abends"; };
function suppToday(all) {
  const sup = S.items.filter(x => x.kind === "supplement"); if (!sup.length) return "";
  S.suppLog = S.suppLog || {};
  const slots = all ? ["morgens", "mittags", "abends"] : [suppSlot()];
  const rows = slots.flatMap(sl => sup.filter(x => x[sl]).map(x => ({ x, sl, k: today() + "|" + sl + "|" + x.id })));
  if (!rows.length) return "";
  if (!all && rows.every(r => S.suppLog[r.k])) return "";
  return `<div class="sec"><span class="label">Supplements ${all ? "heute" : suppSlot()}</span><span class="label">${rows.filter(r => S.suppLog[r.k]).length}/${rows.length}</span></div><div class="morning">${rows.map(r => `<label class="chk${S.suppLog[r.k] ? " done" : ""}"><input type="checkbox" data-act="supp" data-k="${r.k}"${S.suppLog[r.k] ? " checked" : ""}><span>${esc(r.x.name)}${r.x.dose > 1 ? ` (${r.x.dose} Stück)` : ""}${all ? ` <small style="color:var(--ink-3)">${r.sl}</small>` : ""}</span></label>`).join("")}</div>`;
}

/* Supplements als Tages-To-dos: morgens Hoch, mittags Mittel, abends Niedrig; je näher (und später) die Zeit, desto höher */
function suppTodos() {
  const sup = S.items.filter(x => x.kind === "supplement"); if (!sup.length) return [];
  S.suppLog = S.suppLog || {};
  const t = today(), now = new Date(), hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`, st = S.settings;
  const minus = (a, m) => { const [h, mm] = (a || "00:00").split(":").map(Number), v = Math.max(0, h * 60 + mm - m); return `${pad(Math.floor(v / 60))}:${pad(v % 60)}`; };
  const at = { morgens: st.suppMorning || "07:30", mittags: st.suppNoon || "12:30", abends: st.suppEvening || "21:00" };
  return ["morgens", "mittags", "abends"].map(sl => {
    const xs = sup.filter(x => x[sl]), open = xs.filter(x => !S.suppLog[t + "|" + sl + "|" + x.id]);
    if (!open.length) return null;
    const prio = sl === "morgens" ? 1 : sl === "mittags" ? (hm >= at.mittags ? 1 : 2) : (hm >= at.abends ? 1 : hm >= minus(at.abends, 120) ? 2 : 3);
    return { supp: sl, id: "supp_" + sl, t: `Supplements ${sl}`, meta: open.map(x => x.name + (x.dose > 1 ? ` (${x.dose})` : "")).join(", ") + " · " + at[sl], date: t, time: at[sl], prio, list: "todo" };
  }).filter(Boolean);
}
function suppTodoRow(t) {
  const pr = prioOf(t);
  return `<div class="todo prio supptodo" style="--pc:${pr[2]}"><button class="box" role="checkbox" aria-checked="false" aria-label="${esc(t.t)} genommen" data-act="supptodo" data-sl="${t.supp}"></button><div role="button" tabindex="0" data-act="area" data-id="gesund"><div class="tt">💊 ${esc(t.t)} <span class="ppill">${pr[1]}</span></div><div class="meta">${esc(t.meta)}</div></div></div>`;
}

/* ---------- Heute: was die Sekretärin dazu sagt ---------- */
HOOKS.heute.push(() => {
  let h = suppToday(false);
  const t = today(), soon = S.items.filter(x => x.kind === "vertrag" || x.kind === "versicherung").map(x => ({ x, st: L.contractStatus(x, t) })).filter(o => o.st && o.st.deadline && o.st.days >= 0 && o.st.days <= 14);
  if (soon.length) h += `<div class="sec"><span class="label">Kündigungsfristen</span></div>${soon.map(o => `<div class="card due" role="button" tabindex="0" data-act="openitem" data-id="${o.x.id}"><span class="av">${KINDS[o.x.kind].ic}</span><span style="min-width:0"><div class="t">${esc(o.x.name)}</div><div class="s">noch ${o.st.days} Tage: ${esc(o.st.text)}</div></span><span class="pill late">${o.st.days} T.</span></div>`).join("")}`;
  const trip = S.items.filter(x => x.kind === "reise" && x.von && x.von >= t && diffDays(t, x.von) <= 7)[0];
  if (trip) h += `<div class="sec"><span class="label">Bald unterwegs</span></div>${itemCard(trip)}`;
  return h;
});
HOOKS.events.push((from, to) => {
  const out = [];
  for (const x of S.items) {
    if ((x.kind === "vertrag" || x.kind === "versicherung")) { const st = L.contractStatus(x, today()); if (st && st.deadline) out.push({ d: st.deadline, c: "erin", k: "Kündigungsfrist", t: x.name, act: "openitem", id: x.id }); }
    if (x.kind === "reise" && x.von) { for (let d = x.von; d <= (x.bis || x.von) && d <= to; d = addDays(d, 1)) if (d >= from) out.push({ d, c: "erin", k: "Reise", t: x.name, act: "openitem", id: x.id }); }
  }
  return out;
});
HOOKS.start.push(() => { syncAllAuto(); const old = Object.keys(S.suppLog || {}).filter(k => k.slice(0, 10) < addDays(today(), -14)); old.forEach(k => delete S.suppLog[k]); save(); });
HOOKS.search.push(ql => S.items.filter(x => JSON.stringify(x).toLowerCase().includes(ql)).map(x => ({ g: areaById(KINDS[x.kind] ? KINDS[x.kind].area : "doku").n, ic: KINDS[x.kind] ? KINDS[x.kind].ic : "•", t: kindTitle(x.kind, x), s: KINDS[x.kind] && KINDS[x.kind].sub ? KINDS[x.kind].sub(x) : "", act: "openitem", id: x.id })));

/* ---------- Einstellungen je Rubrik ---------- */
Object.assign(SETS, {
  wecker: () => typeof weckerSettings === "function" ? weckerSettings() : "",
  geld: () => {
    const bud = S.settings.budgets || {};
    return `${setH("Einkommen")}${setTxt("income", "Netto im Monat", "für „Übrig“ in der Monatsübersicht", "z. B. 3200", "number")}
    ${setH("Kategorien")}<p class="hint" style="margin-top:0">Eigene Kategorien kommen dazu, die festen bleiben. Ein Budget je Kategorie ist freiwillig: Mirella warnt, wenn es überschritten wird.</p>
    ${catList().map(c => `<div class="set"><span><i class="pdot" style="background:${S.settings.catColor && S.settings.catColor[c] != null ? catColor(c) : "var(--line)"}"></i> ${esc(c)}${(S.settings.cats || []).includes(c) ? ` <button class="xbtn" data-act="delcat" data-c="${esc(c)}" aria-label="${esc(c)} entfernen">✕</button>` : ""}</span><input class="setin" inputmode="decimal" data-budget="${esc(c)}" value="${bud[c] ? String(bud[c]).replace(".", ",") : ""}" placeholder="Budget €"></div>`).join("")}
    <form class="shoprow" data-form="cat" style="margin:8px 0"><input class="search" style="margin:0" placeholder="Eigene Kategorie, z. B. Haustier" aria-label="Neue Kategorie"><button class="btn pri" style="flex:none">+</button></form>`;
  },
  vertrag: () => `${setSel("contractLead", "Vor Kündigungsfristen erinnern", "gilt für neue Verträge", [[14, "2 Wochen vorher"], [30, "1 Monat vorher"], [60, "2 Monate vorher"], [90, "3 Monate vorher"]])}${setTgl("nerv.fristen", "Nerv-Modus für Fristen", "meldet sich, bis du es erledigt hast")}`,
  gesund: () => `${setH("Supplements")}${setTxt("suppMorning", "Morgens", "Uhrzeit der Erinnerung", "07:30", "time")}${setTxt("suppNoon", "Mittags", "", "12:30", "time")}${setTxt("suppEvening", "Abends", "", "21:00", "time")}${setTgl("nerv.supplements", "Nerv-Modus Supplements", "bis abgehakt")}`,
  haus: () => `${setSel("washMin", "„Waschmaschine läuft“", "dann erinnere ich dich nach", [[60, "1 Stunde"], [90, "1,5 Stunden"], [120, "2 Stunden"], [150, "2,5 Stunden"], [180, "3 Stunden"]])}<p class="hint">Sag einfach „Waschmaschine läuft“ ins Mikrofon.</p>`,
  auto: () => `${setSel("huLead", "Vor HU/TÜV erinnern", "", [[14, "2 Wochen vorher"], [28, "4 Wochen vorher"], [42, "6 Wochen vorher"]])}`,
  arbeit: () => `<p class="hint" style="margin-top:0">Auslagen zum Erstatten: Mirella erinnert nach 3 Tagen ans Einreichen und nach 30 Tagen, ob das Geld da ist.</p>`,
  sport: () => `<p class="hint" style="margin-top:0">Vereinsbeiträge laufen automatisch bei den Fixkosten in Finanzen mit.</p>`,
  doku: () => `<p class="hint" style="margin-top:0">Fotografierte Briefe liest Mirella direkt auf dem Gerät (Texterkennung) und schlägt Bereich, Art, Betrag und Frist vor. Du kannst alles ändern. Mit dem Claude-Schlüssel wird das später noch genauer.</p>`,
  frei: () => `${setH("Standard-Packliste")}<p class="hint" style="margin-top:0">${esc(PACK.join(" · "))}</p>`
});

/* ---------- Klicks ---------- */
Object.assign(ACT, {
  reord: el => { const it = S.items.find(x => x.id === el.dataset.id); if (!it) return; it.reorder = Math.max(1, Math.min(90, (+it.reorder || 14) + +el.dataset.n)); syncAuto(it); save(); itemDetail(it); render(true); },
  goalnew: () => goalForm(null),
  goaledit: el => goalForm((S.goals || []).find(g => g.id === el.dataset.id)),
  goalsave: el => { const n = $("#g-n").value.trim(), t = parseAmount($("#g-t").value), sv = parseAmount($("#g-s").value) || 0; if (!n || !t) { toast("Bitte Name und Zielbetrag eintragen"); return; } S.goals = S.goals || []; const g = S.goals.find(x => x.id === el.dataset.id); const v = { n, target: t, saved: sv, until: $("#g-u").value || "" }; if (g) Object.assign(g, v); else S.goals.push({ id: uid(), ...v }); save(); closeSheet(); render(true); toast("Sparziel gespeichert: " + n); },
  goaladd: el => { const g = (S.goals || []).find(x => x.id === el.dataset.id); if (!g) return; const a = parseAmount(prompt(`Wie viel legst du für „${g.n}“ zurück? (Minus zum Abheben)`) || ""); if (a == null) return; g.saved = Math.round((+g.saved + a) * 100) / 100; save(); render(true); toast(g.saved >= g.target ? `${g.n}: Ziel erreicht! 🎉` : `${g.n}: ${eur(g.saved)} von ${eur(g.target)}`); },
  goaldel: el => { const g = (S.goals || []).find(x => x.id === el.dataset.id); if (!g || !ask(`Sparziel „${g.n}“ löschen?`)) return; S.goals = S.goals.filter(x => x !== g); save(); closeSheet(); render(true); },
  plus: el => plusDo(el.dataset.k, el.dataset.a),
  newitem: el => itemForm(el.dataset.k, null),
  openitem: el => { const it = S.items.find(x => x.id === el.dataset.id); if (it) itemDetail(it); },
  edititem: el => { const it = S.items.find(x => x.id === el.dataset.id); if (it) itemForm(it.kind, it); },
  saveitem: el => saveItem(el.dataset.k, el.dataset.id),
  delitem: el => { const it = S.items.find(x => x.id === el.dataset.id); if (!it || !ask(`„${kindTitle(it.kind, it)}“ löschen? Die Erinnerungen dazu gehen mit.`)) return; S.items = S.items.filter(x => x !== it); S.todos = S.todos.filter(t => !(t.ref === it.id && !t.done)); draftClear(); save(); closeSheet(); render(true); toast("Gelöscht"); },
  addread: el => { const it = S.items.find(x => x.id === el.dataset.id); const n = parseAmount(prompt(`Zählerstand ${it.art || ""} heute (${KINDS.zaehler.unit(it)})?`) || ""); if (n == null) return; it.reads = it.reads || []; it.reads.push({ d: today(), v: n }); syncAuto(it); save(); itemDetail(it); render(true); },
  delread: el => { const it = S.items.find(x => x.id === el.dataset.id); if (!ask(`Stand ${el.dataset.v} vom ${fmtD(el.dataset.d)} löschen?`)) return; it.reads = it.reads.filter(r => !(r.d === el.dataset.d && String(r.v) === el.dataset.v)); syncAuto(it); save(); itemDetail(it); },
  packtog: el => { const it = S.items.find(x => x.id === el.dataset.id), p = it.pack.find(x => x.id === el.dataset.p); p.done = !p.done; save(); itemDetail(it); },
  restock: el => { const it = S.items.find(x => x.id === el.dataset.id); KINDS.supplement.done(it); syncAuto(it); save(); itemDetail(it); render(true); },
  docfor: el => { const it = S.items.find(x => x.id === el.dataset.id); photoStart("dokument", KINDS[it.kind].area); photoCtx.ref = it.id; },
  supptodo: el => { S.suppLog = S.suppLog || {}; const sl = el.dataset.sl, t = today(); S.items.filter(x => x.kind === "supplement" && x[sl]).forEach(x => { S.suppLog[t + "|" + sl + "|" + x.id] = 1; }); save(); render(true); toast(`Supplements ${sl} genommen`); },
  supp: el => { S.suppLog = S.suppLog || {}; const k = el.dataset.k; if (S.suppLog[k]) delete S.suppLog[k]; else S.suppLog[k] = 1; save(); render(true); },
  finm: el => { finM = addMonths(finM + "-15", +el.dataset.n).slice(0, 7); finCat = ""; render(true); },
  fincat: el => { finCat = finCat === el.dataset.c ? "" : el.dataset.c; render(true); },
  setgo: el => { setFrom = view === "einstellungen" ? null : { v: view, area, cur, t: "Zurück" }; setSec = el.dataset.k; view = "einstellungen"; render(); },
  delcat: el => { const c = el.dataset.c; if (!ask(`Kategorie „${c}“ entfernen? Bestehende Ausgaben behalten sie.`)) return; S.settings.cats = (S.settings.cats || []).filter(x => x !== c); save(); render(true); }
});
document.addEventListener("change", e => {
  const el = e.target;
  if (el.matches('input[type=checkbox][data-act="supp"], input[type=checkbox][data-act="packtog"]')) { ACT[el.dataset.act](el); return; }
  if (el.dataset && el.dataset.budget != null) { S.settings.budgets = S.settings.budgets || {}; const v = parseAmount(el.value); if (v) S.settings.budgets[el.dataset.budget] = v; else delete S.settings.budgets[el.dataset.budget]; save(); toast("Budget gespeichert"); }
});
document.addEventListener("submit", e => {
  const f = e.target; if (f.dataset.form !== "pack") return;
  e.preventDefault(); e.stopImmediatePropagation();
  const v = f.querySelector("input").value.trim(); if (!v) return;
  const it = S.items.find(x => x.id === f.dataset.id); it.pack = it.pack || []; it.pack.push({ id: uid(), t: v, done: false }); save(); itemDetail(it);
}, true);
