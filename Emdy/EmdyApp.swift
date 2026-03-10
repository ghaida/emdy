import SwiftUI

@main
struct EmdyApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @State private var showDefaultHandlerPrompt = false
    @State private var showShortcutSheet = false
    @State private var showWelcome = false

    var body: some Scene {
        DocumentGroup(viewing: MarkdownDocument.self) { file in
            DocumentContentView(document: file.document, fileURL: file.fileURL)
                .configureWindow()
                .sheet(isPresented: $showDefaultHandlerPrompt) {
                    DefaultHandlerSheet(isPresented: $showDefaultHandlerPrompt)
                }
                .sheet(isPresented: $showShortcutSheet) {
                    ShortcutCheatSheet(isPresented: $showShortcutSheet)
                }
                .sheet(isPresented: $showWelcome) {
                    WelcomeView(isPresented: $showWelcome)
                }
                .onReceive(NotificationCenter.default.publisher(for: .showShortcutCheatSheet)) { _ in
                    showShortcutSheet = true
                }
                .onReceive(NotificationCenter.default.publisher(for: .showWelcome)) { _ in
                    showWelcome = true
                }
                .onAppear {
                    if DefaultHandlerService.shouldShowPrompt {
                        showDefaultHandlerPrompt = true
                    }
                    if !UserDefaults.standard.bool(forKey: "hasShownWelcome") {
                        showWelcome = true
                        UserDefaults.standard.set(true, forKey: "hasShownWelcome")
                    }
                }
        }
        .defaultSize(width: 800, height: 600)
        .commands {
            EmdyMenuCommands()
            OpenCommands()
        }

        WindowGroup("Directory Browser", for: URL.self) { $url in
            if let url {
                DirectoryBrowserView(directory: DirectoryModel(directoryURL: url))
                    .configureWindow()
            }
        }
        .defaultSize(width: 1200, height: 800)
    }
}

struct OpenCommands: Commands {
    @Environment(\.openWindow) private var openWindow

    var body: some Commands {
        CommandGroup(replacing: .newItem) {
            Button("Open\u{2026}") {
                let panel = NSOpenPanel()
                panel.canChooseFiles = true
                panel.canChooseDirectories = true
                panel.allowsMultipleSelection = false
                panel.message = "Select a file or folder to open"
                panel.prompt = "Open"

                panel.begin { [openWindow] response in
                    guard response == .OK, let url = panel.url else { return }
                    panel.close()

                    var isDir: ObjCBool = false
                    FileManager.default.fileExists(atPath: url.path, isDirectory: &isDir)

                    if isDir.boolValue {
                        openWindow(value: url)
                    } else {
                        NSDocumentController.shared.openDocument(
                            withContentsOf: url, display: true) { _, _, _ in }
                    }
                }
            }
            .keyboardShortcut("o", modifiers: .command)
        }
    }
}
