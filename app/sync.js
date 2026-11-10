/* Mirella – Abgleich über Supabase (Frankfurt)
   Anmeldung per 6-stelligem Code, ganze App-Daten als ein Datensatz je Nutzer,
   Fotos/PDFs im privaten Speicher, wöchentliche Sicherung auf dem Server.
   Ohne Anmeldung läuft alles wie bisher nur auf dem Gerät. */
"use strict";
const SB_URL = "https://xcanrhlwcopamhnmmlja.supabase.co";
const SB_KEY = "sb_publishable_uxI3wI_MIx3CZOk-zoahpw_MBoVeQZc";
const AUTH_KEY = "mirella.auth", META_KEY = "mirella.sync";
const LOCAL_ONLY = ["geoAsked"]; // gilt nur für dieses Gerät

const SY = {
  auth: null, meta: { ver: 0, dirty: false, last: 0, lastBackup: 0, pendingUp: [], pendingDel: [] },
  busy: false, timer: null, codeFor: "", status: ""
};
try { SY.auth = JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); } catch (_) { }
try { Object.assign(SY.meta, JSON.parse(localStorage.getItem(META_KEY) || "{}")); } catch (_) { }
const syMetaSave = () => { try { localStorage.setItem(META_KEY, JSON.stringify(SY.meta)); } catch (_) { } };
const syAuthSave = () => { try { SY.auth ? localStorage.setItem(AUTH_KEY, JSON.stringify(SY.auth)) : localStorage.removeItem(AUTH_KEY); } catch (_) { } };
const syOn = () => !!(SY.auth && SY.auth.user);

async function sbAuth(path, body) {
  const r = await fetch(SB_URL + "/auth/v1/" + path, { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.msg || j.error_description || j.message || ("Fehler " + r.status));
  return j;
}
function syTakeSession(j) {
  SY.auth = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000, user: { id: j.user.id, email: j.user.email } };
  syAuthSave();
}
async function syToken() {
  if (!syOn()) return null;
  if (Date.now() > SY.auth.expires_at - 60e3) {
    try { syTakeSession(await sbAuth("token?grant_type=refresh_token", { refresh_token: SY.auth.refresh_token })); }
    catch (e) { if (/invalid|not found|revoked/i.test(e.message)) { SY.auth = null; syAuthSave(); syStatus("Bitte neu anmelden"); } return null; }
  }
  return SY.auth.access_token;
}
async function sb(path, opt = {}) {
  const t = await syToken(); if (!t) throw new Error("offline");
  const r = await fetch(SB_URL + path, Object.assign({}, opt, { headers: Object.assign({ apikey: SB_KEY, Authorization: "Bearer " + t }, opt.headers || {}) }));
  if (!r.ok && r.status !== 404) throw new Error("Server " + r.status + " " + (await r.text().catch(() => "")).slice(0, 120));
  return r;
}
function syStatus(t) { SY.status = t; const el = document.getElementById("sy-status"); if (el) el.textContent = t; }

/* ---------- Daten ---------- */
function syPack() { const d = JSON.parse(JSON.stringify(S)); LOCAL_ONLY.forEach(k => { delete d.settings[k]; }); return d; }
function syApply(data) {
  const keep = {}; LOCAL_ONLY.forEach(k => { keep[k] = S.settings[k]; });
  S = Object.assign(blank(), data); S.settings = Object.assign(blank().settings, data.settings || {}, keep);
}
/* Zusammenführen, wenn zwei Geräte gleichzeitig geändert haben: alle Einträge beider Seiten, bei gleicher ID gewinnt dieses Gerät */
function syMerge(server, local) {
  const out = Object.assign({}, server, local);
  for (const k of Object.keys(out)) {
    const a = server[k], b = local[k];
    if (Array.isArray(a) && Array.isArray(b) && (a.concat(b)).every(x => x && typeof x === "object" && x.id)) {
      const m = new Map(); a.forEach(x => m.set(x.id, x)); b.forEach(x => m.set(x.id, x)); out[k] = [...m.values()];
    } else if (Array.isArray(a) && Array.isArray(b)) out[k] = [...new Set(a.concat(b))];
  }
  out.settings = Object.assign({}, server.settings || {}, local.settings || {});
  return out;
}

