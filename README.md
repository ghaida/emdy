# Emdy

A lightweight Markdown reader for macOS.

## Why

AI tools generate a lot of Markdown — project outlines, meeting notes, documentation. When someone outside engineering receives a `.md` file, they're stuck: Quick Look shows raw syntax, and every Markdown app on the market is an editor packed with features they'll never use.

Emdy renders Markdown files as clean, formatted documents. Double-click and read.

## Features

- **GitHub Flavored Markdown** — headings, lists, tables, code blocks, task lists, images, and more
- **File and folder support** — open a single file, or a directory to browse its Markdown files in a sidebar
- **Font switcher** — serif, sans-serif, or monospace
- **Zoom** — enlarge or reduce the document display
- **RTF copy** — copied text pastes formatted into Mail, Google Docs, Slack, etc.
- **Print / Save as PDF** — via the standard macOS print dialog
- **Native macOS app** — built with Swift and SwiftUI

## Install

Download the latest release from the [Releases](https://github.com/ghaida/emdy/releases) page.

Requires macOS 14 (Sonoma) or later.

## Usage

- **Open a file:** Double-click any `.md` file, or use File > Open
- **Open a folder:** Drag a directory into Emdy to browse its Markdown files
- **Zoom:** `Cmd +` / `Cmd -`
- **Change font:** View menu > Font
- **Copy as RTF:** Select text and `Cmd C`
- **Print / PDF:** `Cmd P`

## Building from source

```bash
git clone https://github.com/ghaida/emdy.git
cd emdy
xcodebuild -scheme Emdy -configuration Debug build
```

Or open the Xcode project and hit Run.

## License

MIT
