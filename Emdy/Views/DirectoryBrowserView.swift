import SwiftUI

struct DirectoryBrowserView: View {
    @State var directory: DirectoryModel
    @State private var settings = DisplaySettings()
    @State private var currentText: String = ""
    @State private var toastMessage: ToastMessage?
    @State private var scrollToHeading: Int?

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
                .navigationSplitViewColumnWidth(min: 200, ideal: 240, max: 320)
        } detail: {
            VStack(spacing: 0) {
                Group {
                    if !currentText.isEmpty {
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
                                fileURL: directory.selectedFile,
                                isDark: settings.theme.isDark,
                                showMinimap: settings.showMinimap,
                                headings: headings,
                                scrollToHeadingIndex: scrollToHeading
                            )
                        }
                    } else {
                        EmptyStateView()
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                if !currentText.isEmpty {
                    Divider()
                    StatusBarView(
                        fileURL: directory.selectedFile,
                        wordCount: wordCount,
                        isDark: settings.theme.isDark
                    )
                }
            }
        }
        .navigationSplitViewStyle(.prominentDetail)
        .toolbar(id: "directory") {
            ToolbarItem(id: "zoom", placement: .automatic) {
                ZoomControls(settings: settings, isEnabled: !currentText.isEmpty)
            }
            ToolbarItem(id: "font", placement: .automatic) {
                FontPicker(settings: settings, isEnabled: !currentText.isEmpty)
            }
            ToolbarItem(id: "theme", placement: .automatic) {
                ThemePicker(settings: settings)
            }
            ToolbarItem(id: "actions", placement: .automatic) {
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
            ToolbarItem(id: "find", placement: .automatic) {
                FindButton(isEnabled: !currentText.isEmpty)
            }
            ToolbarItem(id: "headings", placement: .automatic) {
                HeadingNavigatorToggle(settings: settings, isEnabled: !currentText.isEmpty && !headings.isEmpty)
            }
            ToolbarItem(id: "minimap", placement: .automatic) {
                MinimapToggle(settings: settings)
            }
        }
        .markdownFileDrop()
        .toast($toastMessage, showMinimap: settings.showMinimap, isDark: settings.theme.isDark)
        .applyTheme(settings.theme)
        .background(SidebarWidthSetter(targetWidth: 240))
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
        .onReceive(NotificationCenter.default.publisher(for: .findInPage)) { _ in
            showFindBar()
        }
        .onReceive(NotificationCenter.default.publisher(for: .toggleHeadingNavigator)) { _ in
            settings.showHeadingNavigator.toggle()
        }
    }

    private func showFindBar() {
        guard let window = NSApp.keyWindow,
              let textView = EmdyTextView.findIn(window: window) else { return }
        let sender = NSMenuItem()
        sender.tag = Int(NSTextFinder.Action.showFindInterface.rawValue)
        textView.performFindPanelAction(sender)
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

/// Forces the sidebar width by finding the underlying NSSplitView and setting the divider position.
/// Also clears any autosave name so macOS doesn't restore a stale width.
private struct SidebarWidthSetter: NSViewRepresentable {
    let targetWidth: CGFloat

    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            applySidebarWidth(from: view)
        }
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        applySidebarWidth(from: nsView)
    }

    private func applySidebarWidth(from view: NSView) {
        guard let window = view.window else { return }
        var allSplitViews: [NSSplitView] = []
        collectSplitViews(in: window.contentView, into: &allSplitViews)

        for splitView in allSplitViews where splitView.isVertical {
            splitView.autosaveName = nil
            splitView.setPosition(targetWidth, ofDividerAt: 0)
        }
    }

    private func collectSplitViews(in view: NSView?, into result: inout [NSSplitView]) {
        guard let view else { return }
        if let sv = view as? NSSplitView {
            result.append(sv)
        }
        for subview in view.subviews {
            collectSplitViews(in: subview, into: &result)
        }
    }
}
