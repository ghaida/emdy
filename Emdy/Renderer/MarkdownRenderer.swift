import AppKit
import cmark_gfm
import cmark_gfm_extensions

final class MarkdownRenderer {

    static let headingAnchorAttribute: NSAttributedString.Key = .init("EmdyHeadingAnchor")

    let fontProvider: FontProvider
    let imageResolver: ImageResolver
    let palette: ColorPalette
    private var headingCount = 0

    init(fontFamily: FontFamily, zoomLevel: CGFloat, fileURL: URL? = nil, isDark: Bool = false) {
        self.fontProvider = FontProvider(family: fontFamily, zoom: zoomLevel)
        self.imageResolver = ImageResolver(baseURL: fileURL, isDark: isDark)
        self.palette = ColorPalette.current(dark: isDark)
    }

    func render(_ markdown: String) -> NSAttributedString {
        cmark_gfm_core_extensions_ensure_registered()

        guard let parser = cmark_parser_new(CMARK_OPT_DEFAULT) else {
            return NSAttributedString(string: markdown)
        }
        defer { cmark_parser_free(parser) }

        let extensionNames = ["table", "strikethrough", "autolink", "tasklist"]
        for name in extensionNames {
            if let ext = cmark_find_syntax_extension(name) {
                cmark_parser_attach_syntax_extension(parser, ext)
            }
        }

        cmark_parser_feed(parser, markdown, markdown.utf8.count)
        guard let doc = cmark_parser_finish(parser) else {
            return NSAttributedString(string: markdown)
        }
        defer { cmark_node_free(doc) }

        headingCount = 0
        let result = NSMutableAttributedString()
        renderNode(doc, into: result, context: RenderContext())
        return result
    }

    // MARK: - Render context

    private struct RenderContext {
        var isBold = false
        var isItalic = false
        var isStrikethrough = false
        var linkURL: String?
        var headingLevel: Int = 0
        var isCode = false
        var isBlockquote = false
        var listLevel: Int = 0
        var isOrderedList = false
        var listItemIndex: Int = 0
        var isTableHeader = false
        var followsList = false
    }

    // MARK: - AST walker

