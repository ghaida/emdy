import SwiftUI

struct EmptyStateView: View {
    let icon: String
    let title: String
    let subtitle: String?

    @Environment(\.colorScheme) private var colorScheme

    private var palette: ColorPalette { .current(for: colorScheme) }

    init(
        icon: String = "doc.text",
        title: String = "Open a Markdown file to get started",
        subtitle: String? = "File \u{2192} Open  or  \u{2318}O"
    ) {
        self.icon = icon
        self.title = title
        self.subtitle = subtitle
    }

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 48, weight: .light))
                .foregroundStyle(Color(nsColor: palette.muted))

            Text(title)
                .font(.system(.body, design: .monospaced))
                .foregroundStyle(Color(nsColor: palette.body))

            if let subtitle {
                Text(subtitle)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(Color(nsColor: palette.muted))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(nsColor: palette.background))
    }
}
