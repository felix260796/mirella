import Foundation
import Capacitor
import SwiftUI
#if canImport(AlarmKit)
import AlarmKit
import ActivityKit
#endif

/// Echter iPhone-Wecker für Mirella (Apple AlarmKit, ab iOS 26).
/// Klingelt auch bei geschlossener App, im Stumm-Modus und im Fokus.
/// Aus der Web-App erreichbar als Capacitor.Plugins.MirellaAlarm.
@objc(MirellaAlarmPlugin)
public class MirellaAlarmPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MirellaAlarmPlugin"
    public let jsName = "MirellaAlarm"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise)
    ]

    /// Darf Mirella Wecker stellen? state: authorized | denied | notDetermined | unavailable
    @objc func status(_ call: CAPPluginCall) {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            call.resolve(["state": MirellaAlarms.name(AlarmManager.shared.authorizationState), "count": MirellaAlarms.count()])
            return
        }
        #endif
        call.resolve(["state": "unavailable", "count": 0])
    }

    /// Fragt die Erlaubnis einmal ab.
    @objc func request(_ call: CAPPluginCall) {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            Task {
                do { call.resolve(["state": MirellaAlarms.name(try await MirellaAlarms.authorize())]) }
                catch { call.reject("Wecker-Erlaubnis fehlgeschlagen: \(error.localizedDescription)") }
            }
            return
        }
        #endif
        call.resolve(["state": "unavailable"])
    }

    /// Ersetzt alle Mirella-Wecker durch die übergebene Liste: alarms = [{ at: Millisekunden, title: Text, snooze: Sekunden (0 = ohne Schlummern) }]
    @objc func set(_ call: CAPPluginCall) {
        let raw = call.getArray("alarms", JSObject.self) ?? []
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            let now = Date()
            let items: [(Date, String, Double)] = raw.compactMap { o in
                guard let ms = o["at"] as? Double ?? (o["at"] as? Int).map(Double.init) else { return nil }
                let d = Date(timeIntervalSince1970: ms / 1000)
                let sz = o["snooze"] as? Double ?? (o["snooze"] as? Int).map(Double.init) ?? 300
                return d > now ? (d, (o["title"] as? String) ?? "Mirella Wecker", sz) : nil
            }
            Task {
                do {
                    let r = try await MirellaAlarms.replace(items)
                    call.resolve(["state": r.0, "count": r.1, "error": r.2])
                } catch { call.reject("Wecker konnte nicht gestellt werden: \(error.localizedDescription)") }
            }
            return
        }
        #endif
        call.resolve(["state": "unavailable", "count": 0])
    }
}

#if canImport(AlarmKit)
@available(iOS 26.0, *)
enum MirellaAlarms {
    static func name(_ s: AlarmManager.AuthorizationState) -> String {
        switch s {
        case .authorized: return "authorized"
        case .denied: return "denied"
        case .notDetermined: return "notDetermined"
        @unknown default: return "unknown"
        }
    }

    static func count() -> Int { ((try? AlarmManager.shared.alarms) ?? []).count }

    static func authorize() async throws -> AlarmManager.AuthorizationState {
        let m = AlarmManager.shared
        if m.authorizationState == .notDetermined { return try await m.requestAuthorization() }
        return m.authorizationState
    }

    /// Stellt alle Wecker neu. Liefert Zustand, Anzahl gestellter Wecker und den ersten Fehlertext (leer = alles gut).
    static func replace(_ items: [(Date, String, Double)]) async throws -> (String, Int, String) {
        let m = AlarmManager.shared
        let st = try await authorize()
        guard st == .authorized else { return (name(st), 0, "") }
        for a in (try? m.alarms) ?? [] { try? m.cancel(id: a.id) }
        var n = 0
        var fehler = ""
        let cal = Calendar.current
        for (date, title, snooze) in items {
            // „Ich bin wach“ öffnet Mirella (dort mit dem Schieberegler bestätigen), „Schlummern“ klingelt nach ein paar Minuten wieder.
            let stop = AlarmButton(text: "Ich bin wach", textColor: .white, systemImageName: "sun.max.fill")
            let doze = AlarmButton(text: "Schlummern", textColor: .white, systemImageName: "zzz")
            let titleRes = LocalizedStringResource(String.LocalizationValue(title))
            let alert = AlarmPresentation.Alert(title: titleRes, stopButton: stop, secondaryButton: snooze > 0 ? doze : nil, secondaryButtonBehavior: snooze > 0 ? .countdown : nil)
            let presentation = snooze > 0 ? AlarmPresentation(alert: alert, countdown: AlarmPresentation.Countdown(title: "Schlummern"), paused: nil) : AlarmPresentation(alert: alert, countdown: nil, paused: nil)
            let attrs = AlarmAttributes<MirellaAlarmMeta>(presentation: presentation, metadata: nil, tintColor: .orange)
            // Innerhalb der nächsten 23 Stunden als Uhrzeit-Wecker (wie Apples eigenes Beispiel): der klingelt verlässlich zur Minute.
            // Weiter entfernte Wecker bekommen ein festes Datum und werden beim nächsten Öffnen der App umgestellt.
            let schedule: Alarm.Schedule
            if date.timeIntervalSinceNow < 23 * 3600 {
                let t = Alarm.Schedule.Relative.Time(hour: cal.component(.hour, from: date), minute: cal.component(.minute, from: date))
                schedule = .relative(.init(time: t, repeats: .never))
            } else {
                schedule = .fixed(date)
            }
            let id = UUID()
            let cfg = AlarmManager.AlarmConfiguration<MirellaAlarmMeta>(
                countdownDuration: snooze > 0 ? Alarm.CountdownDuration(preAlert: nil, postAlert: snooze) : nil,
                schedule: schedule,
                attributes: attrs,
                stopIntent: MirellaWachIntent(alarmID: id.uuidString),
                secondaryIntent: nil,
                sound: .default)
            do {
                _ = try await m.schedule(id: id, configuration: cfg)
                n += 1
            } catch {
                if fehler.isEmpty { fehler = String(describing: error) }
            }
        }
        return (name(st), n, fehler)
    }
}
#endif
