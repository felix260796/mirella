/* Mirella – Datum eintippen statt im Kalender suchen.
   Jedes Datumsfeld (input type="date") bekommt ein Zifferneingabe-Feld davor: 12112026 wird zu 12.11.2026,
   die Punkte setzt Mirella selbst. Das eigentliche Datumsfeld bleibt unsichtbar dahinter und hält das Datum
   wie bisher als JJJJ-MM-TT, damit alle anderen Teile der App unverändert weiterarbeiten. */
(function () {
  const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  const iso2de = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ""); return m ? `${m[3]}.${m[2]}.${m[1]}` : ""; };
  /* Ziffern zu TT.MM.JJJJ; zweistellige Jahre werden 20xx */
  function fmt(raw) {
    const d = String(raw).replace(/\D/g, "").slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return d.slice(0, 2) + "." + d.slice(2);
    return d.slice(0, 2) + "." + d.slice(2, 4) + "." + d.slice(4);
  }
  function toIso(txt) {
    const m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(String(txt).trim()); if (!m) return null;
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3], mo = +m[2], da = +m[1];
    const dt = new Date(y, mo - 1, da);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== da) return null;
    return `${y}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`;
  }
  window.mirellaDateFmt = fmt; window.mirellaDateIso = toIso;
  function enhance(inp) {
    if (inp.dataset.dtype || inp.dataset.nodtype) return;
    inp.dataset.dtype = "1";
    const t = document.createElement("input");
    t.type = "text"; t.inputMode = "numeric"; t.autocomplete = "off"; t.placeholder = "TT.MM.JJJJ"; t.className = "dtype";
    t.id = inp.id ? inp.id + "-t" : ""; t.value = iso2de(desc.get.call(inp));
    if (inp.disabled) t.disabled = true;
    if (inp.id) document.querySelectorAll(`label[for="${CSS.escape(inp.id)}"]`).forEach(l => l.htmlFor = t.id);
    inp.hidden = true; inp.tabIndex = -1;
    inp.parentNode.insertBefore(t, inp);
    // setzt der Programmcode das Datum (z. B. aus einem gelesenen Brief), zeigt das Tippfeld es gleich mit an
    Object.defineProperty(inp, "value", { configurable: true, get() { return desc.get.call(this); }, set(v) { desc.set.call(this, v); t.value = iso2de(v); t.classList.remove("bad"); } });
    const push = iso => { if (desc.get.call(inp) === iso) return; desc.set.call(inp, iso); inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true })); };
    t.addEventListener("input", e => {
      const back = /^delete/.test(e.inputType || ""), n = t.value.replace(/\D/g, "").length;
      let f = fmt(t.value);
      if (!back && (n === 2 || n === 4)) f += "."; // Punkt gleich nach Tag und Monat setzen
      t.value = f;
      t.classList.remove("bad");
      if (!f) { push(""); return; }
      const iso = f.length === 10 ? toIso(f) : null;
      if (iso) push(iso);
    });
    t.addEventListener("blur", () => {
      const f = t.value.trim(); if (!f) { push(""); return; }
      const iso = toIso(f);
      if (iso) { t.value = iso2de(iso); push(iso); }
      else t.classList.add("bad");
    });
    t.addEventListener("focus", () => setTimeout(() => { try { t.select(); } catch (_) { } }, 0));
  }
  const scan = root => { if (root && root.querySelectorAll) root.querySelectorAll('input[type="date"]').forEach(enhance); };
  new MutationObserver(list => { for (const m of list) m.addedNodes.forEach(n => { if (n.nodeType !== 1) return; if (n.matches && n.matches('input[type="date"]')) enhance(n); else scan(n); }); })
    .observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => scan(document)); else scan(document);
})();
