/* Mirella – Karten-Durchgang (Kontakte Karte für Karte) auf iPhone und PC gemeinsam
   Das iPhone kennt Telefonbuch und Geburtstags-Kalender. Es legt die offenen Karten als S.kbox in den Abgleich.
   Am PC entscheidet Felix dieselben Karten. Jede Entscheidung steht als Auftrag in S.kjobs. Was nur Mirella betrifft,
   gilt sofort. Was das Telefonbuch betrifft (Verbinden, Löschen), führt das iPhone beim nächsten Öffnen aus und
   trägt die Kennung in S.kjDone ein. Aufträge und erledigte Kennungen sind Listen, damit der Abgleich nichts verliert.
   Die Vergleichsregeln entsprechen denen in native.js (Stand v0.32): Verbinden nur per Klick, nie still. */
"use strict";
const KA = (() => {
  const BSTOP = new Set(["geburtstag", "geburtstage", "geburtstags", "geb", "birthday", "bday", "von", "hat", "wird", "jahre", "jahr", "der", "die", "und"]);
  const ckey = c => normName((c.first || "") + " " + (c.last || "")) + "|" + telKey(c.tel);
  const bName = b => (b.title || "").replace(/\(.*?\)/g, " ").split(/\s+/).filter(w => w && !BSTOP.has(normName(w)) && !/^\d/.test(w)).map(w => w.replace(/[’'`]s$/, "")).join(" ").trim();
  const nameToks = s => normName(s).split(" ").filter(w => w.length > 1);
  const subset = (a, b) => a.length > 0 && a.every(t => b.includes(t));
  const fmtMd = md => +md.slice(3) + "." + +md.slice(0, 2) + ".";
  const fmtB = b => !b ? "" : b.startsWith("1604") ? fmtMd(b.slice(5)) : longDate(b);
  const cKey = c => c.b ? "b:" + c.key : "a:" + c.appleId;
  /* kind: c = Karte aus dem Telefonbuch, p = Kontakt in Mirella, b = Geburtstag aus dem Kalender. aidOf: Telefonbuch-Kennung eines Mirella-Kontakts */
  function ent(x, kind, aidOf) {
    if (kind === "b") return { kind, x, id: "b:" + x.key, key: "b:" + x.key, key2: "b:" + x.key, toks: x.tok || [], tels: [], mails: [], md: x.md, name: bName(x) };
    const aid = kind === "p" ? (aidOf ? aidOf(x) : x.appleId) : x.appleId;
    const tels = [x.tel, ...(x.tels || []).map(t => t.n)].map(telKey).filter(Boolean), mails = [x.email, ...(x.emails || [])].filter(Boolean).map(m => m.toLowerCase());
    return { kind, x, id: kind === "p" ? "p:" + x.id : "a:" + x.appleId, key: aid ? "a:" + aid : "p:" + x.id, key2: "c:" + ckey(x), toks: nameToks([x.first, x.last, kind === "p" ? x.nick : ""].filter(Boolean).join(" ")), tels, mails, md: (x.bday || "").slice(5), name: fullName(x) };
  }
  function tokMatch(a, b) {
    const used = new Set(); let ex = 0, sim = 0;
    for (const t of a) { let hit = -1, best = 0; b.forEach((x, k) => { if (used.has(k)) return; const v = wordSim(t, x); if (v > best) { best = v; hit = k; } }); if (hit >= 0) { used.add(hit); sim++; if (best === 2) ex++; } }
    return { ex, sim };
  }
  /* Antwort beginnt mit „~“: schwacher Treffer, der nur zählt, wenn er eindeutig ist */
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
  /* „Gehört nicht zusammen“: über die Kennung und über Name plus Nummer (gilt auf jedem Gerät) */
  const nsKeys = (a, b) => [[a.key, b.key].sort().join("~"), [a.key2, b.key2].sort().join("~")];
  const nsHas = (ns, a, b) => nsKeys(a, b).some(k => ns.has(k));
  function bApply(b, p) {
    if (!p.bday) { p.bday = (b.year || 1604) + "-" + b.md; return true; }
    if (b.year && p.bday.startsWith("1604-") && p.bday.slice(5) === b.md) { p.bday = b.year + "-" + b.md; return true; }
    return false;
  }
  const extraLabel = (drop, keep) => { const kt = nameToks(fullName(keep)); const w = fullName(drop).split(/\s+/).filter(x => normName(x).length > 1 && !kt.includes(normName(x))); return w.join(" ") || drop.telL || ""; };

  /* ---------- Aufträge ---------- */
  const jobs = () => S.kjobs || [];
  const doneSet = () => new Set(S.kjDone || []);
  function addJob(op, data) { const j = Object.assign({ id: uid(), op, at: Date.now() }, data); (S.kjobs = S.kjobs || []).push(j); return j; }
  /* Was nur Mirella betrifft, wird auf jedem Gerät nachgetragen, falls ein gleichzeitiger Abgleich es überschrieben hat */
  function applyS() {
    const st = S.settings, ign = (st.appleIgnored = st.appleIgnored || []), ns = (st.notSame = st.notSame || []), links = (st.bdayLinks = st.bdayLinks || {});
    let ch = false;
    const gone = new Set(S.goneP || []);
    for (const j of jobs()) {
      if (j.op === "ns") for (const k of j.keys || []) if (!ns.includes(k)) { ns.push(k); ch = true; }
      if (j.op === "ign") for (const k of [j.aid, j.ck]) if (k && !ign.includes(k)) { ign.push(k); ch = true; }
      if ((j.op === "bx" || j.op === "bdel") && !links[j.key]) { links[j.key] = "x"; ch = true; }
      if ((j.op === "blink" || j.op === "take" || j.op === "link") && j.key && !links[j.key] && !gone.has(j.pid) && S.people.some(p => p.id === j.pid)) { links[j.key] = j.pid; ch = true; }
    }
    return ch;
  }
  /* Karten, die durch einen Auftrag erledigt sind, aber noch im iPhone-Stand stehen */
  function hiddenKeys() {
    const h = new Set();
    for (const j of jobs()) {
      if (["del", "take", "link", "ign"].includes(j.op) && j.aid) h.add("a:" + j.aid);
      if (j.op === "merge2" && j.drop) h.add("a:" + j.drop.aid);
      if (["bcard", "blink", "bx", "bdel"].includes(j.op) && j.key) h.add("b:" + j.key);
    }
    return h;
  }
  /* Offene Karten aus dem iPhone-Stand, mit allem, was am PC schon entschieden ist */
  /* Schnell: Warteschlange und Treffer werden nur neu gerechnet, wenn sich etwas geändert hat */
  let qSig = "", qVal = [], cSig = "", cIdx = null, cMemo = new Map();
  function sig() {
    const st = S.settings || {}, box = S.kbox || {};
    let h = 0; for (const p of S.people) { const t = p.id + (p.first || "") + (p.last || "") + (p.nick || "") + (p.tel || "") + (p.email || "") + (p.bday || "") + (p.appleId || "") + (p.arch ? 1 : 0) + (p.tels || []).length; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; }
    return [h, box.at, (box.cards || []).length, (box.bdays || []).length, jobs().length, (S.kjDone || []).length, S.people.length, S.people.filter(p => p.appleId).length, S.people.filter(p => p.arch).length, (st.appleIgnored || []).length, (st.notSame || []).length, Object.keys(st.bdayLinks || {}).length].join("|");
  }
  function queue() {
    const box = S.kbox; if (!box) return [];
    const sg = sig(); if (sg === qSig) return qVal;
    if (applyS()) { /* Nachgetragenes ändert die Kennung */ }
    qVal = queueRaw(); qSig = sig(); return qVal;
  }
  function queueRaw() {
    const box = S.kbox;
    const ign = new Set(S.settings.appleIgnored || []), links = S.settings.bdayLinks || {}, have = new Set(S.people.map(p => p.appleId).filter(Boolean)), hid = hiddenKeys();
    const later = {}; for (const j of jobs()) if (j.op === "later") later[j.k] = Math.max(later[j.k] || 0, j.at);
    const cards = (box.cards || []).filter(c => !ign.has(c.appleId) && !ign.has(ckey(c)) && !have.has(c.appleId) && !hid.has("a:" + c.appleId)).map(c => JSON.parse(JSON.stringify(c)));
    const byAid = new Map(cards.map(c => [c.appleId, c]));
    for (const j of jobs()) {
      if (j.op === "bcard") { const c = byAid.get(j.aid); if (c && !c.bsrc) { bApply(j.b, c); c.bsrc = j.b.title; c.bk = j.key; } }
      if (j.op === "merge2") { const c = byAid.get(j.keep.aid); if (c && j.dropData) { mergeInto(c, j.dropData, extraLabel(j.dropData, c)); c.emails = [...new Set([...(c.emails || []), ...(j.dropData.emails || [])])]; if (j.first != null) { c.first = j.first; c.last = j.last; } } }
    }
    const bdays = (box.bdays || []).filter(b => !links[b.key] && !hid.has("b:" + b.key)).map(b => Object.assign({ b: 1 }, b));
    const nm = x => x.b ? normName(x.title) : normName((x.last || "") + " " + (x.first || ""));
    return cards.concat(bdays).sort((x, y) => (later[cKey(x)] || 0) - (later[cKey(y)] || 0) || nm(x).localeCompare(nm(y)));
  }
  /* Mögliche Treffer für eine Karte (wie am iPhone): sichere zuerst, ein schwacher nur, wenn er eindeutig ist */
  /* Vorauswahl: nur Einträge mit gleicher Nummer, E-Mail oder ähnlichem Namensanfang/-ende werden genau verglichen */
  const bKeys = e => [...e.tels.map(t => "t:" + t), ...e.mails.map(m => "m:" + m), ...e.toks.filter(t => t.length > 1).flatMap(t => ["a:" + t.slice(0, 3), "z:" + t.slice(-3)])];
  function index(q) {
    const s = sig(); if (cIdx && cSig === s) return cIdx;
    const all = S.people.filter(p => !p.arch).map(p => ent(p, "p")).concat(q.map(c => ent(c, c.b ? "b" : "c")));
    const m = new Map(); for (const e of all) for (const k of new Set(bKeys(e))) { let l = m.get(k); if (!l) m.set(k, l = []); l.push(e); }
    cIdx = { all, m }; cSig = s; cMemo = new Map(); return cIdx;
  }
  function near(e, idx) { const out = new Set(); for (const k of new Set(bKeys(e))) for (const x of idx.m.get(k) || []) out.add(x); return [...out]; }
  /* Mögliche Treffer für eine Karte (wie am iPhone): sichere zuerst, ein schwacher nur, wenn er eindeutig ist */
  function cands(card, q) {
    q = q || queue();
    const idx = index(q), ck = cKey(card); if (cMemo.has(ck)) return cMemo.get(ck);
    const me = ent(card, card.b ? "b" : "c"), ns = new Set(S.settings.notSame || []), out = [];
    const others = near(me, idx).filter(e => e.id !== me.id);
    for (const e of others) { const w = matchWhy(me, e); if (w && !nsHas(ns, me, e)) out.push({ e, w }); }
    const strong = out.filter(x => !x.w.startsWith("~")), weak = out.filter(x => x.w.startsWith("~"));
    let res = strong;
    if (!strong.length && weak.length === 1) {
      const w = weak[0], bEnt = me.kind === "b" ? me : w.e, oEnt = me.kind === "b" ? w.e : me;
      const all = near(bEnt, idx).filter(e => e.kind !== "b" && e.id !== oEnt.id);
      if (!all.some(e => matchWhy(bEnt, e))) res = [{ e: w.e, w: w.w.slice(1) }];
    }
    cMemo.set(ck, res); return res;
  }
  /* Telefonbuch-Teil eines Auftrags noch offen? (wartet aufs iPhone) */
  const waiting = () => { const d = doneSet(); return jobs().filter(j => !d.has(j.id) && ["take", "link", "merge2", "del", "bcard", "pmerge", "bdel"].includes(j.op)); };
  return { BSTOP, ckey, bName, nameToks, fmtMd, fmtB, cKey, ent, tokMatch, matchWhy, nsKeys, nsHas, bApply, extraLabel, jobs, doneSet, addJob, applyS, hiddenKeys, queue, cands, waiting };
})();
