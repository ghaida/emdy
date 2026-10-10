// Diagrams in output that leaves the app: Print, Export as PDF, and Copy RTF.
//
// Those paths clone the live document, but the live SVG doesn't survive the
// trip: it's drawn in the current theme (dark mode would print dark boxes on
// white paper), it depends on the bundled font, and the print stylesheet's
// `* { height: auto !important }` collapses SVG shapes. So every diagram is
// rendered again with the neutral print palette and system fonts, then swapped
// in as an image — vector SVG for print and PDF, PNG for the clipboard, since
// RTF converters drop SVG entirely.

import { errorMessage, renderDiagram, type DiagramResult } from './mermaid-render';
import { buildDiagramTheme, PRINT_DIAGRAM_COLORS, SYSTEM_FONT_FAMILY, type DiagramTheme } from './mermaid-theme';
import { standaloneSvg, svgDataUrl, svgToPng, toBase64 } from './diagram-image';

export const DIAGRAM_BLOCK_SELECTOR = '.mermaid-block';
export const DIAGRAM_SOURCE_ATTR = 'data-mermaid-source';

/** Pasted diagrams are capped at roughly a page column. */
const COPY_MAX_WIDTH = 640;
const COPY_PADDING = 8;

let exportTheme: DiagramTheme | null = null;

export function getExportDiagramTheme(): DiagramTheme {
  if (!exportTheme) exportTheme = buildDiagramTheme(PRINT_DIAGRAM_COLORS, SYSTEM_FONT_FAMILY);
  return exportTheme;
}

function diagramSources(root: ParentNode): string[] {
  const sources = new Set<string>();
  root.querySelectorAll(DIAGRAM_BLOCK_SELECTOR).forEach((block) => {
    const source = block.getAttribute(DIAGRAM_SOURCE_ATTR);
    if (source !== null) sources.add(source);
  });
  return [...sources];
}

/** Render every diagram under `root` with the print theme, keyed by source.
 * Resolves straight away, without loading Mermaid, when there are none. */
export async function renderExportDiagrams(root: ParentNode | null): Promise<Map<string, DiagramResult>> {
  const results = new Map<string, DiagramResult>();
  if (!root) return results;
  for (const source of diagramSources(root)) {
    try {
      results.set(source, await renderDiagram(source, getExportDiagramTheme()));
    } catch (err) {
      results.set(source, { ok: false, error: errorMessage(err) });
    }
  }
  return results;
}

export interface DiagramImage {
  src: string;
  width: number;
  height: number;
  alt: string;
}

/** PNG versions of every diagram under `root`, for Copy RTF. A diagram that
 * fails to render maps to null and is pasted as source instead. */
export async function renderCopyImages(root: ParentNode | null): Promise<Map<string, DiagramImage | null>> {
  const images = new Map<string, DiagramImage | null>();
  for (const [source, result] of await renderExportDiagrams(root)) {
    if (!result.ok) {
      images.set(source, null);
      continue;
    }
    try {
      const png = await svgToPng(result.svg, result.width, result.height, {
        scale: 2,
        padding: COPY_PADDING,
        background: '#FFFFFF',
      });
      const width = result.width + COPY_PADDING * 2;
      const height = result.height + COPY_PADDING * 2;
      const fit = Math.min(1, COPY_MAX_WIDTH / width);
      images.set(source, {
        src: `data:image/png;base64,${toBase64(png)}`,
        width: Math.round(width * fit),
        height: Math.round(height * fit),
        alt: diagramAlt(result.svg),
      });
    } catch {
      images.set(source, null);
    }
  }
  return images;
}

/** The diagram's accessible title (Mermaid's `accTitle`), if it has one. */
export function diagramAlt(svg: string): string {
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(svg)?.[1]?.trim();
  return title || 'Diagram';
}

function sourceAsCode(doc: Document, source: string): HTMLElement {
  const pre = doc.createElement('pre');
  const code = doc.createElement('code');
  code.className = 'language-mermaid';
  code.textContent = source;
  pre.appendChild(code);
  return pre;
}

/** Print and PDF: replace each diagram block's contents with a self-contained
 * SVG image. A diagram without a usable render falls back to its source. */
export function inlineDiagramsForPrint(root: HTMLElement, diagrams: Map<string, DiagramResult>): void {
  const doc = root.ownerDocument;
  root.querySelectorAll<HTMLElement>(DIAGRAM_BLOCK_SELECTOR).forEach((block) => {
    const source = block.getAttribute(DIAGRAM_SOURCE_ATTR) ?? '';
    const result = diagrams.get(source);
    if (!result?.ok) {
      block.replaceWith(sourceAsCode(doc, source));
      return;
    }
    const img = doc.createElement('img');
    img.className = 'mermaid-image';
    img.src = svgDataUrl(standaloneSvg(result.svg, result.width, result.height));
    img.width = Math.round(result.width);
    img.height = Math.round(result.height);
    img.alt = diagramAlt(result.svg);
    block.removeAttribute(DIAGRAM_SOURCE_ATTR);
    block.replaceChildren(img);
  });
}

/** Copy RTF: replace each diagram block with a plain paragraph holding a PNG.
 * RTF conversion turns container backgrounds into ragged shading, so the block
 * itself goes; the image carries its own white background. */
export function inlineDiagramsForCopy(root: HTMLElement, images: Map<string, DiagramImage | null>): void {
  const doc = root.ownerDocument;
  root.querySelectorAll<HTMLElement>(DIAGRAM_BLOCK_SELECTOR).forEach((block) => {
    const source = block.getAttribute(DIAGRAM_SOURCE_ATTR) ?? '';
    const image = images.get(source);
    if (!image) {
      block.replaceWith(sourceAsCode(doc, source));
      return;
    }
    const p = doc.createElement('p');
    const img = doc.createElement('img');
    img.src = image.src;
    img.width = image.width;
    img.height = image.height;
    img.alt = image.alt;
    p.appendChild(img);
    block.replaceWith(p);
  });
}
