import SwiftUI

struct ZoomControls: View {
    @Bindable var settings: DisplaySettings
    var isEnabled: Bool

    var body: some View {
        HStack(spacing: 0) {
            Button { settings.zoomOut() } label: {
                Image(systemName: "minus")
                    .frame(width: 28, height: 22)
            }
            .buttonStyle(.borderless)
            .help("Zoom Out")

            Divider()
                .frame(height: 14)

            Button { settings.zoomReset() } label: {
                Text("\(Int(round(settings.zoomLevel * 100)))%")
                    .monospacedDigit()
                    .font(.system(size: 12))
                    .padding(.horizontal, 8)
                    .frame(minWidth: 36, minHeight: 22)
            }
            .buttonStyle(.borderless)
            .help("Reset Zoom")

            Divider()
                .frame(height: 14)

            Button { settings.zoomIn() } label: {
                Image(systemName: "plus")
                    .frame(width: 28, height: 22)
            }
            .buttonStyle(.borderless)
            .help("Zoom In")
        }
        .padding(.horizontal, 4)
        .disabled(!isEnabled)
    }
}
