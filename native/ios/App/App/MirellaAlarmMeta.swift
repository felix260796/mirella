import Foundation
#if canImport(AlarmKit)
import AlarmKit
import AppIntents

/// Gehört zu Mirellas Weckern. Liegt in der App und in der Erweiterung MirellaLive,
/// damit das iPhone den Wecker auch auf dem Sperrbildschirm zeigen kann.
@available(iOS 26.0, *)
struct MirellaAlarmMeta: AlarmMetadata {}

/// Läuft, wenn beim klingelnden Wecker „Ich bin wach“ getippt wird: öffnet Mirella.
/// Dort bestätigt man mit dem Schieberegler. Erst dann gehen die weiteren Wecker aus und der Countdown startet.
@available(iOS 26.0, *)
struct MirellaWachIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Mirella öffnen"
    static let openAppWhenRun: Bool = true
    static let isDiscoverable: Bool = false

    @Parameter(title: "Wecker")
    var alarmID: String

    init() { self.alarmID = "" }
    init(alarmID: String) { self.alarmID = alarmID }

    func perform() async throws -> some IntentResult { .result() }
}
#endif
