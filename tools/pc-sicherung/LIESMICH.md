# Mirella: automatische PC-Sicherung

Ein kleines Programm für den Windows-PC. Es holt **jede Nacht um 2 Uhr** alles aus Mirella ab und legt es in einen Ordner auf dem PC, ohne dass du etwas tun musst.

In jedem Tages-Ordner `Mirella_JJJJ-MM-TT` liegt:

- **Mirella_Daten_….xlsx** mit allen Kontakten, Aufgaben, Einkäufen, Verträgen und Einträgen, Dokumenten, Ausgaben, Sparzielen und Notizen (ein Blatt pro Bereich)
- **Dokumente\\** mit allen PDFs und Fotos, nach Bereich und Ordner sortiert
- **Belege\\** mit den Kassenbons zu den Ausgaben
- **Wiederherstellen\\** mit der Datei für Mirella › Einstellungen › Sicherung › „Sicherung laden“

Die letzten 14 Tage bleiben liegen, ältere Tages-Ordner räumt das Programm selbst weg (nur seine eigenen `Mirella_…`-Ordner).

## Einrichten (einmal)

1. Den Ordner `tools/pc-sicherung` auf den PC laden (oder das ZIP aus der Ablage entpacken).
2. **EINRICHTEN.cmd** doppelklicken.
3. Im Fenster deine **Mirella-E-Mail und dein Passwort** eingeben (dasselbe wie in der App).
4. Den vorgeschlagenen Zielordner mit Enter bestätigen. Gefunden wird automatisch `…\Desktop\CoWork\Private App\05_Sicherung`.
5. Die erste Sicherung läuft gleich, danach öffnet sich der Ordner.

Fertig. Ab dann läuft es jede Nacht. War der PC nachts aus, holt Windows es beim nächsten Einschalten nach.

## Gut zu wissen

- **Passwort:** liegt nur auf diesem PC, verschlüsselt von Windows. Nur dein Windows-Benutzer kann es lesen. Es geht nirgendwo anders hin.
- **Hat etwas nicht geklappt,** liegt im Sicherungsordner eine Datei `SICHERUNG FEHLGESCHLAGEN.txt` mit dem Grund. Nach der nächsten erfolgreichen Sicherung verschwindet sie wieder.
- **Passwort geändert?** EINRICHTEN.cmd einfach nochmal doppelklicken.
- **Sofort sichern:** JETZT-SICHERN.cmd doppelklicken.
- **Ausschalten:** AUSSCHALTEN.cmd doppelklicken. Die bisherigen Sicherungen bleiben liegen.
- Programm, Zugang und Protokoll liegen unter `%LOCALAPPDATA%\Mirella`. Uhrzeit und Anzahl der behaltenen Tage stehen in `einstellungen.json` (`uhrzeit`, `behalten`; 0 = nichts löschen).
- Braucht nichts zu installieren: Windows PowerShell ist in Windows 10 und 11 eingebaut.

## Auch für die iPhone-App

Das Programm spricht nur mit dem Mirella-Server (Supabase: Anmeldung, Daten, Dateien), nicht mit der Web-App. Die iPhone-App aus TestFlight nutzt denselben Server und dieselben Daten, die Sicherung läuft also unverändert weiter.
