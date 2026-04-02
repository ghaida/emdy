# Support Nudge, Settings, About Dialog & Versioning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a usage-triggered support banner, a "Support Emdy" button in Settings, an About dialog, and version display — all linking to the Gumroad PWYW product page.

**Architecture:** Nudge state is persisted in the existing settings JSON file via the settings-store module. The main process tracks app launches and exposes nudge state + app version via IPC. The renderer reads nudge state on mount, evaluates trigger conditions, and renders a tinted banner. Settings gets a new Support section. About dialog is a new modal triggered from the Help menu.

**Tech Stack:** Electron IPC, React, CSS custom properties (existing token system), Lucide icons

**Gumroad URL placeholder:** `https://gumroad.com/l/emdy` (replace with actual product URL)

---

### Task 1: Add NudgeState type and IPC contract

**Files:**
- Modify: `electron/src/renderer/lib/types.ts`
- Modify: `electron/src/preload/preload.ts`

- [ ] **Step 1: Add NudgeState interface to types.ts**

Add after the `DisplaySettings` interface:

```typescript
export interface NudgeState {
  filesOpened: number;
  appLaunches: number;
  firstLaunchDate: string | null;
  dismissedUntil: string | null;
  dismissCount: number;
  contributed: boolean;
}
```

- [ ] **Step 2: Add nudge and version methods to ElectronAPI interface**

Add to the `ElectronAPI` interface in `types.ts`:

```typescript
  getNudgeState: () => Promise<NudgeState>;
  setNudgeSetting: (key: string, value: unknown) => Promise<void>;
  getAppVersion: () => Promise<string>;
  openExternal: (url: string) => Promise<void>;
```

- [ ] **Step 3: Add IPC bindings in preload.ts**

Add to the `contextBridge.exposeInMainWorld` object:

```typescript
  // Nudge
  getNudgeState: () => ipcRenderer.invoke('nudge:get'),
  setNudgeSetting: (key: string, value: unknown) => ipcRenderer.invoke('nudge:set', key, value),

  // App info
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
```

- [ ] **Step 4: Verify type-check passes**

Run: `cd electron && npx tsc --noEmit --skipLibCheck`
Expected: No errors (types are defined but handlers not registered yet — preload invokes are just wiring)

- [ ] **Step 5: Commit**

```bash
git add electron/src/renderer/lib/types.ts electron/src/preload/preload.ts
git commit -m "feat: add NudgeState type and IPC bindings for support nudge"
```

---

### Task 2: Persist nudge state and track app launches in main process

**Files:**
- Modify: `electron/src/main/settings-store.ts`
- Modify: `electron/src/main/index.ts`

- [ ] **Step 1: Add nudge state to settings-store.ts**

Add a `NudgeState` interface and defaults alongside the existing `Settings`:

```typescript
interface NudgeState {
  filesOpened: number;
  appLaunches: number;
  firstLaunchDate: string | null;
  dismissedUntil: string | null;
  dismissCount: number;
  contributed: boolean;
}

const nudgeDefaults: NudgeState = {
  filesOpened: 0,
  appLaunches: 0,
  firstLaunchDate: null,
  dismissedUntil: null,
  dismissCount: 0,
  contributed: false,
};
```

Add a separate file path, load/save functions, and IPC handlers:

```typescript
const nudgePath = path.join(app.getPath('userData'), 'nudge.json');

function loadNudge(): NudgeState {
  try {
    const data = fs.readFileSync(nudgePath, 'utf-8');
    return { ...nudgeDefaults, ...JSON.parse(data) };
  } catch {
    return { ...nudgeDefaults };
  }
}

function saveNudge(state: NudgeState) {
  fs.writeFileSync(nudgePath, JSON.stringify(state, null, 2));
}

let nudge = loadNudge();
```

Export a `registerNudgeHandlers` function:

```typescript
export function registerNudgeHandlers() {
  ipcMain.handle('nudge:get', () => {
    return { ...nudge };
  });

  ipcMain.handle('nudge:set', (_event, key: string, value: unknown) => {
    (nudge as unknown as Record<string, unknown>)[key] = value;
    saveNudge(nudge);
  });
}
```

Export a function to increment nudge counters (called from main process):

```typescript
export function nudgeTrackAppLaunch() {
  if (!nudge.firstLaunchDate) {
    nudge.firstLaunchDate = new Date().toISOString();
  }
  nudge.appLaunches++;
  saveNudge(nudge);
}

export function nudgeTrackFileOpen() {
  nudge.filesOpened++;
  saveNudge(nudge);
}
```

