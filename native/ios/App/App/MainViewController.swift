import UIKit
import Capacitor

/// Meldet Mirellas eigene Erweiterungen (echter Wecker, Telefonbuch zurückschreiben, Dokumenten-Scanner) bei der Web-App an.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(MirellaAlarmPlugin())
        bridge?.registerPluginInstance(MirellaContactsPlugin())
        bridge?.registerPluginInstance(MirellaScanPlugin())
        bridge?.registerPluginInstance(MirellaSystemPlugin())
    }
}
