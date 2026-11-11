import Foundation
#if canImport(AlarmKit)
import AlarmKit

/// Gehört zu Mirellas Weckern. Liegt in der App und in der Erweiterung MirellaLive,
/// damit das iPhone den Wecker auch auf dem Sperrbildschirm zeigen kann.
@available(iOS 26.0, *)
struct MirellaAlarmMeta: AlarmMetadata {}
#endif
