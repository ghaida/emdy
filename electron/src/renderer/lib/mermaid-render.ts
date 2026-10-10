// Renders Mermaid source to SVG markup.
//
// - Mermaid is large (several MB across its chunks), so it is imported on
//   first use: documents without diagrams never load it.
// - Mermaid's config is global, so each initialize() + render() pair runs in a
//   queue; otherwise a render could pick up another diagram's theme.
// - Results are cached by (theme, source). Rendering is async, and without the
//   cache every live reload or theme flip back would redraw every diagram,
//   changing the page height under the reader's scroll position.

import type { MermaidConfig } from 'mermaid';
import { DIAGRAM_FONT_FAMILY, type DiagramTheme } from './mermaid-theme';

export type DiagramResult =
  | { ok: true; id: string; svg: string; width: number; height: number }
  | { ok: false; error: string };

type Mermaid = typeof import('mermaid').default;

const MAX_CACHED = 64;
const cache = new Map<string, DiagramResult>();
const inflight = new Map<string, Promise<DiagramResult>>();
let queue: Promise<unknown> = Promise.resolve();
let renderCount = 0;
let loader: Promise<Mermaid> | null = null;

function loadMermaid(): Promise<Mermaid> {
  if (!loader) {
    loader = import('mermaid').then((m) => m.default);
    // A failed chunk load shouldn't poison every later attempt.
    loader.catch(() => {
      loader = null;
    });
  }
  return loader;
}

function cacheKey(source: string, theme: DiagramTheme): string {
  return `${theme.key}\u0000${source}`;
}

function remember(key: string, result: DiagramResult): void {
  cache.delete(key);
  cache.set(key, result);
  while (cache.size > MAX_CACHED) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Synchronous cache lookup, so a remounted block can paint its diagram on the
 * first frame instead of flashing a placeholder. */
export function getCachedDiagram(source: string, theme: DiagramTheme): DiagramResult | undefined {
  const key = cacheKey(source, theme);
  const hit = cache.get(key);
  if (hit) remember(key, hit);
  return hit;
}

export function renderDiagram(source: string, theme: DiagramTheme): Promise<DiagramResult> {
  const key = cacheKey(source, theme);
  const hit = getCachedDiagram(source, theme);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(key);
  if (pending) return pending;

  const task = queue
    .then(() => renderNow(source, theme))
    .then((result) => {
      remember(key, result);
      return result;
    })
    .finally(() => inflight.delete(key));
  queue = task.catch(() => undefined);
  inflight.set(key, task);
  return task;
}

function configFor(theme: DiagramTheme): MermaidConfig {
  return {
    startOnLoad: false,
    // Emdy opens arbitrary files: no click handlers, sanitized labels.
    // Mermaid also refuses to let a diagram's own directives loosen this.
    securityLevel: 'strict',
    suppressErrorRendering: true,
    theme: 'base',
    look: 'classic',
    fontFamily: theme.fontFamily,
    themeVariables: theme.variables,
  };
}

async function fontsReady(fontFamily: string): Promise<void> {
  // Mermaid sizes boxes from measured text; measuring before the bundled font
  // loads leaves labels clipped once it arrives.
  if (fontFamily !== DIAGRAM_FONT_FAMILY || typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all(
      ['16px "IBM Plex Sans"', 'bold 16px "IBM Plex Sans"', 'italic 16px "IBM Plex Sans"'].map((font) =>
        document.fonts.load(font)
      )
    );
  } catch {
    // Render with whatever is available rather than not at all.
  }
}

/** Natural size of a rendered diagram, from its viewBox (or Mermaid's
 * max-width when there is no viewBox). */
export function measureSvg(svg: string): { width: number; height: number } {
  const root = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? '';
  const viewBox = /\sviewBox="([^"]+)"/i.exec(root)?.[1];
  if (viewBox) {
    const [, , w, h] = viewBox.trim().split(/[\s,]+/).map(Number);
    if (w > 0 && h > 0) return { width: w, height: h };
  }
  const maxWidth = Number(/max-width:\s*([\d.]+)px/i.exec(root)?.[1]);
  return { width: maxWidth > 0 ? maxWidth : 0, height: 0 };
}

/** Mermaid's classic look hard-codes white fills on ER "zero" cardinality
 * markers, which shows up as solid dots on dark themes. They're meant to read
 * as hollow, so give them the diagram's background. */
export function fillMarkersWith(svg: string, background: string): string {
  return svg.replace(/<marker\b[\s\S]*?<\/marker>/gi, (marker) => marker.replace(/fill="white"/gi, `fill="${background}"`));
}

export function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.trim() || 'Unknown error';
}

async function renderNow(source: string, theme: DiagramTheme): Promise<DiagramResult> {
  const mermaid = await loadMermaid();
  await fontsReady(theme.fontFamily);
  mermaid.initialize(configFor(theme));
  const id = `emdy-mermaid-${++renderCount}`;
  try {
    const rendered = await mermaid.render(id, source);
    const svg = fillMarkersWith(rendered.svg, theme.background);
    return { ok: true, id, svg, ...measureSvg(svg) };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  } finally {
    // Mermaid renders into a scratch element on <body>; make sure it's gone
    // even on error paths.
    document.getElementById(`d${id}`)?.remove();
  }
}

/** Test hook: forget cached renders and the loaded module. */
export function resetMermaidForTests(): void {
  cache.clear();
  inflight.clear();
  queue = Promise.resolve();
  loader = null;
}
