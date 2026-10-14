import type { DiagramResult } from './mermaid-render';
import { inlineDiagramsForPrint, renderExportDiagrams } from './diagram-export';
import { prepareCodeForExport, type ViewTheme } from './code-export';
import { stripLiveMarkup } from './live-markup';

/**
 * Print/PDF payload with diagrams swapped for their print renders. The content
 * is snapshotted before rendering starts, so a file opened while the diagrams
 * render (a second or more on a cold, diagram-heavy document) can't end up
 * under this file's name.
 */
export async function preparePrintPayload(
  contentRoot: HTMLElement | null,
  filePath: string | null,
  theme?: ViewTheme
): Promise<{ html: string; title: string } | null> {
  const snapshot = contentRoot ? (contentRoot.cloneNode(true) as HTMLElement) : null;
  const diagrams = await renderExportDiagrams(snapshot);
  return buildPrintPayload(snapshot, filePath, diagrams, theme);
}

/**
 * Shared clone-and-sanitize logic for producing a neutral, print-styled
 * document from the live Markdown view. Used by BOTH "Export as PDF" and
 * "Print" so the two paths render the exact same document.
 *
 * Clones `.markdown-body`, drops find's highlights and the view's own
 * attributes (see stripLiveMarkup), swaps Mermaid diagrams for their print
 * renders (see renderExportDiagrams), prepares code blocks for export from
 * `theme` (see prepareCodeForExport: no buttons, full code, print palette from a
 * dark theme), strips inline flex layouts / fixed heights / hidden overflow
 * that only make sense in the live themed viewer, and returns the sanitized
 * innerHTML plus a title derived from the file path.
 *
 * Returns null when there's no content to print (no `.markdown-body` or no
 * open file) so callers can no-op.
 */
export function buildPrintPayload(
  contentRoot: HTMLElement | null,
  filePath: string | null,
  diagrams: Map<string, DiagramResult> = new Map(),
  theme?: ViewTheme
): { html: string; title: string } | null {
  if (!contentRoot || !filePath) return null;
  const markdownBody = contentRoot.querySelector('.markdown-body');
  if (!markdownBody) return null;

  // Clone and sanitize for print — strip flex layouts and fixed heights
  const clone = markdownBody.cloneNode(true) as HTMLElement;
  stripLiveMarkup(clone);
  inlineDiagramsForPrint(clone, diagrams);
  prepareCodeForExport(clone, theme);
  clone.querySelectorAll('*').forEach((el) => {
    const s = (el as HTMLElement).style;
    if (s.display === 'flex' || s.display === 'inline-flex') s.display = 'block';
    if (s.height) s.height = 'auto';
    if (s.maxHeight) s.maxHeight = 'none';
    if (s.overflow === 'hidden') s.overflow = 'visible';
  });

  const html = clone.innerHTML;
  const title = filePath.split('/').pop() || 'document';
  return { html, title };
}
