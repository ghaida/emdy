import SwiftUI

struct ThemePicker: View {
    @Bindable var settings: DisplaySettings

    private var icon: String {
        switch settings.theme {
        case .light: return "sun.max"
        case .dark: return "moon"
        case .system: return "circle.lefthalf.filled"
        }
    }

    var body: some View {
        Menu {
            ForEach(AppTheme.allCases, id: \.self) { theme in
                Button {
                    settings.theme = theme
                    NotificationCenter.default.post(name: .setTheme, object: theme)
                } label: {
                    if settings.theme == theme {
                        Label(theme.rawValue, systemImage: "checkmark")
                    } else {
                        Text(theme.rawValue)
                    }
                }
            }
        } label: {
            Label("Theme", systemImage: icon)
        }
    }
}
