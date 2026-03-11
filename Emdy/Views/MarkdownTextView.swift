import SwiftUI
import AppKit

struct MarkdownTextView: NSViewRepresentable {
    let markdown: String
    let fontFamily: FontFamily
    let zoomLevel: CGFloat
    let fileURL: URL?
    let isDark: Bool
    let showMinimap: Bool
    let headings: [HeadingItem]
    var scrollToHeadingIndex: Int? = nil

    private static let baseContentWidth: CGFloat = 680
    private static let minPadding: CGFloat = 72

    /// Content width scales with zoom to maintain ~65–75 characters per line.
    private var maxContentWidth: CGFloat {
        Self.baseContentWidth * zoomLevel
    }
    static let bottomMarkerAttribute: NSAttributedString.Key = .init("EmdyBottomMargin")

    func makeNSView(context: Context) -> NSView {
        let palette = ColorPalette.current(dark: isDark)

        // Container holds the scroll view and minimap side by side
        let container = NSView()

        let scrollView = NSScrollView()
        scrollView.hasVerticalScroller = false
        scrollView.hasHorizontalScroller = false
        scrollView.drawsBackground = true
        scrollView.backgroundColor = palette.background
        scrollView.translatesAutoresizingMaskIntoConstraints = false

        let textView = EmdyTextView()
        textView.isEditable = false
        textView.isSelectable = true
        textView.isRichText = true
        textView.drawsBackground = true
        textView.backgroundColor = palette.background
        textView.textContainerInset = NSSize(width: Self.minPadding, height: 92)
        textView.isAutomaticLinkDetectionEnabled = false
        textView.delegate = context.coordinator

        textView.isHorizontallyResizable = false
        textView.isVerticallyResizable = true
        textView.autoresizingMask = [.width]
        textView.textContainer?.widthTracksTextView = true
        textView.textContainer?.containerSize = NSSize(
            width: 0,
            height: CGFloat.greatestFiniteMagnitude
        )

        scrollView.documentView = textView
        context.coordinator.textView = textView
        context.coordinator.scrollView = scrollView
        context.coordinator.fileURL = fileURL

        // Minimap sits beside the scroll view
        let minimap = MinimapView(frame: .zero)
        minimap.translatesAutoresizingMaskIntoConstraints = false
        minimap.observeScrollView(scrollView)
        context.coordinator.minimap = minimap

        container.addSubview(scrollView)
        container.addSubview(minimap)

        // Scroll view trailing: either minimap leading (when visible) or container trailing (when hidden)
        let trailingToMinimap = scrollView.trailingAnchor.constraint(equalTo: minimap.leadingAnchor)
        let trailingToContainer = scrollView.trailingAnchor.constraint(equalTo: container.trailingAnchor)
        trailingToMinimap.isActive = showMinimap
        trailingToContainer.isActive = !showMinimap
        context.coordinator.scrollTrailingToMinimap = trailingToMinimap
        context.coordinator.scrollTrailingToContainer = trailingToContainer

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: container.topAnchor),
            scrollView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            scrollView.leadingAnchor.constraint(equalTo: container.leadingAnchor),

