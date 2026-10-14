// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dialog } from 'electron';
import fsp from 'node:fs/promises';
import { registerExportHandlers } from './pdf-export';

// The print windows pdf-export.ts opens, played by tests: how the page's load
// goes, what printToPDF gives back, and what the print dialog reports.
const print = vi.hoisted(() => ({
  handlers: new Map<string, (event: { sender: unknown }, ...args: unknown[]) => unknown>(),
  // The page of the app window that asks for the export.
  appPage: {},
  load: (): Promise<void> => Promise.resolve(),
  toPDF: (): Promise<Uint8Array> => Promise.resolve(new Uint8Array([37, 80, 68, 70])),
  dialogReports: [true, ''] as [boolean, string],
  windowsOpened: 0,
}));

vi.mock('electron', () => {
  class FakePrintWindow {
    destroyed = false;
    webContents = {
      on: () => undefined,
      setWindowOpenHandler: () => undefined,
      printToPDF: () => print.toPDF(),
      print: (_options: unknown, callback: (success: boolean, failureReason: string) => void) =>
        callback(...print.dialogReports),
    };
    constructor() {
      print.windowsOpened++;
    }
    loadFile() {
      return print.load();
    }
    close() {
      this.destroyed = true;
    }
    isDestroyed() {
      return this.destroyed;
    }
    static fromWebContents(page: unknown) {
      return page === print.appPage ? { appWindow: true } : null;
    }
  }
  return {
    BrowserWindow: FakePrintWindow,
    dialog: { showSaveDialog: vi.fn() },
    ipcMain: {
      handle: (channel: string, handler: (event: { sender: unknown }, ...args: unknown[]) => unknown) =>
        void print.handlers.set(channel, handler),
    },
  };
});

// The page and stylesheet are written to a temp folder; nothing needs to land on disk here.
vi.mock('node:fs/promises', () => {
  const fs = {
    mkdir: vi.fn(async () => undefined),
    writeFile: vi.fn(async () => undefined),
    rm: vi.fn(async () => undefined),
  };
  return { default: fs, ...fs };
});

const doc = { html: '<h1>Notes</h1>', title: 'notes.md' };

// Asks as a page does (the app window's, unless told otherwise) and plays
// every wait out on the fake clock. Gives what the handler answered, or says
// it hasn't.
async function ask(channel: string, sender: unknown = print.appPage): Promise<unknown> {
  let answer: unknown = 'no answer yet';
  void Promise.resolve(print.handlers.get(channel)?.({ sender }, doc)).then(
    (value) => {
      answer = value;
    },
    (error: unknown) => {
      answer = `rejected with ${String(error)}`;
    },
  );
  await vi.runAllTimersAsync();
  return answer;
}

const choosePath = (filePath: string) =>
  vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ canceled: false, filePath });

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  print.handlers.clear();
  print.load = () => Promise.resolve();
  print.toPDF = () => Promise.resolve(new Uint8Array([37, 80, 68, 70]));
  print.dialogReports = [true, ''];
  print.windowsOpened = 0;
  registerExportHandlers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Export as PDF', () => {
  it('writes the PDF where the person chose and answers saved', async () => {
    choosePath('/out/notes.pdf');
    expect(await ask('export:pdf')).toBe('saved');
    expect(fsp.writeFile).toHaveBeenCalledWith('/out/notes.pdf', new Uint8Array([37, 80, 68, 70]));
  });

  it('answers cancelled, and prints nothing, when the save dialog is cancelled', async () => {
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ canceled: true, filePath: '' });
    expect(await ask('export:pdf')).toBe('cancelled');
    expect(print.windowsOpened).toBe(0);
  });

  it("answers failed when the PDF can't be made", async () => {
    choosePath('/out/notes.pdf');
    print.toPDF = () => Promise.reject(new Error('printToPDF failed'));
    expect(await ask('export:pdf')).toBe('failed');
  });

  it('answers failed for a page that has no window', async () => {
    expect(await ask('export:pdf', { notAnAppPage: true })).toBe('failed');
  });
});

describe('Print', () => {
  it.each([
    [[true, ''], 'printed'],
    [[false, 'Print job canceled'], 'cancelled'],
    [[false, 'Print job failed'], 'failed'],
    [[false, 'Invalid printer settings'], 'failed'],
  ] as const)('answers %j from the print dialog with %s', async (reports, answer) => {
    // A failure is logged for the console.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    print.dialogReports = [...reports];
    expect(await ask('export:print')).toBe(answer);
  });
});

describe('the print page', () => {
  it('prints what has loaded when an image keeps the page loading', async () => {
    // Like an https image whose host never answers.
    print.load = () => new Promise(() => undefined);
    choosePath('/out/notes.pdf');
    expect(await ask('export:pdf')).toBe('saved');
  });

  it('answers failed when the page fails to load', async () => {
    print.load = () => Promise.reject(new Error('ERR_FAILED'));
    expect(await ask('export:print')).toBe('failed');
  });
});
