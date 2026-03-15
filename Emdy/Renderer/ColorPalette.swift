import AppKit
import SwiftUI

struct ColorPalette {
    // Backgrounds
    let background: NSColor
    let secondaryBackground: NSColor
    let sidebarBackground: NSColor

    // Borders
    let border: NSColor
    let subtleBorder: NSColor

    // Text
    let headline: NSColor
    let body: NSColor
    let medium: NSColor
    let muted: NSColor

    // Accents
    let accent: NSColor
    let link: NSColor
    let success: NSColor
    let successBackground: NSColor
    let error: NSColor

    // Code
    let codeBackground: NSColor
    let codeText: NSColor

    // Syntax highlighting
    let syntaxKeyword: NSColor
    let syntaxString: NSColor
    let syntaxComment: NSColor
    let syntaxNumber: NSColor

    // Blockquote
    let blockquoteBorder: NSColor
    let blockquoteText: NSColor

    // Selection highlight in sidebar
    let sidebarSelection: NSColor

    // MARK: - Resolvers

    static func current(dark: Bool) -> ColorPalette {
        dark ? .dark : .light
    }

    static func current(for colorScheme: ColorScheme) -> ColorPalette {
        colorScheme == .dark ? .dark : .light
    }
}

// MARK: - Palettes

extension ColorPalette {
    static let light = makeLight()
    static let dark = makeDark()

    private static func makeLight() -> ColorPalette {
        let bg: NSColor = NSColor(hex: "#F0F2F5")
        let secBg: NSColor = NSColor(hex: "#EDEAE4")
        let sbarBg: NSColor = NSColor(hex: "#E3DDD5")
        let brd: NSColor = NSColor(hex: "#DDDDDD")
        let sBrd: NSColor = NSColor(hex: "#DDDDDD")
        let hdl: NSColor = .black
        let bdy: NSColor = .black
        let med: NSColor = NSColor(hex: "#7A7268")
        let mut: NSColor = NSColor(hex: "#9C9488")
        let acc: NSColor = NSColor(hex: "#ED8008")
        let lnk: NSColor = NSColor(hex: "#5A6D7A")
        let suc: NSColor = NSColor(hex: "#5F6B2D")
        let sucBg: NSColor = NSColor(hex: "#F0F2EA")
        let err: NSColor = NSColor(hex: "#BF1B1B")
        return ColorPalette(
            background: bg, secondaryBackground: secBg, sidebarBackground: sbarBg,
            border: brd, subtleBorder: sBrd,
            headline: hdl, body: bdy, medium: med, muted: mut,
            accent: acc, link: lnk,
            success: suc, successBackground: sucBg, error: err,
            codeBackground: .white, codeText: bdy,
            syntaxKeyword: NSColor(hex: "#8B5A3C"),
            syntaxString: NSColor(hex: "#5F6B2D"),
            syntaxComment: NSColor(hex: "#999999"),
            syntaxNumber: lnk,
            blockquoteBorder: brd, blockquoteText: NSColor(hex: "#808080"),
            sidebarSelection: brd
        )
    }

    private static func makeDark() -> ColorPalette {
        let bg: NSColor = NSColor(hex: "#17181A")
        let secBg: NSColor = NSColor(hex: "#28251F")
        let sbarBg: NSColor = NSColor(hex: "#232019")
        let brd: NSColor = NSColor(hex: "#3A3A3A")
        let sBrd: NSColor = NSColor(hex: "#3A3A3A")
        let hdl: NSColor = NSColor(hex: "#B9B9B9")
        let bdy: NSColor = NSColor(hex: "#B9B9B9")
        let med: NSColor = NSColor(hex: "#8A8278")
        let mut: NSColor = NSColor(hex: "#6B6359")
        let acc: NSColor = NSColor(hex: "#F09830")
        let lnk: NSColor = NSColor(hex: "#8AAAB8")
        let suc: NSColor = NSColor(hex: "#8A9B50")
        let sucBg: NSColor = NSColor(hex: "#2A2C1E")
        let err: NSColor = NSColor(hex: "#D94040")
        return ColorPalette(
            background: bg, secondaryBackground: secBg, sidebarBackground: sbarBg,
            border: brd, subtleBorder: sBrd,
            headline: hdl, body: bdy, medium: med, muted: mut,
            accent: acc, link: lnk,
            success: suc, successBackground: sucBg, error: err,
            codeBackground: NSColor(hex: "#131314"), codeText: bdy,
            syntaxKeyword: NSColor(hex: "#D4A574"),
            syntaxString: NSColor(hex: "#8A9B50"),
            syntaxComment: NSColor(hex: "#707070"),
            syntaxNumber: lnk,
            blockquoteBorder: brd, blockquoteText: NSColor(hex: "#909090"),
            sidebarSelection: brd
        )
    }
}
