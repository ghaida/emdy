export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
}

export type FontFamily = 'sans' | 'serif' | 'mono';
export type AppTheme = 'light' | 'dark' | 'system';
export type ColorThemeName = 'warm' | 'cool';

export interface DisplaySettings {
  fontFamily: FontFamily;
  theme: AppTheme;
  colorTheme: ColorThemeName;
  zoom: number;
}

export interface SearchResult {
  filePath: string;
  fileName: string;
  matchLine?: string;
  lineNumber?: number;
  type: 'file' | 'content';
}

export interface ElectronAPI {
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
  exportPDF: () => Promise<boolean>;
  print: () => Promise<void>;
  writeClipboardHTML: (html: string) => Promise<void>;
  getSettings: () => Promise<DisplaySettings>;
  setSetting: (key: string, value: unknown) => Promise<void>;
  onMenuEvent: (callback: (event: string) => void) => () => void;
  onFileOpen: (callback: (filePath: string, content: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
