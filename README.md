# Emdy

A lightweight Markdown reader for macOS.

## Why

AI tools generate a lot of Markdown — project outlines, meeting notes, documentation. When someone outside engineering receives a `.md` file, they're stuck: Quick Look shows raw syntax, and every Markdown app on the market is an editor packed with features they'll never use.

Emdy renders Markdown files as clean, formatted documents. Double-click and read.

## Features

- **GitHub Flavored Markdown** — headings, lists, tables, code blocks, task lists, images, and more
- **File and folder support** — open a single file, or a directory to browse its Markdown files in a sidebar with expandable folders
- **Find in page** — `Cmd F` for incremental search within a document
- **Minimap** — a scaled overview of the document for quick navigation, togglable from the toolbar
- **Syntax highlighting** — language-aware coloring for fenced code blocks
- **Light, Dark, and System themes** — dark mode uses a warm, Braun-inspired palette
- **Optimal reading width** — text stays within a comfortable column, centered in the window
- **Font switcher** — serif (IBM Plex Serif), sans-serif (IBM Plex Sans), or monospace (IBM Plex Mono)
- **Zoom** — enlarge or reduce the document display, with a live percentage readout
- **RTF copy** — copied text pastes formatted into Mail, Google Docs, Slack, etc.
- **Export as PDF** — save directly via a dedicated dialog
- **Print** — via the standard macOS print dialog
- **Native macOS app** — built with Swift and SwiftUI

## Status

The core app is functional. We're currently running user research to validate whether this is the right problem, the right audience, and the right form factor before continuing feature work. See `docs/project-plan.md` for the research plan and `docs/design-brief.md` for existing findings.

## Install

Download the latest release from the [Releases](https://github.com/ghaida/emdy/releases) page.

Requires macOS 14 (Sonoma) or later.

## Usage

- **Open a file:** Double-click any `.md` file, or use File > Open
- **Open a folder:** Drag a directory into Emdy to browse its Markdown files
- **Zoom:** `Cmd +` / `Cmd -` (click the percentage in the toolbar to reset)
- **Change font:** View menu or the Font dropdown in the toolbar
- **Switch theme:** View menu or the Theme button in the toolbar
- **Find:** `Cmd F` to search within the current document
- **Copy as RTF:** Select text and `Cmd C`
- **Export PDF:** Click the PDF button in the toolbar
- **Print:** `Cmd P`

## Building from source

```bash
git clone https://github.com/ghaida/emdy.git
cd emdy
xcodegen generate
xcodebuild -scheme Emdy -configuration Debug build
```

The project uses [xcodegen](https://github.com/yonaskolb/XcodeGen) — `project.yml` is the source of truth. Run `xcodegen generate` after cloning or adding/removing files.

## License

All rights reserved.
