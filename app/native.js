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
    <p class="hint">Danach fragt dein iPhone nacheinander nach Standort, Mikrofon, Kamera, Kontakten, Kalender und Mitteilungen. Bitte jeweils <b>Erlauben</b> tippen.</p>
    <div id="w-log" class="hint" style="display:none"></div>
    <button class="btn pri" data-act="wizgo" style="width:100%">Los geht's</button>`);
  }
  ACT.wizgo = async el => {
    el.disabled = true;
    const name = $("#w-name").value.trim(); if (name) S.settings.name = name;
    if (!syOn() && $("#w-mail").value) { await syLogin($("#w-mail").value, $("#w-pw").value); if (!syOn()) { el.disabled = false; return; } }
    const lg = $("#w-log"); lg.style.display = ""; lg.innerHTML = "";
    await askAll((label, ok) => { lg.innerHTML += `<div>${ok ? "✓" : "–"} ${esc(label)}${ok ? "" : " (später unter Einstellungen › Apps › Mirella)"}</div>`; });
    N.setup = true; nSave(); save();
    lg.innerHTML += "<div>Ich übernehme jetzt deine Kontakte und Geburtstage …</div>";
    const r = await contactsSync(true); await calendarBirthdays();
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
        if (ign.has(c.appleId)) continue;
        const d0 = findDups(c, null)[0];
        if (d0) { mergeInto(d0, c); d0.appleId = c.appleId; res.linked++; continue; }
        if (first || N.contactsDone !== true) { S.people.push(isNewPerson(c)); res.added++; }
        else fresh.push(c);
      }
      N.contactsDone = true; N.freshContacts = fresh; res.fresh = fresh.length; nSave();
      if (res.added || res.linked) save();
    } catch (e) { console.warn("Kontakte", e); }
    return res;
  }
  ACT.newcadd = el => { const c = (N.freshContacts || []).find(x => x.appleId === el.dataset.id); if (!c) return; S.people.push(isNewPerson(c)); N.freshContacts = N.freshContacts.filter(x => x !== c); nSave(); save(); render(true); toast((c.first || c.last) + " übernommen"); };
  ACT.newcign = el => { S.settings.appleIgnored.push(el.dataset.id); N.freshContacts = (N.freshContacts || []).filter(x => x.appleId !== el.dataset.id); nSave(); save(); render(true); };
  function freshBlock() {
    const f = N.freshContacts || []; if (!f.length) return "";
    return `<div class="sec"><span class="label">Neu in deinen iPhone-Kontakten</span><span class="label">${f.length}</span></div>` + f.slice(0, 5).map(c => `<div class="card"><span class="av">${esc(((c.first || "")[0] || "") + ((c.last || "")[0] || ""))}</span><span style="min-width:0"><div class="t">${esc([c.first, c.last].join(" ").trim())}</div><div class="s">${esc(c.tel || c.email || "")}</div></span><button class="mini" data-act="newcadd" data-id="${esc(c.appleId)}">Übernehmen</button><button class="mini" data-act="newcign" data-id="${esc(c.appleId)}" aria-label="Ignorieren">✕</button></div>`).join("");
  }
  const origHeute = R.heute;
  R.heute = function () { const h = origHeute.call(this), add = freshBlock(); if (!add) return h; const i = h.indexOf('<div class="sec">'); return i < 0 ? h + add : h.slice(0, i) + add + h.slice(i); };

  /* ---------- iPhone-Kalender ---------- */
  async function calOk() { try { const r = await P.CapacitorCalendar.checkPermission({ scope: "readCalendar" }); return r.result === "granted"; } catch (_) { return false; } }
  /* Geburtstage aus dem Geburtstags-Kalender bei den passenden Personen eintragen */
  async function calendarBirthdays() {
    if (!(await calOk())) return 0;
    let n = 0;
    try {
      const cals = (await P.CapacitorCalendar.listCalendars()).result || [];
      const bc = new Set(cals.filter(c => /geburtstag|birthday/i.test((c.title || "") + " " + (c.internalTitle || "")) || c.type === "birthday").map(c => c.id));
      const from = Date.now(), to = from + 366 * 864e5;
      const evs = (await P.CapacitorCalendar.listEventsInRange({ from, to })).result || [];
      for (const e of evs) {
        if (!(bc.has(e.calendarId) || e.birthdayContactIdentifier)) continue;
        const md = isoOf(e.startDate).slice(5);
        const who = normName((e.title || "").replace(/[’'`]?s? ?Geburtstag|Geburtstag von|birthday/gi, ""));
        const p = (e.birthdayContactIdentifier && S.people.find(x => x.appleId === e.birthdayContactIdentifier)) || S.people.find(x => who && (normName(fullName(x)) === who || normName(fullName(x)).startsWith(who) || who.startsWith(normName(fullName(x)))));
        if (p && !p.bday) { p.bday = "1604-" + md; n++; }
      }
      if (n) save();
    } catch (e) { console.warn("Kalender", e); }
    return n;
  }
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
      const st = S.settings, nagMin = +(st.nagMinutes || 30);
      for (const t of S.todos) {
        if (t.done || !t.date) continue;
        const at = new Date(t.date + "T" + (t.time || "09:00") + ":00").getTime();
        add(at, t.list === "shop" ? "Einkaufen" : "Mirella", t.t, { todo: t.id });
        if (t.nerv) for (let k = 1; k <= 6; k++) { const n2 = new Date(Math.max(at, now) + k * nagMin * 60e3); if (inWin(n2, 8, 21)) add(n2.getTime(), "Noch offen", t.t, { todo: t.id }); }
      }
      // Anrufe: werktags um 8 Uhr eine Sammel-Erinnerung, Nerv-Modus bis 18 Uhr
      const due = S.people.filter(p => { const n = nextDue(p); return n && n <= today(); });
      for (let dd = 0; dd < 3; dd++) {
        const day = new Date(); day.setDate(day.getDate() + dd); if (day.getDay() === 0 || day.getDay() === 6) continue;
        const names = (dd === 0 ? due : S.people.filter(p => { const n = nextDue(p); return n && n <= isoOf(day.getTime()); })).slice(0, st.maxCalls || 3).map(p => p.first || fullName(p));
        if (!names.length) continue;
        for (const hh of [8, 11, 14, 17]) { day.setHours(hh, 0, 0, 0); add(day.getTime(), "Anrufen", names.join(", ")); }
      }
      // Geburtstage um 9 Uhr
      for (const p of S.people) {
        const b = nextBirthday(p); if (!b) continue;
        const at = new Date(b + "T09:00:00").getTime(); if (at - now > 30 * 864e5) continue;
        add(at, "Geburtstag", (p.first || fullName(p)) + " hat heute Geburtstag 🎉");
        if (p.gift) add(at - (st.giftLead || 14) * 864e5, "Geschenk", "In " + (st.giftLead || 14) + " Tagen hat " + (p.first || fullName(p)) + " Geburtstag. Geschenk schon da?");
      }
      if (list.length) await P.LocalNotifications.schedule({ notifications: list });
    } catch (e) { console.warn("Mitteilungen", e); }
  }
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

  /* ---------- Einstellungen ---------- */
  const origEinst2 = R.einstellungen;
  R.einstellungen = function () {
    const h = origEinst2.call(this);
    const blk = `<div class="sec sethead"><span class="label">iPhone</span></div>
      <div class="set"><span>Nerv-Modus<small>so oft erinnern, bis erledigt</small></span><select data-set="nagMinutes">${[[15, "alle 15 Min"], [30, "alle 30 Min"], [60, "jede Stunde"], [120, "alle 2 Std"]].map(([v, l]) => `<option value="${v}"${String(S.settings.nagMinutes || 30) === String(v) ? " selected" : ""}>${l}</option>`).join("")}</select></div>
      <div class="row2" style="margin-top:8px"><button class="btn" data-act="nkontakte">Kontakte abgleichen</button><button class="btn" data-act="nfreigaben">Freigaben prüfen</button></div>`;
    const i = h.indexOf('<div class="sec sethead"><span class="label">Datensicherung');
    return i < 0 ? h + blk : h.slice(0, i) + blk + h.slice(i);
  };
  ACT.nkontakte = async () => { toast("Gleiche Kontakte ab …"); const r = await contactsSync(false); const b = await calendarBirthdays(); render(true); toast(`${r.fresh} neue Kontakte, ${r.linked} zusammengeführt, ${b} Geburtstage ergänzt`); };
  ACT.nfreigaben = () => { N.setup = false; nSave(); wizard(); };

  /* ---------- Start ---------- */
  const tick = async () => {
    if (!N.setup) return;
    if (Date.now() - (N.lastContacts || 0) > 3600e3) { N.lastContacts = Date.now(); nSave(); await contactsSync(false); await calendarBirthdays(); render(true); }
    scheduleLocal();
    try { if ((await P.PushNotifications.checkPermissions()).receive === "granted") P.PushNotifications.register(); } catch (_) { }
  };
  setTimeout(() => { if (!N.setup) wizard(); else tick(); }, 600);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
})();
