# Emdy

A lightweight Markdown reader for macOS.

## Why

AI tools generate a lot of Markdown — project outlines, meeting notes, documentation. When someone outside engineering receives a `.md` file, they're stuck: Quick Look shows raw syntax, and every Markdown app on the market is an editor packed with features they'll never use.

Emdy renders Markdown files as clean, formatted documents. Double-click and read.

## Features

- **GitHub Flavored Markdown** — headings, lists, tables, code blocks, task lists, images, and more
- **File and folder support** — open a single file, or a directory to browse its Markdown files in a sidebar
- **Light, Dark, and System themes** — dark mode uses a warm, Braun-inspired palette
- **Optimal reading width** — text stays within a comfortable column, centered in the window
- **Font switcher** — serif, sans-serif, or monospace
- **Zoom** — enlarge or reduce the document display, with a live percentage readout
- **RTF copy** — copied text pastes formatted into Mail, Google Docs, Slack, etc.
- **Print / Save as PDF** — via the standard macOS print dialog
- **Native macOS app** — built with Swift and SwiftUI

## Install

Download the latest release from the [Releases](https://github.com/ghaida/emdy/releases) page.

Requires macOS 14 (Sonoma) or later.

## Usage

- **Open a file:** Double-click any `.md` file, or use File > Open
- **Open a folder:** Drag a directory into Emdy to browse its Markdown files
- **Zoom:** `Cmd +` / `Cmd -` (click the percentage in the toolbar to reset)
- **Change font:** View menu or the Font dropdown in the toolbar
- **Switch theme:** View menu or the Theme button in the toolbar
- **Copy as RTF:** Select text and `Cmd C`
- **Print / PDF:** `Cmd P`

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
