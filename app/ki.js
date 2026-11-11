/* Mirella-KI: Claude versteht Gesprochenes genauer, denkt Folge-Erinnerungen mit und beantwortet freie Fragen.
   Der Schlüssel liegt nur auf diesem Gerät (nicht im Abgleich, nicht in der Sicherung, nicht im Code).
   Ohne Schlüssel bleibt alles wie bisher (eingebaute Regeln und Hilfe). */
"use strict";
const KIK = "mirella.ki";
let KI = { key: "", mode: "auto", usd: 0, n: 0 };
try { KI = Object.assign(KI, JSON.parse(localStorage.getItem(KIK) || "{}")); } catch (_) { }
const kiSave = () => { try { localStorage.setItem(KIK, JSON.stringify(KI)); } catch (_) { } };
const kiOn = () => !!KI.key;
/* Modellwahl: Sparsam = immer Haiku, Beste Qualität = immer Opus, Automatisch = Einfaches Haiku, Schwieriges Sonnet */
const KI_MODELS = { haiku: ["claude-haiku-5-5", 0.10, 0.50], sonnet: ["claude-sonnet-5-5", 2, 10], opus: ["claude-opus-5-5", 4, 20] };
const KI_MODES = [["sparsam", "Sparsam"], ["auto", "Automatisch"], ["beste", "Beste"]];
const kiPick = hard => KI.mode === "sparsam" ? "haiku" : KI.mode === "beste" ? "opus" : hard ? "sonnet" : "haiku";

async function kiCall({ system, user, hard, schema, maxTokens }) {
  if (!kiOn()) throw new Error("Kein Claude-Schlüssel eingetragen");
  const tier = kiPick(hard), [model, pin, pout] = KI_MODELS[tier];
  const headers = { "Content-Type": "application/json", "x-api-key": KI.key, "anthropic-version": "2026-10-21", "anthropic-dangerous-direct-browser-access": "true" };
  const body = { model, max_tokens: maxTokens || 4000, system, messages: [{ role: "user", content: user }], output_config: { effort: "low" } };
  if (schema) body.output_config.format = { type: "json_schema", schema };
  // Lehnt ein Sicherheitsfilter ab, übernimmt bei Sonnet/Opus automatisch ein Ausweichmodell (Haiku kennt das nicht)
  if (tier !== "haiku") { headers["anthropic-beta"] = "server-side-fallback-2026-07-01"; body.fallbacks = "default"; }
  let r;
  try { r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers, body: JSON.stringify(body) }); }
  catch (_) { throw new Error("Keine Verbindung zu Claude"); }
  let j = null; try { j = await r.json(); } catch (_) { }
  if (!r.ok) {
    const m = j && j.error && j.error.message || "";
    if (r.status === 401) throw new Error("Der Claude-Schlüssel ist ungültig");
    if (r.status === 429) throw new Error("Claude ist gerade ausgelastet, bitte gleich noch einmal");
    if (r.status === 400 && /credit|billing|balance/i.test(m)) throw new Error("Dein Claude-Guthaben ist aufgebraucht");
    if (r.status === 403) throw new Error("Der Claude-Schlüssel darf das nicht (Monatslimit erreicht?)");
    if (r.status >= 500) throw new Error("Claude ist gerade nicht erreichbar");
    throw new Error("Claude: " + (m || r.status));
  }
  const u = j.usage || {};
  KI.usd = (KI.usd || 0) + ((u.input_tokens || 0) * pin + (u.output_tokens || 0) * pout) / 1e6; KI.n = (KI.n || 0) + 1; kiSave();
  if (j.stop_reason === "refusal") throw new Error("Dazu kann Mirella nichts sagen");
  const text = (j.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
  if (!text) throw new Error(j.stop_reason === "max_tokens" ? "Die Antwort wurde zu lang" : "Claude hat nichts geantwortet");
  return text;
}

