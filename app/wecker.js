/* Mirella – Wecker nach Ankunftszeit und Verkehr, und der Nerv-Modus.
   „Ich muss morgen um 6 in Remseck sein“: Mirella rechnet Fahrzeit (mit Google Maps-Schlüssel live mit Verkehr,
   sonst freie Route + Berufsverkehr-Zuschlag), Puffer und deine Zeit zu Hause zurück und schlägt die Weckzeiten vor.
   Ein echter, lauter iPhone-Wecker geht erst in der iPhone-App (Apple AlarmKit); bis dahin: Kurzbefehl oder Kalender-Alarm. */
"use strict";

async function geocode(q) {
  if (!q) return null;
  const lat = S.settings.wxLat || 48.8, lon = S.settings.wxLon || 9.2;
  const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=de&limit=1&lat=${lat}&lon=${lon}`);
  const j = await r.json(); const f = (j.features || [])[0]; if (!f) return null;
  return { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], name: fmtAddr(f.properties) || q };
}
async function routeOSRM(a, b) {
  const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`);
  const j = await r.json(); if (!j.routes || !j.routes[0]) throw new Error("Keine Route gefunden");
  return { min: j.routes[0].duration / 60, km: j.routes[0].distance / 1000 };
}
/* Google Routes API: Fahrzeit mit vorhergesagtem Verkehr zur geplanten Abfahrt */
async function routeGoogle(a, b, depart) {
  const r = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": S.settings.gmapsKey, "X-Goog-FieldMask": "routes.duration,routes.distanceMeters" },
    body: JSON.stringify({ origin: { location: { latLng: { latitude: a.lat, longitude: a.lon } } }, destination: { location: { latLng: { latitude: b.lat, longitude: b.lon } } }, travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE_OPTIMAL", departureTime: depart.toISOString(), languageCode: "de-DE" })
  });
  const j = await r.json(); if (!r.ok || !j.routes || !j.routes[0]) throw new Error((j.error && j.error.message) || "Google Maps antwortet nicht");
  return { min: parseInt(j.routes[0].duration) / 60, km: (j.routes[0].distanceMeters || 0) / 1000 };
}
async function planAlarm(w) {
  const s = S.settings;
  let from = w.fromLat != null ? { lat: w.fromLat, lon: w.fromLon } : null, to = w.toLat != null ? { lat: w.toLat, lon: w.toLon } : null;
  if (!from) { if (w.from) from = await geocode(w.from); else if (s.homeLat != null) from = { lat: s.homeLat, lon: s.homeLon }; else if (s.wxLat != null) from = { lat: s.wxLat, lon: s.wxLon }; }
  if (!to) to = await geocode(w.to);
  if (!from) throw new Error("Start unbekannt: Zuhause-Adresse unter Einstellungen › Wecker eintragen");
  if (!to) throw new Error("Ziel nicht gefunden");
  w.fromLat = from.lat; w.fromLon = from.lon; w.toLat = to.lat; w.toLon = to.lon; if (to.name && !w.toName) w.toName = to.name;
  const base = await routeOSRM(from, to);
  let min = base.min * L.trafficFactor(w.date, w.arrive), src = "Route ohne Live-Verkehr, mit Zuschlag für Berufsverkehr";
  if (s.gmapsKey) {
    try {
      for (let i = 0; i < 2; i++) { const p = L.wakePlan({ date: w.date, arrive: w.arrive, travelMin: min, prepMin: 0, bufMin: w.bufMin, count: 1 }); const dep = new Date(p.leaveDate + "T" + p.leave + ":00"); if (dep < new Date()) break; min = (await routeGoogle(from, to, dep)).min; src = "Google Maps mit Verkehrsvorhersage"; }
    } catch (e) { src = "Google Maps nicht erreichbar (" + e.message + "), daher mit Zuschlag gerechnet"; }
  }
  w.travelMin = Math.round(min); w.km = Math.round(base.km); w.src = src; w.checked = Date.now();
  Object.assign(w, L.wakePlan({ date: w.date, arrive: w.arrive, travelMin: w.travelMin, prepMin: w.prepMin, bufMin: w.bufMin, count: w.count, gap: w.gap }));
  return w;
}