    private func renderNode(_ node: UnsafeMutablePointer<cmark_node>, into result: NSMutableAttributedString, context: RenderContext) {
        var ctx = context
        let type = cmark_node_get_type(node)
        let typeString = String(cString: cmark_node_get_type_string(node))

        switch type {
        case CMARK_NODE_DOCUMENT:
            renderChildren(of: node, into: result, context: ctx)

        case CMARK_NODE_PARAGRAPH:
            if previousSiblingIsList(node) {
                ctx.followsList = true
            }
            renderChildren(of: node, into: result, context: ctx)
            if !isLastChild(node) && !isInsideTightList(node) {
                result.append(newline())
            }

        case CMARK_NODE_HEADING:
            ctx.headingLevel = Int(cmark_node_get_heading_level(node))
            if result.length > 0 {
                result.append(newline())
            }
            let headingStart = result.length
            renderChildren(of: node, into: result, context: ctx)
            let headingRange = NSRange(location: headingStart, length: result.length - headingStart)
            result.addAttribute(Self.headingAnchorAttribute, value: headingCount, range: headingRange)
            headingCount += 1
            result.append(newline())

        case CMARK_NODE_TEXT:
            if let literal = cmark_node_get_literal(node) {
                let text = String(cString: literal)
                result.append(styledText(text, context: ctx))
            }

        case CMARK_NODE_SOFTBREAK:
            result.append(styledText(" ", context: ctx))

        case CMARK_NODE_LINEBREAK:
            result.append(newline())

        case CMARK_NODE_EMPH:
            ctx.isItalic = true
            renderChildren(of: node, into: result, context: ctx)

        case CMARK_NODE_STRONG:
            ctx.isBold = true
            renderChildren(of: node, into: result, context: ctx)

        case CMARK_NODE_LINK:
            if let url = cmark_node_get_url(node) {
                ctx.linkURL = String(cString: url)
            }
            renderChildren(of: node, into: result, context: ctx)

        case CMARK_NODE_IMAGE:
            if let url = cmark_node_get_url(node) {
                let urlStr = String(cString: url)
                let altText = extractAltText(from: node)
                let imageAttr = imageResolver.resolveImage(src: urlStr, altText: altText)
                result.append(imageAttr)
                result.append(newline())
            }

        case CMARK_NODE_CODE:
            if let literal = cmark_node_get_literal(node) {
                let text = String(cString: literal)
                var codeCtx = ctx
                codeCtx.isCode = true
                var attrs = baseAttributes(for: codeCtx)
                attrs[.backgroundColor] = palette.codeBackground
                result.append(NSAttributedString(string: text, attributes: attrs))
            }

        case CMARK_NODE_CODE_BLOCK:
            if result.length > 0 && !result.string.hasSuffix("\n") {
                result.append(newline())
            }
            if let literal = cmark_node_get_literal(node) {
                let text = String(cString: literal)
                let language = cmark_node_get_fence_info(node).flatMap {
                    let s = String(cString: $0)
                    return s.isEmpty ? nil : s
                }

                let highlighter = SyntaxHighlighter(
                    keyword: palette.syntaxKeyword,
                    string: palette.syntaxString,
                    comment: palette.syntaxComment,
                    number: palette.syntaxNumber,
                    baseColor: palette.codeText,
                    font: fontProvider.code
                )
                let highlighted = NSMutableAttributedString(attributedString: highlighter.highlight(text, language: language))

                let codeBlock = NSTextBlock()
                codeBlock.backgroundColor = palette.codeBackground
                codeBlock.setValue(100, type: .percentageValueType, for: .width)
                codeBlock.setWidth(12, type: .absoluteValueType, for: .padding)
                codeBlock.setWidth(8, type: .absoluteValueType, for: .margin, edge: .minY)
                codeBlock.setWidth(24, type: .absoluteValueType, for: .margin, edge: .maxY)

                // Apply the text block to every paragraph in the code block
                let fullRange = NSRange(location: 0, length: highlighted.length)
                highlighted.enumerateAttribute(.paragraphStyle, in: fullRange, options: []) { value, range, _ in
                    let para = (value as? NSMutableParagraphStyle) ?? NSMutableParagraphStyle()
                    para.textBlocks = [codeBlock]
                    highlighted.addAttribute(.paragraphStyle, value: para, range: range)
                }

                result.append(highlighted)
                if !text.hasSuffix("\n") {
                    result.append(newline())
                }
            }

        case CMARK_NODE_BLOCK_QUOTE:
            ctx.isBlockquote = true
            renderChildren(of: node, into: result, context: ctx)

        case CMARK_NODE_LIST:
            let isOrdered = cmark_node_get_list_type(node) == CMARK_ORDERED_LIST
            ctx.listLevel += 1
            ctx.isOrderedList = isOrdered
            ctx.listItemIndex = 0
            renderChildren(of: node, into: result, context: ctx)
            if !result.string.hasSuffix("\n") {
                result.append(newline())
            }

        case CMARK_NODE_ITEM:
            ctx.listItemIndex += 1
            let indent = String(repeating: "    ", count: max(0, ctx.listLevel - 1))
            let bullet: String
            if ctx.isOrderedList {
                bullet = "\(ctx.listItemIndex). "
            } else {
                bullet = "\u{2022} "
            }
            result.append(styledText("\(indent)\(bullet)", context: ctx))
            renderChildren(of: node, into: result, context: ctx)
            if !isLastChild(node) {
                result.append(newline())
            }

        case CMARK_NODE_THEMATIC_BREAK:
            let rule = NSMutableAttributedString(string: "\n\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\n")
            rule.addAttribute(.foregroundColor, value: palette.border, range: NSRange(location: 0, length: rule.length))
            rule.addAttribute(.font, value: fontProvider.body, range: NSRange(location: 0, length: rule.length))
            result.append(rule)

        case CMARK_NODE_HTML_BLOCK, CMARK_NODE_HTML_INLINE:
            if let literal = cmark_node_get_literal(node) {
                result.append(styledText(String(cString: literal), context: ctx))
            }

        default:
            switch typeString {
            case "strikethrough":
                ctx.isStrikethrough = true
                renderChildren(of: node, into: result, context: ctx)

            case "table":
                if result.length > 0 { result.append(newline()) }
                result.append(renderTable(node))
                result.append(newline())

            case "table_header", "table_row", "table_cell":
                // Handled by renderTable; fallback if reached directly.
                renderChildren(of: node, into: result, context: ctx)

            case "tasklist":
                let checked = cmark_gfm_extensions_get_tasklist_item_checked(node)
                let checkbox = checked ? "\u{2611} " : "\u{2610} "
                result.append(styledText(checkbox, context: ctx))
                renderChildren(of: node, into: result, context: ctx)

            default:
                renderChildren(of: node, into: result, context: ctx)
            }
        }
    }

