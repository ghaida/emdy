import SwiftUI
import AppKit

enum FontFamily: String, CaseIterable {
    case sansSerif = "Sans-Serif"
    case serif = "Serif"
    case monospace = "Monospace"
}

enum AppTheme: String, CaseIterable {
    case light = "Light"
    case dark = "Dark"
    case system = "System"

    var isDark: Bool {
        switch self {
        case .light: return false
        case .dark: return true
        case .system:
            return NSApp.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
        }
    }

    var preferredColorScheme: ColorScheme? {
        switch self {
        case .light: return .light
        case .dark: return .dark
        case .system: return nil
        }
    }

    var appearance: NSAppearance? {
        switch self {
        case .light: return NSAppearance(named: .aqua)
        case .dark: return NSAppearance(named: .darkAqua)
        case .system: return nil
        }
    }
}

@Observable
final class DisplaySettings {
    var fontFamily: FontFamily {
        didSet { UserDefaults.standard.set(fontFamily.rawValue, forKey: "fontFamily") }
    }

    var zoomLevel: CGFloat {
        didSet { UserDefaults.standard.set(zoomLevel, forKey: "zoomLevel") }
    }

    var theme: AppTheme {
        didSet { UserDefaults.standard.set(theme.rawValue, forKey: "appTheme") }
    }

    var showMinimap: Bool {
        didSet { UserDefaults.standard.set(showMinimap, forKey: "showMinimap") }
    }

    var showHeadingNavigator: Bool {
        didSet { UserDefaults.standard.set(showHeadingNavigator, forKey: "showHeadingNavigator") }
    }

    static let zoomMin: CGFloat = 0.5
    static let zoomMax: CGFloat = 3.0
    static let zoomStep: CGFloat = 0.1

    init() {
        if let saved = UserDefaults.standard.string(forKey: "fontFamily"),
           let family = FontFamily(rawValue: saved) {
            self.fontFamily = family
        } else {
            self.fontFamily = .sansSerif
        }

        let savedZoom = UserDefaults.standard.double(forKey: "zoomLevel")
        self.zoomLevel = savedZoom > 0 ? CGFloat(savedZoom) : 1.0

        if let savedTheme = UserDefaults.standard.string(forKey: "appTheme"),
           let theme = AppTheme(rawValue: savedTheme) {
            self.theme = theme
        } else {
            self.theme = .system
        }

        if UserDefaults.standard.object(forKey: "showMinimap") != nil {
            self.showMinimap = UserDefaults.standard.bool(forKey: "showMinimap")
        } else {
            self.showMinimap = true
        }

        if UserDefaults.standard.object(forKey: "showHeadingNavigator") != nil {
            self.showHeadingNavigator = UserDefaults.standard.bool(forKey: "showHeadingNavigator")
        } else {
            self.showHeadingNavigator = false
        }
    }

    func zoomIn() {
        zoomLevel = min(zoomLevel + Self.zoomStep, Self.zoomMax)
    }

    func zoomOut() {
        zoomLevel = max(zoomLevel - Self.zoomStep, Self.zoomMin)
    }

    func zoomReset() {
        zoomLevel = 1.0
    }
}