/* ---------- Gesprochenes verstehen ---------- */
const KI_ITEMS = {
  type: "object", additionalProperties: false, required: ["items"],
  properties: {
    items: {
      type: "array", items: {
        type: "object", additionalProperties: false, required: ["type", "t", "date", "time", "person", "ok", "amount", "shop", "cat", "vorschlag"],
        properties: {
          type: { type: "string", enum: ["todo", "shop", "note", "call", "expense"] },
          t: { type: "string" }, date: { type: "string" }, time: { type: "string" }, person: { type: "string" },
          ok: { type: "boolean" }, amount: { type: ["number", "null"] }, shop: { type: "string" }, cat: { type: "string" }, vorschlag: { type: "boolean" }
        }
      }
    }
  }
};
function kiNames(text) {
  // nur Kontakte mitschicken, deren Name im Text vorkommen könnte (spart Kosten, schützt Daten)
  const words = new Set(normName(text).split(" ").filter(w => w.length > 1));
  const hit = w => words.has(w) || (w.length > 2 && words.has(w + "s"));
  return S.people.filter(p => !p.arch && normName(fullName(p) + " " + (p.nick || "")).split(" ").some(hit)).slice(0, 60);
}
async function kiUnderstand(text) {
  const cand = kiNames(text), d = new Date();
  const system = `Du bist Mirella, die persönliche Assistentin von ${S.settings.name || "Felix"}. Du bekommst einen gesprochenen oder getippten Satz auf Deutsch und zerlegst ihn in Einträge für die App. Es wird nichts gespeichert, bevor der Nutzer deine Einträge bestätigt hat.

Arten von Einträgen:
- todo: Aufgabe oder Erinnerung. "t" ist ein kurzer Text ohne "erinnere mich". "date" als JJJJ-MM-TT, "time" als HH:MM, beides leer, wenn nichts gesagt wurde.
- shop: ein Artikel für die Einkaufsliste, ein Eintrag je Artikel, Menge im Text lassen (z. B. "2 Liter Milch").
- note: Notiz zu einer Person. "person" ist der Name genau wie in der Kontaktliste unten.
- call: Der Nutzer hat mit einer Person telefoniert ("ok" true) oder sie nicht erreicht ("ok" false). "person" wie in der Kontaktliste.
- expense: Ausgabe. "amount" in Euro als Zahl, "shop" das Geschäft, "cat" eine dieser Kategorien: ${catList().join(", ")}.

Mitdenken: Ergibt sich aus dem Gesagten etwas, woran ein aufmerksamer Mensch später denken würde, schlage dafür zusätzliche todo-Einträge vor und setze bei ihnen "vorschlag" auf true. Beispiel: "Tim fliegt am Freitag nach China" ergibt eine Notiz zu Tim und die Vorschläge "Tim gute Reise wünschen" am Donnerstag und "Tim fragen, wie China war" etwa eine Woche nach der Rückkehr. Höchstens zwei Vorschläge, nur wenn sie wirklich naheliegen. Bei reinen Einkäufen, Ausgaben oder klaren Aufgaben keine Vorschläge.

Felder, die nicht zur Art passen, bleiben leer ("" bzw. null, "ok" true, "vorschlag" false). Erfinde keine Personen: steht jemand nicht in der Kontaktliste, wird es eine Aufgabe mit dem Namen im Text.

Heute ist ${WDL[d.getDay()]}, der ${today()}, es ist ${pad(d.getHours())}:${pad(d.getMinutes())} Uhr.
Kontakte, die gemeint sein könnten: ${cand.length ? cand.map(p => fullName(p) + (p.nick ? " (Spitzname " + p.nick + ")" : "")).join("; ") : "keine passenden gefunden"}.`;
  const raw = await kiCall({ system, user: text, hard: false, schema: KI_ITEMS, maxTokens: 3000 });
  const out = [];
  for (const it of (JSON.parse(raw).items || [])) {
    const p = it.person ? cand.find(x => normName(fullName(x)) === normName(it.person)) || (findPersonsIn(it.person.toLowerCase())[0] || {}).p : null;
    if (it.type === "shop" && it.t) out.push({ type: "shop", t: it.t });
    else if (it.type === "expense") out.push({ type: "expense", amount: typeof it.amount === "number" ? it.amount : null, shop: it.shop || "", cat: catList().includes(it.cat) ? it.cat : "Sonstiges", t: it.t || it.shop || "" });
    else if (it.type === "call" && p) out.push({ type: "call", pid: p.id, ok: it.ok !== false, t: it.ok === false ? "nicht erreicht" : "erreicht" });
    else if (it.type === "note" && p && it.t) out.push({ type: "note", pid: p.id, t: it.t });
    else if (it.t) out.push({ type: "todo", t: (it.vorschlag ? "Vorschlag: " : "") + it.t, date: /^\d{4}-\d\d-\d\d$/.test(it.date) ? it.date : "", time: /^\d\d:\d\d$/.test(it.time) ? it.time : "", trig: "", pid: p ? p.id : "" });
  }
  return out;
}
const kiOrigReview = voiceReview;
voiceReview = async function () {
  const txt = ($("#v-text") && $("#v-text").value || "").trim();
  if (!kiOn() || !txt || /^(ich bin|bin) (heute |jetzt |leider )*(krank|erkältet|krankgeschrieben)\b/i.test(txt)) return kiOrigReview();
  recStop(); toast("Mirella denkt nach …");
  try {
    const items = await kiUnderstand(txt);
    if (!items.length) return kiOrigReview();
    pending = items; reviewRender(txt);
  } catch (e) { toast((e && e.message || "Claude nicht erreichbar") + ". Ich nehme die eingebauten Regeln."); kiOrigReview(); }
};

