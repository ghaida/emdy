import SwiftUI
import AppKit

struct ToastView: NSViewRepresentable {
    let message: String
    let palette: ColorPalette
    let onDismiss: () -> Void

    func makeNSView(context: Context) -> ToastNSView {
        let view = ToastNSView(message: message, palette: palette, onDismiss: onDismiss)
        return view
    }

    func updateNSView(_ nsView: ToastNSView, context: Context) {}
}

final class ToastNSView: NSView {
    private let onDismiss: () -> Void
    private var dismissButton: NSView?

    init(message: String, palette: ColorPalette, onDismiss: @escaping () -> Void) {
        self.onDismiss = onDismiss
        super.init(frame: .zero)
        wantsLayer = true
        layer?.backgroundColor = palette.successBackground.cgColor
        layer?.cornerRadius = 6

        let icon = NSImageView()
        icon.image = NSImage(systemSymbolName: "checkmark.circle.fill", accessibilityDescription: nil)
        icon.contentTintColor = palette.success
        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.setContentHuggingPriority(.required, for: .horizontal)

        let label = NSTextField(labelWithString: message)
        label.font = .systemFont(ofSize: 13)
        label.textColor = palette.body
        label.lineBreakMode = .byTruncatingTail
        label.translatesAutoresizingMaskIntoConstraints = false
        label.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        let xButton = NSButton(title: "", target: self, action: #selector(dismissTapped))
        xButton.image = NSImage(systemSymbolName: "xmark", accessibilityDescription: "Dismiss")
        xButton.imagePosition = .imageOnly
        xButton.isBordered = false
        xButton.contentTintColor = palette.medium
        xButton.translatesAutoresizingMaskIntoConstraints = false
        xButton.setContentHuggingPriority(.required, for: .horizontal)
        dismissButton = xButton

        addSubview(icon)
        addSubview(label)
        addSubview(xButton)

        NSLayoutConstraint.activate([
            icon.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            icon.centerYAnchor.constraint(equalTo: centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 16),
            icon.heightAnchor.constraint(equalToConstant: 16),

            label.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 10),
            label.centerYAnchor.constraint(equalTo: centerYAnchor),

            xButton.leadingAnchor.constraint(greaterThanOrEqualTo: label.trailingAnchor, constant: 6),
            xButton.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            xButton.centerYAnchor.constraint(equalTo: centerYAnchor),
            xButton.widthAnchor.constraint(equalToConstant: 24),
            xButton.heightAnchor.constraint(equalToConstant: 24),

            heightAnchor.constraint(equalToConstant: 40),
        ])

        let tracking = NSTrackingArea(
            rect: .zero,
            options: [.cursorUpdate, .mouseMoved, .activeAlways, .inVisibleRect, .mouseEnteredAndExited],
            owner: self
        )
        addTrackingArea(tracking)

        // Auto-dismiss after 4 seconds
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) { [weak self] in
            self?.dismissTapped()
        }
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) not implemented")
    }

    // Capture all hits so nothing leaks to the text view underneath
    override func hitTest(_ point: NSPoint) -> NSView? {
        let local = convert(point, from: superview)
        guard bounds.contains(local) else { return nil }
        if let btn = dismissButton, btn.frame.contains(local) {
            return btn
        }
        return self
    }

    override func mouseEntered(with event: NSEvent) {
        NSCursor.arrow.set()
    }

    override func mouseMoved(with event: NSEvent) {
        let loc = convert(event.locationInWindow, from: nil)
        if let btn = dismissButton, btn.frame.contains(loc) {
            NSCursor.pointingHand.set()
        } else {
            NSCursor.arrow.set()
        }
    }

    override func mouseExited(with event: NSEvent) {
        NSCursor.pop()
    }

    override func cursorUpdate(with event: NSEvent) {
        let loc = convert(event.locationInWindow, from: nil)
        if let btn = dismissButton, btn.frame.contains(loc) {
            NSCursor.pointingHand.set()
        } else {
            NSCursor.arrow.set()
        }
    }

    override func resetCursorRects() {
        discardCursorRects()
        addCursorRect(bounds, cursor: .arrow)
        if let btn = dismissButton {
            addCursorRect(btn.frame, cursor: .pointingHand)
        }
    }

    @objc private func dismissTapped() {
        onDismiss()
    }
}

struct ToastModifier: ViewModifier {
    @Binding var toast: ToastMessage?
    var showMinimap: Bool = false
    var isDark: Bool = false

    private var trailingInset: CGFloat {
        showMinimap ? MinimapView.minimapWidth + 12 : 28
    }

    private var palette: ColorPalette {
        .current(dark: isDark)
    }

    func body(content: Content) -> some View {
        content.overlay(alignment: .topTrailing) {
            if let toast {
                ToastView(message: toast.message, palette: palette) {
                    self.toast = nil
                }
                .frame(maxWidth: 440, maxHeight: 40)
                .padding(.top, 12)
                .padding(.trailing, trailingInset)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: toast != nil)
    }
}

struct ToastMessage: Equatable {
    let message: String
}

extension View {
    func toast(_ toast: Binding<ToastMessage?>, showMinimap: Bool = false, isDark: Bool = false) -> some View {
        modifier(ToastModifier(toast: toast, showMinimap: showMinimap, isDark: isDark))
    }
}
