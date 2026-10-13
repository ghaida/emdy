import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MenuItemConstructorOptions } from 'electron';

const electron = vi.hoisted(() => ({
  Menu: {
    buildFromTemplate: (template: unknown) => template,
    setApplicationMenu: vi.fn(),
  },
  app: { name: 'Emdy', isPackaged: false, getPath: () => '/Users/test' },
}));
vi.mock('electron', () => electron);

import { buildMenu } from './menu';

type Item = MenuItemConstructorOptions;

function fileMenu(): Item[] {
  const template = electron.Menu.setApplicationMenu.mock.calls.at(-1)?.[0] as Item[];
  return template.find((item) => item.label === 'File')?.submenu as Item[];
}

function openRecent(): Item[] {
  return fileMenu().find((item) => item.label === 'Open Recent')?.submenu as Item[];
}

const click = (item: Item) => (item.click as () => void)();

describe('File > Open Recent', () => {
  const open = vi.fn();
  const clear = vi.fn();

  beforeEach(() => {
    open.mockClear();
    clear.mockClear();
  });

  it('sits right below Open…', () => {
    buildMenu(vi.fn(), false, { paths: [], open, clear });
    expect(fileMenu().slice(0, 2).map((item) => item.label)).toEqual(['Open...', 'Open Recent']);
  });

  it('lists each recent file and folder by its full path, with the home folder as ~', () => {
    buildMenu(vi.fn(), false, { paths: ['/Users/test/notes/a.md', '/Volumes/Work/docs'], open, clear });
    expect(openRecent().map((item) => item.type ?? item.label))
      .toEqual(['~/notes/a.md', '/Volumes/Work/docs', 'separator', 'Clear Menu']);
  });

  it('opens the entry you choose', () => {
    buildMenu(vi.fn(), false, { paths: ['/Users/test/notes/a.md'], open, clear });
    click(openRecent()[0]);
    expect(open).toHaveBeenCalledWith('/Users/test/notes/a.md');
  });

  it('clears the list from Clear Menu', () => {
    buildMenu(vi.fn(), false, { paths: ['/Users/test/notes/a.md'], open, clear });
    const clearItem = openRecent().find((item) => item.label === 'Clear Menu') as Item;
    expect(clearItem.enabled).toBe(true);
    click(clearItem);
    expect(clear).toHaveBeenCalled();
  });

  it('greys out Clear Menu when there is nothing to clear', () => {
    buildMenu(vi.fn(), false, { paths: [], open, clear });
    expect(openRecent()).toEqual([expect.objectContaining({ label: 'Clear Menu', enabled: false })]);
  });
});

describe('File menu', () => {
  it('has a Close item so Cmd+W closes the window, with or without a file open', () => {
    buildMenu(vi.fn(), true, { paths: [], open: vi.fn(), clear: vi.fn() });
    expect(fileMenu().some((item) => item.role === 'close')).toBe(true);
    buildMenu(vi.fn(), false, { paths: [], open: vi.fn(), clear: vi.fn() });
    expect(fileMenu().some((item) => item.role === 'close')).toBe(true);
  });
});
