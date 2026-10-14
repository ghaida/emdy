import { ipcMain, BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { hardenWindow, escapeHtml } from './allowed-paths';
import { buildDesignPrintCss } from '../shared/design-print-styles';
import { PRINT_COLORS } from '../shared/print-colors';
import { DIAGRAM_BLOCK_CLASS } from '../shared/diagram-markup';
import type { PdfExportResult, PrintResult } from '../renderer/lib/types';
import { MAX_FILE_BYTES } from './read-text';

// The longest HTML Export as PDF, Print and Copy as HTML take: a guard
// against absurd payloads, not a limit a document should reach. Documents are
// read up to MAX_FILE_BYTES, and highlighted code comes out at 16 to 19 times
// its Markdown (an inline-styled span per token), so 25 times leaves headroom.
export const MAX_EXPORT_HTML_LENGTH = MAX_FILE_BYTES * 25;

// The print page's load waits for every image, and a remote one for as long as
// its host takes to answer, which may be never. Past this, print what has loaded.
const PRINT_LOAD_WAIT_MS = 5000;

// Electron reports a print dialog the person cancelled as a failed print with
// this reason (PrintReasonFromPrintStatus in Electron's
// patches/chromium/printing.patch). Check it again after an Electron upgrade.
const PRINT_CANCELED_REASON = 'Print job canceled';

const PRINT_CSS = `
@page { margin: 20mm; }
* {
  display: block !important;
  float: none !important;
  overflow: visible !important;
  height: auto !important;
  max-height: none !important;
  break-inside: auto !important;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}
span, a, strong, em, del, code, kbd, sub, sup, abbr, mark {
  display: inline !important;
}
input { display: inline-block !important; }
table { display: table !important; break-inside: auto !important; }
thead { display: table-header-group !important; }
tbody { display: table-row-group !important; }
tr { display: table-row !important; }
th, td { display: table-cell !important; }
li { display: list-item !important; }
h1, h2, h3, h4, h5, h6 { break-after: avoid !important; }
img { display: inline-block !important; break-inside: avoid !important; }
title { display: none !important; }
body {
  font-family: 'IBM Plex Sans', -apple-system, sans-serif;
  font-size: 14px;
  line-height: 1.7;
  color: ${PRINT_COLORS.text};
  max-width: 680px;
  margin: 0 auto;
  padding: 0;
}
h1, h2, h3, h4, h5, h6 {
  font-weight: 600;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  line-height: 1.3;
  color: ${PRINT_COLORS.heading};
}
h1 { font-size: 2em; }
h2 { font-size: 1.5em; }
h3 { font-size: 1.25em; }
h4 { font-size: 1.1em; }
p { margin-bottom: 1em; }
a { color: ${PRINT_COLORS.link}; text-decoration: none; }
code {
  background: ${PRINT_COLORS.block};
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.9em;
}
pre {
  background: ${PRINT_COLORS.block};
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  margin-bottom: 1em;
}
pre code { background: none; padding: 0; }
blockquote {
  border-left: 3px solid #CCCCCC;
  padding-left: 16px;
  color: #666666;
  margin-bottom: 1em;
}
ul, ol { padding-left: 24px; margin-bottom: 1em; }
ul { list-style: disc; }
ol { list-style: decimal; }
li { margin-bottom: 0.25em; }
table { width: 100%; border-collapse: collapse; margin-bottom: 1em; font-size: 0.95em; }
th, td { border: 1px solid #DDDDDD; padding: 8px 12px; text-align: left; }
th { background: #F5F5F5; font-weight: 600; }
img { max-width: 100%; }
hr { border: none; border-top: 1px solid #DDDDDD; margin: 2em 0; }
input[type="checkbox"] { margin-right: 8px; }
.code-block-copy { display: none !important; }
.code-block-wrapper { margin-bottom: 1em; }
.task-list-item { list-style: none; }
.task-list-text { display: inline !important; }
.table-wrapper { overflow: visible; }
.${DIAGRAM_BLOCK_CLASS} {
  background: ${PRINT_COLORS.block};
  padding: 16px;
  border-radius: 6px;
  margin-bottom: 1em;
  text-align: center;
  break-inside: avoid !important;
}
${buildDesignPrintCss()}
`;

/**
 * Build a hidden, hardened BrowserWindow that renders the neutral,
 * print-styled document (same PRINT_CSS + CSP + tmp-dir layout used by both
 * "Export as PDF" and "Print"), run `action` against it once it has loaded
 * (or PRINT_LOAD_WAIT_MS has passed) and settled, then ALWAYS close the window
 * and remove the tmp dir.
 *
 * `action` owns the lifetime of the work: the window is only torn down after
 * the returned promise settles. For printToPDF this is a plain await; for
 * webContents.print the promise must not resolve until the print callback
 * fires, or the window would close mid-print.
 */
async function withPrintDocument<T>(
  html: string,
  title: string,
  action: (printWin: BrowserWindow) => Promise<T>
): Promise<T> {
  const tmpDir = path.join(os.tmpdir(), `emdy-print-${Date.now()}`);
  let printWin: BrowserWindow | null = null;
  try {
    printWin = new BrowserWindow({
      show: false,
      width: 800,
      height: 600,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        javascript: false,
      },
    });
    hardenWindow(printWin);

    // Write CSS and HTML as separate files to avoid escaping issues
    await fs.mkdir(tmpDir, { recursive: true });

    const safeTitle = escapeHtml(title);
    await fs.writeFile(path.join(tmpDir, 'print.css'), PRINT_CSS, 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'index.html'), `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' local-file: data: https:; font-src 'self'">
<title>${safeTitle}</title>
<link rel="stylesheet" href="print.css">
</head>
<body>
${html}
</body>
</html>`, 'utf-8');

    const load = printWin.loadFile(path.join(tmpDir, 'index.html'));
    // Closing the window once printing is done rejects a load still waiting on
    // an image; nothing waits for it by then.
    load.catch(() => undefined);
    await Promise.race([load, new Promise((resolve) => setTimeout(resolve, PRINT_LOAD_WAIT_MS))]);
    await new Promise((resolve) => setTimeout(resolve, 500));

    return await action(printWin);
  } finally {
    if (printWin && !printWin.isDestroyed()) printWin.close();
    await fs.rm(tmpDir, { recursive: true }).catch(() => undefined);
  }
}

