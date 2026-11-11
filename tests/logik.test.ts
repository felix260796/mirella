import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const L = createRequire(import.meta.url)("../app/logik.js");

test("Geburtstag tippen: 07041964 wird 07.04.1964", () => {
  let v = ""; for (const ch of "07041964") v = L.fmtBdayInput(v + ch);
  assert.equal(v, "07.04.1964");
  assert.equal(L.parseBday(v, 2026), "1964-04-07");
  assert.equal(L.parseBday("07.04.", 2026), "1604-04-07");
  assert.equal(L.parseBday("31.02.1990", 2026), null);
  assert.equal(L.bdayToInput("1604-04-07"), "07.04.");
});
test("Telefon: Vorwahl trennen und zusammensetzen", () => {
  assert.deepEqual(L.splitTel("0151 2345678"), { p: "+49", n: "151 2345678" });
  assert.deepEqual(L.splitTel("+43 664 1234"), { p: "+43", n: "664 1234" });
  assert.equal(L.joinTel("+41", "079 123 45 67"), "+41 79 123 45 67");
  assert.equal(L.joinTel("+49", ""), "");
});
test("Einkaufsliste: Mengen erkennen", () => {
  assert.deepEqual(L.parseQty("2 Liter Milch"), { qty: 2, unit: "l", t: "Milch" });
  assert.deepEqual(L.parseQty("500g Hack"), { qty: 500, unit: "g", t: "Hack" });
  assert.deepEqual(L.parseQty("Eier 10"), { qty: 10, unit: "", t: "Eier" });
  assert.deepEqual(L.parseQty("eine Gurke"), { qty: null, unit: "", t: "Gurke" });
});
test("Vertrag: Kündigungsfrist mit automatischer Verlängerung", () => {
  const st = L.contractStatus({ end: "2027-03-31", renew: 12, noticeN: 3, noticeU: "Monate" }, "2026-11-10");
  assert.equal(st.deadline, "2026-12-31");
  const late = L.contractStatus({ end: "2027-01-31", renew: 12, noticeN: 3, noticeU: "Monate" }, "2026-11-10");
  assert.equal(late.end, "2028-01-31"); assert.equal(late.deadline, "2027-10-31");
  assert.equal(L.contractStatus({ end: "2025-01-31", renew: 0, noticeN: 1, noticeU: "Monate" }, "2026-11-10").flexible, true);
  assert.equal(L.monthly(120, "jährlich"), 10);
});
test("Supplements: Vorrat reicht", () => {
  const s = { morgens: true, abends: true, dose: 1, stock: 30, stockDate: "2026-11-01" };
  assert.deepEqual(L.supplyLeft(s, "2026-11-10"), { left: 12, days: 6, perDay: 2 });
});
test("Wecker: Weckzeit aus Ankunft, Fahrt, Puffer, Zeit daheim", () => {
  const w = L.wakePlan({ date: "2026-11-11", arrive: "06:00", travelMin: 25, prepMin: 30, bufMin: 10, count: 3, gap: 5 });
  assert.equal(w.leave, "05:25"); assert.equal(w.wake, "04:55");
  assert.deepEqual(w.alarms, ["04:45", "04:50", "04:55"]);
  const early = L.wakePlan({ date: "2026-11-11", arrive: "00:30", travelMin: 40, prepMin: 30, bufMin: 0, count: 1 });
  assert.equal(early.wakeDate, "2026-11-10");
});
test("Brief einsortieren: Bereich, Betrag, Frist", () => {
  const g = L.classifyDoc("Finanzamt Stuttgart\nEinkommensteuerbescheid 2025\nBitte zahlen Sie den Betrag von 1.234,56 € bis zum 15.12.2026", "2026-11-10");
  assert.equal(g.area, "geld"); assert.equal(g.amount, 1234.56); assert.equal(g.due, "2026-12-15");
  assert.equal(L.classifyDoc("Techniker Krankenkasse Ihre Versichertenkarte", "2026-11-10").area, "gesund");
  assert.equal(L.classifyDoc("Rechnung Telekom Kundennummer 123 Rechnungsbetrag 39,95 €", "2026-11-10").area, "vertrag");
});
test("Scan: Entzerrung bildet Ecken richtig ab", () => {
  const src = [[10, 20], [210, 30], [200, 330], [5, 310]];
  const H = L.homography(src, 100, 150);
  const [x, y] = L.mapPt(H, 100, 150);
  assert.ok(Math.abs(x - 200) < 1e-6 && Math.abs(y - 330) < 1e-6);
});
test("Hilfe: Frage findet die passende Antwort", () => {
  const list = [{ q: "Wie stelle ich einen Wecker?", k: ["wecker", "aufstehen"] }, { q: "Wie lege ich einen Brief ab?", k: ["brief", "scan"] }];
  assert.equal(L.helpMatch("wie geht der Wecker", list)[0].q, "Wie stelle ich einen Wecker?");
});
test("Einkauf: Warengruppen und übliche Einheiten", () => {
  assert.equal(L.shopGroup("Bananen").n, "Obst & Gemüse");
  assert.equal(L.shopGroup("Reis").n, "Vorrat & Konserven");
  assert.equal(L.shopGroup("Eier").n, "Milch, Käse & Eier");
  assert.equal(L.shopGroup("Tomatenmark").n, "Vorrat & Konserven");
  assert.deepEqual(L.defUnit("Eier"), { qty: 1, unit: "Pck." });
  assert.deepEqual(L.defUnit("Butter"), { qty: 1, unit: "Stk." });
  assert.deepEqual(L.defUnit("eier", { eier: { qty: 1, unit: "Stk." } }), { qty: 1, unit: "Stk." });
  assert.equal(L.defUnit("Gin"), null);
});
test("Einkaufszettel: Zeilen werden Artikel", () => {
  assert.deepEqual(L.parseShopLines("Einkauf\n- 2 Liter Milch\n• Butter\n|||\nbananen").map(x => x.t), ["Milch", "Butter", "Bananen"]);
});
test("E-Mail und Telefon prüfen", () => {
  assert.match(L.checkEmail("felix@gmial.com"), /gmail\.com/);
  assert.match(L.checkEmail("felix.gmx.de"), /@/);
  assert.equal(L.checkEmail("felix@web.de"), null);
  assert.match(L.checkTel("+49", "151 234"), /Handynummer/);
  assert.equal(L.checkTel("+49", "151 23456789"), null);
});
test("Runde Geburtstage: ein halbes Jahr vorher", () => {
  assert.equal(L.roundBday("1997-03-02", "2026-11-10").age, 30);
  assert.equal(L.roundBday("1996-03-02", "2026-11-10"), null);
  assert.equal(L.roundBday("1997-08-02", "2026-11-10"), null); // erst in > 6 Monaten
});
test("Anrufplan: höchstens 3 pro Werktag", () => {
  const p = L.callPlan(["a", "b", "c", "d", "e"], "2026-11-10", 3);
  assert.deepEqual([p.a, p.c, p.d], ["2026-11-10", "2026-11-10", "2026-11-11"]);
  const f = L.callPlan(["a", "b"], "2026-11-13", 3, 3); // Freitag, schon 3 erledigt -> Montag
  assert.equal(f.a, "2026-11-16");
});
test("PC-Sicherung: ZIP und Excel sind gültig", () => {
  const ZX = createRequire(import.meta.url)("../app/export.js");
  const z = ZX.zip([{ name: "a.txt", data: "Hallo" }]);
  assert.equal(z[0], 0x50); assert.equal(z[1], 0x4b);
  assert.equal(ZX.crc32(new TextEncoder().encode("Hallo")), 0x78b31ed5);
  assert.equal(ZX.fname('Rechnung: Zahn/reinigung?'), "Rechnung Zahn reinigung");
  assert.ok(ZX.xlsx([{ name: "Kontakte", rows: [["Name"], ["Tim"]] }]).length > 500);
});