- [ ] **Step 2: Register nudge handlers and track app launch in index.ts**

Add import at top of `index.ts`:

```typescript
import { registerNudgeHandlers, nudgeTrackAppLaunch } from './settings-store';
```

Add after the existing `registerExportHandlers()` call:

```typescript
registerNudgeHandlers();
```

Add version and open-external IPC handlers alongside existing `system:accent-color` handler:

```typescript
ipcMain.handle('app:version', () => {
  return app.getVersion();
});

ipcMain.handle('app:open-external', (_event, url: string) => {
  const { shell } = require('electron');
  shell.openExternal(url);
});
```

Inside the `app.on('ready', ...)` callback, after `createWindow()`:

```typescript
nudgeTrackAppLaunch();
```

- [ ] **Step 3: Track file opens**

In `electron/src/main/ipc-handlers.ts`, import and call `nudgeTrackFileOpen`:

Add import at top:

```typescript
import { nudgeTrackFileOpen } from './settings-store';
```

In the `file:read` handler, add the tracking call:

```typescript
ipcMain.handle('file:read', async (_event, filePath: string) => {
  nudgeTrackFileOpen();
  return fs.readFile(filePath, 'utf-8');
});
```

- [ ] **Step 4: Verify type-check passes**

Run: `cd electron && npx tsc --noEmit --skipLibCheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add electron/src/main/settings-store.ts electron/src/main/index.ts electron/src/main/ipc-handlers.ts
git commit -m "feat: persist nudge state and track app launches and file opens"
```

---

### Task 3: Build the SupportBanner component

**Files:**
- Create: `electron/src/renderer/components/SupportBanner.tsx`

- [ ] **Step 1: Create the SupportBanner component**

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Heart, X } from 'lucide-react';
import type { NudgeState } from '../lib/types';

const GUMROAD_URL = 'https://gumroad.com/l/emdy';

interface SupportBannerProps {
  nudgeState: NudgeState | null;
}

function shouldShowBanner(state: NudgeState): boolean {
  if (state.contributed) return false;
  if (state.dismissCount >= 3) return false;
  if (state.dismissedUntil) {
    const until = new Date(state.dismissedUntil);
    if (new Date() < until) return false;
  }
  if (state.filesOpened < 10) return false;
  if (state.appLaunches < 3) return false;
  if (!state.firstLaunchDate) return false;
  const daysSinceFirst = (Date.now() - new Date(state.firstLaunchDate).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceFirst < 5) return false;
  return true;
}