async function syPull() {
  const r = await sb("/rest/v1/mirella_state?select=data,version&user_id=eq." + SY.auth.user.id);
  const rows = await r.json(); return rows[0] || null;
}
async function syPush(row) {
  const body = JSON.stringify({ data: syPack(), version: SY.meta.ver + 1, updated_at: new Date().toISOString() });
  if (!row) {
    const r = await sb("/rest/v1/mirella_state", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(Object.assign(JSON.parse(body), { user_id: SY.auth.user.id })) });
    if (r.status === 409) return false;
    return (await r.json()).length > 0;
  }
  const r = await sb("/rest/v1/mirella_state?user_id=eq." + SY.auth.user.id + "&version=eq." + SY.meta.ver, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body });
  return (await r.json()).length > 0; // false = ein anderes Gerät war schneller
}

async function sync(manual) {
  if (!syOn() || SY.busy || !navigator.onLine) { if (manual && !navigator.onLine) toast("Kein Internet, ich gleiche später ab"); return; }
  SY.busy = true; syStatus("Gleiche ab …");
  try {
    let changed = false;
    for (let i = 0; i < 3; i++) {
      const row = await syPull();
      if (row && row.version < SY.meta.ver) SY.meta.ver = row.version; // Server wurde zurückgesetzt
      if (row && row.version > SY.meta.ver) {
        const merge = SY.meta.dirty || !SY.meta.ver;
        const data = merge ? syMerge(row.data, syPack()) : row.data;
        syApply(data); SY.meta.ver = row.version; origSave(); changed = true;
        SY.meta.dirty = merge && JSON.stringify(syPack()) !== JSON.stringify(row.data);
      }
      if (!row || SY.meta.dirty) {
        if (await syPush(row)) { SY.meta.ver += 1; SY.meta.dirty = false; } else continue; // anderes Gerät war schneller: neu holen
      }
      break;
    }
    if (changed) { const sh = document.getElementById("sheet"); if (!(sh && sh.classList.contains("open"))) render(true); }
    SY.meta.last = Date.now(); syMetaSave();
    await syFiles();
    await syBackup();
    syStatus("Abgeglichen " + new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
    if (manual) toast("Abgeglichen");
  } catch (e) {
    syStatus(/offline/.test(e.message) ? "Nicht angemeldet" : "Abgleich gerade nicht möglich");
    if (manual) toast("Abgleich fehlgeschlagen: " + e.message);
  } finally { SY.busy = false; }
}
function syLater() { if (!syOn()) return; clearTimeout(SY.timer); SY.timer = setTimeout(() => sync(), 2500); }

/* ---------- Fotos und PDFs ---------- */
const syPath = id => SB_URL + "/storage/v1/object/mirella/" + SY.auth.user.id + "/" + encodeURIComponent(id);
async function syUp(id, blob) {
  const t = await syToken(); if (!t) throw new Error("offline");
  const r = await fetch(syPath(id), { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + t, "x-upsert": "true", "Content-Type": blob.type || "application/octet-stream" }, body: blob });
  if (!r.ok) throw new Error("Upload " + r.status);
}
async function syFiles() {
  const up = SY.meta.pendingUp.slice(), del = SY.meta.pendingDel.slice();
  for (const id of up) { try { const b = await origPhotoGet(id); if (b) await syUp(id, b); SY.meta.pendingUp = SY.meta.pendingUp.filter(x => x !== id); } catch (_) { } }
  for (const id of del) { try { await sb("/storage/v1/object/mirella/" + SY.auth.user.id + "/" + encodeURIComponent(id), { method: "DELETE" }); SY.meta.pendingDel = SY.meta.pendingDel.filter(x => x !== id); } catch (_) { } }
  syMetaSave();
}

