import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette } from './CommandPalette';
import { AnnounceProvider } from '../hooks/useAnnounce';

interface TestResult {
  filePath: string;
  fileName: string;
  matchLine?: string;
  lineNumber?: number;
  type: 'file' | 'content';
  matchCount?: number;
}

type SearchEverything = (q: string, scope: unknown, generation: number) => Promise<TestResult[]>;

function mockSearchResults(results: TestResult[]) {
  (window as unknown as { electronAPI: { searchEverything: SearchEverything } }).electronAPI = {
    searchEverything: vi.fn().mockResolvedValue(results),
  };
}

// Searches that never answer, so a test can act while one is in flight.
function mockPendingSearches() {
  const searchEverything = vi.fn<SearchEverything>(() => new Promise(() => undefined));
  (window as unknown as { electronAPI: { searchEverything: SearchEverything } }).electronAPI = { searchEverything };
  return searchEverything;
}

function renderPalette(overrides: Partial<Parameters<typeof CommandPalette>[0]> = {}) {
  const props = {
    visible: true,
    onClose: vi.fn(),
    onFileSelect: vi.fn(),
    onFileSelectWithQuery: vi.fn(),
    currentFilePath: null,
    rootPath: null,
    ...overrides,
  };
  const utils = render(
    <AnnounceProvider>
      <CommandPalette {...props} />
    </AnnounceProvider>
  );
  return { ...utils, props };
}

