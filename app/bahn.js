/* Mirella – Bahn: Abfahrten mit Verspätung und Gleis über die Schnittstelle „Timetables“ der Deutschen Bahn.
   Felix trägt Client ID und API Key einmal ein (bleiben nur auf dem Gerät, nicht im Abgleich, nicht in Sicherungen).
   Seine Bahnhöfe stehen in S.settings.bahnSt = [{ eva, name, dir }] (dir = nur Züge, die über diesen Ort fahren). */
const DB_BASE = "https://apis.deutschebahn.com/db-api-marketplace/apis/timetables/v1";
const bahnOn = () => !!(S.settings.dbClientId && S.settings.dbApiKey);
const BAHN = { cache: {}, err: "" };

/* Anfrage: in der iPhone-App über die eingebaute native Verbindung (die Bahn erlaubt keine Browser-Anfragen), sonst fetch */
async function dbGet(path) {
  const headers = { "DB-Client-Id": S.settings.dbClientId || "", "DB-Api-Key": S.settings.dbApiKey || "", "Accept": "application/xml" };
  const url = DB_BASE + path;
  let status = 0, text = "";
  const H = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.CapacitorHttp;
  if (typeof NATIVE !== "undefined" && NATIVE && H) {
    const r = await H.request({ url, method: "GET", headers, responseType: "text" });
    status = r.status; text = typeof r.data === "string" ? r.data : JSON.stringify(r.data || "");
  } else {
    const r = await fetch(url, { headers }); status = r.status; text = await r.text();
  }
  if (status === 401 || status === 403) { keyBad("db", S.settings.dbApiKey, true); throw new Error("Die Bahn lehnt Client ID oder API Key ab. Bitte unter Einstellungen › Bahn prüfen."); }
  if (status === 404) return "";
  if (status === 429) throw new Error("Zu viele Abfragen bei der Bahn. Bitte in einer Minute noch einmal.");
  if (status < 200 || status >= 300) throw new Error("Die Bahn antwortet gerade nicht (" + status + ")");
  keyBad("db", S.settings.dbApiKey, false);
  return text;
}
const dbXml = t => new DOMParser().parseFromString(t || "<x/>", "application/xml");
/* „2611121405“ (JJMMTTHHMM) in Date */
const dbTime = s => s && s.length >= 10 ? new Date(2000 + +s.slice(0, 2), +s.slice(2, 4) - 1, +s.slice(4, 6), +s.slice(6, 8), +s.slice(8, 10)) : null;
const hm2 = d => d ? L.pad(d.getHours()) + ":" + L.pad(d.getMinutes()) : "";

async function bahnSearch(q) {
  const x = dbXml(await dbGet("/station/" + encodeURIComponent(q)));
  return [...x.getElementsByTagName("station")].map(s => ({ eva: s.getAttribute("eva"), name: s.getAttribute("name") })).filter(s => s.eva && s.name).slice(0, 8);
}

/* Abfahrten der nächsten rund 90 Minuten, mit allen bekannten Änderungen (Verspätung, Gleiswechsel, Ausfall) */
async function bahnBoard(st, force) {
  const c = BAHN.cache[st.eva];
  if (!force && c && Date.now() - c.at < 60e3) return c.list;
  const now = new Date(), hrs = [0, 1].map(i => new Date(+now + i * 3600e3));
  const ymd = d => String(d.getFullYear()).slice(2) + L.pad(d.getMonth() + 1) + L.pad(d.getDate());
  const plans = await Promise.all(hrs.map(d => dbGet(`/plan/${st.eva}/${ymd(d)}/${L.pad(d.getHours())}`).catch(e => { if (/lehnt/.test(e.message)) throw e; return ""; })));
  let chg = ""; try { chg = await dbGet(`/fchg/${st.eva}`); } catch (e) { if (/lehnt/.test(e.message)) throw e; }
  const ch = {};
  for (const s of dbXml(chg).getElementsByTagName("s")) { const dp = s.getElementsByTagName("dp")[0]; if (dp) ch[s.getAttribute("id")] = dp; }
  const list = [];
  for (const p of plans) for (const s of dbXml(p).getElementsByTagName("s")) {
    const dp = s.getElementsByTagName("dp")[0], tl = s.getElementsByTagName("tl")[0]; if (!dp || !tl) continue;
    const c2 = ch[s.getAttribute("id")], pt = dbTime(dp.getAttribute("pt")), ct = c2 && dbTime(c2.getAttribute("ct")) || pt;
    const path = ((c2 && c2.getAttribute("cpth")) || dp.getAttribute("ppth") || "").split("|").filter(Boolean);
    const cat = tl.getAttribute("c") || "", line = dp.getAttribute("l");
    list.push({
      id: s.getAttribute("id"), pt, ct, delay: pt && ct ? Math.round((ct - pt) / 60e3) : 0,
      gl: dp.getAttribute("pp") || "", gln: (c2 && c2.getAttribute("cp")) || "",
      zug: line ? (/^\d/.test(line) ? cat + line : line) : (cat + " " + (tl.getAttribute("n") || "")).trim(),
      ziel: path[path.length - 1] || "", path, aus: !!(c2 && c2.getAttribute("cs") === "c")
    });
  }
  const from = Date.now() - 2 * 60e3, dir = String(st.dir || "").toLowerCase();
  const out = list.filter(x => x.ct && +x.ct >= from && +x.ct <= Date.now() + 100 * 60e3 && (!dir || x.path.some(p => p.toLowerCase().includes(dir))))
    .sort((a, b) => a.ct - b.ct);
  BAHN.cache[st.eva] = { at: Date.now(), list: out };
  return out;
}

