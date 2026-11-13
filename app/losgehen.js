/* Mirella – „Ich gehe los“: kurzer Blick, bevor Felix aus der Tür geht.
   Ausgelöst über den Kurzbefehl „Ich gehe los“ (z. B. per NFC-Aufkleber an der Wohnungstür) oder über
   Einstellungen › Ich gehe los. Zeigt Wetter und Schirm, die nächsten Termine, wann er los muss und die Einkaufsliste. */
function losHinweise() {
  const nowM = new Date(), hmNow = L.pad(nowM.getHours()) + ":" + L.pad(nowM.getMinutes()), t = today(), items = [];
  const add = (ic, html) => items.push(`<div class="losrow"><span class="losic">${ic}</span><div>${html}</div></div>`);
  // Wetter
  try {
    if (typeof WX !== "undefined" && WX && WX.cur) {
      const [ic, txt] = WXC(WX.cur.weather_code), dn = L.wxDayNight(WX.hourly || {}, t, nowM.getHours());
      const hints = dn.hints || [];
      add(ic, `<b>${Math.round(WX.cur.temperature_2m)}° · ${esc(txt)}</b>${hints.length ? hints.map(h => `<small>${h.ic} ${esc(h.t)}</small>`).join("") : "<small>Kein Regen in Sicht, kein Schirm nötig.</small>"}`);
    }
  } catch (_) { }
  // Wecker und Termine mit Fahrzeit: wann los?
  for (const w of (S.alarms || [])) if (!w.off && w.leave && (w.leaveDate || w.date) === t && w.leave >= hmNow) add("🚦", `<b>Los um ${esc(w.leave)}</b><small>${esc(w.name || w.to || "Termin")}${w.arrive ? ", ankommen um " + esc(w.arrive) : ""}</small>${(w.parts || []).filter(x => x.linie).slice(0, 1).map(x => `<small>${esc(x.ab)} ${esc(x.linie)} ab ${esc(x.von)}${x.delay > 0 ? " · +" + x.delay + " Min." : ""}${x.gl ? " · Gleis " + esc(x.gl) : ""}</small>`).join("")}`);
  // Termine heute (iPhone-Kalender) und Aufgaben mit Uhrzeit oder Ort
  const ev = (typeof mirellaEventsOn === "function" ? mirellaEventsOn(t) : []).filter(e => !e.time || e.time >= hmNow).sort((a, b) => (a.time || "") < (b.time || "") ? -1 : 1);
  const td = S.todos.filter(x => x.list === "todo" && !x.done && x.date === t && ((x.time && x.time >= hmNow) || x.ort));
  const terms = ev.map(e => ({ time: e.time, t: e.t, ort: e.loc })).concat(td.map(x => ({ time: x.time, t: x.t, ort: x.ort }))).sort((a, b) => (a.time || "99") < (b.time || "99") ? -1 : 1).slice(0, 5);
  if (terms.length) add("📅", `<b>Heute noch</b>${terms.map(x => `<small>${x.time ? esc(x.time) + " " : ""}${esc(x.t)}${x.ort ? " · " + esc(String(x.ort).split(",")[0]) : ""}</small>`).join("")}`);
  // Einkaufsliste
  const shop = S.todos.filter(x => x.list === "einkauf" && !x.done);
  if (shop.length) add("🛒", `<b>Einkaufsliste: ${shop.length === 1 ? "1 Artikel" : shop.length + " Artikel"}</b><small>${esc(shop.slice(0, 6).map(x => x.t).join(", "))}${shop.length > 6 ? " …" : ""}</small><button class="mini" data-act="losshop" style="margin-top:6px">Einkaufsliste öffnen</button>`);
  // Was heute noch zu tun ist (ohne Uhrzeit)
  const due = S.todos.filter(x => x.list === "todo" && !x.done && x.date && x.date <= t && !x.time && !x.ort);
  if (due.length) add("✓", `<b>${due.length === 1 ? "1 Aufgabe" : due.length + " Aufgaben"} für heute</b><small>${esc(due.slice(0, 4).map(x => x.t).join(", "))}${due.length > 4 ? " …" : ""}</small>`);
  if (!items.length) add("👋", "<b>Alles gut, nichts Besonderes.</b><small>Schönen Weg!</small>");
  openSheet(`<p class="stitle">Bevor du gehst</p>${items.join("")}<button class="btn pri" data-act="losok" style="width:100%;margin-top:12px">Alles klar, tschüss</button>`);
}
Object.assign(ACT, {
  losgo: () => { closeAll(); losHinweise(); },
  losshop: () => { closeAll(); view = "todos"; todoList = "einkauf"; render(); },
  losok: () => {
    closeSheet();
    const rest = typeof mirellaLosRest === "function" ? mirellaLosRest() : "";
    if (rest && typeof voiceStart === "function") setTimeout(() => { voiceStart(); recStop(); $("#v-text").value = rest; voiceReview(); }, 400);
  }
});

