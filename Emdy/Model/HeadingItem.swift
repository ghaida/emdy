import Foundation
import cmark_gfm
import cmark_gfm_extensions

struct HeadingItem: Identifiable, Equatable {
    let id: String
    let title: String
    let level: Int
    let slug: String

    /// Extract all headings from a Markdown string.
    static func extract(from markdown: String) -> [HeadingItem] {
        cmark_gfm_core_extensions_ensure_registered()

        guard let parser = cmark_parser_new(CMARK_OPT_DEFAULT) else { return [] }
        defer { cmark_parser_free(parser) }

        for name in ["table", "strikethrough", "autolink", "tasklist"] {
            if let ext = cmark_find_syntax_extension(name) {
                cmark_parser_attach_syntax_extension(parser, ext)
            }
        }

        cmark_parser_feed(parser, markdown, markdown.utf8.count)
        guard let doc = cmark_parser_finish(parser) else { return [] }
        defer { cmark_node_free(doc) }

        var headings: [HeadingItem] = []
        collectHeadings(doc, into: &headings)
        return headings
    }

    private static func collectHeadings(
        _ node: UnsafeMutablePointer<cmark_node>,
        into result: inout [HeadingItem]
    ) {
        if cmark_node_get_type(node) == CMARK_NODE_HEADING {
            let level = Int(cmark_node_get_heading_level(node))
            let title = collectText(from: node)
            let slug = slugify(title)
            let id = "\(slug)-\(result.count)"
            result.append(HeadingItem(id: id, title: title, level: level, slug: slug))
        }
        var child = cmark_node_first_child(node)
        while let c = child {
            collectHeadings(c, into: &result)
            child = cmark_node_next(c)
        }
    }

    private static func collectText(from node: UnsafeMutablePointer<cmark_node>) -> String {
        if let literal = cmark_node_get_literal(node) {
            return String(cString: literal)
        }
        var text = ""
        var child = cmark_node_first_child(node)
        while let c = child {
            text += collectText(from: c)
            child = cmark_node_next(c)
        }
        return text
    }

    /// Generate a GitHub-style slug from heading text.
    static func slugify(_ text: String) -> String {
        text.lowercased()
            .components(separatedBy: CharacterSet.alphanumerics.union(CharacterSet(charactersIn: " -")).inverted)
            .joined()
            .replacingOccurrences(of: " ", with: "-")
            .replacingOccurrences(of: "--", with: "-")
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    }
}
