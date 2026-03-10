import SwiftUI
import UniformTypeIdentifiers

struct WelcomeView: View {
    @Binding var isPresented: Bool
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.openWindow) private var openWindow

    private var palette: ColorPalette { .current(for: colorScheme) }

    var body: some View {
        VStack(spacing: 24) {
            // Top: icon + title
            VStack(spacing: 12) {
                Image(systemName: "doc.richtext")
                    .font(.system(size: 40, weight: .light))
                    .foregroundStyle(Color(nsColor: palette.accent))

                Text("Welcome to Emdy")
                    .font(.system(.title2, design: .monospaced))
                    .foregroundStyle(Color(nsColor: palette.headline))
            }

            // Feature rows
            VStack(spacing: 16) {
                featureRow(
                    icon: "doc.richtext",
                    title: "Read Markdown beautifully",
                    description: "Renders your files with serif, sans-serif, or monospace type"
                )
                featureRow(
                    icon: "list.bullet.indent",
                    title: "Navigate with ease",
                    description: "Jump through headings or scan the minimap"
                )
                featureRow(
                    icon: "paintpalette",
                    title: "Make it yours",
                    description: "Switch themes, adjust zoom, pick your font"
                )
                featureRow(
                    icon: "square.and.arrow.up",
                    title: "Share your way",
                    description: "Copy as rich text, export PDF, or print"
                )
            }

            // Bottom buttons
            HStack(spacing: 12) {
                Button("Open File") {
                    openFile()
                }

                Button("Open Folder") {
                    openFolder()
                }

                Button("Get Started") {
                    isPresented = false
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(nsColor: palette.accent))
                .keyboardShortcut(.defaultAction)
            }
        }
        .padding(32)
        .frame(width: 480)
    }

    private func featureRow(icon: String, title: String, description: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 24))
                .foregroundStyle(Color(nsColor: palette.accent))
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(.body, design: .monospaced, weight: .bold))
                    .foregroundStyle(Color(nsColor: palette.headline))

                Text(description)
                    .font(.system(.body, design: .monospaced))
                    .foregroundStyle(Color(nsColor: palette.medium))
            }

            Spacer()
        }
    }

    private func openFile() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowedContentTypes = [.plainText]
        panel.begin { response in
            guard response == .OK, let url = panel.url else { return }
            isPresented = false
            NSDocumentController.shared.openDocument(withContentsOf: url, display: true) { _, _, _ in }
        }
    }

    private func openFolder() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.begin { [openWindow] response in
            guard response == .OK, let url = panel.url else { return }
            isPresented = false
            openWindow(value: url)
        }
    }
}
