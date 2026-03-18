import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  openFileDialog: () => ipcRenderer.invoke('file:open-dialog'),
  openDirDialog: () => ipcRenderer.invoke('dir:open-dialog'),
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  scanDirectory: (dirPath: string) => ipcRenderer.invoke('dir:scan', dirPath),

  // File watching
  watchFile: (filePath: string) => ipcRenderer.invoke('file:watch', filePath),
  unwatchFile: () => ipcRenderer.invoke('file:unwatch'),
  onFileChanged: (callback: (filePath: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath);
    ipcRenderer.on('file:changed', handler);
    return () => ipcRenderer.removeListener('file:changed', handler);
  },
  onFileDeleted: (callback: (filePath: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath);
    ipcRenderer.on('file:deleted', handler);
    return () => ipcRenderer.removeListener('file:deleted', handler);
  },

  // Finder / search
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('file:show-in-folder', filePath),
  openInNewWindow: (filePath: string) => ipcRenderer.invoke('file:open-new-window', filePath),
  searchEverything: (query: string) => ipcRenderer.invoke('search:everything', query),

  // Export
  exportPDF: () => ipcRenderer.invoke('export:pdf'),
  print: () => ipcRenderer.invoke('export:print'),
  writeClipboardHTML: (html: string) => ipcRenderer.invoke('clipboard:write-html', html),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSetting: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),

  // Menu events from main process
  onMenuEvent: (callback: (event: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, menuEvent: string) => callback(menuEvent);
    ipcRenderer.on('menu:event', handler);
    return () => ipcRenderer.removeListener('menu:event', handler);
  },

  // File open from main process (drag-drop, open-recent, etc.)
  onFileOpen: (callback: (filePath: string, content: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, filePath: string, content: string) => callback(filePath, content);
    ipcRenderer.on('file:open', handler);
    return () => ipcRenderer.removeListener('file:open', handler);
  },
});
