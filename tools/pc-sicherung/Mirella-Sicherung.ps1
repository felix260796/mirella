<#
  Mirella – automatische PC-Sicherung
  ------------------------------------
  Holt jede Nacht alles aus Mirella (Supabase) auf den PC:
    Mirella_Daten_<Datum>.xlsx  alle Kontakte, Aufgaben, Einkäufe, Verträge, Dokumente, Ausgaben, Sparziele, Notizen
    Dokumente\                  alle PDFs und Fotos, nach Bereich und Ordner sortiert
    Belege\                     Kassenbons zu den Ausgaben
    Wiederherstellen\           Datei für Mirella › Einstellungen › Sicherung › 'Sicherung laden'

  Hängt nur an Supabase (Login, Tabelle mirella_state, Speicher 'mirella'), nicht an der Web-App.
  Die iPhone-App nutzt dieselben Daten, die Sicherung läuft dann unverändert weiter.

  Aufruf:
    Mirella-Sicherung.ps1 -Einrichten   einmalig: Zugang, Zielordner, nächtliche Aufgabe (EINRICHTEN.cmd)
    Mirella-Sicherung.ps1               eine Sicherung jetzt (so ruft die Windows-Aufgabe es jede Nacht auf)
    Mirella-Sicherung.ps1 -Entfernen    nächtliche Aufgabe und gespeicherten Zugang löschen (ENTFERNEN.cmd)

  Das Passwort liegt nur auf diesem PC, verschlüsselt mit Windows (nur dein Windows-Benutzer kann es lesen).
  Läuft mit Windows PowerShell 5.1 (in Windows 10/11 eingebaut), ohne zusätzliche Programme.
#>
[CmdletBinding()]
param([switch]$Einrichten, [switch]$Entfernen)

$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }

# ---------- feste Werte (öffentlich, wie in der App) ----------
$SB_URL   = 'https://xcanrhlwcopamhnmmlja.supabase.co'
$SB_KEY   = 'sb_publishable_uxI3wI_MIx3CZOk-zoahpw_MBoVeQZc'
$BUCKET   = 'mirella'
$TaskName = 'Mirella-Sicherung'
$AppDir   = Join-Path $env:LOCALAPPDATA 'Mirella'
$Installed = Join-Path $AppDir 'Mirella-Sicherung.ps1'
$CredFile = Join-Path $AppDir 'zugang.xml'
$CfgFile  = Join-Path $AppDir 'einstellungen.json'
$LogFile  = Join-Path $AppDir 'protokoll.txt'
$Cache    = Join-Path $AppDir 'dateien'
$Utf8     = New-Object System.Text.UTF8Encoding($false)

Add-Type -AssemblyName System.Web.Extensions
Add-Type -AssemblyName System.IO.Compression
$JS = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$JS.MaxJsonLength = [int]::MaxValue
$JS.RecursionLimit = 1000

# ---------- kleine Helfer ----------
function Log([string]$m) {
  $line = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '  ' + $m
  Write-Host $m
  try {
    if (-not (Test-Path $AppDir)) { New-Item -ItemType Directory -Path $AppDir -Force | Out-Null }
    if ((Test-Path $LogFile) -and (Get-Item $LogFile).Length -gt 1MB) { Move-Item $LogFile ($LogFile + '.alt') -Force }
    [IO.File]::AppendAllText($LogFile, $line + "`r`n", $Utf8)
  } catch { }
}
function G($o, [string]$k) { if ($o -is [System.Collections.IDictionary] -and $o.ContainsKey($k)) { return $o[$k] } return $null }
function Arr($o, [string]$k) { $v = G $o $k; if ($null -eq $v) { return @() } if ($v -is [System.Collections.IDictionary] -or $v -is [string]) { return ,$v } return $v }
function S($v) { if ($null -eq $v) { return '' } return [string]$v }
function De($s) {
  $s = S $s
  if ($s -match '^(\d{4})-(\d{2})-(\d{2})') { if ($Matches[1] -eq '1604') { return "$($Matches[3]).$($Matches[2])." } return "$($Matches[3]).$($Matches[2]).$($Matches[1])" }
  return $s
}
function FName($s) {
  $s = (S $s) -replace '[\\/:*?"<>|\x00-\x1F]', ' ' -replace '\s+', ' '
  $s = $s.Trim() -replace '[. ]+$', ''
  if ($s.Length -gt 90) { $s = $s.Substring(0, 90).Trim() }
  if (-not $s) { $s = 'Ohne Namen' }
  return $s
}
function Num($v) { $d = 0.0; [void][double]::TryParse(((S $v).Replace(',', '.')), [Globalization.NumberStyles]::Any, [Globalization.CultureInfo]::InvariantCulture, [ref]$d); return $d }
function MkDir([string]$p) { [void][IO.Directory]::CreateDirectory($p) }
function Today { return (Get-Date -Format 'yyyy-MM-dd') }

