export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
}

export type FontFamily = 'sans' | 'serif' | 'mono';
export type AppTheme = 'light' | 'dark' | 'system';
export type ColorThemeName = 'warm' | 'cool' | 'neutral' | 'fresh' | 'neon';
export type ContentWidth = 'narrow' | 'medium' | 'wide';

export interface DisplaySettings {
  fontFamily: FontFamily;
  theme: AppTheme;
  colorTheme: ColorThemeName;
  zoom: number;
  contentWidth: ContentWidth;
}

export interface NudgeState {
  filesOpened: number;
  appLaunches: number;
  firstLaunchDate: string | null;
  dismissedUntil: string | null;
  dismissCount: number;
  contributed: boolean;
}

export interface SearchResult {
  filePath: string;
  fileName: string;
  matchLine?: string;
  lineNumber?: number;
  type: 'file' | 'content';
}

export type OpenDialogResult =
  | { type: 'file'; filePath: string; content: string }
  | { type: 'directory'; dirPath: string; entries: FileEntry[] }
  | null;

export interface ElectronAPI {
  openDialog: () => Promise<OpenDialogResult>;
  openFileDialog: () => Promise<{ filePath: string; content: string } | null>;
  openDirDialog: () => Promise<{ dirPath: string; entries: FileEntry[] } | null>;
  readFile: (filePath: string) => Promise<string>;
  scanDirectory: (dirPath: string) => Promise<FileEntry[]>;
  showItemInFolder: (filePath: string) => Promise<void>;
  openInNewWindow: (filePath: string) => Promise<void>;
  searchEverything: (query: string) => Promise<SearchResult[]>;
  watchFile: (filePath: string) => Promise<void>;
  unwatchFile: () => Promise<void>;
  onFileChanged: (callback: (filePath: string) => void) => () => void;
  onFileDeleted: (callback: (filePath: string) => void) => () => void;
  watchDir: (dirPath: string) => Promise<void>;
  unwatchDir: () => Promise<void>;
  onDirEntriesUpdated: (callback: (entries: FileEntry[]) => void) => () => void;
  setMenuHasFile: (hasFile: boolean) => Promise<void>;
  exportPDF: (opts: { html: string; title: string }) => Promise<boolean>;
  print: () => Promise<void>;
  writeClipboardHTML: (html: string) => Promise<void>;
  getAccentColor: () => Promise<string>;
  onAccentColorChanged: (callback: (color: string) => void) => () => void;
  toggleMaximize: () => Promise<void>;
  getSettings: () => Promise<DisplaySettings>;
  setSetting: (key: string, value: unknown) => Promise<void>;
  onMenuEvent: (callback: (event: string) => void) => () => void;
  onFileOpen: (callback: (filePath: string, content: string) => void) => () => void;
  onDirOpen: (callback: (dirPath: string, entries: FileEntry[]) => void) => () => void;
  getNudgeState: () => Promise<NudgeState>;
  setNudgeSetting: (key: string, value: unknown) => Promise<void>;
  getAppVersion: () => Promise<string>;
  checkForUpdate: () => Promise<{ status: string; version?: string; notes?: string | null; error?: string }>;
  getUpdateStatus: () => Promise<{ status: string; version?: string; notes?: string | null; error?: string }>;
  installUpdate: () => Promise<void>;
  skipUpdate: (version: string) => Promise<void>;
  onUpdateReady: (callback: (info: { version: string; notes: string | null }) => void) => () => void;
  onUpdateStatus: (callback: (status: string) => void) => () => void;
  openExternal: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
