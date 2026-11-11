import Foundation
import Capacitor
import UIKit
import Vision
import VisionKit
import LocalAuthentication
import CallKit
import AVFoundation
import CoreLocation
import UserNotifications
import AppIntents
#if canImport(FoundationModels)
import FoundationModels
#endif
#if canImport(ActivityKit)
import ActivityKit
#endif

/// Was das iPhone selbst kann, für Mirella gebündelt. Aus der Web-App erreichbar als Capacitor.Plugins.MirellaSystem:
/// ocr (Apple-Texterkennung), liveScan (Kamera liest Nummern und Daten), faceId, Anruf-Ende (Ereignis "callEnded"),
/// setPlaces (Mitteilung beim Ankommen oder Verlassen eines Ortes), ki (Apple-KI auf dem Gerät), takeIntent (Text aus Siri/Kurzbefehl).
@objc(MirellaSystemPlugin)
public class MirellaSystemPlugin: CAPPlugin, CAPBridgedPlugin, CXCallObserverDelegate {
    public let identifier = "MirellaSystemPlugin"
    public let jsName = "MirellaSystem"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "ocr", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "liveScan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "faceId", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setPlaces", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "kiStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ki", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeIntent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "losStart", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "losEnd", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "audioRelease", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeShared", returnType: CAPPluginReturnPromise)
    ]

    private let calls = CXCallObserver()
    private var callStart: [UUID: Date] = [:]
    private var callConnected: [UUID: Date] = [:]
    private var livePending: CAPPluginCall?
    private var liveHelper: AnyObject?

    override public func load() {
        calls.setDelegate(self, queue: DispatchQueue.main)
        NotificationCenter.default.addObserver(forName: MirellaIntentBox.note, object: nil, queue: .main) { [weak self] _ in
            self?.notifyListeners("intent", data: ["text": MirellaIntentBox.peek()], retainUntilConsumed: true)
        }
    }

    // MARK: Texterkennung von Apple

    /// images: [JPEG/PNG als Base64] -> texts: [String] (eine Zeile je erkannter Textzeile)
    @objc func ocr(_ call: CAPPluginCall) {
        let images = call.getArray("images", String.self) ?? []
        DispatchQueue.global(qos: .userInitiated).async {
            var texts: [String] = []
            for b64 in images {
                guard let data = Data(base64Encoded: b64), let cg = UIImage(data: data)?.cgImage else { texts.append(""); continue }
                let req = VNRecognizeTextRequest()
                req.recognitionLevel = .accurate
                req.usesLanguageCorrection = true
                req.recognitionLanguages = ["de-DE", "en-US"]
                let orientation = CGImagePropertyOrientation(UIImage(data: data)?.imageOrientation ?? .up)
                do {
                    try VNImageRequestHandler(cgImage: cg, orientation: orientation, options: [:]).perform([req])
                    let lines = (req.results ?? []).compactMap { $0.topCandidates(1).first?.string }
                    texts.append(lines.joined(separator: "\n"))
                } catch { texts.append("") }
            }
            call.resolve(["texts": texts])
        }
    }

    // MARK: Live-Kamera liest Nummern, Daten, Adressen

    @objc func liveScan(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.reject("Die Live-Kamera braucht iOS 16"); return }
        DispatchQueue.main.async {
            guard DataScannerViewController.isSupported, DataScannerViewController.isAvailable else {
                call.reject("Die Live-Kamera geht auf diesem Gerät gerade nicht (Kamera erlaubt?)")
                return
            }
            call.keepAlive = true
            self.livePending = call
            let helper = MirellaLiveScan { [weak self] text in
                guard let self = self, let c = self.livePending else { return }
                self.livePending = nil
                self.liveHelper = nil
                if let t = text { c.resolve(["text": t]) } else { c.resolve(["cancelled": true]) }
                c.keepAlive = false
                self.bridge?.releaseCall(c)
            }
            self.liveHelper = helper
            helper.present(from: self.bridge?.viewController)
        }
    }

    // MARK: Face ID

    @objc func faceId(_ call: CAPPluginCall) {
        let ctx = LAContext()
        var err: NSError?
        guard ctx.canEvaluatePolicy(.deviceOwnerAuthentication, error: &err) else {
            call.resolve(["ok": false, "available": false])
            return
        }
        if call.getBool("check") == true { call.resolve(["ok": false, "available": true]); return }
        ctx.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: call.getString("reason") ?? "Mirella öffnen") { ok, _ in
            call.resolve(["ok": ok, "available": true])
        }
    }

    // MARK: Anruf zu Ende

    public func callObserver(_ callObserver: CXCallObserver, callChanged call: CXCall) {
        if call.hasEnded {
            let start = callStart.removeValue(forKey: call.uuid)
            let conn = callConnected.removeValue(forKey: call.uuid)
            guard call.isOutgoing || start != nil else { return }
            let secs = conn.map { Int(Date().timeIntervalSince($0)) } ?? 0
            notifyListeners("callEnded", data: ["connected": conn != nil, "seconds": secs, "outgoing": call.isOutgoing], retainUntilConsumed: true)
            return
        }
        if callStart[call.uuid] == nil { callStart[call.uuid] = Date() }
        if call.hasConnected && callConnected[call.uuid] == nil { callConnected[call.uuid] = Date() }
    }

    // MARK: Mitteilung nach Ort

    /// places: [{id, lat, lon, radius, title, body, exit}] ersetzt alle bisherigen Orts-Mitteilungen von Mirella.
    @objc func setPlaces(_ call: CAPPluginCall) {
        let places = call.getArray("places", JSObject.self) ?? []
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { reqs in
            let old = reqs.map { $0.identifier }.filter { $0.hasPrefix("mirella.ort.") }
            center.removePendingNotificationRequests(withIdentifiers: old)
            var n = 0
            for p in places.prefix(18) {
                guard let id = p["id"] as? String, let lat = (p["lat"] as? NSNumber)?.doubleValue, let lon = (p["lon"] as? NSNumber)?.doubleValue else { continue }
                let radius = (p["radius"] as? NSNumber)?.doubleValue ?? 150
                let region = CLCircularRegion(center: CLLocationCoordinate2D(latitude: lat, longitude: lon), radius: max(80, radius), identifier: "mirella.ort." + id)
                let exit = (p["exit"] as? Bool) ?? false
                region.notifyOnEntry = !exit
                region.notifyOnExit = exit
                let content = UNMutableNotificationContent()
                content.title = (p["title"] as? String) ?? "Mirella"
                content.body = (p["body"] as? String) ?? ""
                content.sound = .default
                content.userInfo = ["ort": id]
                let trig = UNLocationNotificationTrigger(region: region, repeats: true)
                center.add(UNNotificationRequest(identifier: "mirella.ort." + id, content: content, trigger: trig))
                n += 1
            }
            call.resolve(["count": n])
        }
    }

    // MARK: Apple-KI auf dem Gerät

    @objc func kiStatus(_ call: CAPPluginCall) {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            switch SystemLanguageModel.default.availability {
            case .available: call.resolve(["state": "available"])
            default: call.resolve(["state": "off"])
            }
            return
        }
        #endif
        call.resolve(["state": "unavailable"])
    }

    @objc func ki(_ call: CAPPluginCall) {
        let system = call.getString("system") ?? ""
        let user = call.getString("user") ?? ""
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            guard case .available = SystemLanguageModel.default.availability else { call.reject("Apple-KI ist auf diesem iPhone nicht eingeschaltet"); return }
            Task {
                do {
                    let session = LanguageModelSession(instructions: system)
                    let answer = try await session.respond(to: user)
                    call.resolve(["text": answer.content])
                } catch { call.reject("Apple-KI: \(error.localizedDescription)") }
            }
            return
        }
        #endif
        call.reject("Apple-KI braucht iOS 26")
    }

    // MARK: Dokumente in der Dateien-App (Auf meinem iPhone › Mirella)

    private func docURL(_ path: String) -> URL? {
        guard let base = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else { return nil }
        let clean = path.split(separator: "/").map { String($0).replacingOccurrences(of: "..", with: "").replacingOccurrences(of: ":", with: "-") }.filter { !$0.isEmpty }
        guard !clean.isEmpty else { return nil }
        return clean.reduce(base) { $0.appendingPathComponent($1) }
    }

    /// path: "Ordner/Name.pdf", data: Base64
    @objc func saveFile(_ call: CAPPluginCall) {
        guard let path = call.getString("path"), let b64 = call.getString("data"), let data = Data(base64Encoded: b64), let url = docURL(path) else { call.reject("Datei fehlt"); return }
        do {
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try data.write(to: url, options: .atomic)
            call.resolve(["ok": true])
        } catch { call.reject("Ablegen ging nicht: \(error.localizedDescription)") }
    }

    @objc func removeFile(_ call: CAPPluginCall) {
        if let path = call.getString("path"), let url = docURL(path) { try? FileManager.default.removeItem(at: url) }
        call.resolve(["ok": true])
    }

    // MARK: Live-Anzeige „Jetzt musst du los“ (Sperrbildschirm, Dynamic Island)

    /// titel, ziel, info, los (Millisekunden seit 1970). Ersetzt eine laufende Anzeige. Geht nur, solange Mirella offen ist.
    @objc func losStart(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            guard ActivityAuthorizationInfo().areActivitiesEnabled else { call.resolve(["ok": false, "reason": "aus"]); return }
            let los = Date(timeIntervalSince1970: (call.getDouble("los") ?? 0) / 1000)
            let attrs = MirellaLosAttributes(titel: call.getString("titel") ?? "Mirella", ziel: call.getString("ziel") ?? "")
            let state = MirellaLosAttributes.ContentState(los: los, info: call.getString("info") ?? "")
            Task {
                for a in Activity<MirellaLosAttributes>.activities { await a.end(nil, dismissalPolicy: .immediate) }
                do {
                    _ = try Activity.request(attributes: attrs, content: ActivityContent(state: state, staleDate: los.addingTimeInterval(20 * 60)))
                    call.resolve(["ok": true])
                } catch { call.resolve(["ok": false, "reason": error.localizedDescription]) }
            }
            return
        }
        #endif
        call.resolve(["ok": false, "reason": "unavailable"])
    }

    /// Nach dem Diktieren: Ton-Sitzung beenden und anderen Apps Bescheid geben, damit Musik von selbst weiterläuft.
    @objc func audioRelease(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .userInitiated).async {
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
            call.resolve()
        }
    }

    @objc func losEnd(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            Task {
                for a in Activity<MirellaLosAttributes>.activities { await a.end(nil, dismissalPolicy: .immediate) }
                call.resolve(["ok": true])
            }
            return
        }
        #endif
        call.resolve(["ok": true])
    }

    // MARK: Teilen nach Mirella

    /// Holt ab, was über „Teilen › Mirella“ aus anderen Apps kam: items [{kind: text|url|file, text?, name?, mime?, data?}]
    @objc func takeShared(_ call: CAPPluginCall) {
        call.resolve(["items": MirellaShareBox.take()])
    }

    // MARK: Siri / Kurzbefehle

    @objc func takeIntent(_ call: CAPPluginCall) {
        call.resolve(["text": MirellaIntentBox.take()])
    }
}