function weckerForm(w, preset = {}) {
  const s = S.settings;
  const v = w || Object.assign({ to: "", from: "", date: addDays(today(), 1), arrive: "08:00", prepMin: s.prepMin, bufMin: s.bufMin, count: s.alarmCount, gap: s.alarmGap }, preset);
  openSheet(`<div data-draft="wecker:${w ? w.id : "new"}"><p class="stitle">⏰ ${w ? "Wecker ändern" : "Neuer Wecker"}</p>
  <div class="fld" style="position:relative"><label for="w-to">Wo musst du hin?</label><input id="w-to" value="${esc(v.to)}" placeholder="z. B. Remseck, Hauptstraße 5" autocomplete="off"><div id="w-to-sug" class="sug" hidden></div></div>
  <div class="fgrid"><div class="fld"><label for="w-date">Wann?</label><input id="w-date" type="date" value="${esc(v.date)}"></div><div class="fld"><label for="w-arr">Ankommen um</label><input id="w-arr" type="time" value="${esc(v.arrive)}"></div></div>
  <div class="fld" style="position:relative"><label for="w-from">Start</label><input id="w-from" value="${esc(v.from)}" placeholder="${esc(s.homeAddr ? "Zuhause: " + s.homeAddr : "Zuhause (in Einstellungen eintragen)")}" autocomplete="off"><div id="w-from-sug" class="sug" hidden></div></div>
  <div class="fgrid"><div class="fld"><label for="w-prep">Zeit daheim (Duschen …)</label><select id="w-prep">${[15, 20, 30, 45, 60, 75, 90].map(m => `<option value="${m}"${+v.prepMin === m ? " selected" : ""}>${m} Min.</option>`).join("")}</select></div><div class="fld"><label for="w-buf">Puffer unterwegs</label><select id="w-buf">${[0, 5, 10, 15, 20, 30].map(m => `<option value="${m}"${+v.bufMin === m ? " selected" : ""}>${m} Min.</option>`).join("")}</select></div></div>
  <div class="fgrid"><div class="fld"><label for="w-cnt">Anzahl Wecker</label><select id="w-cnt">${[1, 2, 3, 4, 5].map(m => `<option value="${m}"${+v.count === m ? " selected" : ""}>${m}</option>`).join("")}</select></div><div class="fld"><label for="w-gap">Abstand</label><select id="w-gap">${[3, 5, 10].map(m => `<option value="${m}"${+v.gap === m ? " selected" : ""}>${m} Min.</option>`).join("")}</select></div></div>
  <div id="w-res"></div>
  <div class="row2">${w ? `<button class="btn danger" data-act="delwecker" data-id="${w.id}" style="flex:none">Löschen</button>` : ""}<button class="btn" data-act="cancel">Abbrechen</button><button class="btn pri" data-act="calcwecker" data-id="${w ? w.id : ""}">Berechnen</button></div></div>`, () => {
    addrSuggest($("#w-to"), $("#w-to-sug")); addrSuggest($("#w-from"), $("#w-from-sug"));
    if (w && w.wake) $("#w-res").innerHTML = resHTML(w);
  });
}
function resHTML(w) {
  return `<div class="wres"><div class="wbig">${esc(w.alarms.join(" · "))}</div><small>${w.wakeDate !== w.date ? "am Vortag · " : ""}Aufstehen ${esc(w.wake)} · Losfahren ${esc(w.leave)} · ${w.travelMin} Min. Fahrt (${w.km} km)</small><small>${esc(w.src)}</small></div>
  <div style="display:grid;gap:8px;margin-top:8px"><button class="btn pri" data-act="savewecker" data-id="${w.id || ""}">Wecker speichern</button><button class="btn" data-act="shortcut" data-id="${w.id || ""}">In den iPhone-Wecker (Kurzbefehl)</button><button class="btn" data-act="wics" data-id="${w.id || ""}">Als Kalender-Alarm</button></div>`;
}
let wDraft = null;
function readWecker(id) {
  const old = id && S.alarms.find(x => x.id === id);
  const w = Object.assign({}, old || {}, { to: $("#w-to").value.trim(), from: $("#w-from").value.trim(), date: $("#w-date").value, arrive: $("#w-arr").value, prepMin: +$("#w-prep").value, bufMin: +$("#w-buf").value, count: +$("#w-cnt").value, gap: +$("#w-gap").value });
  if (old && (old.to !== w.to)) { delete w.toLat; delete w.toLon; delete w.toName; }
  if (old && (old.from !== w.from)) { delete w.fromLat; delete w.fromLon; }
  return w;
}
function alarmTimes(w) { return w.alarms.map(t => new Date(w.wakeDate + "T" + t + ":00")); }
function weckerICS(w) {
  const st = new Date(w.wakeDate + "T" + w.wake + ":00"), f = d => `${iso(d).replace(/-/g, "")}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const alarms = alarmTimes(w).map(d => ["BEGIN:VALARM", "ACTION:AUDIO", "TRIGGER:" + (d - st >= 0 ? "PT" : "-PT") + Math.abs(Math.round((d - st) / 60e3)) + "M", "END:VALARM"].join("\r\n"));
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mirella//DE", "BEGIN:VEVENT", "UID:" + (w.id || uid()) + "@mirella-wecker", "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z", "DTSTART;TZID=Europe/Berlin:" + f(st), "DTEND;TZID=Europe/Berlin:" + f(new Date(+st + 15 * 60e3)), "SUMMARY:Aufstehen: " + (w.to || "").replace(/[,;]/g, " ") + " um " + w.arrive, "DESCRIPTION:Losfahren " + w.leave + ", " + w.travelMin + " Min. Fahrt", ...alarms, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}

AREA_VIEW.wecker = () => {
  const t = today(), list = S.alarms.filter(w => w.date >= t).sort((a, b) => (a.wakeDate + a.wake) < (b.wakeDate + b.wake) ? -1 : 1), old = S.alarms.filter(w => w.date < t);
  return `<button class="btn pri" data-act="newwecker" style="width:100%;margin-bottom:10px">⏰ Neuer Wecker nach Ankunftszeit</button>
  ${list.length ? list.map(w => `<div class="card${w.date === addDays(t, 1) || w.date === t ? " due" : ""}" role="button" tabindex="0" data-act="openwecker" data-id="${w.id}"><span class="av">⏰</span><span style="min-width:0"><div class="t">${esc(w.alarms.join(" · "))}</div><div class="s">${esc(relDate(w.date))}: um ${esc(w.arrive)} in ${esc(w.to)} · losfahren ${esc(w.leave)}</div></span><span class="chev">›</span></div>`).join("") : empty("Kein Wecker geplant. Sag abends einfach: „Ich muss morgen um 6 in Remseck sein.“")}
  <div class="hint"><b>So funktioniert’s:</b> Ziel und Ankunft eintragen. Mirella rechnet die Fahrzeit${S.settings.gmapsKey ? " mit Google Maps und Verkehrsvorhersage" : " (ohne Google-Schlüssel mit Zuschlag für Berufsverkehr)"}, zieht Puffer und deine Zeit zu Hause ab und schlägt ${S.settings.alarmCount} Wecker im ${S.settings.alarmGap}-Minuten-Abstand vor. Ist Mirella morgens offen, rechnet sie mit dem aktuellen Verkehr nach und meldet sich, wenn du früher los musst.<br><br>Ein echter Wecker, der auch bei geschlossener App und Stummschaltung klingelt, kommt mit der iPhone-App. Bis dahin: „In den iPhone-Wecker“ (einmal einen Kurzbefehl anlegen, Anleitung unter Einstellungen › Wecker) oder „Als Kalender-Alarm“.</div>
  ${old.length ? `<button class="mini" data-act="clearwecker">${old.length} alte Wecker löschen</button>` : ""}`;
};
function weckerSettings() {
  const s = S.settings;
  return `${setH("Zuhause")}<form class="shoprow" data-form="home" style="margin:0 0 6px"><input class="search" style="margin:0" value="${esc(s.homeAddr || "")}" placeholder="Deine Adresse, z. B. Musterstraße 1, Stuttgart" aria-label="Zuhause-Adresse"><button class="btn pri" style="flex:none">OK</button></form><p class="hint" style="margin-top:0">Startpunkt für den Wecker. ${s.homeLat != null ? "Gespeichert." : "Noch nicht festgelegt."}</p>
  ${setH("Standard")}${setSel("prepMin", "Zeit zu Hause", "Duschen, Frühstücken", [[15, "15 Min."], [20, "20 Min."], [30, "30 Min."], [45, "45 Min."], [60, "60 Min."], [90, "90 Min."]])}${setSel("bufMin", "Puffer unterwegs", "Parkplatz, Stau", [[0, "keiner"], [5, "5 Min."], [10, "10 Min."], [15, "15 Min."], [20, "20 Min."]])}${setSel("alarmCount", "Anzahl Wecker", "", [[1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"]])}${setSel("alarmGap", "Abstand", "zwischen den Weckern", [[3, "3 Min."], [5, "5 Min."], [10, "10 Min."]])}
  ${setH("Verkehr live (Google Maps)")}${setTxt("gmapsKey", "Google-Maps-Schlüssel", s.gmapsKey ? "eingetragen" : "freiwillig, für echte Verkehrslage", "AIza…")}
  <p class="hint">Für die echte Verkehrslage braucht Mirella einen eigenen Schlüssel für die Google „Routes API“ (in der Google Cloud Console anlegen, Abrechnungskonto nötig, für den privaten Gebrauch im kostenlosen Rahmen). Den Schlüssel auf die Adresse felix260796.github.io beschränken. Ohne Schlüssel rechnet Mirella mit der freien Route und einem Zuschlag für den Berufsverkehr.</p>
  ${setH("Kurzbefehl „Mirella Wecker“ (einmalig)")}<p class="hint" style="margin-top:0">Damit „In den iPhone-Wecker“ echte Wecker stellt, einmal in der Kurzbefehle-App einen Kurzbefehl anlegen: Name „Mirella Wecker“. Aktion 1: „Text aufteilen“ (Text: Kurzbefehleingabe, bei: Neue Zeilen). Aktion 2: „Wiederholen mit jedem Objekt“, darin „Wecker erstellen“ mit Uhrzeit = Wiederholungsobjekt und Bezeichnung „Mirella“. Fertig: Mirella übergibt dann alle Weckzeiten auf einmal.</p>`;
}

/* Morgens neu rechnen, wenn die App offen ist */
async function recheck() {
  const t = today(), now = new Date();
  for (const w of S.alarms) {
    if (!w.wake || w.wakeDate !== t || !w.toLat) continue;
    const first = alarmTimes(w)[0]; if (now > new Date(w.date + "T" + w.arrive + ":00") || now < new Date(+first - 3 * 3600e3) || Date.now() - (w.checked || 0) < 15 * 60e3) continue;
    const before = w.wake;
    try { await planAlarm(w); save(); if (w.wake < before) { toast(`Mehr Verkehr: besser schon um ${w.wake} aufstehen, losfahren ${w.leave}`); beep(3); } } catch (_) { }
  }
}

/* ---------- Nerv-Modus ---------- */
const NSN = "mirella.nervsnooze";
const snz = () => { try { return JSON.parse(localStorage.getItem(NSN) || "{}"); } catch (_) { return {}; } };
let actx = null;
function beep(n = 2) {
  if (!S.settings.nervSound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume();
    for (let i = 0; i < n; i++) { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = i % 2 ? 660 : 880; o.connect(g); g.connect(actx.destination); const t0 = actx.currentTime + i * 0.35; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3); o.start(t0); o.stop(t0 + 0.32); }
  } catch (_) { }
}
document.addEventListener("pointerdown", () => { try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch (_) { } }, { once: true });
function nervList() {
  const s = S.settings, n = s.nerv, now = new Date(), h = now.getHours(), t = today(), hm = `${pad(h)}:${pad(now.getMinutes())}`, wd = now.getDay(), out = [], sn = snz();
  const msgOk = msgDays().includes(wd) && h >= (+s.msgFrom || 8) && h < (+s.msgTo || 21);
  if (n.anrufe && callDays().includes(wd) && h >= +s.callFrom && h < +s.callTo) S.people.filter(p => ["late", "due"].includes(callState(p))).slice(0, s.maxCalls).forEach(p => out.push({ k: "c:" + p.id, ic: "📞", t: `${fullName(p)} anrufen`, s: cycLabel(p.cyc), a: "call", id: p.id }));
  if (n.aufgaben && msgOk) S.todos.filter(x => x.list === "todo" && !x.done && (x.nerv || +x.prio === 1) && (!x.date || x.date < t || (x.date === t && (!x.time || x.time <= hm))) && (x.date || +x.prio === 1)).forEach(x => out.push({ k: "t:" + x.id, ic: x.auto ? "⚠️" : "✓", t: x.t, s: x.date ? relDate(x.date) : "Priorität hoch", a: "done", id: x.id }));
  if (n.geburtstage && msgOk) S.people.filter(p => nextBirthday(p) === t && p.congrats !== t.slice(0, 4)).forEach(p => out.push({ k: "b:" + p.id, ic: "🎂", t: `${fullName(p)} hat Geburtstag`, s: "gratulieren", a: "congrats", id: p.id }));
  if (n.supplements) { const sl = suppSlot(), at = { morgens: s.suppMorning, mittags: s.suppNoon, abends: s.suppEvening }[sl] || "08:00"; if (hm >= at) S.items.filter(x => x.kind === "supplement" && x[sl] && !(S.suppLog || {})[t + "|" + sl + "|" + x.id]).forEach(x => out.push({ k: "s:" + t + sl + x.id, ic: "💊", t: `${x.name} nehmen`, s: sl, a: "supp", id: t + "|" + sl + "|" + x.id })); }
  return out.filter(x => !(sn[x.k] > Date.now()));
}
let nervShown = 0;
function nervCheck(force) {
  if (document.hidden || $("#sheet").classList.contains("open") || document.querySelector(".nerv,.pdfview,.imgfull,.zv")) return;
  if (!force && Date.now() - nervShown < (+S.settings.nervEvery || 30) * 60e3) return;
  const list = nervList(); if (!list.length) return;
  nervShown = Date.now(); beep(2);
  const o = document.createElement("div"); o.className = "nerv"; o.setAttribute("role", "alertdialog"); o.setAttribute("aria-label", "Mirella erinnert dich");
  o.innerHTML = `<div class="nbox"><img src="./logo-final.svg" alt="" width="40"><p class="stitle" style="margin:8px 0 4px">Mirella lässt nicht locker</p><p class="swipehint" style="text-align:left;margin:0 0 10px">${list.length === 1 ? "Das ist noch offen:" : list.length + " Sachen sind noch offen:"}</p>${list.map(x => `<div class="nrow" data-k="${esc(x.k)}"><span class="pic">${x.ic}</span><span class="grow"><b>${esc(x.t)}</b><small>${esc(x.s)}</small></span><button class="mini" data-n="${x.a}" data-id="${esc(x.id)}" data-k="${esc(x.k)}">${{ call: "Anrufen", done: "Erledigt", congrats: "Gratuliert", supp: "Genommen" }[x.a]}</button></div>`).join("")}<div class="row2"><button class="btn" data-n="later">Später (1 Std.)</button><button class="btn pri" data-n="ok">Verstanden</button></div></div>`;
  o.addEventListener("click", e => {
    const b = e.target.closest("[data-n]"); if (!b) return; e.stopPropagation(); const nm = b.dataset.n, id = b.dataset.id;
    if (nm === "later") { const sn = snz(); list.forEach(x => sn[x.k] = Date.now() + 3600e3); try { localStorage.setItem(NSN, JSON.stringify(sn)); } catch (_) { } o.remove(); return; }
    if (nm === "ok") { o.remove(); return; }
    if (nm === "call") { o.remove(); const p = S.people.find(x => x.id === id); if (p) { if (p.tel) callResult(p, true); else { cur = p.id; view = "akte"; render(); } } return; }
    if (nm === "done") toggleTodo(id);
    if (nm === "congrats") { const p = S.people.find(x => x.id === id); if (p) { p.congrats = today().slice(0, 4); save(); } }
    if (nm === "supp") { S.suppLog = S.suppLog || {}; S.suppLog[id] = 1; save(); render(true); }
    const row = b.closest(".nrow"); row && row.remove(); if (!o.querySelector(".nrow")) o.remove();
  });
  document.body.appendChild(o);
}
/* Wecker klingeln lassen, solange Mirella offen ist */
function ringCheck() {
  const now = Date.now(), done = S.settings.ringDone || {};
  for (const w of S.alarms) { if (!w.wake) continue; for (const d of alarmTimes(w)) { const k = w.id + "@" + +d; if (now >= +d && now - d < 10 * 60e3 && !done[k] && !document.querySelector(".nerv")) { done[k] = 1; S.settings.ringDone = done; save(); beep(8); const o = document.createElement("div"); o.className = "nerv"; o.innerHTML = `<div class="nbox" style="text-align:center"><div style="font-size:54px">⏰</div><p class="stitle" style="margin:6px 0">Aufstehen, ${esc(S.settings.name || "")}!</p><p class="hint">Um ${esc(w.arrive)} in ${esc(w.to)}. Losfahren um ${esc(w.leave)}.</p><button class="btn pri" style="width:100%">Ich bin wach</button></div>`; o.querySelector("button").onclick = () => o.remove(); document.body.appendChild(o); } } }
}

/* ---------- Sprache: „Wecker morgen um 6 in Remseck“ ---------- */
function weckerFromText(text) {
  const low = text.toLowerCase();
  if (!/(wecker|weck mich|wecke mich|aufwecken|muss .*\bum\b.*\b(sein|da sein)\b)/.test(low)) return null;
  const w = parseWhen(text);
  const m = text.match(/\b(?:in|nach|bei|im|zum|zur)\s+([A-ZÄÖÜ][\wäöüß.-]*(?:[\s,]+[A-ZÄÖÜ0-9][\wäöüß.-]*){0,4})/);
  const to = m ? m[1].replace(/\s+(sein|da)$/i, "").trim() : "";
  return { to, date: w.date || addDays(today(), 1), arrive: w.time || "08:00" };
}
const origVoiceReview = voiceReview;
voiceReview = function () {
  const txt = (($("#v-text") || {}).value || "").trim();
  const wk = txt && weckerFromText(txt);
  if (wk) { recStop(); weckerForm(null, wk); if (wk.to) setTimeout(() => ACT.calcwecker({ dataset: { id: "" } }), 50); return; }
  if (txt && /^(wie|wo|was|warum|kann ich|hilfe)\b/i.test(txt) && typeof askMirella === "function") { recStop(); askMirella(txt); return; }
  if (txt && /waschmaschine\s+(läuft|ist an|gestartet|angemacht|an\b)/i.test(txt)) { recStop(); const d = new Date(Date.now() + (+S.settings.washMin || 120) * 60e3); S.todos.push({ id: uid(), t: "Waschmaschine ausräumen", list: "todo", done: false, created: today(), date: iso(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}`, trig: "zeit", rep: "nie", area: "haus", nerv: true, prio: 2 }); save(); closeSheet(); render(true); toast(`Ich erinnere dich um ${pad(d.getHours())}:${pad(d.getMinutes())} ans Ausräumen`); return; }
  origVoiceReview();
};

Object.assign(ACT, {
  newwecker: () => weckerForm(null),
  openwecker: el => weckerForm(S.alarms.find(x => x.id === el.dataset.id)),
  calcwecker: async el => {
    const w = readWecker(el.dataset.id); if (!w.to) { toast("Bitte eintragen, wo du hin musst"); return; } if (!w.date || !w.arrive) { toast("Bitte Datum und Ankunft eintragen"); return; }
    const res = $("#w-res"); res.innerHTML = '<div class="hint">Mirella rechnet die Route …</div>';
    try { await planAlarm(w); wDraft = w; res.innerHTML = resHTML(w); res.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
    catch (e) { res.innerHTML = `<div class="hint" style="border:1px solid var(--late)">${esc(e.message || "Route konnte nicht berechnet werden")}${/^Start/.test(e.message) ? "" : ". Prüfe die Adresse oder die Internetverbindung."}</div>`; }
  },
  savewecker: el => { const w = wDraft || readWecker(el.dataset.id); if (!w.wake) return; if (!w.id) { w.id = uid(); S.alarms.push(w); } else { const i = S.alarms.findIndex(x => x.id === w.id); if (i >= 0) S.alarms[i] = w; else S.alarms.push(w); } wDraft = null; draftClear(); save(); closeSheet(); area = "wecker"; view = "bereich"; render(); toast(`Wecker gespeichert: ${w.alarms.join(", ")}`); },
  shortcut: el => { const w = wDraft || S.alarms.find(x => x.id === el.dataset.id); if (!w || !w.alarms) return; location.href = "shortcuts://run-shortcut?name=" + encodeURIComponent("Mirella Wecker") + "&input=text&text=" + encodeURIComponent(w.alarms.join("\n")); },
  wics: el => { const w = wDraft || S.alarms.find(x => x.id === el.dataset.id); if (!w || !w.alarms) return; location.href = "data:text/calendar;charset=utf-8," + encodeURIComponent(weckerICS(w)); },
  delwecker: el => { const w = S.alarms.find(x => x.id === el.dataset.id); if (!w || !ask(`Wecker für ${w.to} löschen?`)) return; S.alarms = S.alarms.filter(x => x !== w); draftClear(); save(); closeSheet(); render(true); },
  clearwecker: () => { if (!ask("Alle vergangenen Wecker löschen?")) return; S.alarms = S.alarms.filter(w => w.date >= today()); save(); render(true); }
});
document.addEventListener("submit", e => {
  const f = e.target; if (f.dataset.form !== "home") return; e.preventDefault(); e.stopImmediatePropagation();
  const v = f.querySelector("input").value.trim(); if (!v) return;
  geocode(v).then(g => { if (!g) { toast("Adresse nicht gefunden"); return; } S.settings.homeAddr = v; S.settings.homeLat = g.lat; S.settings.homeLon = g.lon; S.alarms.forEach(w => { if (!w.from) { delete w.fromLat; delete w.fromLon; } }); save(); render(true); toast("Zuhause gespeichert"); }).catch(() => toast("Adresssuche gerade nicht erreichbar"));
}, true);

HOOKS.heuteTop.push(() => {
  const t = today(), w = S.alarms.filter(x => x.wake && (x.wakeDate === t || x.wakeDate === addDays(t, 1)) && new Date(x.date + "T" + x.arrive) > new Date()).sort((a, b) => (a.wakeDate + a.wake) < (b.wakeDate + b.wake) ? -1 : 1)[0];
  return w ? `<div class="card" role="button" tabindex="0" data-act="openwecker" data-id="${w.id}"><span class="av">⏰</span><span style="min-width:0"><div class="t">Wecker ${w.wakeDate === t ? "heute" : "morgen"} ${esc(w.alarms[0])}</div><div class="s">um ${esc(w.arrive)} in ${esc(w.to)} · losfahren ${esc(w.leave)}</div></span></div>` : "";
});
HOOKS.events.push((from, to) => S.alarms.filter(w => w.wake && w.wakeDate >= from && w.wakeDate <= to).map(w => ({ d: w.wakeDate, c: "erin", k: "Wecker", t: `${w.alarms[0]} · ${w.to} um ${w.arrive}`, act: "openwecker", id: w.id, time: w.wake })));
HOOKS.start.push(() => { setTimeout(() => nervCheck(true), 1500); recheck(); setInterval(() => { ringCheck(); nervCheck(); }, 20e3); setInterval(recheck, 5 * 60e3); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(() => { ringCheck(); nervCheck(true); recheck(); }, 800); });
