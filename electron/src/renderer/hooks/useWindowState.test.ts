import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWindowState } from './useWindowState';

describe('useWindowState', () => {
  const report = vi.fn();
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    report.mockReset();
    (window as unknown as { electronAPI: { reportWindowState: typeof report } }).electronAPI = {
      reportWindowState: report,
    };
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.useRealTimers();
  });

  function renderState(filePath: string | null, dirPath: string | null, scrollTop = 0) {
    const scrollContainerRef = { current: container };
    const getScrollTop = () => scrollTop;
    return renderHook(
      ({ file, dir }) => useWindowState({ filePath: file, dirPath: dir, scrollContainerRef, getScrollTop }),
      { initialProps: { file: filePath, dir: dirPath } },
    );
  }

  it('reports the file and folder as soon as they are shown', () => {
    renderState('/docs/intro.md', '/docs', 120);
    expect(report).toHaveBeenCalledWith({ filePath: '/docs/intro.md', dirPath: '/docs', scrollTop: 120 });
  });

  it('reports nothing for a window on the welcome screen', () => {
    renderState(null, null);
    container.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(1000);
    expect(report).not.toHaveBeenCalled();
  });

  it('reports the scroll position once scrolling has stopped for half a second', () => {
    renderState('/docs/intro.md', null);
    report.mockClear();
    container.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(300);
    container.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(499);
    expect(report).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('ignores scrolling elsewhere in the window', () => {
    renderState('/docs/intro.md', null);
    report.mockClear();
    const other = document.createElement('div');
    document.body.appendChild(other);
    other.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(1000);
    expect(report).not.toHaveBeenCalled();
    other.remove();
  });

  it('reports again when a different file opens', () => {
    const { rerender } = renderState('/docs/intro.md', '/docs');
    report.mockClear();
    rerender({ file: '/docs/setup.md', dir: '/docs' });
    expect(report).toHaveBeenCalledWith({ filePath: '/docs/setup.md', dirPath: '/docs', scrollTop: 0 });
  });
});