private extension CGImagePropertyOrientation {
    init(_ o: UIImage.Orientation) {
        switch o {
        case .up: self = .up
        case .down: self = .down
        case .left: self = .left
        case .right: self = .right
        case .upMirrored: self = .upMirrored
        case .downMirrored: self = .downMirrored
        case .leftMirrored: self = .leftMirrored
        case .rightMirrored: self = .rightMirrored
        @unknown default: self = .up
        }
    }
}

/// Zwischenablage für den Text, den Siri oder ein Kurzbefehl an Mirella übergibt.
enum MirellaIntentBox {
    static let note = Notification.Name("MirellaIntentText")
    private static let key = "mirella.intent.text"
    static func put(_ t: String) { UserDefaults.standard.set(t, forKey: key); NotificationCenter.default.post(name: note, object: nil) }
    static func peek() -> String { UserDefaults.standard.string(forKey: key) ?? "" }
    static func take() -> String { let t = peek(); UserDefaults.standard.removeObject(forKey: key); return t }
}

/// „Hey Siri, sag Mirella …“: öffnet Mirella und füllt das Gesagte vor (Aufgabe, Einkauf, Anruf …).
@available(iOS 16.0, *)
struct SagMirellaIntent: AppIntent {
    static let title: LocalizedStringResource = "Sag Mirella"
    static let description = IntentDescription("Mirella merkt sich, was du sagst: Aufgabe, Einkauf, Erinnerung oder Notiz.")
    static let openAppWhenRun: Bool = true

