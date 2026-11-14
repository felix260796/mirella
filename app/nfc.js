/* Mirella – NFC-Aufkleber (Wunsch Felix 14.11.)
   Jeder Aufkleber startet in Kurzbefehle › Automation › NFC eine Aktion von Mirella. Die Aktion legt eine Marke
   ab (§NFC:art§), native.js holt sie beim Öffnen und ruft hier mirellaNfc(art, zeit) auf.
   „Waschmaschine läuft“ erinnert schon ohne Mirella (iPhone-Mitteilung), hier entsteht dazu die Aufgabe. */
"use strict";
(function () {
  const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const morgen = () => addDays(today(), 1);
  const sheetOk = (title, rows, btn) => openSheet(`<p class="stitle">${title}</p>${rows.join("")}<button class="btn pri" data-act="losok" style="width:100%;margin-top:12px">${btn}</button>`);
  const row = (ic, html) => `<div class="losrow"><span class="losic">${ic}</span><div>${html}</div></div>`;
  const evOn = d => (typeof mirellaEventsOn === "function" ? mirellaEventsOn(d) : []);

  const ROUTINE = /supplement|kreatin|vitamin|omega|magnesium|waschmaschine ausräumen/i;
  /* Termine eines Tages: iPhone-Kalender und Aufgaben mit Uhrzeit, nach Zeit sortiert */
  function termine(d, ab) {
    const ev = evOn(d).map(e => ({ time: e.time || "", t: e.t, ort: e.loc || "" }));
    // Routine (Supplements, Waschmaschine) zählt nicht als Termin
    const td = S.todos.filter(x => x.list === "todo" && !x.done && x.date === d && x.time && !ROUTINE.test(x.t)).map(x => ({ time: x.time, t: x.t, ort: x.ort || "" }));
    return ev.concat(td).filter(x => !ab || !x.time || x.time >= ab).sort((a, b) => (a.time || "99") < (b.time || "99") ? -1 : 1);
  }

  /* Wecker für einen Tag (einmalige und wiederkehrende) */
  function weckerAm(d) {
    const out = [];
    for (const w of S.alarms || []) {
      if (w.off || !w.wake) continue;
      if ((w.wakeDate || w.date) === d) { out.push({ wake: w.wake, name: w.name || w.to || "Wecker" }); continue; }
      if (!(w.days || []).length || typeof wDow !== "function" || typeof wNextDay !== "function") continue;
      // wiederkehrend: nächster Termin nach heute, der morgen geweckt wird
      for (const day of [d, addDays(d, 1)]) {
        if (!w.days.includes(wDow(day))) continue;
        const pl = typeof wPlanFor === "function" ? wPlanFor(w, day) : null;
        if ((pl && pl.wakeDate || day) === d) out.push({ wake: (pl && pl.wake) || w.wake, name: w.name || w.to || "Wecker" });
      }
    }
    return out.sort((a, b) => a.wake < b.wake ? -1 : 1);
  }

  /* Waschmaschine: Aufgabe zur Zeit, zu der auch die iPhone-Mitteilung kam */
  function wasch(ts) {
    const start = ts ? new Date(+ts * 1000) : new Date();
    const d = new Date(start.getTime() + (+S.settings.washMin || 120) * 60e3);
    const date = iso(d), time = hm(d);
    if (!S.todos.some(x => !x.done && x.t === "Waschmaschine ausräumen" && x.date === date && x.time === time)) {
      S.todos.push({ id: uid(), t: "Waschmaschine ausräumen", list: "todo", done: false, created: today(), date, time, trig: "zeit", rep: "nie", area: "haus", nerv: true, prio: 2 });
      save();
    }
    toast(`Waschmaschine: Ich erinnere dich um ${time}`);
  }

  /* Supplements: alles abhaken, was jetzt fällig ist (bis 90 Minuten im Voraus) */
  function supp() {
    const t = today(), now = new Date(), bis = hm(new Date(now.getTime() + 90 * 60e3));
    const re = /supplement|kreatin|vitamin|omega|magnesium|zink|eisen|tablette|kapsel/i;
    const offen = S.todos.filter(x => x.list === "todo" && !x.done && x.date && x.date <= t && (x.area === "gesund" || re.test(x.t)) && re.test(x.t))
      .sort((a, b) => (a.date + (a.time || "")) < (b.date + (b.time || "")) ? -1 : 1);
    let jetzt = offen.filter(x => x.date < t || !x.time || x.time <= bis);
    if (!jetzt.length && offen.length) jetzt = [offen[0]];
    const namen = [];
    for (const x of jetzt) { namen.push(x.t); toggleTodo(x.id); }
    // Supplements aus dem Bereich Gesundheit (Einnahmezeiten) für die jetzige Tageszeit
    const items = (S.items || []).filter(x => x.kind === "supplement");
    if (items.length && typeof suppSlot === "function") {
      const sl = suppSlot(); S.suppLog = S.suppLog || {};
      for (const x of items.filter(x => x[sl])) { const k = t + "|" + sl + "|" + x.id; if (!S.suppLog[k]) { S.suppLog[k] = 1; namen.push(x.name); } }
      save();
    }
    // offenes Nerv-Fenster schließen, es meldet sich nur wieder, wenn noch etwas anderes offen ist
    document.querySelectorAll(".nerv").forEach(o => o.remove());
    render(true);
    toast(namen.length ? "Abgehakt: " + namen.join(", ") : "Gerade ist kein Supplement fällig");
  }

  function nacht() {
    const d = morgen(), rows = [];
    const wk = weckerAm(d);
    rows.push(row("⏰", wk.length ? `<b>Wecker morgen ${esc(wk[0].wake)}</b>${wk.slice(0, 3).map(w => `<small>${esc(w.wake)} · ${esc(w.name)}</small>`).join("")}` : "<b>Für morgen ist kein Wecker gestellt</b><small>Unter Wecker kannst du einen anlegen.</small>"));
    const tm = termine(d);
    rows.push(row("📅", tm.length ? `<b>Erster Termin: ${tm[0].time ? esc(tm[0].time) + " " : ""}${esc(tm[0].t)}</b>${tm.slice(1, 4).map(x => `<small>${x.time ? esc(x.time) + " " : ""}${esc(x.t)}</small>`).join("")}` : "<b>Morgen keine Termine</b>"));
    const todo = S.todos.filter(x => x.list === "todo" && !x.done && x.date === d && !x.time);
    if (todo.length) rows.push(row("✓", `<b>${todo.length === 1 ? "1 Aufgabe" : todo.length + " Aufgaben"} für morgen</b><small>${esc(todo.slice(0, 4).map(x => x.t).join(", "))}${todo.length > 4 ? " …" : ""}</small>`));
    const offen = S.todos.filter(x => x.list === "todo" && !x.done && x.date === today());
    if (offen.length) rows.push(row("🌙", `<b>Heute noch offen: ${offen.length}</b><small>${esc(offen.slice(0, 3).map(x => x.t).join(", "))}${offen.length > 3 ? " …" : ""}</small>`));
    sheetOk("Gute Nacht", rows, "Gute Nacht");
  }

  function brief() {
    const b = typeof latestBriefing === "function" ? latestBriefing() : null;
    if (!b) { toast("Noch kein Briefing da"); return; }
    openBrief(b.id);
  }

  function auto() {
    const t = today(), ab = hm(new Date()), tm = termine(t, ab), rows = [];
    const ziel = tm.find(x => x.ort);
    const name = (S.settings && S.settings.name) || "";
    let sag = `Gute Fahrt${name ? ", " + name : ""}. `;
    if (tm.length) {
      const e = tm[0];
      rows.push(row("📅", `<b>Als Nächstes: ${e.time ? esc(e.time) + " " : ""}${esc(e.t)}</b>${e.ort ? `<small>${esc(String(e.ort).split(",")[0])}</small>` : ""}${tm.slice(1, 3).map(x => `<small>${x.time ? esc(x.time) + " " : ""}${esc(x.t)}</small>`).join("")}`));
      sag += `Als Nächstes ${e.time ? "um " + e.time.replace(":", " Uhr ").replace(/ 00$/, "") + ": " : ""}${e.t}. `;
    } else { rows.push(row("📅", "<b>Heute keine Termine mehr</b>")); sag += "Heute stehen keine Termine mehr an. "; }
    if (ziel) rows.push(`<a class="btn pri" style="display:block;text-align:center;text-decoration:none;margin-top:10px" href="https://maps.apple.com/?daddr=${encodeURIComponent(ziel.ort)}&dirflg=d">Route zu ${esc(String(ziel.ort).split(",")[0])}</a>`);
    const calls = typeof callsForToday === "function" ? callsForToday().length : 0;
    const todo = S.todos.filter(x => x.list === "todo" && !x.done && x.date && x.date <= t).length;
    if (calls || todo) { rows.push(row("✓", `<b>${todo === 1 ? "1 Aufgabe" : todo + " Aufgaben"}${calls ? ` · ${calls === 1 ? "1 Anruf" : calls + " Anrufe"}` : ""} für heute</b>`)); sag += `Heute ${todo === 1 ? "eine Aufgabe" : todo + " Aufgaben"}${calls ? ` und ${calls === 1 ? "ein Anruf" : calls + " Anrufe"}` : ""}.`; }
    sheetOk("Gute Fahrt", rows, "Danke");
    try { const u = new SpeechSynthesisUtterance(sag); u.lang = "de-DE"; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (_) { }
  }

  function anrufe() {
    const list = typeof callsForToday === "function" ? callsForToday() : [];
    if (!list.length) { toast("Heute stehen keine Anrufe an"); return; }
    closeAll(); view = "heute"; render(true);
    openSheet(`<p class="stitle">${list.length === 1 ? "1 Anruf" : list.length + " Anrufe"} für heute</p>${list.map(p => personCard(p, true)).join("")}<button class="btn" data-close="sheet" style="width:100%;margin-top:12px">Fertig</button>`);
  }

  function sport() {
    S.sportLog = S.sportLog || [];
    const now = Date.now(), last = S.sportLog[S.sportLog.length - 1];
    if (last && now - (last.at || 0) < 60 * 60e3) { toast("Training ist schon gezählt"); return; }
    S.sportLog.push({ d: today(), at: now }); save(); render(true);
    const s = sportZahlen(); toast(`Training gezählt. Diese Woche ${s.woche}, diesen Monat ${s.monat}`);
  }
  function sportZahlen() {
    const log = S.sportLog || [], t = today(), wk = isoWeek(t), m = t.slice(0, 7);
    return { woche: log.filter(x => isoWeek(x.d) === wk && x.d.slice(0, 4) === t.slice(0, 4)).length, monat: log.filter(x => x.d.slice(0, 7) === m).length, letzte: log.length ? log[log.length - 1].d : "" };
  }
  /* Anzeige im Bereich Sport & Hobby */
  window.sportStats = () => {
    const s = sportZahlen();
    return `<div class="sec"><span class="label">Training</span><span class="label">${s.letzte ? "zuletzt " + esc(relDate(s.letzte)) : "noch nichts gezählt"}</span></div><div class="card"><span style="min-width:0;flex:1"><div class="t">Diese Woche ${s.woche}, diesen Monat ${s.monat}</div><div class="s">Mit dem NFC-Aufkleber an der Sporttasche zählt Mirella jedes Training.</div></span><button class="mini" data-act="sportplus">＋ Training</button></div>`;
  };
  ACT.sportplus = () => sport();

  function post() { closeAll(); photoStart(null, null); if (ACT.scanmulti) ACT.scanmulti(); }

  const RUN = { wasch, supp, nacht, brief, auto, anrufe, sport, post };
  window.mirellaNfc = (k, ts) => { const f = RUN[k]; if (f) try { f(ts); } catch (e) { console.warn("NFC", k, e); } };
  window.mirellaNfcPrefs = () => { try { const SY = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.MirellaSystem; if (SY && SY.setPrefs) SY.setPrefs({ washMin: +S.settings.washMin || 120 }).catch(() => { }); } catch (_) { } };

  /* ---------- Einstellungen: Anleitung für alle Aufkleber ---------- */
  const AUF = [
    ["Haustür", "Ich gehe los", "Wetter, Termine, Einkaufsliste und offene Aufgaben, bevor du gehst"],
    ["Waschmaschine", "Waschmaschine läuft", "Mirella bleibt zu, das iPhone erinnert dich ans Ausräumen (Dauer unter Zuhause)"],
    ["Supplement-Dose", "Supplements genommen", "hakt die gerade fälligen Supplements ab, damit hört das Erinnern auf"],
    ["Nachttisch", "Gute Nacht", "Wecker für morgen, erster Termin, Aufgaben für morgen"],
    ["Kaffeemaschine", "Tages-Briefing öffnen", "öffnet direkt das neueste Briefing"],
    ["Auto", "Ich fahre los", "Mirella sagt an, was ansteht, mit Route zum ersten Termin"],
    ["Telefonier-Platz", "Anrufe von heute", "die heute fälligen Anrufe mit Knopf zum Anrufen"],
    ["Sporttasche", "Training zählen", "zählt ein Training in Sport & Hobby"],
    ["Post-Ablage", "Post scannen", "öffnet direkt die Kamera für Briefe"]];
  SETNAMES.nfc = "NFC-Aufkleber";
  SETS.nfc = () => `${setH("So richtest du einen Aufkleber ein")}
  <ol class="losguide">
    <li>App <b>Kurzbefehle</b> öffnen, unten <b>Automation</b>, oben rechts <b>+</b>.</li>
    <li><b>NFC</b> wählen, <b>Scannen</b> tippen und das iPhone an den Aufkleber halten. Einen Namen geben, zum Beispiel „Haustür“.</li>
    <li><b>Sofort ausführen</b> wählen und <b>Nach Ausführung benachrichtigen</b> ausschalten.</li>
    <li><b>Neue leere Automation</b>, dann <b>Aktion hinzufügen</b>, nach <b>Mirella</b> suchen und die passende Aktion aus der Liste unten wählen. Fertig.</li>
  </ol>
  ${setH("Welche Aktion wohin")}
  ${AUF.map(([wo, akt, was]) => `<div class="spr"><b>${esc(wo)}: „${esc(akt)}“</b><small>${esc(was)}</small></div>`).join("")}
  <p class="hint">Halte das iPhone mit dem oberen Rand an den Aufkleber, es muss entsperrt sein.</p>`;
  const nfcOrigEinst = R.einstellungen;
  R.einstellungen = function () {
    const h = nfcOrigEinst.call(this); if (setSec || !NATIVE) return h;
    const r = `<button class="drow" data-act="setsec" data-k="nfc"><span class="setic"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8.5a6 6 0 0 1 0 7M9.5 6a10 10 0 0 1 0 12M3 11a2 2 0 0 1 0 2M13 3.5a14 14 0 0 1 0 17"/></svg></span><span class="dt"><b>NFC-Aufkleber</b><small>Tür, Waschmaschine, Nachttisch …</small></span><span class="chev">›</span></button>`;
    const mark = '<div class="sethead2">Mirella</div>', i = h.indexOf(mark); return i < 0 ? h + r : h.slice(0, i) + r + h.slice(i);
  };
})();
