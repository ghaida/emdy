# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Emdy is a minimal Markdown reader app. It reads and renders Markdown files, nothing more.

### Core Features
- Open a directory to browse its Markdown files via a flat sidebar list
- Open and render Markdown files (GFM) with syntax highlighting
- Command palette search across file names and content (Cmd+F)
- Canvas-based minimap for document navigation
- Zoom controls (Cmd+/Cmd-)
- Font switcher: Sans / Serif / Mono (IBM Plex family)
- Two color themes: Warm (Dieter Rams / Braun orange) and Cool (slate blue), each with Light/Dark/System appearance
- Token-based design system with strict 4px grid
- Content width capped at 680px, centered
- Copy as formatted HTML, export as PDF, print
- File watching with live reload on external changes
- File context menu: copy, download PDF, show in Finder, open in new window
- Status bar with settings gear, file path, word count
- Responsive toolbar that collapses into overflow menu on narrow windows
- Native macOS menus with full keyboard shortcut support

### Non-goals
- No Markdown editing or writing
- No export to HTML/DOCX
- No plugins or extensions

## Tech Stack

- **Electron Forge** with Vite (fast HMR, official tooling)
- **React 18** + **TypeScript**
- **react-markdown** + **remark-gfm** for GFM rendering
- **react-syntax-highlighter** (Prism) for code blocks
- **Tailwind CSS v3** for utility classes (most styling via CSS custom properties)
- **Lucide React** for icons (16px, strokeWidth 1.5)
- **chokidar** for file watching
- IBM Plex fonts bundled as static TTFs

## Build & Run

```bash
cd electron

# Install dependencies
npm install

# Run in development (with HMR for renderer changes)
npm start

# Package for distribution
npm run package

# Type-check
npx tsc --noEmit --skipLibCheck
```

## Architecture

### Process Model
- **Main process** (`src/main/`): File I/O, directory scanning, file watching, native menus, PDF/print, window management, settings persistence
- **Renderer process** (`src/renderer/`): React UI — Markdown view, sidebar, toolbar, minimap, command palette, settings modal
- **Preload** (`src/preload/`): `contextBridge` exposing typed IPC API to renderer

### Design System
All visual values flow from TypeScript tokens through a theme provider into CSS custom properties:

- **`lib/design-tokens.ts`** — Spacing (4px grid), font sizes, radii, layout dimensions, transitions, elevation shadows (light + dark variants)
- **`lib/color-themes.ts`** — Warm and Cool color themes, each with light and dark variants. Includes semantic UI colors, syntax highlighting colors, and minimap colors (distinct hue per element type)
- **`lib/theme-provider.ts`** — `applyTheme()` sets all CSS custom properties on `<html>`, including appearance-aware shadows. Called once at startup and on every theme change
- **`lib/prism-theme.ts`** — `buildPrismTheme(colors)` generates Prism syntax theme from the active color scale

### Key Conventions
- **Strict 4px grid**: Every spacing, padding, margin, and sizing value is a multiple of 4px. Only exceptions: 1px (borders) and 2px (fine detail)
- **No hardcoded values in CSS**: All colors, sizes, radii, shadows, and transitions reference CSS custom properties set by the token system
- **Font size tokens use `--fs-*` prefix** (not `--text-*`) to avoid collision with color tokens like `--text-primary`
- **Radii**: `--radius-sm` (4px) for buttons, `--radius-md` (8px) for code blocks/images/content area, `--radius-lg` (12px) for modals
- **Shadows**: 4-level elevation system (`--shadow-sm/md/lg/xl`). Light mode uses 3-layer shadows with subtle opacity. Dark mode adds a white edge ring (1px at 6-8% white) plus higher opacity (3-4x) for visibility against dark backgrounds.
- **Icons**: All from Lucide React, rendered at `size={16} strokeWidth={1.5}`
- **Toolbar**: `-webkit-app-region: no-drag` on the toolbar div; center spacer is `drag` for window dragging. Settings gear in toolbar, left of minimap toggle
- **Content area**: White background in light mode, warm/cool `#222` variants in dark mode. Rounded corners, subtle shadow, separate from sidebar/minimap
- **Status bar**: Sits inside the content column (aligned with content area, not full window width). Shows relative file path from root folder

## Project Status

The Electron prototype is functional with feature parity to the previous native Swift app. The project transitioned from Swift/SwiftUI to Electron/React for faster iteration. User research phase is ongoing — see `docs/project-plan.md`.

## Key Files

| Area | Files |
|------|-------|
| App entry (main) | `electron/src/main/index.ts` |
| IPC handlers | `electron/src/main/ipc-handlers.ts` |
| Menus | `electron/src/main/menu.ts` |
| Preload | `electron/src/preload/preload.ts` |
| App shell | `electron/src/renderer/App.tsx` |
| Design tokens | `electron/src/renderer/lib/design-tokens.ts`, `color-themes.ts`, `theme-provider.ts` |
| Markdown | `electron/src/renderer/components/MarkdownView.tsx` |
| Sidebar | `electron/src/renderer/components/DirectoryBrowser.tsx` |
| Toolbar | `electron/src/renderer/components/Toolbar.tsx` |
| Minimap | `electron/src/renderer/components/Minimap.tsx` |
| Search | `electron/src/renderer/components/CommandPalette.tsx` |
| Settings | `electron/src/renderer/components/SettingsModal.tsx` |
| Hooks | `electron/src/renderer/hooks/useDisplaySettings.ts`, `useFileWatcher.ts`, `useKeyboardShortcuts.ts` |
| Types | `electron/src/renderer/lib/types.ts` |
| Styles | `electron/src/renderer/styles/global.css` |
| Research & planning | `docs/project-plan.md`, `docs/design-brief.md`, `docs/user-journeys.md`, `docs/service-blueprint.md`, `docs/system-architecture.md` |

## Conventions

- Keep the app minimal. Resist adding features beyond the core set.
- All sizing on a strict 4px grid. Check `design-tokens.ts` before adding new values.
- Colors only via the theme system — never hardcode hex values in CSS or components.
- IBM Plex fonts bundled as static `.ttf` files in `electron/src/renderer/fonts/`.
- Support macOS standard keyboard shortcuts (Cmd+/- for zoom, Cmd+F for search, Cmd+O for open).
