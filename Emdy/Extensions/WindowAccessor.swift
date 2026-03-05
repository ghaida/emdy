import SwiftUI

struct WindowAccessor: NSViewRepresentable {
    let callback: (NSWindow?) -> Void

    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        DispatchQueue.main.async {
            callback(view.window)
        }
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        DispatchQueue.main.async {
            callback(nsView.window)
        }
    }
}

extension View {
    func configureWindow(minWidth: CGFloat = 700, minHeight: CGFloat = 500) -> some View {
        background(WindowAccessor { window in
            guard let window else { return }
            window.titlebarAppearsTransparent = false
            window.isMovableByWindowBackground = true
            window.minSize = NSSize(width: minWidth, height: minHeight)
        })
    }

    func applyTheme(_ theme: AppTheme) -> some View {
        self
            .background(WindowAccessor { window in
                guard let window else { return }
                window.appearance = theme.appearance
                window.backgroundColor = ColorPalette.current(dark: theme.isDark).background
            })
            .preferredColorScheme(theme.preferredColorScheme)
    }
}
