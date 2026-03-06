import AppKit

final class EmdyTextView: NSTextView {

    override var acceptsFirstResponder: Bool { true }

    /// When true, suppress NSTextView's internal scroll adjustments
    /// (e.g. during inset changes from sidebar open/close).
    var suppressScrollAdjustment = false

    /// Length of the actual document content (excluding trailing margin).
    var contentLength: Int = Int.max

    convenience init() {
        self.init(frame: .zero)
        usesFindBar = true
        isIncrementalSearchingEnabled = true
    }

    /// Workaround for NSTextView bug: non-zero textContainerInset causes
    /// miscalculated scroll jumps on resize. Temporarily zero the inset
    /// while super handles the resize, then restore it.
    override func viewDidEndLiveResize() {
        let savedInset = textContainerInset
        textContainerInset = NSSize(width: 0, height: 0)
        super.viewDidEndLiveResize()
        textContainerInset = savedInset
    }

    override func resetCursorRects() {
        discardCursorRects()
    }

    override func cursorUpdate(with event: NSEvent) {
        updateCursorForEvent(event)
    }

    override func mouseMoved(with event: NSEvent) {
        updateCursorForEvent(event)
        // Don't call super — NSTextView sets I-beam in its mouseMoved.
    }

    private func updateCursorForEvent(_ event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        if isOverText(at: point) {
            NSCursor.iBeam.set()
        } else {
            NSCursor.arrow.set()
        }
    }

    private func isOverText(at point: NSPoint) -> Bool {
        guard let layoutManager = layoutManager,
              let textContainer = textContainer else { return false }
        let origin = textContainerOrigin
        let textPoint = NSPoint(x: point.x - origin.x, y: point.y - origin.y)
        guard textPoint.x >= 0, textPoint.y >= 0,
              textPoint.x <= textContainer.size.width else { return false }
        let charIndex = layoutManager.characterIndex(for: textPoint, in: textContainer, fractionOfDistanceBetweenInsertionPoints: nil)
        guard charIndex < contentLength else { return false }
        let glyphRange = layoutManager.glyphRange(forCharacterRange: NSRange(location: charIndex, length: 1), actualCharacterRange: nil)
        let lineRect = layoutManager.lineFragmentUsedRect(forGlyphAt: glyphRange.location, effectiveRange: nil)
        return textPoint.y >= lineRect.minY && textPoint.y <= lineRect.maxY && textPoint.x <= lineRect.maxX
    }

    override func selectionRange(forProposedRange proposedCharRange: NSRange, granularity: NSSelectionGranularity) -> NSRange {
        let clamped = NSIntersectionRange(proposedCharRange, NSRange(location: 0, length: contentLength))
        return super.selectionRange(forProposedRange: clamped, granularity: granularity)
    }

    override func adjustScroll(_ newVisible: NSRect) -> NSRect {
        if suppressScrollAdjustment {
            return enclosingScrollView?.contentView.bounds ?? newVisible
        }
        return super.adjustScroll(newVisible)
    }

    override func copy(_ sender: Any?) {
        guard let textStorage = textStorage else {
            super.copy(sender)
            return
        }

        let range = selectedRange()
        if range.length > 0 {
            PasteboardService.copyRTF(from: textStorage, range: range)
        }
    }

    override func menu(for event: NSEvent) -> NSMenu? {
        let menu = NSMenu()

        let copyItem = NSMenuItem(title: "Copy", action: #selector(copy(_:)), keyEquivalent: "c")
        copyItem.keyEquivalentModifierMask = .command
        menu.addItem(copyItem)

        let selectAllItem = NSMenuItem(title: "Select All", action: #selector(selectAll(_:)), keyEquivalent: "a")
        selectAllItem.keyEquivalentModifierMask = .command
        menu.addItem(selectAllItem)

        return menu
    }

    static func findIn(window: NSWindow?) -> EmdyTextView? {
        guard let contentView = window?.contentView else { return nil }
        return findTextView(in: contentView)
    }

    private static func findTextView(in view: NSView) -> EmdyTextView? {
        if let textView = view as? EmdyTextView { return textView }
        for subview in view.subviews {
            if let found = findTextView(in: subview) { return found }
        }
        return nil
    }
}