describe('CommandPalette grouping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows legacy placeholder when no file is open', async () => {
    mockSearchResults([]);
    renderPalette();
    const input = await screen.findByPlaceholderText('Search files and content…');
    expect(input).toBeTruthy();
  });

  it('names only the file in the placeholder when a file is open without a folder', async () => {
    mockSearchResults([]);
    renderPalette({ currentFilePath: '/root/notes/today.md' });
    const input = await screen.findByPlaceholderText('Search this file…');
    expect(input).toBeTruthy();
  });

  it('groups matches into In this file / Other files in this folder / Other folders', async () => {
    mockSearchResults([
      { filePath: '/root/notes/today.md', fileName: 'today.md', lineNumber: 3, matchLine: 'alpha here', type: 'content' },
      { filePath: '/root/notes/today.md', fileName: 'today.md', lineNumber: 7, matchLine: 'more alpha', type: 'content' },
      { filePath: '/root/notes/other.md', fileName: 'other.md', lineNumber: 1, matchLine: 'alpha one', type: 'content' },
      { filePath: '/root/notes/other.md', fileName: 'other.md', lineNumber: 5, matchLine: 'alpha two', type: 'content' },
      { filePath: '/root/deep/somewhere.md', fileName: 'somewhere.md', lineNumber: 2, matchLine: 'alpha away', type: 'content' },
    ]);
    const user = userEvent.setup();
    renderPalette({ currentFilePath: '/root/notes/today.md', rootPath: '/root' });
    const input = await screen.findByPlaceholderText('Search this file and folder…');
    await user.type(input, 'alpha');
    await waitFor(() => {
      expect(screen.getByText('In this file')).toBeTruthy();
    });
    expect(screen.getByText('Other files in this folder')).toBeTruthy();
    expect(screen.getByText('Other folders')).toBeTruthy();
    // In-this-file shows per-line entries
    expect(screen.getByText('alpha here')).toBeTruthy();
    expect(screen.getByText('more alpha')).toBeTruthy();
    // Other folders shows a match count for other.md
    expect(screen.getAllByText(/2 matches/).length).toBeGreaterThan(0);
  });

  it('dispatches onFileSelectWithQuery with lineNumber when selecting in-file row', async () => {
    mockSearchResults([
      { filePath: '/root/notes/today.md', fileName: 'today.md', lineNumber: 3, matchLine: 'alpha here', type: 'content' },
      { filePath: '/root/notes/today.md', fileName: 'today.md', lineNumber: 7, matchLine: 'more alpha', type: 'content' },
    ]);
    const user = userEvent.setup();
    const { props } = renderPalette({ currentFilePath: '/root/notes/today.md' });
    const input = await screen.findByPlaceholderText('Search this file…');
    await user.type(input, 'alpha');
    await waitFor(() => {
      expect(screen.getByText('alpha here')).toBeTruthy();
    });
    const row = screen.getByText('alpha here').closest('button')!;
    await user.click(row);
    expect(props.onFileSelectWithQuery).toHaveBeenCalledWith('/root/notes/today.md', 'alpha', 3);
  });

  it('dispatches onFileSelectWithQuery without lineNumber for aggregated rows', async () => {
    mockSearchResults([
      { filePath: '/root/notes/other.md', fileName: 'other.md', lineNumber: 1, matchLine: 'alpha one', type: 'content' },
      { filePath: '/root/notes/other.md', fileName: 'other.md', lineNumber: 5, matchLine: 'alpha two', type: 'content' },
    ]);
    const user = userEvent.setup();
    const { props } = renderPalette({ currentFilePath: '/root/notes/today.md', rootPath: '/root' });
    const input = await screen.findByPlaceholderText('Search this file and folder…');
    await user.type(input, 'alpha');
    await waitFor(() => {
      expect(screen.getByText('other.md')).toBeTruthy();
    });
    const row = screen.getByText('other.md').closest('button')!;
    await user.click(row);
    expect(props.onFileSelectWithQuery).toHaveBeenCalledWith('/root/notes/other.md', 'alpha');
  });

  it('falls back to legacy two-group layout when currentFilePath is null', async () => {
    mockSearchResults([
      { filePath: '/root/doc1.md', fileName: 'doc1.md', type: 'file' },
      { filePath: '/root/doc2.md', fileName: 'doc2.md', lineNumber: 4, matchLine: 'alpha in doc2', type: 'content' },
    ]);
    const user = userEvent.setup();
    renderPalette({ currentFilePath: null, rootPath: '/root' });
    const input = await screen.findByPlaceholderText('Search files and content…');
    await user.type(input, 'alpha');
    await waitFor(() => {
      expect(screen.getByText('Files')).toBeTruthy();
    });
    expect(screen.getByText('Content')).toBeTruthy();
    expect(screen.queryByText('In this file')).toBeNull();
  });

  it('arrow keys skip group headers', async () => {
    mockSearchResults([
      { filePath: '/root/notes/today.md', fileName: 'today.md', lineNumber: 1, matchLine: 'alpha a', type: 'content' },
      { filePath: '/root/notes/other.md', fileName: 'other.md', lineNumber: 1, matchLine: 'alpha b', type: 'content' },
    ]);
    const user = userEvent.setup();
    const { props } = renderPalette({ currentFilePath: '/root/notes/today.md', rootPath: '/root' });
    const input = await screen.findByPlaceholderText('Search this file and folder…');
    await user.type(input, 'alpha');
    await waitFor(() => {
      expect(screen.getByText('alpha a')).toBeTruthy();
    });
    // First row is selected by default. ArrowDown moves to next selectable row (other.md aggregated)
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    expect(props.onFileSelectWithQuery).toHaveBeenCalledWith('/root/notes/other.md', 'alpha');
  });

  it('shows path subtitle for Other folders entries', async () => {
    mockSearchResults([
      { filePath: '/root/deep/sub/somewhere.md', fileName: 'somewhere.md', lineNumber: 2, matchLine: 'alpha away', type: 'content' },
    ]);
    const user = userEvent.setup();
    renderPalette({ currentFilePath: '/root/notes/today.md', rootPath: '/root' });
    const input = await screen.findByPlaceholderText('Search this file and folder…');
    await user.type(input, 'alpha');
    await waitFor(() => {
      expect(screen.getByText('Other folders')).toBeTruthy();
    });
    expect(screen.getByText('deep/sub')).toBeTruthy();
  });

  it('formats match count as singular for 1 and plural for N', async () => {
    mockSearchResults([
      { filePath: '/root/notes/x.md', fileName: 'x.md', lineNumber: 1, matchLine: 'alpha', type: 'content' },
      { filePath: '/root/notes/y.md', fileName: 'y.md', lineNumber: 1, matchLine: 'alpha', type: 'content' },
      { filePath: '/root/notes/y.md', fileName: 'y.md', lineNumber: 2, matchLine: 'alpha again', type: 'content' },
    ]);
    const user = userEvent.setup();
    renderPalette({ currentFilePath: '/root/notes/today.md', rootPath: '/root' });
    const input = await screen.findByPlaceholderText('Search this file and folder…');
    await user.type(input, 'alpha');
    await waitFor(() => {
      expect(screen.getByText('x.md')).toBeTruthy();
    });
    expect(screen.getByText('1 match')).toBeTruthy();
    expect(screen.getByText('2 matches')).toBeTruthy();
  });

  it('shows the match count main reports, capped at 1,000+', async () => {
    mockSearchResults([
      { filePath: '/root/notes/x.md', fileName: 'x.md', lineNumber: 1, matchLine: 'alpha', type: 'content', matchCount: 40 },
      { filePath: '/root/notes/x.md', fileName: 'x.md', lineNumber: 2, matchLine: 'alpha again', type: 'content', matchCount: 40 },
      { filePath: '/root/notes/x.md', fileName: 'x.md', lineNumber: 3, matchLine: 'alpha once more', type: 'content', matchCount: 40 },
      { filePath: '/root/notes/y.md', fileName: 'y.md', lineNumber: 1, matchLine: 'alpha', type: 'content', matchCount: 1000 },
    ]);
    const user = userEvent.setup();
    renderPalette({ currentFilePath: '/root/notes/today.md', rootPath: '/root' });
    const input = await screen.findByPlaceholderText('Search this file and folder…');
    await user.type(input, 'alpha');
    await waitFor(() => {
      expect(screen.getByText('x.md')).toBeTruthy();
    });
    expect(screen.getByText('40 matches')).toBeTruthy();
    expect(screen.getByText('1,000+ matches')).toBeTruthy();
  });

  it('tells main to stop the search in flight when the field is cleared', async () => {
    const searchEverything = mockPendingSearches();
    const user = userEvent.setup();
    renderPalette({ rootPath: '/root' });
    const input = await screen.findByPlaceholderText('Search files and content…');
    await user.type(input, 'alpha');
    await waitFor(() => expect(searchEverything).toHaveBeenCalledTimes(1));
    await user.clear(input);
    await waitFor(() => expect(searchEverything).toHaveBeenCalledTimes(2));
    const [first, cancel] = searchEverything.mock.calls;
    expect(cancel[0]).toBe('');
    expect(cancel[2]).toBeGreaterThan(first[2]);
    await waitFor(() => expect(document.querySelector('.command-palette-spinner')).toBeNull());
  });

  it('tells main to stop the search in flight when the palette closes, then stays quiet', async () => {
    const searchEverything = mockPendingSearches();
    const user = userEvent.setup();
    const { rerender, props } = renderPalette({ rootPath: '/root', currentFilePath: '/root/a.md' });
    const show = (overrides: Partial<Parameters<typeof CommandPalette>[0]>) =>
      rerender(
        <AnnounceProvider>
          <CommandPalette {...props} {...overrides} />
        </AnnounceProvider>
      );
    const input = await screen.findByPlaceholderText('Search this file and folder…');
    await user.type(input, 'alpha');
    await waitFor(() => expect(searchEverything).toHaveBeenCalledTimes(1));
    show({ visible: false });
    expect(searchEverything).toHaveBeenCalledTimes(2);
    const [first, cancel] = searchEverything.mock.calls;
    expect(cancel[0]).toBe('');
    expect(cancel[2]).toBeGreaterThan(first[2]);
    // Switching files with the palette closed sends nothing, not even a cancel.
    show({ visible: false, currentFilePath: '/root/b.md' });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(searchEverything).toHaveBeenCalledTimes(2);
  });

  it('keeps the newer query results when an older query finishes last', async () => {
    // Each call's promise stays pending until the test resolves it, in call order.
    const pending: Array<(results: TestResult[]) => void> = [];
    const searchEverything = vi.fn(
      () =>
        new Promise<TestResult[]>((resolve) => {
          pending.push(resolve);
        }),
    );
    (window as unknown as { electronAPI: { searchEverything: typeof searchEverything } }).electronAPI = { searchEverything };
    const user = userEvent.setup();
    renderPalette({ rootPath: '/root' });
    const input = await screen.findByPlaceholderText('Search files and content…');
    await user.type(input, 'alp');
    await waitFor(() => expect(searchEverything).toHaveBeenCalledTimes(1));
    await user.keyboard('ha');
    await waitFor(() => expect(searchEverything).toHaveBeenCalledTimes(2));

    await act(async () => {
      pending[1]([{ filePath: '/root/b.md', fileName: 'b.md', lineNumber: 1, matchLine: 'second query row', type: 'content' }]);
    });
    await screen.findByText('second query row');

    await act(async () => {
      pending[0]([{ filePath: '/root/a.md', fileName: 'a.md', lineNumber: 1, matchLine: 'first query row', type: 'content' }]);
      // Let the older call's continuation run before checking.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByText('second query row')).toBeTruthy();
    expect(screen.queryByText('first query row')).toBeNull();
  });
});