function bahnRows(list) {
  if (!list.length) return `<p class="hint" style="margin:4px 0 0">In den nächsten 90 Minuten keine Abfahrt${list.dir ? " in diese Richtung" : ""}.</p>`;
  return list.slice(0, 8).map(x => `<div class="bzug${x.aus ? " aus" : ""}"><span class="bzt"><b>${hm2(x.pt)}</b>${x.aus ? '<small class="late">fällt aus</small>' : x.delay > 0 ? `<small class="${x.delay >= 5 ? "late" : "warn"}">+${x.delay} · ${hm2(x.ct)}</small>` : '<small class="ok">pünktlich</small>'}</span><span class="bzl">${esc(x.zug)}</span><span class="bzz">${esc(x.ziel)}</span><span class="bzg${x.gln && x.gln !== x.gl ? " neu" : ""}">${x.gl || x.gln ? "Gl. " + esc(x.gln || x.gl) : ""}</span></div>`).join("");
}

let bahnFrom = "drawer";
R.bahn = function () {
  const back = subtop(bahnFrom === "heute" ? "Heute" : "Alle Bereiche", bahnFrom === "heute" ? "bahnback" : "drawer", `<button class="mini" data-act="bahnset">Einstellen</button>`);
  if (!bahnOn()) return `${back}<p class="big">Bahn</p>${empty("Für Abfahrten mit Verspätung und Gleis braucht Mirella deine Zugangsdaten der Bahn (Client ID und API Key aus dem DB API Marketplace, Schnittstelle „Timetables“).")}<button class="btn pri" data-act="bahnset" style="width:100%">Zugangsdaten eintragen</button>`;
  const st = S.settings.bahnSt || [];
  if (!st.length) return `${back}<p class="big">Bahn</p>${empty("Noch kein Bahnhof gespeichert.")}<button class="btn pri" data-act="bahnset" style="width:100%">Bahnhof hinzufügen</button>`;
  setTimeout(bahnLoad, 0);
  return `${back}<p class="big" style="margin-bottom:4px">Bahn</p><p class="hint" style="margin-top:0">Abfahrten der nächsten 90 Minuten mit Verspätung und Gleis. <button class="mini" data-act="bahnreload">Neu laden</button></p>
  ${st.map(s => `<div class="card bst"><div class="bsth">${esc(s.name)}${s.dir ? ` <small>Richtung ${esc(s.dir)}</small>` : ""}</div><div id="bst-${esc(s.eva)}">${BAHN.cache[s.eva] ? bahnRows(BAHN.cache[s.eva].list) : '<p class="hint">Lädt …</p>'}</div></div>`).join("")}
  ${BAHN.err ? `<p class="fwarn">${esc(BAHN.err)}</p>` : ""}`;
};
async function bahnLoad(force) {
  BAHN.err = "";
  for (const s of S.settings.bahnSt || []) {
    const box = document.getElementById("bst-" + s.eva);
    try { const l = await bahnBoard(s, force); l.dir = s.dir; if (box) box.innerHTML = bahnRows(l); }
    catch (e) { if (box) box.innerHTML = `<p class="fwarn">${esc(e.message || "Klappt gerade nicht")}</p>`; if (/lehnt/.test(e.message || "")) break; }
  }
}

