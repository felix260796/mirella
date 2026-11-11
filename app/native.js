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
    N.setup = true; N.asked = Object.assign(N.asked || {}, { ki: 1, gmaps: 1 }); nSave(); save();
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
    if (contactsBusy) return res; contactsBusy = true;
    try {
      const perm = await P.Contacts.checkPermissions(); if (perm.contacts !== "granted" && perm.contacts !== "limited") { contactsBusy = false; return res; }
      const { contacts } = await P.Contacts.getContacts({ projection: { name: true, phones: true, emails: true, birthday: true, postalAddresses: true } });
      N.aid = N.aid || {}; N.cs = N.cs || {};
      // Die iPhone-Kennung ist auf jedem Gerät anders: N.aid merkt sich die Kennung dieses Geräts je Mirella-Kontakt
      const known = new Map(); for (const p of S.people) { const k = N.aid[p.id] || p.appleId; if (k) known.set(k, p); }
      const ign = new Set(S.settings.appleIgnored), linked = new Set(), writes = [];
      const fresh = [];
      for (const raw of contacts || []) {
        const c = fromApple(raw); if (!c.first && !c.last) continue;
        if (known.has(c.appleId)) { const p = known.get(c.appleId); linked.add(p.id); if (twoWay(p, c, raw, writes)) res.linked++; continue; }
        if (isIgnored(c, ign)) continue;
        const d0 = findDups(c, null)[0];
        if (d0) { const before = JSON.stringify(d0); mergeInto(d0, c); if (!d0.appleId) d0.appleId = c.appleId; N.aid[d0.id] = c.appleId; linked.add(d0.id); if (JSON.stringify(d0) !== before) res.linked++; continue; }
        S.people.push(isNewPerson(c)); res.added++; // neue iPhone-Kontakte landen ungeprüft im Aufräum-Stapel (Einstellungen › Kontakte), nicht auf „Heute“
      }
      N.contactsDone = true; N.freshContacts = fresh; res.fresh = fresh.length;
      // Neu in Mirella angelegte Kontakte auch im iPhone-Telefonbuch anlegen (nur ab dem Tag, an dem das Zurückschreiben eingeschaltet wurde)
      if (!N.twoWayFrom) N.twoWayFrom = today();
      if (twoWayOn()) for (const p of S.people) {
        if (linked.has(p.id) || p.appleId || N.aid[p.id] || p.arch || p.death || !(p.first || p.last) || !p.created || p.created < N.twoWayFrom || N.cs[p.id]) continue;
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
      try { await calSync(evs); } catch (e2) { console.warn("Kalender-Abgleich", e2); }
      for (const e of evs) {
        if (bc.has(e.calendarId) || e.birthdayContactIdentifier || (N.mcal && e.calendarId === N.mcal)) continue;
        const d0 = isoOf(e.startDate), d1 = isoOf(Math.max(e.startDate, (e.endDate || e.startDate) - 1));
        const dt = new Date(e.startDate), time = e.isAllDay ? "" : pad2(dt.getHours()) + ":" + pad2(dt.getMinutes());
        out.push({ id: e.id + "@" + d0, t: e.title || "(ohne Titel)", d: d0, e: d1 > d0 ? d1 : "", time, cal: names[e.calendarId] || "", loc: e.location || "" });
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

  /* ---------- Echter iPhone-Wecker (AlarmKit ab iOS 26): klingelt auch bei geschlossener App und im Stumm-Modus ---------- */
  function alarmList() {
    const now = Date.now(), list = [];
    for (const w of S.alarms || []) {
      if (!w.wake || !w.alarms || w.off) continue;
      const all = alarmTimes(w), nm = weckerName(w);
      all.forEach((d, i) => { if (+d > now + 30e3) list.push({ at: +d, title: nm + ": los um " + w.leave + (all.length > 1 ? " (Wecker " + (i + 1) + " von " + all.length + ")" : ""), near: +d - now < 23 * 3600e3 ? 1 : 0 }); });
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
    if (x.call) { const p = S.people.find(y => y.id === x.call); if (p && act === "call" && p.tel) { pendingCall = p.id; N.dialAt = Date.now(); location.href = "tel:" + p.tel.replace(/[^\d+]/g, ""); } else { view = "heute"; render(); } return; }
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
  /* Aufräumen steht in Einstellungen › Kontakte (Wunsch Felix), nicht auf „Heute“ oder über der Kontaktliste */
  const origSetK = SETS.kontakte;
  SETS.kontakte = function () {
    const n = pending().length, nj = junkList().length;
    return `<button class="btn${n ? " pri" : ""}" data-act="aufraeumen" data-from="set" style="width:100%;margin-bottom:8px">Kontakte aufräumen (${n} offen${nj ? ", " + nj + " vorsortiert" : ""})</button>` + origSetK.call(this);
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
    <button class="btn" data-act="aufraeumen" style="width:100%;margin-top:8px">Kontakte aufräumen (${pending().length} offen)</button>
    <button class="btn" data-act="querv" style="width:100%;margin-top:8px">Geburtstags-Kalender zuordnen (${bOpen().length} offen)</button>
    ${S.settings.appleIgnored.length ? `<button class="btn" data-act="nunignore" style="width:100%;margin-top:8px">Aussortierte wieder vorschlagen (${S.settings.appleIgnored.length})</button>` : ""}
    ${P.MirellaAlarm ? `<p class="hint"><b>Wecker:</b> ${alarmNote()}${alarmDiag()}</p>${N.alarmState === "authorized" || N.alarmState === "unavailable" ? "" : '<button class="btn" data-act="nwecker" style="width:100%">Echten Wecker erlauben</button>'}` : ""}
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
  /* ---------- Nachfrage beim Start: alles, was neu einzugeben ist, einmal gesammelt (Wunsch Felix), danach nie wieder ----------
     Kommt später etwas dazu, das Felix eingeben oder erlauben muss: hier einen Eintrag in NEED ergänzen. */
  const NEED = [
    { k: "ki", missing: () => typeof kiOn === "function" && !kiOn(), html: () => `<div class="fld"><label for="nf-ki">Claude-Schlüssel (für die Mirella-KI)</label><input id="nf-ki" type="password" autocomplete="off" placeholder="sk-ant-… einfügen"></div>`, save: () => { const v = ($("#nf-ki").value || "").trim(); if (v) { KI.key = v; kiSave(); } } },
    { k: "gmaps", missing: () => !S.settings.gmapsKey, html: () => `<div class="fld"><label for="nf-gm">Google-Maps-Schlüssel (für den Wecker nach Verkehr)</label><input id="nf-gm" type="password" autocomplete="off" placeholder="AIza… einfügen"></div>`, save: () => { const v = ($("#nf-gm").value || "").trim(); if (v) S.settings.gmapsKey = v; } },
    { k: "wecker", missing: () => !!P.MirellaAlarm && !N.alarmState, html: () => `<p class="hint">Dein iPhone fragt gleich einmal, ob Mirella echte Wecker stellen darf. Bitte <b>Erlauben</b> tippen.</p>`, save: async () => { try { const r = await P.MirellaAlarm.request(); N.alarmState = r.state; } catch (_) { } } }
  ];
  function nachfrage() {
    N.asked = N.asked || {};
    const open = NEED.filter(x => !N.asked[x.k] && x.missing()); if (!open.length || document.querySelector("#sheet.open")) return false;
    openSheet(`<p class="stitle">Neu in Mirella</p><p class="hint" style="margin-top:0">Das fehlt noch. Einmal eintragen, danach fragt Mirella nicht mehr. Du kannst Felder auch leer lassen und später unter Einstellungen nachtragen.</p>${open.map(x => x.html()).join("")}<button class="btn pri" data-act="nfsave" style="width:100%">Speichern</button>`);
    return true;
  }
  ACT.nfsave = async el => {
    el.disabled = true; N.asked = N.asked || {};
    for (const x of NEED) { if (N.asked[x.k] || !x.missing()) continue; try { await x.save(); } catch (_) { } N.asked[x.k] = 1; }
    nSave(); save(); closeAll(); render(true); toast("Gespeichert");
  };
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
        ${tel ? `<a class="btn pri" href="tel:${esc(tel.replace(/[^\d+]/g, ""))}" style="text-decoration:none;text-align:center">📞 ${esc(tel.trim())} anrufen</a><button class="btn" data-act="lsperson" data-tel="${esc(tel.trim())}">Als neuen Kontakt anlegen</button>` : ""}
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
    const liveSync = async () => {
      if (N.live === false || document.hidden) return;
      const x = nextLos(), sig = x ? x.at + "|" + x.titel + "|" + x.info : "";
      if (sig === (N.liveSig || "")) return;
      try { if (x) { const r = await SY.losStart({ los: x.at, titel: x.titel, ziel: x.ziel, info: x.info }); if (!r.ok) { N.liveErr = r.reason || ""; nSave(); if (r.reason === "unavailable" || r.reason === "aus") { N.liveSig = sig; nSave(); } return; } N.liveErr = ""; } else await SY.losEnd(); N.liveSig = sig; nSave(); } catch (_) { }
    };
    setTimeout(liveSync, 4000); setInterval(liveSync, 60000); document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(liveSync, 800); });
    ACT.nlive = () => { N.live = N.live === false; N.liveSig = ""; nSave(); if (N.live) liveSync(); else SY.losEnd().catch(() => { }); render(true); toast(N.live ? "Countdown auf dem Sperrbildschirm ist an" : "Countdown ist aus"); };
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
      <button class="drow" data-act="nlive"><span class="dt"><b>Countdown „Jetzt musst du los“ auf dem Sperrbildschirm</b><small>${N.live === false ? "aus" : "an: ab 3 Stunden vorher, für Wecker und Termine mit Ort" + (N.liveErr === "aus" ? ". Live-Aktivitäten sind am iPhone ausgeschaltet (Einstellungen › Mirella)." : "")}</small></span><span class="chev">›</span></button>
      <button class="drow" data-act="nfiles"><span class="dt"><b>Dokumente auch in der Dateien-App</b><small>${N.files === false ? "aus" : "an: Auf meinem iPhone › Mirella, nach Ordnern (" + Object.keys(N.filed || {}).length + " abgelegt)"}</small></span><span class="chev">›</span></button>
      <button class="drow" data-act="nfaceid"><span class="dt"><b>Mirella nur mit Face ID öffnen</b><small>${N.faceId ? "an" : "aus"}</small></span><span class="chev">›</span></button>
      <p class="hint">Apple-KI auf diesem iPhone: ${N.appleKi === "available" ? "vorhanden. Mirella nutzt sie kostenlos für Glückwünsche und die Auswertung, wenn kein Claude-Schlüssel da ist." : N.appleKi === "off" ? "vorhanden, aber ausgeschaltet (Einstellungen › Apple Intelligence)." : "auf diesem Gerät nicht verfügbar."} „Sag Mirella“ findest du in der Kurzbefehle-App und kannst es auf die Action-Taste legen.</p>`;
  }

  setTimeout(() => { if (!N.setup) wizard(); else { tick(); setTimeout(nachfrage, 1200); } }, 600);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
})();
