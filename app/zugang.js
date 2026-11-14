/* Mirella – Zugang im Browser (PC): Anmelde-Pflicht und Einrichtung auf einer Seite (Wunsch Felix 14.11.)
   - Ohne Anmeldung sieht niemand etwas: Wer nur die Adresse eintippt, bekommt die Einrichtungs-Seite mit Mirella-Login.
   - Auf dieser Seite wird alles, was dieses Gerät braucht, EINMAL gesammelt abgefragt (Login, Claude-Schlüssel,
     Bahn-Zugang, Mikrofon). Danach bleibt Felix angemeldet und wird nichts mehr gefragt (keine Sperre nach Pause,
     ausdrücklicher Wunsch Felix 14.11.). Neue Eingaben für den Browser künftig hier ergänzen.
   In der iPhone-App tut diese Datei nichts (dort gibt es den eigenen Start-Assistenten). */
"use strict";
(function () {
  if (NATIVE) return;
  const ZK = "mirella.zugang"; // nur dieses Gerät: { setup: 1 }
  let Z = {}; try { Z = JSON.parse(localStorage.getItem(ZK) || "{}"); } catch (_) { }
  const zSave = () => { try { localStorage.setItem(ZK, JSON.stringify({ setup: Z.setup ? 1 : 0 })); } catch (_) { } };
  if (Z.hash || Z.salt || Z.min != null) zSave(); // Prüfwert der früheren Sperre (v0.37.0) entfernen
  const root = document.documentElement;
  const needSetup = () => !syOn() || !Z.setup;
  let locked = needSetup(), busy = false;

  /* ---------- Solange nicht angemeldet: nichts anzeigen ---------- */
  const origRender = render;
  render = function () {
    if (locked) { const s = $("#screen"); if (s) s.innerHTML = ""; const n = document.getElementById("pcnav"); if (n) { const mic = $("#mic"), bar = $(".tabbar"); if (mic && bar && n.contains(mic)) bar.insertBefore(mic, bar.children[2]); n.innerHTML = ""; } return; }
    return origRender.apply(this, arguments);
  };

  function gateHTML() {
    const on = syOn(), email = on ? SY.auth.user.email : "";
    const kiHave = typeof KI !== "undefined" && KI.key, dbHave = S.settings.dbClientId && S.settings.dbApiKey;
    return `<div class="zlogo"><img src="./logo-final.svg" alt=""><b>Mirella</b></div><h1>Mirella einrichten</h1>
      <p class="zsub">Einmal alles auf dieser Seite ausfüllen. Danach bleibst du auf diesem Computer angemeldet und Mirella fragt hier nichts mehr. Felder, die du leer lässt, kannst du später unter Einstellungen nachtragen.</p>
      <form id="zform" autocomplete="on">
        <div class="zsec">1. Dein Mirella-Konto</div>
        ${on ? `<p class="zsub" style="margin:0">Angemeldet als <b>${esc(email)}</b>.</p>` : `<label class="zfld"><span>E-Mail</span><input type="email" id="z-mail" name="email" autocomplete="username" required></label>
        <label class="zfld"><span>Passwort</span><input type="password" id="z-pw" autocomplete="current-password" required></label>`}
        <div class="zsec">2. Schlüssel für dieses Gerät</div>
        <small class="zhint">Diese Schlüssel bleiben nur auf diesem Computer und gehen nicht in den Abgleich. Du findest sie in deinen Notizen oder in der iPhone-App unter Einstellungen.</small>
        <label class="zfld"><span>Claude-Schlüssel (Mirella-KI) ${kiHave ? "· schon eingetragen" : ""}</span><input id="z-ki" class="keyin" type="text" autocomplete="off" spellcheck="false" placeholder="${kiHave ? "leer lassen = bleibt" : "sk-ant-… einfügen"}"></label>
        <label class="zfld"><span>Bahn: Client ID ${dbHave ? "· schon eingetragen" : ""}</span><input id="z-dbid" class="keyin" type="text" autocomplete="off" spellcheck="false" placeholder="${dbHave ? "leer lassen = bleibt" : "Client ID einfügen"}"></label>
        <label class="zfld"><span>Bahn: API Key</span><input id="z-dbkey" class="keyin" type="text" autocomplete="off" spellcheck="false" placeholder="${dbHave ? "leer lassen = bleibt" : "API Key einfügen"}"></label>
        <div class="zsec">3. Mikrofon</div>
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
    setTimeout(() => { const f = $("#zgate #z-mail") || $("#zgate #z-ki"); f && f.focus(); }, 50);
  }
  function lock() {
    try { closeAll(); } catch (_) { }
    document.querySelectorAll(".pdfview,.imgfull,.zv,.nbox,.toast").forEach(x => x.remove());
    locked = true; render(); showGate();
  }
  function unlock() {
    locked = false;
    const g = document.getElementById("zgate"); if (g) g.remove();
    root.classList.remove("zlocked"); render();
  }
  const err = t => { const e = $("#z-err"); if (e) e.textContent = t; };

  async function submit(f) {
    if (busy) return; busy = true;
    const btn = f.querySelector("button[type=submit]"), label = btn.textContent; btn.disabled = true; btn.textContent = "Einen Moment …"; err("");
    try {
      if (!syOn()) {
        await syLogin(($("#z-mail").value || "").trim().toLowerCase(), $("#z-pw").value);
        if (!syOn()) { err("Anmelden hat nicht geklappt. Bitte E-Mail und Passwort prüfen."); return; }
      }
      const ki = ($("#z-ki").value || "").trim(), dbid = ($("#z-dbid").value || "").trim(), dbkey = ($("#z-dbkey").value || "").trim();
      if (ki && typeof KI !== "undefined") { KI.key = ki; kiSave(); keyBad("ki", ki, false); }
      if (dbid && dbkey) { S.settings.dbClientId = dbid; S.settings.dbApiKey = dbkey; keyBad("db", dbkey, false); save(); }
      if ($("#z-mic").checked && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try { const st = await navigator.mediaDevices.getUserMedia({ audio: true }); st.getTracks().forEach(t => t.stop()); } catch (_) { }
      }
      Z.setup = 1; zSave(); unlock(); toast("Eingerichtet. Du bleibst auf diesem Computer angemeldet.");
    } finally { busy = false; if (btn.isConnected) { btn.disabled = false; btn.textContent = label; } }
  }
  document.addEventListener("submit", e => {
    const f = e.target; if (f.id !== "zform") return;
    e.preventDefault(); e.stopImmediatePropagation(); submit(f);
  }, true);
  /* Solange die Einrichtungs-Seite offen ist, wirken keine Tastenkürzel der App */
  document.addEventListener("keydown", e => { if (locked && !(e.target.closest && e.target.closest("#zgate"))) { e.stopImmediatePropagation(); } }, true);
  /* Abgemeldet (in den Einstellungen) oder Anmeldung vom Server zurückgezogen: wieder die Einrichtungs-Seite */
  setInterval(() => { if (!locked && !syOn()) { Z.setup = 0; zSave(); lock(); } }, 5e3);

  if (locked) showGate();
})();
