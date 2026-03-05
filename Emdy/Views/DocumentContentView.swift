import SwiftUI

struct DocumentContentView: View {
    var document: MarkdownDocument
    @State private var settings = DisplaySettings()
    @State private var toastMessage: ToastMessage?
    @State private var currentText: String
    @State private var fileWatcher: FileWatcher?

    init(document: MarkdownDocument) {
        self.document = document
        self._currentText = State(initialValue: document.text)
    }

    private var hasContent: Bool {
        !currentText.isEmpty
    }

    private var renderedText: NSAttributedString {
        MarkdownRenderer(
            fontFamily: settings.fontFamily,
            zoomLevel: settings.zoomLevel,
            fileURL: document.fileURL,
            isDark: settings.theme.isDark
        ).render(currentText)
    }

    /// Always light palette and print-friendly sizes for copy/print/PDF.
    private var exportText: NSAttributedString {
        MarkdownRenderer(
            fontFamily: settings.fontFamily,
            zoomLevel: 0.75,
            fileURL: document.fileURL,
            isDark: false
        ).render(currentText)
    }

    var body: some View {
        Group {
            if hasContent {
                MarkdownTextView(
                    markdown: currentText,
                    fontFamily: settings.fontFamily,
                    zoomLevel: settings.zoomLevel,
                    fileURL: document.fileURL,
                    isDark: settings.theme.isDark
                )
            } else {
                EmptyStateView()
            }
        }
        .applyTheme(settings.theme)
        .toolbar {
            ToolbarItemGroup(placement: .automatic) {
                ZoomControls(settings: settings, isEnabled: hasContent)
                FontPicker(settings: settings, isEnabled: hasContent)
                ThemePicker(settings: settings)
            }

            ToolbarItem(placement: .primaryAction) {
                ActionButtonGroup(
                    copyAction: {
                        PasteboardService.copyRTF(from: exportText, range: NSRange())
                    },
                    printAction: {
                        PrintService.print(attributedString: exportText)
                    },
                    pdfAction: {
                        let name = document.fileURL?.lastPathComponent ?? "document.md"
                        if PDFExportService.savePDF(attributedString: exportText, suggestedName: name) {
                            toastMessage = ToastMessage(message: "PDF saved successfully")
                        }
                    },
                    isEnabled: hasContent
                )
            }
        }
        .toast($toastMessage)
        .onAppear {
            setupFileWatcher()
        }
        .onReceive(NotificationCenter.default.publisher(for: .zoomIn)) { _ in
            settings.zoomIn()
        }
        .onReceive(NotificationCenter.default.publisher(for: .zoomOut)) { _ in
            settings.zoomOut()
        }
        .onReceive(NotificationCenter.default.publisher(for: .zoomReset)) { _ in
            settings.zoomReset()
        }
        .onReceive(NotificationCenter.default.publisher(for: .setFont)) { notification in
            if let family = notification.object as? FontFamily {
                settings.fontFamily = family
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .setTheme)) { notification in
            if let theme = notification.object as? AppTheme {
                settings.theme = theme
            }
        }
    }

    private func setupFileWatcher() {
        guard let url = document.fileURL else { return }
        fileWatcher = FileWatcher(url: url) { [self] in
            if let newText = try? String(contentsOf: url, encoding: .utf8) {
                currentText = newText
            }
        }
    }
}
