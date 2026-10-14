import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { App } from './App';
import type { ElectronAPI, FileEntry } from './lib/types';
import { FILE_TOO_LARGE } from '../shared/read-errors';

// What main sends a window, the call that tells main the page is listening,
// file reads, the open dialogs, exports, what the window reports about itself
// and the update checks.
const api = {
  onMenuEvent: vi.fn<ElectronAPI['onMenuEvent']>(() => () => undefined),
  onFileOpen: vi.fn<ElectronAPI['onFileOpen']>(() => () => undefined),
  onDirOpen: vi.fn<ElectronAPI['onDirOpen']>(() => () => undefined),
  onDropRejected: vi.fn<ElectronAPI['onDropRejected']>(() => () => undefined),
  onWindowRestore: vi.fn<ElectronAPI['onWindowRestore']>(() => () => undefined),
  onFileChanged: vi.fn<ElectronAPI['onFileChanged']>(() => () => undefined),
  onFileDeleted: vi.fn<ElectronAPI['onFileDeleted']>(() => () => undefined),
  readFile: vi.fn<ElectronAPI['readFile']>(async () => ''),
  reportReady: vi.fn(),
  checkPendingOpen: vi.fn<ElectronAPI['checkPendingOpen']>(async () => false),
  openDialog: vi.fn<ElectronAPI['openDialog']>(async () => null),
  openDialogInNewWindow: vi.fn<ElectronAPI['openDialogInNewWindow']>(async () => null),
  openInNewWindow: vi.fn<ElectronAPI['openInNewWindow']>(async () => undefined),
  exportPDF: vi.fn<ElectronAPI['exportPDF']>(async () => 'saved'),
  print: vi.fn<ElectronAPI['print']>(async () => 'printed'),
  writeClipboardHTML: vi.fn<ElectronAPI['writeClipboardHTML']>(async () => true),
  reportWindowState: vi.fn<ElectronAPI['reportWindowState']>(),
  getUpdateStatus: vi.fn<ElectronAPI['getUpdateStatus']>(async () => ({ status: 'idle' })),
  checkForUpdate: vi.fn<ElectronAPI['checkForUpdate']>(async () => ({ status: 'checking' })),
  installUpdate: vi.fn<ElectronAPI['installUpdate']>(async () => false),
};

// A menu pick, sent to the listener App registered last.
async function chooseFromMenu(event: string) {
  await act(async () => api.onMenuEvent.mock.calls.at(-1)?.[0](event));
}

// A file or folder from outside (Finder, the Dock, a drop), sent to the
// listener App registered last. Resolves once App has read the folder's first file.
async function openFile(filePath: string, content: string) {
  await act(async () => api.onFileOpen.mock.calls.at(-1)?.[0](filePath, content));
}
async function openFolder(dirPath: string, entries: FileEntry[]) {
  await act(async () => api.onDirOpen.mock.calls.at(-1)?.[0](dirPath, entries));
}

// Entries as scanDirectory lists them: folders first, then files.
const md = (filePath: string): FileEntry => ({ name: filePath.split('/').pop() ?? '', path: filePath, isDirectory: false });
const folder = (dirPath: string, children: FileEntry[]): FileEntry => ({
  name: dirPath.split('/').pop() ?? '',
  path: dirPath,
  isDirectory: true,
  children,
});

async function renderApp() {
  await act(async () => {
    render(<App />);
  });
}

// The toasts on screen, oldest first.
const toastMessages = () => Array.from(document.querySelectorAll('.toast span'), (span) => span.textContent);

