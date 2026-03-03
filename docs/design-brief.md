# Emdy — Design Brief

## Context

AI tools (ChatGPT, Claude, Copilot, etc.) are generating an explosion of Markdown content — project outlines, briefs, documentation, meeting notes, technical specs. Markdown has quietly become a cross-functional format: developers produce it, but marketers, PMs, designers, and executives increasingly receive it.

The problem: there's no simple way for non-technical people to *read* a Markdown file on macOS. The options today are:

- **Code editors** (VS Code, Sublime) — intimidating, heavyweight, require installation of extensions
- **Markdown editors** (Typora, MacDown, Obsidian) — designed for *writing*, packed with features a reader doesn't need (split panes, file trees, sync, plugins)
- **Preview in browsers** — requires copy-pasting into a web tool, breaks the native file experience
- **Quick Look in Finder** — renders raw Markdown text with formatting syntax visible, not a real reader experience

Every existing solution treats Markdown as a *tool for writers*. Nobody has built for the growing audience of *readers*.

## Gap

When a non-technical person receives a `.md` file — say a marketing manager getting a project outline from a developer — the experience is broken. They either see raw syntax they don't understand, or they have to install bloated software they'll never use beyond reading that one file. The friction is disproportionate to the task: they just want to *read a document*.

There is no clean, native macOS app that treats Markdown reading as a first-class, standalone activity.

## Opportunity

**Primary audience:** Non-technical professionals (marketing, ops, management, design) who receive Markdown files from developers or AI tools and just need to read them.

**Secondary audience:** Developers who want to quickly preview Markdown files from their projects without opening an IDE or editor.

**Why now:**
- AI-generated Markdown content is growing rapidly across roles and teams
- macOS has no native Markdown rendering (Quick Look shows raw text)
- The "just a reader" niche is unoccupied — every competitor is an editor first
- People are fatigued by feature-bloated tools; there's appetite for software that does one thing well

**Estimated reach:** Any knowledge worker on macOS who has ever received a `.md` file and been confused by it. This is a growing population as AI tools proliferate.

## Goals

### User goals
- Open a Markdown file and read it as a clean, formatted document — instantly
- Adjust the reading experience (font, size) to personal preference
- Copy text out in a format that pastes cleanly into other apps (email, Docs, Slack)

### Product goals
- Be the obvious answer to "how do I open this .md file on my Mac?"
- Feel native, fast, and invisible — like Preview.app but for Markdown
- Register as the system handler for `.md` files so double-clicking just works
- Establish Emdy as a trusted utility brand (free + tip jar model)

### Business goals
- Build a loyal user base through simplicity and word-of-mouth
- Sustain development through voluntary tips (no pressure, no gating)
- macOS first; keep architecture portable for potential future platforms

## Constraints

| Constraint | Detail |
|---|---|
| **Platform** | macOS only (Phase 1). Architecture should not prevent future cross-platform, but don't over-engineer for it now. |
| **Distribution** | Direct download from website. No App Store (avoids sandboxing constraints and review delays). |
| **Pricing** | Free with optional tip jar. No paid features, no trials, no subscriptions. |
| **Scope** | Reader only. No editing, no plugins. Minimal file navigation (directory sidebar), no full file management. |
| **Team** | Solo/small team. Every feature has a maintenance cost — say no aggressively. |
| **Technical** | Native Swift/SwiftUI. No Electron, no web views if avoidable. Must feel like a real Mac app. |

## Guiding Principles

### 1. Reading is the entire product
Every decision filters through: "Does this make reading a Markdown file better?" If no, it's out of scope. The app opens a file, renders it beautifully, and gets out of the way.

### 2. Non-technical people should never feel lost
No preferences screens with 30 options. No terminal commands. No jargon. A marketing manager who has never heard of "Markdown" should be able to double-click a `.md` file and read it like any other document.

### 3. Feel native, feel fast
Emdy should feel like it shipped with macOS. Native window management, standard keyboard shortcuts (Cmd+/- for zoom, Cmd+C for copy), instant launch. It should be indistinguishable from a first-party Apple utility.

### 4. Deliberately incomplete
The feature list is the product strategy. A small set of reading controls is not a limitation — it's the point. Resist scope creep. The product's competitive advantage is what it *doesn't* do.

## Key Assumptions & Open Questions

### Assumptions we're betting on
- The volume of Markdown files reaching non-technical people will continue to grow (driven by AI tools)
- People will seek out a dedicated reader rather than learning an editor
- "Free + tip jar" generates enough goodwill and voluntary revenue to sustain a utility app
- Direct download distribution can reach the target audience (without App Store discoverability)

### Open questions
- **Discovery:** How do non-technical users find Emdy? They may not know to search for "Markdown reader" — they just know they can't open a file. Website SEO, developer word-of-mouth, and "recommended by" lists are likely channels, but this needs a distribution strategy.
- **File association UX:** When users install Emdy, should it ask to become the default `.md` handler, or just register quietly and let users choose in Finder?
- **Tip jar mechanics:** In-app prompt? Link to a website? How do you make it visible without being annoying?
- **Future platform priority:** If cross-platform becomes relevant, is Windows or iPad the next target?

## Proposed Scope — Phase 1

### In scope
- Open `.md` and `.markdown` files (via double-click, File > Open, or drag-and-drop)
- Open a directory — displays a sidebar listing all Markdown files in that directory, click to view
- Register as macOS file handler for Markdown extensions
- Render GitHub Flavored Markdown (GFM) as clean, formatted text — headings, bold, italic, links, lists, code blocks, images, blockquotes, tables, task lists, strikethrough
- Font switcher: serif, sans-serif, monospace (three options, no custom fonts)
- Zoom in/out for document display size
- Copy selected text as RTF (pastes formatted into Mail, Google Docs, Slack, etc.)
- Print and Save as PDF (via macOS standard print dialog)
- Open Recent / reopen last file (standard macOS document behavior)
- Standard macOS keyboard shortcuts
- Tip jar (non-intrusive, accessible from menu or about screen)
- Auto-update mechanism (Sparkle framework or similar)

### Out of scope (not Phase 1, possibly never)
- Editing or saving Markdown
- Export to HTML/DOCX
- Themes or dark mode customization beyond system default
- Syntax highlighting configuration
- Plugin system
- iOS/iPad/Windows/Linux versions
- Recursive/nested directory browsing (Phase 1 sidebar shows one directory level)