    @Parameter(title: "Was soll Mirella sich merken?", requestValueDialog: "Was soll ich mir merken?")
    var text: String

    @MainActor
    func perform() async throws -> some IntentResult {
        MirellaIntentBox.put(text)
        return .result()
    }
}

@available(iOS 16.0, *)
struct MirellaShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: SagMirellaIntent(),
            phrases: ["Sag \(.applicationName)", "Sag \(.applicationName) etwas", "Neue Aufgabe in \(.applicationName)", "Merk dir etwas in \(.applicationName)"],
            shortTitle: "Sag Mirella",
            systemImageName: "mic.fill"
        )
    }
}

/// Kamera, die Text live erkennt. Antippen eines erkannten Textes gibt ihn zurück.
@available(iOS 16.0, *)
@MainActor
final class MirellaLiveScan: NSObject, DataScannerViewControllerDelegate {
    private let done: (String?) -> Void
    private var nav: UINavigationController?
    private var finished = false

    init(done: @escaping (String?) -> Void) { self.done = done }

    func present(from parent: UIViewController?) {
        let scanner = DataScannerViewController(recognizedDataTypes: [.text()], qualityLevel: .balanced, recognizesMultipleItems: true, isHighFrameRateTrackingEnabled: false, isPinchToZoomEnabled: true, isGuidanceEnabled: true, isHighlightingEnabled: true)
        scanner.delegate = self
        scanner.title = "Tippe auf Nummer, Datum oder Text"
        scanner.navigationItem.leftBarButtonItem = UIBarButtonItem(barButtonSystemItem: .cancel, target: self, action: #selector(cancel))
        let n = UINavigationController(rootViewController: scanner)
        n.modalPresentationStyle = .fullScreen
        nav = n
        parent?.present(n, animated: true) { try? scanner.startScanning() }
    }

    private func finish(_ text: String?) {
        if finished { return }
        finished = true
        nav?.dismiss(animated: true)
        done(text)
    }

    @objc private func cancel() { finish(nil) }

    func dataScanner(_ dataScanner: DataScannerViewController, didTapOn item: RecognizedItem) {
        if case .text(let t) = item { finish(t.transcript) }
    }
}
