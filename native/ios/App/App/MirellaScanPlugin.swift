import Foundation
import Capacitor
import UIKit
import VisionKit

/// Dokumenten-Scanner von Apple für Mirella: mehrere Seiten nacheinander, Ränder werden automatisch erkannt und entzerrt.
/// Aus der Web-App erreichbar als Capacitor.Plugins.MirellaScan.scan() -> { pages: [JPEG als Base64], cancelled? }
@objc(MirellaScanPlugin)
public class MirellaScanPlugin: CAPPlugin, CAPBridgedPlugin, VNDocumentCameraViewControllerDelegate {
    public let identifier = "MirellaScanPlugin"
    public let jsName = "MirellaScan"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise)
    ]
    private var pending: CAPPluginCall?

    @objc func scan(_ call: CAPPluginCall) {
        guard VNDocumentCameraViewController.isSupported else {
            call.reject("Scannen geht auf diesem Gerät nicht")
            return
        }
        call.keepAlive = true
        pending = call
        DispatchQueue.main.async {
            let vc = VNDocumentCameraViewController()
            vc.delegate = self
            self.bridge?.viewController?.present(vc, animated: true)
        }
    }

    private func finish(_ controller: UIViewController, _ work: (CAPPluginCall) -> Void) {
        controller.dismiss(animated: true)
        guard let call = pending else { return }
        pending = nil
        work(call)
        call.keepAlive = false
        bridge?.releaseCall(call)
    }

    public func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
        var pages: [String] = []
        for i in 0..<scan.pageCount {
            let img = scan.imageOfPage(at: i)
            let s = min(1, 2000 / max(img.size.width, img.size.height))
            let size = CGSize(width: img.size.width * s, height: img.size.height * s)
            let fmt = UIGraphicsImageRendererFormat()
            fmt.scale = 1
            let small = UIGraphicsImageRenderer(size: size, format: fmt).image { _ in
                img.draw(in: CGRect(origin: .zero, size: size))
            }
            if let d = small.jpegData(compressionQuality: 0.8) { pages.append(d.base64EncodedString()) }
        }
        finish(controller) { $0.resolve(["pages": pages]) }
    }

    public func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
        finish(controller) { $0.resolve(["pages": [], "cancelled": true]) }
    }

    public func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
        finish(controller) { $0.reject("Scannen hat nicht geklappt: \(error.localizedDescription)") }
    }
}
