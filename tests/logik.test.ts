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