    private func renderChildren(of node: UnsafeMutablePointer<cmark_node>, into result: NSMutableAttributedString, context: RenderContext) {
        var child = cmark_node_first_child(node)
        while let c = child {
            renderNode(c, into: result, context: context)
            child = cmark_node_next(c)
        }
    }

    // MARK: - Styling

    private func styledText(_ text: String, context: RenderContext) -> NSAttributedString {
        NSAttributedString(string: text, attributes: baseAttributes(for: context))
    }

    private func baseAttributes(for ctx: RenderContext) -> [NSAttributedString.Key: Any] {
        var attrs: [NSAttributedString.Key: Any] = [:]

        let font: NSFont
        if ctx.isCode {
            font = ctx.isBold ? fontProvider.codeBold : fontProvider.code
        } else if ctx.isTableHeader {
            font = fontProvider.tableHeader
        } else if ctx.headingLevel > 0 {
            switch ctx.headingLevel {
            case 1: font = fontProvider.h1
            case 2: font = fontProvider.h2
            case 3: font = fontProvider.h3
            case 4: font = fontProvider.h4
            case 5: font = fontProvider.h5
            default: font = fontProvider.h6
            }
        } else if ctx.isBold && ctx.isItalic {
            font = fontProvider.bodyBoldItalic
        } else if ctx.isBold {
            font = fontProvider.bodyBold
        } else if ctx.isItalic {
            font = fontProvider.bodyItalic
        } else {
            font = fontProvider.body
        }
        attrs[.font] = font

        if ctx.isCode {
            attrs[.foregroundColor] = palette.codeText
        } else if ctx.isBlockquote {
            attrs[.foregroundColor] = palette.blockquoteText
        } else if ctx.headingLevel > 0 {
            attrs[.foregroundColor] = palette.headline
        } else if ctx.linkURL != nil {
            attrs[.foregroundColor] = palette.link
        } else {
            attrs[.foregroundColor] = palette.body
        }

        if let url = ctx.linkURL {
            attrs[.link] = url
            attrs[.underlineStyle] = NSUnderlineStyle.single.rawValue
        }

        if ctx.isStrikethrough {
            attrs[.strikethroughStyle] = NSUnderlineStyle.single.rawValue
        }

        let para = NSMutableParagraphStyle()
        if ctx.headingLevel > 0 {
            para.paragraphSpacingBefore = ctx.headingLevel == 1 ? 32 : 24
            para.paragraphSpacing = 12
            para.lineSpacing = 0
        } else if ctx.listLevel > 0 {
            para.lineSpacing = fontProvider.bodyLineHeight - font.pointSize
            para.paragraphSpacing = 0
        } else {
            para.lineSpacing = fontProvider.bodyLineHeight - font.pointSize
            para.paragraphSpacing = 16
            if ctx.followsList {
                para.paragraphSpacingBefore = 20
                para.paragraphSpacing = 20
            }
        }

        if ctx.isBlockquote {
            para.firstLineHeadIndent = 20
            para.headIndent = 20
        }

        attrs[.paragraphStyle] = para
        return attrs
    }

    private func newline() -> NSAttributedString {
        NSAttributedString(string: "\n", attributes: [.font: fontProvider.body])
    }

    // MARK: - Table rendering (NSTextTable)

