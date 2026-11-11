import Foundation
import Capacitor
import Contacts

/// Schreibt Änderungen aus Mirella zurück ins iPhone-Telefonbuch (Name, Geburtstag, neue Nummer, neue E-Mail)
/// und legt neue Kontakte an. Es wird nie etwas gelöscht und nie eine vorhandene Nummer entfernt.
/// Aus der Web-App erreichbar als Capacitor.Plugins.MirellaContacts.
@objc(MirellaContactsPlugin)
public class MirellaContactsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MirellaContactsPlugin"
    public let jsName = "MirellaContacts"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "upsert", returnType: CAPPluginReturnPromise)
    ]

    private static let keys: [CNKeyDescriptor] = [
        CNContactGivenNameKey, CNContactFamilyNameKey, CNContactBirthdayKey,
        CNContactPhoneNumbersKey, CNContactEmailAddressesKey
    ].map { $0 as CNKeyDescriptor }

    private static func digits(_ s: String) -> String {
        let d = s.filter { $0.isNumber }
        return String(d.suffix(9)) // Vergleich über die letzten Ziffern, damit +49 und 0 gleich gelten
    }

    /// upsert({ id?, given?, family?, birthday?: "JJJJ-MM-TT" (Jahr 1604 = unbekannt), phone?, email? })
    /// Mit id: vorhandenen Kontakt ändern. Ohne id: neuen Kontakt anlegen. Antwort: { id, created, changed }
    @objc func upsert(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        let given = call.getString("given")
        let family = call.getString("family")
        let birthday = call.getString("birthday") ?? ""
        let phone = (call.getString("phone") ?? "").trimmingCharacters(in: .whitespaces)
        let email = (call.getString("email") ?? "").trimmingCharacters(in: .whitespaces)

        DispatchQueue.global(qos: .userInitiated).async {
            let store = CNContactStore()
            do {
                var contact: CNMutableContact
                var created = false
                if id.isEmpty {
                    contact = CNMutableContact()
                    created = true
                } else {
                    let found = try store.unifiedContact(withIdentifier: id, keysToFetch: MirellaContactsPlugin.keys)
                    guard let m = found.mutableCopy() as? CNMutableContact else {
                        call.reject("Kontakt lässt sich nicht ändern"); return
                    }
                    contact = m
                }
                var changed = created
                if let g = given, g != contact.givenName { contact.givenName = g; changed = true }
                if let f = family, f != contact.familyName { contact.familyName = f; changed = true }

                let parts = birthday.split(separator: "-").compactMap { Int($0) }
                if parts.count == 3 {
                    var dc = DateComponents()
                    dc.calendar = Calendar(identifier: .gregorian)
                    if parts[0] > 1900 { dc.year = parts[0] }
                    dc.month = parts[1]
                    dc.day = parts[2]
                    let old = contact.birthday
                    if old?.month != dc.month || old?.day != dc.day || (dc.year != nil && old?.year != dc.year) {
                        contact.birthday = dc; changed = true
                    }
                }
                if !phone.isEmpty {
                    let want = MirellaContactsPlugin.digits(phone)
                    let has = contact.phoneNumbers.contains { MirellaContactsPlugin.digits($0.value.stringValue) == want }
                    if !has {
                        contact.phoneNumbers.append(CNLabeledValue(label: CNLabelPhoneNumberMobile, value: CNPhoneNumber(stringValue: phone)))
                        changed = true
                    }
                }
                if !email.isEmpty {
                    let has = contact.emailAddresses.contains { ($0.value as String).lowercased() == email.lowercased() }
                    if !has {
                        contact.emailAddresses.append(CNLabeledValue(label: CNLabelHome, value: email as NSString))
                        changed = true
                    }
                }
                if changed {
                    let req = CNSaveRequest()
                    if created { req.add(contact, toContainerWithIdentifier: nil) } else { req.update(contact) }
                    try store.execute(req)
                }
                call.resolve(["id": contact.identifier, "created": created, "changed": changed])
            } catch {
                call.reject("Telefonbuch: \(error.localizedDescription)")
            }
        }
    }
}
