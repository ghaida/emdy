import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  checkPendingOpen: () => ipcRenderer.invoke('window:is-pending-open'),
  // File operations
  openDialog: () => ipcRenderer.invoke('open:dialog'),
  openDialogInNewWindow: () => ipcRenderer.invoke('open:dialog-in-new-window'),
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
  searchEverything: (query: string, rootPath: string) => ipcRenderer.invoke('search:everything', query, rootPath),

  // Export
  exportPDF: (opts: { html: string; title: string }) => ipcRenderer.invoke('export:pdf', opts),
  print: () => ipcRenderer.invoke('export:print'),
  writeClipboardHTML: (html: string) => ipcRenderer.invoke('clipboard:write-html', html),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  getSettingsSync: () => ipcRenderer.sendSync('settings:get-sync'),
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
  checkForUpdate: () => ipcRenderer.invoke('update:check'),
  getUpdateStatus: () => ipcRenderer.invoke('update:get-status'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  skipUpdate: (version: string) => ipcRenderer.invoke('update:skip', version),
  getSkippedVersion: () => ipcRenderer.invoke('update:get-skipped-version'),
  onUpdateReady: (callback: (info: { version: string; notes: string | null }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: { version: string; notes: string | null }) => callback(info);
    ipcRenderer.on('update:ready', handler);
    return () => ipcRenderer.removeListener('update:ready', handler);
  },
  onUpdateStatus: (callback: (status: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: string) => callback(status);
    ipcRenderer.on('update:status', handler);
    return () => ipcRenderer.removeListener('update:status', handler);
  },
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
});