beforeEach(() => {
  // Tests queue answers and swap implementations; each starts from the defaults above.
  vi.resetAllMocks();
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  // The minimap watches its size, and jsdom has no ResizeObserver.
  vi.stubGlobal('ResizeObserver', class {
    observe() {
      return undefined;
    }
    unobserve() {
      return undefined;
    }
    disconnect() {
      return undefined;
    }
  });
  // Any other subscription returns an unsubscribe function; every other call resolves empty.
  (window as unknown as { electronAPI: unknown }).electronAPI = new Proxy(api, {
    get: (target, name) =>
      name in target
        ? target[name as keyof typeof api]
        : String(name).startsWith('on') ? () => () => undefined : async () => '',
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it("tells main it's listening only once it has subscribed to what main sends", async () => {
    await act(async () => {
      render(<App />);
    });
    expect(api.reportReady).toHaveBeenCalled();
    const ready = api.reportReady.mock.invocationCallOrder[0];
    for (const subscribe of [api.onMenuEvent, api.onFileOpen, api.onDirOpen, api.onDropRejected, api.onWindowRestore]) {
      expect(subscribe.mock.invocationCallOrder[0]).toBeLessThan(ready);
    }
  });

  it('asks main again when Check for Updates follows an update it already showed', async () => {
    // An update had downloaded when the window opened, so its dialog came up
    // without asking main. Main may have lost it since, say to a failed install.
    api.getUpdateStatus.mockResolvedValueOnce({ status: 'downloaded', version: '1.9.0', notes: null });
    await act(async () => {
      render(<App />);
    });
    const dialog = await screen.findByRole('dialog', { name: 'Software Update' });
    expect(within(dialog).getByText(/Emdy 1\.9\.0 is ready to install/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await chooseFromMenu('check-for-updates');
    expect(api.checkForUpdate).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Checking for updates…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restart to Update' })).not.toBeInTheDocument();
  });

  it('checks again when Check for Updates is chosen while the dialog shows a failed check', async () => {
    await act(async () => {
      render(<App />);
    });
    api.checkForUpdate.mockResolvedValueOnce({ status: 'error', error: 'offline' });
    await chooseFromMenu('check-for-updates');
    expect(screen.getByText(/Could not check for updates/)).toBeInTheDocument();
    // Back online, the user asks again without closing the dialog.
    await chooseFromMenu('check-for-updates');
    expect(api.checkForUpdate).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Checking for updates…')).toBeInTheDocument();
  });

  it("checks again when Check for Updates is chosen while the dialog says the update isn't ready", async () => {
    await act(async () => {
      render(<App />);
    });
    api.checkForUpdate.mockResolvedValueOnce({ status: 'downloaded', version: '1.9.0', notes: null });
    await chooseFromMenu('check-for-updates');
    // Main has lost the download since, so Restart to Update finds nothing to install.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Restart to Update' }));
    });
    expect(screen.getByText(/The update isn't ready to install yet/)).toBeInTheDocument();
    // The user does what the message says, with the dialog still open.
    await chooseFromMenu('check-for-updates');
    expect(api.checkForUpdate).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Checking for updates…')).toBeInTheDocument();
    expect(screen.queryByText(/The update isn't ready to install yet/)).not.toBeInTheDocument();
  });

  it('shows the document again when a deleted file comes back', async () => {
    await act(async () => {
      render(<App />);
    });
    await act(async () => api.onFileOpen.mock.calls.at(-1)?.[0]('/notes/a.md', '# Notes\n\nfirst text'));
    // The page and the minimap's copy of it.
    expect(await screen.findAllByText('first text')).not.toHaveLength(0);

    // Moved to the Trash, then put back: main says it's gone, then that it changed.
    await act(async () => api.onFileDeleted.mock.calls.at(-1)?.[0]('/notes/a.md'));
    expect(screen.getByText('This file has been deleted.')).toBeInTheDocument();
    api.readFile.mockResolvedValueOnce('# Notes\n\nrestored text');
    await act(async () => api.onFileChanged.mock.calls.at(-1)?.[0]('/notes/a.md'));
    expect(await screen.findAllByText('restored text')).not.toHaveLength(0);
    expect(screen.queryByText('This file has been deleted.')).not.toBeInTheDocument();
  });
});

// Each file's text names it, so the page shows which file was read.
const textOf = (filePath: string) => `text of ${filePath}`;

describe('opening a folder', () => {
  beforeEach(() => {
    api.readFile.mockImplementation(async (filePath) => textOf(filePath));
  });

  it('opens the first file the sidebar lists, which puts files before folders', async () => {
    await renderApp();
    await openFolder('/r', [folder('/r/docs', [md('/r/docs/guide.md')]), md('/r/README.md')]);
    expect(await screen.findAllByText(textOf('/r/README.md'))).not.toHaveLength(0);
  });

  it('opens a file inside a folder when the top level has none, again files before subfolders', async () => {
    await renderApp();
    await openFolder('/r', [folder('/r/docs', [folder('/r/docs/api', [md('/r/docs/api/z.md')]), md('/r/docs/guide.md')])]);
    expect(await screen.findAllByText(textOf('/r/docs/guide.md'))).not.toHaveLength(0);
  });

  it('clears the previous document when the folder has no Markdown files', async () => {
    await renderApp();
    await openFile('/a/x.md', '# X\n\nold text');
    expect(await screen.findAllByText('old text')).not.toHaveLength(0);
    await openFolder('/b/empty', []);
    expect(screen.queryAllByText('old text')).toHaveLength(0);
    expect(screen.getByText('Select a file to start reading')).toBeInTheDocument();
    expect(screen.getByText('No Markdown files found in this directory')).toBeInTheDocument();
  });
});

describe('Open Another File', () => {
  beforeEach(() => {
    api.readFile.mockImplementation(async (filePath) => textOf(filePath));
  });

  const sidebar = () => screen.queryByRole('navigation', { name: 'Files' });

  it('opens the dialog in this window after a delete, keeping the folder for a file inside it', async () => {
    await renderApp();
    await openFolder('/r', [md('/r/a.md'), md('/r/b.md')]);
    await act(async () => api.onFileDeleted.mock.calls.at(-1)?.[0]('/r/a.md'));
    api.openDialog.mockResolvedValueOnce({ type: 'file', filePath: '/r/b.md', content: textOf('/r/b.md') });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open Another File' }));
    });
    expect(api.openDialogInNewWindow).not.toHaveBeenCalled();
    expect(await screen.findAllByText(textOf('/r/b.md'))).not.toHaveLength(0);
    expect(sidebar()).toBeInTheDocument();
  });

  it('opens the dialog in this window after a read error, closing the folder for a file outside it', async () => {
    await renderApp();
    await openFolder('/r', [md('/r/a.md'), md('/r/b.md')]);
    api.readFile.mockRejectedValueOnce(new Error('EACCES'));
    await act(async () => {
      fireEvent.click(within(screen.getByRole('navigation', { name: 'Files' })).getByRole('button', { name: 'b.md' }));
    });
    expect(screen.getByText('Could not read the file.')).toBeInTheDocument();
    api.openDialog.mockResolvedValueOnce({ type: 'file', filePath: '/elsewhere/c.md', content: textOf('/elsewhere/c.md') });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open Another File' }));
    });
    expect(await screen.findAllByText(textOf('/elsewhere/c.md'))).not.toHaveLength(0);
    expect(sidebar()).not.toBeInTheDocument();
  });
});

describe('the status bar', () => {
  const statusPath = () => document.querySelector('.status-path')?.textContent;

  it('shows the path inside the open folder, and only the name of a file outside it', async () => {
    api.readFile.mockImplementation(async (filePath) => textOf(filePath));
    await renderApp();
    await openFolder('/work/docs', [folder('/work/docs/notes', [md('/work/docs/notes/a.md')])]);
    expect(statusPath()).toBe('notes/a.md');
    // The next folder's first file never finishes loading, so the page keeps
    // a.md, which isn't in that folder although its path starts the same way.
    api.readFile.mockImplementationOnce(() => new Promise(() => undefined));
    await act(async () => {
      api.onDirOpen.mock.calls.at(-1)?.[0]('/work/doc', [md('/work/doc/b.md')]);
    });
    expect(statusPath()).toBe('a.md');
  });
});

describe('a window still restoring its place', () => {
  // What main saves for the session.
  const lastReport = () => api.reportWindowState.mock.calls.at(-1)?.[0];
  const scrolledTo = () => document.querySelector('.content-area')?.scrollTop;

  // Restored at launch: the window shows its spinner, then main sends the file
  // and how far down it was scrolled.
  async function restoreScrolledTo(scrollTop: number) {
    api.checkPendingOpen.mockResolvedValueOnce(true);
    await renderApp();
    await act(async () =>
      api.onWindowRestore.mock.calls.at(-1)?.[0]({
        dirPath: null,
        entries: null,
        filePath: '/notes/a.md',
        content: textOf('/notes/a.md'),
        scrollTop,
      }),
    );
    expect(lastReport()?.scrollTop).toBe(scrollTop);
  }

  // Lets the spinner finish and any hold on the restored position start.
  async function waitForPage(text: string) {
    await screen.findAllByText(text);
    await act(async () => undefined);
  }

  it('opens a file from outside at the top, not where the restored one was', async () => {
    await restoreScrolledTo(300);
    await openFile('/notes/b.md', textOf('/notes/b.md'));
    await waitForPage(textOf('/notes/b.md'));
    expect(scrolledTo()).toBe(0);
    expect(lastReport()).toEqual({ filePath: '/notes/b.md', dirPath: null, scrollTop: 0 });
  });

  it('opens a folder at the top of its first file, not where the restored one was', async () => {
    api.readFile.mockImplementation(async (filePath) => textOf(filePath));
    await restoreScrolledTo(300);
    await openFolder('/r', [md('/r/b.md')]);
    await waitForPage(textOf('/r/b.md'));
    expect(scrolledTo()).toBe(0);
    expect(lastReport()).toEqual({ filePath: '/r/b.md', dirPath: '/r', scrollTop: 0 });
  });
});

describe("a drop Emdy can't open", () => {
  it.each([
    [{ unsupported: 1, unreadable: 0 }, ['Emdy opens Markdown files and folders']],
    [{ unsupported: 0, unreadable: 1 }, ["Couldn't read the dropped file"]],
    [{ unsupported: 2, unreadable: 1 }, ['Emdy opens Markdown files and folders', "Couldn't read the dropped file"]],
  ])('%j is reported as %j', async (rejected, toasts) => {
    await renderApp();
    await act(async () => api.onDropRejected.mock.calls.at(-1)?.[0](rejected));
    expect(toastMessages()).toEqual(toasts);
  });
});

describe('a file over 10 MB', () => {
  // Main's refusal as the page receives it: only the message crosses IPC.
  const tooLarge = (channel: string) => new Error(`Error invoking remote method '${channel}': Error: ${FILE_TOO_LARGE}`);
  const TOO_LARGE_TOAST = 'The file is larger than 10 MB';

  it('is named as too large when ⌘O picks it, in this window or a new one', async () => {
    await renderApp();
    api.openDialog.mockRejectedValueOnce(tooLarge('open:dialog'));
    await chooseFromMenu('open');
    await waitFor(() => expect(toastMessages()).toEqual([TOO_LARGE_TOAST]));
    // With a document open, ⌘O opens the pick in a new window.
    await openFile('/notes/a.md', '# A\n');
    api.openDialogInNewWindow.mockRejectedValueOnce(tooLarge('open:dialog-in-new-window'));
    await chooseFromMenu('open');
    await waitFor(() => expect(toastMessages()).toEqual([TOO_LARGE_TOAST, TOO_LARGE_TOAST]));
  });

  it('leaves the general message for any other failure to open', async () => {
    await renderApp();
    api.openDialog.mockRejectedValueOnce(new Error("Error invoking remote method 'open:dialog': Error: EACCES: permission denied"));
    await chooseFromMenu('open');
    await waitFor(() => expect(toastMessages()).toEqual(['Failed to open']));
  });

  it('is named as too large when Open in New Window refuses it, from the sidebar or its menu', async () => {
    api.readFile.mockImplementation(async (filePath) => textOf(filePath));
    api.openInNewWindow.mockRejectedValue(tooLarge('file:open-new-window'));
    await renderApp();
    await openFolder('/r', [md('/r/a.md'), md('/r/big.md')]);
    const big = () => within(screen.getByRole('navigation', { name: 'Files' })).getByRole('button', { name: 'big.md' });
    fireEvent.click(big(), { metaKey: true });
    await waitFor(() => expect(toastMessages()).toEqual([TOO_LARGE_TOAST]));
    fireEvent.contextMenu(big());
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open in New Window' }));
    await waitFor(() => expect(toastMessages()).toEqual([TOO_LARGE_TOAST, TOO_LARGE_TOAST]));
    expect(api.openInNewWindow.mock.calls).toEqual([['/r/big.md'], ['/r/big.md']]);
  });
});

describe('Export as PDF and Print', () => {
  // Chooses the menu item with a document open, then lets App take main's answer.
  async function chooseWithDocument(event: 'export-pdf' | 'print') {
    const asked = event === 'export-pdf' ? api.exportPDF : api.print;
    await renderApp();
    await openFile('/notes/a.md', '# Notes\n\nbody text');
    await screen.findAllByText('body text');
    await chooseFromMenu(event);
    await waitFor(() => expect(asked).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve(asked.mock.results.at(-1)?.value).catch(() => undefined);
    });
  }

  it.each([
    ['saved', ['PDF exported']],
    ['cancelled', []],
    ['failed', ['PDF export failed']],
  ] as const)('answers an export that was %s with %j', async (result, toasts) => {
    api.exportPDF.mockResolvedValueOnce(result);
    await chooseWithDocument('export-pdf');
    expect(toastMessages()).toEqual(toasts);
  });

  it.each([
    ['printed', []],
    ['cancelled', []],
    ['failed', ['Print failed']],
  ] as const)('answers a print that was %s with %j', async (result, toasts) => {
    api.print.mockResolvedValueOnce(result);
    await chooseWithDocument('print');
    expect(toastMessages()).toEqual(toasts);
  });

  it('says Print failed when the print request itself fails', async () => {
    api.print.mockRejectedValueOnce(new Error('No handler registered for export:print'));
    await chooseWithDocument('print');
    expect(toastMessages()).toEqual(['Print failed']);
  });
});

describe('Copy to clipboard', () => {
  it.each([
    ['wrote', ['Copied to clipboard'], true],
    ['refused', ['Copy failed'], false],
  ] as const)('answers a copy main %s with %j', async (_what, toasts, written) => {
    api.writeClipboardHTML.mockResolvedValueOnce(written);
    await renderApp();
    await openFile('/notes/a.md', '# Notes\n\nbody text');
    await screen.findAllByText('body text');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));
    });
    await waitFor(() => expect(toastMessages()).toEqual(toasts));
    expect(api.writeClipboardHTML).toHaveBeenCalledTimes(1);
  });
});
