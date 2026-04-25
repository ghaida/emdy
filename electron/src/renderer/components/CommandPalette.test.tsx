import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette } from './CommandPalette';
import { AnnounceProvider } from '../hooks/useAnnounce';

interface TestResult {
  filePath: string;
  fileName: string;
  matchLine?: string;
  lineNumber?: number;
  type: 'file' | 'content';
}

function mockSearchResults(results: TestResult[]) {
  (window as unknown as { electronAPI: { searchEverything: (q: string, root: string) => Promise<TestResult[]> } }).electronAPI = {
    searchEverything: vi.fn().mockResolvedValue(results),
  };
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

  it('shows contextual placeholder when a file is open', async () => {
    mockSearchResults([]);
    renderPalette({ currentFilePath: '/root/notes/today.md' });
    const input = await screen.findByPlaceholderText('Search this file and folder…');
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
    const input = await screen.findByPlaceholderText('Search this file and folder…');
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
});