/* ---------- Freie Fragen ---------- */
function kiContext(q) {
  const t = today(), ev = eventsRange(t, addDays(t, 14), true);
  const tage = Object.keys(ev).sort().map(k => k + ": " + ev[k].map(e => (e.time ? e.time + " " : "") + e.k + " " + e.t).join(" | ")).join("\n");
  const offen = S.todos.filter(x => x.list === "todo" && !x.done).slice(0, 60).map(x => "- " + x.t + (x.date ? " (" + x.date + (x.time ? " " + x.time : "") + ")" : "")).join("\n");
  const einkauf = S.todos.filter(x => x.list === "einkauf" && !x.done).map(x => x.t).join(", ");
  const leute = [...new Set([...findPersonsIn(q.toLowerCase()).map(x => x.p), ...kiNames(q)])].slice(0, 8).map(p => `${fullName(p)}: ${[p.group, p.tel, p.bday && !p.bday.startsWith("1604") ? "geboren " + p.bday : p.bday ? "Geburtstag " + p.bday.slice(5) : "", p.cyc ? "Rhythmus " + p.cyc : "", (p.calls || []).length ? "letzter Anruf " + p.calls.map(c => c.d).sort().pop() : "", (p.notes || []).slice(0, 5).map(n => n.d + " " + n.t).join(" / "), (p.gifts || []).length ? "Geschenkideen: " + p.gifts.map(g => g.t || g).join(", ") : ""].filter(Boolean).join("; ")}`).join("\n");
  return `Heute: ${t}\n\nNächste 14 Tage:\n${tage || "nichts"}\n\nOffene Aufgaben:\n${offen || "keine"}\n\nEinkaufsliste: ${einkauf || "leer"}\n\nKontakte, um die es gehen könnte:\n${leute || "keine erkannt"}\n\nSo funktioniert die App (Hilfe):\n${HELP.map(h => "F: " + h.q + "\nA: " + h.a).join("\n")}`;
}
async function kiAsk(q) {
  const system = `Du bist Mirella, die persönliche Assistentin von ${S.settings.name || "Felix"} in seiner gleichnamigen App (Kontaktpflege, Aufgaben, Einkauf, Kalender, Finanzen, Verträge). Antworte auf Deutsch, in du-Form, freundlich und knapp: meist zwei bis fünf Sätze in normalem Fließtext, ohne Markdown-Zeichen, weil die App die Antwort als reinen Text anzeigt. Stütze dich auf die mitgeschickten Daten. Steht etwas nicht darin, sag das offen, statt zu raten. Du kannst in dieser Antwort nichts in der App ändern. Wenn der Nutzer etwas eintragen will, erkläre kurz, wie er es sagt oder antippt.`;
  return kiCall({ system, user: `${kiContext(q)}\n\nFrage: ${q}`, hard: true, maxTokens: 4000 });
}
ACT.kiask = async el => {
  const q = (el.dataset.q || ($("#sq") && $("#sq").value) || "").trim(); if (!q) return;
  openSheet(`<p class="stitle">${esc(q)}</p><p id="ki-a" style="font-size:16px;line-height:1.55;margin:0 0 12px;white-space:pre-wrap">Mirella denkt nach …</p><div class="row2"><button class="btn" data-act="search">Weitere Fragen</button><button class="btn" data-close="sheet">Schließen</button></div>`);
  let a; try { a = await kiAsk(q); } catch (e) { a = (e && e.message || "Das hat nicht geklappt") + "."; }
  const box = $("#ki-a"); if (box) box.textContent = a;
};
const kiOrigShow = searchShow;
searchShow = function (q) {
  kiOrigShow(q);
  const box = $("#sres"); if (!box || !kiOn() || q.trim().length < 4) return;
  box.insertAdjacentHTML("afterbegin", `<button class="prow" data-act="kiask" data-q="${esc(q.trim())}"><span class="pic">✦</span><span><b>Mirella fragen</b><small>„${esc(q.trim().slice(0, 60))}“ mit Claude beantworten</small></span><span class="chev">›</span></button>`);
};

