# Performance Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Profile the Emdy app with large Markdown files and fix any bottlenecks that exceed performance targets.

**Architecture:** Generate test fixtures, add `performance.now()` instrumentation to key paths, measure five operations, fix what's slow. Profile-first — no speculative optimization.

**Tech Stack:** React 18, TypeScript, Chrome DevTools Performance API

**Spec:** `docs/superpowers/specs/2026-03-22-performance-testing-design.md`

---

### Task 1: Add test-fixtures to .gitignore and generate test files

**Files:**
- Modify: `electron/.gitignore`
- Create: `electron/test-fixtures/generate.js` (Node script)

- [ ] **Step 1: Add test-fixtures to .gitignore**

Append to `electron/.gitignore`:

```
# Performance test fixtures
test-fixtures/
```

- [ ] **Step 2: Create the fixture generator script**

Create `electron/test-fixtures/generate.js`:

```js
const fs = require('fs');
const path = require('path');

function heading(level, text) {
  return '#'.repeat(level) + ' ' + text;
}

function paragraph(words = 50) {
  const lorem = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat'.split(' ');
  const out = [];
  for (let i = 0; i < words; i++) out.push(lorem[i % lorem.length]);
  out[0] = out[0][0].toUpperCase() + out[0].slice(1);
  return out.join(' ') + '.';
}

function codeBlock(lang, lines) {
  const code = Array.from({ length: lines }, (_, i) =>
    `  const value${i} = process(input${i}, { flag: ${i % 2 === 0} });`
  ).join('\n');
  return '```' + lang + '\n' + code + '\n```';
}

function table(rows, cols) {
  const header = '| ' + Array.from({ length: cols }, (_, i) => `Column ${i + 1}`).join(' | ') + ' |';
  const sep = '| ' + Array.from({ length: cols }, () => '---').join(' | ') + ' |';
  const body = Array.from({ length: rows }, (_, r) =>
    '| ' + Array.from({ length: cols }, (_, c) => `Cell ${r + 1}-${c + 1}`).join(' | ') + ' |'
  ).join('\n');
  return header + '\n' + sep + '\n' + body;
}

function taskList(count) {
  return Array.from({ length: count }, (_, i) =>
    `- [${i % 3 === 0 ? 'x' : ' '}] Task item number ${i + 1} with some description text`
  ).join('\n');
}

function nestedList(depth, items) {
  const lines = [];
  for (let i = 0; i < items; i++) {
    const indent = '  '.repeat(i % depth);
    lines.push(`${indent}- List item ${i + 1}: ${paragraph(10)}`);
  }
  return lines.join('\n');
}

function generateFile(name, sections) {
  const parts = [];
  for (const section of sections) {
    parts.push(heading(section.level || 2, section.title));
    parts.push('');
    if (section.paragraphs) {
      for (let i = 0; i < section.paragraphs; i++) {
        parts.push(paragraph(section.wordsPerParagraph || 50));
        parts.push('');
      }
    }
    if (section.code) {
      for (const c of section.code) {
        parts.push(codeBlock(c.lang, c.lines));
        parts.push('');
      }
    }
    if (section.table) {
      parts.push(table(section.table.rows, section.table.cols));
      parts.push('');
    }
    if (section.tasks) {
      parts.push(taskList(section.tasks));
      parts.push('');
    }
    if (section.nestedList) {
      parts.push(nestedList(section.nestedList.depth, section.nestedList.items));
      parts.push('');
    }
  }
  const content = parts.join('\n');
  const filePath = path.join(__dirname, name);
  fs.writeFileSync(filePath, content);
  const lines = content.split('\n').length;
  console.log(`${name}: ${lines} lines, ${(Buffer.byteLength(content) / 1024).toFixed(0)} KB`);
}

// Small: ~500 lines
generateFile('perf-small.md', [
  { title: 'Small Test Document', level: 1, paragraphs: 5 },
  ...Array.from({ length: 5 }, (_, i) => ({
    title: `Section ${i + 1}`, paragraphs: 3,
    code: [{ lang: 'javascript', lines: 10 }],
  })),
]);

// Medium: ~3000 lines
generateFile('perf-medium.md', [
  { title: 'Medium Test Document', level: 1, paragraphs: 3 },
  ...Array.from({ length: 10 }, (_, i) => ({
    title: `Chapter ${i + 1}`, paragraphs: 5, wordsPerParagraph: 80,
    code: [
      { lang: ['javascript', 'python', 'typescript', 'rust', 'go'][i % 5], lines: 60 },
    ],
    ...(i % 3 === 0 ? { table: { rows: 25, cols: 5 } } : {}),
    ...(i % 4 === 0 ? { tasks: 15 } : {}),
  })),
]);

// Large: ~10000 lines
generateFile('perf-large.md', [
  { title: 'Large Test Document', level: 1, paragraphs: 5, wordsPerParagraph: 100 },
  ...Array.from({ length: 30 }, (_, i) => ({
    title: `Module ${i + 1}`, paragraphs: 4, wordsPerParagraph: 80,
    code: [
      { lang: ['javascript', 'python', 'typescript', 'rust', 'go', 'java', 'ruby', 'bash'][i % 8], lines: 80 },
    ],
    ...(i % 5 === 0 ? { table: { rows: 100, cols: 6 } } : {}),
    ...(i % 3 === 0 ? { tasks: 20 } : {}),
    ...(i % 7 === 0 ? { nestedList: { depth: 4, items: 30 } } : {}),
  })),
]);
```