test("Wetter: Tag/Nacht und Hinweise", () => {
  const time: string[] = [], T: number[] = [], P: number[] = [], G: number[] = [], U: number[] = [], C: number[] = [], A: number[] = [];
  for (const d of ["2026-11-10", "2026-11-11"]) for (let h = 0; h < 24; h++) { time.push(`${d}T${String(h).padStart(2, "0")}:00`); T.push(h >= 7 && h < 20 ? 12 : -2); A.push(h >= 7 && h < 20 ? 10 : -5); P.push(h === 15 ? 80 : 0); G.push(h === 14 ? 70 : 10); U.push(0); C.push(0); }
  const r = L.wxDayNight({ time, temperature_2m: T, apparent_temperature: A, precipitation_probability: P, wind_gusts_10m: G, uv_index: U, weather_code: C }, "2026-11-10", 8);
  assert.equal(r.dayMax, 12); assert.equal(r.nightMin, -2);
  const k = r.hints.map((h: any) => h.k);
  assert.ok(k.includes("regen")); assert.ok(k.includes("sturm")); assert.ok(k.includes("frost"));
});

test("Anrufplan mit eigenen Anruftagen und runde Geburtstage nach Auswahl", () => {
  // Di 2026-11-10, nur Di und Do erlaubt, 1 pro Tag
  const m = L.callPlan(["a", "b", "c"], "2026-11-10", 1, 0, 0, [2, 4]);
  assert.deepEqual([m.a, m.b, m.c], ["2026-11-10", "2026-11-12", "2026-11-17"]);
  assert.equal(L.roundBday("2001-03-01", "2026-01-10", 183, [25])!.age, 25);
  assert.equal(L.roundBday("2001-03-01", "2026-01-10", 183, [30]), null);
});

test("Wetter: Regen-Zeiträume", () => {
  const time: string[] = [], P: number[] = [], M: number[] = [];
  for (let h = 0; h < 24; h++) { time.push(`2026-11-10T${String(h).padStart(2, "0")}:00`); P.push(h >= 17 && h <= 19 ? 70 : h === 22 ? 45 : 5); M.push(h >= 17 && h <= 19 ? 0.7 : 0); }
  const s = L.rainSpans({ time, precipitation_probability: P, precipitation: M }, "2026-11-10T08:00", 24);
  assert.equal(s.length, 2);
  assert.equal(s[0].from, "2026-11-10T17:00"); assert.equal(s[0].to, "2026-11-10T19:00"); assert.equal(s[0].maxP, 70); assert.equal(s[0].mm, 2.1);
  assert.equal(s[1].from, "2026-11-10T22:00");
  assert.equal(L.rainSpans({ time, precipitation_probability: P, precipitation: M }, "2026-11-10T20:00", 2).length, 0);
});

test("Anrufen: deutsche Nummern werden mit +49 gewählt", () => {
  assert.equal(L.dialTel("0711 123456"), "+49711123456");
  assert.equal(L.dialTel("0171/234 56 78"), "+491712345678");
  assert.equal(L.dialTel("+49 171 2345678"), "+491712345678");
  assert.equal(L.dialTel("0041 79 123 45 67"), "+41791234567");
  assert.equal(L.dialTel("+41 79 123 45 67"), "+41791234567");
  assert.equal(L.dialTel("110"), "110");
  assert.equal(L.dialTel("116117"), "116117");
  assert.equal(L.dialTel(""), "");
});