function Load-Config {
  if (Test-Path $CfgFile) { return $JS.DeserializeObject([IO.File]::ReadAllText($CfgFile, $Utf8)) }
  return @{}
}
function Save-Config($cfg) { [IO.File]::WriteAllText($CfgFile, $JS.Serialize($cfg), $Utf8) }

# ---------- Supabase ----------
function New-Web([string]$token) {
  $wc = New-Object System.Net.WebClient
  $wc.Encoding = [System.Text.Encoding]::UTF8
  try { $wc.Proxy = [System.Net.WebRequest]::GetSystemWebProxy(); $wc.Proxy.Credentials = [System.Net.CredentialCache]::DefaultNetworkCredentials } catch { }
  $wc.Headers.Add('apikey', $SB_KEY)
  if ($token) { $wc.Headers.Add('Authorization', 'Bearer ' + $token) }
  return $wc
}
function Web-Error($e) {
  $ex = $e.Exception; while ($ex.InnerException -and -not ($ex -is [System.Net.WebException])) { $ex = $ex.InnerException }
  if ($ex -is [System.Net.WebException] -and $ex.Response) {
    try { $r = New-Object IO.StreamReader($ex.Response.GetResponseStream()); $t = $r.ReadToEnd(); return "$([int]$ex.Response.StatusCode) $t" } catch { }
  }
  return $ex.Message
}
function Sb-Login([string]$email, [string]$pw) {
  $wc = New-Web $null; $wc.Headers.Add('Content-Type', 'application/json')
  $body = $JS.Serialize(@{ email = $email; password = $pw })
  try { $res = $wc.UploadString("$SB_URL/auth/v1/token?grant_type=password", 'POST', $body) }
  catch { $m = Web-Error $_; if ($m -match 'invalid_credentials|Invalid login') { throw 'E-Mail oder Passwort stimmt nicht.' } throw "Anmeldung bei Mirella hat nicht geklappt: $m" }
  $j = $JS.DeserializeObject($res)
  return @{ token = (G $j 'access_token'); uid = (G (G $j 'user') 'id') }
}
function Sb-State($a) {
  $wc = New-Web $a.token; $wc.Headers.Add('Accept', 'application/json')
  $res = $wc.DownloadString("$SB_URL/rest/v1/mirella_state?select=data&user_id=eq.$($a.uid)")
  $rows = $JS.DeserializeObject($res)
  if (-not $rows -or $rows.Count -lt 1) { throw 'Auf dem Server liegen für dieses Konto noch keine Daten. In der App einmal anmelden und abgleichen.' }
  return (G $rows[0] 'data')
}
function Sb-Files($a) {
  $all = @(); $off = 0
  while ($true) {
    $wc = New-Web $a.token; $wc.Headers.Add('Content-Type', 'application/json')
    $body = $JS.Serialize(@{ prefix = $a.uid; limit = 1000; offset = $off; sortBy = @{ column = 'name'; order = 'asc' } })
    $page = $JS.DeserializeObject($wc.UploadString("$SB_URL/storage/v1/object/list/$BUCKET", 'POST', $body))
    if (-not $page) { break }
    foreach ($f in $page) { if (G $f 'id') { $all += ,$f } }
    if ($page.Count -lt 1000) { break }
    $off += 1000
  }
  return ,$all
}
function Sb-Download($a, [string]$name, [string]$dest) {
  $wc = New-Web $a.token
  $tmp = $dest + '.lade'
  $wc.DownloadFile("$SB_URL/storage/v1/object/authenticated/$BUCKET/$($a.uid)/" + [Uri]::EscapeDataString($name), $tmp)
  Move-Item $tmp $dest -Force
}