export function SupportBanner({ nudgeState }: SupportBannerProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (nudgeState && shouldShowBanner(nudgeState) && !dismissed) {
      // Delay showing until user has opened a file (give a moment to settle)
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [nudgeState, dismissed]);

  const handleContribute = useCallback(async () => {
    await window.electronAPI.openExternal(GUMROAD_URL);
    await window.electronAPI.setNudgeSetting('contributed', true);
    setVisible(false);
  }, []);

  const handleLater = useCallback(() => {
    // Dismiss for this session only (in-memory)
    setDismissed(true);
    setVisible(false);
  }, []);

  const handleDismiss = useCallback(async () => {
    // Dismiss for 30 days
    const until = new Date();
    until.setDate(until.getDate() + 30);
    await window.electronAPI.setNudgeSetting('dismissedUntil', until.toISOString());
    const newCount = (nudgeState?.dismissCount ?? 0) + 1;
    await window.electronAPI.setNudgeSetting('dismissCount', newCount);
    setDismissed(true);
    setVisible(false);
  }, [nudgeState]);

  if (!visible) return null;

  return (
    <div className="support-banner">
      <div className="support-banner-content">
        <Heart size={16} strokeWidth={1.5} className="support-banner-icon" />
        <div className="support-banner-text">
          <span className="support-banner-title">Support Emdy</span>
          <span className="support-banner-subtitle">Pay what you want to keep it going.</span>
        </div>
      </div>
      <div className="support-banner-actions">
        <button className="support-banner-cta" onClick={handleContribute}>Contribute</button>
        <button className="support-banner-later" onClick={handleLater}>Later</button>
        <button className="support-banner-close" onClick={handleDismiss} aria-label="Dismiss for 30 days">
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `cd electron && npx tsc --noEmit --skipLibCheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add electron/src/renderer/components/SupportBanner.tsx
git commit -m "feat: add SupportBanner component with trigger logic and dismiss behavior"
```

---

### Task 4: Add SupportBanner styles

**Files:**
- Modify: `electron/src/renderer/styles/global.css`

- [ ] **Step 1: Add banner CSS after the status bar section**

Insert after the `.status-words` rule (around line 737), before the empty states section:

```css
/* ---- Support banner ---- */

.support-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-6);
  padding: var(--space-4) var(--space-5);
  margin: 0 var(--space-3) var(--space-2);
  background: color-mix(in srgb, var(--accent) 6%, transparent);
  border: var(--space-px) solid color-mix(in srgb, var(--accent) 18%, transparent);
  border-radius: var(--radius-md);
  animation: banner-slide-up var(--transition-slow) ease-out;
}

@keyframes banner-slide-up {
  from { opacity: 0; transform: translateY(var(--space-2)); }
  to { opacity: 1; transform: translateY(0); }
}

.support-banner-content {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.support-banner-icon {
  color: var(--accent);
  flex-shrink: 0;
}

.support-banner-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.support-banner-title {
  font-size: var(--fs-base);
  font-weight: 500;
  color: var(--text-primary);
}

.support-banner-subtitle {
  font-size: var(--fs-sm);
  color: var(--text-secondary);
}

.support-banner-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.support-banner-cta {
  padding: var(--space-1-5) var(--space-4);
  background: var(--accent);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
  font-weight: 500;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.support-banner-cta:hover {
  background: var(--accent-hover);
}

.support-banner-later {
  padding: var(--space-1-5) var(--space-3);
  background: transparent;
  border: var(--space-px) solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: var(--fs-sm);
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.support-banner-later:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.support-banner-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--space-6);
  height: var(--space-6);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.support-banner-close:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}
```

- [ ] **Step 2: Check that `--space-1-5` exists in design tokens**

Read `electron/src/renderer/lib/design-tokens.ts` and check if `space-1-5` (6px) exists. If not, add it to the spacing tokens:

```typescript
'1-5': '6px',
```

- [ ] **Step 3: Commit**

```bash
git add electron/src/renderer/styles/global.css electron/src/renderer/lib/design-tokens.ts
git commit -m "feat: add SupportBanner styles with accent-tinted theme"
```

---

### Task 5: Wire SupportBanner into App.tsx

**Files:**
- Modify: `electron/src/renderer/App.tsx`

- [ ] **Step 1: Add imports and state**

Add import at top:

```typescript
import { SupportBanner } from './components/SupportBanner';
import type { NudgeState } from './lib/types';
```

Add state inside the `App` component, after the existing `contextMenu` state:

```typescript
const [nudgeState, setNudgeState] = useState<NudgeState | null>(null);
```

- [ ] **Step 2: Load nudge state on mount**

Add useEffect after the existing `useKeyboardShortcuts` call:

```typescript
useEffect(() => {
  window.electronAPI.getNudgeState().then(setNudgeState);
}, []);
```

- [ ] **Step 3: Render banner in the content column**

In the `renderContent` function, inside the last return block (the one that renders the actual content), add `SupportBanner` between the content-wrapper and StatusBar:

```tsx
return (
  <main id="main-content" className="content-column">
    <div className="content-wrapper">
      <div className={`content-area${minimapVisible ? ' hide-scrollbar' : ''}`} ref={scrollContainerRef}>
        <MarkdownView
          content={content}
          colors={display.resolvedColors}
          filePath={filePath}
          style={markdownStyle}
          contentRef={contentRef}
        />
      </div>
      <Minimap
        visible={minimapVisible}
        contentRef={contentRef}
        scrollContainerRef={scrollContainerRef}
      />
    </div>
    <SupportBanner nudgeState={nudgeState} />
    <StatusBar filePath={filePath} rootPath={dirPath} content={content} />
  </main>
);
```

- [ ] **Step 4: Verify type-check passes**

Run: `cd electron && npx tsc --noEmit --skipLibCheck`
Expected: No errors

- [ ] **Step 5: Test manually**

Run: `cd electron && npm start`

To test the banner quickly, temporarily lower the thresholds in `SupportBanner.tsx` (e.g., `filesOpened < 0` and `appLaunches < 0` and `daysSinceFirst < 0`). Verify:
- Banner appears at the bottom of the content area
- Accent tint matches current color theme
- "Contribute" opens the Gumroad URL in default browser
- "Later" dismisses the banner (reappears on next app launch)
- "X" dismisses the banner (check that `nudge.json` is written in userData)
- Banner respects light/dark mode

Revert the threshold changes after testing.

- [ ] **Step 6: Commit**

```bash
git add electron/src/renderer/App.tsx
git commit -m "feat: wire SupportBanner into app layout"
```

---

### Task 6: Add Support section to SettingsModal

**Files:**
- Modify: `electron/src/renderer/components/SettingsModal.tsx`

- [ ] **Step 1: Add the Support section**

Add a new section after the Appearance section (before the closing `</div>` of the modal):

```tsx
        <div className="settings-section">
          <label className="settings-label">Support</label>
          <button
            className="settings-support-btn"
            onClick={() => window.electronAPI.openExternal('https://gumroad.com/l/emdy')}
          >
            Support Emdy
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
        </div>
```

- [ ] **Step 2: Add button styles to global.css**

Add after the `.settings-option.active` rule:

```css
.settings-support-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: color-mix(in srgb, var(--accent) 6%, transparent);
  border: var(--space-px) solid color-mix(in srgb, var(--accent) 18%, transparent);
  border-radius: var(--radius-sm);
  color: var(--accent);
  font-size: var(--fs-sm);
  font-weight: 500;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.settings-support-btn:hover {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}
```

- [ ] **Step 3: Verify type-check passes**

Run: `cd electron && npx tsc --noEmit --skipLibCheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add electron/src/renderer/components/SettingsModal.tsx electron/src/renderer/styles/global.css
git commit -m "feat: add Support section to Settings modal"
```

---

### Task 7: Build the AboutDialog component

**Files:**
- Create: `electron/src/renderer/components/AboutDialog.tsx`

- [ ] **Step 1: Create the AboutDialog component**

```tsx
import React, { useRef, useEffect, useState } from 'react';
import { useTransition } from '../hooks/useTransition';
import { useFocusTrap } from '../hooks/useFocusTrap';

const GUMROAD_URL = 'https://gumroad.com/l/emdy';
const WEBSITE_URL = 'https://emdyapp.com';

interface AboutDialogProps {
  visible: boolean;
  onClose: () => void;
}

export function AboutDialog({ visible, onClose }: AboutDialogProps) {
  const { mounted, active } = useTransition(visible);
  const modalRef = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState('');
  useFocusTrap(modalRef, visible);

  useEffect(() => {
    if (visible) {
      window.electronAPI.getAppVersion().then(setVersion);
      if (modalRef.current) {
        const firstFocusable = modalRef.current.querySelector<HTMLElement>('button, [href], input');
        firstFocusable?.focus();
      }
    }
  }, [visible]);

  if (!mounted) return null;

  return (
    <div className={`settings-overlay${active ? ' active' : ''}`} onClick={onClose}>
      <div
        ref={modalRef}
        className={`about-modal${active ? ' active' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-modal-title"
      >
        <div className="about-icon">E</div>
        <h2 id="about-modal-title" className="about-name">Emdy</h2>
        <p className="about-version">Version {version}</p>
        <p className="about-tagline">A Markdown reader for macOS</p>
        <div className="about-divider" />
        <button
          className="settings-support-btn"
          onClick={() => window.electronAPI.openExternal(GUMROAD_URL)}
        >
          Support Emdy
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </button>
        <button
          className="about-link"
          onClick={() => window.electronAPI.openExternal(WEBSITE_URL)}
        >
          emdyapp.com
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add AboutDialog styles to global.css**

Add after the settings support button styles:

```css
/* ---- About dialog ---- */

.about-modal {
  width: 280px;
  background: var(--bg-primary);
  border: var(--space-px) solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  padding: var(--space-8) var(--space-6);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: scale(0.96);
  opacity: 0;
  transition: transform var(--transition-normal), opacity var(--transition-normal);
}

.about-modal.active { transform: scale(1); opacity: 1; }

.about-icon {
  width: 64px;
  height: 64px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  font-size: 24px;
  font-weight: 700;
  font-family: var(--font-sans);
  margin-bottom: var(--space-4);
}

.about-name {
  font-size: var(--fs-lg);
  font-weight: 600;
  color: var(--text-heading);
  margin: 0;
}

.about-version {
  font-size: var(--fs-sm);
  color: var(--text-muted);
  margin: var(--space-1) 0 0;
}

.about-tagline {
  font-size: var(--fs-sm);
  color: var(--text-secondary);
  margin: var(--space-1) 0 0;
}

.about-divider {
  width: 100%;
  height: var(--space-px);
  background: var(--border);
  margin: var(--space-5) 0;
}

.about-link {
  margin-top: var(--space-2);
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: var(--fs-sm);
  font-family: var(--font-sans);
  cursor: pointer;
  transition: color var(--transition-fast);
}

.about-link:hover {
  color: var(--text-primary);
}
```

- [ ] **Step 3: Verify type-check passes**

Run: `cd electron && npx tsc --noEmit --skipLibCheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add electron/src/renderer/components/AboutDialog.tsx electron/src/renderer/styles/global.css
git commit -m "feat: add AboutDialog component with version display and support link"
```

---

### Task 8: Wire AboutDialog into App.tsx and handle menu event

**Files:**
- Modify: `electron/src/renderer/App.tsx`

- [ ] **Step 1: Add import and state**

Add import:

```typescript
import { AboutDialog } from './components/AboutDialog';
```

Add state after the existing `nudgeState` state:

```typescript
const [aboutVisible, setAboutVisible] = useState(false);
```

- [ ] **Step 2: Handle 'show-about' menu event**

In the `onMenuEvent` switch statement, add:

```typescript
case 'show-about': setAboutVisible(true); break;
```

- [ ] **Step 3: Render AboutDialog**

Add after the `SettingsModal` JSX:

```tsx
<AboutDialog
  visible={aboutVisible}
  onClose={() => setAboutVisible(false)}
/>
```

- [ ] **Step 4: Verify type-check passes**

Run: `cd electron && npx tsc --noEmit --skipLibCheck`
Expected: No errors

- [ ] **Step 5: Test manually**

Run: `cd electron && npm start`

Verify:
- Help → "About Emdy" opens the About dialog
- Version number displays correctly (should show "0.1.0")
- "Support Emdy" button opens Gumroad URL
- "emdyapp.com" link opens in browser
- Dialog backdrop blur and scale animation work
- Escape key / clicking overlay closes the dialog
- Dialog respects light/dark mode and all color themes

- [ ] **Step 6: Commit**

```bash
git add electron/src/renderer/App.tsx
git commit -m "feat: wire AboutDialog into app and handle show-about menu event"
```

---

### Task 9: Replace macOS default About with custom About

**Files:**
- Modify: `electron/src/main/menu.ts`

- [ ] **Step 1: Replace the role 'about' in the app menu**

In `menu.ts`, the macOS app submenu currently uses `{ role: 'about' as const }`. Replace it with a custom menu item that sends the same event as the Help menu:

```typescript
{
  label: 'About Emdy',
  click: () => sendEvent('show-about'),
},
```

This ensures both the app menu "About Emdy" and Help menu "About Emdy" open our custom dialog instead of Electron's default About panel.

- [ ] **Step 2: Test manually**

Run: `cd electron && npm start`

Verify:
- Emdy menu → "About Emdy" opens the custom About dialog (not the default Electron one)
- Help → "About Emdy" also opens the same dialog

- [ ] **Step 3: Commit**

```bash
git add electron/src/main/menu.ts
git commit -m "feat: replace default About panel with custom AboutDialog"
```

---

### Task 10: Final integration test and cleanup

- [ ] **Step 1: Run full type-check**

Run: `cd electron && npx tsc --noEmit --skipLibCheck`
Expected: No errors

- [ ] **Step 2: Test the complete flow**

Run: `cd electron && npm start`

Full test checklist:
1. Open several files — verify `nudge.json` in userData is being updated
2. Temporarily lower thresholds to trigger the banner — verify it appears
3. Click "Later" — banner disappears, reappears after restarting the app
4. Click "X" — banner disappears, `dismissedUntil` and `dismissCount` set in `nudge.json`
5. Click "Contribute" — Gumroad opens, `contributed` set to true, banner never returns
6. Open Settings — Support section visible at bottom with "Support Emdy ↗" button
7. Help → "About Emdy" — dialog shows icon, name, version, support button, website link
8. Emdy menu → "About Emdy" — same dialog
9. Switch between all 5 color themes — banner and buttons use correct accent color
10. Toggle light/dark mode — banner, settings button, and about dialog adapt

- [ ] **Step 3: Restore original thresholds if modified**

Make sure `SupportBanner.tsx` has the production thresholds:
- `filesOpened < 10`
- `appLaunches < 3`
- `daysSinceFirst < 5`

- [ ] **Step 4: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: final cleanup for support nudge feature"
```
