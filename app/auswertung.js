/* Mirella – Auswertungen: was sich aus deinen eigenen Einträgen ablesen lässt.
   Alles wird auf dem Gerät gerechnet. Nur der Knopf „Mirella-KI: Was fällt dir auf?“ schickt die Zahlen (keine Nummern, keine Dokumente) an Claude. */
"use strict";
function auswStats() {
  const t = today(), d7 = addDays(t, -7), d30 = addDays(t, -30), d60 = addDays(t, -60), m0 = t.slice(0, 7), m1 = addMonths(t, -1).slice(0, 7), out = [];
  const pct = (a, b) => b ? Math.round(a / b * 100) + " %" : "–", WD = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const top = (arr, n = 3) => { const c = {}; arr.forEach(x => { if (x) c[x] = (c[x] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, n); };
  /* Aufgaben */
  const todos = S.todos.filter(x => x.list === "todo"), done = todos.filter(x => x.done && x.doneAt), open = todos.filter(x => !x.done);
  const late = open.filter(x => x.date && x.date < t), oldest = open.filter(x => x.created).sort((a, b) => a.created < b.created ? -1 : 1)[0];
  const wd = top(done.filter(x => x.doneAt >= d60).map(x => WD[D(x.doneAt).getDay()]), 1)[0];
  const dur = done.filter(x => x.created && x.doneAt >= d60).map(x => diffDays(x.created, x.doneAt)).filter(n => n >= 0);
  out.push({ h: "Aufgaben", rows: [
    ["Erledigt in 7 Tagen", done.filter(x => x.doneAt >= d7).length], ["Erledigt in 30 Tagen", done.filter(x => x.doneAt >= d30).length],
    ["Offen", open.length, late.length ? late.length + " davon überfällig" : "nichts überfällig"],
    ["Fleißigster Wochentag", wd ? wd[0] : "–", wd ? wd[1] + " erledigt in 60 Tagen" : ""],
    ["So lange liegt eine Aufgabe im Schnitt", dur.length ? (Math.round(dur.reduce((a, b) => a + b, 0) / dur.length * 10) / 10 + " Tage").replace(".", ",") : "–"],
    ["Älteste offene Aufgabe", oldest ? oldest.t : "–", oldest ? "seit " + fmtDate(oldest.created) : ""]] });
  /* Anrufe */
  const live = S.people.filter(p => !p.arch && !p.death), calls = []; live.forEach(p => (p.calls || []).forEach(c => calls.push({ p, c })));
  const c30 = calls.filter(x => x.c.d >= d30), due = live.filter(p => { const n = nextDue(p); return n && n <= t; });
  const most = top(calls.filter(x => x.c.d >= addDays(t, -90) && x.c.ok).map(x => fullName(x.p)), 3);
  const longest = live.filter(p => !noCycle(p.cyc)).map(p => [p, lastCall(p)]).filter(x => x[1]).sort((a, b) => a[1] < b[1] ? -1 : 1)[0];
  out.push({ h: "Anrufe und Kontakte", rows: [
    ["Anrufe in 30 Tagen", c30.length, c30.length ? pct(c30.filter(x => x.c.ok).length, c30.length) + " erreicht" : ""],
    ["Gerade fällig", due.length, due.slice(0, 3).map(fullName).join(", ")],
    ["Am häufigsten gesprochen (90 Tage)", most.length ? most.map(x => x[0] + " (" + x[1] + ")").join(", ") : "–"],
    ["Am längsten nicht gesprochen", longest ? fullName(longest[0]) : "–", longest ? "zuletzt " + fmtDate(longest[1]) : ""],
    ["Kontakte mit Anruf-Rhythmus", live.filter(p => !noCycle(p.cyc)).length + " von " + live.length],
    ["Kontakte ohne Geburtstag", live.filter(p => !p.bday).length],
    ["Geburtstage in 30 Tagen", live.filter(p => { const b = nextBirthday(p); return b && diffDays(t, b) <= 30; }).length + kinSoon(30).length]] });
  /* Einkauf */
  const shop = S.todos.filter(x => x.list === "einkauf"), bought = shop.filter(x => x.done), trips = new Set(bought.filter(x => x.doneAt >= d30).map(x => x.doneAt));
  const fav = top(bought.map(x => x.t.replace(/^\d+[.,]?\d*\s*(x|kg|g|l|ml|stück|packung|pack|liter|flaschen?|dosen?)?\s+/i, "").trim()), 5);
  out.push({ h: "Einkauf", rows: [
    ["Auf der Liste", shop.filter(x => !x.done).length], ["Einkäufe in 30 Tagen", trips.size, bought.filter(x => x.doneAt >= d30).length + " Artikel"],
    ["Am häufigsten gekauft", fav.length ? fav.map(x => x[0] + " (" + x[1] + ")").join(", ") : "–"]] });
  /* Geld */
  const ex = S.expenses || [], sum = l => l.reduce((a, b) => a + (+b.amount || 0), 0), e0 = ex.filter(x => (x.d || "").startsWith(m0)), e1 = ex.filter(x => (x.d || "").startsWith(m1));
  const cats = {}; e0.forEach(x => cats[x.cat || "Sonstiges"] = (cats[x.cat || "Sonstiges"] || 0) + (+x.amount || 0));
  const fix = (S.items || []).reduce((a, it) => { const K = typeof KINDS !== "undefined" && KINDS[it.kind]; const m = K && K.monthly ? +K.monthly(it) || 0 : 0; return a + m; }, 0);
  const day = +t.slice(8), dim = new Date(+t.slice(0, 4), +t.slice(5, 7), 0).getDate();
  out.push({ h: "Geld", rows: [
    ["Ausgaben diesen Monat", eur(sum(e0)), e1.length ? "letzter Monat " + eur(sum(e1)) : ""],
    ["Hochgerechnet bis Monatsende", e0.length ? eur(sum(e0) / day * dim) : "–"],
    ["Größte Posten", Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0] + " " + eur(x[1])).join(", ") || "–"],
    ["Feste Kosten im Monat (Verträge, Versicherungen …)", fix ? eur(fix) : "–", fix ? "im Jahr " + eur(fix * 12) : ""]] });
  /* Alltag */
  const sl = S.suppLog || {}, supp = (S.items || []).filter(x => x.kind === "supplement"); let sollen = 0, genommen = 0;
  for (let i = 1; i <= 7; i++) { const d = addDays(t, -i); for (const s of supp) for (const k of ["morgens", "mittags", "abends"]) if (s[k]) { sollen++; if (sl[d + "|" + k + "|" + s.id]) genommen++; } }
  const docs = S.docs || [], soon = docs.filter(x => x.until && x.until >= t && diffDays(t, x.until) <= 90);
  out.push({ h: "Alltag", rows: [
    ["Supplements genommen (7 Tage)", sollen ? pct(genommen, sollen) : "–", sollen ? genommen + " von " + sollen : ""],
    ["Dokumente abgelegt", docs.length, docs.filter(x => (x.created || "") >= d30).length + " in 30 Tagen"],
    ["Fristen in 90 Tagen", soon.length, soon.slice(0, 2).map(x => x.name).join(", ")],
    ["Geplante Wecker", (S.alarms || []).filter(w => w.date >= t && !w.off).length],
    ["Briefings gelesen", S.briefings.length ? pct(S.briefings.filter(b => b.read).length, S.briefings.length) : "–"]] });
  return out;
}
const auswText = () => auswStats().map(s => s.h + ":\n" + s.rows.map(r => "- " + r[0] + ": " + r[1] + (r[2] ? " (" + r[2] + ")" : "")).join("\n")).join("\n\n");
let auswKi = "";
R.auswertungen = function () {
  const st = auswStats();
  return `${subtop("Alle Bereiche", "drawer")}<p class="big" style="margin:0 0 4px">Auswertungen</p><p class="hint" style="margin-top:0">Was sich aus deinen Einträgen ablesen lässt. Gerechnet wird auf deinem iPhone, es verlässt nichts das Gerät.</p>
  ${typeof kiOn === "function" && kiOn() ? `<button class="btn pri" data-act="auswki" style="width:100%;margin-bottom:10px">✦ Mirella-KI: Was fällt dir auf?</button>${auswKi ? `<div class="block"><h4>Mirella meint</h4><p style="white-space:pre-wrap;margin:0;line-height:1.5">${esc(auswKi)}</p></div>` : ""}` : ""}
  ${st.map(s => `<div class="block"><h4>${s.h}</h4>${s.rows.map(r => `<div class="listrow"><span class="grow">${esc(r[0])}${r[2] ? `<small>${esc(String(r[2]))}</small>` : ""}</span><b style="text-align:right;max-width:55%">${esc(String(r[1]))}</b></div>`).join("")}</div>`).join("")}
  <p class="swipehint">Fehlt dir eine Auswertung? Sag es Mirella, dann kommt sie dazu.</p>`;
};
ACT.auswki = async el => {
  if (!ask("Mirella schickt dafür die Zahlen dieser Seite an Claude (Namen von Kontakten und Aufgaben, keine Telefonnummern, keine Dokumente). Einverstanden?")) return;
  el.disabled = true; el.textContent = "Mirella schaut sich alles an …";
  try {
    auswKi = await kiCall({ system: `Du bist Mirella, die persönliche Assistentin von ${S.settings.name || "Felix"}. Du bekommst Kennzahlen aus seiner App. Schreibe auf Deutsch in du-Form vier bis sechs kurze, konkrete Beobachtungen mit je einem Vorschlag, was er tun könnte. Nenne Zahlen und Namen aus den Daten, erfinde nichts dazu. Keine Aufzählungszeichen, keine Überschriften: jede Beobachtung als eigener kurzer Absatz. Auffälliges und Nützliches zuerst, Selbstverständliches weglassen.`, user: "Heute ist der " + today() + ".\n\n" + auswText(), hard: true, maxTokens: 3000 });
  } catch (e) { auswKi = ""; toast((e && e.message || "Claude nicht erreichbar")); }
  render(true);
};
