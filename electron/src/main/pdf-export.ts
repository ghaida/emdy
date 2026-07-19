import { ipcMain, BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { hardenWindow, escapeHtml } from './allowed-paths';

const PRINT_CSS = `
@page { margin: 20mm; }
* {
  display: block !important;
  float: none !important;
  overflow: visible !important;
  height: auto !important;
  max-height: none !important;
  break-inside: auto !important;
}
span, a, strong, em, del, code, kbd, sub, sup, abbr {
  display: inline !important;
}
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
  color: #2C2C2C;
  max-width: 680px;
  margin: 0 auto;
  padding: 0;
}
h1, h2, h3, h4, h5, h6 {
  font-weight: 600;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  line-height: 1.3;
  color: #1A1A1A;
}
h1 { font-size: 2em; }
h2 { font-size: 1.5em; }
h3 { font-size: 1.25em; }
h4 { font-size: 1.1em; }
p { margin-bottom: 1em; }
a { color: #3366AA; text-decoration: none; }
code {
  background: #F0F0F0;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.9em;
}
pre {
  background: #F0F0F0;
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
.design-block { background: #F0F0F0; border-radius: 6px; padding: 16px; margin-bottom: 1em; break-inside: avoid !important; }
.design-header { margin-bottom: 1.5em; }
.design-header-desc { color: #666666; }
.design-token-name { font-family: 'IBM Plex Mono', monospace; font-size: 0.85em; color: #2C2C2C; }
.design-token-value { font-family: 'IBM Plex Mono', monospace; font-size: 0.8em; color: #666666; }
.design-swatch-item { display: inline-block !important; width: 120px; margin: 0 12px 12px 0; vertical-align: top; }
.design-swatch { height: 40px !important; border-radius: 4px; border: 1px solid #DDDDDD; margin-bottom: 8px; }
.design-specimen-row { padding: 12px 0; border-bottom: 1px solid #DDDDDD; }
.design-specimen-row:last-child { border-bottom: none; }
.design-specimen { margin-bottom: 4px; }
.design-fallback-note { display: none !important; }
.design-scale-row { display: grid !important; grid-template-columns: 200px 80px 1fr; column-gap: 12px; align-items: center; padding: 4px 0; }
.design-spacing-bar { height: 12px !important; background: #2C2C2C; border-radius: 4px; }
.design-scale--radius { display: flex !important; gap: 24px; flex-wrap: wrap; }
.design-radius-item { text-align: center; }
.design-radius-square { width: 48px; height: 48px !important; background: #E4E4E4; border: 1px solid #DDDDDD; margin: 0 auto 8px; }
.design-component { margin-bottom: 20px; }
.design-component-name { font-family: 'IBM Plex Mono', monospace; font-size: 0.85em; font-weight: 600; margin-bottom: 8px; }
.design-component-table { width: 100%; table-layout: fixed; }
.design-component-table td:first-child { width: 200px; }
.design-component-table td { border: none; padding: 4px 16px 4px 0; }
.design-mini-swatch { display: inline-block !important; width: 12px; height: 12px !important; border-radius: 2px; border: 1px solid #DDDDDD; margin-right: 8px; vertical-align: baseline; }
`;

export function registerExportHandlers() {
  ipcMain.handle('export:pdf', async (event, { html, title }: { html: string; title: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;

    const savePath = await dialog.showSaveDialog(win, {
      defaultPath: `${title.replace(/\.[^.]+$/, '')}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (savePath.canceled || !savePath.filePath) return false;

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
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'">
<title>${safeTitle}</title>
<link rel="stylesheet" href="print.css">
</head>
<body>
${html}
</body>
</html>`, 'utf-8');

      await printWin.loadFile(path.join(tmpDir, 'index.html'));
      await new Promise((resolve) => setTimeout(resolve, 500));

      const pdfData = await printWin.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: false,
      });

      await fs.writeFile(savePath.filePath, pdfData);
      return true;
    } finally {
      if (printWin && !printWin.isDestroyed()) printWin.close();
      await fs.rm(tmpDir, { recursive: true }).catch(() => {});
    }
  });

  ipcMain.handle('export:print', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    win.webContents.print({}, (success, errorType) => {
      if (!success && errorType) {
        console.error('Print failed:', errorType);
      }
    });
  });

  ipcMain.handle('clipboard:write-html', async (_event, html: string) => {
    if (typeof html !== 'string') return;
    const { clipboard } = await import('electron');
    clipboard.writeHTML(html);
  });
}
