/* Mirella – ausführliche Wetterseite (Open-Meteo, Daten vom Deutschen Wetterdienst und anderen Wetterdiensten) */
let wxFrom = "heute";
const wxR = n => n == null ? "–" : Math.round(n) + "°";
const wxMm = n => (Math.round((n || 0) * 10) / 10).toString().replace(".", ",") + " mm";
const wxHour = s => +s.slice(11, 13);
const wxIcon = (code, day) => !day && code <= 1 ? "🌙" : !day && code === 2 ? "☁️" : WXC(code)[0];
const wxDir = d => d == null ? "" : ["Nord", "Nordost", "Ost", "Südost", "Süd", "Südwest", "West", "Nordwest"][Math.round(d / 45) % 8];
const wxDayWord = d => d === today() ? "heute" : d === addDays(today(), 1) ? "morgen" : WDL[D(d).getDay()];
function wxNowIso() { const n = new Date(); return `${today()}T${pad(n.getHours())}:00`; }

/* Ein Satz, wann es regnet: "Heute 17 bis 20 Uhr Regen, bis 70 %, etwa 2,1 mm." */
function wxRainText() {
  const hr = WX.hourly || {}, spans = L.rainSpans(hr, wxNowIso(), 24, 40), out = [];
  const m15 = WX.minutely_15 || {}, mt = m15.time || [], mp = m15.precipitation || [];
  const nowM = new Date(); const nowS = `${today()}T${pad(nowM.getHours())}:${pad(Math.floor(nowM.getMinutes() / 15) * 15)}`;
  const k0 = mt.findIndex(x => x >= nowS);
  if (k0 >= 0) {
    const next = mp.slice(k0, k0 + 8);
    if ((next[0] || 0) >= 0.1) {
      const dry = next.findIndex(v => (v || 0) < 0.1);
      out.push(dry > 0 ? `Es regnet gerade, etwa bis ${mt[k0 + dry].slice(11, 16)} Uhr.` : "Es regnet gerade und hört in den nächsten 2 Stunden wohl nicht auf.");
    } else {
      const wet = next.findIndex(v => (v || 0) >= 0.1);
      if (wet > 0) out.push(`Regen ab etwa ${mt[k0 + wet].slice(11, 16)} Uhr.`);
    }
  }
  if (!spans.length) out.push("Die nächsten 24 Stunden bleibt es trocken.");
  spans.slice(0, 3).forEach(s => {
    const d = s.from.slice(0, 10), h1 = wxHour(s.from), h2 = (wxHour(s.to) + 1) % 24;
    const when = h1 >= 20 || h1 < 5 ? (d === today() ? "Heute Nacht" : "In der Nacht") : (wxDayWord(d)[0].toUpperCase() + wxDayWord(d).slice(1));
    out.push(`${when} ${h1 === h2 - 1 ? "gegen " + h1 + " Uhr" : h1 + " bis " + h2 + " Uhr"} Regen, bis ${s.maxP} %${s.mm >= 0.1 ? ", etwa " + wxMm(s.mm) : ""}.`);
  });
  return out;
}

