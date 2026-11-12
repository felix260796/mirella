/* Mirella – nur in der echten iPhone-App (TestFlight):
   Start-Assistent, iPhone-Kontakte, iPhone-Kalender, Mitteilungen und Push.
   In Safari bzw. auf dem PC tut diese Datei nichts. */
"use strict";
(function () {
  if (!NATIVE) return;
  const P = window.Capacitor.Plugins;
  const NK = "mirella.native"; // nur dieses Gerät
  let N = {}; try { N = JSON.parse(localStorage.getItem(NK) || "{}"); } catch (_) { }
  const nSave = () => { try { localStorage.setItem(NK, JSON.stringify(N)); } catch (_) { } };
  const pad2 = n => String(n).padStart(2, "0");
  const isoOf = ms => { const d = new Date(ms); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
  S.settings.appleIgnored = S.settings.appleIgnored || [];

  /* ---------- Freigaben (einmal, alle zusammen) ---------- */
  async function askAll(log) {
    const step = async (label, fn) => { try { const r = await fn(); log(label, r !== false); } catch (e) { log(label, false); } };
    await step("Standort", async () => { const g = await geoOnce(); return !g.err; });
    await step("Mikrofon und Sprache", async () => { const r = await P.SpeechRecognition.requestPermissions(); return r.speechRecognition === "granted"; });
    await step("Kamera und Fotos", async () => { const r = await P.Camera.requestPermissions({ permissions: ["camera", "photos"] }); return r.camera === "granted"; });
    await step("Kontakte", async () => { const r = await P.Contacts.requestPermissions(); return r.contacts === "granted" || r.contacts === "limited"; });
    await step("Kalender", async () => { const r = await P.CapacitorCalendar.requestFullCalendarAccess(); return r.result === "granted"; });
    await step("Mitteilungen", async () => {
      const r = await P.LocalNotifications.requestPermissions(); if (r.display !== "granted") return false;
      await P.PushNotifications.requestPermissions(); await P.PushNotifications.register(); return true;
    });
    if (P.MirellaAlarm) await step("Wecker", async () => { const r = await P.MirellaAlarm.request(); N.alarmState = r.state; nSave(); return r.state === "authorized"; });
  }

  /* ---------- Start-Assistent: alles auf einer Seite, danach nie wieder ---------- */
  function wizard() {
    const loggedIn = syOn();
    openSheet(`<p class="stitle">Willkommen bei Mirella</p>
    <p class="hint" style="margin-top:0">Einmal alles einrichten, danach musst du nichts mehr eingeben.</p>
    <div class="fld"><label for="w-name">Wie soll ich dich nennen?</label><input id="w-name" value="${esc(S.settings.name || "")}" autocomplete="given-name"></div>
    ${loggedIn ? `<p class="hint">Angemeldet als <b>${esc(SY.auth.user.email)}</b>. Deine Daten sind schon da.</p>` : `
    <div class="fld"><label for="w-mail">Mirella-Konto: E-Mail</label><input id="w-mail" type="email" autocomplete="username"></div>
    <div class="fld"><label for="w-pw">Passwort</label><input id="w-pw" type="password" autocomplete="current-password"></div>`}
    <div class="fld"><label for="w-ki">Claude-Schlüssel${typeof kiOn === "function" && kiOn() ? " (schon eingetragen)" : " (freiwillig)"}</label><input id="w-ki" type="password" autocomplete="off" placeholder="sk-ant-… einfügen"></div>
    <div class="fld"><label for="w-gm">Google-Maps-Schlüssel${S.settings.gmapsKey ? " (schon eingetragen)" : " (freiwillig)"}</label><input id="w-gm" type="password" autocomplete="off" placeholder="AIza… einfügen"></div>
    <p class="hint">Beide Schlüssel kannst du auch später unter Einstellungen nachtragen. Der Claude-Schlüssel bleibt nur auf diesem Gerät.</p>
    <p class="hint">Danach fragt dein iPhone nacheinander nach Standort, Mikrofon, Kamera, Kontakten, Kalender, Mitteilungen und Wecker. Bitte jeweils <b>Erlauben</b> tippen.</p>
    <div id="w-log" class="hint" style="display:none"></div>
    <button class="btn pri" data-act="wizgo" style="width:100%">Los geht's</button>`);
  }
  ACT.wizgo = async el => {
    el.disabled = true;
    const name = $("#w-name").value.trim(); if (name) S.settings.name = name;
    if (!syOn() && $("#w-mail").value) { await syLogin($("#w-mail").value, $("#w-pw").value); if (!syOn()) { el.disabled = false; return; } }
    const wk = $("#w-ki").value.trim(), wg = $("#w-gm").value.trim();
    if (wk && typeof KI !== "undefined") { KI.key = wk; kiSave(); }
    if (wg) S.settings.gmapsKey = wg;
    const lg = $("#w-log"); lg.style.display = ""; lg.innerHTML = "";
    await askAll((label, ok) => { lg.innerHTML += `<div>${ok ? "✓" : "–"} ${esc(label)}${ok ? "" : " (später unter Einstellungen › Apps › Mirella)"}</div>`; });
    N.setup = true; N.asked = Object.assign(N.asked || {}, { ki: 1, gmaps: 1 }); nSave(); save();
    lg.innerHTML += "<div>Ich übernehme jetzt deine Kontakte und Geburtstage …</div>";
    const r = await contactsSync(true); await calendarBirthdays(); await calendarEvents();
    lg.innerHTML += `<div>✓ ${(N.cards || []).length} Einträge im Telefonbuch gefunden. Du gehst sie im Reiter Kontakte Karte für Karte durch.</div>`;
    await scheduleLocal();
    el.textContent = "Fertig"; el.disabled = false; el.dataset.act = "wizdone";
  };
  ACT.wizdone = () => { closeAll(); view = "heute"; render(); };

  /* ---------- iPhone-Kontakte ---------- */
  function fromApple(c) {
    const nm = c.name || {};
    let first = nm.given || "", last = nm.family || "";
    if (!first && !last && nm.display) { const parts = nm.display.split(" "); first = parts.shift(); last = parts.join(" "); }
    const phones = c.phones || [];
    const ph = phones.find(x => /mobile|iphone|cell/i.test((x.type || "") + " " + (x.label || ""))) || phones.find(x => x.isPrimary) || phones[0];
    const b = c.birthday || {};
    const bday = b.month && b.day ? `${b.year && b.year > 1900 ? b.year : 1604}-${pad2(b.month)}-${pad2(b.day)}` : "";
    const em = (c.emails || [])[0], a = (c.postalAddresses || [])[0];
    const addr = a ? [a.street, [a.postcode, a.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "";
    return { appleId: c.contactId, first, last, tel: ph && ph.number || "", email: em && em.address || "", bday, addr };
  }
  /* Aussortiert wird nach Name + Nummer gemerkt, weil die iPhone-Kennung auf jedem Gerät anders ist */
  const ckey = c => normName((c.first || "") + " " + (c.last || "")) + "|" + telKey(c.tel);
  const isIgnored = (c, ign) => ign.has(c.appleId) || ign.has(ckey(c));
  const untouched = p => !(p.calls || []).length && !(p.notes || []).length && !(p.ask || []).length && !(p.gifts || []).length && noCycle(p.cyc) && !p.group && !p.gift && !p.pic && !p.nick;
  /* übernommen, aber von Felix noch nicht angeschaut */
  const pending = () => S.people.filter(p => p.appleId && !p.rev && !p.arch && !p.death && untouched(p));
  const isNewPerson = c => Object.assign({ id: uid(), created: today(), calls: [], notes: [], ask: [], gifts: [], cyc: "nur Geburtstag", group: "", gift: false, nick: "" }, c);
  /* first = beim Einrichten alle übernehmen; danach landen neue iPhone-Kontakte als Vorschlag auf „Heute“ */
  async function contactsSync(first) {
    const res = { added: 0, linked: 0, fresh: 0 };
    if (contactsBusy) return res; contactsBusy = true;
    try {
      const perm = await P.Contacts.checkPermissions(); if (perm.contacts !== "granted" && perm.contacts !== "limited") { contactsBusy = false; return res; }
      const { contacts } = await P.Contacts.getContacts({ projection: { name: true, phones: true, emails: true, birthday: true, postalAddresses: true, organization: true } });
      N.aid = N.aid || {}; N.cs = N.cs || {};
      // Die iPhone-Kennung ist auf jedem Gerät anders: N.aid merkt sich die Kennung dieses Geräts je Mirella-Kontakt
      const known = new Map(); for (const p of S.people) { const k = N.aid[p.id] || p.appleId; if (k) known.set(k, p); }
      const ign = new Set(S.settings.appleIgnored), linked = new Set(), writes = [], cards = [], live = new Set((contacts || []).map(x => x.contactId));
      const fresh = [];
      for (const raw of contacts || []) {
        const c = fromApple(raw); if (!c.first && !c.last) continue;
        if (known.has(c.appleId)) { const p = known.get(c.appleId); linked.add(p.id); if (twoWay(p, c, raw, writes)) res.linked++; continue; }
        if (isIgnored(c, ign)) continue;
        // Derselbe Kontakt auf einem anderen Gerät (iPad): gleicher Name und gleiche Nummer, hier noch nicht verknüpft. Das ist nur Wiedererkennen, kein Zusammenführen.
        const twin = ckey(c).length > 3 && S.people.find(p => !linked.has(p.id) && !p.local && !p.arch && !live.has(N.aid[p.id] || p.appleId || "") && ckey(p) === ckey(c));
        if (twin) { N.aid[twin.id] = c.appleId; linked.add(twin.id); if (twoWay(twin, c, raw, writes)) res.linked++; continue; }
        cards.push(cardOf(raw, c)); // wartet als Karte, bis Felix entschieden hat
      }
      // Karten vom letzten Mal behalten, was Felix schon daran gemacht hat (Geburtstag aus dem Kalender, Notizen)
      const oldC = new Map((N.cards || []).map(x => [x.appleId, x]));
      for (const x of cards) { const o = oldC.get(x.appleId); if (o) { if (!x.bday && o.bday) x.bday = o.bday; if (o.notes) x.notes = o.notes; if (o.bsrc && x.bday === o.bday) x.bsrc = o.bsrc; } }
      res.added = cards.filter(x => !oldC.has(x.appleId)).length; N.cards = cards; liveIds = live;
      N.contactsDone = true; N.freshContacts = fresh; res.fresh = fresh.length; res.ok = true;
      // Neu in Mirella angelegte Kontakte auch im iPhone-Telefonbuch anlegen (nur ab dem Tag, an dem das Zurückschreiben eingeschaltet wurde)
      if (!N.twoWayFrom) N.twoWayFrom = today();
      if (twoWayOn()) for (const p of S.people) {
        if (linked.has(p.id) || p.appleId || N.aid[p.id] || p.local || p.arch || p.death || !(p.first || p.last) || !p.created || p.created < N.twoWayFrom || N.cs[p.id]) continue;
        writes.push({ p, neu: true, o: { given: p.first || "", family: p.last || "", birthday: p.bday || "", phone: p.tel || "", email: p.email || "" } });
      }
      nSave();
      if (res.added || res.linked) save();
      if (writes.length) res.written = await writeBack(writes);
    } catch (e) { console.warn("Kontakte", e); }
    contactsBusy = false; peopleSig = pSig();
    return res;
  }

  /* ---------- Beidseitig: Änderungen aus Mirella ins iPhone-Telefonbuch und umgekehrt ---------- */
  const twoWayOn = () => N.twoWay !== false && !!P.MirellaContacts;
  const hsh = a => { let h = 5381; const s2 = a.join("\u0001"); for (let i = 0; i < s2.length; i++) h = ((h << 5) + h + s2.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const CF = ["first", "last", "tel", "email", "bday"];
  const md = b => (b || "").slice(5), hasYear = b => !!b && !b.startsWith("1604");
  function twoWay(p, c, raw, writes) {
    const before = JSON.stringify(p);
    const tels = new Set((raw.phones || []).map(x => telKey(x.number)).filter(Boolean)), mails = new Set((raw.emails || []).map(x => (x.address || "").toLowerCase()).filter(Boolean));
    const st = N.cs[p.id], mh = hsh(CF.map(k => p[k] || "")), ah = hsh(CF.map(k => c[k] || ""));
    const mCh = st && st.m !== mh, aCh = st && st.a !== ah;
    // 1. iPhone -> Mirella: Leeres immer auffüllen; Geändertes übernehmen, wenn nur das iPhone geändert wurde
    for (const k of ["tel", "email", "bday", "addr"]) if (!p[k] && c[k]) p[k] = c[k];
    if (aCh && !mCh) {
      if (c.first || c.last) { p.first = c.first; p.last = c.last; }
      if (c.tel && p.tel && !tels.has(telKey(p.tel))) p.tel = c.tel;
      if (c.email && p.email && !mails.has(p.email.toLowerCase())) p.email = c.email;
      if (c.bday && (md(c.bday) !== md(p.bday) || (hasYear(c.bday) && c.bday !== p.bday))) p.bday = c.bday;
    }
    // 2. Mirella -> iPhone: was dem iPhone fehlt, immer; Geändertes, wenn es in Mirella geändert wurde
    if (twoWayOn()) {
      const o = {};
      if (mCh && (p.first !== c.first || p.last !== c.last) && (p.first || p.last)) { o.given = p.first || ""; o.family = p.last || ""; }
      if (p.bday && (!c.bday || (mCh && p.bday !== c.bday) || (hasYear(p.bday) && !hasYear(c.bday) && md(p.bday) === md(c.bday)))) o.birthday = p.bday;
      if (p.tel && telKey(p.tel) && !tels.has(telKey(p.tel))) o.phone = p.tel;
      if (p.email && !mails.has(p.email.toLowerCase())) o.email = p.email;
      if (Object.keys(o).length) { o.id = c.appleId; writes.push({ p, o }); }
    }
    N.cs[p.id] = { m: hsh(CF.map(k => p[k] || "")), a: ah };
    return JSON.stringify(p) !== before;
  }
  async function writeBack(writes) {
    let n = 0;
    for (const w of writes.slice(0, 300)) {
      try {
        const r = await P.MirellaContacts.upsert(w.o);
        if (w.neu && r.id) { N.aid[w.p.id] = r.id; if (!w.p.appleId) w.p.appleId = r.id; N.cs[w.p.id] = { m: hsh(CF.map(k => w.p[k] || "")), a: "" }; }
        if (r.changed) n++;
      } catch (e) { console.warn("Telefonbuch", e); }
    }
    nSave(); if (writes.some(w => w.neu)) save();
    if (n) toast(n === 1 ? "1 Kontakt im iPhone-Telefonbuch aktualisiert" : n + " Kontakte im iPhone-Telefonbuch aktualisiert");
    return n;
  }
  const pSig = () => hsh(S.people.map(p => p.id + CF.map(k => p[k] || "").join("|")));
  let contactsBusy = false, peopleSig = "", pT = null;
  function peopleChanged() { if (!N.setup || !twoWayOn() || contactsBusy) return; const s2 = pSig(); if (s2 === peopleSig) return; peopleSig = s2; clearTimeout(pT); pT = setTimeout(async () => { await contactsSync(false); render(true); }, 2500); }
  const origHeute = R.heute;
  heuteSkip = p => !!p.appleId && !p.rev && !p.arch && !p.death && untouched(p); // ungeprüfte übernommene Kontakte erscheinen nicht auf „Heute“ (Wunsch Felix: dort nur die fälligen Anrufe)

  /* ---------- iPhone-Kalender ---------- */
  async function calOk() { try { const r = await P.CapacitorCalendar.checkPermission({ scope: "readCalendar" }); return r.result === "granted"; } catch (_) { return false; } }
  /* Geburtstags-Kalender lesen und mit den Kontakten verknüpfen (Querverweise).
     Sichere Treffer (gleicher voller Name) verknüpft Mirella selbst, den Rest zeigt sie zum Antippen. */
  const BSTOP = new Set(["geburtstag", "geburtstage", "geburtstags", "geb", "birthday", "bday", "von", "hat", "wird", "jahre", "jahr", "der", "die", "und"]);
  const btokens = s => normName((s || "").replace(/\(.*?\)/g, " ")).split(" ").filter(w => w && !BSTOP.has(w));
  const ptokens = p => normName(fullName(p) + " " + (p.nick || "")).split(" ").filter(Boolean);
  const tokHit = (a, b) => a === b || a === b + "s" || (a.length > 3 && a.slice(0, -1) === b && a.endsWith("s"));
  const bLinks = () => (S.settings.bdayLinks = S.settings.bdayLinks || {});
  function bCandidates(b, people) {
    const out = [];
    for (const p of people || S.people) {
      if (p.arch) continue;
      const pt = ptokens(p); let hit = 0;
      for (const t of b.tok) if (pt.some(x => tokHit(t, x))) hit++;
      if (!hit) continue;
      const sameDay = p.bday && p.bday.slice(5) === b.md;
      const full = hit === b.tok.length && b.tok.length >= 2 && pt.filter(x => x !== normName(p.nick || "")).length <= b.tok.length;
      out.push({ p, score: hit * 2 + (sameDay ? 3 : 0) + (full ? 4 : 0), sure: full || (sameDay && hit === b.tok.length) });
    }
    return out.sort((x, y) => y.score - x.score);
  }
  function bApply(b, p) {
    if (!p.bday) { p.bday = (b.year || 1604) + "-" + b.md; return true; }
    if (b.year && p.bday.startsWith("1604-") && p.bday.slice(5) === b.md) { p.bday = b.year + "-" + b.md; return true; }
    return false;
  }
  async function calendarBirthdays() {
    if (!(await calOk())) return 0;
    let n = 0;
    try {
      const cals = (await P.CapacitorCalendar.listCalendars()).result || [];
      const auto = cals.filter(c => /geburtstag|birthday|\bgeb\b/i.test((c.title || "") + " " + (c.internalTitle || "")) || c.type === "birthday").map(c => c.id);
      const pick = (N.bcalPick || []).filter(id => cals.some(c => c.id === id));
      const bc = new Set(pick.length ? pick : auto);
      N.cals = cals.map(c => ({ id: c.id, title: c.title || "" })); N.bcals = [...bc];
      const from = Date.now() - 864e5, to = from + 367 * 864e5;
      const evs = (await P.CapacitorCalendar.listEventsInRange({ from, to })).result || [];
      const seen = new Set(), list = [];
      for (const e of evs) {
        if (!(bc.has(e.calendarId) || e.birthdayContactIdentifier)) continue;
        const md = isoOf(e.startDate).slice(5), tok = btokens(e.title);
        if (!tok.length) continue;
        const key = tok.join(" ") + "|" + md; if (seen.has(key)) continue; seen.add(key);
        const ym = /\b(19\d\d|20[0-2]\d)\b/.exec(e.title || "");
        list.push({ key, title: (e.title || "").trim(), md, tok, year: ym ? +ym[1] : 0, cid: e.birthdayContactIdentifier || "" });
      }
      N.bdays = list; nSave();
      const links = bLinks(); let changed = false;
      for (const b of list) {
        let p = links[b.key] && links[b.key] !== "x" ? S.people.find(x => x.id === links[b.key]) : null;
        if (links[b.key] && links[b.key] !== "x" && !p) { delete links[b.key]; changed = true; }
        if (!links[b.key]) {
          p = b.cid && S.people.find(x => x.appleId === b.cid) || null;
          if (p) { links[b.key] = p.id; changed = true; }
        }
        if (p && bApply(b, p)) { n++; changed = true; }
      }
      if (changed) save();
      n += bAuto();
    } catch (e) { console.warn("Kalender", e); }
    return n;
  }
  const bOpen = () => (N.bdays || []).filter(b => !bLinks()[b.key]);
  const bLinkedIds = () => new Set(Object.values(bLinks()).filter(v => v !== "x"));
  const fmtMd = md => +md.slice(3) + "." + +md.slice(0, 2) + ".";

  /* ---------- iPhone-Termine im Mirella-Kalender (nur lesen, bleiben auf dem iPhone) ---------- */
  async function calendarEvents() {
    if (!(await calOk())) return 0;
    try {
      const from = Date.now() - 62 * 864e5, to = Date.now() + 400 * 864e5;
      const evs = (await P.CapacitorCalendar.listEventsInRange({ from, to })).result || [];
      const bc = new Set(N.bcals || []), names = Object.fromEntries((N.cals || []).map(c => [c.id, c.title]));
      const out = [];
      try { await calSync(evs); } catch (e2) { console.warn("Kalender-Abgleich", e2); }
      for (const e of evs) {
        if (bc.has(e.calendarId) || e.birthdayContactIdentifier || (N.mcal && e.calendarId === N.mcal)) continue;
        const d0 = isoOf(e.startDate), d1 = isoOf(Math.max(e.startDate, (e.endDate || e.startDate) - 1));
        const dt = new Date(e.startDate), time = e.isAllDay ? "" : pad2(dt.getHours()) + ":" + pad2(dt.getMinutes());
        out.push({ id: e.id + "@" + d0, t: e.title || "(ohne Titel)", d: d0, e: d1 > d0 ? d1 : "", time, cal: names[e.calendarId] || "", cid: e.calendarId || "", loc: e.location || "" });
      }
      N.events = out; N.eventsAt = Date.now(); nSave();
      return out.length;
    } catch (e) { console.warn("Termine", e); return 0; }
  }
  /* ---------- Beidseitig: Mirella-Termine stehen im iPhone-Kalender „Mirella“, Änderungen dort kommen zurück ---------- */
  // wahl = nur was Felix selbst in den Kalender schickt (Standard seit v0.25: To-dos gehören nicht in den Apple-Kalender),
  // zeit = alles mit Uhrzeit, alle = alles mit Datum, aus
  if (N.calV !== 2) { N.calV = 2; if (!N.calMode || N.calMode === "zeit") N.calMode = "wahl"; }
  const calMode = () => N.calMode || "wahl";
  const calWanted = t => calMode() !== "aus" && t.list === "todo" && t.date && !t.ref && !t.auto && !t.area && t.trig !== "verlassen" && (t.cal || (t.time && calMode() === "zeit") || calMode() === "alle");
  const tSig = t => [t.t, t.date, t.time || ""].join("|");
  const eTime = e => { const d = new Date(e.startDate); return e.isAllDay ? "" : pad2(d.getHours()) + ":" + pad2(d.getMinutes()); };
  const eSig = e => [e.title || "", isoOf(e.startDate), eTime(e)].join("|");
  const evTimes = t => { const allDay = !t.time, start = new Date(t.date + "T" + (t.time || "00:00") + ":00").getTime(); return { startDate: start, endDate: allDay ? start + 864e5 - 1 : start + 60 * 60e3, isAllDay: allDay }; };
  async function mirellaCal() {
    const cals = (await P.CapacitorCalendar.listCalendars()).result || [];
    let c = cals.find(x => x.id === N.mcal) || cals.find(x => (x.title || "") === "Mirella" && x.allowsContentModifications !== false);
    if (!c) { const r = await P.CapacitorCalendar.createCalendar({ title: "Mirella", color: "#111111" }); c = { id: r.id }; }
    if (N.mcal !== c.id) { N.mcal = c.id; nSave(); }
    return c.id;
  }
  let calBusy = false;
  async function calSync(evs) {
    if (calBusy || calMode() === "aus") return; calBusy = true;
    try {
      const map = N.cev = N.cev || {}, gone = N.cgone = N.cgone || {}; let changed = false;
      const need = S.todos.some(t => calWanted(t) && !t.done && !map[t.id] && !gone[t.id]);
      if (!N.mcal && !need) return;
      const cal = await mirellaCal(), C = P.CapacitorCalendar;
      const mine = evs.filter(e => e.calendarId === cal), byId = new Map(mine.map(e => [e.id, e]));
      const lo = Date.now() - 60 * 864e5, hi = Date.now() + 398 * 864e5;
      // 1. Vom iPhone nach Mirella
      for (const [tid, m] of Object.entries(map)) {
        const t = S.todos.find(x => x.id === tid), e = byId.get(m.id);
        if (!t || !t.date) { if (e) try { await C.deleteEvent({ id: m.id }); } catch (_) { } delete map[tid]; continue; }
        if (!calWanted(t) && tSig(t) === m.sig) { if (e) try { await C.deleteEvent({ id: m.id }); } catch (_) { } delete map[tid]; continue; } // gehört nicht (mehr) in den Apple-Kalender, bleibt aber in Mirella
        if (!e) { const at = new Date(m.sig.split("|")[1] + "T12:00:00").getTime(); if (at > lo && at < hi) { delete map[tid]; gone[tid] = 1; } continue; }
        if (eSig(e) !== m.sig && tSig(t) === m.sig) { t.t = e.title || t.t; t.date = isoOf(e.startDate); t.time = eTime(e); m.sig = tSig(t); changed = true; }
      }
      const tracked = new Set(Object.values(map).map(m => m.id));
      for (const e of mine) {
        if (tracked.has(e.id) || e.isPartOfSeries) continue;
        const mark = /Mirella:([\w-]+)/.exec(e.description || "");
        let t = (mark && S.todos.find(x => x.id === mark[1] && !map[x.id])) || S.todos.find(x => x.list === "todo" && !map[x.id] && tSig(x) === eSig(e));
        if (!t) { if (e.startDate < Date.now() - 864e5) continue; t = { id: uid(), t: e.title || "Termin", list: "todo", done: false, created: today(), date: isoOf(e.startDate), time: eTime(e), cal: 1 }; S.todos.push(t); changed = true; }
        map[t.id] = { id: e.id, sig: eSig(e) }; tracked.add(e.id);
      }
      // 2. Von Mirella aufs iPhone
      for (const t of S.todos) {
        const m = map[t.id];
        if (!calWanted(t)) continue;
        const s2 = tSig(t);
        if (!m) {
          if (t.done || gone[t.id] || t.date < isoOf(lo)) continue;
          const r = await C.createEvent(Object.assign({ title: t.t, calendarId: cal, alerts: [], description: "Aus Mirella. Mirella:" + t.id, commit: true }, evTimes(t)));
          if (r && r.id) map[t.id] = { id: r.id, sig: s2 };
        } else if (m.sig !== s2) { try { await C.modifyEvent(Object.assign({ id: m.id, title: t.t }, evTimes(t))); m.sig = s2; } catch (e2) { console.warn("Termin ändern", e2); } }
      }
      nSave();
      if (changed) { todoSig = dSig(); save(); render(true); }
    } finally { calBusy = false; }
  }
  const dSig = () => hsh(S.todos.filter(t => t.list === "todo" && (t.date || (N.cev || {})[t.id])).map(t => t.id + tSig(t) + (t.cal || "")));
  let todoSig = "", dT = null;
  function todosChanged() { if (!N.setup || calMode() === "aus") return; const s2 = dSig(); if (s2 === todoSig) return; todoSig = s2; clearTimeout(dT); dT = setTimeout(async () => { await calendarEvents(); render(true); }, 2500); }
  ACT.ncalmode = async el => { N.calMode = el.dataset.m; nSave(); render(true); if (N.calMode !== "aus") { await calendarEvents(); render(true); } };
  ACT.ntwoway = async () => { N.twoWay = N.twoWay === false; nSave(); render(true); if (N.twoWay) { await contactsSync(false); render(true); } };
  if (!CALF.some(x => x[0] === "termin")) CALF.push(["termin", "iPhone-Termine"]);
  if (S.settings.calFilter.termin === undefined) S.settings.calFilter.termin = 1;
  HOOKS.events.push((from, to) => {
    const out = [];
    const hide = new Set(N.calHide || []);
    for (const e of N.events || []) {
      if (e.cid && hide.has(e.cid)) continue;
      let d = e.d, g = 0;
      do { if (d >= from && d <= to) out.push({ d, c: "termin", k: e.cal || "Termin", t: e.t, act: "iosev", id: e.id, time: d === e.d ? e.time : "" }); d = isoOf(new Date(d + "T12:00:00").getTime() + 864e5); } while (e.e && d <= e.e && g++ < 31);
    }
    // Geburtstage aus dem Kalender, die noch keinem Kontakt zugeordnet sind
    const y0 = +from.slice(0, 4), y1 = +to.slice(0, 4), links = bLinks();
    for (const b of N.bdays || []) { if (links[b.key] && links[b.key] !== "x") continue; for (let y = y0; y <= y1; y++) { const d = y + "-" + b.md; if (d >= from && d <= to) out.push({ d, c: "geb", k: "Geburtstag", t: b.title, act: "kopen", id: "" }); } }
    return out;
  });
  ACT.iosev = el => {
    const e = (N.events || []).find(x => x.id === el.dataset.id); if (!e) return;
    const dd = new Date(e.d + "T12:00:00"), de = e.e ? new Date(e.e + "T12:00:00") : null;
    const fmt = x => x.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    openSheet(`<p class="stitle">${esc(e.t)}</p><div class="listrow"><span class="grow">${esc(fmt(dd))}${de ? " bis " + esc(fmt(de)) : ""}<small>${e.time ? esc(e.time) + " Uhr" : "ganztägig"}</small></span></div>${e.loc ? `<div class="listrow"><span class="grow">${esc(e.loc)}<small>Ort</small></span></div>` : ""}<div class="listrow"><span class="grow">${esc(e.cal || "iPhone-Kalender")}<small>Kalender auf deinem iPhone. Ändern kannst du den Termin in der Kalender-App.</small></span></div><div class="row2" style="margin-top:10px"><button class="btn" data-close="sheet">Schließen</button></div>`);
  };

  /* Termin direkt in den iPhone-Kalender statt .ics-Datei */
  const origIcs = typeof icsOpen === "function" ? icsOpen : null;
  icsOpen = async function (t) {
    if (!t) return;
    try {
      let ok = await calOk(); if (!ok) ok = (await P.CapacitorCalendar.requestFullCalendarAccess()).result === "granted";
      if (!ok) { origIcs && origIcs(t); return; }
      const allDay = !t.time, start = new Date((t.date || today()) + "T" + (t.time || "09:00") + ":00").getTime();
      if (calMode() !== "aus" && t.id && t.date && S.todos.includes(t)) { t.cal = 1; if (N.cgone) delete N.cgone[t.id]; save(); await calendarEvents(); toast("Steht im iPhone-Kalender „Mirella“"); return; }
      await P.CapacitorCalendar.createEvent({ title: t.t, startDate: start, endDate: allDay ? start + 864e5 - 1 : start + 30 * 60e3, isAllDay: allDay, alerts: allDay ? [] : [0], description: "Aus Mirella", commit: true });
      toast("In deinen Kalender eingetragen");
    } catch (e) { toast("Kalender: " + (e && e.message || e)); }
  };

  /* ---------- Mitteilungen auf dem Gerät (auch wenn Mirella zu ist) ---------- */
  const inWin = (d, from, to) => { const h = d.getHours() + d.getMinutes() / 60; return h >= from && h < to; };
  async function scheduleLocal() {
    try {
      const perm = await P.LocalNotifications.checkPermissions(); if (perm.display !== "granted") return;
      const pend = (await P.LocalNotifications.getPending()).notifications || [];
      if (pend.length) await P.LocalNotifications.cancel({ notifications: pend.map(x => ({ id: x.id })) });
      const now = Date.now(), list = []; let id = 1;
      const add = (at, title, body, extra) => { if (at > now + 30e3 && list.length < 60) list.push({ id: id++, title, body, schedule: { at: new Date(at), allowWhileIdle: true }, extra: extra || {}, ...(extra && extra.todo ? { actionTypeId: "MTODO" } : extra && extra.call ? { actionTypeId: "MCALL" } : {}) }); };
      const st = S.settings, nagMin = +(st.nervEvery || 30), nv = st.nerv || {};
      // Wecker zuerst (iOS erlaubt nur 64 geplante Mitteilungen): immer zusätzlich zum echten Wecker eine Mitteilung zur selben Minute,
      // dazu "Jetzt musst du los" zur Abfahrtszeit.
      for (const a of alarmList()) add(a.at, "Wecker", a.title, { wecker: 1 });
      for (const w of S.alarms || []) { if (!w.wake || w.off || !w.leave) continue; const at = +new Date((w.leaveDate || w.date) + "T" + w.leave + ":00"); add(at, "Jetzt musst du los", "Damit du um " + w.arrive + " in " + weckerName(w) + " bist" + (w.travelMin ? " (" + w.travelMin + " Min. unterwegs)" : "") + ".", { wecker: 1 }); }
      for (const t of S.todos) {
        if (t.done || !t.date) continue;
        const at = new Date(t.date + "T" + (t.time || "09:00") + ":00").getTime();
        add(at, t.list === "shop" ? "Einkaufen" : "Mirella", t.t, { todo: t.id });
        if (t.los && t.ort && t.time) { const la = +new Date((t.losDate || t.date) + "T" + t.los + ":00"), wo = String(t.ort).split(",")[0]; add(la - 15 * 60e3, "In 15 Minuten losfahren", t.t + ": " + t.fahrt + " Min. bis " + wo + "."); add(la, "Jetzt musst du los", "Damit du um " + t.time + " bei „" + t.t + "“ in " + wo + " bist (" + t.fahrt + " Min. mit dem Auto)."); }
        if (t.nerv && nv.aufgaben !== 0) for (let k = 1; k <= 6; k++) { const n2 = new Date(Math.max(at, now) + k * nagMin * 60e3); if (inWin(n2, 8, 21)) add(n2.getTime(), "Noch offen", t.t, { todo: t.id }); }
      }
      // Anrufe: werktags um 8 Uhr eine Sammel-Erinnerung, Nerv-Modus bis 18 Uhr
      const live = S.people.filter(p => !p.arch);
      const due = live.filter(p => { const n = nextDue(p); return n && n <= today(); });
      for (let dd = 0; dd < 3; dd++) {
        const day = new Date(); day.setDate(day.getDate() + dd); if (day.getDay() === 0 || day.getDay() === 6) continue;
        const names = (dd === 0 ? due : live.filter(p => { const n = nextDue(p); return n && n <= isoOf(day.getTime()); })).slice(0, st.maxCalls || 3).map(p => p.first || fullName(p));
        if (!names.length) continue;
        for (const hh of (nv.anrufe === 0 ? [8] : [8, 11, 14, 17])) { day.setHours(hh, 0, 0, 0); add(day.getTime(), "Anrufen", names.join(", "), dd === 0 && due[0] ? { call: due[0].id } : {}); }
      }
      // Geburtstage um 9 Uhr
      for (const p of live) {
        const b = nextBirthday(p); if (!b) continue;
        const at = new Date(b + "T09:00:00").getTime(); if (at - now > 30 * 864e5) continue;
        add(at, "Geburtstag", (p.first || fullName(p)) + " hat heute Geburtstag 🎉", { bday: p.id });
      }
      for (const { p, k, b } of kinSoon(30)) { add(new Date(b + "T09:00:00").getTime(), "Geburtstag", k.name + " (" + (k.rel || "Familie") + " von " + fullName(p) + ") hat heute Geburtstag 🎉"); }
      for (const p of live) {
        const b = nextBirthday(p); if (!b) continue;
        const at = new Date(b + "T09:00:00").getTime(); if (at - now > 30 * 864e5) continue;
        if (p.gift) add(at - (st.giftLead || 14) * 864e5, "Geschenk", "In " + (st.giftLead || 14) + " Tagen hat " + (p.first || fullName(p)) + " Geburtstag. Geschenk schon da?");
      }
      if (list.length) await P.LocalNotifications.schedule({ notifications: list });
    } catch (e) { console.warn("Mitteilungen", e); }
    alarmSync();
  }

  let liveSyncRef = null;
  /* ---------- Echter iPhone-Wecker (AlarmKit ab iOS 26): klingelt auch bei geschlossener App und im Stumm-Modus ---------- */
  function alarmList() {
    const now = Date.now(), list = [];
    try { weckerRoll(); } catch (_) { }
    for (const w of S.alarms || []) {
      if (!w.wake || !w.alarms || w.off) continue;
      const nm = weckerName(w), sz = Math.max(1, +w.gap || 5) * 60;
      for (const o of wOccs(w, 7)) {
        if (isAwake(w, o.wakeDate)) continue; // „Ich bin wach“: die weiteren Wecker zu diesem Termin sind aus
        const all = o.alarms.map(t => new Date(o.wakeDate + "T" + t + ":00"));
        all.forEach((d, i) => { if (+d > now + 30e3) list.push({ at: +d, title: nm + (o.leave ? ": los um " + o.leave : "") + (all.length > 1 ? " (Wecker " + (i + 1) + " von " + all.length + ")" : ""), near: +d - now < 23 * 3600e3 ? 1 : 0, snooze: sz }); });
      }
    }
    return list.sort((a, b) => a.at - b.at).slice(0, 40);
  }
  /* „Ich bin wach“ in Mirella: weitere Wecker und Mitteilungen dazu aus, Countdown fürs Losgehen gleich starten */
  window.mirellaAwake = async () => { try { await alarmSync(true); scheduleLocal(); N.liveSig = ""; nSave(); if (typeof liveSyncRef === "function") liveSyncRef(); } catch (_) { } };
  let alarmBusy = false;
  async function alarmSync(force) {
    const A = P.MirellaAlarm; if (!A || alarmBusy) return;
    const list = alarmList(), sig = JSON.stringify(list);
    if (!force && sig === N.alarmSig) return;
    if (!list.length && !N.alarmSig) return; // noch nie einen Wecker gestellt: nicht nach der Erlaubnis fragen
    alarmBusy = true;
    try {
      const r = await A.set({ alarms: list }), was = N.alarmState;
      N.alarmState = r.state; N.alarmSig = r.state === "authorized" ? sig : ""; N.alarmN = r.count || 0; N.alarmErr = r.error || ""; N.alarmAt = Date.now(); nSave();
      if (r.error) toast("Ein Wecker ließ sich nicht stellen: " + String(r.error).slice(0, 80));
      if (r.state === "authorized" && list.length && !r.error) toast("Echter iPhone-Wecker gestellt: " + list.slice(0, 4).map(a => new Date(a.at).toTimeString().slice(0, 5)).join(", "));
      else if (r.state === "denied" && was !== "denied") toast("Wecker ist nicht erlaubt. Einstellungen › Apps › Mirella › Wecker einschalten.");
      if (was !== r.state) scheduleLocal();
    } catch (e) { console.warn("Wecker", e); N.alarmState = "fehler"; nSave(); }
    alarmBusy = false;
  }
  const alarmNote = () => N.alarmState === "authorized" ? "Klingelt als echter iPhone-Wecker, auch wenn Mirella zu ist und das iPhone stumm ist."
    : N.alarmState === "denied" ? "Der echte Wecker ist nicht erlaubt (Einstellungen › Apps › Mirella › Wecker). Bis dahin kommt nur eine Mitteilung."
      : N.alarmState === "unavailable" ? "Der echte Wecker braucht iOS 26. Auf diesem Gerät kommt eine Mitteilung." : "Beim Speichern fragt dein iPhone einmal, ob Mirella Wecker stellen darf.";
  const alarmDiag = () => N.alarmState !== "authorized" ? "" : (N.alarmErr ? ` <b>Achtung: Dein iPhone hat den letzten Wecker nicht angenommen (${esc(String(N.alarmErr).slice(0, 120))}). Die Mitteilung kommt trotzdem.</b>` : N.alarmAt ? ` Beim iPhone angemeldet: ${N.alarmN || 0}.` : "") + " Zur selben Minute kommt zusätzlich eine Mitteilung mit Ton als Sicherheit. In der Uhr-App von Apple steht der Wecker nicht, er gehört zu Mirella.";
  const origRes = resHTML;
  resHTML = function (w) { return origRes(w) + `<p class="hint">${alarmNote()}${alarmDiag()}</p>`; };
  /* Probe: ein Wecker zur übernächsten vollen Minute, damit man den Sperrbildschirm prüfen kann */
  ACT.nweckertest = async () => {
    const A = P.MirellaAlarm; if (!A) return;
    try {
      const at = (Math.floor(Date.now() / 60e3) + 2) * 60e3, d = new Date(at), real = alarmList();
      const r = await A.set({ alarms: real.concat([{ at, title: "Mirella Test-Wecker", near: 1 }]) });
      N.alarmState = r.state; N.alarmSig = r.state === "authorized" ? JSON.stringify(real) : ""; N.alarmErr = r.error || ""; N.alarmN = r.count || 0; N.alarmAt = Date.now(); nSave(); render(true);
      alert(r.state !== "authorized" ? "Mirella darf noch keine echten Wecker stellen (Zustand: " + r.state + "). Bitte unter Einstellungen › Apps › Mirella den Wecker erlauben." : r.error ? "Dein iPhone hat den Test-Wecker nicht angenommen:\n" + r.error : "Der Test-Wecker klingelt um " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + " Uhr. Sperre jetzt dein iPhone und warte. Er muss laut klingeln und groß auf dem Sperrbildschirm stehen.");
    } catch (e) { alert("Der Test-Wecker ging nicht: " + (e && e.message || e)); }
  };
  ACT.nwecker = async () => { try { const r = await P.MirellaAlarm.request(); N.alarmState = r.state; nSave(); await alarmSync(true); render(true); } catch (_) { toast("Das hat nicht geklappt"); } };
  let schedT = null;
  const origSave2 = save;
  save = function () { const ok = origSave2(); clearTimeout(schedT); schedT = setTimeout(scheduleLocal, 1500); try { peopleChanged(); todosChanged(); } catch (_) { } return ok; };

  /* ---------- Push vom Server (z. B. „Dein Briefing ist da“) ---------- */
  P.PushNotifications.addListener("registration", async t => {
    N.pushToken = t.value; nSave();
    if (!syOn()) return;
    try { await sb("/rest/v1/mirella_device", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ token: t.value, user_id: SY.auth.user.id, platform: "ios" }) }); } catch (e) { console.warn("Push-Gerät", e); }
  });
  P.PushNotifications.addListener("pushNotificationActionPerformed", a => { const d = a.notification && a.notification.data || {}; if (d.view) { view = d.view; render(); } });
  /* Knöpfe unter den Mitteilungen: Erledigt, In 1 Stunde, Morgen, Jetzt anrufen */
  try { P.LocalNotifications.registerActionTypes({ types: [
    { id: "MTODO", actions: [{ id: "done", title: "Erledigt" }, { id: "h1", title: "In 1 Stunde" }, { id: "morgen", title: "Morgen" }] },
    { id: "MCALL", actions: [{ id: "call", title: "Jetzt anrufen", foreground: true }, { id: "spaeter", title: "Später" }] }] }); } catch (_) { }
  P.LocalNotifications.addListener("localNotificationActionPerformed", a => {
    const x = a.notification && a.notification.extra || {}, act = a.actionId || "tap";
    if (x.todo) {
      const t = S.todos.find(y => y.id === x.todo);
      if (t && act === "done") { if (!t.done) toggleTodo(t.id); toast("Erledigt: " + t.t); }
      else if (t && act === "h1") { const d = new Date(Date.now() + 3600e3); t.date = isoOf(d.getTime()); t.time = pad(d.getHours()) + ":" + pad(d.getMinutes()); save(); toast("In 1 Stunde wieder: " + t.t); }
      else if (t && act === "morgen") { t.date = addDays(today(), 1); save(); toast("Auf morgen verschoben: " + t.t); }
      else { view = "todos"; }
      render(); scheduleLocal(); return;
    }
    if (x.call) { const p = S.people.find(y => y.id === x.call); if (p && act === "call" && p.tel) { pendingCall = p.id; N.dialAt = Date.now(); location.href = "tel:" + intlTel(p.tel); } else { view = "heute"; render(); } return; }
    if (x.bday) { const p = S.people.find(y => y.id === x.bday); if (p) { cur = p.id; view = "akte"; render(); if (p.tel) grussForm(p); } }
  });

  /* ---------- Kontakte aufräumen ---------- */
  let clF = "alle", clSel = new Set(), clMax = 120, clQ = "";
  /* Vorsortierung: was sehr wahrscheinlich kein Mensch ist (Servicenummern, Mailbox, Taxi, Hotline …) */
  const JUNKW = /(^|[^a-zäöüß])(mailbox|mobilbox|voicemail|sprachbox|sprachnachricht\w*|hotline|service\w*|kundenservice|kundendienst|kundenbetreuung|kundencenter|pannenhilfe|pannendienst|pannen\w*|adac|avd|taxi\w*|notdienst\w*|notruf\w*|notfall\w*|notfinder|apotheke\w*|auskunft|info|infoservice|infoline|news|sms|mms|aufladen|aufladung|guthaben\w*|kontostand|kontoservice|sperr\w*|störung\w*|stoerung\w*|bestell\w*|pizza\w*|lieferservice|lieferando|zentrale|rezeption|support|helpdesk|vodafone|telekom|t-mobile|tmobile|o2|e-plus|eplus|congstar|aldi ?talk|1&1|d1|d2|lufthansa|reiseservice|fahrplan\w*|ansage\w*|zeitansage|wetter\w*|verkehrs\w*|staumeld\w*|bank ?card|kartensperr\w*|ec-karte\w*|kreditkarte\w*|visa|mastercard|paypal|amazon|ebay|dhl|hermes|dpd|ups|gewinnspiel\w*|abo|premium|flirt\w*|chat|voting|tarif\w*|prepaid|callya|xtra|datenvolumen|roaming|ausland\w*|konferenz\w*|einwahl\w*|faxabruf|fax)([^a-zäöüß]|$)/i;
  function junkWhy(p) {
    if ((N.junkAI || {})[p.id]) return N.junkAI[p.id];
    const name = (fullName(p) || "").toLowerCase(), raw = (p.tel || "").replace(/[\s\-\/().]/g, ""), dig = raw.replace(/\D/g, "").replace(/^(0049|49)/, "0");
    if (/[*#]/.test(raw)) return "Kurzwahl mit * oder #";
    if (dig && dig.length <= 6) return "Kurzwahl-Nummer";
    if (/^0(800|180|900|137|138|700|190|32)/.test(dig) || /^(118|116|115|110|112)/.test(dig)) return "Service- oder Sondernummer";
    if (/^[\d\s+\-]*$/.test(name.replace("ohne namen", "")) ) return "Kein Name, nur Zahlen";
    const m = JUNKW.exec(name); if (m) return "Name klingt nach Dienst: „" + m[2] + "“";
    if (!p.tel && !p.email && !p.bday && !p.addr) return "Ohne Nummer, E-Mail und Geburtstag";
    return "";
  }
  const junkList = () => { const linked = bLinkedIds(); return pending().filter(p => !linked.has(p.id) && junkWhy(p)); };
  /* Stapel: dienst = kein Mensch, firma = Firma/Dienstleister, mensch, unklar. Die Mirella-KI (N.cl) geht vor, sonst gelten die Regeln. */
  const FIRMW = /(^|[^a-zäöüß])(gmbh|ag|kg|ohg|ug|e\.? ?v\.?|gbr|firma|praxis|dr\.?|arzt|ärztin|zahnarzt|kanzlei|werkstatt|autohaus|friseur|salon|restaurant|gasthaus|gasthof|hotel|pension|pizzeria|bäckerei|metzgerei|büro|buero|bank|sparkasse|volksbank|versicherung|allianz|stadt|gemeinde|rathaus|schule|kindergarten|kita|verein|club|studio|fitness|physio\w*|klinik\w*|krankenhaus|hausverwaltung|immobilien|vermieter|handwerk\w*|elektro\w*|sanitär\w*|heizung\w*|schreiner\w*|maler\w*|gärtner\w*|reinigung|steuerberat\w*|anwalt|notar)([^a-zäöüß]|$)/i;
  function clsOf(p, linked) {
    if (linked.has(p.id)) return "mensch";
    const k = (N.cl || {})[p.id], jw = junkWhy(p);
    if (k) return k.a === "mensch" && jw && !/^Name klingt/.test(jw) ? "dienst" : k.a; // die KI sieht keine Nummern: Kurzwahlen und Servicenummern bleiben „kein Mensch“
    if (junkWhy(p)) return "dienst";
    if (FIRMW.test((fullName(p) || "").toLowerCase())) return "firma";
    return p.first && p.last ? "mensch" : "unklar";
  }
  const clsWhy = p => { const k = (N.cl || {})[p.id]; return k && k.g ? "Mirella-KI: " + k.g : junkWhy(p); };
  /* Was gehört zusammen? Gleiche Nummer, gleiche E-Mail, gleicher Name ohne Zusatz („Benny Puka“ und „Benny Puka Geschäft“), dazu Vorschläge der Mirella-KI. */
  const SUFW = new Set(["geschaft", "geschaftlich", "arbeit", "buro", "firma", "dienst", "dienstlich", "privat", "handy", "mobil", "mobile", "festnetz", "zuhause", "home", "work", "neu", "alt", "alte", "neue", "nummer", "tel", "telefon", "iphone", "whatsapp", "praxis", "job", "office", "zweit", "zweithandy", "diensthandy", "geschaftshandy", "autotelefon", "auto", "fax", "eltern", "daheim", "mailbox"]);
  const baseName = p => normName(fullName(p)).split(" ").filter(w => w && !SUFW.has(w)).join(" ");
  const sufLabel = p => { const w = normName(fullName(p)).split(" ").filter(x => SUFW.has(x)); const orig = (fullName(p) || "").split(/\s+/).filter(x => SUFW.has(normName(x))); return orig.join(" ") || w.join(" "); };
  const grpKey = ids => ids.slice().sort().join("+");
  function mergeGroups() {
    const live = S.people.filter(p => !p.arch && !p.death), pendIds = new Set(pending().map(p => p.id)), par = new Map(live.map(p => [p.id, p.id])), why = new Map();
    const find = x => { while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); } return x; };
    const uni = (a, b, w) => { const ra = find(a), rb = find(b); if (ra !== rb) par.set(ra, rb); why.set(a + b, w); why.set(b + a, w); };
    const idx = (keyFn, w) => { const m = new Map(); for (const p of live) for (const k of [].concat(keyFn(p)).filter(Boolean)) { if (m.has(k)) uni(m.get(k), p.id, w); else m.set(k, p.id); } };
    idx(p => [telKey(p.tel), ...(p.tels || []).map(x => telKey(x.n))], "gleiche Nummer");
    idx(p => (p.email || "").toLowerCase(), "gleiche E-Mail");
    idx(p => { const b = baseName(p); return b.length > 4 && b.includes(" ") ? b : ""; }, "gleicher Name");
    for (const g of N.grp || []) { const ids = g.filter(id => par.has(id)); for (let i = 1; i < ids.length; i++) uni(ids[0], ids[i], "Mirella-KI"); }
    const by = new Map(); for (const p of live) { const r = find(p.id); (by.get(r) || by.set(r, []).get(r)).push(p); }
    const no = new Set(N.grpNo || []), out = [];
    for (const g of by.values()) {
      if (g.length < 2 || g.length > 6 || !g.some(p => pendIds.has(p.id)) || no.has(grpKey(g.map(p => p.id)))) continue;
      // Ziel: ein schon behaltener Kontakt, sonst der mit dem kürzesten (saubersten) Namen
      g.sort((a, b) => (pendIds.has(a.id) - pendIds.has(b.id)) || (SUFW.size && (sufLabel(a) ? 1 : 0) - (sufLabel(b) ? 1 : 0)) || fullName(a).length - fullName(b).length);
      const tok = p => new Set(baseName(p).split(" ").filter(Boolean)), sub = (a, b) => a.size > 0 && [...a].every(x => b.has(x));
      const t0 = tok(g[0]), sure = g.slice(1).every(p => { const tp = tok(p); return sub(t0, tp) || sub(tp, t0); });
      out.push({ key: grpKey(g.map(p => p.id)), t: g[0], rest: g.slice(1), sure, why: [...new Set(g.slice(1).map(p => why.get(g[0].id + p.id) || why.get(p.id + g[0].id) || "gehört dazu"))].join(", ") });
    }
    return out.sort((a, b) => fullName(a.t).localeCompare(fullName(b.t), "de"));
  }
  function doMerge(g) {
    for (const src of g.rest) {
      mergeInto(g.t, src, sufLabel(src));
      if (src.appleId) S.settings.appleIgnored.push(ckey(src));
      if (N.aid && N.aid[src.id] && !N.aid[g.t.id]) N.aid[g.t.id] = N.aid[src.id];
    }
    const ids = new Set(g.rest.map(p => p.id)); S.people = S.people.filter(p => !ids.has(p.id)); g.t.rev = today();
  }
  const CLF = [["muell", "Kein Mensch"], ["firma", "Firmen"], ["mensch", "Menschen"], ["unklar", "Unklar"], ["alle", "Alle"], ["kal", "Geburtstag im Kalender"], ["geb", "Mit Geburtstag"], ["ohnegeb", "Ohne Geburtstag"], ["ohnenr", "Ohne Nummer"], ["einname", "Nur ein Name"]];
  function clList(f) {
    const linked = bLinkedIds(), ql = clQ.trim().toLowerCase();
    return pending().filter(p => (f === "alle" || (f === "muell" && clsOf(p, linked) === "dienst") || ((f === "firma" || f === "mensch" || f === "unklar") && clsOf(p, linked) === f) || (f === "kal" && linked.has(p.id)) || (f === "geb" && p.bday) || (f === "ohnegeb" && !p.bday) || (f === "ohnenr" && !p.tel) || (f === "einname" && (!p.first || !p.last)))
      && (!ql || (fullName(p) + " " + (p.tel || "") + " " + (p.email || "")).toLowerCase().includes(ql)))
      .sort((a, b) => fullName(a).localeCompare(fullName(b), "de"));
  }
  let clMode = "start";
  /* Startseite des Aufräumens: wenige Stapel mit großen Knöpfen statt langer Listen */
  function clStart() {
    const all = pending(), linked = bLinkedIds(), n = { dienst: 0, firma: 0, mensch: 0, unklar: 0 };
    all.forEach(p => n[clsOf(p, linked)]++);
    const groups = mergeGroups(), ki = typeof kiOn === "function" && kiOn(), nSure = groups.filter(g => g.sure).length;
    const head = `<div class="top"><button class="tleft tsetbtn" data-act="clback" aria-label="Zurück"><p class="big">‹ Aufräumen</p></button></div>`;
    if (!all.length && !groups.length) return head + empty("Alles aufgeräumt. Jeder übernommene Kontakt ist entweder behalten oder aussortiert.") + `<button class="btn" data-act="clback" style="width:100%;margin-top:10px">Zurück</button>`;
    const stack = (title, cnt, text, btns) => cnt ? `<div class="pitem"><b>${title}: ${cnt}</b><div style="margin:4px 0 8px">${text}</div><div class="row2" style="flex-wrap:wrap">${btns}</div></div>` : "";
    return `${head}
    <p class="hint" style="margin-top:0"><b>${all.length}</b> übernommene Kontakte sind noch offen. Mirella hat sie in Stapel sortiert. Arbeite sie von oben nach unten ab. Alles hier betrifft nur Mirella, dein iPhone-Telefonbuch bleibt, wie es ist.</p>
    ${ki ? `<button class="btn${N.clAt ? "" : " pri"}" data-act="clki" style="width:100%;margin-bottom:10px">${N.clAt ? "Mirella-KI noch einmal vorsortieren lassen" : "Mirella-KI gründlich vorsortieren lassen (bestes Modell)"}</button>` : `<p class="hint">Mit Claude-Schlüssel (Einstellungen › Mirella-KI) sortiert die Mirella-KI noch viel genauer vor.</p>`}
    ${stack("1. Gehören zusammen", groups.length, "Derselbe Mensch steht mehrfach drin, zum Beispiel privat und Geschäft. Zusammengeführt bleibt ein Kontakt mit allen Nummern.", `${nSure ? `<button class="btn pri" data-act="clgall">${nSure} eindeutige zusammenführen</button>` : ""}<button class="btn" data-act="clmode" data-m="zus">Einzeln ansehen</button>`)}
    ${stack("2. Kein Mensch", n.dienst, "Mailbox, Hotlines, Servicenummern, Taxi, leere Einträge.", `<button class="btn pri" data-act="clstack" data-k="muell" data-sel="1">Ansehen und aussortieren</button>`)}
    ${stack("3. Firmen und Dienstleister", n.firma, "Ärzte, Werkstatt, Handwerker, Restaurants. Behalte, was du noch brauchst.", `<button class="btn" data-act="clstack" data-k="firma">Ansehen</button><button class="btn" data-act="clkeepall" data-k="firma">Alle behalten</button>`)}
    ${stack("4. Menschen", n.mensch, "Sehen nach echten Personen aus.", `<button class="btn pri" data-act="clkeepall" data-k="mensch">Alle ${n.mensch} behalten</button><button class="btn" data-act="clstack" data-k="mensch">Ansehen</button>`)}
    ${stack("5. Unklar", n.unklar, "Nur ein Name oder nicht einzuordnen. Kurz durchschauen.", `<button class="btn" data-act="clstack" data-k="unklar">Ansehen</button>`)}
    ${bOpen().length ? `<button class="btn" data-act="querv" style="width:100%;margin:6px 0">${bOpen().length} Geburtstage aus dem Kalender zuordnen</button>` : ""}
    <button class="btn" data-act="clstack" data-k="alle" style="width:100%;margin-top:6px">Alle ${all.length} als Liste</button>`;
  }
  function clGroups() {
    const groups = mergeGroups();
    const head = `<div class="top"><button class="tleft tsetbtn" data-act="clmode" data-m="start" aria-label="Zurück"><p class="big">‹ Gehören zusammen</p></button></div>`;
    if (!groups.length) return head + empty("Keine Vorschläge mehr.") + `<button class="btn" data-act="clmode" data-m="start" style="width:100%;margin-top:10px">Zurück</button>`;
    const line = p => `<div style="margin:2px 0"><b>${esc(fullName(p))}</b><small style="display:block;color:var(--ink-3)">${esc([p.tel, ...(p.tels || []).map(x => x.n), p.email].filter(Boolean).join(" · ") || "keine Nummer")}</small></div>`;
    return `${head}<p class="hint" style="margin-top:0">${groups.length} Vorschläge. Beim Zusammenführen bleibt der oberste Kontakt, die Nummern der anderen kommen als weitere Nummer dazu. Nichts geht verloren.</p>
    ${groups.some(g => g.sure) ? `<button class="btn pri" data-act="clgall" style="width:100%;margin-bottom:10px">${groups.filter(g => g.sure).length} eindeutige zusammenführen (gleicher Name)</button>` : ""}
    ${groups.slice(0, 80).map(g => `<div class="pitem">${line(g.t)}${g.rest.map(line).join("")}<small style="color:var(--ink-3)">Grund: ${esc(g.why)}${g.sure ? "" : ". Bitte prüfen, ob es wirklich dieselbe Person ist."}</small><div class="row2" style="margin-top:8px"><button class="btn pri" data-act="clgyes" data-k="${g.key}">Zusammenführen</button><button class="btn" data-act="clgno" data-k="${g.key}">Getrennt lassen</button></div></div>`).join("")}`;
  }
  ACT.clmode = el => { clMode = el.dataset.m; clSel = new Set(); render(); };
  ACT.clstack = el => { clMode = "liste"; clF = el.dataset.k; clQ = ""; clMax = 120; clSel = new Set(el.dataset.sel ? clList(clF).map(p => p.id) : []); render(); if (el.dataset.sel) toast("Alle sind ausgewählt. Was bleiben soll, antippen. Dann oben „Aussortieren“."); };
  ACT.clkeepall = el => { const l = clList(el.dataset.k); if (!l.length || !ask(`${l.length} Kontakte behalten?`)) return; l.forEach(p => { p.rev = today(); }); save(); render(true); toast(l.length + " Kontakte behalten"); };
  ACT.clgyes = el => { const g = mergeGroups().find(x => x.key === el.dataset.k); if (!g) return; doMerge(g); nSave(); save(); render(true); toast("Zusammengeführt: " + fullName(g.t)); };
  ACT.clgno = el => { (N.grpNo = N.grpNo || []).push(el.dataset.k); nSave(); render(true); };
  ACT.clgall = () => { const gs = mergeGroups().filter(g => g.sure); if (!gs.length || !ask(`${gs.length} eindeutige Gruppen zusammenführen? Es bleibt je ein Kontakt mit allen Nummern. Auf deinem iPhone ändert sich nichts.`)) return; let n = 0; for (let i = 0; i < 400; i++) { const g = mergeGroups().find(x => x.sure); if (!g) break; doMerge(g); n++; } nSave(); save(); clMode = "start"; render(true); toast(n + " Gruppen zusammengeführt"); };
  R.aufraeumen = function () {
    if (clMode === "start") return clStart();
    if (clMode === "zus") return clGroups();
    const all = pending(), list = clList(clF), linked = bLinkedIds();
    const selN = list.filter(p => clSel.has(p.id)).length, nKal = all.filter(p => linked.has(p.id)).length;
    const bar = `<div class="clbar"><button class="btn pri" data-act="clkeep" ${selN ? "" : "disabled"}>Behalten${selN ? " (" + selN + ")" : ""}</button><button class="btn" data-act="cldrop" ${selN ? "" : "disabled"}>Aussortieren${selN ? " (" + selN + ")" : ""}</button></div>`;
    const head = `<div class="top" style="flex-wrap:wrap"><button class="tleft tsetbtn" data-act="clmode" data-m="start" aria-label="Zurück"><p class="big">‹ Stapel</p></button>${all.length ? bar : ""}</div>`;
    if (!all.length) return head + empty("Alles aufgeräumt. Jeder übernommene Kontakt ist entweder behalten oder aussortiert.") + `<button class="btn" data-act="clback" style="width:100%;margin-top:10px">Zu den Kontakten</button>`;
    return `${head}
    <p class="hint" style="margin-top:0"><b>${all.length}</b> übernommene Kontakte hast du noch nicht angeschaut. Tipp Kontakte an und wähle oben <b>Behalten</b> oder <b>Aussortieren</b>. Aussortierte verschwinden nur aus Mirella, auf dem iPhone bleiben sie.</p>
    ${nKal ? `<div class="pitem"><b>Vorschlag:</b> ${nKal} dieser Kontakte stehen in deinem Geburtstags-Kalender. Die sind dir wahrscheinlich wichtig.<div class="row2" style="margin-top:8px"><button class="btn pri" data-act="clkeepkal">Diese ${nKal} behalten</button></div></div>` : ""}
    ${bOpen().length ? `<button class="btn" data-act="querv" style="width:100%;margin-bottom:8px">${bOpen().length} Geburtstage ohne Kontakt zuordnen</button>` : ""}
    <input class="search" id="clq" type="search" placeholder="Suchen: Name oder Nummer" aria-label="Suchen" value="${esc(clQ)}">
    <div class="chips">${CLF.map(([k, l]) => `<button class="chip2" data-act="clf" data-k="${k}" aria-pressed="${clF === k}">${l} ${clList(k).length}</button>`).join("")}</div>
    <div class="sec"><span class="label">${list.length} in dieser Auswahl</span><button class="mini" data-act="clall">${selN === list.length ? "Auswahl aufheben" : "Alle auswählen"}</button></div>
    ${list.slice(0, clMax).map(p => `<div class="listrow clrow" role="button" tabindex="0" data-act="cltog" data-id="${p.id}" aria-pressed="${clSel.has(p.id)}" style="cursor:pointer"><span class="clbox" aria-hidden="true">${clSel.has(p.id) ? "✓" : ""}</span><span class="grow">${esc(fullName(p) || "(ohne Namen)")}<small>${esc([p.tel, p.email, p.bday ? "Geburtstag " + fmtMd(p.bday.slice(5)) + (linked.has(p.id) ? " (im Kalender)" : "") : ""].filter(Boolean).join(" · ") || "keine Nummer, keine E-Mail")}</small>${clsWhy(p) && (clF === "muell" || clF === "firma" || clF === "unklar") ? `<small style="color:var(--late)">${esc(clsWhy(p))}</small>` : ""}</span></div>`).join("")}
    ${list.length > clMax ? `<button class="btn" data-act="clmore" style="width:100%;margin-top:8px">Weitere ${Math.min(200, list.length - clMax)} zeigen</button>` : ""}`;
  };
  const clSelected = () => clList(clF).filter(p => clSel.has(p.id));
  let clFrom = "";
  ACT.aufraeumen = el => { clFrom = setSec || ""; clSel = new Set(); clMax = 120; clQ = ""; clMode = "start"; view = "aufraeumen"; render(); };
  ACT.clback = () => { if (clFrom) { view = "einstellungen"; setSec = clFrom; } else view = "menschen"; render(); };
  ACT.clf = el => { clF = el.dataset.k; clMax = 120; render(); };
  ACT.cltog = el => { const id = el.dataset.id; clSel.has(id) ? clSel.delete(id) : clSel.add(id); render(true); };
  ACT.clall = () => { const l = clList(clF), allOn = l.every(p => clSel.has(p.id)); l.forEach(p => allOn ? clSel.delete(p.id) : clSel.add(p.id)); render(true); };
  ACT.clmore = () => { clMax += 200; render(true); };
  /* Mirella-KI sortiert gründlich vor (bestes Modell, Wunsch Felix): Stapel je Kontakt und was zusammengehört.
     An Claude gehen nur die Namen und ob Nummer, E-Mail, Geburtstag vorhanden sind. Nummern werden nur auf dem Gerät verglichen. */
  ACT.clki = async el => {
    const rest = pending().slice().sort((a, b) => normName(fullName(a)).localeCompare(normName(fullName(b)))); if (!rest.length) { toast("Nichts mehr zu prüfen"); return; }
    if (!ask(`Mirella-KI sortiert ${rest.length} Kontakte mit dem besten Modell vor. Dafür gehen die Namen (ohne Nummern) an Claude. Das kostet etwa ${Math.max(5, Math.round(rest.length * 0.06))} Cent von deinem Claude-Guthaben. In Ordnung?`)) return;
    el.disabled = true; N.cl = N.cl || {}; N.grp = N.grp || []; let nCl = 0, nGr = 0;
    const schema = { type: "object", additionalProperties: false, required: ["eintraege", "gruppen"], properties: {
      eintraege: { type: "array", items: { type: "object", additionalProperties: false, required: ["nr", "art", "grund"], properties: { nr: { type: "integer" }, art: { type: "string", enum: ["dienst", "firma", "unklar"] }, grund: { type: "string" } } } },
      gruppen: { type: "array", items: { type: "array", items: { type: "integer" } } } } };
    const system = `Du hilfst ${S.settings.name || "dem Nutzer"}, sein privates iPhone-Telefonbuch aufzuräumen. Du bekommst eine alphabetisch sortierte, nummerierte Liste von Kontaktnamen aus Deutschland, dahinter in Klammern, was am Eintrag vorhanden ist.

Aufgabe 1, einordnen. Nenne in "eintraege" nur die Einträge, die KEINE Privatperson sind. Alles, was du nicht nennst, gilt als Mensch und wird behalten. Es gibt drei Arten:
- "dienst": kein Mensch und für eine persönliche Kontaktpflege wertlos. Mailbox, Hotlines, Servicenummern, Mobilfunk-Dienste, Auskunft, Pannenhilfe, Taxi-Zentralen, Notdienst-Finder, Lieferdienste, Info- und Nachrichtendienste per SMS, Gewinnspiele, Test- und Platzhalter-Einträge, reine Zahlen- oder Zeichenfolgen.
- "firma": Firma, Behörde, Praxis, Handwerker, Restaurant, Verein oder Dienstleister, den man vielleicht noch braucht. Auch "Dr. Müller Zahnarzt" oder "Autohaus Schmid".
- "unklar": nicht zu erkennen, ob Mensch oder nicht, zum Beispiel einzelne Abkürzungen oder kryptische Namen.
Sei bei Menschen großzügig: Vor- und Nachnamen, Spitznamen, Familienbezeichnungen (Mama, Opa Heinz), "Tim Fußball", "Anna Nachbarin" oder "Flo Arbeit" sind Menschen und werden NICHT genannt. "grund" in höchstens fünf deutschen Wörtern.

Aufgabe 2, Zusammengehöriges. Nenne in "gruppen" Listen von Nummern, die sehr wahrscheinlich dieselbe Person oder dieselbe Firma sind: derselbe Name mit Zusatz ("Benny Puka" und "Benny Puka Geschäft"), vertauschte Reihenfolge ("Weber Tim" und "Tim Weber"), Schreibvarianten und Tippfehler ("Steffi Maier" und "Stefanie Maier", "Müller Jürgen" und "Juergen Mueller"), Spitzname plus voller Name nur, wenn der Nachname gleich ist. Verschiedene Menschen mit gleichem Nachnamen (Geschwister, Ehepaare) gehören NICHT zusammen. Im Zweifel keine Gruppe.`;
    try {
      const step = 160;
      for (let i = 0; i < rest.length; i += step) {
        el.textContent = `Mirella-KI sortiert … ${Math.min(i + step, rest.length)} von ${rest.length}`;
        const part = rest.slice(Math.max(0, i - 8), i + step); // kleine Überlappung, damit Zusammengehöriges an der Grenze nicht zerrissen wird
        const user = part.map((p, k) => `${k + 1}. ${fullName(p)} (${[p.tel ? "Nummer" : "keine Nummer", p.email ? "E-Mail" : "", p.bday ? "Geburtstag" : "", p.addr ? "Adresse" : ""].filter(Boolean).join(", ")})`).join("\n");
        const out = JSON.parse(await kiCall({ system, user, tier: "opus", stream: true, schema, maxTokens: 12000 }));
        const named = new Set();
        for (const t of out.eintraege || []) { const p = part[t.nr - 1]; if (p) { N.cl[p.id] = { a: t.art, g: String(t.grund || "").slice(0, 60) }; named.add(p.id); nCl++; } }
        for (const p of part) if (!named.has(p.id)) N.cl[p.id] = { a: "mensch", g: "" };
        for (const g of out.gruppen || []) { const ids = [...new Set(g.map(nr => part[nr - 1]).filter(Boolean).map(p => p.id))]; if (ids.length > 1 && ids.length <= 5) { N.grp.push(ids); nGr++; } }
        nSave();
      }
      N.clAt = Date.now(); nSave(); render(true);
      toast(`Fertig: ${nCl} keine Privatpersonen, ${nGr} Gruppen gefunden`);
    } catch (e) { nSave(); render(true); toast((e && e.message || "Das hat nicht geklappt") + "."); }
  };
  ACT.clkeep = () => { const l = clSelected(); if (!l.length) return; l.forEach(p => { p.rev = today(); clSel.delete(p.id); }); save(); render(true); toast(l.length === 1 ? "1 Kontakt behalten" : l.length + " Kontakte behalten"); };
  ACT.clkeepkal = () => { const linked = bLinkedIds(), l = pending().filter(p => linked.has(p.id)); l.forEach(p => { p.rev = today(); clSel.delete(p.id); }); save(); render(true); toast(l.length + " Kontakte behalten"); };
  ACT.cldrop = () => {
    const l = clSelected(); if (!l.length) return;
    if (!ask(`${l.length === 1 ? "1 Kontakt" : l.length + " Kontakte"} aus Mirella entfernen? Auf deinem iPhone bleiben sie erhalten.`)) return;
    const ids = new Set(l.map(p => p.id));
    l.forEach(p => S.settings.appleIgnored.push(ckey(p)));
    S.people = S.people.filter(p => !ids.has(p.id)); clSel = new Set(); save(); render(true);
    toast(l.length === 1 ? "1 Kontakt aussortiert" : l.length + " Kontakte aussortiert");
  };
  document.addEventListener("input", e => { if (e.target && e.target.id === "clq") { clQ = e.target.value; clMax = 120; const pos = e.target.selectionStart; render(true); const i = $("#clq"); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (_) { } } } });
  /* Aussortierte, die über den Abgleich von einem anderen Gerät zurückkommen, wieder entfernen */
  function purgeIgnored() {
    const ign = new Set(S.settings.appleIgnored); if (!ign.size) return;
    const n0 = S.people.length;
    S.people = S.people.filter(p => !(p.appleId && !p.rev && untouched(p) && ign.has(ckey(p))));
    if (S.people.length !== n0) save();
  }

  /* ---------- Kontakte neu: Karte für Karte (Konzept vom 11.11.2026) ----------
     Jeder Eintrag im iPhone-Telefonbuch, der noch nicht in Mirella ist, ist eine Karte. Mirella führt nie still zusammen.
     Je Karte: 1. zusammenführen? 2. Rein / Nicht in Mirella / Ganz löschen / Später. 3. gleich fertig pflegen. */
  const MC = P.MirellaContacts;
  let liveIds = new Set(), kCur = null, kStep = "karte", kPid = null, kQ = "";
  const phoneLabel = x => { const s = ((x.type || "") + " " + (x.label || "")).toLowerCase(); return /work|arbeit|gesch/.test(s) ? "Geschäft" : /mobile|iphone|cell|handy/.test(s) ? "Handy" : /home|privat/.test(s) ? "Privat" : /main|festnetz/.test(s) ? "Festnetz" : ""; };
  function cardOf(raw, c) {
    const phones = raw.phones || [], main = phones.find(x => telKey(x.number) === telKey(c.tel));
    const tels = []; for (const x of phones) { const k = telKey(x.number); if (!k || k === telKey(c.tel) || tels.some(t => telKey(t.n) === k)) continue; tels.push({ n: x.number, l: phoneLabel(x) }); }
    return Object.assign({}, c, { telL: main ? phoneLabel(main) : "", tels, emails: (raw.emails || []).map(x => x.address).filter(Boolean), org: (raw.organization && raw.organization.company) || "" });
  }
  const liveAid = p => { const a = N.aid[p.id] || p.appleId; return a && liveIds.has(a) ? a : ""; };
  const bPend = () => (N.bpend = N.bpend || {});
  const kKey = c => c.b ? "b:" + c.key : "a:" + c.appleId;
  const dropCard = aid => { N.cards = (N.cards || []).filter(c => c.appleId !== aid); };
  function kQueue() {
    const ign = new Set(S.settings.appleIgnored), links = bLinks(), have = new Set(S.people.map(p => N.aid[p.id] || p.appleId).filter(Boolean)), lt = N.later || {};
    const a = (N.cards || []).filter(c => !isIgnored(c, ign) && !have.has(c.appleId));
    const b = (N.bdays || []).filter(x => !links[x.key] && !bPend()[x.key] && !x.cid).map(x => ({ b: 1, key: x.key, title: x.title, md: x.md, year: x.year, tok: x.tok }));
    const nm = x => x.b ? normName(x.title) : normName((x.last || "") + " " + (x.first || ""));
    return a.concat(b).sort((x, y) => (lt[kKey(x)] || 0) - (lt[kKey(y)] || 0) || nm(x).localeCompare(nm(y)));
  }
  const nameToks = s => normName(s).split(" ").filter(w => w.length > 1);
  const subset = (a, b) => a.length > 0 && a.every(t => b.includes(t));
  /* kind: c = Karte aus dem Telefonbuch, p = Kontakt in Mirella, b = Geburtstag aus dem Kalender */
  function ent(x, kind) {
    if (kind === "b") return { kind, x, id: "b:" + x.key, key: "b:" + x.key, key2: "b:" + x.key, toks: x.tok || [], tels: [], mails: [], md: x.md, name: bName(x) };
    const tels = [x.tel, ...(x.tels || []).map(t => t.n)].map(telKey).filter(Boolean), mails = [x.email, ...(x.emails || [])].filter(Boolean).map(m => m.toLowerCase());
    return { kind, x, id: kind === "p" ? "p:" + x.id : "a:" + x.appleId, key: (kind === "p" ? N.aid[x.id] || x.appleId : x.appleId) ? "a:" + (kind === "p" ? N.aid[x.id] || x.appleId : x.appleId) : "p:" + x.id, key2: "c:" + ckey(x), toks: nameToks([x.first, x.last, kind === "p" ? x.nick : ""].filter(Boolean).join(" ")), tels, mails, md: (x.bday || "").slice(5), name: fullName(x) };
  }
  /* Wie viele Wörter von a finden ein eigenes, gleiches oder ähnliches Wort in b? ex = davon genau gleich */
  function tokMatch(a, b) {
    const used = new Set(); let ex = 0, sim = 0;
    for (const t of a) { let hit = -1, best = 0; b.forEach((x, k) => { if (used.has(k)) return; const v = wordSim(t, x); if (v > best) { best = v; hit = k; } }); if (hit >= 0) { used.add(hit); sim++; if (best === 2) ex++; } }
    return { ex, sim };
  }
  /* Antwort beginnt mit „~“: schwacher Treffer, der nur zählt, wenn er eindeutig ist (siehe kCands) */
  function matchWhy(a, b) {
    if (a.kind === "b" || b.kind === "b") {
      const bb = a.kind === "b" ? a : b, o = a.kind === "b" ? b : a; const bt = bb.toks.filter(w => w.length > 1); if (o.kind === "b" || !bt.length) return "";
      const m = tokMatch(bt, o.toks), sameDay = !!bb.md && bb.md === o.md;
      if (m.ex === bt.length && (m.ex >= 2 || sameDay)) return "Im Geburtstags-Kalender steht derselbe Name";
      if (m.sim === bt.length && bt.length >= 2) return "Im Geburtstags-Kalender steht fast derselbe Name, nur die Schreibweise weicht ab";
      if (m.sim >= 1 && sameDay) return "Gleicher Geburtstag und ähnlicher Name";
      if (bt.length === 1 && o.toks.length && m.sim === 1) return "~Im Geburtstags-Kalender steht nur „" + bb.name + "“";
      return "";
    }
    if (a.tels.some(t => b.tels.includes(t))) return "Gleiche Nummer";
    if (a.mails.some(m => b.mails.includes(m))) return "Gleiche E-Mail";
    if (a.toks.length && a.toks.slice().sort().join(" ") === b.toks.slice().sort().join(" ")) return "Gleicher Name";
    if (a.toks.length >= 2 && b.toks.length >= 2 && (subset(a.toks, b.toks) || subset(b.toks, a.toks))) return "Name fast gleich";
    if (a.toks.length >= 2 && b.toks.length >= 2) { const sh = a.toks.length <= b.toks.length ? a : b, lo = sh === a ? b : a, m = tokMatch(sh.toks, lo.toks); if (m.sim === sh.toks.length && m.ex >= 1) return "Name fast gleich, nur die Schreibweise weicht ab"; }
    return "";
  }
  /* „Gehört nicht zusammen“ merkt sich Mirella doppelt: über die Kennung im Telefonbuch (bleibt gleich, wenn aus der Karte ein Kontakt wird) und über Name plus Nummer (gilt auch auf dem iPad) */
  const nsKey = (a, b) => [a.key, b.key].sort().join("~"), nsKey2 = (a, b) => [a.key2, b.key2].sort().join("~");
  const nsHas = (ns, a, b) => ns.has(nsKey(a, b)) || ns.has(nsKey2(a, b));
  const nsAdd = (a, b) => { const l = (S.settings.notSame = S.settings.notSame || []); for (const k of [nsKey(a, b), nsKey2(a, b)]) if (!l.includes(k)) l.push(k); };
  function kCands(card) {
    const me = ent(card, card.b ? "b" : "c"), ns = new Set(S.settings.notSame || []), out = [];
    const others = S.people.filter(p => !p.arch).map(p => ent(p, "p")).concat(kQueue().filter(c => kKey(c) !== kKey(card)).map(c => ent(c, c.b ? "b" : "c")));
    for (const e of others) { const w = matchWhy(me, e); if (w && !nsHas(ns, me, e)) out.push({ e, w }); }
    // schwache Treffer (nur Vorname, nur Nachname gleich) zählen nur, wenn es genau einen davon gibt und sonst nichts Besseres
    const strong = out.filter(x => !x.w.startsWith("~")), weak = out.filter(x => x.w.startsWith("~"));
    if (strong.length || weak.length !== 1) return strong;
    const w = weak[0], bEnt = me.kind === "b" ? me : w.e, oEnt = me.kind === "b" ? w.e : me;
    // gilt der schwache Treffer aus Sicht des Kalender-Eintrags auch nur für diesen einen Kontakt?
    const all = others.concat([me]).filter(e => e.kind !== "b" && e.id !== oEnt.id);
    if (all.some(e => matchWhy(bEnt, e))) return strong;
    return [{ e: w.e, w: w.w.slice(1) }];
  }
  const kCard = () => { const q = kQueue(); return q.find(c => kKey(c) === kCur) || q[0] || null; };
  function kEnt(id) {
    if (id.startsWith("p:")) { const p = S.people.find(x => x.id === id.slice(2)); return p ? ent(p, "p") : null; }
    const c = kQueue().find(x => kKey(x) === id); return c ? ent(c, c.b ? "b" : "c") : null;
  }
  const fmtB = b => !b ? "" : b.startsWith("1604") ? fmtMd(b.slice(5)) : longDate(b);
  const extraLabel = (drop, keep) => { const kt = nameToks(fullName(keep)); const w = fullName(drop).split(/\s+/).filter(x => normName(x).length > 1 && !kt.includes(normName(x))); return w.join(" ") || drop.telL || ""; };
  const entSub = e => e.kind === "b" ? "Geburtstag im Kalender am " + fmtMd(e.x.md) + (e.x.year ? e.x.year : "") : [e.kind === "p" ? "schon in Mirella" : "weiterer Eintrag im Telefonbuch", e.x.tel, ...(e.x.tels || []).map(t => t.n), e.x.email, e.x.bday ? "* " + fmtB(e.x.bday) : ""].filter(Boolean).join(" · ");

  /* Eindeutige Treffer verknüpft Mirella selbst: Der Kalender-Eintrag hat denselben vollen Namen (Vor- und Nachname) wie genau ein Eintrag.
     Dabei wird nichts gelöscht und nichts im Telefonbuch zusammengelegt, es kommt nur der Geburtstag an den Kontakt. Alles Unklare bleibt eine Frage. */
  function bAuto() {
    const links = bLinks(), pend = bPend(), ign = new Set(S.settings.appleIgnored), have = new Set(S.people.map(p => N.aid[p.id] || p.appleId).filter(Boolean)), ns = new Set(S.settings.notSame || []);
    const cards = (N.cards || []).filter(c => !isIgnored(c, ign) && !have.has(c.appleId));
    const same = (a, b) => a.length >= 2 && a.length === b.length && a.every(t => b.some(x => tokHit(t, x)));
    let n = 0;
    for (const b of N.bdays || []) {
      if (links[b.key] || pend[b.key] || b.cid) continue;
      const bt = (b.tok || []).filter(w => w.length > 1), be = ent(b, "b");
      const ps = S.people.filter(p => !p.arch && same(bt, nameToks((p.first || "") + " " + (p.last || ""))) && !nsHas(ns, be, ent(p, "p")));
      const cs = cards.filter(c => same(bt, nameToks((c.first || "") + " " + (c.last || ""))) && !nsHas(ns, be, ent(c, "c")));
      if (ps.length + cs.length !== 1) continue;
      const t = ps[0] || cs[0];
      if (t.bday && t.bday.slice(5) !== b.md) continue; // anderes Datum als im Telefonbuch: lieber fragen
      bApply(b, t);
      if (ps[0]) links[b.key] = t.id; else { pend[b.key] = t.appleId; t.bsrc = b.title; }
      n++;
    }
    if (n) { nSave(); save(); }
    return n;
  }
  const sameName = (a, b) => normName(a) === normName(b);
  /* Nach jedem Eingriff ins Telefonbuch liest Mirella es neu und prüft, ob es dort wirklich so steht */
  async function kVerify(keep, drop) {
    const r = await contactsSync(false); if (!r.ok) return;
    if (drop && liveIds.has(drop)) alert("Achtung: Im iPhone-Telefonbuch steht der zweite Eintrag noch. Bitte dort einmal nachsehen.");
    else if (keep && !liveIds.has(keep)) alert("Achtung: Den verbundenen Eintrag finde ich im iPhone-Telefonbuch nicht mehr. Bitte dort einmal nachsehen. Deine Sicherung liegt in der Dateien-App.");
  }
  /* nameFrom: "c" = Name der Karte bleibt, "o" = Name des anderen Eintrags bleibt. Gefragt wird vorher im Fenster „Verbinden?“. */
  async function kMerge(c, o, nameFrom) {
    if (c.b && o.kind === "b") return false;
    if (c.b) {
      if (o.kind === "p") { bLinks()[c.key] = o.x.id; bApply(c, o.x); toast("Der Geburtstag steht jetzt bei " + fullName(o.x)); kCur = null; }
      else { bApply(c, o.x); o.x.bsrc = c.title; bPend()[c.key] = o.x.appleId; kCur = "a:" + o.x.appleId; toast("Geburtstag übernommen"); }
      return true;
    }
    if (o.kind === "b") { bApply(o.x, c); c.bsrc = o.x.title; bPend()[o.x.key] = c.appleId; toast("Geburtstag übernommen. Der Kalender bleibt, wie er ist."); return true; }
    if (o.kind === "p") {
      const p = o.x, aid = liveAid(p), two = aid && aid !== c.appleId;
      if (two) await MC.merge({ keep: aid, drop: c.appleId });
      else { N.aid[p.id] = c.appleId; p.appleId = c.appleId; delete p.local; }
      const cn = { first: c.first, last: c.last };
      mergeInto(p, c, extraLabel(c, p)); delete N.cs[p.id];
      if (nameFrom === "c" && (cn.first || cn.last)) { p.first = cn.first; p.last = cn.last; }
      if (!sameName(fullName(p), fullName(cn)) || two) { try { await MC.upsert({ id: two ? aid : c.appleId, given: p.first || "", family: p.last || "" }); } catch (e) { console.warn("Name", e); } }
      for (const [k, v] of Object.entries(bPend())) if (v === c.appleId) { bLinks()[k] = p.id; delete bPend()[k]; }
      dropCard(c.appleId); kCur = null; nSave(); save();
      await kVerify(two ? aid : c.appleId, two ? c.appleId : "");
      toast("Verbunden mit " + fullName(p));
      return true;
    }
    const other = o.x, keep = nameFrom === "o" ? other : c, drop = keep === c ? other : c;
    await MC.merge({ keep: keep.appleId, drop: drop.appleId });
    const live = (N.cards || []).find(x => x.appleId === keep.appleId) || keep;
    mergeInto(live, drop, extraLabel(drop, keep)); live.emails = [...new Set([...(live.emails || []), ...(drop.emails || [])])];
    if (!live.bsrc && drop.bsrc && live.bday === drop.bday) live.bsrc = drop.bsrc;
    for (const [k, v] of Object.entries(bPend())) if (v === drop.appleId) bPend()[k] = keep.appleId;
    dropCard(drop.appleId); kCur = "a:" + keep.appleId; nSave();
    await kVerify(keep.appleId, drop.appleId);
    toast("Verbunden: " + fullName(live));
    return true;
  }
  function kTake(c) {
    let p;
    if (c.b) { const nm = bName(c).split(" "); p = isNewPerson({ first: nm.shift() || c.title, last: nm.join(" "), tel: "", email: "", bday: (c.year || 1604) + "-" + c.md, addr: "", local: true }); bLinks()[c.key] = p.id; }
    else {
      p = isNewPerson({ appleId: c.appleId, first: c.first, last: c.last, tel: c.tel, telL: c.telL || "", tels: c.tels || [], email: c.email, emails: [...new Set((c.emails || []).filter(m => m && m.toLowerCase() !== (c.email || "").toLowerCase()))], bday: c.bday, addr: c.addr });
      if ((c.notes || []).length) p.notes = c.notes;
      N.aid[p.id] = c.appleId;
      for (const [k, v] of Object.entries(bPend())) if (v === c.appleId) { bLinks()[k] = p.id; delete bPend()[k]; }
      dropCard(c.appleId);
    }
    p.cyc = "nie"; p.rev = today(); S.people.push(p); return p;
  }
  const kAfter = () => { nSave(); save(); render(); const sc = $("#screen"); if (sc) sc.scrollTop = 0; };
  ACT.kopen = () => {
    closeAll(); kStep = "karte"; kPid = null; kQ = ""; view = "kdurch"; render();
    // beim Öffnen Telefonbuch und Geburtstags-Kalender frisch lesen, damit die Karten den wirklichen Stand zeigen
    (async () => { await contactsSync(false); await calendarBirthdays(); if (view === "kdurch" && kStep === "karte" && !kQ && !$("#sheet").classList.contains("open")) render(true); })();
  };
  ACT.kback = () => { if (kStep === "pflege" && kPid) kSave(); view = "menschen"; render(); };
  /* Verbinden geht nur per Tippen und immer über ein Fenster, das zeigt, was danach wo steht */
  let kM = null, kBusy = false;
  const entLines = e => e.kind === "b" ? ["Geburtstag " + fmtMd(e.x.md) + (e.x.year || ""), "aus deinem Geburtstags-Kalender"] : [e.x.org, ...[e.x.tel, ...(e.x.tels || []).map(t => t.n)].filter(Boolean), ...[...new Set([e.x.email, ...(e.x.emails || [])].filter(Boolean))], e.x.bday ? "Geburtstag " + fmtB(e.x.bday) : "", e.kind === "p" ? "schon in Mirella" : "im iPhone-Telefonbuch"].filter(Boolean);
  function kMergeSheet() {
    const c = kCard(), o = kM && kEnt(kM.o); if (!c || !o || kKey(c) !== kM.c) { closeSheet(); return; }
    const me = ent(c, c.b ? "b" : "c"), bd = c.b || o.kind === "b";
    const box = e => `<div class="kmbox"><b>${esc(e.name)}</b>${entLines(e).map(l => `<small>${esc(l)}</small>`).join("")}</div>`;
    let mid = "", foot = "";
    if (bd) {
      const b = c.b ? me : o, t = c.b ? o : me;
      mid = `<p class="hint">Der Geburtstag <b>${esc(fmtMd(b.x.md) + (b.x.year || ""))}</b> wird bei <b>${esc(t.name)}</b> eingetragen${t.x.bday && t.x.bday.slice(5) !== b.x.md ? `. Achtung: Dort steht bisher ${esc(fmtB(t.x.bday))}, das bleibt stehen` : ""}. Der Kalender-Eintrag bleibt, wie er ist, und kommt nicht mehr als eigene Karte.</p>`;
    } else {
      const diff = !sameName(me.name, o.name);
      if (diff) mid = `<p class="label" style="margin:12px 0 6px">Welcher Name soll bleiben?</p><div class="seg kmname">${[["c", me.name], ["o", o.name]].map(([k, n]) => `<button data-act="kmname" data-n="${k}" aria-pressed="${kM.name === k}">${esc(n)}</button>`).join("")}</div>`;
      const keepName = diff ? (kM.name === "o" ? o.name : me.name) : me.name;
      const tels = [...new Map([...(kM.name === "o" ? [o, me] : [me, o])].flatMap(e => [e.x.tel, ...(e.x.tels || []).map(t => t.n)]).filter(Boolean).map(n => [telKey(n) || n, n])).values()];
      const mails = [...new Set([me, o].flatMap(e => [e.x.email, ...(e.x.emails || [])]).filter(Boolean).map(m => m.toLowerCase()))];
      const bdy = (kM.name === "o" ? o.x.bday || me.x.bday : me.x.bday || o.x.bday) || "";
      mid += `<p class="label" style="margin:12px 0 6px">So steht es danach da</p><div class="kmbox res"><b>${esc(keepName)}</b>${tels.map(n => `<small>${esc(n)}</small>`).join("")}${mails.map(m => `<small>${esc(m)}</small>`).join("")}${bdy ? `<small>Geburtstag ${esc(fmtB(bdy))}</small>` : ""}</div>`;
      const two = o.kind === "c" || (o.kind === "p" && liveAid(o.x) && liveAid(o.x) !== c.appleId);
      foot = `<p class="hint">${two ? "<b>Im iPhone-Telefonbuch</b> bleibt ein Eintrag mit allen Nummern, der zweite wird dort gelöscht. Das gilt über iCloud auch für deine anderen Geräte." : "<b>Im iPhone-Telefonbuch</b> wird nichts gelöscht. Der Eintrag gehört danach zu dem Kontakt in Mirella."}${N.kBackup ? " Deine Sicherung vom " + esc(new Date(N.kBackup.at).toLocaleDateString("de-DE")) + " liegt in der Dateien-App." : ""}</p>`;
    }
    openSheet(`<p class="stitle">${bd ? "Geburtstag übernehmen?" : "Diese beiden verbinden?"}</p>${box(me)}<p class="kmplus">${bd ? "und" : "+"}</p>${box(o)}${mid}${foot}<div class="row2"><button class="btn" data-act="cancel">Abbrechen</button><button class="btn pri" data-act="kmergego">${bd ? "Ja, übernehmen" : "Ja, verbinden"}</button></div>`);
  }
  ACT.kmerge = el => {
    const c = kCard(), o = kEnt(el.dataset.k || ""); if (!c || !o) return;
    const me = ent(c, "c");
    // Vorschlag für den Namen: der kürzere (ohne Zusatz wie „Geschäft“); ein Kontakt, der schon in Mirella ist, behält seinen Namen
    kM = { c: kKey(c), o: o.id, name: c.b || o.kind === "b" ? "c" : o.kind === "p" ? "o" : nameToks(o.name).length < nameToks(me.name).length ? "o" : "c" };
    kMergeSheet();
  };
  ACT.kmname = el => { if (!kM) return; kM.name = el.dataset.n; kMergeSheet(); };
  ACT.kmergego = async el => {
    const c = kCard(), o = kM && kEnt(kM.o); if (!c || !o || kBusy || kKey(c) !== kM.c) return;
    kBusy = true; if (el) { el.disabled = true; el.textContent = "Einen Moment …"; }
    try { if (await kMerge(c, o, kM.name)) kQ = ""; } catch (e) { alert("Das Verbinden ging nicht, es bleibt alles, wie es war.\n" + (e && e.message || e)); }
    kBusy = false; kM = null; closeSheet(); kAfter();
  };
  ACT.knotsame = el => { const c = kCard(), o = kEnt(el.dataset.k || ""); if (!c || !o) return; nsAdd(ent(c, c.b ? "b" : "c"), o); kAfter(); toast("Gemerkt: gehört nicht zusammen"); };
  /* Geburtstag, den Mirella selbst aus dem Kalender an die Karte gehängt hat, wieder lösen */
  ACT.kbundo = () => {
    const c = kCard(); if (!c || c.b || !c.bsrc) return;
    if (!ask("Der Geburtstag aus dem Kalender gehört nicht zu " + fullName(c) + "?\n\nDann nimmt Mirella ihn hier wieder weg und fragt nicht mehr danach.")) return;
    const live = (N.cards || []).find(x => x.appleId === c.appleId) || c, me = ent(live, "c");
    for (const [k, v] of Object.entries(bPend())) if (v === c.appleId) { const b = (N.bdays || []).find(x => x.key === k); if (b) nsAdd(me, ent(b, "b")); delete bPend()[k]; }
    live.bday = ""; delete live.bsrc; kAfter();
  };
  /* Welche Kalender sind Geburtstags-Kalender? Mirella erkennt sie am Namen, hier lässt es sich festlegen */
  function kCalSheet() {
    const on = new Set(N.bcals || []);
    openSheet(`<p class="stitle">Geburtstags-Kalender</p><p class="hint" style="margin-top:0">Aus den angehakten Kalendern liest Mirella die Geburtstage. Gelesen sind gerade <b>${(N.bdays || []).length}</b> Einträge.</p>${(N.cals || []).map(c => `<button class="drow" data-act="kbcal" data-id="${esc(c.id)}"><span class="dt"><b>${esc(c.title || "(ohne Namen)")}</b></span><span class="chev">${on.has(c.id) ? "●" : "○"}</span></button>`).join("") || '<p class="hint">Ich sehe keinen Kalender. Bitte unter Einstellungen › iPhone die Freigaben prüfen.</p>'}<button class="btn pri" data-act="cancel" style="width:100%;margin-top:10px">Fertig</button>`);
  }
  ACT.kcals = () => kCalSheet();
  /* Kalender-Filter „iPhone-Termine“: Antippen öffnet die Liste der iPhone-Kalender. Dort wählt Felix, welche er sehen will. */
  function terminSheet() {
    const hide = new Set(N.calHide || []), on = !!(S.settings.calFilter.termin ?? 1), skip = new Set([...(N.bcals || []), N.mcal].filter(Boolean));
    const cals = (N.cals || []).filter(c => !skip.has(c.id)), cnt = id => (N.events || []).filter(e => e.cid === id).length;
    openSheet(`<p class="stitle">iPhone-Termine</p>
    <button class="drow" data-act="terminall"><span class="dt"><b>iPhone-Termine im Kalender zeigen</b><small>${on ? "an" : "aus"}</small></span><span class="chev">${on ? "●" : "○"}</span></button>
    ${on ? `<div class="label" style="margin:12px 0 6px">Welche Kalender?</div>${cals.map(c => `<button class="drow" data-act="termincal" data-id="${esc(c.id)}"><span class="dt"><b>${esc(c.title || "(ohne Namen)")}</b><small>${cnt(c.id) === 1 ? "1 Termin" : cnt(c.id) + " Termine"}</small></span><span class="chev">${hide.has(c.id) ? "○" : "●"}</span></button>`).join("") || '<p class="hint">Ich sehe keinen Kalender. Bitte unter Einstellungen › iPhone die Freigaben prüfen.</p>'}` : ""}
    <button class="btn pri" data-act="cancel" style="width:100%;margin-top:10px">Fertig</button>`);
  }
  const origCalf = ACT.calf;
  ACT.calf = el => { if (el.dataset.k === "termin") { terminSheet(); if (!(N.events || []).some(e => e.cid)) calendarEvents().then(() => { if ($("#sheet.open [data-act=terminall]")) terminSheet(); }); return; } origCalf(el); };
  ACT.terminall = () => { S.settings.calFilter.termin = (S.settings.calFilter.termin ?? 1) ? 0 : 1; save(); render(true); terminSheet(); };
  ACT.termincal = el => { const h = new Set(N.calHide || []); h.has(el.dataset.id) ? h.delete(el.dataset.id) : h.add(el.dataset.id); N.calHide = [...h]; nSave(); render(true); terminSheet(); };
  ACT.kbcal = async el => { const on = new Set(N.bcals || []); on.has(el.dataset.id) ? on.delete(el.dataset.id) : on.add(el.dataset.id); N.bcalPick = [...on]; nSave(); await calendarBirthdays(); kCalSheet(); kFresh = true; render(true); };
  ACT.klater = () => { const c = kCard(); if (!c) return; (N.later = N.later || {})[kKey(c)] = Date.now(); kCur = null; kQ = ""; kAfter(); toast("Kommt am Ende nochmal"); };
  ACT.krein = () => { const c = kCard(); if (!c) return null; if (kCands(c).length) { toast("Erst bitte oben entscheiden: verbinden oder nicht dieselbe Person"); return null; } const p = kTake(c); kPid = p.id; kStep = "pflege"; kCur = null; kQ = ""; kAfter(); return p; };
  ACT.knicht = () => {
    const c = kCard(); if (!c) return;
    if (c.b) bLinks()[c.key] = "x";
    else { S.settings.appleIgnored.push(c.appleId, ckey(c)); for (const [k, v] of Object.entries(bPend())) if (v === c.appleId) { bLinks()[k] = "x"; delete bPend()[k]; } dropCard(c.appleId); }
    kCur = null; kAfter(); toast(c.b ? "Kommt nicht nach Mirella. Der Kalender bleibt." : "Bleibt im Telefonbuch, kommt nicht nach Mirella");
  };
  ACT.kdel = async () => {
    const c = kCard(); if (!c || c.b) return;
    if (!ask(`„${fullName(c)}“ ganz löschen?\n\nDer Eintrag verschwindet auch aus dem iPhone-Telefonbuch und über iCloud von deinen anderen Geräten.`)) return;
    try { await MC.remove({ id: c.appleId }); } catch (e) { alert("Das Löschen ging nicht: " + (e && e.message || e)); return; }
    for (const [k, v] of Object.entries(bPend())) if (v === c.appleId) delete bPend()[k];
    dropCard(c.appleId); kCur = null; kAfter(); toast("Gelöscht, auch im Telefonbuch");
  };
  /* Pflege gleich nach „Rein“ */
  function kSave() {
    const p = S.people.find(x => x.id === kPid); if (!p || !$("#kp-first")) return "";
    const bd = L.parseBday($("#kp-bday").value), dd = L.parseBday($("#kp-death").value);
    if (bd === null) return "Geburtstag bitte als TT.MM.JJJJ, z. B. 07041964";
    if (dd === null) return "Todestag bitte als TT.MM.JJJJ";
    const first = $("#kp-first").value.trim(), last = $("#kp-last").value.trim(); if (!first && !last) return "Bitte einen Namen eintragen";
    Object.assign(p, { first, last, bday: bd || "", death: dd || "", cyc: dd || !p.tel ? "nie" : $("#kp-cyc").value, lunch: dd ? "" : $("#kp-lunch").value, group: $("#kp-grp").value, gift: !dd && $("#kp-gift").checked, woher: $("#kp-woher").value.trim(), job: $("#kp-job").value.trim() });
    pickRemember("woher", p.woher); pickRemember("job", p.job);
    if (p.group && !S.groups.includes(p.group)) S.groups.push(p.group);
    const aq = $("#kp-ask").value.trim(); if (aq) (p.ask = p.ask || []).push({ id: uid(), t: aq, d: today() });
    const gi = $("#kp-gidea").value.trim(), no = $("#kp-note").value.trim();
    if (gi) { if (p.gift) (p.gifts = p.gifts || []).push({ id: uid(), t: gi, d: today() }); else (p.notes = p.notes || []).unshift({ id: uid(), t: "Geschenkidee: " + gi, d: today() }); }
    if (no) (p.notes = p.notes || []).unshift({ id: uid(), t: no, d: today() });
    nSave(); save(); return "";
  }
  function kPflege(p) {
    const par = p.parent && S.people.find(x => x.id === p.parent), sel = (id, opts, v) => `<select id="${id}">${opts.map(([k, l]) => `<option value="${esc(k)}"${k === v ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
    const nums = [p.tel ? p.tel + (p.telL ? " (" + p.telL + ")" : "") : "", ...(p.tels || []).map(t => t.n + (t.l ? " (" + t.l + ")" : ""))].filter(Boolean);
    return `<div class="block"><h4>${esc(fullName(p))} ist drin</h4><p class="hint" style="margin:4px 0 0">Jetzt kurz pflegen, dann ist der Kontakt fertig und kommt nicht wieder als Karte.${p.local ? " Ohne Nummer, deshalb steht er nur in Mirella." : ""}</p>${nums.length ? `<p class="hint" style="margin:6px 0 0">${nums.length === 1 ? "Nummer" : "Nummern"}: <b>${esc(nums.join(" · "))}</b></p>` : ""}</div>
    <div class="fgrid"><div class="fld"><label for="kp-first">Vorname</label><input id="kp-first" value="${esc(p.first || "")}" autocomplete="off"></div><div class="fld"><label for="kp-last">Nachname</label><input id="kp-last" value="${esc(p.last || "")}" autocomplete="off"></div></div>
    <div class="fgrid"><div class="fld"><label for="kp-cyc">Anrufen</label>${p.tel ? sel("kp-cyc", CYCLES.map(c => [c, cycLabel(c)]), noCycle(p.cyc) ? "nie" : p.cyc) : '<select id="kp-cyc" disabled><option value="nie">ohne Nummer nicht</option></select>'}</div><div class="fld"><label for="kp-lunch">Treffen vereinbaren</label>${sel("kp-lunch", [["", "nie"], ...Object.keys(LUNCH).map(c => [c, c])], p.lunch || "")}</div></div>
    <div class="fgrid"><div class="fld"><label for="kp-grp-s">Gruppe</label>${pickField("kp-grp", S.groups, p.group || "", "keine", "group")}</div><div class="fld"><label for="kp-woher-s">Woher bekannt?</label>${pickField("kp-woher", woherAll(), p.woher || "", "keine Angabe", "woher")}</div></div>
    <div class="fld"><label for="kp-job-s">Beruf (heute oder früher)</label>${pickField("kp-job", jobAll(), p.job || "", "keine Angabe", "job")}</div>
    <div class="fld"><label for="kp-bday">Geburtstag</label><input id="kp-bday" inputmode="numeric" maxlength="10" placeholder="TT.MM.JJJJ" value="${esc(L.bdayToInput(p.bday || ""))}" autocomplete="off"></div>
    <label class="tgl" style="margin:-2px 0 10px"><input type="checkbox" id="kp-gift"${p.gift ? " checked" : ""}> Zum Geburtstag ein Geschenk besorgen (Erinnerung ${S.settings.giftLead} Tage vorher)</label>
    <div class="fld"><label for="kp-note">Notiz</label><input id="kp-note" placeholder="Was du dir merken willst" autocomplete="off"></div>
    <div class="fld" id="kp-gideabox"${p.gift ? "" : " hidden"}><label for="kp-gidea">Geschenkidee</label><input id="kp-gidea" placeholder="z. B. Kochkurs" autocomplete="off"></div>
    <div class="fld"><label for="kp-ask">Offene Nachfrage</label><input id="kp-ask" placeholder="z. B. fragen, wie die Reha läuft" autocomplete="off"></div>
    <div class="plusrow">${par ? "" : '<button type="button" class="mini" data-act="kparent">+ Kind von …</button>'}<button type="button" class="mini" data-act="plusshow" data-t="kp-deathbox"${p.death ? " hidden" : ""}>+ Verstorben</button></div>
    ${par ? `<div class="block"><div class="listrow"><span class="grow">Kind von ${esc(fullName(par))}<small>steht nur in Mirella, ohne Anruf-Erinnerung</small></span><button class="rowdel" data-act="kparentoff" aria-label="Verweis entfernen">✕</button></div></div>` : ""}
    <div class="fld" id="kp-deathbox"${p.death ? "" : " hidden"}><label for="kp-death">Verstorben am</label><input id="kp-death" inputmode="numeric" maxlength="10" placeholder="TT.MM.JJJJ" value="${esc(L.bdayToInput(p.death || ""))}" autocomplete="off"></div>
    <button class="btn pri" data-act="kdone" style="width:100%;margin-top:6px">Fertig, nächste Karte</button>
    <p class="hint">Per Sprache geht hier: „Monatlich anrufen“, „Treffen vierteljährlich“, „Kind von Max“, „Fertig“.</p>`;
  }
  ACT.kdone = () => { const err = kSave(); if (err) { toast(err); return; } kStep = "karte"; kPid = null; kAfter(); };
  ACT.kparentoff = () => { const p = S.people.find(x => x.id === kPid); if (!p) return; kSave(); delete p.parent; save(); kFresh = true; render(true); };
  const kParentList = ql => S.people.filter(x => x.id !== kPid && !x.arch && (!ql || normName(fullName(x)).includes(ql))).sort((a, b) => fullName(a).localeCompare(fullName(b), "de")).slice(0, 40).map(x => `<button class="drow" data-act="kparentset" data-id="${x.id}"><span class="dt"><b>${esc(fullName(x))}</b></span><span class="chev">›</span></button>`).join("") || '<p class="hint">Niemand gefunden. Das Elternteil muss schon in Mirella sein.</p>';
  ACT.kparent = () => { const err = kSave(); if (err) { toast(err); return; } openSheet(`<p class="stitle">Kind von wem?</p><input class="search" id="kpq" type="search" placeholder="Name suchen" autocomplete="off"><div id="kpl">${kParentList("")}</div>`, () => $("#kpq").focus()); };
  ACT.kparentset = el => { const p = S.people.find(x => x.id === kPid); if (!p) return; p.parent = el.dataset.id; if (!p.tel) p.local = true; save(); closeSheet(); kFresh = true; render(true); };
  document.addEventListener("input", e => {
    const t = e.target; if (!t) return;
    if (t.id === "kpq") { const l = $("#kpl"); if (l) l.innerHTML = kParentList(normName(t.value)); }
    if (t.id === "kq") { kQ = t.value; const l = $("#kql"); if (l) l.innerHTML = kHits(); }
  });
  function kCardHTML(c) {
    const rows = c.b ? [["Geburtstag", fmtMd(c.md) + (c.year || "")], ["Woher", "Nur im Geburtstags-Kalender, kein Eintrag im Telefonbuch"]]
      : [c.org ? ["Firma", c.org] : null, c.tel ? [c.telL || "Nummer", c.tel] : null, ...(c.tels || []).map(t => [t.l || "Nummer", t.n]), ...[...new Set([c.email, ...(c.emails || [])].filter(Boolean))].map(m => ["E-Mail", m]), c.bday ? ["Geburtstag", fmtB(c.bday)] : null, c.addr ? ["Adresse", c.addr] : null].filter(Boolean);
    const nB = (N.bdays || []).length;
    const bnote = c.b ? "" : c.bsrc ? `<p class="hint kbsrc">Der Geburtstag kommt aus deinem Geburtstags-Kalender, Eintrag „${esc(c.bsrc)}“. <button class="mini" data-act="kbundo">Stimmt nicht</button></p>`
      : c.bday ? "" : `<p class="swipehint kbsrc" style="text-align:left">${nB ? `Kein Geburtstag gefunden, auch nicht unter genau diesem Namen im Geburtstags-Kalender (${nB} Einträge gelesen).` : "Ich finde keinen Geburtstags-Kalender auf deinem iPhone."} <button class="mini" data-act="kcals">Kalender wählen</button></p>`;
    return `<div class="block kcard"><h3>${esc(c.b ? bName(c) : fullName(c))}</h3>${rows.length ? rows.map(([l, v]) => `<div class="krow"><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join("") : '<p class="hint" style="margin:0">Ohne Nummer, E-Mail und Geburtstag</p>'}${bnote}</div>`;
  }
  /* Suche zum Verbinden: Kontakte in Mirella, andere Karten aus dem Telefonbuch und Geburtstage aus dem Kalender, nach Name oder Nummer */
  function kHits() {
    const c = kCard(); if (!c) return "";
    const ql = normName(kQ), qd = kQ.replace(/\D/g, ""), me = kKey(c);
    if (ql.length < 2 && qd.length < 3) return `<p class="hint" style="margin:6px 0 0">Tippe mindestens zwei Buchstaben oder drei Ziffern. Gesucht wird in Mirella, im Telefonbuch und im Geburtstags-Kalender.</p>`;
    const all = S.people.filter(p => !p.arch).map(p => ent(p, "p")).concat(kQueue().filter(x => kKey(x) !== me && !(c.b && x.b)).map(x => ent(x, x.b ? "b" : "c")));
    const hits = all.filter(e => (ql.length >= 2 && (normName(e.name).includes(ql) || fuzzyHas(e.name + " " + (e.x.org || "") + " " + (e.kind === "b" ? e.x.title : ""), ql))) || (qd.length >= 3 && [e.x.tel, ...((e.x.tels || []).map(t => t.n))].some(n => (n || "").replace(/\D/g, "").includes(qd)))).slice(0, 30);
    return hits.map(e => `<button class="drow" data-act="kmerge" data-k="${esc(e.id)}"><span class="dt"><b>${esc(e.name)}</b><small>${esc(entSub(e))}</small></span><span class="mini">Verbinden</span></button>`).join("") || `<p class="hint" style="margin:6px 0 0">Niemand gefunden.</p>`;
  }
  R.kdurch = function () {
    const q = kQueue(), head = `<div class="top"><button class="tleft tsetbtn" data-act="kback" aria-label="Zurück"><p class="big">‹ Kontakte</p></button><span class="tright"><span class="label">${q.length} offen</span></span></div>`;
    if (kStep === "pflege") { const p = S.people.find(x => x.id === kPid); if (p) return head + kPflege(p); kStep = "karte"; }
    const c = kCard();
    if (!c) return head + `<div class="block"><h4>Alles durchgegangen</h4><p class="hint" style="margin:4px 0 0">Es wartet keine Karte mehr. Neue Einträge im Telefonbuch meldet Mirella oben im Reiter Kontakte.</p></div><button class="btn pri" data-act="kback" style="width:100%">Zu den Kontakten</button>`;
    if (kCur !== kKey(c)) kQ = "";
    kCur = kKey(c);
    const cands = kCands(c);
    const verb = `<div class="block kq"><h4>1. Gehört das zu einem anderen Eintrag?</h4>
      ${cands.length ? `<p class="hint" style="margin:4px 0 8px">Mirella hat ${cands.length === 1 ? "einen möglichen Treffer" : cands.length + " mögliche Treffer"} gefunden. Bitte bei jedem entscheiden.</p>${cands.map(x => `<div class="kcand"><b>${esc(x.e.name)}</b><small>${esc(entSub(x.e))}</small><small class="why">Grund: ${esc(x.w)}</small><div class="row2"><button class="btn pri" data-act="kmerge" data-k="${esc(x.e.id)}">${x.e.kind === "b" || c.b ? "Geburtstag übernehmen" : "Verbinden"}</button><button class="btn" data-act="knotsame" data-k="${esc(x.e.id)}">Nicht dieselbe Person</button></div></div>`).join("")}` : `<p class="hint" style="margin:4px 0 8px">Mirella hat keinen passenden Eintrag gefunden.</p>`}
      <label for="kq" class="label" style="display:block;margin:10px 0 4px">Selbst suchen und verbinden</label><input class="search" id="kq" type="search" placeholder="Name oder Nummer" value="${esc(kQ)}" autocomplete="off" style="margin:0"><div id="kql">${kQ ? kHits() : ""}</div></div>`;
    const lock = cands.length > 0;
    const acts = `<div class="block"><h4>2. Was soll mit ${c.b ? "diesem Geburtstag" : "diesem Eintrag"} passieren?</h4>${lock ? '<p class="hint" style="margin:4px 0 8px">„Rein in Mirella“ geht, sobald du oben entschieden hast.</p>' : ""}<div style="display:grid;gap:8px;margin-top:8px"><button class="btn${lock ? "" : " pri"}" data-act="krein"${lock ? " disabled" : ""}>Rein in Mirella${c.b ? " (als Kontakt ohne Nummer)" : ""}</button><button class="btn" data-act="knicht">Nicht in Mirella</button><button class="btn" data-act="klater">Später</button>${c.b ? "" : '<button class="btn danger" data-act="kdel">Ganz löschen (auch im Telefonbuch)</button>'}</div>
      <p class="hint">${c.b ? "„Nicht in Mirella“ lässt den Kalender, wie er ist." : "„Nicht in Mirella“ lässt den Eintrag im Telefonbuch und fragt nie wieder."} Verbinden und Löschen gehen nur per Tippen.</p></div>`;
    return head + kCardHTML(c) + verb + acts;
  };
  /* nur für die automatischen Tests (im iPhone gibt es __MTEST nicht) */
  if (window.__MTEST) window.__MTEST = { queue: () => kQueue(), key: kKey, show: k => { kCur = k; kStep = "karte"; kPid = null; kQ = ""; view = "kdurch"; render(); }, N: () => N };
  /* Sprache im Durchgang: „Nimm ihn rein“, „Monatlich anrufen“, „Kind von Max“, „Fertig“. Verbinden und Löschen bewusst nur per Tippen (Wunsch Felix). */
  const RHY = [["alle 2 wochen", /alle (2|zwei) wochen|vierzehn/], ["wöchentlich", /wöchentlich|jede woche/], ["alle 2 monate", /alle (2|zwei) monate/], ["vierteljährlich", /viertelj|alle (3|drei) monate|quartal/], ["halbjährlich", /halbj|alle (6|sechs) monate/], ["monatlich", /monatlich|jeden monat/], ["jährlich", /jährlich|jedes jahr|einmal im jahr/], ["nie", /\bnie\b|gar nicht/]];
  function kVoice(txt) {
    const t = txt.toLowerCase(), rh = (RHY.find(([, re]) => re.test(t)) || [])[0];
    const kidOf = /kind von ([\wäöüß .-]+)/i.exec(txt);
    const setParent = p => { if (!kidOf || !p) return; const ql = normName(kidOf[1]); const par = S.people.find(x => x.id !== p.id && normName(fullName(x)) === ql) || S.people.find(x => x.id !== p.id && normName(fullName(x)).includes(ql)) || S.people.find(x => x.id !== p.id && nameToks(fullName(x)).some(w => ql.split(" ").includes(w))); if (par) { p.parent = par.id; if (!p.tel) p.local = true; toast("Kind von " + fullName(par)); } else toast("„" + kidOf[1].trim() + "“ habe ich in Mirella nicht gefunden"); };
    if (kStep === "pflege") {
      const p = S.people.find(x => x.id === kPid); if (!p) return false;
      const err = kSave(); if (err) { toast(err); return true; }
      let did = false;
      if (kidOf) { setParent(p); did = true; }
      if (rh && /treff|verabred|mittag|essen|lunch/.test(t)) { const lk = rh === "nie" ? "" : Object.keys(LUNCH).find(x => x.toLowerCase() === rh); if (lk !== undefined) { p.lunch = lk; did = true; } }
      else if (rh && p.tel) { const ck = CYCLES.find(x => x.toLowerCase() === rh); if (ck) { p.cyc = ck; did = true; } }
      const no = /^(notiz|merke?)[:,]?\s+(.+)/i.exec(txt), gi = /^(geschenk(idee)?)[:,]?\s+(.+)/i.exec(txt);
      if (no) { (p.notes = p.notes || []).unshift({ id: uid(), t: no[2], d: today() }); did = true; }
      if (gi) { const gb = $("#kp-gift"); if (gb ? gb.checked : p.gift) (p.gifts = p.gifts || []).push({ id: uid(), t: gi[3], d: today() }); else (p.notes = p.notes || []).unshift({ id: uid(), t: "Geschenkidee: " + gi[3], d: today() }); did = true; }
      save();
      if (/\b(fertig|weiter|nächste[rn]?)\b/.test(t)) { kStep = "karte"; kPid = null; kAfter(); return true; }
      if (!did) { toast("Das habe ich hier nicht verstanden"); return true; }
      kFresh = true; render(true); return true;
    }
    const c = kCard(); if (!c) return false;
    if (/zusammen|verbind|verknüpf|dazufüg|lösch|\bweg damit\b/.test(t)) { toast("Verbinden und Löschen bitte per Tippen, damit kein Missverständnis passiert"); return true; }
    if (/später|nachher|überspring/.test(t)) { ACT.klater(); return true; }
    if (kCands(c).length) { toast("Erst bitte oben antippen, ob das zusammengehört"); return true; }
    if (/nicht (in mirella|rein|aufnehmen|nehmen)|\braus\b|\bnein\b/.test(t)) { ACT.knicht(); return true; }
    if (/\brein\b|nimm|aufnehmen|\bja\b|behalten/.test(t)) { const p = ACT.krein(); if (p && kidOf) { setParent(p); save(); kFresh = true; render(true); } return true; }
    toast("Sag zum Beispiel „Nimm ihn rein“, „Nicht in Mirella“ oder „Später“"); return true;
  }
  const kOrigReview = voiceReview;
  voiceReview = function () {
    const txt = (($("#v-text") || {}).value || "").trim();
    if (view === "kdurch" && txt) { recStop(); closeSheet(); if (kVoice(txt)) return; }
    return kOrigReview.apply(this, arguments);
  };
  /* Telefonbuch sichern und neu anfangen */
  ACT.kbackup = async () => { if (!MC || !MC.backup) { toast("Dafür braucht es die neue iPhone-Version"); return; } try { const r = await MC.backup({ share: true }); N.kBackup = { at: Date.now(), n: r.count, file: r.file }; nSave(); render(true); toast(r.count + " Kontakte gesichert"); } catch (e) { alert("Die Sicherung ging nicht: " + (e && e.message || e)); } };
  ACT.kneu = async () => {
    if (!MC || !MC.backup) { toast("Dafür braucht es die neue iPhone-Version"); return; }
    if (!ask(`Kontakte neu aufsetzen?\n\n1. Mirella sichert zuerst dein ganzes iPhone-Telefonbuch als Datei.\n2. Danach fragt sie noch einmal, bevor die ${S.people.length} Kontakte in Mirella wegkommen.\n3. Dein Telefonbuch bleibt dabei, wie es ist.`)) return;
    let r; try { r = await MC.backup({ share: true }); } catch (e) { alert("Die Sicherung ging nicht, deshalb bleibt alles, wie es ist.\n" + (e && e.message || e)); return; }
    N.kBackup = { at: Date.now(), n: r.count, file: r.file }; nSave();
    openSheet(`<p class="stitle">Sicherung ist gemacht</p><p class="hint" style="margin-top:0">${r.count} Kontakte gesichert als „${esc(r.file)}“. Die Datei liegt in der Dateien-App unter „Auf meinem iPhone › Mirella › Sicherung“. Über das Teilen-Menü kannst du sie zusätzlich in deine Ablage legen.</p><p class="hint"><b>Jetzt alle ${S.people.length} Kontakte in Mirella entfernen?</b> Notizen, Anrufe und Geschenkideen gehen mit. Im Telefonbuch wird dabei nichts gelöscht. Danach gehst du jeden Eintrag als Karte durch.</p><div class="row2"><button class="btn" data-act="cancel">Abbrechen</button><button class="btn danger" data-act="kneugo">Ja, alles neu</button></div>`);
  };
  ACT.kneugo = async () => {
    S.goneP = (S.goneP || []).concat(S.people.map(p => p.id)); S.people = [];
    S.todos.forEach(t => { if (t.pid) delete t.pid; });
    S.settings.appleIgnored = []; S.settings.bdayLinks = {}; S.settings.notSame = [];
    N.aid = {}; N.cs = {}; N.cards = []; N.later = {}; N.bpend = {}; N.kNeu = today(); N.twoWayFrom = today(); N.grpNo = [];
    nSave(); save(); closeSheet(); toast("Lese das Telefonbuch …");
    await contactsSync(false); await calendarBirthdays();
    kCur = null; kStep = "karte"; kPid = null; view = "kdurch"; render();
  };
  /* Während der Pflege darf ein Abgleich im Hintergrund nichts wegwischen, was gerade getippt wird */
  let kFresh = false;
  const kOrigRender = render;
  render = function () {
    let keep = null, pid = kPid;
    if (!kFresh && view === "kdurch" && kStep === "pflege" && $("#kp-first")) keep = [...document.querySelectorAll("#screen input, #screen select, #screen textarea")].filter(e => e.id).map(e => ({ id: e.id, v: e.type === "checkbox" ? e.checked : e.value, f: document.activeElement === e, s: e.selectionStart }));
    kFresh = false;
    const r = kOrigRender.apply(this, arguments);
    if (keep && view === "kdurch" && kStep === "pflege" && pid === kPid) for (const k of keep) { const e = document.getElementById(k.id); if (!e || e.disabled) continue; if (e.type === "checkbox") e.checked = k.v; else e.value = k.v; if (k.f) { e.focus(); try { e.setSelectionRange(k.s, k.s); } catch (_) { } } }
    if (keep && view === "kdurch" && kStep === "pflege" && pid === kPid) { pickSync(); const d = $("#kp-death"); if (d && d.value) $("#kp-deathbox").hidden = false; const g = $("#kp-gift"); if (g) $("#kp-gideabox").hidden = !g.checked; }
    return r;
  };
  HOOKS.menschenTop.push(() => !N.kNeu && S.people.length ? `<div class="card" role="button" tabindex="0" data-act="kneu"><span class="av">↻</span><span style="min-width:0"><div class="t">Kontakte neu aufsetzen</div><div class="s" style="white-space:normal">Telefonbuch sichern, Mirella leeren, dann jeden Eintrag einzeln als Karte durchgehen</div></span><span class="chev">›</span></div>` : "");
  HOOKS.menschenTop.push(() => { const n = kQueue().length; return n ? `<div class="card due" role="button" tabindex="0" data-act="kopen"><span class="av">👤</span><span style="min-width:0"><div class="t">${n === 1 ? "1 neuer Kontakt zu prüfen" : n + " Kontakte zu prüfen"}</div><div class="s">Antippen und Karte für Karte durchgehen</div></span><span class="chev">›</span></div>` : ""; });
  /* Löschen und Zusammenführen bei fertigen Kontakten wirkt auf Wunsch auch im Telefonbuch */
  const kOrigDel = ACT.delperson;
  ACT.delperson = async el => {
    const p = S.people.find(x => x.id === el.dataset.id), aid = p && liveAid(p);
    if (!aid || !MC || !MC.remove) return kOrigDel(el);
    if (!ask(fullName(p) + " wirklich löschen? Notizen und Anrufverlauf gehen mit.")) return;
    const both = ask("Auch aus dem iPhone-Telefonbuch löschen?\n\nOK: in Mirella und im Telefonbuch weg.\nAbbrechen: nur aus Mirella entfernen, im Telefonbuch bleibt der Kontakt.");
    if (both) { try { await MC.remove({ id: aid }); } catch (e) { alert("Das Löschen im Telefonbuch ging nicht: " + (e && e.message || e)); return; } } else S.settings.appleIgnored.push(aid, ckey(p));
    dropPerson(p); draftClear(); save(); closeSheet(); view = "menschen"; render(); toast(both ? "In Mirella und im Telefonbuch gelöscht" : "Aus Mirella entfernt, bleibt im Telefonbuch");
  };
  const kOrigDD = ACT.dodupmerge;
  ACT.dodupmerge = async el => {
    const a = S.people.find(x => x.id === el.dataset.a), b = S.people.find(x => x.id === el.dataset.b), ia = a && liveAid(a), ib = b && liveAid(b);
    if (!ia || !ib || ia === ib || !MC || !MC.merge) return kOrigDD(el);
    if (!ask(`${fullName(b)} in ${fullName(a)} zusammenführen?\n\nAuch im iPhone-Telefonbuch bleibt dann nur ein Eintrag mit allen Nummern. Der zweite wird gelöscht.`)) return;
    try { await MC.merge({ keep: ia, drop: ib }); } catch (e) { alert("Das Zusammenführen im Telefonbuch ging nicht: " + (e && e.message || e)); return; }
    mergeInto(a, b); dropPerson(b); delete N.cs[a.id]; nSave(); save(); toast("Zusammengeführt: " + fullName(a)); ACT.dupscan();
  };

  /* Einstellungen › Kontakte: Durchgang, Sicherung, Neustart */
  const origSetK = SETS.kontakte;
  SETS.kontakte = function () {
    const n = kQueue().length;
    return `<button class="btn${n ? " pri" : ""}" data-act="kopen" style="width:100%;margin-bottom:8px">Kontakte durchgehen (${n} offen)</button>
    <button class="btn" data-act="kbackup" style="width:100%;margin-bottom:8px">Telefonbuch als Datei sichern</button>${N.kBackup ? `<p class="hint" style="margin-top:0">Letzte Sicherung: ${esc(new Date(N.kBackup.at).toLocaleString("de-DE"))}, ${N.kBackup.n} Kontakte, „${esc(N.kBackup.file)}“.</p>` : ""}
    <button class="btn danger" data-act="kneu" style="width:100%;margin-bottom:8px">Kontakte neu aufsetzen (alles leeren)</button>
    <p class="hint" style="margin-top:0">Neu aufsetzen sichert erst das Telefonbuch, leert dann die Kontakte in Mirella und zeigt jeden Eintrag einzeln als Karte. Im Telefonbuch wird dabei nichts gelöscht.</p>` + origSetK.call(this).replace('<button class="btn" data-act="dupscan" style="width:100%;margin-bottom:8px">Doppelte Kontakte suchen</button>', "");
  };

  /* ---------- Querverweise: Geburtstags-Kalender ↔ Kontakte ---------- */
  let qvPick = null, qvQ = "";
  R.querverweise = function () {
    const open = bOpen(), links = bLinks(), all = N.bdays || [];
    const done = all.filter(b => links[b.key] && links[b.key] !== "x").length, skipped = all.filter(b => links[b.key] === "x").length;
    const head = `<div class="top"><button class="tleft tsetbtn" data-act="qvback" aria-label="Zurück"><p class="big">‹ Geburtstage</p></button></div>`;
    if (!all.length) return head + empty("In deinem iPhone-Kalender habe ich keinen Geburtstags-Kalender gefunden. Der Kalender muss „Geburtstag“ im Namen haben.") + `<button class="btn" data-act="nkontakte" style="width:100%;margin-top:10px">Noch einmal abgleichen</button>`;
    const rows = open.map((b, i) => {
      if (qvPick === b.key) {
        const ql = qvQ.trim().toLowerCase(), hits = ql.length > 1 ? S.people.filter(p => !p.arch && fullName(p).toLowerCase().includes(ql)).slice(0, 8) : [];
        return `<div class="pitem"><b>${esc(b.title)}</b> · ${fmtMd(b.md)}<input class="search" id="qvq" type="search" placeholder="Kontakt suchen" aria-label="Kontakt suchen" value="${esc(qvQ)}" style="margin:8px 0">${hits.map(p => `<button class="btn" data-act="qvlink" data-i="${i}" data-id="${p.id}" style="width:100%;margin-bottom:6px;text-align:left">${esc(fullName(p))}${p.tel ? " · " + esc(p.tel) : ""}</button>`).join("") || (ql.length > 1 ? '<p class="hint">Niemand gefunden.</p>' : "")}<button class="mini" data-act="qvpick" data-i="-1">Abbrechen</button></div>`;
      }
      const c = bCandidates(b).slice(0, 3);
      return `<div class="pitem"><b>${esc(b.title)}</b> · ${fmtMd(b.md)}${b.year ? " · " + b.year : ""}
        <div class="chips" style="margin:8px 0 0">${c.map(x => `<button class="chip2" data-act="qvlink" data-i="${i}" data-id="${x.p.id}">${esc(fullName(x.p))}</button>`).join("")}<button class="chip2" data-act="qvpick" data-i="${i}">Anderer …</button><button class="chip2" data-act="qvnew" data-i="${i}">Neuer Kontakt</button><button class="chip2" data-act="qvskip" data-i="${i}">Kein Kontakt</button></div></div>`;
    }).join("");
    return `${head}<p class="hint" style="margin-top:0">Dein Geburtstags-Kalender hat <b>${all.length}</b> Einträge. <b>${done}</b> sind einem Kontakt zugeordnet${skipped ? ", " + skipped + " ohne Kontakt" : ""}. ${open.length ? "Bei diesen <b>" + open.length + "</b> bin ich nicht sicher. Tipp auf den richtigen Kontakt:" : "Alle sind zugeordnet."}</p>${rows}`;
  };
  ACT.querv = () => { closeAll(); qvPick = null; qvQ = ""; view = "querverweise"; render(); };
  ACT.qvback = () => { view = pending().length ? "aufraeumen" : "menschen"; render(); };
  ACT.qvpick = el => { const b = bOpen()[+el.dataset.i]; qvPick = b ? b.key : null; qvQ = ""; render(true); const i = $("#qvq"); if (i) i.focus(); };
  /* Gehört der Kalender-Geburtstag zu jemand anderem als dem Kontakt selbst (z. B. dem Kind), kommt er als Angehöriger in die Familie */
  const bName = b => b.title.replace(/\(.*?\)/g, " ").split(/\s+/).filter(w => w && !BSTOP.has(normName(w)) && !/^\d/.test(w)).map(w => w.replace(/[’'`]s$/, "")).join(" ").trim();
  const bIsOther = (b, p) => { const n = normName(bName(b).split(" ")[0] || ""), f = normName(p.first || ""), nk = normName(p.nick || ""); return !!n && !!f && n !== f && n !== nk && !f.startsWith(n) && !n.startsWith(f); };
  const bToKin = (b, p) => { const nm = bName(b) || b.title, bd = (b.year || 1604) + "-" + b.md; p.kin = p.kin || []; const k = p.kin.find(x => normName(x.name) === normName(nm)); if (k) { if (!k.bday) k.bday = bd; } else p.kin.push({ id: uid(), name: nm, rel: "Kind", bday: bd, death: "" }); };
  const qvSet = (b, p) => { bLinks()[b.key] = p.id; if (bIsOther(b, p)) { bToKin(b, p); toast(bName(b) + " steht jetzt in der Familie von " + fullName(p) + ". Dort kannst du „Kind“ ändern."); } else bApply(b, p); p.rev = p.rev || today(); qvPick = null; save(); render(true); };
  ACT.qvlink = el => { const b = bOpen()[+el.dataset.i], p = S.people.find(x => x.id === el.dataset.id); if (!b || !p) return; qvSet(b, p); toast(b.title + " → " + fullName(p)); };
  ACT.qvnew = el => {
    const b = bOpen()[+el.dataset.i]; if (!b) return;
    const words = b.title.replace(/\(.*?\)/g, " ").split(/\s+/).filter(w => w && !BSTOP.has(normName(w)) && !/^\d/.test(w)).map(w => w.replace(/[’'`]s$/, ""));
    const p = isNewPerson({ first: words.shift() || b.title, last: words.join(" "), tel: "", email: "", addr: "", bday: "" }); p.rev = today();
    S.people.push(p); qvSet(b, p); toast(fullName(p) + " angelegt");
  };
  ACT.qvskip = el => { const b = bOpen()[+el.dataset.i]; if (!b) return; bLinks()[b.key] = "x"; save(); render(true); };
  document.addEventListener("input", e => { if (e.target && e.target.id === "qvq") { qvQ = e.target.value; const pos = e.target.selectionStart; render(true); const i = $("#qvq"); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (_) { } } } });

  /* ---------- Einstellungen › iPhone ---------- */
  SETNAMES.iphone = "iPhone";
  SETS.iphone = () => `<p class="hint" style="margin-top:0">Kontakte und Geburtstage gleicht Mirella stündlich mit deinem iPhone ab. Neue iPhone-Kontakte landen unter Einstellungen › Kontakte › Kontakte aufräumen. Wie oft Mirella nervt, stellst du unter Nerv-Modus ein.</p>
    <div class="row2" style="margin-top:8px"><button class="btn" data-act="nkontakte">Jetzt abgleichen</button><button class="btn" data-act="nfreigaben">Freigaben prüfen</button></div>
    <button class="btn" data-act="kopen" style="width:100%;margin-top:8px">Kontakte durchgehen (${kQueue().length} offen)</button>
    ${S.settings.appleIgnored.length ? `<button class="btn" data-act="nunignore" style="width:100%;margin-top:8px">Aussortierte wieder vorschlagen (${S.settings.appleIgnored.length})</button>` : ""}
    <p class="hint"><b>Teilen an Mirella</b> (aus Safari, Mail, Fotos): Teilen-Knopf antippen, in der Reihe mit den App-Symbolen ganz nach rechts wischen, „Mehr“ antippen, oben „Bearbeiten“, bei Mirella das Plus antippen und Mirella nach oben ziehen. Danach steht Mirella immer vorne in der Reihe.</p>
    ${P.MirellaAlarm ? `<p class="hint"><b>Wecker:</b> ${alarmNote()}${alarmDiag()}</p>${N.alarmState === "authorized" || N.alarmState === "unavailable" ? "" : '<button class="btn" data-act="nwecker" style="width:100%">Echten Wecker erlauben</button>'}${N.alarmState === "unavailable" ? "" : '<button class="btn" data-act="nweckertest" style="width:100%;margin-top:8px">Wecker jetzt testen (klingelt in 1 bis 2 Minuten)</button>'}` : ""}
    <p class="hint">Termine aus deinem iPhone-Kalender zeigt Mirella im Kalender mit an${N.events ? " (" + N.events.length + " geladen)" : ""}. Sie bleiben auf dem iPhone und werden nicht kopiert.</p>
    ${setH("In beide Richtungen")}
    ${P.MirellaContacts ? `<button class="drow" data-act="ntwoway"><span class="dt"><b>Kontakte ins iPhone-Telefonbuch schreiben</b><small>${N.twoWay === false ? "aus" : "an: Name, Geburtstag, neue Nummer und E-Mail. Es wird nie etwas gelöscht."}</small></span><span class="chev">${N.twoWay === false ? "○" : "●"}</span></button>` : ""}
    <p class="hint" style="margin-bottom:6px"><b>Mirella-Termine im iPhone-Kalender „Mirella“</b></p>
    <div class="seg">${[["wahl", "Nur gewählte"], ["zeit", "Mit Uhrzeit"], ["alle", "Alle"], ["aus", "Aus"]].map(([v, l]) => `<button data-act="ncalmode" data-m="${v}" aria-pressed="${calMode() === v}">${l}</button>`).join("")}</div>
    <p class="hint">To-dos und Einkäufe bleiben in Mirella und landen nicht im iPhone-Kalender. Bei „Nur gewählte“ steht dort nur, was du bei einer Aufgabe selbst mit „In den Kalender“ schickst. Änderst du den Termin dort, ändert er sich auch in Mirella. Neue Termine, die du am iPhone in den Kalender „Mirella“ legst, erscheinen hier als Aufgabe.</p>`;
  const origEinst2 = R.einstellungen;
  R.einstellungen = function () {
    const h = origEinst2.call(this); if (setSec) return h;
    const row = `<button class="drow" data-act="setsec" data-k="iphone">${IC.bell || ""}<span class="dt"><b>iPhone</b><small>Kontakte, Kalender, Freigaben</small></span><span class="chev">›</span></button>`;
    const i = h.indexOf('<div class="sethead2">Mirella</div>'); return i < 0 ? h + row : h.slice(0, i + '<div class="sethead2">Mirella</div>'.length) + row + h.slice(i + '<div class="sethead2">Mirella</div>'.length);
  };
  ACT.nkontakte = async () => { toast("Gleiche ab …"); const r = await contactsSync(false); const b = await calendarBirthdays(); const ev = await calendarEvents(); render(true); toast(`${kQueue().length === 1 ? "1 Karte" : kQueue().length + " Karten"} offen, ${b} Geburtstage ergänzt, ${ev} Termine geladen`); };
  ACT.nunignore = () => { if (!ask("Alle aussortierten Kontakte wieder als Vorschlag auf „Heute“ zeigen?")) return; S.settings.appleIgnored = []; N.lastContacts = 0; nSave(); save(); tick(); toast("Sie erscheinen gleich wieder als Vorschlag"); };
  ACT.nfreigaben = () => { N.setup = false; nSave(); wizard(); };

  /* ---------- Start ---------- */
  const tick = async () => {
    if (!N.setup) return;
    if (Date.now() - (N.lastContacts || 0) > 3600e3) { N.lastContacts = Date.now(); nSave(); purgeIgnored(); await contactsSync(false); await calendarBirthdays(); await calendarEvents(); render(true); }
    scheduleLocal();
    try { if ((await P.PushNotifications.checkPermissions()).receive === "granted") P.PushNotifications.register(); } catch (_) { }
  };
  /* ---------- Nachfrage beim Start: alles, was neu einzugeben ist, einmal gesammelt (Wunsch Felix), danach nie wieder ----------
     Kommt später etwas dazu, das Felix eingeben oder erlauben muss: hier einen Eintrag in NEED ergänzen. */
  const NEED = [
    { k: "ki", missing: () => typeof kiOn === "function" && !kiOn(), bad: () => typeof KI !== "undefined" && keyIsBad("ki", KI.key), html: b => keyField("nf-ki", "Claude-Schlüssel (für die Mirella-KI)", { ph: "sk-ant-… einfügen", warn: b ? "Der eingetragene Schlüssel funktioniert nicht mehr. Bitte neu eintragen." : "" }), save: () => { const v = ($("#nf-ki").value || "").trim(); if (v) { KI.key = v; kiSave(); keyBad("ki", v, false); N.keyOk = N.keyOk || {}; delete N.keyOk.ki; } } },
    { k: "gmaps", missing: () => !S.settings.gmapsKey, bad: () => keyIsBad("gmaps", S.settings.gmapsKey), html: b => keyField("nf-gm", "Google-Maps-Schlüssel (für den Wecker nach Verkehr)", { ph: "AIza… einfügen", warn: b ? "Der eingetragene Schlüssel funktioniert nicht. Google sagt: ungültig. Bitte neu eintragen." : "" }), save: () => { const v = ($("#nf-gm").value || "").trim(); if (v) { S.settings.gmapsKey = v; keyBad("gmaps", v, false); N.keyOk = N.keyOk || {}; delete N.keyOk.gmaps; } } },
    { k: "wecker", missing: () => !!P.MirellaAlarm && !N.alarmState, html: () => `<p class="hint">Dein iPhone fragt gleich einmal, ob Mirella echte Wecker stellen darf. Bitte <b>Erlauben</b> tippen.</p>`, save: async () => { try { const r = await P.MirellaAlarm.request(); N.alarmState = r.state; } catch (_) { } } }
  ];
  /* Fehlendes nur einmal fragen. Ein Schlüssel, den der Dienst abgelehnt hat, kommt beim nächsten Öffnen wieder,
     bis ein neuer eingetragen ist oder „Später“ getippt wurde (dann erst wieder, wenn er erneut abgelehnt wird). */
  const needOpen = () => { N.asked = N.asked || {}; N.badLater = N.badLater || {}; return NEED.filter(x => (!N.asked[x.k] && x.missing()) || (x.bad && x.bad() && N.badLater[x.k] !== keyBadGet()[x.k])); };
  function nachfrage() {
    const open = needOpen(); if (!open.length || document.querySelector("#sheet.open")) return false;
    const bad = open.filter(x => x.bad && x.bad()), onlyBad = bad.length === open.length;
    openSheet(`<p class="stitle">${onlyBad ? "Schlüssel funktioniert nicht" : "Neu in Mirella"}</p><p class="hint" style="margin-top:0">${onlyBad ? "Der Dienst lehnt den eingetragenen Schlüssel ab. Bitte den richtigen Schlüssel neu einfügen. Danach prüft Mirella ihn gleich." : "Das fehlt noch. Einmal eintragen, danach fragt Mirella nicht mehr. Du kannst Felder auch leer lassen und später unter Einstellungen nachtragen."}</p>${open.map(x => x.html(bad.includes(x))).join("")}<div class="row2">${bad.length ? '<button class="btn" data-act="nflater">Später</button>' : ""}<button class="btn pri" data-act="nfsave">Speichern</button></div>`);
    return true;
  }
  ACT.nfsave = async el => {
    el.disabled = true;
    for (const x of needOpen()) { try { await x.save(); } catch (_) { } N.asked[x.k] = 1; }
    nSave(); save(); closeAll(); render(true); toast("Gespeichert"); setTimeout(keyCheck, 500);
  };
  ACT.nflater = () => { for (const x of needOpen()) { N.asked[x.k] = 1; if (x.bad && x.bad()) N.badLater[x.k] = keyBadGet()[x.k]; } nSave(); closeAll(); toast("Unter Einstellungen kannst du ihn jederzeit neu eintragen"); };
  /* Beim Öffnen: jeden neu eingetragenen Schlüssel einmal kurz ausprobieren. Ein funktionierender Schlüssel wird nicht wieder geprüft. */
  async function keyCheck(loud) {
    N.keyOk = N.keyOk || {}; let bad = false;
    if (loud === true) delete N.keyOk.gmaps;
    try {
      if (typeof KI !== "undefined" && KI.key && N.keyOk.ki !== keySum(KI.key) && !keyIsBad("ki", KI.key)) {
        const r = await fetch("https://api.anthropic.com/v1/models?limit=1", { headers: { "x-api-key": KI.key, "anthropic-version": "2026-10-21", "anthropic-dangerous-direct-browser-access": "true" } });
        if (r.status === 401 || r.status === 403) { keyBad("ki", KI.key, true); bad = true; } else if (r.ok) N.keyOk.ki = keySum(KI.key);
      }
    } catch (_) { }
    try {
      const g = S.settings.gmapsKey;
      if (g && N.keyOk.gmaps !== keySum(g) && !keyIsBad("gmaps", g)) {
        const r = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", { method: "POST", headers: { "Content-Type": "application/json", "X-Ios-Bundle-Identifier": "de.brenzinger.mirella", "X-Goog-Api-Key": g, "X-Goog-FieldMask": "routes.duration" }, body: JSON.stringify({ origin: { location: { latLng: { latitude: 48.78, longitude: 9.18 } } }, destination: { location: { latLng: { latitude: 48.79, longitude: 9.19 } } }, travelMode: "DRIVE" }) });
        if (r.ok) N.keyOk.gmaps = keySum(g); else if (r.status === 400 || r.status === 403) { let m = ""; try { m = JSON.stringify(await r.json()); } catch (_) { } if (r.status === 403 || /API key|API_KEY/i.test(m)) { keyBad("gmaps", g, true); bad = true; } }
      }
    } catch (_) { }
    nSave();
    if (loud === true) { const g = S.settings.gmapsKey; if (g) toast(keyIsBad("gmaps", g) ? "Google lehnt diesen Schlüssel ab. Bitte prüfen." : N.keyOk.gmaps === keySum(g) ? "Google-Schlüssel funktioniert" : "Gespeichert. Prüfen klappt gerade nicht (kein Netz?)"); render(true); return; }
    if (bad) nachfrage();
  }
  window.mirellaKeyCheck = keyCheck;
  /* ---------- Was das iPhone selbst kann (MirellaSystemPlugin) ---------- */
  const SY = P.MirellaSystem;
  const b64Of = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.onerror = rej; r.readAsDataURL(blob); });
  if (SY) {
    // Texterkennung von Apple statt Tesseract: gleiche Aufrufstelle, nichts wird aus dem Internet geladen
    window.Tesseract = { recognize: async blob => { const r = await SY.ocr({ images: [await b64Of(blob)] }); return { data: { text: (r.texts || [])[0] || "" } }; } };
    // Live-Kamera: angetippten Text übernehmen
    ACT.livescan = async () => {
      closeSheet(); let r; try { r = await SY.liveScan(); } catch (e) { toast(e && e.message || "Die Kamera geht gerade nicht"); return; }
      const t = (r && r.text || "").trim(); if (!t) return;
      const tel = (t.match(/(\+|0)[\d\s\/().-]{6,}\d/) || [])[0];
      openSheet(`<p class="stitle">Das habe ich gelesen</p><div class="fld"><textarea id="ls-t" rows="4">${esc(t)}</textarea></div><div style="display:grid;gap:8px">
        ${tel ? `<a class="btn pri" href="tel:${esc(intlTel(tel))}" style="text-decoration:none;text-align:center">📞 ${esc(tel.trim())} anrufen</a><button class="btn" data-act="lsperson" data-tel="${esc(tel.trim())}">Als neuen Kontakt anlegen</button>` : ""}
        <button class="btn${tel ? "" : " pri"}" data-act="lsvoice">An Mirella geben (Aufgabe, Termin, Notiz)</button><button class="btn" data-act="lscopy">Kopieren</button></div>`);
    };
    ACT.lsvoice = () => { const t = $("#ls-t").value; voiceStart(); recStop(); $("#v-text").value = t; };
    ACT.lscopy = () => { try { navigator.clipboard.writeText($("#ls-t").value); toast("Kopiert"); } catch (_) { toast("Kopieren geht hier nicht"); } };
    ACT.lsperson = el => { closeSheet(); personForm(null); setTimeout(() => { const i = $("#c-tel"); if (i) { i.value = el.dataset.tel; i.dispatchEvent(new Event("input", { bubbles: true })); } }, 200); };
    // Siri, Kurzbefehle, Action-Taste: "Sag Mirella …" kommt hier als Text an
    const intentIn = async () => { try { const r = await SY.takeIntent(); const t = (r && r.text || "").trim(); if (!t || !N.setup) return; closeAll(); voiceStart(); recStop(); $("#v-text").value = t; voiceReview(); } catch (_) { } };
    SY.addListener("intent", () => setTimeout(intentIn, 300)); setTimeout(intentIn, 1500);
    // Anruf zu Ende: kurzer Anruf ohne Gespräch zählt als nicht erreicht, sonst fragt Mirella nach
    SY.addListener("callEnded", d => {
      const p = pendingCall && S.people.find(x => x.id === pendingCall); if (!p || !d || d.outgoing === false) return; pendingCall = null;
      const go = () => { if (!d.connected || d.seconds < 20) { logCall(p, false); render(true); toast(fullName(p) + " nicht erreicht. Neuer Versuch ist geplant."); } else { callResult(p, false); const h = $("#sheetbody .swipehint"); if (h) h.textContent = "Das Gespräch ging " + (d.seconds < 90 ? d.seconds + " Sekunden" : Math.round(d.seconds / 60) + " Minuten") + ". Wie ist es gelaufen?"; } };
      if (document.hidden) document.addEventListener("visibilitychange", function once() { if (!document.hidden) { document.removeEventListener("visibilitychange", once); setTimeout(go, 500); } }); else setTimeout(go, 500);
    });
    // Apple-KI auf dem iPhone (kostenlos, ohne Internet), wenn das Gerät sie hat
    SY.kiStatus().then(r => { N.appleKi = r.state; nSave(); if (r.state === "available") window.appleKi = async (system, user) => (await SY.ki({ system, user })).text; }).catch(() => { });
    // Erinnerungen nach Ort: Mitteilung beim Ankommen oder Verlassen
    const placesSync = () => { const n = S.todos.filter(t => t.list === "einkauf" && !t.done).length; SY.setPlaces({ places: (N.places || []).map(o => ({ id: o.id, lat: o.lat, lon: o.lon, radius: o.r || 150, exit: !!o.exit, title: (o.exit ? "Du verlässt " : "Du bist bei ") + o.name, body: (o.text || "") + (o.shop && n ? (o.text ? " " : "") + n + (n === 1 ? " Sache" : " Sachen") + " auf der Einkaufsliste." : "") || "Mirella erinnert dich." })) }).catch(() => { }); };
    let plSig = "";
    setInterval(() => { const sg = JSON.stringify(N.places || []) + S.todos.filter(t => t.list === "einkauf" && !t.done).length; if (sg !== plSig) { plSig = sg; placesSync(); } }, 20000);
    ACT.nplace = () => {
      openSheet(`<p class="stitle">Erinnerung an einem Ort</p><div class="fld" style="position:relative"><label for="pl-o">Welcher Ort?</label><input id="pl-o" placeholder="z. B. Rewe Remseck oder deine Adresse" autocomplete="off"><div id="pl-sug" class="sug" hidden></div></div>
      <div class="fld"><label for="pl-w">Wann?</label><select id="pl-w"><option value="">Wenn ich ankomme</option><option value="x">Wenn ich weggehe (z. B. Haustür)</option></select></div>
      <div class="fld"><label for="pl-t">Was soll Mirella sagen?</label><input id="pl-t" placeholder="z. B. Schlüssel, Supplements, Fenster zu?" autocomplete="off"></div>
      <label class="chk"><input type="checkbox" id="pl-s"> Einkaufsliste dazu nennen</label>
      <div class="row2"><button class="btn" data-act="cancel">Abbrechen</button><button class="btn pri" data-act="nplacesave">Speichern</button></div>`, () => addrSuggest($("#pl-o"), $("#pl-sug"), true));
    };
    ACT.nplacesave = () => { const i = $("#pl-o"); if (!i.dataset.lat) { toast("Bitte den Ort aus den Vorschlägen antippen"); return; } N.places = N.places || []; if (N.places.length >= 18) { toast("Mehr als 18 Orte erlaubt das iPhone nicht"); return; } N.places.push({ id: uid(), name: (i.dataset.label || i.value).split(",")[0], lat: +i.dataset.lat, lon: +i.dataset.lon, exit: !!$("#pl-w").value, text: $("#pl-t").value.trim(), shop: $("#pl-s").checked }); nSave(); placesSync(); closeSheet(); render(true); toast("Gespeichert"); };
    ACT.nplacedel = el => { const o = (N.places || []).find(x => x.id === el.dataset.id); if (!o || !ask("Erinnerung bei " + o.name + " löschen?")) return; N.places = N.places.filter(x => x !== o); nSave(); placesSync(); render(true); };
    // Dokumente zusätzlich in die Dateien-App legen (Auf meinem iPhone › Mirella › Ordner). Mirellas eigene Ablage bleibt, das ist eine Kopie.
    const fname = x => String(x || "Dokument").replace(/[\/\\:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
    const filesSync = async () => {
      if (N.files === false) return; N.filed = N.filed || {};
      for (const [id, path] of Object.entries(N.filed)) if (!S.docs.some(d => d.id === id)) { try { await SY.removeFile({ path }); } catch (_) { } delete N.filed[id]; }
      let n = 0;
      for (const d of S.docs) {
        if (N.filed[d.id] || !d.photo || n >= 4) continue;
        try { const blob = await photoGet(d.photo); if (!blob) continue; const ext = /pdf/.test(blob.type || d.type || "") ? "pdf" : /png/.test(blob.type || "") ? "png" : "jpg", path = fname(d.folder || "Sonstiges") + "/" + fname(d.name) + " " + (d.created || "") + "." + ext; await SY.saveFile({ path, data: await b64Of(blob) }); N.filed[d.id] = path; n++; } catch (_) { }
      }
      nSave();
    };
    setTimeout(filesSync, 8000); setInterval(filesSync, 60000);
    ACT.nfiles = () => { N.files = N.files === false; nSave(); render(true); if (N.files) filesSync(); toast(N.files ? "Dokumente erscheinen in der Dateien-App" : "Es werden keine neuen Kopien mehr abgelegt"); };
    // Live-Anzeige „Jetzt musst du los“: Countdown auf Sperrbildschirm und Dynamic Island, ab 3 Stunden vor dem Losgehen.
    // iOS lässt eine App die Anzeige nur starten, solange sie offen ist. Darum prüft Mirella bei jedem Öffnen und jede Minute.
    const nextLos = () => {
      const now = Date.now(), out = [];
      for (const w of S.alarms || []) { if (!w.wake || w.off || !w.leave) continue; out.push({ at: +new Date((w.leaveDate || w.date) + "T" + w.leave + ":00"), titel: weckerName(w), ziel: String(w.to || "").split(",")[0], info: (w.travelMin ? w.travelMin + " Min. unterwegs · " : "") + "Ankunft " + w.arrive }); }
      for (const t of S.todos) { if (t.done || !t.los || !t.ort || !t.time) continue; out.push({ at: +new Date((t.losDate || t.date) + "T" + t.los + ":00"), titel: t.t, ziel: String(t.ort).split(",")[0], info: t.fahrt + " Min. mit dem Auto · Ankunft " + t.time }); }
      return out.filter(x => x.at > now - 10 * 60e3 && x.at < now + 3 * 3600e3).sort((a, b) => a.at - b.at)[0] || null;
    };
    const liveSync = liveSyncRef = async () => {
      if (N.live === false || document.hidden) return;
      const x = nextLos(), sig = x ? x.at + "|" + x.titel + "|" + x.info : "";
      if (sig === (N.liveSig || "")) return;
      try { if (x) { const r = await SY.losStart({ los: x.at, titel: x.titel, ziel: x.ziel, info: x.info }); if (!r.ok) { N.liveErr = r.reason || ""; nSave(); if (r.reason === "unavailable" || r.reason === "aus") { N.liveSig = sig; nSave(); } return; } N.liveErr = ""; } else await SY.losEnd(); N.liveSig = sig; nSave(); } catch (e) { N.liveErr = String(e && e.message || e).slice(0, 160); nSave(); }
    };
    ACT.nlivetest = async () => {
      let r; try { r = await SY.losStart({ los: Date.now() + 10 * 60e3, titel: "Test von Mirella", ziel: "Countdown", info: "läuft 10 Minuten" }); } catch (e) { r = { ok: false, reason: String(e && e.message || e) }; }
      N.liveSig = ""; N.liveErr = r && r.ok ? "" : (r && r.reason || "unbekannt"); nSave(); render(true);
      alert(r && r.ok ? "Der Countdown ist gestartet. Sperre jetzt das iPhone: Er muss auf dem Sperrbildschirm stehen." : "Das iPhone hat den Countdown nicht gestartet. Grund: " + liveWhy());
    };
    const liveWhy = () => { const e = N.liveErr || ""; return !e ? "" : e === "aus" ? "Live-Aktivitäten sind für Mirella ausgeschaltet. iPhone-Einstellungen › Apps › Mirella › Live-Aktivitäten einschalten." : e === "unavailable" ? "Dieses iPhone ist zu alt dafür (braucht iOS 16.2)." : e; };
    setTimeout(liveSync, 4000); setInterval(liveSync, 60000); document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(liveSync, 800); });
    ACT.nlive = () => { N.live = N.live === false; N.liveSig = ""; nSave(); if (N.live) liveSync(); else SY.losEnd().catch(() => { }); render(true); toast(N.live ? "Countdown auf dem Sperrbildschirm ist an" : "Countdown ist aus"); };
    // Teilen nach Mirella: was aus Mail, Safari, Fotos … geteilt wurde, beim Öffnen einsortieren
    let shareBusy = false;
    const sharedIn = async () => {
      if (shareBusy || !N.setup || document.hidden) return; shareBusy = true;
      try {
        const items = ((await SY.takeShared()) || {}).items || []; let files = 0; const texts = [];
        for (const it of items) {
          if (it.kind === "file" && it.data) { const bin = atob(it.data), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); await addDocFile(new File([u8], it.name || "Geteilt", { type: it.mime || "application/octet-stream" })); files++; }
          else if (it.text) texts.push(it.kind === "url" ? "Link ansehen: " + it.text : it.text);
        }
        if (files) toast(files === 1 ? "Geteiltes Dokument abgelegt" : files + " geteilte Dokumente abgelegt");
        if (texts.length) { closeAll(); voiceStart(); recStop(); $("#v-text").value = texts.join("\n"); const st = $("#sheetbody .stitle"); if (st) st.textContent = "Geteilt an Mirella"; }
      } catch (_) { }
      shareBusy = false;
    };
    setTimeout(sharedIn, 2500); document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(sharedIn, 700); });
    // Face ID: nur als Schalter in den Einstellungen, zunächst aus
    let lockedAt = 0;
    const lock = async () => {
      if (!N.faceId || $("#facelock")) return;
      const d = document.createElement("div"); d.id = "facelock"; d.style.cssText = "position:fixed;inset:0;z-index:9999;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px";
      d.innerHTML = '<p class="big" style="margin:0">Mirella</p><button class="btn pri" id="faceopen">Mit Face ID öffnen</button>'; document.body.appendChild(d);
      const tryIt = async () => { try { const r = await SY.faceId({ reason: "Mirella öffnen" }); if (r.ok || r.available === false) d.remove(); } catch (_) { } };
      d.querySelector("#faceopen").addEventListener("click", tryIt); tryIt();
    };
    document.addEventListener("visibilitychange", () => { if (document.hidden) lockedAt = Date.now(); else if (lockedAt && Date.now() - lockedAt > 120e3) lock(); });
    lock();
    ACT.nfaceid = async () => { if (!N.faceId) { const r = await SY.faceId({ reason: "Face ID für Mirella einschalten" }).catch(() => ({})); if (!r.ok) { toast(r.available === false ? "Face ID ist auf diesem iPhone nicht eingerichtet" : "Nicht eingeschaltet"); return; } } N.faceId = !N.faceId; nSave(); render(true); toast(N.faceId ? "Mirella öffnet jetzt nur mit Face ID" : "Face ID ist aus"); };
    const origIph = SETS.iphone;
    SETS.iphone = () => origIph() + `${setH("Erinnerungen nach Ort")}
      ${(N.places || []).map(o => `<div class="listrow"><span class="grow">${esc(o.name)}<small>${o.exit ? "beim Weggehen" : "beim Ankommen"}${o.text ? " · " + esc(o.text) : ""}${o.shop ? " · mit Einkaufsliste" : ""}</small></span><button class="mini" data-act="nplacedel" data-id="${o.id}">Löschen</button></div>`).join("") || '<p class="hint" style="margin-top:0">Noch keine. Beispiel: „Du bist bei Rewe, 6 Sachen auf der Liste“ oder beim Verlassen der Wohnung „Schlüssel, Fenster zu?“.</p>'}
      <button class="btn" data-act="nplace" style="width:100%;margin-top:8px">+ Ort hinzufügen</button>
      ${setH("Sicherheit und Apple-KI")}
      <button class="drow" data-act="nlive"><span class="dt"><b>Countdown „Jetzt musst du los“ auf dem Sperrbildschirm</b><small>${N.live === false ? "aus" : "an: ab 3 Stunden vorher, für Wecker und Termine mit Ort"}</small></span><span class="chev">›</span></button>
      <p class="hint">${(() => { const x = nextLos(); return x ? "Nächstes Losgehen: " + new Date(x.at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr (" + esc(x.titel) + ")." : "Gerade steht kein Losgehen in den nächsten 3 Stunden an. Der Countdown braucht einen Wecker oder eine Aufgabe mit Ort und Uhrzeit, bei der „los um …“ steht."; })()}${liveWhy() ? " <b>Letzter Fehler: " + esc(liveWhy()) + "</b>" : ""}</p>
      <button class="btn" data-act="nlivetest" style="width:100%;margin-bottom:8px">Countdown jetzt testen (10 Minuten)</button>
      <button class="drow" data-act="nfiles"><span class="dt"><b>Dokumente auch in der Dateien-App</b><small>${N.files === false ? "aus" : "an: Auf meinem iPhone › Mirella, nach Ordnern (" + Object.keys(N.filed || {}).length + " abgelegt)"}</small></span><span class="chev">›</span></button>
      <button class="drow" data-act="nfaceid"><span class="dt"><b>Mirella nur mit Face ID öffnen</b><small>${N.faceId ? "an" : "aus"}</small></span><span class="chev">›</span></button>
      <p class="hint">Apple-KI auf diesem iPhone: ${N.appleKi === "available" ? "vorhanden. Mirella nutzt sie kostenlos für Glückwünsche und die Auswertung, wenn kein Claude-Schlüssel da ist." : N.appleKi === "off" ? "vorhanden, aber ausgeschaltet (Einstellungen › Apple Intelligence)." : "auf diesem Gerät nicht verfügbar."} „Sag Mirella“ findest du in der Kurzbefehle-App und kannst es auf die Action-Taste legen.</p>`;
  }

  setTimeout(() => { if (!N.setup) wizard(); else { tick(); setTimeout(() => { nachfrage(); keyCheck(); }, 1200); } }, 600);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && N.setup) setTimeout(nachfrage, 1500); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
})();
