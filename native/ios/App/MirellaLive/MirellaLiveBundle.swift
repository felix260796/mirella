import WidgetKit
import SwiftUI
import ActivityKit
#if canImport(AlarmKit)
import AlarmKit
#endif

/// Erweiterung von Mirella: zeigt den Countdown „Jetzt musst du los“ auf dem Sperrbildschirm und in der Dynamic Island.
@main
struct MirellaLiveBundle: WidgetBundle {
    var body: some Widget {
        MirellaLosLive()
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            MirellaAlarmLive()
        }
        #endif
    }
}

#if canImport(AlarmKit)
/// Anzeige für Mirellas Wecker auf dem Sperrbildschirm und in der Dynamic Island.
@available(iOS 26.0, *)
struct MirellaAlarmLive: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AlarmAttributes<MirellaAlarmMeta>.self) { context in
            HStack(spacing: 12) {
                Image(systemName: "alarm.fill")
                    .font(.title2)
                    .foregroundStyle(.orange)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Mirella Wecker")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.75))
                    Text(context.attributes.presentation.alert.title)
                        .font(.headline)
                        .foregroundStyle(.white)
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
            }
            .padding(16)
            .activityBackgroundTint(Color.black.opacity(0.88))
            .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "alarm.fill").foregroundStyle(.orange)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.attributes.presentation.alert.title).font(.headline).lineLimit(1)
                }
            } compactLeading: {
                Image(systemName: "alarm.fill").foregroundStyle(.orange)
            } compactTrailing: {
                Text("Wecker").font(.caption2)
            } minimal: {
                Image(systemName: "alarm.fill").foregroundStyle(.orange)
            }
        }
    }
}
#endif

struct MirellaCountdown: View {
    let los: Date
    var body: some View {
        if los > Date() {
            Text(timerInterval: Date()...los, countsDown: true)
                .monospacedDigit()
        } else {
            Text("Jetzt los")
        }
    }
}

struct MirellaLosLive: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: MirellaLosAttributes.self) { context in
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(context.state.los > Date() ? "Losgehen in" : "Jetzt musst du los")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.75))
                    MirellaCountdown(los: context.state.los)
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                }
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 4) {
                    Text(context.attributes.titel)
                        .font(.headline)
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(context.attributes.ziel)
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.85))
                        .lineLimit(1)
                    Text(context.state.info)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.75))
                        .lineLimit(1)
                }
            }
            .padding(16)
            .activityBackgroundTint(Color.black.opacity(0.88))
            .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.attributes.titel).font(.headline).lineLimit(1)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    MirellaCountdown(los: context.state.los).font(.title2.bold())
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.attributes.ziel + " · " + context.state.info).font(.caption).lineLimit(1)
                }
            } compactLeading: {
                Image(systemName: "figure.walk")
            } compactTrailing: {
                MirellaCountdown(los: context.state.los).frame(maxWidth: 56)
            } minimal: {
                Image(systemName: "figure.walk")
            }
        }
    }
}
