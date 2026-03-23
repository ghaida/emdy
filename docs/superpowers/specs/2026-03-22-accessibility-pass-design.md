# Accessibility Pass — WCAG 2.1 AA

**Target:** WCAG 2.1 Level AA conformance for the Emdy Electron app.

**Approach:** Layer-by-layer across the full app. Each layer builds on the previous and is independently testable.

**No new dependencies.** All work uses standard React/DOM APIs.

---

## Current State

The app has solid interactive foundations: native `<button>` and `<input>` elements throughout, keyboard shortcuts for core actions (Cmd+O, Cmd+F, Cmd+/-), arrow key navigation in the command palette, Escape to close modals, and semantic `<article>` and `<table>` markup in rendered Markdown.

The gaps are structural: zero `aria-*` attributes anywhere, no ARIA roles, no focus indicators (outline is globally removed), no focus trapping in modals, no screen reader announcements for dynamic content, and no `prefers-reduced-motion` support.

---

## Layer 1: Semantic Landmarks & HTML Structure

The foundation for VoiceOver landmark navigation. Without landmarks, the app is a flat wall of divs to assistive technology.

### Changes by file

**App.tsx:**
- Sidebar wrapper becomes `<nav aria-label="Files">`
- Content area becomes `<main>`
- Status bar becomes `<footer>`

**Toolbar.tsx:**
- Add `role="toolbar"` and `aria-label="Document tools"` to the toolbar container

**Minimap.tsx:**
- Add `aria-hidden="true"` — purely visual, duplicates scroll functionality available via keyboard

**DirectoryBrowser.tsx:**
- File list becomes `<ul>` / `<li>` structure instead of flat divs
- Folder toggle buttons get `aria-expanded="true|false"`

**MarkdownView.tsx:**
- No changes — `<article>` wrapper is already correct

### New: Skip link

A visually-hidden "Skip to content" link as the first focusable element in the app, jumping focus to `<main>`. Standard WCAG pattern for keyboard users to bypass toolbar and sidebar.

Implementation: a small component rendered at the top of `App.tsx`, visible only on `:focus`.

---

## Layer 2: ARIA Roles, Labels & State

Makes every interactive element identifiable to screen readers.

### Icon-only button labels

Every button with only an icon gets an `aria-label`:

| Button | Label |
|--------|-------|
| Zoom in | "Zoom in" |
| Zoom out | "Zoom out" |
| Search | "Search files" |
| Sidebar toggle | "Toggle sidebar" |
| Minimap toggle | "Toggle minimap" |
| Copy code | "Copy code" |
| Export PDF | "Export as PDF" |
| Print | "Print" |
| Settings gear | "Settings" |
| Close (modals/toasts) | "Close" |

### Modal dialogs

| Component | Attributes |
|-----------|-----------|
| CommandPalette | `role="dialog"`, `aria-modal="true"`, `aria-label="Search files and content"` |
| SettingsModal | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` → modal title element |
| FileContextMenu | `role="menu"` on container, `role="menuitem"` on each option |

### Command palette results

- Results container: `role="listbox"`
- Each result: `role="option"`
- Highlighted result: `aria-selected="true"`
- Group headers ("Files", "Content"): `role="presentation"` to avoid confusing list semantics

### Find bar

- Container: `role="search"`
- Input: `aria-label="Find in document"`
- Prev/next/close buttons: `aria-label`

### Sidebar file list

- Currently open file: `aria-current="page"`
- Folder toggles: `aria-expanded` (set in Layer 1, listed here for completeness)

### Toast notifications

- Container: `role="status"` with implicit `aria-live="polite"`

### Settings modal controls

- Color swatch buttons: `aria-label` with theme name (e.g., "Warm theme", "Cool theme")
- Appearance options: `aria-pressed="true|false"` for the selected option

---

## Layer 3: Focus Indicators & Tab Order

Makes keyboard navigation visible and logical.

### Focus indicators

- Remove `* { outline: none }` from `global.css`
- Add `:focus-visible` style for all interactive elements: 2px ring using `var(--accent)`, 2px offset
- `:focus` (without `-visible`) remains suppressed so mouse clicks don't show rings
- Dark mode: same accent ring with a subtle outer glow for visibility against dark backgrounds

### Tab order

Default DOM order is preserved (toolbar → sidebar → content → status bar). Two refinements:

**Toolbar roving tabindex:**
- Tab enters the toolbar and focuses the first (or last-focused) button
- Arrow keys move between buttons within the toolbar
- Tab exits the toolbar
- Avoids forcing users through 10+ buttons to reach content

**Sidebar keyboard navigation:**
- Arrow keys navigate between files
- Enter opens a file
- Tab exits the sidebar

**Dropdown menus (font selector, overflow):**
- Arrow keys navigate items
- Enter selects
- Escape closes and returns focus to the trigger button

### Excluded from tab order

- Minimap (`aria-hidden`, `tabIndex={-1}`)
- Decorative elements, dividers, spacers

---

## Layer 4: Focus Trapping & Management

Ensures modals behave correctly for keyboard users.

### Focus trapping

CommandPalette, SettingsModal, and FileContextMenu trap focus while open. Tab/Shift+Tab cycle within the modal's focusable elements.

### New: `useFocusTrap` hook

Shared hook to avoid duplicating trap logic. Takes a ref to the container element, intercepts Tab key events, and cleans up on unmount.

### Initial focus on open

| Component | Initial focus |
|-----------|--------------|
| CommandPalette | Input field (already works) |
| SettingsModal | First focusable element |
| FileContextMenu | First menu item |
| FindBar | Input field (already works) |

### Focus restoration on close

All modals restore focus to the element that triggered them. The `useFocusTrap` hook captures `document.activeElement` on mount and restores it on unmount.

Escape key handlers already exist for all modals — focus restoration hooks into the same close path.

---

## Layer 5: Live Regions & Announcements

Makes dynamic content changes audible to screen readers without stealing focus.

### New: `useAnnounce` hook

Manages a single visually-hidden live region in the DOM. Provides:

- `announce(message)` — polite announcement (`aria-live="polite"`)
- `announceAssertive(message)` — interrupting announcement (`aria-live="assertive"`)

Uses the clear → set text swap pattern to ensure repeated identical messages still trigger announcements.

### Polite announcements

| Trigger | Message |
|---------|---------|
| Find bar match count updates | "3 of 10 matches" or "No matches" |
| Command palette results change | "8 results" or "No results" |
| Zoom level changes (Cmd+/-) | "Zoom 125%" |
| File loaded | "Opened README.md" |

### Assertive announcements

| Trigger | Message |
|---------|---------|
| File read error | "Error: could not read file" |
| File deleted from disk | "File was deleted" |

### Toast notifications

Already getting `role="status"` from Layer 2, which implicitly creates a polite live region. No additional work needed.

---

## Layer 6: Reduced Motion & Contrast Verification

### Reduced motion

Add a `@media (prefers-reduced-motion: reduce)` block in `global.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Covers sidebar slide, toolbar hover transitions, toast fade, command palette backdrop, and the loading spinner. Design tokens stay unchanged — the override is purely at CSS level.

