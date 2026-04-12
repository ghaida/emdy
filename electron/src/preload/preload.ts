import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  openDialog: () => ipcRenderer.invoke('open:dialog'),
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

  // Directory watching
  watchDir: (dirPath: string) => ipcRenderer.invoke('dir:watch', dirPath),
  unwatchDir: () => ipcRenderer.invoke('dir:unwatch'),
  onDirEntriesUpdated: (callback: (entries: unknown[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, entries: unknown[]) => callback(entries);
    ipcRenderer.on('dir:entries-updated', handler);
    return () => ipcRenderer.removeListener('dir:entries-updated', handler);
  },

  // Finder / search
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('file:show-in-folder', filePath),
  openInNewWindow: (filePath: string) => ipcRenderer.invoke('file:open-new-window', filePath),
  searchEverything: (query: string) => ipcRenderer.invoke('search:everything', query),

  // Export
  exportPDF: (opts: { html: string; title: string }) => ipcRenderer.invoke('export:pdf', opts),
  print: () => ipcRenderer.invoke('export:print'),
  writeClipboardHTML: (html: string) => ipcRenderer.invoke('clipboard:write-html', html),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSetting: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),

  // System
  getAccentColor: () => ipcRenderer.invoke('system:accent-color'),
  onAccentColorChanged: (callback: (color: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, color: string) => callback(color);
    ipcRenderer.on('system:accent-color-changed', handler);
    return () => ipcRenderer.removeListener('system:accent-color-changed', handler);
  },

  // Window
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),

  // Menu state
  setMenuHasFile: (hasFile: boolean) => ipcRenderer.invoke('menu:set-has-file', hasFile),

  // Menu events from main process
  onMenuEvent: (callback: (event: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, menuEvent: string) => callback(menuEvent);
    ipcRenderer.on('menu:event', handler);
    return () => ipcRenderer.removeListener('menu:event', handler);
  },

  // File/directory open from main process (drag-drop, open-recent, etc.)
  onFileOpen: (callback: (filePath: string, content: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, filePath: string, content: string) => callback(filePath, content);
    ipcRenderer.on('file:open', handler);
    return () => ipcRenderer.removeListener('file:open', handler);
  },
  onDirOpen: (callback: (dirPath: string, entries: unknown[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, dirPath: string, entries: unknown[]) => callback(dirPath, entries);
    ipcRenderer.on('dir:open', handler);
    return () => ipcRenderer.removeListener('dir:open', handler);
  },

  // Nudge
  getNudgeState: () => ipcRenderer.invoke('nudge:get'),
  setNudgeSetting: (key: string, value: unknown) => ipcRenderer.invoke('nudge:set', key, value),

  // App info
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  checkForUpdate: () => ipcRenderer.invoke('app:check-update'),
  checkForUpdateProactive: () => ipcRenderer.invoke('app:check-update-proactive'),
  skipUpdate: (version: string) => ipcRenderer.invoke('app:skip-update', version),
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
});