/* ---------- Wöchentliche Sicherung auf dem Server (die letzten 8 bleiben) ---------- */
async function syBackup() {
  if (Date.now() - (SY.meta.lastBackup || 0) < 7 * 864e5) return;
  await sb("/rest/v1/mirella_backup", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ user_id: SY.auth.user.id, data: syPack() }) });
  const r = await sb("/rest/v1/mirella_backup?select=id&order=id.desc&offset=8&limit=50"); const old = await r.json();
  if (old.length) await sb("/rest/v1/mirella_backup?id=in.(" + old.map(x => x.id).join(",") + ")", { method: "DELETE" });
  SY.meta.lastBackup = Date.now(); syMetaSave();
}
async function syRestoreList() { const r = await sb("/rest/v1/mirella_backup?select=id,created_at&order=id.desc&limit=8"); return r.json(); }
async function syRestore(id) {
  const r = await sb("/rest/v1/mirella_backup?select=data&id=eq." + id); const [row] = await r.json(); if (!row) return;
  syApply(row.data); SY.meta.dirty = true; origSave(); syMetaSave(); render(); sync(true);
}

/* ---------- Bestehende Funktionen der App erweitern ---------- */
const origSave = save, origPhotoPut = photoPut, origPhotoGet = photoGet, origPhotoDel = photoDel;
save = function () { const ok = origSave(); if (ok && syOn()) { SY.meta.dirty = true; syMetaSave(); syLater(); } return ok; };
photoPut = async function (id, blob) {
  await origPhotoPut(id, blob);
  if (syOn()) { if (!SY.meta.pendingUp.includes(id)) SY.meta.pendingUp.push(id); syMetaSave(); syLater(); }
};
photoGet = async function (id) {
  const b = await origPhotoGet(id); if (b || !syOn()) return b;
  try { const r = await sb("/storage/v1/object/authenticated/mirella/" + SY.auth.user.id + "/" + encodeURIComponent(id)); if (!r.ok) return b; const blob = await r.blob(); await origPhotoPut(id, blob); return blob; } catch (_) { return b; }
};
photoDel = async function (id) {
  await origPhotoDel(id);
  if (syOn()) { SY.meta.pendingUp = SY.meta.pendingUp.filter(x => x !== id); SY.meta.pendingDel.push(id); syMetaSave(); syLater(); }
};

/* ---------- Anmeldung ---------- */
async function syLogin1(email) {
  email = (email || "").trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(email)) { toast("Bitte eine gültige E-Mail eingeben"); return; }
  try { await sbAuth("otp", { email, create_user: false }); SY.codeFor = email; render(true); toast("Code ist unterwegs, schau in dein Postfach"); }
  catch (e) { toast(/signup|not allowed|not found/i.test(e.message) ? "Diese E-Mail ist nicht eingeladen" : "Code konnte nicht gesendet werden: " + e.message); }
}
async function syLogin2(code) {
  code = (code || "").replace(/\D/g, ""); if (code.length < 6) { toast("Bitte den 6-stelligen Code eingeben"); return; }
  let j = null;
  for (const type of ["email", "magiclink", "invite", "signup"]) { try { j = await sbAuth("verify", { type, email: SY.codeFor, token: code }); break; } catch (_) { } }
  if (!j || !j.access_token) { toast("Der Code stimmt nicht oder ist abgelaufen"); return; }
  syTakeSession(j); SY.codeFor = "";
  SY.meta = { ver: 0, dirty: true, last: 0, lastBackup: SY.meta.lastBackup || 0, pendingUp: [], pendingDel: [] };
  try { SY.meta.pendingUp = Object.keys(await photoAll()); } catch (_) { }
  syMetaSave(); toast("Angemeldet, ich gleiche ab …"); render(true); await sync(true); render(true);
}
async function syLogout() {
  if (!confirm("Abmelden? Deine Daten bleiben auf diesem Gerät und auf dem Server.")) return;
  try { const t = await syToken(); if (t) await fetch(SB_URL + "/auth/v1/logout", { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + t } }); } catch (_) { }
  SY.auth = null; syAuthSave(); SY.meta.ver = 0; syMetaSave(); render(true);
}

