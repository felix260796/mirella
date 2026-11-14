/* Mirella – PC-Ansicht (Windows-Computer, breiter Bildschirm mit Maus und Tastatur)
   Greift nur im Browser auf einem breiten Bildschirm (ab 1100 Pixel, mit Maus). Auf dem iPhone,
   in der iPhone-App und im schmalen Fenster bleibt alles wie bisher. Daten und Abgleich sind dieselben:
   Diese Datei liest und schreibt nur über die bestehenden Funktionen (save, render, savePerson …). */
"use strict";
(function () {
  if (NATIVE) return;
  const MQ = window.matchMedia ? window.matchMedia("(min-width: 1100px) and (pointer: fine)") : null;
  const root = document.documentElement;
  let on = false, sortK = "name", sortDir = 1, showArchRows = false;
  const sel = new Set();
  let installEvt = null;

  /* ---------- Seitenleiste links (ersetzt die Leiste unten und das Menü) ---------- */
  const NAV = [["heute", "Heute", IC.sun, "1"], ["menschen", "Kontakte", IC.people, "2"], ["todos", "To-dos & Einkauf", IC.check, "3"], ["kalender", "Kalender", IC.cal, "4"]];
  function navHTML() {
    const act = view === "akte" ? "menschen" : view;
    return `<div class="pcbrand"><img src="./logo-final.svg" alt=""><b>Mirella</b></div>
    <div class="pcquick"><button class="btn pri" data-act="pcnew" title="Neu anlegen (Taste N)">＋ Neu</button><button class="btn" data-act="pcsearch" title="Suchen (Strg+K)">${IC.such} Suchen</button></div>
    <div class="pcmicslot"></div>
    <nav class="pcmain" aria-label="Hauptbereiche">${NAV.map(([v, l, ic, k]) => `<button class="pcitem" data-act="pcgo" data-v="${v}"${act === v ? ' aria-current="page"' : ""} title="${l} (Taste ${k})"><span class="pcic">${ic}</span><span>${l}</span><kbd>${k}</kbd></button>`).join("")}</nav>
    <div class="pclabel">Alle Bereiche</div>
    <div class="pcareas">${drawerHTML()}</div>
    <div class="pcfoot">
      ${installEvt ? `<button class="btn pri" data-act="pcinstall">Als Windows-App installieren</button>` : ""}
      <button class="pcitem" data-act="go" data-v="einstellungen"${view === "einstellungen" ? ' aria-current="page"' : ""}><span class="pcic">${IC.gear}</span><span>Einstellungen</span></button>
      <button class="pcitem" data-act="pckeys"><span class="pcic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/></svg></span><span>Tastenkürzel</span><kbd>?</kbd></button>
    </div>`;
  }
  function navUpdate() {
    let nav = document.getElementById("pcnav");
    if (!nav) { nav = document.createElement("aside"); nav.id = "pcnav"; nav.className = "pcnav"; nav.setAttribute("aria-label", "Navigation"); $("#phone").insertBefore(nav, $("#phone").firstChild); }
    const st = (nav.querySelector(".pcareas") || {}).scrollTop || 0;
    const mic = $("#mic"); if (mic && nav.contains(mic)) $(".tabbar").appendChild(mic); // Mikrofon nicht mitlöschen
    nav.innerHTML = navHTML();
    nav.querySelector(".pcmicslot").appendChild($("#mic"));
    const ar = nav.querySelector(".pcareas"); if (ar) ar.scrollTop = st;
  }

  /* ---------- Kontakte als Tabelle ---------- */
  const keyName = p => ((p.last || p.first || "") + " " + (p.first || "")).trim();
  const nb = p => { try { return nextBirthday(p); } catch (_) { return null; } };
  const COLS = [
    ["name", "Name", (a, b) => keyName(a).localeCompare(keyName(b), "de")],
    ["group", "Gruppe", (a, b) => (a.group || "~").localeCompare(b.group || "~", "de")],
    ["tel", "Telefon", (a, b) => (a.tel || "~").localeCompare(b.tel || "~")],
    ["cyc", "Rhythmus", (a, b) => CYCLES.indexOf(a.cyc || "nie") - CYCLES.indexOf(b.cyc || "nie")],
    ["last", "Zuletzt angerufen", (a, b) => (lastCall(a) || "0").localeCompare(lastCall(b) || "0")],
    ["next", "Nächster Anruf", (a, b) => (nextDue(a) || "9999").localeCompare(nextDue(b) || "9999")],
    ["bday", "Geburtstag", (a, b) => (nb(a) || "9999").localeCompare(nb(b) || "9999")],
    ["woher", "Woher · Beruf", (a, b) => ((a.woher || "") + (a.job || "") || "~").localeCompare((b.woher || "") + (b.job || "") || "~", "de")]
  ];
  function rows() {
    const ql = q.trim().toLowerCase();
    return S.people.filter(p => (showArchRows ? p.arch : !p.arch) && (!grpFilter || p.group === grpFilter) && (!ql || (fullName(p) + " " + (p.group || "") + " " + (p.nick || "") + " " + (p.tel || "") + " " + (p.email || "") + " " + (p.woher || "") + " " + (p.job || "") + " " + (p.addr || "")).toLowerCase().includes(ql) || fuzzyHas(fullName(p) + " " + (p.nick || "") + " " + (p.job || ""), ql)));
  }
  const grpSel = (p, cls) => `<select class="pcin ${cls || ""}" data-pc="group" data-id="${p ? p.id : ""}" aria-label="Gruppe">${p ? "" : '<option value="__">Gruppe setzen …</option>'}<option value="">keine Gruppe</option>${[...new Set(S.groups.concat(p && p.group ? [p.group] : []))].map(g => `<option${p && p.group === g ? " selected" : ""}>${esc(g)}</option>`).join("")}</select>`;
  const cycSel = (p, cls) => `<select class="pcin ${cls || ""}" data-pc="cyc" data-id="${p ? p.id : ""}" aria-label="Anruf-Rhythmus">${p ? "" : '<option value="__">Rhythmus setzen …</option>'}${CYCLES.map(c => `<option value="${esc(c)}"${p && (p.cyc || "nie") === c ? " selected" : ""}>${esc(cycLabel(c))}</option>`).join("")}</select>`;
  function tableHTML() {
    const list = rows(), col = COLS.find(c => c[0] === sortK) || COLS[0];
    list.sort((a, b) => sortDir * col[2](a, b) || keyName(a).localeCompare(keyName(b), "de"));
    for (const id of [...sel]) if (!S.people.some(p => p.id === id)) sel.delete(id);
    const grps = S.groups.filter(g => S.people.some(p => p.group === g));
    const nArch = S.people.filter(p => p.arch).length, t = today();
    const allOn = list.length && list.every(p => sel.has(p.id));
    const row = p => {
      const st = callState(p), due = nextDue(p), b = nb(p), lc = lastCall(p);
      const bd = (p.bday || "").split("-").map(Number), bIn = b ? diffDays(t, b) : null;
      const bTxt = p.bday ? `${bd[2]}.${bd[1]}.${bd[0] && bd[0] !== 1604 ? bd[0] : ""}<small>${bIn === 0 ? "heute!" : bIn != null && bIn <= 30 ? "in " + pl(bIn, "Tag", "Tagen") : ""}</small>` : "";
      return `<tr class="${cur === p.id && view === "akte" ? "on" : ""}${sel.has(p.id) ? " sel" : ""}" data-act="person" data-id="${p.id}" tabindex="0">
      <td class="cb"><input type="checkbox" class="pcin" data-pc="sel" data-id="${p.id}" aria-label="${esc(fullName(p))} auswählen"${sel.has(p.id) ? " checked" : ""}></td>
      <td class="nm"><div class="nmi">${avHTML(p)}<span><b>${esc(fullName(p))}</b>${p.nick ? `<small>${esc(p.nick)}</small>` : ""}</span></div></td>
      <td>${grpSel(p)}</td>
      <td class="tel">${p.tel ? esc(p.tel) : '<span class="mut">—</span>'}${(p.tels || []).length ? ` <small class="mut">+${p.tels.length}</small>` : ""}</td>
      <td>${p.death ? '<span class="mut">verstorben</span>' : cycSel(p)}</td>
      <td>${lc ? `${esc(fmtDate(lc))}<small>${esc(agoText(lc))}</small>` : '<span class="mut">noch nie</span>'}</td>
      <td>${due && !p.arch ? `<span class="pill ${st === "late" ? "late" : st === "due" ? "acc" : ""}">${esc(st === "late" ? "überfällig" : relDate(due))}</span>` : '<span class="mut">—</span>'}</td>
      <td class="bd">${bTxt || '<span class="mut">—</span>'}</td>
      <td class="wo">${esc([p.woher, p.job].filter(Boolean).join(" · ")) || '<span class="mut">—</span>'}</td></tr>`;
    };
    return `${topbar("Kontakte")}${HOOKS.menschenTop.map(f => f()).join("")}
    <div class="pctools">
      <input class="search" id="q" type="search" placeholder="Suchen: Name, Nummer, E-Mail, Gruppe, Beruf, Adresse  (Strg+K)" aria-label="Suchen" value="${esc(q)}" autocomplete="off">
      <select class="pcin" data-pc="grpf" aria-label="Nach Gruppe filtern"><option value="">Alle Gruppen</option>${grps.map(g => `<option${grpFilter === g ? " selected" : ""}>${esc(g)}</option>`).join("")}</select>
      ${nArch ? `<button class="mini" data-act="pcarch" aria-pressed="${showArchRows}">${showArchRows ? "Zurück zu den aktiven" : "Archiv (" + nArch + ")"}</button>` : ""}
      <button class="btn pri" data-act="pcnew" style="flex:none">＋ Neuer Kontakt</button>
    </div>
    <div class="pcbulk"${sel.size ? "" : " hidden"}><b>${sel.size} ausgewählt</b>${grpSel(null, "bulk")}${cycSel(null, "bulk")}<button class="mini" data-act="pcselnone">Auswahl aufheben</button></div>
    <div class="pccount">${pl(list.length, showArchRows ? "Kontakt im Archiv" : "Kontakt", showArchRows ? "Kontakte im Archiv" : "Kontakte")}${grpFilter ? " in „" + esc(grpFilter) + "“" : ""}${q ? " gefunden" : ""} · Gruppe und Rhythmus direkt in der Tabelle ändern, Zeile anklicken öffnet die Akte</div>
    ${list.length ? `<div class="pctablewrap"><table class="pctable"><thead><tr><th class="cb"><input type="checkbox" class="pcin" data-pc="selall" aria-label="Alle auswählen"${allOn ? " checked" : ""}></th>${COLS.map(([k, l]) => `<th><button data-act="pcsort" data-k="${k}" aria-sort="${sortK === k ? (sortDir > 0 ? "ascending" : "descending") : "none"}">${l}${sortK === k ? (sortDir > 0 ? " ▲" : " ▼") : ""}</button></th>`).join("")}</tr></thead><tbody>${list.map(row).join("")}</tbody></table></div>` : empty(S.people.length ? "Niemand gefunden." : "Noch keine Kontakte. Oben auf „Neuer Kontakt“, oder importiere sie in den Einstellungen (vCard).")}`;
  }

  /* ---------- Ansichten für den PC ---------- */
  const origMenschen = R.menschen, origAkte = R.akte, origTodos = R.todos;
  R.menschen = function () { return on ? `<div class="pcwide">${tableHTML()}</div>` : origMenschen.apply(this, arguments); };
  R.akte = function () {
    if (!on) return origAkte.apply(this, arguments);
    if (!S.people.some(x => x.id === cur)) { view = "menschen"; return R.menschen(); }
    return `<div class="pcsplit"><div class="pcwide">${tableHTML()}</div><aside class="pcakte" aria-label="Kontakt-Akte">${origAkte.apply(this, arguments)}</aside></div>`;
  };
  /* To-dos und Einkaufsliste nebeneinander */
  R.todos = function () {
    if (!on || shopMode) return origTodos.apply(this, arguments);
    const keep = todoList, top = topbar("To-dos");
    todoList = "todo"; const a = origTodos.apply(this, arguments).replace(top, "").replace(todoSeg(false), "");
    todoList = "einkauf"; const b = origTodos.apply(this, arguments).replace(top, "").replace(todoSeg(true), "");
    todoList = keep;
    return `${top}<div class="pccols"><section><h3 class="pch">Aufgaben</h3>${a}</section><section><h3 class="pch">Einkaufsliste</h3>${b}</section></div>`;
  };

  /* Monatskalender: am PC stehen die Einträge direkt im Tag (bis zu 3, dann „+ weitere“) */
  function calTitles() {
    const n = new Date(calY, calM + 1, 0).getDate();
    const ev = eventsRange(iso(new Date(calY, calM, 1, 12)), iso(new Date(calY, calM, n, 12)));
    for (const b of $$("#screen .mc[data-d]")) {
      const e = ev[b.dataset.d] || []; if (!e.length) continue;
      const box = document.createElement("span"); box.className = "mcev";
      box.innerHTML = e.slice(0, 3).map(x => `<i class="ev-${x.c}">${esc((x.time ? x.time + " " : "") + x.t)}</i>`).join("") + (e.length > 3 ? `<i class="more">+ ${e.length - 3} weitere</i>` : "");
      b.appendChild(box);
    }
  }

  /* ---------- Aktionen ---------- */
  ACT.pcgo = el => { if (shopMode) { shopMode = false; wakeLock(false); } const v = el.dataset.v; if (v === "kalender" && view !== "kalender") { calView = S.settings.calStart || "monat"; selDate = today(); calY = +selDate.slice(0, 4); calM = +selDate.slice(5, 7) - 1; } if (v === "todos") todoList = "todo"; view = v; q = ""; grpFilter = ""; closeAll(true); render(); };
  ACT.pcnew = () => { if (view === "akte") { personForm(null); return; } plusAction(); };
  ACT.pcsearch = () => { if (view === "menschen" || view === "akte") { const i = $("#q"); if (i) { i.focus(); i.select(); return; } } if (ACT.search) ACT.search(); };
  ACT.pcsort = el => { const k = el.dataset.k; if (sortK === k) sortDir = -sortDir; else { sortK = k; sortDir = 1; } render(true); };
  ACT.pcarch = () => { showArchRows = !showArchRows; sel.clear(); render(true); };
  ACT.pcselnone = () => { sel.clear(); render(true); };
  ACT.pcinstall = async () => { if (!installEvt) return; const e = installEvt; installEvt = null; try { e.prompt(); const r = await e.userChoice; if (r && r.outcome === "accepted") toast("Mirella ist jetzt als App auf dem PC"); } catch (_) { } navUpdate(); };
  ACT.pckeys = () => openSheet(`<p class="stitle">Tastenkürzel am PC</p>
    <div class="pckeys">${[["N", "Neu anlegen (auf Kontakte: neuer Kontakt)"], ["Strg + K  oder  /", "Suchen"], ["1  2  3  4", "Heute, Kontakte, To-dos, Kalender"], ["↑  ↓", "In der Kontakt-Tabelle von Zeile zu Zeile"], ["Enter", "Zeile oder Eintrag öffnen"], ["Strg + Enter", "Im offenen Fenster speichern"], ["Esc", "Fenster schließen"], ["?", "Diese Übersicht"]].map(([k, t]) => `<div class="pckey"><kbd>${k}</kbd><span>${t}</span></div>`).join("")}</div>
    <div class="hint">Diktieren geht auch am PC: links auf das Mikrofon klicken (Edge oder Chrome fragen einmal nach dem Mikrofon).</div>
    <div class="row2"><button class="btn" data-close="sheet">Schließen</button></div>`);

  /* Auswahl-Felder in der Tabelle: kein Öffnen der Akte beim Anklicken */
  window.addEventListener("click", e => { if (on && e.target.closest && e.target.closest(".pcin")) e.stopPropagation(); }, true);
  document.addEventListener("change", e => {
    const el = e.target; if (!on || !el.dataset || !el.dataset.pc) return;
    const k = el.dataset.pc;
    if (k === "grpf") { grpFilter = el.value; render(true); return; }
    if (k === "sel") { el.checked ? sel.add(el.dataset.id) : sel.delete(el.dataset.id); render(true); return; }
    if (k === "selall") { const l = rows(); if (el.checked) l.forEach(p => sel.add(p.id)); else l.forEach(p => sel.delete(p.id)); render(true); return; }
    const v = el.value; if (v === "__") return;
    if (el.classList.contains("bulk")) {
      const ps = S.people.filter(p => sel.has(p.id) && !(k === "cyc" && p.death)); if (!ps.length) return;
      const what = k === "group" ? (v ? "Gruppe „" + v + "“" : "keine Gruppe") : "Rhythmus „" + cycLabel(v) + "“";
      if (!ask(`${pl(ps.length, "Kontakt bekommt", "Kontakte bekommen")} ${what}. Einverstanden?`)) { el.value = "__"; return; }
      ps.forEach(p => { p[k] = v; }); save(); render(true); toast(`Gespeichert für ${pl(ps.length, "Kontakt", "Kontakte")}`); return;
    }
    const p = S.people.find(x => x.id === el.dataset.id); if (!p) return;
    p[k] = v; save(); render(true); toast(`Gespeichert: ${fullName(p)} · ${k === "group" ? (v || "keine Gruppe") : cycLabel(v)}`);
  });

  /* ---------- Tastatur ---------- */
  const typing = t => t && t.closest && t.closest("input,textarea,select,[contenteditable=true]");
  document.addEventListener("keydown", e => {
    if (!on) return;
    const sheetOpen = $("#sheet").classList.contains("open");
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && sheetOpen) { const b = [...$$("#sheetbody .btn.pri")].filter(x => x.offsetParent).pop(); if (b) { e.preventDefault(); b.click(); } return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); ACT.pcsearch(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target) || sheetOpen || document.querySelector(".pdfview,.zv,.imgfull")) return;
    const tr = e.target.closest && e.target.closest(".pctable tbody tr");
    if (tr && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); const n = e.key === "ArrowDown" ? tr.nextElementSibling : tr.previousElementSibling; if (n) n.focus(); return; }
    if (tr && e.key === "Enter") { e.preventDefault(); tr.click(); return; }
    if (e.key === "ArrowDown" && (view === "menschen" || view === "akte")) { const f = $(".pctable tbody tr"); if (f) { e.preventDefault(); f.focus(); } return; }
    if (e.key === "/") { e.preventDefault(); ACT.pcsearch(); return; }
    if (e.key === "n" || e.key === "N") { e.preventDefault(); ACT.pcnew(); return; }
    if (e.key === "?") { e.preventDefault(); ACT.pckeys(); return; }
    const nv = NAV.find(x => x[3] === e.key); if (nv) { e.preventDefault(); ACT.pcgo({ dataset: { v: nv[0] } }); }
  });
  /* Pfeil runter im Suchfeld springt in die Tabelle */
  document.addEventListener("keydown", e => { if (on && e.key === "ArrowDown" && e.target.id === "q") { const f = $(".pctable tbody tr"); if (f) { e.preventDefault(); f.focus(); } } });

  /* ---------- Einschalten / Ausschalten je nach Fenstergröße ---------- */
  const origRender = render;
  render = function () {
    const r = origRender.apply(this, arguments);
    if (on) { $("#screen").dataset.view = view; navUpdate(); if (view === "kalender" && calView === "monat") calTitles(); }
    return r;
  };
  function apply() {
    const want = !!(MQ && MQ.matches);
    if (want === on) return;
    on = want; root.classList.toggle("pc", on);
    if (on) { closeAll(); navUpdate(); }
    else { const n = document.getElementById("pcnav"); const mic = $("#mic"); const bar = $(".tabbar"); if (mic && bar) bar.insertBefore(mic, bar.children[2]); if (n) n.remove(); delete $("#screen").dataset.view; }
    if (typeof S !== "undefined" && S) render(true);
  }
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; if (on) navUpdate(); });
  window.addEventListener("appinstalled", () => { installEvt = null; if (on) navUpdate(); });
  if (MQ) { if (MQ.addEventListener) MQ.addEventListener("change", apply); else if (MQ.addListener) MQ.addListener(apply); }
  HOOKS.start.push(apply);
})();
