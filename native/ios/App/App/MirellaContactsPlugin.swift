import Foundation
import Capacitor
import Contacts
import UIKit

/// Schreibt Änderungen aus Mirella zurück ins iPhone-Telefonbuch (Name, Geburtstag, neue Nummer, neue E-Mail)
/// und legt neue Kontakte an. Zusammenführen und Löschen gibt es nur auf ausdrücklichen Wunsch (Mirella fragt vorher nach),
/// dazu eine Sicherung des ganzen Telefonbuchs als Datei.
/// Aus der Web-App erreichbar als Capacitor.Plugins.MirellaContacts.
@objc(MirellaContactsPlugin)
public class MirellaContactsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MirellaContactsPlugin"
    public let jsName = "MirellaContacts"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "upsert", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "merge", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "backup", returnType: CAPPluginReturnPromise)
    ]

    private static let keys: [CNKeyDescriptor] = [
        CNContactGivenNameKey, CNContactFamilyNameKey, CNContactBirthdayKey,
        CNContactPhoneNumbersKey, CNContactEmailAddressesKey
    ].map { $0 as CNKeyDescriptor }

    private static let mergeKeys: [CNKeyDescriptor] = [
        CNContactGivenNameKey, CNContactFamilyNameKey, CNContactBirthdayKey, CNContactOrganizationNameKey,
        CNContactPhoneNumbersKey, CNContactEmailAddressesKey, CNContactPostalAddressesKey, CNContactUrlAddressesKey
    ].map { $0 as CNKeyDescriptor }

    /// merge({ keep, drop }): Nummern, E-Mails, Adressen und Geburtstag von „drop“ wandern zu „keep“, danach wird „drop“ gelöscht.
    /// Antwort: { id, phones: [{ number, label }] }
    @objc func merge(_ call: CAPPluginCall) {
        guard let keep = call.getString("keep"), let drop = call.getString("drop"), !keep.isEmpty, !drop.isEmpty, keep != drop else {
            call.reject("Zum Zusammenführen fehlen zwei verschiedene Kontakte"); return
        }
        DispatchQueue.global(qos: .userInitiated).async {
            let store = CNContactStore()
            do {
                let ks = MirellaContactsPlugin.mergeKeys
                guard let a = try store.unifiedContact(withIdentifier: keep, keysToFetch: ks).mutableCopy() as? CNMutableContact,
                      let b = try store.unifiedContact(withIdentifier: drop, keysToFetch: ks).mutableCopy() as? CNMutableContact else {
                    call.reject("Kontakt lässt sich nicht ändern"); return
                }
                for p in b.phoneNumbers {
                    let d = MirellaContactsPlugin.digits(p.value.stringValue)
                    if !a.phoneNumbers.contains(where: { MirellaContactsPlugin.digits($0.value.stringValue) == d }) {
                        a.phoneNumbers.append(CNLabeledValue(label: p.label, value: p.value))
                    }
                }
                for e in b.emailAddresses {
                    let v = (e.value as String).lowercased()
                    if !a.emailAddresses.contains(where: { ($0.value as String).lowercased() == v }) {
                        a.emailAddresses.append(CNLabeledValue(label: e.label, value: e.value))
                    }
                }
                for x in b.postalAddresses {
                    if !a.postalAddresses.contains(where: { $0.value.street == x.value.street && $0.value.city == x.value.city }) {
                        a.postalAddresses.append(CNLabeledValue(label: x.label, value: x.value))
                    }
                }
                for u in b.urlAddresses {
                    if !a.urlAddresses.contains(where: { ($0.value as String) == (u.value as String) }) {
                        a.urlAddresses.append(CNLabeledValue(label: u.label, value: u.value))
                    }
                }
                if a.birthday == nil, let bd = b.birthday { a.birthday = bd }
                if a.givenName.isEmpty { a.givenName = b.givenName }
                if a.familyName.isEmpty { a.familyName = b.familyName }
                if a.organizationName.isEmpty { a.organizationName = b.organizationName }
                let req = CNSaveRequest()
                req.update(a)
                req.delete(b)
                try store.execute(req)
                let phones: [[String: String]] = a.phoneNumbers.map {
                    ["number": $0.value.stringValue, "label": CNLabeledValue<NSString>.localizedString(forLabel: $0.label ?? "")]
                }
                call.resolve(["id": a.identifier, "phones": phones])
            } catch {
                call.reject("Telefonbuch: \(error.localizedDescription)")
            }
        }
    }

    /// remove({ id }): löscht einen Kontakt aus dem iPhone-Telefonbuch. Mirella fragt vorher nach.
    @objc func remove(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), !id.isEmpty else { call.reject("Kontakt fehlt"); return }
        DispatchQueue.global(qos: .userInitiated).async {
            let store = CNContactStore()
            do {
                guard let c = try store.unifiedContact(withIdentifier: id, keysToFetch: [CNContactGivenNameKey as CNKeyDescriptor]).mutableCopy() as? CNMutableContact else {
                    call.reject("Kontakt lässt sich nicht löschen"); return
                }
                let req = CNSaveRequest()
                req.delete(c)
                try store.execute(req)
                call.resolve(["ok": true])
            } catch {
                call.reject("Telefonbuch: \(error.localizedDescription)")
            }
        }
    }

    /// backup({ share? }): sichert das ganze Telefonbuch als vCard-Datei unter „Auf meinem iPhone › Mirella › Sicherung“
    /// und öffnet das Teilen-Menü, damit die Datei in die eigene Ablage kann. Antwort: { count, file }
    @objc func backup(_ call: CAPPluginCall) {
        let share = call.getBool("share") ?? true
        DispatchQueue.global(qos: .userInitiated).async {
            let store = CNContactStore()
            do {
                var all: [CNContact] = []
                let req = CNContactFetchRequest(keysToFetch: [CNContactVCardSerialization.descriptorForRequiredKeys()])
                try store.enumerateContacts(with: req) { c, _ in all.append(c) }
                let data = try CNContactVCardSerialization.data(with: all)
                let f = DateFormatter()
                f.dateFormat = "yyyy-MM-dd_HHmm"
                let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("Sicherung", isDirectory: true)
                try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
                let url = dir.appendingPathComponent("Telefonbuch_\(f.string(from: Date())).vcf")
                try data.write(to: url, options: .atomic)
                let count = all.count
                DispatchQueue.main.async {
                    if share, let vc = self.bridge?.viewController {
                        let av = UIActivityViewController(activityItems: [url], applicationActivities: nil)
                        av.popoverPresentationController?.sourceView = vc.view
                        av.popoverPresentationController?.sourceRect = CGRect(x: vc.view.bounds.midX, y: vc.view.bounds.midY, width: 0, height: 0)
                        vc.present(av, animated: true)
                    }
                    call.resolve(["count": count, "file": url.lastPathComponent])
                }
            } catch {
                call.reject("Sicherung ging nicht: \(error.localizedDescription)")
            }
        }
    }

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
