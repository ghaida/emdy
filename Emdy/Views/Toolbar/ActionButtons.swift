import SwiftUI

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
            Button(action: printAction) {
                Label("Print", systemImage: "printer")
            }
            if let pdfAction {
                Button(action: pdfAction) {
                    Label("PDF", systemImage: "arrow.down.doc")
                }
            }
        }
        .disabled(!isEnabled)
    }
}
