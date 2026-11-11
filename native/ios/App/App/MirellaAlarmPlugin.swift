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

    /// Ersetzt alle Mirella-Wecker durch die übergebene Liste: alarms = [{ at: Millisekunden, title: Text }]
    @objc func set(_ call: CAPPluginCall) {
        let raw = call.getArray("alarms", JSObject.self) ?? []
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            let now = Date()
            let items: [(Date, String)] = raw.compactMap { o in
                guard let ms = o["at"] as? Double ?? (o["at"] as? Int).map(Double.init) else { return nil }
                let d = Date(timeIntervalSince1970: ms / 1000)
                return d > now ? (d, (o["title"] as? String) ?? "Mirella Wecker") : nil
            }
            Task {
                do {
                    let r = try await MirellaAlarms.replace(items)
                    call.resolve(["state": r.0, "count": r.1])
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
struct MirellaAlarmMeta: AlarmMetadata {}

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

    static func replace(_ items: [(Date, String)]) async throws -> (String, Int) {
        let m = AlarmManager.shared
        let st = try await authorize()
        guard st == .authorized else { return (name(st), 0) }
        for a in (try? m.alarms) ?? [] { try? m.cancel(id: a.id) }
        var n = 0
        for (date, title) in items {
            let stop = AlarmButton(text: "Stopp", textColor: .white, systemImageName: "stop.circle")
            let alert = AlarmPresentation.Alert(title: LocalizedStringResource(String.LocalizationValue(title)), stopButton: stop, secondaryButton: nil, secondaryButtonBehavior: nil)
            let attrs = AlarmAttributes<MirellaAlarmMeta>(presentation: AlarmPresentation(alert: alert, countdown: nil, paused: nil), metadata: nil, tintColor: .orange)
            let cfg = AlarmManager.AlarmConfiguration<MirellaAlarmMeta>.alarm(schedule: .fixed(date), attributes: attrs, stopIntent: nil, secondaryIntent: nil, sound: .default)
            _ = try await m.schedule(id: UUID(), configuration: cfg)
            n += 1
        }
        return (name(st), n)
    }
}
#endif
