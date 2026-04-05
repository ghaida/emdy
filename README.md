<img src="site/img/app-icon.png" alt="Emdy" width="128" height="128">

# Emdy

A minimal, open source Markdown reader for macOS.


Emdy renders Markdown files as clean, formatted documents. No editing, no plugins, no clutter. Open a file or folder and read.

<img src="site/img/app-light.png" alt="Emdy screenshot" width="680">

## Features

- **GitHub Flavored Markdown** with syntax-highlighted code blocks
- **Directory browser** sidebar for navigating .md files in a folder
- **Command palette** (Cmd+F) to search across file names and content
- **Canvas minimap** for quick document navigation
- **Zoom** (Cmd+/Cmd-) with live percentage readout
- **Font switcher** between Sans, Serif, and Mono (IBM Plex family)
- **Five color themes** (Warm, Cool, Neutral, Fresh, Neon), each with Light, Dark, and System appearance
- **Copy as formatted HTML**, export as PDF, print
- **Live reload** when files change on disk
- **Responsive toolbar** that collapses into an overflow menu on narrow windows
- **Native macOS menus** with full keyboard shortcut support

## Non-goals

Emdy is a reader, not an editor. There is no Markdown editing, no export to HTML/DOCX, and no plugin system.

## Build from source

```bash
git clone https://github.com/ghaida/emdy.git
cd emdy/electron
npm install
npm start          # dev with HMR
npm run make       # build DMG
npm run bump       # interactive version bump
```

### Tech stack

Electron Forge + Vite, React 18, TypeScript, Tailwind CSS v3, react-markdown + remark-gfm, react-syntax-highlighter (Prism), Lucide React icons, IBM Plex fonts.

## Support

If you find Emdy useful, consider [sponsoring on GitHub](https://github.com/sponsors/ghaida).

## License

[GPLv3](LICENSE)