- [ ] **Step 3: Run the generator**

```bash
cd electron && mkdir -p test-fixtures && node test-fixtures/generate.js
```

Verify output shows three files with approximate target line counts.

- [ ] **Step 4: Commit**

```bash
git add electron/.gitignore electron/test-fixtures/generate.js
git commit -m "perf: add test fixture generator and gitignore"
```

---

### Task 2: Add performance instrumentation

**Files:**
- Create: `electron/src/renderer/lib/perf.ts`
- Modify: `electron/src/renderer/App.tsx`
- Modify: `electron/src/renderer/components/Minimap.tsx`
- Modify: `electron/src/renderer/components/CommandPalette.tsx`

- [ ] **Step 1: Create perf utility**

Create `electron/src/renderer/lib/perf.ts`:

```typescript
const ENABLE_PERF = typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('perf');

export function perfMark(label: string) {
  if (!ENABLE_PERF) return;
  performance.mark(label);
}

export function perfMeasure(label: string, startMark: string) {
  if (!ENABLE_PERF) return;
  performance.mark(label + '-end');
  const measure = performance.measure(label, startMark, label + '-end');
  console.log(`[perf] ${label}: ${measure.duration.toFixed(1)}ms`);
}
```

This is opt-in — only logs when `?perf` is in the URL. No overhead in normal use.

- [ ] **Step 2: Instrument file load in App.tsx**

In `App.tsx`, import `perfMark` and `perfMeasure`:

```tsx
import { perfMark, perfMeasure } from './lib/perf';
```

In `handleFileSelect`, add before the `readFile` call:
```tsx
perfMark('file-load-start');
```

Add after `setContent(fileContent)`:
```tsx
perfMeasure('file-load', 'file-load-start');
```

- [ ] **Step 3: Instrument minimap sync in Minimap.tsx**

In `Minimap.tsx`, import `perfMark` and `perfMeasure`.

In `syncContent`, add at the start:
```tsx
perfMark('minimap-sync-start');
```

At the end:
```tsx
perfMeasure('minimap-sync', 'minimap-sync-start');
```

- [ ] **Step 4: Instrument command palette search in CommandPalette.tsx**

In `CommandPalette.tsx`, import `perfMark` and `perfMeasure`.

In the search `useEffect` (the one that calls `window.electronAPI.searchContent` or similar), add marks around the search call:

```tsx
perfMark('search-start');
// ... existing search call ...
perfMeasure('search', 'search-start');
```

- [ ] **Step 5: Commit**

```bash
git add electron/src/renderer/lib/perf.ts electron/src/renderer/App.tsx electron/src/renderer/components/Minimap.tsx electron/src/renderer/components/CommandPalette.tsx
git commit -m "perf: add opt-in performance instrumentation"
```

---

### Task 3: Add React.memo to MarkdownView

**Files:**
- Modify: `electron/src/renderer/components/MarkdownView.tsx`
- Modify: `electron/src/renderer/App.tsx`