    private func renderTable(_ tableNode: UnsafeMutablePointer<cmark_node>) -> NSAttributedString {
        // Collect rows and detect header.
        struct CellInfo {
            let node: UnsafeMutablePointer<cmark_node>
            let isHeader: Bool
        }
        var rowData: [[CellInfo]] = []
        var rowNode = cmark_node_first_child(tableNode)
        while let row = rowNode {
            let typeStr = String(cString: cmark_node_get_type_string(row))
            let isHeader = (typeStr == "table_header")
            var cells: [CellInfo] = []
            var cellNode = cmark_node_first_child(row)
            while let cell = cellNode {
                cells.append(CellInfo(node: cell, isHeader: isHeader))
                cellNode = cmark_node_next(cell)
            }
            rowData.append(cells)
            rowNode = cmark_node_next(row)
        }

        guard !rowData.isEmpty else { return NSAttributedString() }
        let colCount = rowData.map(\.count).max() ?? 0

        let table = NSTextTable()
        table.numberOfColumns = colCount
        table.layoutAlgorithm = .fixedLayoutAlgorithm

        let result = NSMutableAttributedString()
        let cellPadding: CGFloat = 12

        for (rowIndex, row) in rowData.enumerated() {
            for (colIndex, cellInfo) in row.enumerated() {
                let block = NSTextTableBlock(table: table,
                    startingRow: rowIndex, rowSpan: 1,
                    startingColumn: colIndex, columnSpan: 1)
                block.setContentWidth(0, type: .absoluteValueType)
                block.setWidth(cellPadding, type: .absoluteValueType, for: .padding)

                // Collapsed borders: top + left on every cell,
                // right on last column, bottom on last row.
                let bw: CGFloat = 0.5
                block.setBorderColor(palette.border)
                block.setWidth(bw, type: .absoluteValueType, for: .border, edge: .minY) // top
                block.setWidth(bw, type: .absoluteValueType, for: .border, edge: .minX) // left
                if colIndex == row.count - 1 {
                    block.setWidth(bw, type: .absoluteValueType, for: .border, edge: .maxX) // right
                }
                if rowIndex == rowData.count - 1 {
                    block.setWidth(bw, type: .absoluteValueType, for: .border, edge: .maxY) // bottom
                }

                // Render cell content.
                var ctx = RenderContext()
                if cellInfo.isHeader { ctx.isTableHeader = true }
                let cellContent = NSMutableAttributedString()
                renderChildren(of: cellInfo.node, into: cellContent, context: ctx)

                // Build paragraph style with the text block.
                let para = NSMutableParagraphStyle()
                para.textBlocks = [block]
                para.lineSpacing = 4
                para.paragraphSpacing = 2

                // Apply paragraph style across the entire cell.
                let fullRange = NSRange(location: 0, length: cellContent.length)
                cellContent.addAttribute(.paragraphStyle, value: para, range: fullRange)

                result.append(cellContent)
                result.append(NSAttributedString(string: "\n", attributes: [
                    .paragraphStyle: para,
                    .font: cellInfo.isHeader ? fontProvider.tableHeader : fontProvider.body,
                ]))
            }
        }

        return result
    }

    // MARK: - Helpers

    private func isLastChild(_ node: UnsafeMutablePointer<cmark_node>) -> Bool {
        cmark_node_next(node) == nil
    }

    private func previousSiblingIsList(_ node: UnsafeMutablePointer<cmark_node>) -> Bool {
        guard let prev = cmark_node_previous(node) else { return false }
        return cmark_node_get_type(prev) == CMARK_NODE_LIST
    }

    /// Extracts alt text from an image node by concatenating its child text nodes.
    private func extractAltText(from node: UnsafeMutablePointer<cmark_node>) -> String {
        var parts: [String] = []
        var child = cmark_node_first_child(node)
        while let c = child {
            if cmark_node_get_type(c) == CMARK_NODE_TEXT,
               let literal = cmark_node_get_literal(c) {
                parts.append(String(cString: literal))
            }
            child = cmark_node_next(c)
        }
        return parts.joined()
    }

    private func isInsideTightList(_ node: UnsafeMutablePointer<cmark_node>) -> Bool {
        var parent = cmark_node_parent(node)
        while let p = parent {
            if cmark_node_get_type(p) == CMARK_NODE_LIST {
                return cmark_node_get_list_tight(p) != 0
            }
            parent = cmark_node_parent(p)
        }
        return false
    }
}
