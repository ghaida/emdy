import SwiftUI

struct FontPicker: View {
    @Bindable var settings: DisplaySettings
    var isEnabled: Bool

    private var fontForLabel: Font {
        switch settings.fontFamily {
        case .serif:
            return .custom("IBMPlexSerif-Regular", size: 14)
        case .sansSerif:
            return .custom("IBMPlexSans-Regular", size: 14)
        case .monospace:
            return .custom("IBMPlexMono-Regular", size: 14)
        }
    }

    var body: some View {
        Menu {
            ForEach(FontFamily.allCases, id: \.self) { family in
                Button {
                    settings.fontFamily = family
                } label: {
                    if settings.fontFamily == family {
                        Label(family.rawValue, systemImage: "checkmark")
                    } else {
                        Text(family.rawValue)
                    }
                }
            }
        } label: {
            Text("Aa")
                .font(fontForLabel)
                .frame(width: 24)
        }
        .help("Font")
        .disabled(!isEnabled)
    }
}
