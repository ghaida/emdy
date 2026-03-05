import SwiftUI

struct FontPicker: View {
    @Bindable var settings: DisplaySettings
    var isEnabled: Bool

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
            Label("Font", systemImage: "textformat")
        }
        .disabled(!isEnabled)
    }
}
