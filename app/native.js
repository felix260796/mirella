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
    <p class="hint">Danach fragt dein iPhone nacheinander nach Standort, Mikrofon, Kamera, Kontakten, Kalender und Mitteilungen. Bitte jeweils <b>Erlauben</b> tippen.</p>
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
    N.setup = true; nSave(); save();
    lg.innerHTML += "<div>Ich übernehme jetzt deine Kontakte und Geburtstage …</div>";
    const r = await contactsSync(true); await calendarBirthdays(); await calendarEvents();
    lg.innerHTML += `<div>✓ ${r.added} Kontakte übernommen, ${r.linked} zusammengeführt.</div>`;
    await scheduleLocal();
    el.textContent = "Fertig"; el.disabled = false; el.dataset.act = "wizdone";
  };
  ACT.wizdone = () => { closeAll(); view = "heute"; render(); if (S.people.length > 1 && typeof ACT.dupscan === "function") setTimeout(() => ACT.dupscan(), 400); };

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
    try {
      const perm = await P.Contacts.checkPermissions(); if (perm.contacts !== "granted" && perm.contacts !== "limited") return res;
      const { contacts } = await P.Contacts.getContacts({ projection: { name: true, phones: true, emails: true, birthday: true, postalAddresses: true } });
      const known = new Set(S.people.map(p => p.appleId).filter(Boolean)), ign = new Set(S.settings.appleIgnored);
      const fresh = [];
      for (const raw of contacts || []) {
        const c = fromApple(raw); if (!c.first && !c.last) continue;
        if (known.has(c.appleId)) { const p = S.people.find(x => x.appleId === c.appleId); for (const k of ["tel", "email", "bday", "addr"]) if (!p[k] && c[k]) p[k] = c[k]; continue; }
        if (isIgnored(c, ign)) continue;
        const d0 = findDups(c, null)[0];
        if (d0) { const before = JSON.stringify(d0); mergeInto(d0, c); if (!d0.appleId) d0.appleId = c.appleId; if (JSON.stringify(d0) !== before) res.linked++; continue; }
        if (first || N.contactsDone !== true) { S.people.push(isNewPerson(c)); res.added++; }
        else fresh.push(c);
      }
      N.contactsDone = true; N.freshContacts = fresh; res.fresh = fresh.length; nSave();
      if (res.added || res.linked) save();
    } catch (e) { console.warn("Kontakte", e); }
    return res;
  }
  ACT.newcadd = el => { const c = (N.freshContacts || []).find(x => x.appleId === el.dataset.id); if (!c) return; S.people.push(isNewPerson(c)); N.freshContacts = N.freshContacts.filter(x => x !== c); nSave(); save(); render(true); toast((c.first || c.last) + " übernommen"); };
  ACT.newcign = el => { const c0 = (N.freshContacts || []).find(x => x.appleId === el.dataset.id); S.settings.appleIgnored.push(c0 ? ckey(c0) : el.dataset.id); N.freshContacts = (N.freshContacts || []).filter(x => x.appleId !== el.dataset.id); nSave(); save(); render(true); };
  function freshBlock() {
    const f = N.freshContacts || []; if (!f.length) return "";
    return `<div class="sec"><span class="label">Neu in deinen iPhone-Kontakten</span><span class="label">${f.length}</span></div>` + f.slice(0, 5).map(c => `<div class="card"><span class="av">${esc(((c.first || "")[0] || "") + ((c.last || "")[0] || ""))}</span><span style="min-width:0"><div class="t">${esc([c.first, c.last].join(" ").trim())}</div><div class="s">${esc(c.tel || c.email || "")}</div></span><button class="mini" data-act="newcadd" data-id="${esc(c.appleId)}">Übernehmen</button><button class="mini" data-act="newcign" data-id="${esc(c.appleId)}" aria-label="Ignorieren">✕</button></div>`).join("");
  }
  const origHeute = R.heute;
  R.heute = function () { const h = origHeute.call(this), add = freshBlock(); if (!add) return h; const i = h.indexOf('<div class="sec">'); return i < 0 ? h + add : h.slice(0, i) + add + h.slice(i); };

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
      const bc = new Set(cals.filter(c => /geburtstag|birthday/i.test((c.title || "") + " " + (c.internalTitle || "")) || c.type === "birthday").map(c => c.id));
      N.cals = cals.map(c => ({ id: c.id, title: c.title || "" })); N.bcals = [...bc];
      const from = Date.now(), to = from + 366 * 864e5;
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
          if (!p) { const c = bCandidates(b).filter(x => x.sure); if (c.length === 1) p = c[0].p; }
          if (p) { links[b.key] = p.id; changed = true; }
        }
        if (p && bApply(b, p)) { n++; changed = true; }
      }
      if (changed) save();
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
      for (const e of evs) {
        if (bc.has(e.calendarId) || e.birthdayContactIdentifier) continue;
        const d0 = isoOf(e.startDate), d1 = isoOf(Math.max(e.startDate, (e.endDate || e.startDate) - 1));
        const dt = new Date(e.startDate), time = e.isAllDay ? "" : pad2(dt.getHours()) + ":" + pad2(dt.getMinutes());
        out.push({ id: e.id + "@" + d0, t: e.title || "(ohne Titel)", d: d0, e: d1 > d0 ? d1 : "", time, cal: names[e.calendarId] || "", loc: e.location || "" });
      }
      N.events = out; N.eventsAt = Date.now(); nSave();
      return out.length;
    } catch (e) { console.warn("Termine", e); return 0; }
  }
  if (!CALF.some(x => x[0] === "termin")) CALF.push(["termin", "iPhone-Termine"]);
  if (S.settings.calFilter.termin === undefined) S.settings.calFilter.termin = 1;
  HOOKS.events.push((from, to) => {
    const out = [];
    for (const e of N.events || []) {
      let d = e.d, g = 0;
      do { if (d >= from && d <= to) out.push({ d, c: "termin", k: e.cal || "Termin", t: e.t, act: "iosev", id: e.id, time: d === e.d ? e.time : "" }); d = isoOf(new Date(d + "T12:00:00").getTime() + 864e5); } while (e.e && d <= e.e && g++ < 31);
    }
    // Geburtstage aus dem Kalender, die noch keinem Kontakt zugeordnet sind
    const y0 = +from.slice(0, 4), y1 = +to.slice(0, 4), links = bLinks();
    for (const b of N.bdays || []) { if (links[b.key] && links[b.key] !== "x") continue; for (let y = y0; y <= y1; y++) { const d = y + "-" + b.md; if (d >= from && d <= to) out.push({ d, c: "geb", k: "Geburtstag", t: b.title, act: "querv", id: "" }); } }
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
      const add = (at, title, body, extra) => { if (at > now + 30e3 && list.length < 60) list.push({ id: id++, title, body, schedule: { at: new Date(at), allowWhileIdle: true }, extra: extra || {} }); };
      const st = S.settings, nagMin = +(st.nervEvery || 30), nv = st.nerv || {};
      for (const t of S.todos) {
        if (t.done || !t.date) continue;
        const at = new Date(t.date + "T" + (t.time || "09:00") + ":00").getTime();
        add(at, t.list === "shop" ? "Einkaufen" : "Mirella", t.t, { todo: t.id });
        if (t.nerv && nv.aufgaben !== 0) for (let k = 1; k <= 6; k++) { const n2 = new Date(Math.max(at, now) + k * nagMin * 60e3); if (inWin(n2, 8, 21)) add(n2.getTime(), "Noch offen", t.t, { todo: t.id }); }
      }
      // Anrufe: werktags um 8 Uhr eine Sammel-Erinnerung, Nerv-Modus bis 18 Uhr
      const live = S.people.filter(p => !p.arch);
      const due = live.filter(p => { const n = nextDue(p); return n && n <= today(); });
      for (let dd = 0; dd < 3; dd++) {
        const day = new Date(); day.setDate(day.getDate() + dd); if (day.getDay() === 0 || day.getDay() === 6) continue;
        const names = (dd === 0 ? due : live.filter(p => { const n = nextDue(p); return n && n <= isoOf(day.getTime()); })).slice(0, st.maxCalls || 3).map(p => p.first || fullName(p));
        if (!names.length) continue;
        for (const hh of (nv.anrufe === 0 ? [8] : [8, 11, 14, 17])) { day.setHours(hh, 0, 0, 0); add(day.getTime(), "Anrufen", names.join(", ")); }
      }
      // Geburtstage um 9 Uhr
      for (const p of live) {
        const b = nextBirthday(p); if (!b) continue;
        const at = new Date(b + "T09:00:00").getTime(); if (at - now > 30 * 864e5) continue;
        add(at, "Geburtstag", (p.first || fullName(p)) + " hat heute Geburtstag 🎉");
        if (p.gift) add(at - (st.giftLead || 14) * 864e5, "Geschenk", "In " + (st.giftLead || 14) + " Tagen hat " + (p.first || fullName(p)) + " Geburtstag. Geschenk schon da?");
      }
      // Wecker zusätzlich als Mitteilung, falls der echte Wecker nicht erlaubt oder das iPhone zu alt ist
      if (N.alarmState !== "authorized") for (const a of alarmList()) add(a.at, "Wecker", a.title);
      if (list.length) await P.LocalNotifications.schedule({ notifications: list });
    } catch (e) { console.warn("Mitteilungen", e); }
    alarmSync();
  }

  /* ---------- Echter iPhone-Wecker (AlarmKit ab iOS 26): klingelt auch bei geschlossener App und im Stumm-Modus ---------- */
  function alarmList() {
    const now = Date.now(), list = [];
    for (const w of S.alarms || []) {
      if (!w.wake || !w.alarms) continue;
      alarmTimes(w).forEach((d, i) => { if (+d > now + 30e3) list.push({ at: +d, title: (i ? "Jetzt aber raus! " : "Aufstehen. ") + "Losfahren " + w.leave + " nach " + w.to }); });
    }
    return list.sort((a, b) => a.at - b.at).slice(0, 30);
  }
  let alarmBusy = false;
  async function alarmSync(force) {
    const A = P.MirellaAlarm; if (!A || alarmBusy) return;
    const list = alarmList(), sig = JSON.stringify(list);
    if (!force && sig === N.alarmSig) return;
    if (!list.length && !N.alarmSig) return; // noch nie einen Wecker gestellt: nicht nach der Erlaubnis fragen
    alarmBusy = true;
    try {
      const r = await A.set({ alarms: list }), was = N.alarmState;
      N.alarmState = r.state; N.alarmSig = r.state === "authorized" ? sig : ""; N.alarmN = r.count || 0; nSave();
      if (r.state === "authorized" && list.length) toast("Echter iPhone-Wecker gestellt: " + list.slice(0, 4).map(a => new Date(a.at).toTimeString().slice(0, 5)).join(", "));
      else if (r.state === "denied" && was !== "denied") toast("Wecker ist nicht erlaubt. Einstellungen › Apps › Mirella › Wecker einschalten.");
      if (was !== r.state) scheduleLocal();
    } catch (e) { console.warn("Wecker", e); N.alarmState = "fehler"; nSave(); }
    alarmBusy = false;
  }
  const alarmNote = () => N.alarmState === "authorized" ? "Klingelt als echter iPhone-Wecker, auch wenn Mirella zu ist und das iPhone stumm ist."
    : N.alarmState === "denied" ? "Der echte Wecker ist nicht erlaubt (Einstellungen › Apps › Mirella › Wecker). Bis dahin kommt nur eine Mitteilung."
      : N.alarmState === "unavailable" ? "Der echte Wecker braucht iOS 26. Auf diesem Gerät kommt eine Mitteilung." : "Beim Speichern fragt dein iPhone einmal, ob Mirella Wecker stellen darf.";
  const origRes = resHTML;
  resHTML = function (w) { return origRes(w) + `<p class="hint">${alarmNote()}</p>`; };
  ACT.nwecker = async () => { try { const r = await P.MirellaAlarm.request(); N.alarmState = r.state; nSave(); await alarmSync(true); render(true); } catch (_) { toast("Das hat nicht geklappt"); } };
  let schedT = null;
  const origSave2 = save;
  save = function () { const ok = origSave2(); clearTimeout(schedT); schedT = setTimeout(scheduleLocal, 1500); return ok; };

  /* ---------- Push vom Server (z. B. „Dein Briefing ist da“) ---------- */
  P.PushNotifications.addListener("registration", async t => {
    N.pushToken = t.value; nSave();
    if (!syOn()) return;
    try { await sb("/rest/v1/mirella_device", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ token: t.value, user_id: SY.auth.user.id, platform: "ios" }) }); } catch (e) { console.warn("Push-Gerät", e); }
  });
  P.PushNotifications.addListener("pushNotificationActionPerformed", a => { const d = a.notification && a.notification.data || {}; if (d.view) { view = d.view; render(); } });
  P.LocalNotifications.addListener("localNotificationActionPerformed", a => { const x = a.notification && a.notification.extra || {}; if (x.todo) { view = "todos"; render(); } });

  /* ---------- Kontakte aufräumen ---------- */
  let clF = "alle", clSel = new Set(), clMax = 120, clQ = "";
  const CLF = [["alle", "Alle"], ["kal", "Geburtstag im Kalender"], ["geb", "Mit Geburtstag"], ["ohnegeb", "Ohne Geburtstag"], ["ohnenr", "Ohne Nummer"], ["einname", "Nur ein Name"]];
  function clList(f) {
    const linked = bLinkedIds(), ql = clQ.trim().toLowerCase();
    return pending().filter(p => (f === "alle" || (f === "kal" && linked.has(p.id)) || (f === "geb" && p.bday) || (f === "ohnegeb" && !p.bday) || (f === "ohnenr" && !p.tel) || (f === "einname" && (!p.first || !p.last)))
      && (!ql || (fullName(p) + " " + (p.tel || "") + " " + (p.email || "")).toLowerCase().includes(ql)))
      .sort((a, b) => fullName(a).localeCompare(fullName(b), "de"));
  }
  R.aufraeumen = function () {
    const all = pending(), list = clList(clF), linked = bLinkedIds();
    const selN = list.filter(p => clSel.has(p.id)).length, nKal = all.filter(p => linked.has(p.id)).length;
    const bar = `<div class="clbar"><button class="btn pri" data-act="clkeep" ${selN ? "" : "disabled"}>Behalten${selN ? " (" + selN + ")" : ""}</button><button class="btn" data-act="cldrop" ${selN ? "" : "disabled"}>Aussortieren${selN ? " (" + selN + ")" : ""}</button></div>`;
    const head = `<div class="top" style="flex-wrap:wrap"><button class="tleft tsetbtn" data-act="clback" aria-label="Zurück"><p class="big">‹ Aufräumen</p></button>${all.length ? bar : ""}</div>`;
    if (!all.length) return head + empty("Alles aufgeräumt. Jeder übernommene Kontakt ist entweder behalten oder aussortiert.") + `<button class="btn" data-act="clback" style="width:100%;margin-top:10px">Zu den Kontakten</button>`;
    return `${head}
    <p class="hint" style="margin-top:0"><b>${all.length}</b> übernommene Kontakte hast du noch nicht angeschaut. Tipp Kontakte an und wähle oben <b>Behalten</b> oder <b>Aussortieren</b>. Aussortierte verschwinden nur aus Mirella, auf dem iPhone bleiben sie.</p>
    ${nKal ? `<div class="pitem"><b>Vorschlag:</b> ${nKal} dieser Kontakte stehen in deinem Geburtstags-Kalender. Die sind dir wahrscheinlich wichtig.<div class="row2" style="margin-top:8px"><button class="btn pri" data-act="clkeepkal">Diese ${nKal} behalten</button></div></div>` : ""}
    ${bOpen().length ? `<button class="btn" data-act="querv" style="width:100%;margin-bottom:8px">${bOpen().length} Geburtstage ohne Kontakt zuordnen</button>` : ""}
    <input class="search" id="clq" type="search" placeholder="Suchen: Name oder Nummer" aria-label="Suchen" value="${esc(clQ)}">
    <div class="chips">${CLF.map(([k, l]) => `<button class="chip2" data-act="clf" data-k="${k}" aria-pressed="${clF === k}">${l} ${clList(k).length}</button>`).join("")}</div>
    <div class="sec"><span class="label">${list.length} in dieser Auswahl</span><button class="mini" data-act="clall">${selN === list.length ? "Auswahl aufheben" : "Alle auswählen"}</button></div>
    ${list.slice(0, clMax).map(p => `<div class="listrow clrow" role="button" tabindex="0" data-act="cltog" data-id="${p.id}" aria-pressed="${clSel.has(p.id)}" style="cursor:pointer"><span class="clbox" aria-hidden="true">${clSel.has(p.id) ? "✓" : ""}</span><span class="grow">${esc(fullName(p) || "(ohne Namen)")}<small>${esc([p.tel, p.email, p.bday ? "Geburtstag " + fmtMd(p.bday.slice(5)) + (linked.has(p.id) ? " (im Kalender)" : "") : ""].filter(Boolean).join(" · ") || "keine Nummer, keine E-Mail")}</small></span></div>`).join("")}
    ${list.length > clMax ? `<button class="btn" data-act="clmore" style="width:100%;margin-top:8px">Weitere ${Math.min(200, list.length - clMax)} zeigen</button>` : ""}`;
  };
  const clSelected = () => clList(clF).filter(p => clSel.has(p.id));
  ACT.aufraeumen = () => { clSel = new Set(); clMax = 120; clQ = ""; view = "aufraeumen"; render(); };
  ACT.clback = () => { view = "menschen"; render(); };
  ACT.clf = el => { clF = el.dataset.k; clMax = 120; render(); };
  ACT.cltog = el => { const id = el.dataset.id; clSel.has(id) ? clSel.delete(id) : clSel.add(id); render(true); };
  ACT.clall = () => { const l = clList(clF), allOn = l.every(p => clSel.has(p.id)); l.forEach(p => allOn ? clSel.delete(p.id) : clSel.add(p.id)); render(true); };
  ACT.clmore = () => { clMax += 200; render(true); };
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
  HOOKS.heuteTop.push(() => { const n = pending().length; return n >= 5 ? `<div class="card due" role="button" tabindex="0" data-act="aufraeumen"><span class="av">${n > 99 ? "99+" : n}</span><span style="min-width:0"><div class="t">Kontakte aufräumen</div><div class="s">${n} übernommene Kontakte warten: behalten oder aussortieren</div></span></div>` : ""; });
  const origMenschen = R.menschen;
  R.menschen = function () {
    const h = origMenschen.call(this), n = pending().length; if (!n) return h;
    const card = `<div class="card due" role="button" tabindex="0" data-act="aufraeumen"><span class="av">${n > 99 ? "99+" : n}</span><span style="min-width:0"><div class="t">Kontakte aufräumen</div><div class="s">${n} vom iPhone übernommen, noch nicht angeschaut</div></span></div>`;
    const i = h.indexOf('<div class="sec">'); return i < 0 ? h + card : h.slice(0, i) + card + h.slice(i);
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
  const qvSet = (b, p) => { bLinks()[b.key] = p.id; bApply(b, p); p.rev = p.rev || today(); qvPick = null; save(); render(true); };
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
  SETS.iphone = () => `<p class="hint" style="margin-top:0">Kontakte und Geburtstage gleicht Mirella stündlich mit deinem iPhone ab. Neue Kontakte erscheinen auf „Heute“ zum Übernehmen. Wie oft Mirella nervt, stellst du unter Nerv-Modus ein.</p>
    <div class="row2" style="margin-top:8px"><button class="btn" data-act="nkontakte">Jetzt abgleichen</button><button class="btn" data-act="nfreigaben">Freigaben prüfen</button></div>
    <button class="btn" data-act="aufraeumen" style="width:100%;margin-top:8px">Kontakte aufräumen (${pending().length} offen)</button>
    <button class="btn" data-act="querv" style="width:100%;margin-top:8px">Geburtstags-Kalender zuordnen (${bOpen().length} offen)</button>
    ${S.settings.appleIgnored.length ? `<button class="btn" data-act="nunignore" style="width:100%;margin-top:8px">Aussortierte wieder vorschlagen (${S.settings.appleIgnored.length})</button>` : ""}
    ${P.MirellaAlarm ? `<p class="hint"><b>Wecker:</b> ${alarmNote()}${N.alarmN ? " Gestellt: " + N.alarmN + "." : ""}</p>${N.alarmState === "authorized" || N.alarmState === "unavailable" ? "" : '<button class="btn" data-act="nwecker" style="width:100%">Echten Wecker erlauben</button>'}` : ""}
    <p class="hint">Termine aus deinem iPhone-Kalender zeigt Mirella im Kalender mit an${N.events ? " (" + N.events.length + " geladen)" : ""}. Sie bleiben auf dem iPhone und werden nicht kopiert.</p>`;
  const origEinst2 = R.einstellungen;
  R.einstellungen = function () {
    const h = origEinst2.call(this); if (setSec) return h;
    const row = `<button class="drow" data-act="setsec" data-k="iphone">${IC.bell || ""}<span class="dt"><b>iPhone</b><small>Kontakte, Kalender, Freigaben</small></span><span class="chev">›</span></button>`;
    const i = h.indexOf('<div class="sethead2">Mirella</div>'); return i < 0 ? h + row : h.slice(0, i + '<div class="sethead2">Mirella</div>'.length) + row + h.slice(i + '<div class="sethead2">Mirella</div>'.length);
  };
  ACT.nkontakte = async () => { toast("Gleiche ab …"); const r = await contactsSync(false); const b = await calendarBirthdays(); const ev = await calendarEvents(); render(true); toast(`${r.fresh} neue Kontakte, ${b} Geburtstage ergänzt, ${ev} Termine geladen`); };
  ACT.nunignore = () => { if (!ask("Alle aussortierten Kontakte wieder als Vorschlag auf „Heute“ zeigen?")) return; S.settings.appleIgnored = []; N.lastContacts = 0; nSave(); save(); tick(); toast("Sie erscheinen gleich wieder als Vorschlag"); };
  ACT.nfreigaben = () => { N.setup = false; nSave(); wizard(); };

  /* ---------- Start ---------- */
  const tick = async () => {
    if (!N.setup) return;
    if (Date.now() - (N.lastContacts || 0) > 3600e3) { N.lastContacts = Date.now(); nSave(); purgeIgnored(); await contactsSync(false); await calendarBirthdays(); await calendarEvents(); render(true); }
    scheduleLocal();
    try { if ((await P.PushNotifications.checkPermissions()).receive === "granted") P.PushNotifications.register(); } catch (_) { }
  };
  setTimeout(() => { if (!N.setup) wizard(); else tick(); }, 600);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
})();