/* ---------- Einstellungen › Mirella-KI ---------- */
SETNAMES.ki = "Mirella-KI";
SETS.ki = () => `<p class="hint" style="margin-top:0">Mit deinem Claude-Schlüssel versteht Mirella Gesprochenes genauer, schlägt Folge-Erinnerungen vor und beantwortet freie Fragen (Lupe › „Mirella fragen“). Der Schlüssel bleibt nur auf diesem Gerät. Ohne Schlüssel arbeitet Mirella mit den eingebauten Regeln.</p>
  <div class="fld"><label for="ki-key">Claude-Schlüssel${kiOn() ? " (eingetragen)" : ""}</label><input id="ki-key" type="password" autocomplete="off" placeholder="${kiOn() ? "•••••••• neu eingeben zum Ändern" : "sk-ant-…"}"></div>
  <div class="row2"><button class="btn pri" data-act="kisave">Speichern</button>${kiOn() ? '<button class="btn" data-act="kidel">Entfernen</button>' : ""}</div>
  ${setH("Modell")}<div class="seg">${KI_MODES.map(([v, l]) => `<button data-act="kimode" data-m="${v}" aria-pressed="${KI.mode === v}">${l}</button>`).join("")}</div>
  <p class="hint">${KI.mode === "sparsam" ? "Immer das günstigste Modell (Haiku)." : KI.mode === "beste" ? "Immer das stärkste Modell (Opus). Kostet am meisten." : "Einfaches wie Einkaufsliste und Erinnerungen mit Haiku, freie Fragen mit Sonnet."}</p>
  ${kiOn() ? `<p class="hint">Bisher auf diesem Gerät: ${KI.n || 0} Anfragen, ungefähr ${(KI.usd || 0).toFixed(KI.usd < 0.1 ? 3 : 2).replace(".", ",")} $. Die genaue Abrechnung steht in der Claude Console.</p>` : ""}`;
ACT.kisave = async () => {
  const v = ($("#ki-key").value || "").trim(); if (!v && !kiOn()) { toast("Bitte den Schlüssel einfügen"); return; }
  const old = KI.key; if (v) KI.key = v;
  toast("Teste den Schlüssel …");
  try { await kiCall({ system: "Antworte nur mit dem Wort: bereit", user: "Test", hard: false, maxTokens: 500 }); kiSave(); render(true); toast("Mirella-KI ist bereit"); }
  catch (e) { KI.key = old; toast(e && e.message || "Der Test hat nicht geklappt"); }
};
ACT.kidel = () => { if (!ask("Claude-Schlüssel von diesem Gerät entfernen?")) return; KI.key = ""; kiSave(); render(true); toast("Schlüssel entfernt"); };
ACT.kimode = el => { KI.mode = el.dataset.m; kiSave(); render(true); };
const kiOrigEinst = R.einstellungen;
R.einstellungen = function () {
  const h = kiOrigEinst.call(this); if (setSec) return h;
  const row = `<button class="drow" data-act="setsec" data-k="ki"><span class="setic">✦</span><span class="dt"><b>Mirella-KI</b><small>${kiOn() ? "Claude ist eingerichtet" : "Claude-Schlüssel eintragen"}</small></span><span class="chev">›</span></button>`;
  const mark = '<div class="sethead2">Mirella</div>', i = h.indexOf(mark); return i < 0 ? h + row : h.slice(0, i + mark.length) + row + h.slice(i + mark.length);
};
