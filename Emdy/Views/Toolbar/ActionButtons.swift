import SwiftUI
import AppKit

struct ActionButtonGroup: View {
    var copyAction: () -> Void
    var printAction: () -> Void
    var pdfAction: (() -> Void)?
    var isEnabled: Bool

    var body: some View {
        ControlGroup {
            Button(action: copyAction) {
                Label("Copy", systemImage: "doc.on.doc")
            }
            .help("Copy")
            Button(action: printAction) {
                Label("Print", systemImage: "printer")
            }
            .help("Print")
            if let pdfAction {
                Button(action: pdfAction) {
                    Label("PDF", systemImage: "arrow.down.doc")
                }
                .help("Export PDF")
            }
        }
        .disabled(!isEnabled)
    }
}

struct HeadingNavigatorToggle: View {
    @Bindable var settings: DisplaySettings
    var isEnabled: Bool

    var body: some View {
        ControlGroup {
            Button {
                settings.showHeadingNavigator.toggle()
            } label: {
                Label("Headings", systemImage: "list.bullet")
            }
        }
        .help(settings.showHeadingNavigator ? "Hide Headings" : "Show Headings")
        .disabled(!isEnabled)
    }
}

struct MinimapToggle: View {
    @Bindable var settings: DisplaySettings

    var body: some View {
        ControlGroup {
            Button {
                settings.showMinimap.toggle()
            } label: {
                Label("Minimap", systemImage: "sidebar.trailing")
            }
        }
        .help(settings.showMinimap ? "Hide Minimap" : "Show Minimap")
    }
}

struct FindButton: View {
    var isEnabled: Bool

    var body: some View {
        ControlGroup {
            Button(action: { showFindBar() }) {
                Label("Find", systemImage: "magnifyingglass")
            }
        }
        .help("Find")
        .disabled(!isEnabled)
    }

    private func showFindBar() {
        guard let window = NSApp.keyWindow,
              let textView = EmdyTextView.findIn(window: window) else { return }
        let sender = NSMenuItem()
        sender.tag = Int(NSTextFinder.Action.showFindInterface.rawValue)
        textView.performFindPanelAction(sender)
    }
}
