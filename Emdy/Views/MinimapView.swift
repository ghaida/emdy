import AppKit

final class MinimapView: NSView {

    static let minimapWidth: CGFloat = 140

    override var isFlipped: Bool { true }

    private var lines: [MinimapLine] = []
    private var totalLineCount: Int = 0
    private var palette = ColorPalette.light

    private let lineHeight: CGFloat = 3
    private let lineGap: CGFloat = 1
    private let charWidth: CGFloat = 2
    private let leftPadding: CGFloat = 12

    private var scaledDocHeight: CGFloat {
        CGFloat(totalLineCount) * (lineHeight + lineGap)
    }

    // Sticky offset — only moves when viewport reaches edges
    private var minimapOffset: CGFloat = 0
    private let edgeMargin: CGFloat = 8

    weak var targetScrollView: NSScrollView?
    private var isDragging = false
    private var dragStartY: CGFloat = 0
    private var dragStartScroll: CGFloat = 0
    private var scrollObserver: NSObjectProtocol?

    override init(frame: NSRect) {
        super.init(frame: frame)
        commonInit()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) not implemented")
    }

    private func commonInit() {
        wantsLayer = true
        let tracking = NSTrackingArea(
            rect: .zero,
            options: [.cursorUpdate, .activeInActiveApp, .inVisibleRect],
            owner: self
        )
        addTrackingArea(tracking)
    }

    override func cursorUpdate(with event: NSEvent) {
        NSCursor.arrow.set()
    }

    override func resetCursorRects() {
        discardCursorRects()
        addCursorRect(bounds, cursor: .arrow)
    }

    // MARK: - Content

    func updateContent(_ attributedString: NSAttributedString, palette: ColorPalette) {
        self.palette = palette
        self.lines = buildLines(from: attributedString)
        self.totalLineCount = lines.count
        needsDisplay = true
    }

    private var frameObserver: NSObjectProtocol?
    private var contentReady = false
    private var lastDocHeight: CGFloat = 0
    private var revealWorkItem: DispatchWorkItem?

    func observeScrollView(_ scrollView: NSScrollView) {
        targetScrollView = scrollView
        contentReady = false
        lastDocHeight = 0
        alphaValue = 0
        revealWorkItem?.cancel()

        if let old = scrollObserver {
            NotificationCenter.default.removeObserver(old)
        }
        if let old = frameObserver {
            NotificationCenter.default.removeObserver(old)
        }

        scrollView.contentView.postsBoundsChangedNotifications = true
        scrollObserver = NotificationCenter.default.addObserver(
            forName: NSView.boundsDidChangeNotification,
            object: scrollView.contentView,
            queue: .main
        ) { [weak self] _ in
            self?.updateStickyOffset()
            self?.needsDisplay = true
        }

        // Reveal only after doc height has stabilized (same value on consecutive checks).
        if let docView = scrollView.documentView {
            docView.postsFrameChangedNotifications = true
            frameObserver = NotificationCenter.default.addObserver(
                forName: NSView.frameDidChangeNotification,
                object: docView,
                queue: .main
            ) { [weak self] _ in
                guard let self = self, !self.contentReady else { return }
                let currentHeight = docView.frame.height
                self.lastDocHeight = currentHeight

                self.revealWorkItem?.cancel()
                let work = DispatchWorkItem { [weak self] in
                    guard let self = self, !self.contentReady else { return }
                    // Only reveal if the height hasn't changed since we scheduled
                    guard docView.frame.height == self.lastDocHeight else { return }
                    self.contentReady = true
                    self.updateStickyOffset()
                    self.needsDisplay = true
                    NSAnimationContext.runAnimationGroup { ctx in
                        ctx.duration = 0.2
                        self.animator().alphaValue = 1
                    }
                }
                self.revealWorkItem = work
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3, execute: work)
            }
        }
    }

    deinit {
        if let obs = scrollObserver {
            NotificationCenter.default.removeObserver(obs)
        }
        if let obs = frameObserver {
            NotificationCenter.default.removeObserver(obs)
        }
    }

    // MARK: - Line model

    private struct MinimapRun {
        let startChar: Int
        let length: Int
        let color: NSColor
    }

    private struct MinimapLine {
        let runs: [MinimapRun]
        let totalChars: Int
    }

    private func buildLines(from attrString: NSAttributedString) -> [MinimapLine] {
        let string = attrString.string
        var result: [MinimapLine] = []

        string.enumerateSubstrings(in: string.startIndex..., options: [.byLines, .substringNotRequired]) { _, range, _, _ in
            let nsRange = NSRange(range, in: string)
            var runs: [MinimapRun] = []
            var charOffset = 0

            attrString.enumerateAttribute(.foregroundColor, in: nsRange, options: []) { value, attrRange, _ in
                let color = (value as? NSColor) ?? self.palette.body
                let substr = (string as NSString).substring(with: attrRange)

                let trimmed = substr.drop(while: { $0.isWhitespace })
                let leadingSpaces = substr.count - trimmed.count

                if !trimmed.isEmpty {
                    runs.append(MinimapRun(
                        startChar: charOffset + leadingSpaces,
                        length: trimmed.count,
                        color: color
                    ))
                }
                charOffset += substr.count
            }

            result.append(MinimapLine(runs: runs, totalChars: charOffset))
        }

        return result
    }

    private var cachedBlockColor: NSColor?
    private var cachedAppearanceName: NSAppearance.Name?

    private func blockColor() -> NSColor {
        let appearance = effectiveAppearance
        let name = appearance.name
        if let cached = cachedBlockColor, cachedAppearanceName == name {
            return cached
        }
        var resolved: NSColor = .gray
        appearance.performAsCurrentDrawingAppearance {
            if let c = NSColor.controlAccentColor.usingColorSpace(.sRGB) {
                let grey = c.redComponent * 0.299 + c.greenComponent * 0.587 + c.blueComponent * 0.114
                let sat: CGFloat = 0.25
                let isDark = appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
                let alpha: CGFloat = isDark ? 0.45 : 0.50
                resolved = NSColor(
                    red: grey * (1 - sat) + c.redComponent * sat,
                    green: grey * (1 - sat) + c.greenComponent * sat,
                    blue: grey * (1 - sat) + c.blueComponent * sat,
                    alpha: alpha
                )
            }
        }
        cachedBlockColor = resolved
        cachedAppearanceName = name
        return resolved
    }

    // MARK: - Sticky offset

    private func viewportRect() -> (top: CGFloat, height: CGFloat)? {
        guard let scrollView = targetScrollView,
              let docView = scrollView.documentView else { return nil }

        let visibleHeight = scrollView.contentView.bounds.height
        let totalHeight = docView.frame.height
        guard totalHeight > 0, visibleHeight > 0 else { return nil }

        let scrollY = scrollView.contentView.bounds.origin.y
        let maxScroll = max(1, totalHeight - visibleHeight)
        let scrollRatio = min(max(0, scrollY / maxScroll), 1)

        let vpHeight = min(visibleHeight / totalHeight * scaledDocHeight, scaledDocHeight)
        let vpTop = scrollRatio * max(0, scaledDocHeight - vpHeight)

        return (vpTop, vpHeight)
    }

    private func updateStickyOffset() {
        guard let vp = viewportRect() else { return }

        let maxOffset = max(0, scaledDocHeight - bounds.height)

        // If viewport top goes above visible area, scroll up
        if vp.top < minimapOffset + edgeMargin {
            minimapOffset = max(0, vp.top - edgeMargin)
        }

        // If viewport bottom goes below visible area, scroll down
        let vpBottom = vp.top + vp.height
        if vpBottom > minimapOffset + bounds.height - edgeMargin {
            minimapOffset = min(maxOffset, vpBottom - bounds.height + edgeMargin)
        }

        minimapOffset = min(max(0, minimapOffset), maxOffset)
    }

    // MARK: - Drawing

    override func draw(_ dirtyRect: NSRect) {
        guard !lines.isEmpty else { return }

        let isDark = effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
        (isDark ? NSColor(hex: "#222222") : palette.background).setFill()
        bounds.fill()

        let rowHeight = lineHeight + lineGap
        let rightPadding: CGFloat = 12
        let contentWidth = bounds.width - leftPadding - rightPadding

        let firstVisibleLine = max(0, Int(floor(minimapOffset / rowHeight)))
        let lastVisibleLine = min(totalLineCount - 1, Int(ceil((minimapOffset + bounds.height) / rowHeight)))

        guard firstVisibleLine <= lastVisibleLine else { return }

        for i in firstVisibleLine...lastVisibleLine {
            let line = lines[i]
            let y = CGFloat(i) * rowHeight - minimapOffset

            for run in line.runs {
                let x = leftPadding + CGFloat(run.startChar) * charWidth
                let w = min(CGFloat(run.length) * charWidth, contentWidth - CGFloat(run.startChar) * charWidth)
                guard w > 0 else { continue }

                let rect = NSRect(x: x, y: y, width: w, height: lineHeight)
                blockColor().setFill()
                rect.fill()
            }
        }

        drawViewport()

    }

    private func drawViewport() {
        guard let vp = viewportRect() else { return }

        let vpTop = vp.top - minimapOffset
        let vpRect = NSRect(x: 0, y: vpTop, width: bounds.width, height: vp.height)
            .intersection(bounds)

        guard !vpRect.isEmpty else { return }

        let highlight = NSColor.controlAccentColor
        highlight.withAlphaComponent(0.08).setFill()
        vpRect.fill()
    }

    // MARK: - Mouse

    override func scrollWheel(with event: NSEvent) {
        targetScrollView?.scrollWheel(with: event)
    }

    override var mouseDownCanMoveWindow: Bool { false }

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    override func mouseDown(with event: NSEvent) {
        guard let scrollView = targetScrollView else { return }

        isDragging = true
        dragStartY = convert(event.locationInWindow, from: nil).y
        dragStartScroll = scrollView.contentView.bounds.origin.y

        // On click, jump the viewport center to the clicked position
        let localY = dragStartY
        let scaledY = localY + minimapOffset

        guard let docView = scrollView.documentView else { return }
        let visibleHeight = scrollView.contentView.bounds.height
        let totalHeight = docView.frame.height
        let ratio = scaledY / max(scaledDocHeight, 1)

        // Map ratio through document space: the click corresponds to a viewport center
        let docY = ratio * totalHeight - visibleHeight / 2
        let maxScroll = max(0, totalHeight - visibleHeight)
        let targetY = min(max(0, docY), maxScroll)

        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.15
            ctx.timingFunction = CAMediaTimingFunction(name: .easeOut)
            scrollView.contentView.animator().setBoundsOrigin(NSPoint(x: 0, y: targetY))
        }
        scrollView.reflectScrolledClipView(scrollView.contentView)

        // Update drag anchor to current state after jump
        dragStartScroll = targetY
    }

    override func mouseDragged(with event: NSEvent) {
        guard isDragging,
              let scrollView = targetScrollView,
              let docView = scrollView.documentView else { return }

        let currentY = convert(event.locationInWindow, from: nil).y
        let deltaY = currentY - dragStartY

        // Convert minimap delta to document delta
        let totalHeight = docView.frame.height
        let documentDelta = deltaY / max(scaledDocHeight, 1) * totalHeight

        let visibleHeight = scrollView.contentView.bounds.height
        let maxScroll = max(0, totalHeight - visibleHeight)
        let targetY = min(max(0, dragStartScroll + documentDelta), maxScroll)

        scrollView.contentView.scroll(to: NSPoint(x: 0, y: targetY))
        scrollView.reflectScrolledClipView(scrollView.contentView)
    }

    override func mouseUp(with event: NSEvent) {
        isDragging = false
    }
}