/* Einstellungen › Ich gehe los: ausprobieren und Anleitung für den NFC-Aufkleber */
SETNAMES.losgehen = "Ich gehe los";
SETS.losgehen = () => `${setH("Ich gehe los")}
  <p class="hint" style="margin-top:0">Bevor du aus der Tür gehst, zeigt Mirella dir kurz Wetter und Schirm, wann du los musst, deine nächsten Termine und die Einkaufsliste.</p>
  <button class="btn pri" data-act="losgo" style="width:100%">Jetzt ausprobieren</button>
  ${setH("Mit NFC-Aufkleber an der Tür")}
  <ol class="losguide">
    <li>Aufkleber (NTAG215) innen an die Wohnungstür kleben, gut erreichbar auf Handhöhe.</li>
    <li>App <b>Kurzbefehle</b> öffnen, unten <b>Automation</b>, dann oben rechts <b>+</b>.</li>
    <li><b>NFC</b> wählen, dann <b>Scannen</b> und das iPhone oben an den Aufkleber halten. Namen geben, zum Beispiel „Haustür“.</li>
    <li><b>Sofort ausführen</b> wählen und <b>Bei Ausführung mitteilen</b> ausschalten. Dann <b>Weiter</b>.</li>
    <li><b>Neue leere Automation</b>, dann <b>Aktion hinzufügen</b>, nach <b>Mirella</b> suchen und <b>Ich gehe los</b> antippen. Fertig.</li>
  </ol>
  <p class="hint">Ab dann reicht es, das iPhone kurz an den Aufkleber zu halten. Mirella öffnet sich mit deinen Hinweisen. Ohne Aufkleber geht es auch per Sprache: „Ich gehe los, Mirella“.</p>`;
const losOrigEinst = R.einstellungen;
R.einstellungen = function () {
  const h = losOrigEinst.call(this); if (setSec) return h;
  const row = `<button class="drow" data-act="setsec" data-k="losgehen"><span class="setic"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 4h5v16h-5"/><path d="M4 12h10"/><path d="m10 8 4 4-4 4"/></svg></span><span class="dt"><b>Ich gehe los</b><small>Hinweise an der Tür, NFC-Aufkleber</small></span><span class="chev">›</span></button>`;
  const mark = '<div class="sethead2">Mirella</div>', i = h.indexOf(mark); return i < 0 ? h + row : h.slice(0, i) + row + h.slice(i);
};

/* Einstellungen › Sprachbefehle: welche Sätze Mirella versteht und der sichere Weg über einen eigenen Kurzbefehl */
SETNAMES.sprache = "Sprachbefehle";
SETS.sprache = () => `${setH("Sprachbefehle")}
  <p class="hint" style="margin-top:0">Wichtig: Wörter wie „sag“, „schreib“, „schick“ oder „notier“ hält dein iPhone für Nachrichten, Notizen oder Erinnerungen. Darum benutzt Mirella eigene Sätze. Den Inhalt sagst du erst, wenn nachgefragt wird.</p>
  <div class="spr"><b>„Mirella Diktat“</b><small>Fragt „Was soll ich aufschreiben?“. Du sagst zum Beispiel „Spaghetti einkaufen“. Mirella bleibt zu und zeigt es beim nächsten Öffnen zum Bestätigen.</small></div>
  <div class="spr"><b>„Mirella zuhören“</b><small>Öffnet Mirella und füllt das Gesagte direkt vor.</small></div>
  <div class="spr"><b>„Ich gehe los, Mirella“</b><small>Hinweise vor dem Rausgehen.</small></div>
  ${setH("Der sichere Weg: eigener Kurzbefehl")}
  <ol class="losguide">
    <li>App <b>Kurzbefehle</b> öffnen, unten <b>Kurzbefehle</b>, oben rechts <b>+</b>.</li>
    <li><b>Aktion hinzufügen</b>, nach <b>Mirella</b> suchen und <b>Mirella Diktat</b> antippen.</li>
    <li>Oben auf den Namen tippen und einen eigenen Namen geben, zum Beispiel <b>Mirella aufschreiben</b>. Fertig.</li>
  </ol>
  <p class="hint">Diesen Namen sagst du dann genau so nach „Hey …“. Eigene Kurzbefehle erkennt das iPhone am zuverlässigsten.</p>`;
const sprOrigEinst = R.einstellungen;
R.einstellungen = function () {
  const h = sprOrigEinst.call(this); if (setSec) return h;
  const row = `<button class="drow" data-act="setsec" data-k="sprache"><span class="setic"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></span><span class="dt"><b>Sprachbefehle</b><small>Welche Sätze Mirella versteht</small></span><span class="chev">›</span></button>`;
  const mark = '<div class="sethead2">Mirella</div>', i = h.indexOf(mark); return i < 0 ? h + row : h.slice(0, i) + row + h.slice(i);
};
