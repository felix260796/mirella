import Foundation
#if canImport(ActivityKit)
import ActivityKit

/// Daten der Live-Anzeige „Jetzt musst du los“ (Sperrbildschirm und Dynamic Island).
/// Gehört zur App und zur Erweiterung MirellaLive, damit beide dasselbe meinen.
@available(iOS 16.2, *)
struct MirellaLosAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// Zeitpunkt, zu dem Felix los muss
        var los: Date
        /// z. B. „29 Min. mit dem Auto · Ankunft 19:00“
        var info: String
    }
    /// z. B. „Abendessen mit Tim“
    var titel: String
    /// z. B. „Tati-Café“
    var ziel: String
}
#endif
