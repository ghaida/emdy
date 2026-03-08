import AppKit

enum LinkHandler {
    static func handleLink(_ link: Any, fileURL: URL?, textView: NSTextView? = nil, headings: [HeadingItem] = []) -> Bool {
        let urlString: String
        if let string = link as? String {
            urlString = string
        } else if let url = link as? URL {
            urlString = url.absoluteString
        } else {
            return false
        }

        // Anchor links (scroll within document)
        if urlString.hasPrefix("#") {
            let slug = String(urlString.dropFirst())
            return scrollToHeading(slug: slug, textView: textView, headings: headings)
        }

        // Relative .md links — open in Emdy
        if isMarkdownLink(urlString), let resolved = resolveRelativeURL(urlString, relativeTo: fileURL) {
            NSWorkspace.shared.open(resolved)
            return true
        }

        // External links — open in default browser
        if let url = URL(string: urlString), url.scheme == "http" || url.scheme == "https" || url.scheme == "mailto" {
            NSWorkspace.shared.open(url)
            return true
        }

        // Relative non-markdown links — try to resolve and open
        if let resolved = resolveRelativeURL(urlString, relativeTo: fileURL) {
            NSWorkspace.shared.open(resolved)
            return true
        }

        return false
    }

    private static func isMarkdownLink(_ urlString: String) -> Bool {
        let lower = urlString.lowercased()
        let extensions = [".md", ".markdown", ".mdown", ".mkd"]
        return extensions.contains(where: { lower.hasSuffix($0) || lower.contains($0 + "#") })
    }

    private static func resolveRelativeURL(_ path: String, relativeTo fileURL: URL?) -> URL? {
        guard let base = fileURL?.deletingLastPathComponent() else { return nil }
        let cleanPath = path.components(separatedBy: "#").first ?? path
        let resolved = base.appendingPathComponent(cleanPath)
        return FileManager.default.fileExists(atPath: resolved.path) ? resolved : nil
    }

    /// Scroll to the heading matching the given slug.
    static func scrollToHeading(slug: String, textView: NSTextView?, headings: [HeadingItem]) -> Bool {
        guard let textView = textView,
              let textStorage = textView.textStorage else { return false }

        // Find the heading index that matches this slug
        guard let headingIndex = headings.firstIndex(where: { $0.slug == slug }) else { return false }

        return scrollToHeadingIndex(headingIndex, in: textView, textStorage: textStorage)
    }

    /// Scroll to a heading by its index in the document.
    static func scrollToHeadingIndex(_ index: Int, in textView: NSTextView, textStorage: NSTextStorage) -> Bool {
        let fullRange = NSRange(location: 0, length: textStorage.length)
        var targetRange: NSRange?

        textStorage.enumerateAttribute(MarkdownRenderer.headingAnchorAttribute, in: fullRange, options: []) { value, range, stop in
            if let headingIdx = value as? Int, headingIdx == index {
                targetRange = range
                stop.pointee = true
            }
        }

        guard let range = targetRange else { return false }

        guard let layoutManager = textView.layoutManager,
              let textContainer = textView.textContainer else { return false }

        let glyphRange = layoutManager.glyphRange(forCharacterRange: range, actualCharacterRange: nil)
        let rect = layoutManager.boundingRect(forGlyphRange: glyphRange, in: textContainer)

        let origin = textView.textContainerOrigin
        let scrollY = rect.minY + origin.y - 20

        if let scrollView = textView.enclosingScrollView {
            let point = NSPoint(x: 0, y: max(0, scrollY))
            scrollView.contentView.scroll(to: point)
            scrollView.reflectScrolledClipView(scrollView.contentView)
        }

        return true
    }
}