### Contrast verification

Audit color tokens in `color-themes.ts` against WCAG AA minimums:

- **Normal text (< 18pt):** 4.5:1 ratio
- **Large text (>= 18pt / 14pt bold):** 3:1 ratio
- **UI components and graphical objects:** 3:1 ratio

Four combinations to check: Warm Light, Warm Dark, Cool Light, Cool Dark.

Most likely candidates for issues: `--text-muted`, `--text-secondary`, and `--border-*` colors against their respective backgrounds.

Fix any failures by adjusting token values. Add a comment block in `color-themes.ts` noting that contrast ratios have been verified to AA.

---

## Shared Code Summary

| Item | Type | Purpose |
|------|------|---------|
| `useFocusTrap` | Hook | Focus trapping for modals, captures/restores previous focus |
| `useAnnounce` | Hook | Visually-hidden live region for screen reader announcements |
| Skip link component | Component | "Skip to content" link, visible on focus |
| `:focus-visible` styles | CSS | Focus ring for all interactive elements |
| `prefers-reduced-motion` | CSS | Disables animations/transitions for motion-sensitive users |

---

## Files touched

| File | Layers |
|------|--------|
| `App.tsx` | 1 (landmarks, skip link) |
| `Toolbar.tsx` | 1 (role), 2 (aria-labels), 3 (roving tabindex) |
| `DirectoryBrowser.tsx` | 1 (list structure), 2 (aria-current, aria-expanded), 3 (arrow key nav) |
| `CommandPalette.tsx` | 2 (dialog role, listbox), 4 (focus trap), 5 (results count) |
| `SettingsModal.tsx` | 2 (dialog role, labels), 4 (focus trap) |
| `FindBar.tsx` | 2 (search role, labels), 5 (match count) |
| `ToastNotification.tsx` | 2 (role="status") |
| `Minimap.tsx` | 1 (aria-hidden) |
| `MarkdownView.tsx` | 2 (copy button label), 5 (file loaded announce) |
| `FileContextMenu.tsx` | 2 (menu role), 4 (focus trap) |
| `global.css` | 3 (focus-visible), 6 (reduced motion) |
| `color-themes.ts` | 6 (contrast fixes, verification comment) |
| New: `hooks/useFocusTrap.ts` | 4 |
| New: `hooks/useAnnounce.ts` | 5 |
| New: `components/SkipLink.tsx` | 1 |

## Testing

Each layer should be verified with:

- **VoiceOver on macOS** — navigate the app with VO+arrow keys, confirm landmarks, labels, and announcements
- **Keyboard-only** — tab through the entire app, confirm focus is visible and logical, confirm modals trap focus
- **System settings** — toggle "Reduce motion" in macOS Accessibility preferences, confirm animations stop
