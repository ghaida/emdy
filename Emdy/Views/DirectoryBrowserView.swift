import SwiftUI

struct DirectoryBrowserView: View {
    @State var directory: DirectoryModel
    @State private var settings = DisplaySettings()
    @State private var currentText: String = ""
    @State private var toastMessage: ToastMessage?

    private var renderedText: NSAttributedString {
        MarkdownRenderer(
            fontFamily: settings.fontFamily,
            zoomLevel: settings.zoomLevel,
            fileURL: directory.selectedFile,
            isDark: settings.theme.isDark
        ).render(currentText)
    }

    /// Always light palette and print-friendly sizes for copy/print/PDF.
    private var exportText: NSAttributedString {
        MarkdownRenderer(
            fontFamily: settings.fontFamily,
            zoomLevel: 0.75,
            fileURL: directory.selectedFile,
            isDark: false
        ).render(currentText)
    }

    var body: some View {
        NavigationSplitView {
            SidebarFileList(directory: directory)
                .navigationSplitViewColumnWidth(min: 200, ideal: 240, max: 300)
        } detail: {
            Group {
                if !currentText.isEmpty {
                    MarkdownTextView(
                        markdown: currentText,
                        fontFamily: settings.fontFamily,
                        zoomLevel: settings.zoomLevel,
                        fileURL: directory.selectedFile,
                        isDark: settings.theme.isDark
                    )
                } else {
                    EmptyStateView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .navigationSplitViewStyle(.prominentDetail)
        .toolbar {
            ToolbarItemGroup(placement: .automatic) {
                ZoomControls(settings: settings, isEnabled: !currentText.isEmpty)
                FontPicker(settings: settings, isEnabled: !currentText.isEmpty)
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
                        let name = directory.selectedFile?.lastPathComponent ?? "document.md"
                        if PDFExportService.savePDF(attributedString: exportText, suggestedName: name) {
                            toastMessage = ToastMessage(message: "PDF saved successfully")
                        }
                    },
                    isEnabled: !currentText.isEmpty
                )
            }
        }
        .toast($toastMessage)
        .applyTheme(settings.theme)
        .background(WindowAccessor { window in
            guard let window else { return }
            window.title = directory.selectedFile?.lastPathComponent
                ?? directory.directoryURL.lastPathComponent
        })
        .onChange(of: directory.selectedFile) { _, newValue in
            loadFile(newValue)
        }
        .onAppear {
            loadFile(directory.selectedFile)
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

    private func loadFile(_ url: URL?) {
        guard let url else {
            currentText = ""
            return
        }
        var isDir: ObjCBool = false
        FileManager.default.fileExists(atPath: url.path, isDirectory: &isDir)
        if isDir.boolValue { return }
        currentText = (try? String(contentsOf: url, encoding: .utf8)) ?? ""
    }
}
