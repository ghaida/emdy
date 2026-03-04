# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Emdy is a minimal Markdown reader app for macOS. It is intentionally limited in scope — it reads and renders Markdown files, nothing more.

### Core Features (exhaustive list)
- Open and render Markdown files (GFM) as formatted text
- Open a directory to browse its Markdown files via a sidebar
- Enlarge/reduce document display size
- Switch font style: serif, sans-serif, monospace
- Theme switcher: Light, Dark, or System (dark palette is warm, Braun-inspired)
- Optimal content width: text capped at ~680px, centered, with background filling the full window
- Copy selected text in RTF format for pasting into other apps
- Print / Save as PDF (via standard macOS print dialog)
- Open Recent / reopen last file

### Non-goals
- No Markdown editing or writing
- No export to HTML/DOCX
- No plugins or extensions
- No recursive directory browsing (sidebar shows one level)

## Tech Stack

macOS native app (Swift, SwiftUI). This is not an Electron/web app.

## Build & Run

```bash
# Generate Xcode project (after adding/removing files)
xcodegen generate

# Build
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild -scheme Emdy -configuration Debug build

# Run tests
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild -scheme Emdy test

# Run a single test
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild -scheme Emdy -only-testing:EmdyTests/TestClassName/testMethodName test
```

The project uses **xcodegen** — `project.yml` is the source of truth, the `.xcodeproj` is generated and gitignored. Run `xcodegen generate` after adding or removing files.

## Architecture

The app follows a straightforward SwiftUI document-based app pattern:

- **App entry point**: Standard SwiftUI `@main` App struct using `DocumentGroup` for file handling
- **Markdown parsing**: Converts raw Markdown text to an attributed string or SwiftUI view hierarchy for rendering
- **Display controls**: View-level state for font family (serif/sans-serif/monospace), zoom level, and theme (light/dark/system) via `DisplaySettings` (persisted to UserDefaults)
- **Color palette**: `ColorPalette` struct with static `light` and `dark` instances; resolved via `current(dark:)` or `current(for: ColorScheme)`
- **Content width**: Text capped at 680px and centered; insets recomputed on window resize via a frame-change observer in `MarkdownTextView`
- **RTF copy**: Converts the rendered attributed string to RTF data and places it on `NSPasteboard`

## Key Files

| Area | Files |
|------|-------|
| App entry | `Emdy/EmdyApp.swift` |
| Model | `Model/DisplaySettings.swift` (FontFamily, AppTheme, DisplaySettings) |
| Rendering | `Renderer/MarkdownRenderer.swift`, `Renderer/ColorPalette.swift`, `Renderer/FontProvider.swift`, `Renderer/ImageResolver.swift` |
| Main views | `Views/DocumentContentView.swift`, `Views/DirectoryBrowserView.swift`, `Views/MarkdownTextView.swift` |
| Toolbar | `Views/Toolbar/ZoomControls.swift`, `Views/Toolbar/FontPicker.swift`, `Views/Toolbar/ThemePicker.swift`, `Views/Toolbar/ActionButtons.swift` |
| Commands | `Commands/EmdyMenuCommands.swift` |
| Tests | `EmdyTests/MarkdownRendererTests.swift` |

## Conventions

- Keep the app minimal. Resist adding features beyond the core set listed above.
- Use native macOS APIs (AppKit/SwiftUI) — no third-party dependencies unless absolutely necessary for Markdown parsing.
- Support macOS standard keyboard shortcuts (Cmd+/- for zoom, Cmd+C for copy).
- Toolbar sizing follows a 4px rhythm (text 12px, icons 10px, padding in multiples of 4).
- `ColorPalette` is a struct, not an enum. Both light and dark variants must be kept in sync when adding new semantic colors.
