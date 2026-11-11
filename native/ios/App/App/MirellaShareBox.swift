import Foundation
import Security

/// Gemeinsamer Eingang für „Teilen nach Mirella“: Die Erweiterung legt hier ab, die App holt es beim nächsten Öffnen.
/// Liegt im Schlüsselbund des iPhones in einer Gruppe, die nur Mirella und ihre Erweiterung lesen dürfen.
enum MirellaShareBox {
    private static let service = "de.brenzinger.mirella.teilen"
    private static let account = "eingang"

    private static var group: String? {
        guard let prefix = Bundle.main.object(forInfoDictionaryKey: "MirellaAppIdPrefix") as? String, !prefix.isEmpty else { return nil }
        return prefix + "de.brenzinger.mirella.shared"
    }

    private static func query() -> [String: Any] {
        var q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
        if let g = group { q[kSecAttrAccessGroup as String] = g }
        return q
    }

    static func read() -> [[String: String]] {
        var q = query()
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data,
              let list = try? JSONSerialization.jsonObject(with: data) as? [[String: String]] else { return [] }
        return list
    }

    @discardableResult
    static func write(_ items: [[String: String]]) -> Bool {
        SecItemDelete(query() as CFDictionary)
        if items.isEmpty { return true }
        guard let data = try? JSONSerialization.data(withJSONObject: items) else { return false }
        var q = query()
        q[kSecValueData as String] = data
        q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        return SecItemAdd(q as CFDictionary, nil) == errSecSuccess
    }

    @discardableResult
    static func add(_ new: [[String: String]]) -> Bool { write(read() + new) }

    static func take() -> [[String: String]] { let l = read(); if !l.isEmpty { write([]) }; return l }
}
