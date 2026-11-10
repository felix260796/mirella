# Mirella, die Sekretärin

## Stand 0.11 (2026-11-10): Mirella denkt mit wie eine Sekretärin
- **Rubriken neu:** Wecker, Finanzen, Verträge & Versicherungen, Gesundheit, Zuhause, Auto & E-Bike, Arbeit, Sport & Hobby, Dokumente, Reisen, Briefings (ganz hinten). Jede Rubrik hat eigene Einträge (z. B. Vertrag, Versicherung, Fahrzeug, Zähler, Wohnung, Gerät, Arzt, wiederkehrender Termin, Supplement, Reise, Auslage zum Erstatten, Verein). Aus jedem Eintrag legt Mirella automatisch die passenden Erinnerungen an (Kündigungsfrist, TÜV, Inspektion, Reifen, Ablesen, Zahnreinigung, Nachbestellen, Packen, Check-in …), `app/bereiche.js`.
- **Plus** öffnet zuerst eine Auswahl je Rubrik, keine Tastatur.
- **Finanzen:** Monat wählbar, Einnahmen/Fixkosten/Ausgaben/Übrig, Tortendiagramm, 6-Monats-Entwicklung, Hinweise, Budgets und eigene Kategorien.
- **Briefe ablegen** (`app/scan.js`): Papier wird erkannt, zugeschnitten und entzerrt, Text wird auf dem Gerät gelesen (Tesseract), Bereich/Art/Betrag/Frist werden vorgeschlagen, auf Wunsch mit Aufgabe. PDFs aus der Dateien-App.
- **Kontakte** (vorher „Menschen“): Vor-/Nachname untereinander, Gruppen (Familie, Freunde, Bekannte, Geschäftlich + eigene), Geburtstag tippen ohne Kalender, Ländervorwahl, Rhythmus „nie“, ganzer Anrufverlauf (letzte 3 + alle).
- **Entwürfe:** Jede Eingabe wird sofort gemerkt; schließt sich ein Fenster, ist beim nächsten Öffnen alles wieder da. Fotos werden sofort zwischengespeichert.
- **To-dos** mit Priorität (rot/orange/blau), **Einkaufsliste** mit Mengen, „Oft gekauft“ und Vorlagen.
- **Kalender:** Tag/Woche/Monat/Liste, Monats-/Jahresauswahl per Tipp auf den Titel, Filter Geburtstage/Erinnerungen/To-dos/Anrufe.
- **Einstellungen** gegliedert (Seiten, Bereiche, Mirella); das Logo links oben öffnet die Einstellungen der jeweiligen Seite.
- **Wecker** (`app/wecker.js`): Ziel + Ankunft, Fahrzeit (Google Routes API mit eigenem Schlüssel, sonst OSRM + Berufsverkehr-Zuschlag), Zeit daheim, Puffer, mehrere Wecker im Abstand; Übergabe an Kurzbefehl „Mirella Wecker“ oder Kalender-Alarm. Echter Wecker mit der iPhone-App (AlarmKit).
- **Nerv-Modus** einzeln je Art einschaltbar, Fenster mit Ton beim Öffnen und wiederholt.
- **Suche über alles** und „Mirella fragen“ (eingebaute Hilfe, `app/suche.js`).
- Kein Zoomen/Verrutschen, Sicherheitsrückfrage bei jedem Löschen, Briefings nur noch als PDF.
- Rechenlogik in `app/logik.js`, Tests in `tests/logik.test.ts` (`npm test`).

## Stand 0.9.1 (2026-11-10): Arbeitsversion läuft auf GitHub Pages
- `app/` ist die lauffähige App (reine Web-App ohne Build). Sie wird bei jedem Push auf `main` automatisch über GitHub Pages veröffentlicht (`.github/workflows/pages.yml`): https://felix260796.github.io/mirella/
- Daten liegen bis zum Supabase-Sync nur auf dem Gerät (localStorage, Fotos/PDFs in IndexedDB); Sicherung als JSON in den Einstellungen.
- Funktionen: Heute (Wetter, Briefing, Anrufe, Geburtstage, Aufgaben), Menschen (Akte, nächster Anruf, Duplikate, vCard-Import, Adressvorschläge), To-dos und Einkaufsliste, Kalender mit KW, Bereiche, Finanzen, Dokumente, Briefings, Spracheingabe, Kamera.
- Fehlt noch (braucht Server): Push-Benachrichtigungen, Abgleich zwischen Geräten, Briefings automatisch aus Gmail, KI-Belegerkennung.
- `prototyp/`: Klick-Prototyp v32. `src/`, `supabase/`, `tests/`: Server-Grundlage aus v0.1–v0.7.

Persönliche Web-App (PWA) für Felix: Kontaktpflege, Geburtstage, Gruppen, To-dos, Einkaufsliste, Morgen-Check, Nerv-Modus.

