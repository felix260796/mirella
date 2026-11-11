import UIKit
import UniformTypeIdentifiers

/// „Teilen › Mirella“ aus Mail, Safari, Fotos, Dateien …: nimmt Text, Links, PDFs und Bilder an
/// und legt sie in Mirellas Eingang. Beim nächsten Öffnen fragt Mirella, was daraus werden soll.
class ShareViewController: UIViewController {
    private let label = UILabel()
    private let maxBytes = 6_000_000

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor.black.withAlphaComponent(0.35)
        let card = UIView()
        card.backgroundColor = .systemBackground
        card.layer.cornerRadius = 18
        card.translatesAutoresizingMaskIntoConstraints = false
        label.text = "Mirella nimmt es an …"
        label.font = .preferredFont(forTextStyle: .headline)
        label.textAlignment = .center
        label.numberOfLines = 0
        label.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(label)
        view.addSubview(card)
        NSLayoutConstraint.activate([
            card.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            card.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            card.widthAnchor.constraint(equalToConstant: 280),
            label.topAnchor.constraint(equalTo: card.topAnchor, constant: 24),
            label.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -24),
            label.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 18),
            label.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -18)
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        collect { items in
            let ok = !items.isEmpty && MirellaShareBox.add(items)
            self.label.text = ok ? "✓ An Mirella übergeben.\nÖffne Mirella, dann fragt sie, was daraus werden soll." : "Das konnte Mirella nicht annehmen."
            DispatchQueue.main.asyncAfter(deadline: .now() + (ok ? 1.6 : 2.2)) {
                self.extensionContext?.completeRequest(returningItems: nil)
            }
        }
    }

    private func collect(_ done: @escaping ([[String: String]]) -> Void) {
        var out: [[String: String]] = []
        let lock = NSLock()
        let group = DispatchGroup()
        let add: ([String: String]) -> Void = { e in lock.lock(); out.append(e); lock.unlock() }
        let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? []).flatMap { $0.attachments ?? [] }
        for p in providers {
            let fileType = [UTType.pdf, UTType.image].first { p.hasItemConformingToTypeIdentifier($0.identifier) }
            if let t = fileType {
                group.enter()
                p.loadDataRepresentation(forTypeIdentifier: t.identifier) { data, _ in
                    if let d = data, d.count <= self.maxBytes {
                        let pdf = t == UTType.pdf
                        let name = (p.suggestedName ?? (pdf ? "Dokument" : "Bild")) + (pdf ? ".pdf" : ".jpg")
                        add(["kind": "file", "name": name, "mime": pdf ? "application/pdf" : "image/jpeg", "data": d.base64EncodedString()])
                    } else if data != nil {
                        add(["kind": "text", "text": "Die geteilte Datei war zu groß für Mirella (über 6 MB)."])
                    }
                    group.leave()
                }
            } else if p.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                group.enter()
                p.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { item, _ in
                    if let u = item as? URL {
                        if u.isFileURL, let d = try? Data(contentsOf: u), d.count <= self.maxBytes {
                            add(["kind": "file", "name": u.lastPathComponent, "mime": UTType(filenameExtension: u.pathExtension)?.preferredMIMEType ?? "application/octet-stream", "data": d.base64EncodedString()])
                        } else if !u.isFileURL {
                            add(["kind": "url", "text": u.absoluteString])
                        }
                    }
                    group.leave()
                }
            } else if p.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                group.enter()
                p.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { item, _ in
                    if let s = item as? String, !s.isEmpty { add(["kind": "text", "text": String(s.prefix(4000))]) }
                    group.leave()
                }
            }
        }
        group.notify(queue: .main) { done(out) }
    }
}
