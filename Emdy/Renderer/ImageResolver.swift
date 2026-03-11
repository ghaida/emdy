import AppKit

final class ImageResolver {
    let baseURL: URL?
    let palette: ColorPalette

    /// Custom attribute key marking a placeholder that should be replaced with a remote image.
    static let pendingImageURLAttribute: NSAttributedString.Key = .init("EmdyPendingImageURL")
    /// Custom attribute key storing the alt text for a pending image placeholder.
    static let pendingImageAltAttribute: NSAttributedString.Key = .init("EmdyPendingImageAlt")

    init(baseURL: URL?, isDark: Bool = false) {
        self.baseURL = baseURL
        self.palette = ColorPalette.current(dark: isDark)
    }

    /// Resolves an image synchronously for local files, or returns a placeholder for remote URLs.
    /// Remote placeholders are tagged with `pendingImageURLAttribute` for later async loading.
    func resolveImage(src: String, altText: String, maxWidth: CGFloat = 600) -> NSAttributedString {
        // Try local first
        if let image = loadLocalImage(src: src) {
            return imageAttachment(image: image, maxWidth: maxWidth)
        }

        // For remote URLs, return a styled placeholder tagged for async replacement
        if let url = URL(string: src), url.scheme == "http" || url.scheme == "https" {
            return remotePlaceholder(url: url, altText: altText)
        }

        // Not local and not a valid remote URL — show failure
        return failurePlaceholder(altText: altText, src: src)
    }

    /// Scans a text storage for pending remote image placeholders and loads them asynchronously.
    /// Each loaded image replaces its placeholder in-place. Calls `completion` once all loads finish.
    func loadPendingImages(in textStorage: NSTextStorage, maxWidth: CGFloat = 600, completion: (() -> Void)? = nil) {
        var pendingURLs: [(range: NSRange, url: URL, alt: String)] = []
        let fullRange = NSRange(location: 0, length: textStorage.length)

        textStorage.enumerateAttribute(Self.pendingImageURLAttribute, in: fullRange, options: []) { value, range, _ in
            guard let urlString = value as? String, let url = URL(string: urlString) else { return }
            let alt = textStorage.attribute(Self.pendingImageAltAttribute, at: range.location, effectiveRange: nil) as? String ?? ""
            pendingURLs.append((range: range, url: url, alt: alt))
        }

        guard !pendingURLs.isEmpty else {
            completion?()
            return
        }

        let group = DispatchGroup()

        // Process in reverse order so earlier ranges aren't invalidated by replacements
        for pending in pendingURLs.reversed() {
            group.enter()
            URLSession.shared.dataTask(with: pending.url) { [weak self] data, response, _ in
                DispatchQueue.main.async {
                    guard let self else { group.leave(); return }

                    // Verify the placeholder is still there and the range is valid
                    guard pending.range.location + pending.range.length <= textStorage.length else {
                        group.leave()
                        return
                    }

                    let currentValue = textStorage.attribute(Self.pendingImageURLAttribute, at: pending.range.location, effectiveRange: nil) as? String
                    guard currentValue == pending.url.absoluteString else {
                        group.leave()
                        return
                    }

                    let replacement: NSAttributedString
                    if let data, let image = NSImage(data: data) {
                        replacement = self.imageAttachment(image: image, maxWidth: maxWidth)
                    } else {
                        replacement = self.failurePlaceholder(altText: pending.alt, src: pending.url.absoluteString)
                    }

                    textStorage.replaceCharacters(in: pending.range, with: replacement)
                    group.leave()
                }
            }.resume()
        }

        group.notify(queue: .main) {
            completion?()
        }
    }

    // MARK: - Placeholders

    private func remotePlaceholder(url: URL, altText: String) -> NSAttributedString {
        let displayText = altText.isEmpty ? filenameFromURL(url) : altText
        let placeholder = NSMutableAttributedString()

        // Icon + text
        let text = "\u{29BE} Loading \(displayText)…"
        let attrs: [NSAttributedString.Key: Any] = [
            .foregroundColor: palette.muted,
            .font: NSFont.systemFont(ofSize: 12),
            Self.pendingImageURLAttribute: url.absoluteString,
            Self.pendingImageAltAttribute: altText,
        ]
        placeholder.append(NSAttributedString(string: text, attributes: attrs))
        return placeholder
    }

    private func failurePlaceholder(altText: String, src: String) -> NSAttributedString {
        let displayText: String
        if !altText.isEmpty {
            displayText = altText
        } else if let url = URL(string: src) {
            displayText = filenameFromURL(url)
        } else {
            displayText = src
        }

        let attrs: [NSAttributedString.Key: Any] = [
            .foregroundColor: palette.medium,
            .font: NSFont.systemFont(ofSize: 12),
        ]
        return NSAttributedString(string: "\u{25A1} \(displayText)", attributes: attrs)
    }

    private func filenameFromURL(_ url: URL) -> String {
        let filename = url.lastPathComponent
        return filename.isEmpty ? url.absoluteString : filename
    }

    // MARK: - Image loading

    private func loadLocalImage(src: String) -> NSImage? {
        guard let base = baseURL?.deletingLastPathComponent() else { return nil }
        let fileURL = base.appendingPathComponent(src)
        return NSImage(contentsOf: fileURL)
    }

    private func imageAttachment(image: NSImage, maxWidth: CGFloat) -> NSAttributedString {
        let size = image.size
        let scale = size.width > maxWidth ? maxWidth / size.width : 1.0
        let displaySize = NSSize(
            width: size.width * scale,
            height: size.height * scale
        )

        let attachment = NSTextAttachment()
        let cell = NSTextAttachmentCell(imageCell: image)
        cell.image?.size = displaySize
        attachment.attachmentCell = cell

        return NSAttributedString(attachment: attachment)
    }
}
