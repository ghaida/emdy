import { ipcMain, BrowserWindow, dialog } from 'electron';

export function registerExportHandlers() {
  ipcMain.handle('export:pdf', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;

    const result = await dialog.showSaveDialog(win, {
      defaultPath: 'document.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (result.canceled || !result.filePath) return false;

    const data = await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
    });

    const fs = await import('node:fs/promises');
    await fs.writeFile(result.filePath, data);
    return true;
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
    const { clipboard } = await import('electron');
    clipboard.writeHTML(html);
  });
}
