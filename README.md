# Mirella, die Sekretärin

Persönliche Web-App (PWA) für Felix: Kontaktpflege, Geburtstage, Gruppen, To-dos, Einkaufsliste, Morgen-Check, Nerv-Modus.

## Stand 0.6.0 (2026-11-07): + Finanzplan mit Trends
- `supabase/migrations/0006_finanzplan_ausbau.sql`: Sparziele, Jahreskosten als monatliche Rücklage, Einkommen je Monat.
- `supabase/migrations/0005_finanzplan.sql`: 12 Ausgaben-Kategorien mit Budget, Einkommen, Monatsübersicht; feste Kosten aus Verträgen.
- `supabase/migrations/0004_ausgaben.sql`: Ausgaben aus fotografierten Belegen (Claude liest Laden, Betrag, Positionen, schlägt Kategorie vor), Einkaufszettel per Foto.
- `supabase/migrations/0003_verwaltung.sql`: Einträge je Bereich (Fahrzeuge, Verträge, Ärzte, Geräte, Reisen) mit freien Feldern, Dokumenten (privater Speicher), Verlauf/Kosten und Erinnerungen; Dokumenten-Ablage mit Ordnern.
- `supabase/migrations/0002_lebensbereiche.sql`: Bereiche, Fakten je Bereich, Verträge mit Kündigungsfristen, Dokumente mit Ablaufdatum, Morgen-Check, CarPlay-Einstellung.
- `supabase/migrations/0001_init.sql`: Datenbank (Einstellungen, Kontakte, Akte, Anrufe, Aufgaben/Termine, Einkauf, Vorlagen, Orts-Regeln, Push), jede Tabelle per Row Level Security geschützt.
- `src/lib/reminders.ts`: Erinnerungslogik (Anruf-Zyklen, Zeitfenster, Feiertage BW, Nerv-Takt, Geburtstage, max. 3 Anrufe/Tag, neuer Versuch nach 2 Werktagen).
- `tests/reminders.test.ts`: 10 Tests, alle grün (`npm test`).
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
2. Supabase-Projekt anlegen (Region Frankfurt), Migration einspielen.
3. Vercel mit dem Repository verbinden, Umgebungsvariablen setzen.
4. Anthropic-API-Key als Geheimnis in der Supabase Edge Function (nie im Handy).
5. Next.js-Oberfläche nach Prototyp bauen, Web-Push einrichten.
6. Kontakte (vCard) und Geburtstagskalender (.ics) importieren, gemeinsam Zyklen vergeben.
7. iPhone: Mirella zum Home-Bildschirm hinzufügen, Kurzbefehle-Automationen (Haus verlassen, Ankommen, CarPlay).
