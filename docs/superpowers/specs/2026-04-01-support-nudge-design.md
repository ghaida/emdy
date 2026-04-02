# Support Nudge, Settings, About Dialog & Versioning

## Overview

Emdy uses a pay-what-you-want model via Gumroad. This spec covers the in-app mechanisms for encouraging and enabling support: a usage-triggered banner, a persistent link in Settings, an About dialog, and app versioning.

## Support Banner

### Appearance

- **Style**: Tinted banner using the active color theme's accent color
  - Background: accent at ~6-8% opacity
  - Border: accent at ~15-20% opacity, `--radius-md` (8px)
  - Adapts to light/dark mode automatically via theme tokens
- **Position**: Bottom of content area, above status bar
- **Layout**: 
  - Left: accent-colored heart icon (Lucide `Heart`, 16px, strokeWidth 1.5) + two-line text
  - Right: action buttons with generous spacing from text
  - Padding: `--space-4` (16px) vertical, `--space-5` (20px) horizontal
- **Copy**:
  - Line 1 (--text-primary, --fs-base 13px, font-weight 500): "Support Emdy"
  - Line 2 (--text-secondary, --fs-sm 12px): "Pay what you want to keep it going."
- **Animation**: Slide up from bottom on appear, slide down on dismiss. Use `--transition-slow` (0.2s).

### Actions

| Element | Style | Behavior |
|---------|-------|----------|
| **Contribute** | Accent background, white text, `--radius-sm` (4px), `--fs-sm`, font-weight 500 | Opens Gumroad product page in default browser. Banner dismissed permanently (`nudge.contributed = true`) |
| **Later** | Secondary — `border: 1px solid --border`, `--text-secondary`, `--radius-sm`, `--fs-sm` | Dismisses banner for this session. Reappears on next app launch if trigger conditions still met |
| **X** | Icon-only, `--text-muted`, Lucide `X` at 16px | Dismisses banner for 30 days. Increments `nudge.dismissCount` |

### Usage Trigger

All three conditions must be met before the banner appears:

- **10+ files opened** (cumulative across all sessions)
- **AND 3+ separate app launches**
- **AND 5+ days since first launch**

### Dismiss Logic

- **Later**: banner hidden for the rest of the current session (in-memory flag, not persisted). Reappears next launch.
- **X**: `nudge.dismissedUntil` set to current date + 30 days. Banner hidden until that date passes.
- **Contribute**: `nudge.contributed` set to true. Banner never shown again.
- **Max dismissals**: After 3 X-dismissals (`nudge.dismissCount >= 3`), stop showing the banner entirely. The passive links in Settings and About remain.

### When to evaluate

Check trigger conditions once per app launch, after the first file is opened. Don't show the banner immediately on launch — wait until the user is actively reading.

## Settings Modal — Support Section

- New third section below Appearance
- Section label: "Support" (same style as "Color Scheme" and "Appearance" labels)
- Content: A compact button (auto-width, not full-width) with accent-tinted styling:
  - Background: accent at ~6-8% opacity
  - Border: accent at ~15-20% opacity
  - Text: accent color, --fs-sm, font-weight 500
  - Label: "Support Emdy" with external link arrow (↗ or Lucide `ExternalLink` at 12px)
  - Border-radius: `--radius-sm` (4px)
- Clicking opens Gumroad product page in default browser

## About Dialog

### Access

- Help menu → "About Emdy" menu item
- Keyboard shortcut: none (standard macOS convention — About is menu-only)

### Layout

- Modal style matching Settings: backdrop blur overlay, scale animation (0.96 → 1), `--shadow-xl`, focus trap
- Width: 280px (narrower than Settings' 360px — less content)
- Centered content:
  1. App icon (64px, rounded corners `--radius-lg`)
  2. "Emdy" (--text-heading, --fs-lg 16px, font-weight 600)
  3. "Version X.Y.Z" (--text-muted, --fs-sm 12px)
  4. "A Markdown reader for macOS" (--text-secondary, --fs-sm 12px)
  5. Divider (1px, --border)
  6. "Support Emdy" button (same style as Settings section)
  7. "emdyapp.com" link (--text-muted, --fs-sm, opens in browser)

### State management

- New `aboutVisible` boolean in App.tsx, same pattern as `settingsVisible`
- Triggered via IPC from main process menu handler
- Z-index: 100 (same level as Settings — they shouldn't be open simultaneously)

## Versioning

This is the first time versioning is being set up for the app. Needs to be defined together during implementation. Key decisions:

- **Version source of truth**: `electron/package.json` `version` field (standard for Electron apps)
- **Scheme**: Semantic versioning (major.minor.patch). Start at 1.0.0 or 0.1.0 — to be decided
- **Reading the version at runtime**: Electron provides `app.getVersion()` in main process, exposed to renderer via IPC or preload
- **Displaying**: About dialog reads and displays the version string
- **Bumping**: Manual for now. Automate later if needed.

## Persistence

New keys in Electron store (alongside existing display settings):

```typescript
interface NudgeState {
  filesOpened: number;        // cumulative count
  appLaunches: number;        // cumulative count  
  firstLaunchDate: string;    // ISO 8601 date string
  dismissedUntil: string | null; // ISO 8601 date string, or null
  dismissCount: number;       // how many times X was clicked
  contributed: boolean;       // true after Contribute clicked
}
```

- `filesOpened` incremented each time a file is opened (in main process, alongside existing file-open logic)
- `appLaunches` incremented once per app startup (in main process `app.whenReady()`)
- `firstLaunchDate` set on first launch if not already present
- All values persisted via the same mechanism as display settings (electron-store or similar)

## New Components

| Component | File | Purpose |
|-----------|------|---------|
| SupportBanner | `components/SupportBanner.tsx` | Tinted banner with trigger logic |
| AboutDialog | `components/AboutDialog.tsx` | About modal with version, links |

## Modified Files

| File | Change |
|------|--------|
| `App.tsx` | Add `aboutVisible` state, render SupportBanner and AboutDialog, pass nudge state |
| `SettingsModal.tsx` | Add Support section with external link button |
| `main/index.ts` | Track app launches, expose version via IPC |
| `main/ipc-handlers.ts` | Add handlers for nudge state read/write, version query |
| `main/menu.ts` | Add "About Emdy" to Help menu (or app menu) |
| `preload/preload.ts` | Expose nudge and version IPC channels |
| `lib/types.ts` | Add NudgeState interface |
| `styles/global.css` | Styles for SupportBanner and AboutDialog |