## Stand 0.7.0 (2026-11-07): + Geräte-Sync, Profile Privat/Geschäft, mehrere Personen
- **Login = eine Person.** Felix hat ein Login; Freundin oder Kumpel bekommen ein eigenes Login und eine komplett eigene Mirella. Anmeldung nur mit Einladung.
- **Profile = eigene Welten einer Person:** „Privat“ und „Geschäft“. Kontakte, To-dos, Finanzen, Dateien usw. sind je Profil getrennt; nichts lässt sich profilübergreifend verknüpfen.
- **Jedes Gerät merkt sich sein Profil:** iPhone + iPad auf Privat, Geschäftshandy auf Geschäft. Optional „Gerät festlegen“: dann geht Umschalten nur mit neuem Code aus der E-Mail.
- **Gleicher Stand überall:** Änderungen kommen sofort auf allen Geräten mit demselben Profil an (Supabase Realtime); offline Geändertes wird nachgeschickt.
- `supabase/migrations/0007_profile_sync.sql`: Tabelle `profiles`, `owner` zeigt jetzt auf ein Profil, Zugriffsregeln neu, Startdaten je neuem Profil, `updated_at` überall, Verknüpfungen nur im selben Profil, privater Dateispeicher je Profil (`<profil-id>/…`), Echtzeit für alle Tabellen. Privat-Profil kann nicht gelöscht werden.
- `src/lib/sync.ts`: Anmeldung per 6-stelligem Code aus der E-Mail (kein Link, weil der auf dem iPhone Safari statt Mirella öffnet), Profile anlegen/wechseln, Gerät festlegen, Abgleich, Offline-Warteschlange, Abmelden.
- `src/lib/sync-core.ts` + `tests/sync.test.ts`: Abgleich-Regeln (neuester Stand gewinnt), 5 Tests.
- Geprüft: alle 7 Migrationen laufen auf PostgreSQL 16 durch. Test mit Felix (Privat + Geschäft) und Kumpel: Geschäft kann keine privaten Kontakte verknüpfen, Privat-Profil nicht löschbar, Kumpel sieht nichts von Felix und kann weder Daten noch Dateien in Felix' Profile schreiben. 15 Tests grün, TypeScript fehlerfrei.
- Hinweis: Die Beleg-Erkennung läuft über Felix' Claude-Zugang; nutzen andere Personen die App, laufen deren Kosten bei Felix auf.

## Stand 0.6.0 (2026-11-07): + Finanzplan mit Trends
- `supabase/migrations/0006_finanzplan_ausbau.sql`: Sparziele, Jahreskosten als monatliche Rücklage, Einkommen je Monat.
- `supabase/migrations/0005_finanzplan.sql`: 12 Ausgaben-Kategorien mit Budget, Einkommen, Monatsübersicht; feste Kosten aus Verträgen.
- `supabase/migrations/0004_ausgaben.sql`: Ausgaben aus fotografierten Belegen (Claude liest Laden, Betrag, Positionen, schlägt Kategorie vor), Einkaufszettel per Foto.
- `supabase/migrations/0003_verwaltung.sql`: Einträge je Bereich (Fahrzeuge, Verträge, Ärzte, Geräte, Reisen) mit freien Feldern, Dokumenten (privater Speicher), Verlauf/Kosten und Erinnerungen; Dokumenten-Ablage mit Ordnern.
- `supabase/migrations/0002_lebensbereiche.sql`: Bereiche, Fakten je Bereich, Verträge mit Kündigungsfristen, Dokumente mit Ablaufdatum, Morgen-Check, CarPlay-Einstellung.
- `supabase/migrations/0001_init.sql`: Datenbank (Einstellungen, Kontakte, Akte, Anrufe, Aufgaben/Termine, Einkauf, Vorlagen, Orts-Regeln, Push), jede Tabelle per Row Level Security geschützt.
- `src/lib/reminders.ts`: Erinnerungslogik (Anruf-Zyklen, Zeitfenster, Feiertage BW, Nerv-Takt, Geburtstage, max. 3 Anrufe/Tag, neuer Versuch nach 2 Werktagen).
- `tests/reminders.test.ts`: 10 Tests (`npm test`).
- `public/`: Logo, App-Icons, Manifest (Name, Farben Weiß/Schwarz).
- Optik und Abläufe: siehe Prototyp v21 in `04_Prototyp`.

## Regeln (Standard, alles in Einstellungen änderbar)
| Regel | Wert |
|---|---|
| Anrufe | Mo–Fr 08–18 Uhr, nicht an Feiertagen |
| Nachrichten/Gruppen | täglich 08–21 Uhr |
| Anrufe pro Tag | max. 3 |
| Nicht erreicht | neuer Versuch nach 2 Werktagen |
| Nerv-Takt | Tag 1 alle 60 Min, ab Tag 2 alle 30 Min |
| Geburtstag | 09:00 Uhr; Geschenk 14 Tage vorher, „Geschenk schon da?“ 3 Tage vorher |

## Nächste Woche (wenn die Zugänge da sind)
1. Felix legt auf GitHub ein leeres privates Repository `mirella` an.
2. Supabase-Projekt anlegen (Region Frankfurt), Migrationen 0001–0007 einspielen. Unter Authentication: E-Mail-Anmeldung an, Vorlage „Magic Link“ auf den Code `{{ .Token }}` umstellen.
   „Allow new users to sign up“ ausschalten; Felix sich selbst (und später andere) über „Invite user“ einladen.
   In Mirella anmelden, unter Einstellungen Profil „Geschäft“ anlegen, auf dem Geschäftshandy Geschäft wählen und Gerät festlegen.
3. Vercel mit dem Repository verbinden, Umgebungsvariablen setzen.
4. Anthropic-API-Key als Geheimnis in der Supabase Edge Function (nie im Handy).
5. Next.js-Oberfläche nach Prototyp bauen, Web-Push einrichten.
6. Kontakte (vCard) und Geburtstagskalender (.ics) importieren, gemeinsam Zyklen vergeben.
7. iPhone: Mirella zum Home-Bildschirm hinzufügen, Kurzbefehle-Automationen (Haus verlassen, Ankommen, CarPlay).
