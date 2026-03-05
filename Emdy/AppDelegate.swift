import AppKit
import SwiftUI

class AppDelegate: NSObject, NSApplicationDelegate {

    private var directoryWindow: NSWindow?
    private var panelIsOpen = false
    private var panelDismissed = false

    func applicationShouldOpenUntitledFile(_ sender: NSApplication) -> Bool {
        false
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Close any open panels spawned by DocumentGroup before showing ours.
        DispatchQueue.main.async { [weak self] in
            for window in NSApp.windows where window is NSOpenPanel {
                (window as! NSOpenPanel).close()
            }
            self?.showOpenPanel()
        }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag && !panelDismissed {
            showOpenPanel()
        }
        // Reset so a future dock-click can show the panel again.
        panelDismissed = false
        return true
    }

    func showOpenPanel() {
        guard !panelIsOpen else { return }
        panelIsOpen = true

        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.message = "Select a file or folder to open"
        panel.prompt = "Open"

        panel.begin { [weak self] response in
            self?.panelIsOpen = false

            guard response == .OK, let url = panel.url else {
                // User cancelled — suppress the reopen loop.
                self?.panelDismissed = true
                return
            }
            panel.close()

            var isDir: ObjCBool = false
            FileManager.default.fileExists(atPath: url.path, isDirectory: &isDir)

            if isDir.boolValue {
                self?.openDirectoryBrowser(url: url)
            } else {
                NSDocumentController.shared.openDocument(
                    withContentsOf: url, display: true) { _, _, _ in }
            }
        }
    }

    private func openDirectoryBrowser(url: URL) {
        let screenFrame = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1280, height: 800)
        let width = min(screenFrame.width * 0.75, 1400)
        let height = min(screenFrame.height * 0.8, 900)

        let model = DirectoryModel(directoryURL: url)
        let view = DirectoryBrowserView(directory: model)
        let controller = NSHostingController(rootView: view)
        controller.sizingOptions = []

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: width, height: height),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )

        // Toolbar for NavigationSplitView integration.
        let toolbar = NSToolbar(identifier: "DirectoryBrowser")
        toolbar.displayMode = .iconAndLabel
        window.toolbar = toolbar
        window.toolbarStyle = .unified
        window.titleVisibility = .visible

        window.contentViewController = controller
        window.title = url.lastPathComponent
        window.minSize = NSSize(width: 700, height: 500)

        // Force the window to the intended size and center it.
        window.setContentSize(NSSize(width: width, height: height))
        window.center()

        // Keep a strong reference so the window isn't deallocated.
        directoryWindow = window
        window.makeKeyAndOrderFront(nil)
    }
}
