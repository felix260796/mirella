import UIKit
import Capacitor

/// Meldet Mirellas eigene Erweiterungen (echter Wecker) bei der Web-App an.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(MirellaAlarmPlugin())
    }
}
