import SwiftUI

struct HeadingNavigator: View {
    let headings: [HeadingItem]
    let isDark: Bool
    var onSelect: (Int) -> Void

    var body: some View {
        let palette = ColorPalette.current(dark: isDark)

        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(headings.enumerated()), id: \.element.id) { index, heading in
                    Button {
                        onSelect(index)
                    } label: {
                        Text(heading.title)
                            .font(.system(size: fontSize(for: heading.level), weight: weight(for: heading.level)))
                            .foregroundStyle(Color(nsColor: heading.level <= 2 ? palette.headline : palette.medium))
                            .lineLimit(1)
                            .truncationMode(.tail)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.leading, indent(for: heading.level))
                            .padding(.vertical, 4)
                            .padding(.horizontal, 8)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 8)
        }
        .frame(width: 200)
        .background(Color(nsColor: palette.sidebarBackground).opacity(0.5))
    }

    private func fontSize(for level: Int) -> CGFloat {
        switch level {
        case 1: 13
        case 2: 12
        default: 11
        }
    }

    private func weight(for level: Int) -> Font.Weight {
        switch level {
        case 1: .semibold
        case 2: .medium
        default: .regular
        }
    }

    private func indent(for level: Int) -> CGFloat {
        CGFloat(max(0, level - 1)) * 12
    }
}
