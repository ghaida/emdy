# Performance Testing — Large Markdown Files

**Goal:** Profile the app with large Markdown files, identify bottlenecks, and fix any that exceed performance targets.

**Approach:** Profile-first. Generate test fixtures, measure five key operations, fix only what's actually slow.

---

## Test Fixtures

Generate Markdown files at three sizes to exercise different bottlenecks. Save to `electron/test-fixtures/` (gitignored).

| File | Lines | Content mix |
|------|-------|------------|
| `perf-small.md` | ~500 | Headings, paragraphs, inline code, links |
| `perf-medium.md` | ~3,000 | Above + 10 fenced code blocks (50-100 lines each), 2 tables (20+ rows), task lists, images (URLs) |
| `perf-large.md` | ~10,000 | Above scaled up + deeply nested lists, large tables (100+ rows), 30+ code blocks in mixed languages |

## Performance Targets

| Operation | Metric | Target |
|-----------|--------|--------|
| Initial render | Time from file load to content painted | < 500ms for large file |
| Scroll | Frames per second while scrolling | Sustained 60fps |
| Minimap sync | Time for minimap to clone and scale content | < 200ms |
| Command palette search | Time to return results for a query | < 100ms per keystroke |
| Theme switch | Time to repaint after theme change | < 100ms |

## Profiling Method

1. Open each test file in the app with Chrome DevTools open
2. Use the **Performance** tab to record each operation
3. Use **React DevTools Profiler** to identify unnecessary re-renders
4. Measure on a representative machine (standard dev laptop)
5. Profile in dev mode first (where React overhead is highest), then verify in production build

## Fix Strategy

Fix only bottlenecks that exceed the targets. No speculative optimization. The candidates below are hypotheses to investigate — profiling determines which (if any) actually need fixing.

- **react-markdown re-renders**: `MarkdownView` may re-render on unrelated state changes (e.g., toast, sidebar toggle). Fix with `React.memo` — but memo only helps if props are stable. The `style` object and `colors` prop in App.tsx are recreated each render, so those would need `useMemo` in App.tsx first.
- **Minimap DOM cloning**: `syncContent()` clones the entire `.markdown-body` DOM tree. May or may not be a bottleneck — profiling will show. If slow, throttle or use `requestIdleCallback`.
- **Prism syntax highlighting**: Large code blocks (500+ lines) may block the main thread during initial render. If slow, limit highlighting to a maximum line count per block with a "show all" toggle.
- **Command palette content search**: Full-text search across large file content. Already debounced at 200ms. If still slow, simplest fix first (limit result count, early termination) before considering a Worker.

## Deliverable

A Markdown profiling report saved to `docs/superpowers/specs/2026-03-22-performance-report.md` documenting:
- File sizes tested
- Measurements per operation (before and after fixes)
- Bottlenecks identified
- Fixes applied
- Verification that targets are met after fixes

## Files Likely Touched

| File | Potential fix |
|------|--------------|
| `MarkdownView.tsx` | React.memo, stable props |
| `Minimap.tsx` | Throttled cloning |
| `CommandPalette.tsx` | Search optimization |
| `App.tsx` | Prop stability for child components |
| `global.css` | CSS containment (`contain: content`) on scroll containers |
