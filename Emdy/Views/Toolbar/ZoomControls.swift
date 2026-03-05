import SwiftUI

struct ZoomControls: View {
    @Bindable var settings: DisplaySettings
    var isEnabled: Bool

    var body: some View {
        ControlGroup {
            Button { settings.zoomOut() } label: {
                Image(systemName: "minus")
            }
            Button { settings.zoomReset() } label: {
                Text("\(Int(round(settings.zoomLevel * 100)))%")
                    .monospacedDigit()
            }
            Button { settings.zoomIn() } label: {
                Image(systemName: "plus")
            }
        }
        .disabled(!isEnabled)
    }
}