This is a low-risk optimization that we can apply proactively — MarkdownView is the most expensive component to re-render and its props should be stable when content hasn't changed.

- [ ] **Step 1: Memoize the style object in App.tsx**

In `App.tsx`, find the `style` prop passed to `MarkdownView` (around line 259). It creates a new object every render. Wrap it in `useMemo`:

```tsx
const markdownStyle = useMemo(() => ({
  fontFamily: fontFamilyVar,
  fontSize: `${display.zoom}rem`,
  maxWidth: `min(${680 * display.zoom}px, 100%)`,
}), [fontFamilyVar, display.zoom]);
```

Then pass `style={markdownStyle}` instead of the inline object.

- [ ] **Step 2: Wrap MarkdownView in React.memo**

In `MarkdownView.tsx`, change the export:

```tsx
export const MarkdownView = React.memo(function MarkdownView({ content, colors, filePath, style, contentRef }: MarkdownViewProps) {
  // ... existing body unchanged ...
});
```

This prevents re-renders when unrelated state changes (toasts, sidebar, minimap toggle, etc.) — MarkdownView only re-renders when its props actually change.

- [ ] **Step 3: Type-check**

```bash
cd electron && npx tsc --noEmit --skipLibCheck
```

- [ ] **Step 4: Commit**

```bash
git add electron/src/renderer/components/MarkdownView.tsx electron/src/renderer/App.tsx
git commit -m "perf: memoize MarkdownView and stabilize its props"
```

---

### Task 4: Profile and measure baseline

**Files:** None (measurement only)

This task requires running the app interactively. The implementer should open the app, load each test fixture, and record timings.

- [ ] **Step 1: Start the app with perf logging**

```bash
cd electron && npm start
```