# ---------- Excel (xlsx) ohne Excel ----------
function ColName([int]$i) { $s = ''; $i++; while ($i -gt 0) { $m = ($i - 1) % 26; $s = ([string][char](65 + $m)) + $s; $i = [int][math]::Floor(($i - 1) / 26) } return $s }
function Xe($v) { return [Security.SecurityElement]::Escape(((S $v) -replace '[\x00-\x08\x0B\x0C\x0E-\x1F]', '')) }
function Sheet-Xml($rows) {
  $sb = New-Object System.Text.StringBuilder
  $w = @{}
  foreach ($r in $rows) { for ($c = 0; $c -lt $r.Count; $c++) { $l = [math]::Min(60, ((S $r[$c]) -split "`n")[0].Length + 2); if (-not $w.ContainsKey($c) -or $w[$c] -lt $l) { $w[$c] = [math]::Max(8, $l) } } }
  [void]$sb.Append('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>')
  if ($w.Count) { [void]$sb.Append('<cols>'); foreach ($c in ($w.Keys | Sort-Object)) { [void]$sb.Append("<col min=`"$($c+1)`" max=`"$($c+1)`" width=`"$($w[$c])`" customWidth=`"1`"/>") }; [void]$sb.Append('</cols>') }
  [void]$sb.Append('<sheetData>')
  for ($ri = 0; $ri -lt $rows.Count; $ri++) {
    $r = $rows[$ri]; [void]$sb.Append("<row r=`"$($ri+1)`">")
    for ($ci = 0; $ci -lt $r.Count; $ci++) {
      $ref = (ColName $ci) + ($ri + 1); $st = ''; if ($ri -eq 0) { $st = ' s="1"' }
      $v = $r[$ci]
      if (($v -is [int] -or $v -is [long] -or $v -is [double] -or $v -is [decimal]) -and $ri -gt 0) { [void]$sb.Append("<c r=`"$ref`"$st><v>" + ([double]$v).ToString([Globalization.CultureInfo]::InvariantCulture) + '</v></c>') }
      else { [void]$sb.Append("<c r=`"$ref`" t=`"inlineStr`"$st><is><t xml:space=`"preserve`">" + (Xe $v) + '</t></is></c>') }
    }
    [void]$sb.Append('</row>')
  }
  [void]$sb.Append('</sheetData>')
  if ($rows.Count -gt 1 -and $rows[0].Count) { [void]$sb.Append("<autoFilter ref=`"A1:$(ColName ($rows[0].Count - 1))$($rows.Count)`"/>") }
  [void]$sb.Append('</worksheet>')
  return $sb.ToString()
}
function Write-Xlsx([string]$path, $sheets) {
  $fs = [IO.File]::Open($path, [IO.FileMode]::Create)
  $zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
  $put = {
    param($n, $t)
    $e = $zip.CreateEntry($n); $sw = New-Object IO.StreamWriter($e.Open(), $Utf8); $sw.Write($t); $sw.Close() }
  $n = $sheets.Count
  $ov = ''; $sh = ''; $rel = ''
  for ($i = 1; $i -le $n; $i++) {
    $nm = Xe ((($sheets[$i-1].name) -replace '[\\/?*\[\]:]', ' '))
    if ($nm.Length -gt 31) { $nm = $nm.Substring(0, 31) }
    $ov += "<Override PartName=`"/xl/worksheets/sheet$i.xml`" ContentType=`"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml`"/>"
    $sh += "<sheet name=`"$nm`" sheetId=`"$i`" r:id=`"rId$i`"/>"
    $rel += "<Relationship Id=`"rId$i`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet`" Target=`"worksheets/sheet$i.xml`"/>"
  }
  & $put '[Content_Types].xml' ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + $ov + '</Types>')
  & $put '_rels/.rels' '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
  & $put 'xl/workbook.xml' ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + $sh + '</sheets></workbook>')
  & $put 'xl/_rels/workbook.xml.rels' ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + $rel + "<Relationship Id=`"rId$($n+1)`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles`" Target=`"styles.xml`"/></Relationships>")
  & $put 'xl/styles.xml' '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFEFEA"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
  for ($i = 1; $i -le $n; $i++) { & $put "xl/worksheets/sheet$i.xml" (Sheet-Xml $sheets[$i-1].rows) }
  $zip.Dispose(); $fs.Close()
}

# ---------- Namen aus der App ----------
$AREAS = @{ wecker = 'Wecker'; geld = 'Finanzen'; vertrag = 'Verträge & Versicherungen'; gesund = 'Gesundheit'; haus = 'Zuhause'; auto = 'Auto & E-Bike'; arbeit = 'Arbeit'; sport = 'Sport & Hobby'; doku = 'Allgemein'; frei = 'Reisen' }
$KINDS = @{ vertrag = @('vertrag', 'Vertrag'); versicherung = @('vertrag', 'Versicherung'); fahrzeug = @('auto', 'Fahrzeug'); zaehler = @('haus', 'Zähler'); wohnung = @('haus', 'Wohnung & Vermieter'); geraet = @('haus', 'Gerät'); arzt = @('gesund', 'Arzt / Ansprechpartner'); vorsorge = @('gesund', 'Wiederkehrender Termin'); supplement = @('gesund', 'Supplement'); reise = @('frei', 'Reise'); ansprech = @('arbeit', 'Ansprechpartner'); erstattung = @('arbeit', 'Auslage zum Erstatten'); verein = @('sport', 'Verein / Kurs'); ausruestung = @('sport', 'Ausrüstung') }
$PRIOS = @{ '1' = 'Hoch'; '2' = 'Mittel'; '3' = 'Niedrig' }
function AreaName($id) { $id = S $id; if ($AREAS.ContainsKey($id)) { return $AREAS[$id] } if ($id) { return $id } return 'Allgemein' }
function ItemTitle($it) { foreach ($k in 'name', 'title', 'company', 'n', 'what', 'dest') { $v = S (G $it $k); if ($v) { return $v } } $kd = $KINDS[(S (G $it 'kind'))]; if ($kd) { return $kd[1] } return 'Eintrag' }
function ItemDetails($it) {
  $skip = @('id', 'kind', 'name', 'note', 'reads', 'created', 'updated', 'auto', 'docs', 'photo')
  $out = @()
  foreach ($k in $it.Keys) {
    if ($skip -contains $k) { continue }
    $v = $it[$k]
    if ($null -eq $v -or (S $v) -eq '' -or $v -eq $false) { continue }
    if ($v -is [System.Collections.IDictionary] -or ($v -is [Array])) { continue }
    if ($v -eq $true) { $v = 'ja' }
    $out += "${k}: $(De $v)"
  }
  return ($out -join "`n")
}
function Ext($mime, $fallbackType) {
  $m = (S $mime) + ' ' + (S $fallbackType)
  if ($m -match 'pdf') { return 'pdf' } if ($m -match 'png') { return 'png' } if ($m -match 'heic') { return 'heic' } if ($m -match 'webp') { return 'webp' }
  return 'jpg'
}

# ---------- eine Sicherung ----------
function Run-Backup {
  $cfg = Load-Config
  $ziel = S (G $cfg 'ziel'); $keep = 14; if (G $cfg 'behalten') { $keep = [int](G $cfg 'behalten') }
  if (-not $ziel) { throw 'Noch nicht eingerichtet. Bitte EINRICHTEN.cmd doppelklicken.' }
  if (-not (Test-Path $CredFile)) { throw 'Kein Zugang gespeichert. Bitte EINRICHTEN.cmd doppelklicken.' }
  MkDir $ziel
  $fail = Join-Path $ziel 'SICHERUNG FEHLGESCHLAGEN.txt'
  try {
    $cred = Import-Clixml $CredFile
    $a = Sb-Login $cred.UserName $cred.GetNetworkCredential().Password
    Log 'Angemeldet, hole Daten …'
    $S = Sb-State $a
    $files = Sb-Files $a
    Log "$($files.Count) Dateien auf dem Server."

    # Dateien in den Zwischenspeicher (nur neue oder geänderte laden)
    MkDir $Cache
    $have = @{}; $neu = 0
    foreach ($f in $files) {
      $name = S (G $f 'name'); $meta = G $f 'metadata'; $size = G $meta 'size'; $mime = S (G $meta 'mimetype')
      $local = Join-Path $Cache (($name -replace '[^A-Za-z0-9._-]', '_'))
      if (-not [IO.File]::Exists($local) -or ($size -and (Get-Item $local).Length -ne [long]$size)) {
        try { Sb-Download $a $name $local; $neu++ } catch { Log "Datei $name nicht ladbar: $(Web-Error $_)"; continue }
      }
      $have[$name] = @{ path = $local; mime = $mime }
    }
    Log "$neu Dateien neu geladen."

    # Zielordner des Tages (erst fertig bauen, dann umbenennen)
    $day = Today; $dir = Join-Path $ziel "Mirella_$day"; $tmp = $dir + '_entsteht'
    if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force }
    MkDir $tmp
    $used = @{}
    function Uniq([string]$p) { $x = $p; $i = 2; while ($used.ContainsKey($x.ToLower())) { $x = $p -replace '(\.[A-Za-z0-9]+)$', " ($i)`$1"; $i++ } $used[$x.ToLower()] = 1; return $x }
    function Put([string]$rel, $src) { $full = Join-Path $tmp $rel; MkDir ([IO.Path]::GetDirectoryName($full)); [IO.File]::Copy($src, $full, $true) }

    $items = @(Arr $S 'items'); $todos = @(Arr $S 'todos')
    $ownerOf = {
      param($ref)
      if (-not $ref) { return '' } foreach ($it in $items) { if ((G $it 'id') -eq $ref) { return (ItemTitle $it) } } foreach ($t in $todos) { if ((G $t 'id') -eq $ref) { return 'Aufgabe: ' + (S (G $t 't')) } } return '' }

    # Dokumente
    $docRows = New-Object System.Collections.ArrayList
    [void]$docRows.Add(@('Dokument', 'Bereich', 'Ordner', 'gehört zu', 'abgelegt am', 'gültig bis / Frist', 'Datei in der Sicherung'))
    foreach ($d in @(Arr $S 'docs')) {
      $an = AreaName (G $d 'area'); $ph = S (G $d 'photo'); $rel = ''
      if ($ph -and $have.ContainsKey($ph)) {
        $h = $have[$ph]; $cr = S (G $d 'created'); if (-not $cr) { $cr = $day }
        $fo = S (G $d 'folder'); if (-not $fo) { $fo = 'Sonstiges' }
        $rel = Uniq ("Dokumente\$(FName $an)\$(FName $fo)\$cr $(FName (G $d 'name')).$(Ext $h.mime (G $d 'type'))")
        Put $rel $h.path
      }
      if (-not $rel) { $rel = '(Datei nicht auf dem Server)' }
      [void]$docRows.Add(@((S (G $d 'name')), $an, (S (G $d 'folder')), (& $ownerOf (G $d 'ref')), (De (G $d 'created')), (De (G $d 'until')), $rel))
    }

    # Ausgaben mit Belegen
    $ausg = New-Object System.Collections.ArrayList
    [void]$ausg.Add(@('Datum', 'Betrag €', 'Wo / wofür', 'Kategorie', 'Beleg-Datei'))
    foreach ($e in (@(Arr $S 'expenses') | Sort-Object { S (G $_ 'd') } -Descending)) {
      $ph = S (G $e 'photo'); $rel = ''
      $amt = Num (G $e 'amount')
      if ($ph -and $have.ContainsKey($ph)) { $shop = S (G $e 'shop'); if (-not $shop) { $shop = 'Beleg' }; $rel = Uniq ("Belege\$(S (G $e 'd')) $(FName $shop) $((S (G $e 'amount')).Replace('.', ',')) EUR.$(Ext $have[$ph].mime '')"); Put $rel $have[$ph].path }
      [void]$ausg.Add(@((De (G $e 'd')), $amt, (S (G $e 'shop')), (S (G $e 'cat')), $rel))
    }

    # Kontakte
    $kon = New-Object System.Collections.ArrayList
    [void]$kon.Add(@('Vorname', 'Nachname', 'Spitzname', 'Gruppe', 'Telefon', 'E-Mail', 'Adresse', 'Geburtstag', 'Alter', 'Anrufen', 'zuletzt erreicht', 'Anrufe gesamt', 'Anrufverlauf', 'Offene Nachfragen', 'Geschenk-Erinnerung', 'Archiv'))
    foreach ($p in (@(Arr $S 'people') | Sort-Object { ((S (G $_ 'first')) + ' ' + (S (G $_ 'last'))).Trim() })) {
      $calls = @(@(Arr $p 'calls') | Sort-Object { S (G $_ 'd') } -Descending)
      $ok = @($calls | Where-Object { G $_ 'ok' }) | Select-Object -First 1
      $age = ''; $bd = S (G $p 'bday')
      if ($bd -match '^(\d{4})-(\d{2})-(\d{2})' -and $Matches[1] -ne '1604') { try { $b = Get-Date -Year ([int]$Matches[1]) -Month ([int]$Matches[2]) -Day ([int]$Matches[3]); $n = Get-Date; $age = $n.Year - $b.Year; if ($n.Month -lt $b.Month -or ($n.Month -eq $b.Month -and $n.Day -lt $b.Day)) { $age-- } } catch { } }
      $cyc = S (G $p 'cyc'); if ($cyc -eq 'nie' -or $cyc -eq 'nur Geburtstag') { $cyc = 'nie anrufen' }
      $verlauf = ($calls | ForEach-Object { (De (G $_ 'd')) + $(if (G $_ 'ok') { ' erreicht' } else { ' nicht erreicht' }) }) -join "`n"
      $ask = (@(Arr $p 'ask') | Where-Object { -not (G $_ 'done') } | ForEach-Object { S (G $_ 't') }) -join "`n"
      [void]$kon.Add(@((S (G $p 'first')), (S (G $p 'last')), (S (G $p 'nick')), (S (G $p 'group')), (S (G $p 'tel')), (S (G $p 'email')), (S (G $p 'addr')), (De $bd), $age, $cyc, $(if ($ok) { De (G $ok 'd') } else { '' }), @($calls).Count, $verlauf, $ask, $(if (G $p 'gift') { 'ja' } else { '' }), $(if (G $p 'arch') { 'archiviert' } else { '' })))
    }

    # Aufgaben und Einkauf
    $auf = New-Object System.Collections.ArrayList
    [void]$auf.Add(@('Aufgabe', 'Status', 'erledigt am', 'Datum', 'Uhrzeit', 'Wiederholen', 'Priorität', 'Bereich', 'Nerv-Modus', 'angelegt', 'automatisch von Mirella'))
    $ein = New-Object System.Collections.ArrayList
    [void]$ein.Add(@('Artikel', 'Menge', 'Status', 'gekauft am', 'angelegt'))
    foreach ($t in $todos) {
      if ((G $t 'list') -eq 'einkauf') {
        $q = S (G $t 'qty'); if ($q) { $q = $q.Replace('.', ','); if (G $t 'unit') { $q += ' ' + (S (G $t 'unit')) } else { $q += '×' } }
        [void]$ein.Add(@((S (G $t 't')), $q, $(if (G $t 'arch') { 'gekauft (Verlauf)' } elseif (G $t 'done') { 'im Wagen' } else { 'offen' }), (De (G $t 'doneAt')), (De (G $t 'created'))))
      } elseif ((G $t 'list') -eq 'todo' -or -not (G $t 'list')) {
        $rep = S (G $t 'rep'); if ($rep -eq 'nie') { $rep = '' }
        [void]$auf.Add(@((S (G $t 't')), $(if (G $t 'done') { 'erledigt' } else { 'offen' }), (De (G $t 'doneAt')), (De (G $t 'date')), (S (G $t 'time')), $rep, (S $PRIOS[(S (G $t 'prio'))]), $(if (G $t 'area') { AreaName (G $t 'area') } else { '' }), $(if (G $t 'nerv') { 'an' } else { '' }), (De (G $t 'created')), $(if (G $t 'auto') { 'ja' } else { '' })))
      }
    }

    # Bereiche, Sparziele, Notizen
    $ber = New-Object System.Collections.ArrayList
    [void]$ber.Add(@('Bereich', 'Art', 'Name', 'Details', 'Notiz', 'Dokumente'))
    $docs = @(Arr $S 'docs')
    foreach ($it in $items) {
      $kd = $KINDS[(S (G $it 'kind'))]; if (-not $kd) { $kd = @('', (S (G $it 'kind'))) }
      $nd = @($docs | Where-Object { (G $_ 'ref') -eq (G $it 'id') }).Count
      [void]$ber.Add(@($(if ($kd[0]) { AreaName $kd[0] } else { '' }), $kd[1], (ItemTitle $it), (ItemDetails $it), (S (G $it 'note')), $(if ($nd) { $nd } else { '' })))
    }
    $zie = New-Object System.Collections.ArrayList
    [void]$zie.Add(@('Sparziel', 'Ziel €', 'gespart €', 'bis'))
    foreach ($g in @(Arr $S 'goals')) { [void]$zie.Add(@((S (G $g 'n')), (Num (G $g 'target')), (Num (G $g 'saved')), (De (G $g 'until')))) }
    $not = New-Object System.Collections.ArrayList
    [void]$not.Add(@('Datum', 'Bereich', 'Notiz'))
    foreach ($nn in @(Arr $S 'notes')) { [void]$not.Add(@((De (G $nn 'd')), $(if (G $nn 'area') { AreaName (G $nn 'area') } else { '' }), (S (G $nn 't')))) }

    Log 'Excel wird erstellt …'
    Write-Xlsx (Join-Path $tmp "Mirella_Daten_$day.xlsx") @(
      @{ name = 'Kontakte'; rows = $kon }, @{ name = 'Aufgaben'; rows = $auf }, @{ name = 'Einkauf'; rows = $ein }, @{ name = 'Verträge & Bereiche'; rows = $ber },
      @{ name = 'Dokumente'; rows = $docRows }, @{ name = 'Ausgaben'; rows = $ausg }, @{ name = 'Sparziele'; rows = $zie }, @{ name = 'Notizen'; rows = $not })

    # Wiederherstellungs-Datei im Format der App (Einstellungen › Sicherung › 'Sicherung laden')
    MkDir (Join-Path $tmp 'Wiederherstellen')
    $jw = New-Object IO.StreamWriter((Join-Path $tmp "Wiederherstellen\Mirella-Sicherung_$day.json"), $false, $Utf8)
    $jw.Write('{"app":"Mirella","version":"PC-Sicherung","exported":' + $JS.Serialize((Get-Date).ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'")) + ',"data":' + $JS.Serialize($S) + ',"photos":{')
    $first = $true
    foreach ($k in $have.Keys) {
      $h = $have[$k]; $mime = $h.mime; if (-not $mime) { $mime = 'application/octet-stream' }
      if (-not $first) { $jw.Write(',') }; $first = $false
      $jw.Write($JS.Serialize($k) + ':"data:' + $mime + ';base64,' + [Convert]::ToBase64String([IO.File]::ReadAllBytes($h.path)) + '"')
    }
    $jw.Write('}}'); $jw.Close()

    [IO.File]::WriteAllText((Join-Path $tmp 'LIESMICH.txt'), "Mirella-Sicherung vom $(De $day), automatisch vom PC geholt`r`n`r`nMirella_Daten_$day.xlsx: alle Kontakte, Aufgaben, Einkäufe, Verträge und Einträge, Dokumente, Ausgaben, Sparziele und Notizen. Jede Tabelle hat ein eigenes Blatt.`r`nDokumente\: alle PDFs und Fotos, nach Bereich und Ordner sortiert, Dateiname = Ablagedatum + Name.`r`nBelege\: Fotos von Kassenbons zu den Ausgaben.`r`nWiederherstellen\: diese Datei in Mirella unter Einstellungen › Sicherung › 'Sicherung laden' auswählen, dann ist alles wieder da.`r`n`r`nExcel und PDFs lassen sich auch ohne Mirella öffnen.`r`n", $Utf8)

    if (Test-Path -LiteralPath $dir) { Remove-Item -LiteralPath $dir -Recurse -Force }
    Rename-Item -LiteralPath $tmp (Split-Path $dir -Leaf)

    # alte Tages-Ordner aufräumen (nur eigene 'Mirella_JJJJ-MM-TT'-Ordner)
    if ($keep -gt 0) {
      $old = Get-ChildItem -LiteralPath $ziel -Directory | Where-Object { $_.Name -match '^Mirella_\d{4}-\d{2}-\d{2}$' } | Sort-Object Name -Descending | Select-Object -Skip $keep
      foreach ($o in $old) { Remove-Item -LiteralPath $o.FullName -Recurse -Force; Log "Alte Sicherung $($o.Name) entfernt." }
    }
    if (Test-Path $fail) { Remove-Item $fail -Force }
    $msg = "Fertig: $(@(Arr $S 'people').Count) Kontakte, $(@(Arr $S 'docs').Count) Dokumente, $($files.Count) Dateien. Ordner: $dir"
    Log $msg
    $cfg['letzte'] = (Get-Date -Format 'yyyy-MM-dd HH:mm'); Save-Config $cfg
    return $msg
  } catch {
    $m = "$($_.Exception.Message)"
    Log "FEHLER: $m"
    try { [IO.File]::WriteAllText($fail, "Die automatische Mirella-Sicherung am $(Get-Date -Format 'dd.MM.yyyy HH:mm') hat nicht geklappt.`r`n`r`nGrund: $m`r`n`r`nWenn du dein Mirella-Passwort geändert hast: EINRICHTEN.cmd nochmal doppelklicken.`r`nProtokoll: $LogFile`r`n", $Utf8) } catch { }
    throw
  }
}

# ---------- Einrichten ----------
function Find-DefaultTarget {
  $roots = @($env:OneDriveCommercial, $env:OneDrive, [Environment]::GetFolderPath('Desktop')) | Where-Object { $_ }
  foreach ($r in $roots) {
    foreach ($sub in 'Desktop\CoWork\Private App', 'CoWork\Private App') {
      $p = Join-Path $r $sub; if (Test-Path -LiteralPath $p) { return (Join-Path $p '05_Sicherung') }
    }
  }
  Get-ChildItem -Path $env:USERPROFILE -Directory -Filter 'OneDrive*' -ErrorAction SilentlyContinue | ForEach-Object {
    $p = Join-Path $_.FullName 'Desktop\CoWork\Private App'; if (Test-Path $p) { return (Join-Path $p '05_Sicherung') }
  } | Select-Object -First 1
}
function Do-Setup {
  Write-Host ''
  Write-Host '  Mirella – automatische PC-Sicherung einrichten' -ForegroundColor White
  Write-Host '  ----------------------------------------------'
  Write-Host '  Einmalig: Mirella-Zugang eingeben, Zielordner bestätigen. Danach holt der PC jede Nacht alles ab.'
  Write-Host ''
  if (-not (Test-Path $AppDir)) { New-Item -ItemType Directory -Path $AppDir -Force | Out-Null }
  $cfg = Load-Config

  # 1. Zugang
  $ok = $false
  for ($try = 1; $try -le 3 -and -not $ok; $try++) {
    # Eingabe direkt hier im Fenster (das Windows-Anmeldefenster taucht oft nicht auf)
    $mail = S (G $cfg 'email')
    $in = Read-Host ('  Mirella-E-Mail' + $(if ($mail) { " (Enter = $mail)" } else { '' }))
    if ($in.Trim()) { $mail = $in.Trim() }
    if (-not $mail) { Write-Host '  Bitte eine E-Mail eingeben.' -ForegroundColor Yellow; continue }
    $cfg['email'] = $mail
    $pw = Read-Host '  Mirella-Passwort (man sieht beim Tippen nur Sternchen)' -AsSecureString
    $cred = New-Object System.Management.Automation.PSCredential($mail, $pw)
    try { $a = Sb-Login $cred.UserName $cred.GetNetworkCredential().Password; $ok = $true }
    catch { Write-Host "  $($_.Exception.Message)" -ForegroundColor Yellow }
  }
  if (-not $ok) { throw 'Anmeldung dreimal fehlgeschlagen. Bitte später nochmal EINRICHTEN.cmd starten.' }
  $cred | Export-Clixml -Path $CredFile
  $cfg['email'] = $cred.UserName
  Write-Host '  OK: Zugang geprüft und verschlüsselt gespeichert (nur für deinen Windows-Benutzer lesbar).' -ForegroundColor Green

  # 2. Zielordner
  $def = S (G $cfg 'ziel'); if (-not $def) { $def = S (Find-DefaultTarget) }
  if (-not $def) { $def = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Mirella-Sicherung' }
  Write-Host ''
  Write-Host "  Zielordner: $def"
  $in = Read-Host '  Enter = so lassen, oder anderen Ordner eintippen'
  if ($in.Trim()) { $def = $in.Trim().Trim('"') }
  MkDir $def
  $cfg['ziel'] = $def
  if (-not (G $cfg 'behalten')) { $cfg['behalten'] = 14 }
  if (-not (G $cfg 'uhrzeit')) { $cfg['uhrzeit'] = '02:00' }
  Save-Config $cfg
  Write-Host '  OK: Zielordner gespeichert.' -ForegroundColor Green

  # 3. Programm an festen Ort kopieren und nächtliche Aufgabe anlegen
  if ($PSCommandPath -and ((Resolve-Path $PSCommandPath).Path -ne $Installed)) { Copy-Item -LiteralPath $PSCommandPath -Destination $Installed -Force }
  try { Unblock-File -Path $Installed } catch { }
  $act = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Installed`""
  $trg = New-ScheduledTaskTrigger -Daily -At ([datetime]::ParseExact((S $cfg['uhrzeit']), 'HH:mm', $null))
  $set = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RunOnlyIfNetworkAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2)
  Register-ScheduledTask -TaskName $TaskName -Action $act -Trigger $trg -Settings $set -Description 'Holt jede Nacht alle Mirella-Daten (Excel, PDFs, Fotos) in den Sicherungsordner.' -Force | Out-Null
  Write-Host "  OK: Läuft ab jetzt jede Nacht um $($cfg['uhrzeit']) Uhr. War der PC aus, holt er es beim nächsten Einschalten nach." -ForegroundColor Green

  # 4. erste Sicherung gleich jetzt
  Write-Host ''
  Write-Host '  Erste Sicherung läuft …'
  $r = Run-Backup
  Write-Host "  OK: $r" -ForegroundColor Green
  try { Start-Process explorer.exe $cfg['ziel'] } catch { }
}
function Do-Remove {
  $a = Read-Host '  Nächtliche Mirella-Sicherung ausschalten und gespeicherten Zugang löschen? (j/n)'
  if ($a -notmatch '^[jJyY]') { Write-Host '  Nichts geändert.'; return }
  try { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false } catch { }
  if (Test-Path $CredFile) { Remove-Item $CredFile -Force }
  Write-Host '  OK: Ausgeschaltet. Deine bisherigen Sicherungen im Zielordner bleiben liegen.' -ForegroundColor Green
}

# ---------- Start ----------
# Doppelklick ohne Einrichtung: gleich einrichten
if (-not $Einrichten -and -not $Entfernen -and -not (Test-Path $CfgFile) -and [Environment]::UserInteractive) { $Einrichten = $true }
if ($Einrichten) { try { if (-not (Test-Path $AppDir)) { New-Item -ItemType Directory -Path $AppDir -Force | Out-Null }; Start-Transcript -Path (Join-Path $AppDir 'einrichten-protokoll.txt') -Force | Out-Null } catch { } }
try {
  if ($Einrichten) { Do-Setup; Write-Host ''; Read-Host '  Fertig. Enter drücken zum Schließen' | Out-Null }
  elseif ($Entfernen) { Do-Remove; Read-Host '  Enter drücken zum Schließen' | Out-Null }
  else { Run-Backup | Out-Null }
} catch {
  Log "FEHLER: $($_.Exception.Message)"
  if ($Einrichten -or $Entfernen) { Write-Host ''; Write-Host "  Das hat nicht geklappt: $($_.Exception.Message)" -ForegroundColor Red; Read-Host '  Enter drücken zum Schließen' | Out-Null }
  exit 1
}
