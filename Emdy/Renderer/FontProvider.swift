import AppKit

struct FontProvider {
    let family: FontFamily
    let zoom: CGFloat

    private func scaled(_ size: CGFloat) -> CGFloat {
        (size * zoom).rounded(.toNearestOrAwayFromZero)
    }

    // MARK: - Document fonts

    var h1: NSFont { font(size: 28, weight: .bold) }
    var h2: NSFont { font(size: 20, weight: .semibold) }
    var h3: NSFont { font(size: 17, weight: .semibold) }
    var h4: NSFont { font(size: 15, weight: .semibold) }
    var h5: NSFont { font(size: 14, weight: .semibold) }
    var h6: NSFont { font(size: 13, weight: .semibold) }

    var body: NSFont { font(size: 15, weight: .regular) }
    var bodyBold: NSFont { font(size: 15, weight: .bold) }
    var bodyItalic: NSFont { italicFont(size: 15) }
    var bodyBoldItalic: NSFont { boldItalicFont(size: 15) }

    var code: NSFont { monoFont(size: 13, weight: .regular) }
    var codeBold: NSFont { monoFont(size: 13, weight: .semibold) }

    var tableHeader: NSFont { font(size: 13, weight: .bold) }
    var tableBody: NSFont { font(size: 13, weight: .regular) }

    // MARK: - Line heights

    var bodyLineHeight: CGFloat { scaled(15) * 1.6 }
    var headingLineHeight: CGFloat { scaled(15) * 1.3 }

    // MARK: - Private helpers

    private func font(size: CGFloat, weight: NSFont.Weight) -> NSFont {
        let s = scaled(size)
        switch family {
        case .serif:
            return NSFont(name: serifName(for: weight), size: s)
                ?? NSFont.systemFont(ofSize: s, weight: weight)
        case .sansSerif:
            return NSFont(name: sansName(for: weight), size: s)
                ?? NSFont.systemFont(ofSize: s, weight: weight)
        case .monospace:
            return monoFont(size: size, weight: weight)
        }
    }

    private func italicFont(size: CGFloat) -> NSFont {
        let s = scaled(size)
        switch family {
        case .serif:
            return NSFont(name: "IBMPlexSerif-Italic", size: s)
                ?? italicSystemFont(size: s)
        case .sansSerif:
            return NSFont(name: "IBMPlexSans-Italic", size: s)
                ?? italicSystemFont(size: s)
        case .monospace:
            return NSFont(name: "IBMPlexMono-Italic", size: s)
                ?? italicSystemFont(size: s)
        }
    }

    private func boldItalicFont(size: CGFloat) -> NSFont {
        let s = scaled(size)
        switch family {
        case .serif:
            return NSFont(name: "IBMPlexSerif-BoldItalic", size: s)
                ?? italicSystemFont(size: s, weight: .bold)
        case .sansSerif:
            return NSFont(name: "IBMPlexSans-BoldItalic", size: s)
                ?? italicSystemFont(size: s, weight: .bold)
        case .monospace:
            return NSFont(name: "IBMPlexMono-BoldItalic", size: s)
                ?? italicSystemFont(size: s, weight: .bold)
        }
    }

    func monoFont(size: CGFloat, weight: NSFont.Weight) -> NSFont {
        let s = scaled(size)
        let name: String
        switch weight {
        case .bold:
            name = "IBMPlexMono-Bold"
        case .semibold:
            name = "IBMPlexMono-SemiBold"
        default:
            name = "IBMPlexMono-Regular"
        }
        return NSFont(name: name, size: s)
            ?? NSFont.monospacedSystemFont(ofSize: s, weight: weight)
    }

    // MARK: - Font name mapping

    private func serifName(for weight: NSFont.Weight) -> String {
        switch weight {
        case .bold: return "IBMPlexSerif-Bold"
        case .semibold: return "IBMPlexSerif-SemiBold"
        default: return "IBMPlexSerif-Regular"
        }
    }

    private func sansName(for weight: NSFont.Weight) -> String {
        switch weight {
        case .bold: return "IBMPlexSans-Bold"
        case .semibold: return "IBMPlexSans-SemiBold"
        default: return "IBMPlexSans-Regular"
        }
    }

    private func italicSystemFont(size: CGFloat, weight: NSFont.Weight = .regular) -> NSFont {
        let base = NSFont.systemFont(ofSize: size, weight: weight)
        let descriptor = base.fontDescriptor.withSymbolicTraits(.italic)
        return NSFont(descriptor: descriptor, size: size) ?? base
    }
}
