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
  /** Matches in the whole file, up to 1,000; set on content results. */
  matchCount?: number;
}

export interface SearchScope {
  rootPath: string | null;
  filePath: string | null;
}

export type OpenDialogResult =
  | { type: 'file'; filePath: string; content: string }
  | { type: 'directory'; dirPath: string; entries: FileEntry[] }
  | null;

/** How Export as PDF (export:pdf) and Print (export:print) went. */
export type PdfExportResult = 'saved' | 'cancelled' | 'failed';
export type PrintResult = 'printed' | 'cancelled' | 'failed';

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
  searchEverything: (query: string, scope: SearchScope, generation: number) => Promise<SearchResult[] | null>;
  watchFile: (filePath: string) => Promise<void>;
  unwatchFile: () => Promise<void>;
  onFileChanged: (callback: (filePath: string) => void) => () => void;
  onFileDeleted: (callback: (filePath: string) => void) => () => void;
  watchDir: (dirPath: string) => Promise<void>;
  unwatchDir: () => Promise<void>;
  onDirEntriesUpdated: (callback: (entries: FileEntry[]) => void) => () => void;
  setMenuHasFile: (hasFile: boolean) => Promise<void>;
  reportWindowState: (state: WindowState) => void;
  exportPDF: (opts: { html: string; title: string }) => Promise<PdfExportResult>;
  print: (opts: { html: string; title: string }) => Promise<PrintResult>;
  /** False when main refused the HTML (past the export limit) and wrote nothing. */
  writeClipboardHTML: (html: string) => Promise<boolean>;
  /** `scale` is the device pixels per CSS pixel it was drawn at; the image still pastes at its full pixel size. */
  writeClipboardImage: (png: Uint8Array, scale: number) => Promise<boolean>;
  getAccentColor: () => Promise<string>;
  onAccentColorChanged: (callback: (color: string) => void) => () => void;
  toggleMaximize: () => Promise<void>;
  getSettings: () => Promise<DisplaySettings>;
  getSettingsSync: () => DisplaySettings;
  setSetting: (key: string, value: unknown) => Promise<void>;
  onSettingChanged: (callback: (key: string, value: unknown) => void) => () => void;
  onMenuEvent: (callback: (event: string) => void) => () => void;
  onFileOpen: (callback: (filePath: string, content: string) => void) => () => void;
  onDirOpen: (callback: (dirPath: string, entries: FileEntry[]) => void) => () => void;
  onDropRejected: (callback: (info: { unsupported: number; unreadable: number }) => void) => () => void;
  onWindowRestore: (callback: (state: WindowRestoreState) => void) => () => void;
  /** Tells main the listeners above are registered, so it sends what it held back. */
  reportReady: () => void;
  getNudgeState: () => Promise<NudgeState>;
  setNudgeSetting: (key: string, value: unknown) => Promise<void>;
  getAppVersion: () => Promise<string>;
  checkForUpdate: () => Promise<{ status: string; version?: string; notes?: string | null; error?: string }>;
  getUpdateStatus: () => Promise<{ status: string; version?: string; notes?: string | null; error?: string; upToDate?: boolean }>;
  installUpdate: () => Promise<boolean>;
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