export function registerExportHandlers() {
  ipcMain.handle('export:pdf', async (event, { html, title }: { html: string; title: string }): Promise<PdfExportResult> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return 'failed';
    // Print's checks, before the save dialog opens.
    if (typeof html !== 'string' || typeof title !== 'string') return 'failed';
    if (html.length > MAX_EXPORT_HTML_LENGTH) return 'failed';

    const savePath = await dialog.showSaveDialog(win, {
      defaultPath: `${title.replace(/\.[^.]+$/, '')}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (savePath.canceled || !savePath.filePath) return 'cancelled';
    const pdfPath = savePath.filePath;

    try {
      await withPrintDocument(html, title, async (printWin) => {
        const pdfData = await printWin.webContents.printToPDF({
          printBackground: true,
          preferCSSPageSize: false,
        });
        await fs.writeFile(pdfPath, pdfData);
      });
      return 'saved';
    } catch {
      return 'failed';
    }
  });

  ipcMain.handle('export:print', async (_event, { html, title }: { html: string; title: string }): Promise<PrintResult> => {
    // Validate payload — reject non-strings and absurdly large HTML before
    // spinning up a window.
    if (typeof html !== 'string' || typeof title !== 'string') return 'failed';
    if (html.length > MAX_EXPORT_HTML_LENGTH) return 'failed';

    try {
      return await withPrintDocument(html, title, (printWin) =>
        // Keep the window alive until the print callback fires — printToPDF
        // awaits, but webContents.print is callback-based, so wrap it in a
        // promise the withPrintDocument teardown waits on.
        new Promise<PrintResult>((resolve) => {
          // printBackground defaults to false for webContents.print, which drops
          // CSS backgrounds (swatch colors, shaded blocks) — printToPDF passes
          // printBackground: true, so match it here for parity. preferCSSPageSize
          // has no webContents.print equivalent (page size comes from @page/the
          // print dialog), so there's nothing else to align.
          printWin.webContents.print({ printBackground: true }, (success, failureReason) => {
            if (success) {
              resolve('printed');
            } else if (failureReason === PRINT_CANCELED_REASON) {
              resolve('cancelled');
            } else {
              console.error('Print failed:', failureReason);
              resolve('failed');
            }
          });
        })
      );
    } catch {
      return 'failed';
    }
  });

  // Answers whether the HTML was written, so the page doesn't report a copy
  // that didn't happen.
  ipcMain.handle('clipboard:write-html', async (_event, html: unknown): Promise<boolean> => {
    if (typeof html !== 'string' || html.length > MAX_EXPORT_HTML_LENGTH) return false;
    const { clipboard } = await import('electron');
    clipboard.writeHTML(html);
    return true;
  });

  ipcMain.handle('clipboard:write-image', async (_event, png: unknown, scale: unknown) => {
    // Like the HTML clipboard: bytes only, nothing absurd.
    if (!(png instanceof Uint8Array) || png.byteLength === 0 || png.byteLength > 20_000_000) return false;
    const { clipboard, nativeImage } = await import('electron');
    // Diagram PNGs are rendered above 1x; mark them with the scale they were
    // drawn at so they paste at their logical size.
    const scaleFactor = typeof scale === 'number' && scale >= 0.25 && scale <= 4 ? scale : 1;
    const image = nativeImage.createFromBuffer(Buffer.from(png.buffer, png.byteOffset, png.byteLength), {
      scaleFactor,
    });
    if (image.isEmpty()) return false;
    clipboard.writeImage(image);
    return true;
  });
}
