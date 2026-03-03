# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Emdy is a minimal Markdown reader app for macOS. It is intentionally limited in scope — it reads and renders Markdown files, nothing more.

### Core Features (exhaustive list)
- Open and render Markdown files (GFM) as formatted text
- Open a directory to browse its Markdown files via a sidebar
- Enlarge/reduce document display size
- Switch font style: serif, sans-serif, monospace
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
# Build
xcodebuild -scheme Emdy -configuration Debug build

# Run tests
xcodebuild -scheme Emdy test

# Run a single test
xcodebuild -scheme Emdy -only-testing:EmdyTests/TestClassName/testMethodName test
```

If using Xcode, open `Emdy.xcodeproj` (or `.xcworkspace` if one exists).

## Architecture

The app follows a straightforward SwiftUI document-based app pattern:

- **App entry point**: Standard SwiftUI `@main` App struct using `DocumentGroup` for file handling
- **Markdown parsing**: Converts raw Markdown text to an attributed string or SwiftUI view hierarchy for rendering
- **Display controls**: View-level state for font family (serif/sans-serif/monospace) and zoom level
- **RTF copy**: Converts the rendered attributed string to RTF data and places it on `NSPasteboard`

## Conventions

- Keep the app minimal. Resist adding features beyond the core set listed above.
- Use native macOS APIs (AppKit/SwiftUI) — no third-party dependencies unless absolutely necessary for Markdown parsing.
- Support macOS standard keyboard shortcuts (Cmd+/- for zoom, Cmd+C for copy).