/* Bereich in den Einstellungen */
function syBlock() {
  const inp = 'class="search" style="margin:0"';
  if (syOn()) return `<div class="sec"><span class="label">Konto und Abgleich</span></div>
    <p class="hint" style="margin-top:0">Angemeldet als <b>${esc(SY.auth.user.email)}</b>. Mirella gleicht automatisch zwischen deinen Geräten ab und legt jede Woche eine Sicherung auf dem Server ab (die letzten 8 bleiben).<br><span id="sy-status">${esc(SY.status || (SY.meta.last ? "Zuletzt abgeglichen " + new Date(SY.meta.last).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""))}</span></p>
    <div class="row2" style="margin-top:0"><button class="btn" data-act="synow">Jetzt abgleichen</button><button class="btn" data-act="syback">Sicherung zurückholen</button></div>
    <button class="btn" data-act="syout" style="width:100%;margin-top:8px">Abmelden</button>`;
  return `<div class="sec"><span class="label">Konto und Abgleich</span></div>
    <p class="hint" style="margin-top:0">Melde dich an, dann sind iPhone, iPad und PC immer auf dem gleichen Stand und deine Daten sind auf dem Server in Frankfurt gesichert.</p>
    ${SY.codeFor ? `<p class="hint">Code an <b>${esc(SY.codeFor)}</b> geschickt.</p><form class="shoprow" data-form="sycode" style="margin-bottom:8px"><input ${inp} inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="6-stelliger Code" aria-label="Code"><button class="btn pri" style="flex:none">Anmelden</button></form><button class="btn" data-act="syreset" style="width:100%">Andere E-Mail</button>`
      : `<form class="shoprow" data-form="symail" style="margin-bottom:8px"><input ${inp} type="email" autocomplete="email" placeholder="Deine E-Mail" aria-label="E-Mail"><button class="btn pri" style="flex:none">Code</button></form>`}`;
}
const origEinst = R.einstellungen;
R.einstellungen = function () { const h = origEinst.call(this); const i = h.indexOf('<div class="sec"><span class="label">Datensicherung</span></div>'); return i < 0 ? h + syBlock() : h.slice(0, i) + syBlock() + h.slice(i); };

Object.assign(ACT, {
  synow: () => sync(true),
  syout: () => syLogout(),
  syreset: () => { SY.codeFor = ""; render(true); },
  syback: async () => {
    try {
      const list = await syRestoreList(); if (!list.length) { toast("Noch keine Sicherung auf dem Server"); return; }
      openSheet(`<p class="stitle">Sicherung zurückholen</p><p class="hint">Ersetzt deine aktuellen Daten auf allen Geräten durch diesen Stand.</p>${list.map(b => `<button class="btn" data-act="syrest" data-id="${b.id}" style="width:100%;margin-bottom:6px">${esc(new Date(b.created_at).toLocaleString("de-DE"))}</button>`).join("")}`);
    } catch (e) { toast("Gerade nicht möglich: " + e.message); }
  },
  syrest: el => { if (confirm("Diesen Stand wirklich zurückholen?")) { closeAll(); syRestore(el.dataset.id); } }
});
document.addEventListener("submit", e => {
  const f = e.target.closest && e.target.closest("form[data-form^=sy]"); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const v = f.querySelector("input").value;
  if (f.dataset.form === "symail") syLogin1(v); else syLogin2(v);
}, true);

/* Abgleich beim Start, beim Zurückkehren in die App und jede Minute, solange sie offen ist */
if (syOn()) { sync(); }
document.addEventListener("visibilitychange", () => { if (!document.hidden) sync(); });
window.addEventListener("online", () => sync());
setInterval(() => { if (!document.hidden) sync(); }, 60e3);
