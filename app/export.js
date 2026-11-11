/* Mirella: Komplett-Sicherung für den PC
   Ein ZIP mit: Mirella_Daten.xlsx (alle Kontakte, Aufgaben, Einkauf, Bereiche, Ausgaben, Dokumente),
   allen PDFs und Fotos sauber benannt in Ordnern, der Wiederherstellungs-Datei (JSON) und einer Anleitung.
   Läuft komplett auf dem Gerät, ohne Server. ZIP und XLSX werden hier selbst gebaut (keine Bibliothek). */
const ZX = (() => {
  const enc = new TextEncoder();
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  const toU8 = d => typeof d === "string" ? enc.encode(d) : d instanceof Uint8Array ? d : new Uint8Array(d);
  function dosTime(dt) { return { t: (dt.getHours() << 11) | (dt.getMinutes() << 5) | (dt.getSeconds() >> 1), d: ((dt.getFullYear() - 1980) << 9) | ((dt.getMonth() + 1) << 5) | dt.getDate() }; }

  /* files: [{ name, data: string|Uint8Array }] -> Uint8Array (ZIP, ungepackt „stored“) */
  function zip(files, when = new Date()) {
    const parts = [], central = []; let off = 0; const { t, d } = dosTime(when);
    for (const f of files) {
      const name = enc.encode(f.name), data = toU8(f.data), crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, t, true); lh.setUint16(12, d, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, t, true); ch.setUint16(14, d, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), name);
      off += 30 + name.length + data.length;
    }
    const cSize = central.reduce((a, b) => a + b.length, 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cSize, true); end.setUint32(16, off, true);
    const all = [...parts, ...central, new Uint8Array(end.buffer)], out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
    let p = 0; for (const a of all) { out.set(a, p); p += a.length; } return out;
  }

  /* sheets: [{ name, rows: [[...]] }] (erste Zeile = Überschrift) -> Uint8Array (.xlsx) */
  const xe = v => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  const col = i => { let s = ""; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  function sheetXML(rows) {
    const w = []; rows.forEach(r => r.forEach((v, i) => { const l = Math.min(60, String(v == null ? "" : v).split("\n")[0].length + 2); w[i] = Math.max(w[i] || 8, l); }));
    const cols = w.length ? `<cols>${w.map((x, i) => `<col min="${i + 1}" max="${i + 1}" width="${x}" customWidth="1"/>`).join("")}</cols>` : "";
    const body = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
      const ref = col(ci) + (ri + 1), st = ri === 0 ? ' s="1"' : "";
      if (typeof v === "number" && isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${xe(v)}</t></is></c>`;
    }).join("")}</row>`).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${body}</sheetData>${rows.length > 1 && rows[0].length ? `<autoFilter ref="A1:${col(rows[0].length - 1)}${rows.length}"/>` : ""}</worksheet>`;
  }
  function xlsx(sheets) {
    const safe = sheets.map((s, i) => ({ ...s, name: xe(String(s.name).replace(/[\\/?*[\]:]/g, " ").slice(0, 31)) || "Blatt" + (i + 1) }));
    const files = [
      { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${safe.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>` },
      { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${safe.map((s, i) => `<sheet name="${s.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>` },
      { name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${safe.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${safe.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: "xl/styles.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFEFEA"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
      ...safe.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXML(s.rows) }))
    ];
    return zip(files);
  }
  /* Dateinamen für Windows sauber machen */
  const fname = s => String(s || "").replace(/[\\/:*?"<>|\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "").slice(0, 90) || "Ohne Namen";
  return { crc32, zip, xlsx, sheetXML, fname };
})();
if (typeof module !== "undefined" && module.exports) module.exports = ZX;

/* ---------- In der App: Daten zusammenstellen ---------- */
if (typeof window !== "undefined") {
  const de = s => s ? (/^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(8, 10) + "." + s.slice(5, 7) + "." + (s.startsWith("1604") ? "" : s.slice(0, 4)) : s) : "";
  const extOf = (b, d) => /pdf/.test((b && b.type) || d.type || "") ? "pdf" : /png/.test((b && b.type) || "") ? "png" : "jpg";
  function itemFields(it) {
    const K = typeof KINDS !== "undefined" && KINDS[it.kind]; if (!K) return "";
    return K.fields.filter(f => it[f.k] !== "" && it[f.k] != null && it[f.k] !== false && f.k !== "name").map(f => {
      let v = it[f.k]; if (f.t === "sel" && f.o) v = (f.o.find(o => String(o[0]) === String(v)) || [0, v])[1]; if (f.t === "date") v = de(v); if (f.t === "chk") v = "ja"; if (f.t === "ref") { const x = S.items.find(y => y.id === v); v = x ? kindTitle(x.kind, x) : ""; }
      return `${f.l}: ${v}`;
    }).join("\n");
  }
  function ownerOf(ref) {
    if (!ref) return "";
    const it = S.items.find(x => x.id === ref); if (it) return kindTitle(it.kind, it);
    const t = S.todos.find(x => x.id === ref); if (t) return "Aufgabe: " + t.t;
    return "";
  }
  async function buildBackup(progress) {
    const files = [], used = new Set(), docRows = [["Dokument", "Bereich", "Ordner", "gehört zu", "abgelegt am", "gültig bis / Frist", "Datei in der Sicherung"]];
    const uniq = n => { let x = n, i = 2; while (used.has(x.toLowerCase())) x = n.replace(/(\.[a-z0-9]+)$/i, ` (${i++})$1`); used.add(x.toLowerCase()); return x; };
    let i = 0;
    for (const d of S.docs) {
      progress && progress(`Dokumente ${++i}/${S.docs.length} …`);
      const A = areaById(d.area) || { n: "Allgemein" }, b = d.photo ? await photoGet(d.photo).catch(() => null) : null;
      let path = "";
      if (b) { const buf = new Uint8Array(await b.arrayBuffer()); path = uniq(`Dokumente/${ZX.fname(A.id === "doku" ? "Allgemein" : A.n)}/${ZX.fname(d.folder || "Sonstiges")}/${(d.created || today())} ${ZX.fname(d.name)}.${extOf(b, d)}`); files.push({ name: path, data: buf }); }
      docRows.push([d.name, A.id === "doku" ? "Allgemein" : A.n, d.folder || "", ownerOf(d.ref), de(d.created), de(d.until), path || "(Datei nicht auf diesem Gerät)"]);
    }
    // Belege zu Ausgaben
    for (const e of S.expenses) if (e.photo) { const b = await photoGet(e.photo).catch(() => null); if (b) { const p = uniq(`Belege/${e.d} ${ZX.fname(e.shop || "Beleg")} ${String(e.amount).replace(".", ",")} EUR.${extOf(b, {})}`); files.push({ name: p, data: new Uint8Array(await b.arrayBuffer()) }); e._file = p; } }
    progress && progress("Excel wird erstellt …");
    const kontakte = [["Vorname", "Nachname", "Spitzname", "Gruppe", "Telefon", "E-Mail", "Adresse", "Geburtstag", "Alter", "Anrufen", "zuletzt erreicht", "nächster Anruf", "Anrufe gesamt", "Anrufverlauf", "Offene Nachfragen", "Geschenk-Erinnerung", "Archiv"]]
      .concat(S.people.slice().sort((a, b) => fullName(a).localeCompare(fullName(b), "de")).map(p => {
        const nb = nextBirthday(p), age = nb ? ageAt(p, nb) : null;
        return [p.first || "", p.last || "", p.nick || "", p.group || "", p.tel || "", p.email || "", p.addr || "", de(p.bday), age ? (nb === today() ? age : age - 1) : "", cycLabel(p.cyc), de(lastCall(p)), de(nextDue(p)), (p.calls || []).length,
          (p.calls || []).slice().sort((a, b) => a.d < b.d ? 1 : -1).map(c => de(c.d) + (c.ok ? " erreicht" : " nicht erreicht")).join("\n"), (p.ask || []).filter(a => !a.done).map(a => a.t).join("\n"), p.gift ? "ja" : "", p.arch ? "archiviert" : ""];
      }));
    const prio = t => (PRIOS.find(p => p[0] === +t.prio) || [0, ""])[1];
    const aufgaben = [["Aufgabe", "Status", "erledigt am", "Datum", "Uhrzeit", "Wiederholen", "Priorität", "Bereich", "Nerv-Modus", "angelegt", "automatisch von Mirella"]]
      .concat(S.todos.filter(t => t.list === "todo").map(t => [t.t, t.done ? "erledigt" : "offen", de(t.doneAt), de(t.date), t.time || "", t.rep && t.rep !== "nie" ? t.rep : "", prio(t), (areaById(t.area) || {}).n || "", t.nerv ? "an" : "", de(t.created), t.auto ? "ja" : ""]));
    const einkauf = [["Artikel", "Menge", "Warengruppe", "Status", "gekauft am", "angelegt"]]
      .concat(S.todos.filter(t => t.list === "einkauf").map(t => [t.t, L.qtyLabel(t), L.shopGroup(t.t).n, t.arch ? "gekauft (Verlauf)" : t.done ? "im Wagen" : "offen", de(t.doneAt), de(t.created)]));
    const bereiche = [["Bereich", "Art", "Name", "Details", "Notiz", "Dokumente"]]
      .concat(S.items.map(it => { const K = KINDS[it.kind] || {}; return [(areaById(K.area) || {}).n || "", K.n || it.kind, kindTitle(it.kind, it), itemFields(it), it.note || "", S.docs.filter(d => d.ref === it.id).length || ""]; }));
    const ausgaben = [["Datum", "Betrag €", "Wo / wofür", "Kategorie", "Beleg-Datei"]].concat(S.expenses.slice().sort((a, b) => a.d < b.d ? 1 : -1).map(e => [de(e.d), +e.amount || 0, e.shop || "", e.cat || "", e._file || ""]));
    const notizen = [["Datum", "Bereich", "Notiz"]].concat(S.notes.map(n => [de(n.d), (areaById(n.area) || {}).n || "", n.t || ""]));
    S.expenses.forEach(e => delete e._file);
    const ziele = [["Sparziel", "Ziel €", "gespart €", "bis"]].concat((S.goals || []).map(g => [g.n, +g.target || 0, +g.saved || 0, g.until || ""]));
    const sheets = [{ name: "Kontakte", rows: kontakte }, { name: "Aufgaben", rows: aufgaben }, { name: "Einkauf", rows: einkauf }, { name: "Verträge & Bereiche", rows: bereiche }, { name: "Dokumente", rows: docRows }, { name: "Ausgaben", rows: ausgaben }, { name: "Sparziele", rows: ziele }, { name: "Notizen", rows: notizen }];
    files.unshift({ name: `Mirella_Daten_${today()}.xlsx`, data: ZX.xlsx(sheets) });
    progress && progress("Wiederherstellungs-Datei …");
    const photos = {}; try { const all = await photoAll(); for (const [k, b] of Object.entries(all)) photos[k] = await blobToDataURL(b); } catch (_) { }
    files.push({ name: `Wiederherstellen/Mirella-Sicherung_${today()}.json`, data: JSON.stringify({ app: "Mirella", version: VERSION, exported: new Date().toISOString(), data: noKeys(S), photos }) });
    files.push({ name: "LIESMICH.txt", data: `Mirella-Sicherung vom ${de(today())}\r\n\r\nMirella_Daten_${today()}.xlsx: alle Kontakte, Aufgaben, Einkäufe, Verträge und Einträge, Dokumente, Ausgaben und Notizen. Mit Excel öffnen, jede Tabelle hat ein eigenes Blatt.\r\nDokumente/: alle PDFs und Fotos, nach Bereich und Ordner sortiert, Dateiname = Ablagedatum + Name. In der Excel (Blatt „Dokumente“) steht, wozu jedes Dokument gehört.\r\nBelege/: Fotos von Kassenbons zu den Ausgaben.\r\nWiederherstellen/: diese Datei in Mirella unter Einstellungen > Datensicherung > „Sicherung laden“ auswählen, dann ist alles wieder da.\r\n\r\nDiese Sicherung hängt nicht an Supabase oder an der App: Excel und PDFs lassen sich auch ohne Mirella öffnen.\r\n` });
    return { blob: new Blob([ZX.zip(files)], { type: "application/zip" }), count: files.length, docs: S.docs.length };
  }
  window.pcBackup = async function () {
    const st = m => { const el = $("#pcb-state"); if (el) el.textContent = m; };
    try {
      st("Sicherung wird erstellt …"); toast("PC-Sicherung wird erstellt …");
      const r = await buildBackup(st), name = `Mirella-PC-Sicherung_${today()}.zip`, file = new File([r.blob], name, { type: "application/zip" });
      S.settings.pcLast = today(); save();
      st(`Fertig: ${pl(S.people.length, "Kontakt", "Kontakte")}, ${pl(r.docs, "Dokument", "Dokumente")}. Jetzt im Teilen-Fenster „In Dateien sichern“ › OneDrive › CoWork › Private App › 05_Sicherung.`);
      if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === "AbortError") return; } }
      const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    } catch (e) { st("Das hat nicht geklappt: " + (e.message || e)); }
  };
  window.buildBackup = buildBackup;
}