R.wetter = function () {
  const back = wxFrom === "drawer" ? subtop("Alle Bereiche", "drawer") : subtop("Heute", "wxback");
  if (!WX || !WX.cur) { loadWeather(true); return `${back}<p class="big" style="margin:0 0 4px">Wetter</p><div id="wx">${empty("Wetter wird geladen …")}</div>`; }
  const c = WX.cur, hr = WX.hourly || {}, dl = WX.daily || {}, t = hr.time || [];
  const nowH = new Date().getHours(), dn = L.wxDayNight(hr, today(), nowH), on = S.settings.wxHint || {};
  const hints = dn.hints.filter(h => on[h.k] === undefined || !!on[h.k]);
  const [, txt] = WXC(c.weather_code);
  const i0 = Math.max(0, t.findIndex(x => x >= wxNowIso()));
  // Stunde für Stunde, 24 Stunden
  const hours = [];
  for (let i = i0; i < Math.min(t.length, i0 + 24); i++) {
    const p = (hr.precipitation_probability || [])[i] || 0, mm = (hr.precipitation || [])[i] || 0, h = wxHour(t[i]);
    hours.push(`<div class="wxh${h === 0 ? " wxmid" : ""}"><span class="wxhh">${i === i0 ? "Jetzt" : h + " Uhr"}</span><span class="wxhi">${wxIcon((hr.weather_code || [])[i], (hr.is_day || [])[i] !== 0)}</span><b>${wxR((hr.temperature_2m || [])[i])}</b><span class="wxbar"><i style="height:${Math.max(3, p)}%"></i></span><span class="wxp${p >= 50 ? " hi" : ""}">${p} %</span><span class="wxmm">${mm >= 0.1 ? wxMm(mm) : ""}</span>${h === 0 ? `<span class="wxday">${esc(WD[D(t[i].slice(0, 10)).getDay()])}</span>` : ""}</div>`);
  }
  // 7 Tage
  const days = (dl.time || []).slice(0, 8);
  const lo = Math.min(...(dl.temperature_2m_min || [0]).slice(0, 8)), hi = Math.max(...(dl.temperature_2m_max || [0]).slice(0, 8)), span = Math.max(1, hi - lo);
  const dayRows = days.map((d, i) => {
    const mn = dl.temperature_2m_min[i], mx = dl.temperature_2m_max[i], p = (dl.precipitation_probability_max || [])[i] || 0, mm = (dl.precipitation_sum || [])[i] || 0;
    return `<div class="wxd"><span class="wxdn">${i === 0 ? "Heute" : i === 1 ? "Morgen" : WD[D(d).getDay()] + " " + +d.slice(8, 10) + "."}</span><span class="wxdi">${WXC((dl.weather_code || [])[i])[0]}</span><span class="wxdp${p >= 50 ? " hi" : ""}">💧 ${p} %${mm >= 0.1 ? `<small>${wxMm(mm)}</small>` : ""}</span><span class="wxdt"><span>${wxR(mn)}</span><span class="wxrange"><i style="left:${(mn - lo) / span * 100}%;right:${(hi - mx) / span * 100}%"></i></span><b>${wxR(mx)}</b></span></div>`;
  }).join("");
  const sr = (dl.sunrise || [])[0], ss = (dl.sunset || [])[0];
  const det = [
    ["Gefühlt", wxR(c.apparent_temperature)],
    ["Wind", c.wind_speed_10m != null ? `${Math.round(c.wind_speed_10m)} km/h${c.wind_direction_10m != null ? " aus " + wxDir(c.wind_direction_10m) : ""}` : "–", c.wind_gusts_10m != null ? `Böen bis ${Math.round(c.wind_gusts_10m)} km/h` : ""],
    ["Luftfeuchte", c.relative_humidity_2m != null ? c.relative_humidity_2m + " %" : "–"],
    ["UV heute", (dl.uv_index_max || [])[0] != null ? String(Math.round(dl.uv_index_max[0])) : "–", (dl.uv_index_max || [])[0] >= 3 ? "Sonnenschutz sinnvoll" : "gering"],
    ["Regen heute", wxMm((dl.precipitation_sum || [])[0]), (dl.precipitation_hours || [])[0] ? pl(Math.round(dl.precipitation_hours[0]), "Stunde", "Stunden") + " mit Regen" : ""],
    ["Sonne", sr ? `${sr.slice(11, 16)} bis ${ss.slice(11, 16)}` : "–", "Aufgang bis Untergang"]
  ].map(([k, v, s]) => `<div class="wxk"><span>${k}</span><b>${esc(v)}</b>${s ? `<small>${esc(s)}</small>` : ""}</div>`).join("");
  const stand = new Date(WX.t);
  return `${back}<p class="big" style="margin:0 0 4px">Wetter</p>
  <div class="wxhero"><div class="wxbig">${wxIcon(c.weather_code, c.is_day !== 0)}</div><div><div class="wxnow">${Math.round(c.temperature_2m)}°</div><div class="wxdesc">${esc(txt[0].toUpperCase() + txt.slice(1))}${WX.place ? " in " + esc(WX.place) : ""}</div><small>Heute ${wxR(dl.temperature_2m_min && dl.temperature_2m_min[0])} bis ${wxR(dl.temperature_2m_max && dl.temperature_2m_max[0])} · gefühlt ${wxR(c.apparent_temperature)}</small></div></div>
  <div class="sec"><span class="label">Regen</span></div>
  <div class="wxbox wxrain">${wxRainText().map(s => `<div>☂️ ${esc(s)}</div>`).join("")}</div>
  ${hints.length ? `<div class="sec"><span class="label">Hinweise für heute</span></div><div class="wxbox wxhints">${hints.map(h => `<div>${h.ic} ${esc(h.t)}</div>`).join("")}</div>` : ""}
  <div class="sec"><span class="label">Stunde für Stunde</span><span class="label">Regen in %</span></div>
  <div class="wxhours">${hours.join("")}</div>
  <div class="sec"><span class="label">Im Detail</span></div>
  <div class="wxgrid">${det}</div>
  <div class="sec"><span class="label">Die nächsten Tage</span></div>
  <div class="wxbox wxdays">${dayRows}</div>
  <p class="hint" style="text-align:center;margin-top:14px">Daten: Open-Meteo (u. a. Deutscher Wetterdienst) · Stand ${pad(stand.getHours())}:${pad(stand.getMinutes())} Uhr</p>
  <button class="btn" data-act="wxreload" style="width:100%">Aktualisieren</button>`;
};

Object.assign(ACT, {
  wetter: () => { closeAll(); wxFrom = "heute"; view = "wetter"; render(); },
  wxmore: () => ACT.wetter(),
  wxdrawer: () => { closeAll(); wxFrom = "drawer"; view = "wetter"; render(); },
  wxback: () => { view = "heute"; render(); },
  wxreload: () => { toast("Wetter wird aktualisiert …"); loadWeather(true); }
});