Once the app opens, open DevTools (Cmd+Option+I). In the Electron URL bar or via the renderer, ensure `?perf` is appended so the perf marks fire. (If Vite doesn't pass query params through, instead change `ENABLE_PERF` in `perf.ts` to `true` temporarily.)

- [ ] **Step 2: Measure initial render for each file**

Open each test fixture file via File > Open:
1. `test-fixtures/perf-small.md`
2. `test-fixtures/perf-medium.md`
3. `test-fixtures/perf-large.md`

Record the `[perf] file-load` time from the console for each. Also note any visible lag or jank during rendering.

- [ ] **Step 3: Measure scroll performance**

With `perf-large.md` open, open the DevTools Performance tab. Click Record, scroll through the document for 5 seconds, then stop. Check:
- Are there frames exceeding 16ms (dropping below 60fps)?
- What's taking time in long frames? (React re-renders? Layout? Paint?)

- [ ] **Step 4: Measure minimap sync**

With `perf-large.md` open, toggle the minimap on. Record the `[perf] minimap-sync` time from the console.

- [ ] **Step 5: Measure command palette search**

With `perf-large.md` open, press Cmd+F to open the command palette. Type a common word (e.g., "const" or "value"). Record `[perf] search` times for each keystroke.

- [ ] **Step 6: Measure theme switch**

With `perf-large.md` open, open DevTools Performance tab and record while switching from light to dark mode. Measure the repaint time.

- [ ] **Step 7: Record baseline results**

Create `docs/superpowers/specs/2026-03-22-performance-report.md` with:

```markdown
# Performance Report

## Test Environment
- Machine: [describe]
- Node/Electron version: [versions]
- Date: 2026-03-22

## Fixture Sizes
| File | Lines | Size |
|------|-------|------|
| perf-small.md | [n] | [KB] |
| perf-medium.md | [n] | [KB] |
| perf-large.md | [n] | [KB] |

## Baseline Measurements

| Operation | Small | Medium | Large | Target |
|-----------|-------|--------|-------|--------|
| Initial render | ms | ms | ms | < 500ms |
| Scroll FPS | fps | fps | fps | 60fps |
| Minimap sync | ms | ms | ms | < 200ms |
| Search (per key) | ms | ms | ms | < 100ms |
| Theme switch | ms | ms | ms | < 100ms |

## Bottlenecks Identified
[List any operations exceeding targets]

## Fixes Applied
[To be filled after Task 5]

## After-Fix Measurements
[To be filled after Task 5]
```

- [ ] **Step 8: Commit the report**

```bash
git add docs/superpowers/specs/2026-03-22-performance-report.md
git commit -m "perf: add baseline performance measurements"
```

---

### Task 5: Fix identified bottlenecks

**Files:** Depends on profiling results from Task 4

This task is conditional — only apply fixes for operations that exceeded their targets in Task 4. The specific fixes depend on what profiling reveals. Guidance for each likely bottleneck:

- [ ] **Step 1: Review baseline results**

Read the performance report from Task 4. For each operation that exceeds its target, apply the corresponding fix below. Skip operations that meet their targets.

- [ ] **Step 2: Fix slow initial render (if > 500ms for large file)**

Likely cause: Prism syntax highlighting all code blocks synchronously on first render.

In `MarkdownView.tsx`, modify `CodeBlock` to defer highlighting for large code blocks:

```tsx
function CodeBlock({ language, codeTheme, children }: {
  language: string;
  codeTheme: Record<string, React.CSSProperties>;
  children: string;
}) {
  const [copied, setCopied] = useState(false);
  const lineCount = children.split('\n').length;
  const MAX_HIGHLIGHTED_LINES = 200;
  const displayContent = lineCount > MAX_HIGHLIGHTED_LINES
    ? children.split('\n').slice(0, MAX_HIGHLIGHTED_LINES).join('\n')
    : children;
  const isTruncated = lineCount > MAX_HIGHLIGHTED_LINES;

  // ... existing handleCopy ...

  return (
    <div className="code-block-wrapper">
      <button className="code-block-copy" onClick={handleCopy} title="Copy code" aria-label="Copy code">
        {copied ? <Check size={14} strokeWidth={1.5} /> : <Copy size={14} strokeWidth={1.5} />}
      </button>
      <SyntaxHighlighter style={codeTheme} language={language} PreTag="div">
        {displayContent}
      </SyntaxHighlighter>
      {isTruncated && (
        <div className="code-block-truncated">
          {lineCount - MAX_HIGHLIGHTED_LINES} more lines (copy to see full code)
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Fix slow minimap sync (if > 200ms)**

Likely cause: `cloneNode(true)` on a large DOM tree is expensive.

In `Minimap.tsx`, throttle `syncContent` so it doesn't re-clone more than once per 500ms:

```tsx
// Add at the top of the component:
const syncPendingRef = useRef(false);
const lastSyncRef = useRef(0);

const throttledSyncContent = useCallback(() => {
  const now = Date.now();
  if (now - lastSyncRef.current < 500) {
    if (!syncPendingRef.current) {
      syncPendingRef.current = true;
      setTimeout(() => {
        syncPendingRef.current = false;
        lastSyncRef.current = Date.now();
        syncContent();
      }, 500 - (now - lastSyncRef.current));
    }
    return;
  }
  lastSyncRef.current = now;
  syncContent();
}, [syncContent]);
```

Then replace `syncContent` with `throttledSyncContent` in the useEffect and MutationObserver callbacks.

- [ ] **Step 4: Fix slow search (if > 100ms per keystroke)**

Likely cause: searching large content string. Limit results to first 50 matches with early termination:

In `CommandPalette.tsx` (or the IPC handler in main process), add an early return after 50 results are found.

- [ ] **Step 5: Fix scroll jank (if < 60fps)**

Likely cause: CSS layout recalculations. Add CSS containment to the scroll container:

In `global.css`, add to `.content-area`:
```css
contain: layout style;
```

And to `.markdown-body`:
```css
contain: layout style;
```

- [ ] **Step 6: Re-measure all operations**

Repeat the measurements from Task 4 with fixes applied. Update the "After-Fix Measurements" section of the performance report.

- [ ] **Step 7: Commit fixes and updated report**

```bash
git add <all modified files>
git commit -m "perf: fix bottlenecks identified during profiling"
```

- [ ] **Step 8: Remove perf instrumentation (or keep behind flag)**

If `ENABLE_PERF` is still hardcoded to `true`, revert it to the URL-param check. The instrumentation can stay in the codebase since it's zero-cost when disabled.

```bash
git add electron/src/renderer/lib/perf.ts
git commit -m "perf: ensure instrumentation is opt-in only"
```