/* Einstellungen › Bahn */
SETNAMES.bahn = "Bahn";
SETS.bahn = () => {
  const s = S.settings, st = s.bahnSt || [];
  return `${setH("Zugang Deutsche Bahn")}
  ${keyField("set-dbid", "Client ID", { set: "dbClientId", value: s.dbClientId || "", ph: "Client ID einfügen" })}
  ${keyField("set-dbkey", "API Key", { set: "dbApiKey", value: s.dbApiKey || "", ph: "API Key einfügen", warn: keyIsBad("db", s.dbApiKey) ? "Die Bahn lehnt diesen Zugang ab. Bitte Client ID und API Key prüfen." : "" })}
  <p class="hint">Beides findest du im DB API Marketplace unter Anwendungen › Mirella. Die Anwendung muss „Timetables“ abonniert haben. Die Werte bleiben nur auf diesem Gerät.</p>
  <p class="hint">Damit zeigt der Wecker nach Ankunftszeit (Weg „Bahn und Bus“) für deine Züge Verspätung, Gleis und Ausfälle. Die Verbindung selbst sucht Mirella über Google Maps.</p>`;
};
Object.assign(ACT, {
  bahndrawer: () => { closeAll(); bahnFrom = "drawer"; view = "bahn"; render(); },
  bahnheute: () => { bahnFrom = "heute"; view = "bahn"; render(); },
  bahnback: () => { view = "heute"; render(); },
  bahnset: () => { setFrom = { v: "bahn", area, cur, t: "Bahn", y: 0 }; view = "einstellungen"; setSec = "bahn"; render(); },
  bahnreload: () => { bahnLoad(true); toast("Lädt neu …"); },
  bahnadd: el => {
    const st = S.settings.bahnSt = S.settings.bahnSt || [];
    if (!st.some(x => x.eva === el.dataset.eva)) st.push({ eva: el.dataset.eva, name: el.dataset.name, dir: "" });
    save(); render(true); toast(el.dataset.name + " gespeichert");
  },
  bahndel: el => { const st = S.settings.bahnSt || [], x = st[+el.dataset.i]; if (!x || !ask(`${x.name} aus deinen Bahnhöfen entfernen?`)) return; st.splice(+el.dataset.i, 1); save(); render(true); },
  bahndir: el => { const x = (S.settings.bahnSt || [])[+el.dataset.i]; if (!x) return; const v = prompt("Nur Züge, die über diesen Halt fahren (leer = alle):", x.dir || ""); if (v === null) return; x.dir = v.trim(); delete BAHN.cache[x.eva]; save(); render(true); }
});
document.addEventListener("submit", async e => {
  if (!e.target.matches || !e.target.matches('[data-form="bahnq"]')) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const q = ($("#bahn-q").value || "").trim(), box = $("#bahn-res"); if (!q || !box) return;
  if (!bahnOn()) { box.innerHTML = '<p class="fwarn">Bitte zuerst Client ID und API Key eintragen.</p>'; return; }
  box.innerHTML = '<p class="hint">Sucht …</p>';
  try { const r = await bahnSearch(q); box.innerHTML = r.length ? r.map(s => `<button class="drow" data-act="bahnadd" data-eva="${esc(s.eva)}" data-name="${esc(s.name)}"><span class="dt"><b>${esc(s.name)}</b><small>antippen zum Speichern</small></span><span class="chev">+</span></button>`).join("") : '<p class="hint">Nichts gefunden. Anders schreiben, zum Beispiel „Stuttgart Hbf“.</p>'; }
  catch (err) { box.innerHTML = `<p class="fwarn">${esc(err.message || "Klappt gerade nicht")}</p>`; }
}, true);

/* Einträge im Menü und in den Einstellungen */
/* Kein eigener Menüpunkt mehr (Wunsch Felix): die Bahn-Daten fließen in den Wecker nach Ankunftszeit. */
const BAHN_IC = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 10h14"/><circle cx="9" cy="13.5" r=".8"/><circle cx="15" cy="13.5" r=".8"/><path d="m8 21 2-4M16 21l-2-4"/></svg>';
const bahnOrigEinst = R.einstellungen;
R.einstellungen = function () {
  const h = bahnOrigEinst.call(this); if (setSec) return h;
  const row = `<button class="drow" data-act="setsec" data-k="bahn"><span class="setic">${BAHN_IC}</span><span class="dt"><b>Bahn</b><small>${bahnOn() ? "Zugang eingetragen" : "Client ID und API Key eintragen"}</small></span><span class="chev">›</span></button>`;
  const mark = '<div class="sethead2">Mirella</div>', i = h.indexOf(mark); return i < 0 ? h + row : h.slice(0, i) + row + h.slice(i);
};

/* Wecker mit Bahn: für die Züge der Verbindung Verspätung, Gleis und Ausfall nachsehen (nur für die nächsten rund 90 Minuten bekannt) */
const bahnNorm = z => String(z || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
async function bahnLive(parts) {
  if (!bahnOn() || !parts) return;
  const stops = {};
  for (const x of parts) {
    if (!x.linie || !x.ab || !x.von) continue;
    const dep = new Date(); const [h, m] = x.ab.split(":").map(Number); dep.setHours(h, m, 0, 0);
    if (+dep < Date.now() - 5 * 60e3 || +dep > Date.now() + 95 * 60e3) continue;
    try {
      const key = x.von.toLowerCase();
      if (!stops[key]) stops[key] = (await bahnSearch(x.von.replace(/\s*\(.*\)\s*/g, " ").trim()))[0] || null;
      const st = stops[key]; if (!st) continue;
      const list = await bahnBoard({ eva: st.eva }, true);
      const want = bahnNorm(x.linie);
      const hit = list.find(z => hm2(z.pt) === x.ab && (bahnNorm(z.zug) === want || bahnNorm(z.zug).endsWith(want) || want.endsWith(bahnNorm(z.zug)))) || list.find(z => hm2(z.pt) === x.ab);
      if (!hit) continue;
      x.delay = hit.delay; x.gl = hit.gln || hit.gl; x.glNeu = !!hit.gln; x.aus = hit.aus; x.liveAt = Date.now();
    } catch (e) { if (/lehnt/.test(e.message || "")) return; }
  }
}