            minimap.topAnchor.constraint(equalTo: container.topAnchor),
            minimap.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            minimap.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            minimap.widthAnchor.constraint(equalToConstant: MinimapView.minimapWidth),
        ])

        textView.lockScrollToTop = true
        let attributed = renderMarkdown()
        let withMargin = appendBottomMargin(to: attributed)
        textView.textStorage?.setAttributedString(withMargin)
        textView.contentLength = attributed.length
        updateContentInsets(textView)
        scrollView.contentView.scroll(to: .zero)
        scrollView.reflectScrolledClipView(scrollView.contentView)
        minimap.isHidden = !showMinimap
        minimap.updateContent(withMargin, palette: palette, isDark: isDark)

        context.coordinator.lastMarkdown = markdown
        context.coordinator.lastFontFamily = fontFamily
        context.coordinator.lastZoomLevel = zoomLevel
        context.coordinator.lastIsDark = isDark
        context.coordinator.headings = headings

        loadRemoteImages(textView: textView, coordinator: context.coordinator)

        NotificationCenter.default.addObserver(
            context.coordinator,
            selector: #selector(Coordinator.frameDidChange(_:)),
            name: NSView.frameDidChangeNotification,
            object: textView
        )
        textView.postsFrameChangedNotifications = true

        return container
    }

    func updateNSView(_ container: NSView, context: Context) {
        let palette = ColorPalette.current(dark: isDark)

        guard let scrollView = context.coordinator.scrollView else { return }
        scrollView.backgroundColor = palette.background

        guard let textView = scrollView.documentView as? NSTextView else { return }
        textView.backgroundColor = palette.background
        context.coordinator.fileURL = fileURL

        // Only re-render when content or rendering inputs actually changed
        let coord = context.coordinator
        let needsRender = markdown != coord.lastMarkdown
            || fontFamily != coord.lastFontFamily
            || zoomLevel != coord.lastZoomLevel
            || isDark != coord.lastIsDark

        if needsRender {
            let scrollPosition = scrollView.contentView.bounds.origin
            let attributed = renderMarkdown()
            let withMargin = appendBottomMargin(to: attributed)
            textView.textStorage?.setAttributedString(withMargin)
            (textView as? EmdyTextView)?.contentLength = attributed.length
            updateContentInsets(textView)

            // Restore scroll after layout
            DispatchQueue.main.async {
                scrollView.contentView.scroll(to: scrollPosition)
                scrollView.reflectScrolledClipView(scrollView.contentView)
            }

            coord.lastMarkdown = markdown
            coord.lastFontFamily = fontFamily
            coord.lastZoomLevel = zoomLevel
            coord.lastIsDark = isDark

            if let minimap = coord.minimap, showMinimap {
                minimap.updateContent(withMargin, palette: palette, isDark: isDark)
            }

            loadRemoteImages(textView: textView, coordinator: coord)
        }

        coord.headings = headings

        if let index = scrollToHeadingIndex,
           let textStorage = textView.textStorage {
            DispatchQueue.main.async {
                _ = LinkHandler.scrollToHeadingIndex(index, in: textView, textStorage: textStorage)
            }
        }

        scrollView.hasVerticalScroller = !showMinimap

        if let minimap = coord.minimap {
            minimap.isHidden = !showMinimap
            coord.scrollTrailingToMinimap?.isActive = showMinimap
            coord.scrollTrailingToContainer?.isActive = !showMinimap

            // Always refresh minimap colors so theme switches apply immediately
            if showMinimap && !needsRender {
                minimap.refreshPalette(palette, isDark: isDark)
            }
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    private func renderMarkdown() -> NSAttributedString {
        MarkdownRenderer(
            fontFamily: fontFamily, zoomLevel: zoomLevel,
            fileURL: fileURL, isDark: isDark
        ).render(markdown)
    }

    /// Loads any pending remote images in the text storage asynchronously,
    /// then refreshes the minimap to reflect the loaded images.
    private func loadRemoteImages(textView: NSTextView, coordinator: Coordinator) {
        guard let textStorage = textView.textStorage else { return }
        let resolver = ImageResolver(baseURL: fileURL, isDark: isDark)
        let maxWidth = maxContentWidth - (Self.minPadding * 2)
        resolver.loadPendingImages(in: textStorage, maxWidth: min(maxWidth, 600)) {
            if let minimap = coordinator.minimap, !minimap.isHidden,
               let fullText = textView.textStorage {
                let palette = ColorPalette.current(dark: coordinator.lastIsDark)
                minimap.updateContent(fullText, palette: palette, isDark: coordinator.lastIsDark)
            }
        }
    }

    /// Appends a large non-selectable bottom margin to the attributed string.
    private func appendBottomMargin(to attrString: NSAttributedString) -> NSAttributedString {
        let result = NSMutableAttributedString(attributedString: attrString)
        let marginLines = String(repeating: "\n", count: 40)
        let palette = ColorPalette.current(dark: isDark)
        let margin = NSAttributedString(string: marginLines, attributes: [
            .font: NSFont.systemFont(ofSize: 12),
            .foregroundColor: palette.background,
            Self.bottomMarkerAttribute: true,
        ])
        result.append(margin)
        return result
    }

    private func updateContentInsets(_ textView: NSTextView) {
        let viewWidth = textView.bounds.width
        let horizontalInset = computeInsets(for: viewWidth)
        textView.textContainerInset = NSSize(width: horizontalInset, height: 92)
    }

    private func computeInsets(for viewWidth: CGFloat) -> CGFloat {
        let availableForContent = viewWidth - (Self.minPadding * 2)
        if availableForContent <= maxContentWidth {
            return Self.minPadding
        }
        return (viewWidth - maxContentWidth) / 2
    }

    final class Coordinator: NSObject, NSTextViewDelegate {
        weak var textView: NSTextView?
        weak var scrollView: NSScrollView?
        weak var minimap: MinimapView?
        var scrollTrailingToMinimap: NSLayoutConstraint?
        var scrollTrailingToContainer: NSLayoutConstraint?
        var fileURL: URL?
        var headings: [HeadingItem] = []

        // Track rendering inputs to avoid unnecessary re-renders
        var lastMarkdown: String = ""
        var lastFontFamily: FontFamily = .sansSerif
        var lastZoomLevel: CGFloat = 1.0
        var lastIsDark: Bool = false
        var initialLayoutDone = false

        func textView(_ textView: NSTextView, clickedOnLink link: Any, at charIndex: Int) -> Bool {
            LinkHandler.handleLink(link, fileURL: fileURL, textView: textView, headings: headings)
        }

        @objc func frameDidChange(_ notification: Notification) {
            guard let textView = textView as? EmdyTextView,
                  let scrollView = scrollView else { return }
            let viewWidth = textView.bounds.width
            let maxWidth = MarkdownTextView.baseContentWidth * lastZoomLevel
            let availableForContent = viewWidth - (MarkdownTextView.minPadding * 2)
            let horizontalInset: CGFloat
            if availableForContent <= maxWidth {
                horizontalInset = MarkdownTextView.minPadding
            } else {
                horizontalInset = (viewWidth - maxWidth) / 2
            }

            if !initialLayoutDone {
                initialLayoutDone = true
                textView.textContainerInset = NSSize(width: horizontalInset, height: 92)
                scrollView.contentView.scroll(to: .zero)
                scrollView.reflectScrolledClipView(scrollView.contentView)
                // Release lock after layout has fully settled.
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    textView.lockScrollToTop = false
                }
                return
            }

            let scrollY = scrollView.contentView.bounds.origin.y
            textView.suppressScrollAdjustment = true
            textView.textContainerInset = NSSize(width: horizontalInset, height: 92)
            scrollView.contentView.scroll(to: NSPoint(x: 0, y: scrollY))
            scrollView.reflectScrolledClipView(scrollView.contentView)
            textView.suppressScrollAdjustment = false
        }
    }
}
