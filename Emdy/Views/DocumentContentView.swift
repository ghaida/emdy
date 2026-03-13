import SwiftUI

struct DocumentContentView: View {
    var document: MarkdownDocument
    let fileURL: URL?
    @State private var settings = DisplaySettings()
    @State private var toastMessage: ToastMessage?
    @State private var currentText: String
    @State private var fileWatcher: FileWatcher?
    @State private var scrollToHeading: Int?
    @State private var fileDeleted = false

    init(document: MarkdownDocument, fileURL: URL? = nil) {
        self.document = document
        self.fileURL = fileURL ?? fileURL
        self._currentText = State(initialValue: document.text)
    }

    private var hasContent: Bool {
        !currentText.isEmpty && !fileDeleted
    }

    private var headings: [HeadingItem] {
        HeadingItem.extract(from: currentText)
    }

    private var wordCount: Int {
        var count = 0
        currentText.enumerateSubstrings(in: currentText.startIndex..., options: [.byWords, .substringNotRequired]) { _, _, _, _ in
            count += 1
        }
        return count
    }

    private var renderedText: NSAttributedString {
        MarkdownRenderer(
            fontFamily: settings.fontFamily,
            zoomLevel: settings.zoomLevel,
            fileURL: fileURL,
            isDark: settings.theme.isDark
        ).render(currentText)
    }

    /// Always light palette and print-friendly sizes for copy/print/PDF.
    private var exportText: NSAttributedString {
        MarkdownRenderer(
            fontFamily: settings.fontFamily,
            zoomLevel: 0.75,
            fileURL: fileURL,
            isDark: false
        ).render(currentText)
    }

    var body: some View {
        VStack(spacing: 0) {
            Group {
                if hasContent {
                    HStack(spacing: 0) {
                        if settings.showHeadingNavigator && !headings.isEmpty {
                            HeadingNavigator(
                                headings: headings,
                                isDark: settings.theme.isDark
                            ) { index in
                                scrollToHeading = index
                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                                    scrollToHeading = nil
                                }
                            }
                            Divider()
                        }
                        MarkdownTextView(
                            markdown: currentText,
                            fontFamily: settings.fontFamily,
                            zoomLevel: settings.zoomLevel,
                            fileURL: fileURL,
                            isDark: settings.theme.isDark,
                            showMinimap: settings.showMinimap,
                            headings: headings,
                            scrollToHeadingIndex: scrollToHeading
                        )
                    }
                } else if fileDeleted {
                    EmptyStateView(
                        icon: "trash",
                        title: "This file has been deleted or moved",
                        subtitle: fileURL?.lastPathComponent
                    )
                } else {
                    EmptyStateView()
                }
            }
            if hasContent {
                Divider()
                StatusBarView(
                    fileURL: fileURL,
                    wordCount: wordCount,
                    isDark: settings.theme.isDark
                )
            }
        }
        .applyTheme(settings.theme)
        .toolbar(id: "document") {
            ToolbarItem(id: "zoom", placement: .automatic) {
                ZoomControls(settings: settings, isEnabled: hasContent)
            }
            ToolbarItem(id: "font", placement: .automatic) {
                FontPicker(settings: settings, isEnabled: hasContent)
            }
            ToolbarItem(id: "theme", placement: .automatic) {
                ThemePicker(settings: settings)
            }
            ToolbarItem(id: "actions", placement: .automatic) {
                ActionButtonGroup(
                    copyAction: {
                        PasteboardService.copyRTF(from: exportText, range: NSRange())
                        toastMessage = ToastMessage(message: "Copied to clipboard")
                    },
                    printAction: {
                        PrintService.print(attributedString: exportText)
                    },
                    pdfAction: { exportPDF() },
                    isEnabled: hasContent
                )
            }
            ToolbarItem(id: "find", placement: .automatic) {
                FindButton(isEnabled: hasContent)
            }
            ToolbarItem(id: "headings", placement: .automatic) {
                HeadingNavigatorToggle(settings: settings, isEnabled: hasContent && !headings.isEmpty)
            }
            ToolbarItem(id: "minimap", placement: .automatic) {
                MinimapToggle(settings: settings)
            }
        }
        .markdownFileDrop()
        .toast($toastMessage, showMinimap: settings.showMinimap, isDark: settings.theme.isDark)
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
        .onReceive(NotificationCenter.default.publisher(for: .findInPage)) { _ in
            showFindBar()
        }
        .onReceive(NotificationCenter.default.publisher(for: .findNext)) { _ in
            findNextOrPrevious(next: true)
        }
        .onReceive(NotificationCenter.default.publisher(for: .findPrevious)) { _ in
            findNextOrPrevious(next: false)
        }
        .onReceive(NotificationCenter.default.publisher(for: .copyNotification)) { _ in
            toastMessage = ToastMessage(message: "Copied to clipboard")
        }
        .onReceive(NotificationCenter.default.publisher(for: .refreshDocument)) { _ in
            reloadFromDisk()
        }
        .onReceive(NotificationCenter.default.publisher(for: .toggleHeadingNavigator)) { _ in
            settings.showHeadingNavigator.toggle()
        }
        .onReceive(NotificationCenter.default.publisher(for: .toggleMinimap)) { _ in
            settings.showMinimap.toggle()
        }
        .onReceive(NotificationCenter.default.publisher(for: .exportPDF)) { _ in
            exportPDF()
        }
    }

    private func showFindBar() {
        guard let window = NSApp.keyWindow,
              let textView = EmdyTextView.findIn(window: window) else { return }
        let sender = NSMenuItem()
        sender.tag = Int(NSTextFinder.Action.showFindInterface.rawValue)
        textView.performFindPanelAction(sender)
    }

    private func findNextOrPrevious(next: Bool) {
        guard let window = NSApp.keyWindow,
              let textView = EmdyTextView.findIn(window: window) else { return }
        if next {
            textView.performFindNext()
        } else {
            textView.performFindPrevious()
        }
    }

    private func reloadFromDisk() {
        guard let url = fileURL else { return }
        guard FileManager.default.fileExists(atPath: url.path) else {
            fileDeleted = true
            return
        }
        guard let newText = try? String(contentsOf: url, encoding: .utf8) else { return }
        fileDeleted = false
        currentText = newText
    }

    private func exportPDF() {
        let name = fileURL?.lastPathComponent ?? "document.md"
        if PDFExportService.savePDF(attributedString: exportText, suggestedName: name) {
            toastMessage = ToastMessage(message: "PDF saved successfully")
        }
    }

    private func setupFileWatcher() {
        guard let url = fileURL else { return }
        fileWatcher = FileWatcher(url: url) { event in
            switch event {
            case .modified:
                reloadFromDisk()
            case .deleted:
                fileDeleted = true
            }
        }
    }
}
