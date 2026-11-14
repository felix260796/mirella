/* Mirella – Zugang im Browser (PC): Passwort-Sperre und Einrichtung auf einer Seite (Wunsch Felix 14.11.)
   - Ohne Anmeldung sieht niemand etwas: zuerst kommt die Einrichtungs-Seite mit Mirella-Login.
   - Auf dieser Seite wird alles, was dieses Gerät braucht, EINMAL gesammelt abgefragt (Login, Claude-Schlüssel,
     Bahn-Zugang, Sperre, Mikrofon). Danach fragt Mirella nur noch das Passwort, wenn sie gesperrt ist.
   - Gesperrt wird beim Öffnen und nach einer Pause (einstellbar). Das Passwort ist das Mirella-Passwort.
     Auf dem Gerät liegt davon nur ein Prüfwert (PBKDF2), nie das Passwort selbst.
   In der iPhone-App tut diese Datei nichts (dort gibt es Face ID und den eigenen Start-Assistenten). */
"use strict";
(function () {
  if (NATIVE) return;
  const ZK = "mirella.zugang"; // nur dieses Gerät: { salt, hash, email, min, setup: 1 }
  let Z = {}; try { Z = JSON.parse(localStorage.getItem(ZK) || "{}"); } catch (_) { }
  const zSave = () => { try { localStorage.setItem(ZK, JSON.stringify(Z)); } catch (_) { } };
  if (Z.min == null) Z.min = 15;
  const root = document.documentElement;
  let locked = true, lastAct = Date.now(), busy = false;

  /* ---------- Prüfwert des Passworts (PBKDF2, 150.000 Runden) ---------- */
  const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
  async function pwHash(pw, saltHex) {
    const salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
    const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
    return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 150000 }, k, 256));
  }
  async function pwStore(pw, email) { Z.salt = hex(crypto.getRandomValues(new Uint8Array(16))); Z.hash = await pwHash(pw, Z.salt); Z.email = email; zSave(); }
  async function pwLocalOk(pw) { return !!(Z.hash && Z.salt) && (await pwHash(pw, Z.salt)) === Z.hash; }
  /* Beim Server nachfragen (z. B. wenn das Passwort inzwischen geändert wurde) */
  async function pwServerOk(email, pw) {
    try { const j = await sbAuth("token?grant_type=password", { email, password: pw }); return j; } catch (e) { return /invalid/i.test(e.message) ? false : null; }
  }

  /* ---------- Solange gesperrt: nichts anzeigen ---------- */
  const origRender = render;
  render = function () {
    if (locked) { const s = $("#screen"); if (s) s.innerHTML = ""; const n = document.getElementById("pcnav"); if (n) { const mic = $("#mic"), bar = $(".tabbar"); if (mic && bar && n.contains(mic)) bar.insertBefore(mic, bar.children[2]); n.innerHTML = ""; } return; }
    return origRender.apply(this, arguments);
  };
  const needSetup = () => !syOn() || !Z.setup;

  function gateHTML() {
    const setup = needSetup(), email = (SY.auth && SY.auth.user && SY.auth.user.email) || Z.email || "";
    const kiHave = typeof KI !== "undefined" && KI.key, dbHave = S.settings.dbClientId && S.settings.dbApiKey;
    const head = `<div class="zlogo"><img src="./logo-final.svg" alt=""><b>Mirella</b></div>`;
    if (!setup) return `${head}<h1>Gesperrt</h1><p class="zsub">Bitte dein Mirella-Passwort eingeben.</p>
      <form id="zform" data-mode="lock" autocomplete="on"><input type="email" name="email" value="${esc(email)}" autocomplete="username" hidden>
      <label class="zfld"><span>Passwort</span><input type="password" id="z-pw" autocomplete="current-password" required></label>
      <p class="zerr" id="z-err" role="alert"></p>
      <button class="btn pri zbtn" type="submit">Entsperren</button></form>
      <button class="zlink" type="button" data-z="relogin">Mit anderem Konto anmelden</button>`;
    return `${head}<h1>Mirella am PC einrichten</h1>
      <p class="zsub">Einmal alles auf dieser Seite ausfüllen, danach fragt Mirella hier nichts mehr, nur noch dein Passwort, wenn sie gesperrt ist. Felder, die du leer lässt, kannst du später unter Einstellungen nachtragen.</p>
      <form id="zform" data-mode="setup" autocomplete="on">
        <div class="zsec">1. Dein Mirella-Konto</div>
        <label class="zfld"><span>E-Mail</span><input type="email" id="z-mail" name="email" value="${esc(email)}" autocomplete="username" required></label>
        <label class="zfld"><span>Passwort</span><input type="password" id="z-pw" autocomplete="current-password" required></label>
        <div class="zsec">2. Sperre</div>
        <label class="zfld"><span>Sperren nach so viel Pause</span><select id="z-min">${[[5, "5 Minuten"], [15, "15 Minuten"], [30, "30 Minuten"], [60, "1 Stunde"], [240, "4 Stunden"], [0, "nur beim Öffnen"]].map(([v, l]) => `<option value="${v}"${+Z.min === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
        <small class="zhint">Beim Öffnen fragt Mirella immer nach dem Passwort. Fremde sehen ohne Passwort nichts.</small>
        <div class="zsec">3. Schlüssel für dieses Gerät</div>
        <small class="zhint">Diese Schlüssel bleiben nur auf diesem Computer und gehen nicht in den Abgleich. Du findest sie in deinen Notizen oder kopierst sie aus der iPhone-App (Einstellungen).</small>
        <label class="zfld"><span>Claude-Schlüssel (Mirella-KI) ${kiHave ? "· schon eingetragen" : ""}</span><input id="z-ki" class="keyin" type="text" autocomplete="off" spellcheck="false" placeholder="${kiHave ? "leer lassen = bleibt" : "sk-ant-… einfügen"}"></label>
        <label class="zfld"><span>Bahn: Client ID ${dbHave ? "· schon eingetragen" : ""}</span><input id="z-dbid" class="keyin" type="text" autocomplete="off" spellcheck="false" placeholder="${dbHave ? "leer lassen = bleibt" : "Client ID einfügen"}"></label>
        <label class="zfld"><span>Bahn: API Key</span><input id="z-dbkey" class="keyin" type="text" autocomplete="off" spellcheck="false" placeholder="${dbHave ? "leer lassen = bleibt" : "API Key einfügen"}"></label>
        <div class="zsec">4. Mikrofon</div>
        <label class="zchk"><input type="checkbox" id="z-mic" checked><span>Diktieren erlauben. Der Browser fragt gleich einmal, bitte <b>Zulassen</b> klicken.</span></label>
        <p class="zerr" id="z-err" role="alert"></p>
        <button class="btn pri zbtn" type="submit">Speichern und loslegen</button>
      </form>`;
  }
  function showGate() {
    let g = document.getElementById("zgate");
    if (!g) { g = document.createElement("div"); g.id = "zgate"; g.setAttribute("role", "dialog"); g.setAttribute("aria-modal", "true"); document.body.appendChild(g); }
    g.innerHTML = `<div class="zbox">${gateHTML()}</div>`;
    root.classList.add("zlocked");
    setTimeout(() => { const f = $("#zgate #z-mail") && !$("#zgate #z-mail").value ? $("#zgate #z-mail") : $("#zgate #z-pw"); f && f.focus(); }, 50);
  }
  function lock() {
    if (locked && document.getElementById("zgate")) return;
    try { closeAll(); } catch (_) { }
    document.querySelectorAll(".pdfview,.imgfull,.zv,.nbox,.toast").forEach(x => x.remove());
    locked = true; render(); showGate();
  }
  function unlock() {
    locked = false; lastAct = Date.now();
    const g = document.getElementById("zgate"); if (g) g.remove();
    root.classList.remove("zlocked"); render();
  }
  const err = t => { const e = $("#z-err"); if (e) e.textContent = t; };

  async function submit(f) {
    if (busy) return; busy = true;
    const btn = f.querySelector("button[type=submit]"), label = btn.textContent; btn.disabled = true; btn.textContent = "Einen Moment …"; err("");
    try {
      const pw = $("#z-pw").value;
      if (f.dataset.mode === "lock") {
        const email = Z.email || (SY.auth && SY.auth.user.email) || "";
        let ok = await pwLocalOk(pw);
        if (!ok) { const r = await pwServerOk(email, pw); if (r) { ok = true; await pwStore(pw, email); } else if (r === null && !Z.hash) { err("Keine Verbindung zum Server. Bitte gleich nochmal versuchen."); return; } }
        if (!ok) { err("Das Passwort stimmt nicht."); $("#z-pw").select(); return; }
        unlock(); return;
      }
      /* Einrichtung: anmelden (oder Passwort beim Server prüfen), dann alles auf einmal speichern */
      const email = ($("#z-mail").value || "").trim().toLowerCase();
      if (!syOn()) {
        await syLogin(email, pw); // meldet selbst, wenn E-Mail oder Passwort nicht stimmen
        if (!syOn()) { err("Anmelden hat nicht geklappt. Bitte E-Mail und Passwort prüfen."); return; }
      } else {
        const r = await pwServerOk(SY.auth.user.email, pw);
        if (r === false) { err("Das Passwort stimmt nicht."); return; }
        if (r === null) { err("Keine Verbindung zum Server. Bitte gleich nochmal versuchen."); return; }
      }
      await pwStore(pw, SY.auth.user.email);
      Z.min = +$("#z-min").value;
      const ki = ($("#z-ki").value || "").trim(), dbid = ($("#z-dbid").value || "").trim(), dbkey = ($("#z-dbkey").value || "").trim();
      if (ki && typeof KI !== "undefined") { KI.key = ki; kiSave(); keyBad("ki", ki, false); }
      if (dbid && dbkey) { S.settings.dbClientId = dbid; S.settings.dbApiKey = dbkey; keyBad("db", dbkey, false); save(); }
      if ($("#z-mic").checked && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try { const st = await navigator.mediaDevices.getUserMedia({ audio: true }); st.getTracks().forEach(t => t.stop()); } catch (_) { }
      }
      Z.setup = 1; zSave(); unlock(); toast("Eingerichtet. Mirella ist jetzt mit deinem Passwort geschützt.");
    } finally { busy = false; if (btn.isConnected) { btn.disabled = false; btn.textContent = label; } }
  }
  document.addEventListener("submit", e => {
    const f = e.target; if (f.id !== "zform") return;
    e.preventDefault(); e.stopImmediatePropagation(); submit(f);
  }, true);
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-z=relogin]"); if (!b) return;
    e.preventDefault(); e.stopImmediatePropagation();
    /* Nur die Anmeldung auf diesem Gerät wird entfernt. Die Daten bleiben auf dem Gerät und auf dem Server. */
    SY.auth = null; syAuthSave(); Z.setup = 0; zSave(); showGate();
  }, true);
  /* Während der Sperre wirken keine Tastenkürzel der App */
  document.addEventListener("keydown", e => { if (locked && !(e.target.closest && e.target.closest("#zgate"))) { e.stopImmediatePropagation(); } }, true);

  /* ---------- Sperren nach Pause ---------- */
  ["pointerdown", "keydown", "mousemove", "wheel", "touchstart"].forEach(t => document.addEventListener(t, () => { if (!locked) lastAct = Date.now(); }, { passive: true, capture: true }));
  const idleOver = () => +Z.min > 0 && Date.now() - lastAct > Z.min * 60e3;
  setInterval(() => { if (!locked && Z.setup && idleOver()) lock(); }, 20e3);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !locked && Z.setup && idleOver()) lock(); });
  /* Abgemeldet (z. B. in den Einstellungen oder weil die Anmeldung abgelaufen ist): wieder die Einrichtungs-Seite */
  setInterval(() => { if (!locked && !syOn()) { Z.setup = 0; zSave(); lock(); } }, 5e3);

  /* In den Einstellungen unter „Konto & Abgleich“: Sperre ändern oder sofort sperren */
  ACT.zlocknow = () => lock();
  ACT.zmin = el => { Z.min = +el.dataset.m; zSave(); render(true); toast("Gespeichert"); };
  if (typeof SETS !== "undefined" && SETS.konto) {
    const o = SETS.konto;
    SETS.konto = function () {
      return o.apply(this, arguments) + `<div class="sec sethead"><span class="label">Sperre am PC</span></div>
      <p class="hint" style="margin-top:0">Mirella fragt im Browser beim Öffnen und nach einer Pause nach deinem Mirella-Passwort. Gesperrt nach:</p>
      <div class="chips">${[[5, "5 Min."], [15, "15 Min."], [30, "30 Min."], [60, "1 Std."], [240, "4 Std."], [0, "nur beim Öffnen"]].map(([v, l]) => `<button class="chip2" data-act="zmin" data-m="${v}" aria-pressed="${+Z.min === v}">${l}</button>`).join("")}</div>
      <button class="btn" data-act="zlocknow" style="width:100%;margin-top:8px">Jetzt sperren</button>`;
    };
  }

  /* Start: immer erst gesperrt */
  showGate();
})();
