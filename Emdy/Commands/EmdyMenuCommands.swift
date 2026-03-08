import SwiftUI

struct EmdyMenuCommands: Commands {
    var body: some Commands {
        CommandGroup(replacing: .textEditing) {
            Button("Find…") {
                NotificationCenter.default.post(name: .findInPage, object: nil)
            }
            .keyboardShortcut("f", modifiers: .command)
        }

        CommandGroup(after: .toolbar) {
            Button("Refresh") {
                NotificationCenter.default.post(name: .refreshDocument, object: nil)
            }
            .keyboardShortcut("r", modifiers: .command)

            Button("Toggle Headings") {
                NotificationCenter.default.post(name: .toggleHeadingNavigator, object: nil)
            }
            .keyboardShortcut("h", modifiers: [.command, .shift])
        }

        CommandGroup(after: .textFormatting) {
            Section {
                Button("Zoom In") {
                    NotificationCenter.default.post(name: .zoomIn, object: nil)
                }
                .keyboardShortcut("+", modifiers: .command)

                Button("Zoom Out") {
                    NotificationCenter.default.post(name: .zoomOut, object: nil)
                }
                .keyboardShortcut("-", modifiers: .command)

                Button("Actual Size") {
                    NotificationCenter.default.post(name: .zoomReset, object: nil)
                }
                .keyboardShortcut("0", modifiers: .command)
            }

            Divider()

            Section {
                Button("Sans-Serif") {
                    NotificationCenter.default.post(name: .setFont, object: FontFamily.sansSerif)
                }
                Button("Serif") {
                    NotificationCenter.default.post(name: .setFont, object: FontFamily.serif)
                }
                Button("Monospace") {
                    NotificationCenter.default.post(name: .setFont, object: FontFamily.monospace)
                }
            }

            Divider()

            Section {
                Button("Light") {
                    NotificationCenter.default.post(name: .setTheme, object: AppTheme.light)
                }
                Button("Dark") {
                    NotificationCenter.default.post(name: .setTheme, object: AppTheme.dark)
                }
                Button("System") {
                    NotificationCenter.default.post(name: .setTheme, object: AppTheme.system)
                }
            }
        }
    }
}

extension Notification.Name {
    static let zoomIn = Notification.Name("emdy.zoomIn")
    static let zoomOut = Notification.Name("emdy.zoomOut")
    static let zoomReset = Notification.Name("emdy.zoomReset")
    static let setFont = Notification.Name("emdy.setFont")
    static let setTheme = Notification.Name("emdy.setTheme")
    static let openDirectory = Notification.Name("emdy.openDirectory")
    static let findInPage = Notification.Name("emdy.findInPage")
    static let refreshDocument = Notification.Name("emdy.refreshDocument")
    static let toggleHeadingNavigator = Notification.Name("emdy.toggleHeadingNavigator")
}
