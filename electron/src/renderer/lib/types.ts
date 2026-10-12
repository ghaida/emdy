export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
}

export type FontFamily = 'sans' | 'serif' | 'mono';
export type AppTheme = 'light' | 'dark' | 'system';
export type ColorThemeName = 'warm' | 'cool' | 'neutral' | 'fresh' | 'neon';
export type ContentWidth = 'default' | 'wide';

export const CONTENT_WIDTHS: Record<ContentWidth, number> = {
  default: 680,
  wide: 960,
};

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

/** What a window shows, reported to main (see useWindowState). */
export interface WindowState {
  filePath: string | null;
  dirPath: string | null;
  scrollTop: number;
}

/** A window's folder and file as they were at the last quit (window:restore). */
export interface WindowRestoreState {
  dirPath: string | null;
  entries: FileEntry[] | null;
  filePath: string;
  content: string;
  scrollTop: number;
}

export interface ElectronAPI {
  checkPendingOpen: () => Promise<boolean>;
  openDialog: () => Promise<OpenDialogResult>;
  openDialogInNewWindow: () => Promise<{ opened: true } | null>;
  openFileDialog: () => Promise<{ filePath: string; content: string } | null>;
  openDirDialog: () => Promise<{ dirPath: string; entries: FileEntry[] } | null>;
  readFile: (filePath: string) => Promise<string>;
  scanDirectory: (dirPath: string) => Promise<FileEntry[]>;
  showItemInFolder: (filePath: string) => Promise<void>;
  openInNewWindow: (filePath: string) => Promise<void>;
  searchEverything: (query: string, rootPath: string) => Promise<SearchResult[]>;
  watchFile: (filePath: string) => Promise<void>;
  unwatchFile: () => Promise<void>;
  onFileChanged: (callback: (filePath: string) => void) => () => void;
  onFileDeleted: (callback: (filePath: string) => void) => () => void;
  watchDir: (dirPath: string) => Promise<void>;
  unwatchDir: () => Promise<void>;
  onDirEntriesUpdated: (callback: (entries: FileEntry[]) => void) => () => void;
  setMenuHasFile: (hasFile: boolean) => Promise<void>;
  reportWindowState: (state: WindowState) => void;
  exportPDF: (opts: { html: string; title: string }) => Promise<boolean>;
  print: (opts: { html: string; title: string }) => Promise<boolean>;
  writeClipboardHTML: (html: string) => Promise<void>;
  /** `scale` is device pixels per point, so the image pastes at its logical size. */
  writeClipboardImage: (png: Uint8Array, scale: number) => Promise<boolean>;
  getAccentColor: () => Promise<string>;
  onAccentColorChanged: (callback: (color: string) => void) => () => void;
  toggleMaximize: () => Promise<void>;
  getSettings: () => Promise<DisplaySettings>;
  getSettingsSync: () => DisplaySettings;
  setSetting: (key: string, value: unknown) => Promise<void>;
  onMenuEvent: (callback: (event: string) => void) => () => void;
  onFileOpen: (callback: (filePath: string, content: string) => void) => () => void;
  onDirOpen: (callback: (dirPath: string, entries: FileEntry[]) => void) => () => void;
  onDropRejected: (callback: () => void) => () => void;
  onWindowRestore: (callback: (state: WindowRestoreState) => void) => () => void;
  getNudgeState: () => Promise<NudgeState>;
  setNudgeSetting: (key: string, value: unknown) => Promise<void>;
  getAppVersion: () => Promise<string>;
  checkForUpdate: () => Promise<{ status: string; version?: string; notes?: string | null; error?: string }>;
  getUpdateStatus: () => Promise<{ status: string; version?: string; notes?: string | null; error?: string }>;
  installUpdate: () => Promise<void>;
  skipUpdate: (version: string) => Promise<void>;
  getSkippedVersion: () => Promise<string | null>;
  onUpdateReady: (callback: (info: { version: string; notes: string | null }) => void) => () => void;
  onUpdateStatus: (callback: (status: string) => void) => () => void;
  openExternal: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
