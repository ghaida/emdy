import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { MarkdownView } from './components/MarkdownView';
import { DirectoryBrowser } from './components/DirectoryBrowser';
import { Toolbar } from './components/Toolbar';
import { CommandPalette } from './components/CommandPalette';
import { SettingsModal } from './components/SettingsModal';
import { Minimap } from './components/Minimap';
import { StatusBar } from './components/StatusBar';
import { EmptyState } from './components/EmptyState';
import { WelcomeView } from './components/WelcomeView';
import { SkipLink } from './components/SkipLink';
import { ToastNotification, type Toast } from './components/ToastNotification';
import { FileContextMenu } from './components/FileContextMenu';
import { SupportBanner } from './components/SupportBanner';
import { AboutDialog } from './components/AboutDialog';
import { UpdateDialog } from './components/UpdateDialog';
import { useAnnounce } from './hooks/useAnnounce';
import { useDisplaySettings } from './hooks/useDisplaySettings';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useFileWatcher } from './hooks/useFileWatcher';
import type { FileEntry, NudgeState } from './lib/types';
import { perfMark, perfMeasure } from './lib/perf';

let toastId = 0;

function findFirstFile(entries: FileEntry[]): string | null {
  for (const entry of entries) {
    if (!entry.isDirectory) return entry.path;
  }
  return null;
}

export function App() {
  const [content, setContent] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [dirEntries, setDirEntries] = useState<FileEntry[] | null>(null);
  const [dirPath, setDirPath] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [minimapVisible, setMinimapVisible] = useState(true);
  const [fileDeleted, setFileDeleted] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; filePath: string } | null>(null);
  const [nudgeState, setNudgeState] = useState<NudgeState | null>(null);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [updateVisible, setUpdateVisible] = useState(false);
  const [updateReady, setUpdateReady] = useState<{ version: string; notes: string | null } | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const display = useDisplaySettings();
  const { announce, announceAssertive } = useAnnounce();

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const prevZoomRef = useRef(display.zoom);
  useEffect(() => {
    if (prevZoomRef.current !== display.zoom) {
      announce(`Zoom ${Math.round(display.zoom * 100)}%`);
      prevZoomRef.current = display.zoom;
    }
  }, [display.zoom, announce]);

  const prevFileRef = useRef(filePath);
  useEffect(() => {
    if (filePath && prevFileRef.current !== filePath) {
      announce(`Opened ${filePath.split('/').pop()}`);
    }
    prevFileRef.current = filePath;
  }, [filePath, announce]);

  // Notify main process of file state for dynamic menu
  useEffect(() => {
    window.electronAPI.setMenuHasFile(content !== null);
  }, [content]);

  const handleOpen = useCallback(async () => {
    try {
      const result = await window.electronAPI.openDialog();
      if (!result) return;
      if (result.type === 'file') {
        setContent(result.content);
        setFilePath(result.filePath);
        setFileDeleted(false);
        setFileError(null);
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      } else {
        setDirEntries(result.entries);
        setDirPath(result.dirPath);
        setSidebarVisible(true);
        if (result.entries.length === 0) {
          addToast('No Markdown files found in this directory', 'info');
        } else {
          const first = findFirstFile(result.entries);
          if (first) {
            const fileContent = await window.electronAPI.readFile(first);
            setContent(fileContent);
            setFilePath(first);
            setFileDeleted(false);
            setFileError(null);
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = 0;
            }
          }
        }
      }
    } catch {
      addToast('Failed to open', 'error');
    }
  }, [addToast]);

  const handleFileSelect = useCallback(async (path: string) => {
    try {
      perfMark('file-load-start');
      const fileContent = await window.electronAPI.readFile(path);
      perfMeasure('file-load', 'file-load-start');
      perfMark('render-start');
      setContent(fileContent);
      // Measure render on next frame (after React commits the DOM)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          perfMeasure('render', 'render-start');
        });
      });
      setFilePath(path);
      setFileDeleted(false);
      setFileError(null);
      // Scroll to top of new file
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    } catch {
      setFileError('Could not read the file.');
      addToast('Failed to read file', 'error');
      announceAssertive('Error: could not read file');
    }
  }, [addToast, announceAssertive]);

  const handleExportPDF = useCallback(async () => {
    if (!contentRef.current || !filePath) return;
    const markdownBody = contentRef.current.querySelector('.markdown-body');
    if (!markdownBody) return;

    // Clone and sanitize for print — strip flex layouts and fixed heights
    const clone = markdownBody.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('*').forEach((el) => {
      const s = (el as HTMLElement).style;
      if (s.display === 'flex' || s.display === 'inline-flex') s.display = 'block';
      if (s.height) s.height = 'auto';
      if (s.maxHeight) s.maxHeight = 'none';
      if (s.overflow === 'hidden') s.overflow = 'visible';
    });
    // Remove copy buttons from code blocks
    clone.querySelectorAll('.code-block-copy').forEach((el) => el.remove());

    const html = clone.innerHTML;
    const title = filePath.split('/').pop() || 'document';
    const ok = await window.electronAPI.exportPDF({ html, title });
    if (ok) addToast('PDF exported', 'success');
  }, [addToast, filePath]);

  const handleFileContextMenu = useCallback((e: React.MouseEvent, path: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, filePath: path });
  }, []);

  const handleCopyHTML = useCallback(async () => {
    if (!contentRef.current) return;
    const html = contentRef.current.innerHTML;
    await window.electronAPI.writeClipboardHTML(html);
    addToast('Copied to clipboard', 'success');
  }, [addToast]);

  useFileWatcher(filePath, {
    onChanged: async (path) => {
      try {
        const fileContent = await window.electronAPI.readFile(path);
        setContent(fileContent);
        addToast('File updated', 'info');
      } catch {
        setFileError('File changed but could not be re-read.');
      }
    },
    onDeleted: () => {
      setFileDeleted(true);
      addToast('File was deleted', 'error');
      announceAssertive('File was deleted');
    },
  });

  // Directory watching — live-update sidebar when files are added/removed
  useEffect(() => {
    if (!dirPath) return;

    window.electronAPI.watchDir(dirPath);

    const removeEntriesUpdated = window.electronAPI.onDirEntriesUpdated((entries) => {
      setDirEntries(entries as FileEntry[]);
    });

    return () => {
      window.electronAPI.unwatchDir();
      removeEntriesUpdated();
    };
  }, [dirPath]);

  useKeyboardShortcuts({
    onZoomIn: display.zoomIn,
    onZoomOut: display.zoomOut,
    onZoomReset: display.resetZoom,
    onOpen: handleOpen,
    onFind: () => setSearchVisible((v) => !v),
  });

  useEffect(() => {
    window.electronAPI.getNudgeState().then(setNudgeState);
  }, []);

  // Listen for silent auto-update completion
  useEffect(() => {
    // Check if an update was already downloaded before this component mounted
    window.electronAPI.getUpdateStatus().then((result) => {
      if (result.status === 'downloaded' && result.version) {
        setUpdateReady({ version: result.version, notes: result.notes ?? null });
        setUpdateVisible(true);
      }
    });

    const removeReady = window.electronAPI.onUpdateReady((info) => {
      setUpdateReady(info);
      setUpdateVisible(true);
    });

    return () => { removeReady(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle menu events from main process
  useEffect(() => {
    const removeMenu = window.electronAPI.onMenuEvent((event) => {
      switch (event) {
        case 'open': handleOpen(); break;
        case 'export-pdf': handleExportPDF(); break;
        case 'print': window.electronAPI.print(); break;
        case 'find': setSearchVisible((v) => !v); break;
        case 'zoom-in': display.zoomIn(); break;
        case 'zoom-out': display.zoomOut(); break;
        case 'zoom-reset': display.resetZoom(); break;
        case 'toggle-sidebar': setSidebarVisible((v) => !v); break;
        case 'toggle-minimap': setMinimapVisible((v) => !v); break;
        case 'font-sans': display.setFontFamily('sans'); break;
        case 'font-serif': display.setFontFamily('serif'); break;
        case 'font-mono': display.setFontFamily('mono'); break;
        case 'theme-light': display.setTheme('light'); break;
        case 'theme-dark': display.setTheme('dark'); break;
        case 'theme-system': display.setTheme('system'); break;
        case 'theme-warm': display.setColorTheme('warm'); break;
        case 'theme-cool': display.setColorTheme('cool'); break;
        case 'theme-neutral': display.setColorTheme('neutral'); break;
        case 'show-about': setAboutVisible(true); break;
        case 'check-for-updates': setUpdateVisible(true); break;
      }
    });

    const removeFileOpen = window.electronAPI.onFileOpen((path, fileContent) => {
      setContent(fileContent);
      setFilePath(path);
      setFileDeleted(false);
      setFileError(null);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    });

    const removeDirOpen = window.electronAPI.onDirOpen(async (dirOpenPath, entries) => {
      setDirEntries(entries);
      setDirPath(dirOpenPath);
      setSidebarVisible(true);
      if (entries.length === 0) {
        addToast('No Markdown files found in this directory', 'info');
      } else {
        const first = findFirstFile(entries);
        if (first) {
          try {
            const fileContent = await window.electronAPI.readFile(first);
            setContent(fileContent);
            setFilePath(first);
            setFileDeleted(false);
            setFileError(null);
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = 0;
            }
          } catch {
            addToast('Failed to read file', 'error');
          }
        }
      }
    });

    return () => { removeMenu(); removeFileOpen(); removeDirOpen(); };
  }, [handleOpen, handleExportPDF, display, addToast]);

  // Welcome = nothing loaded at all. Once a folder or file is open, show toolbar.
  const isWelcome = content === null && dirEntries === null;
  const showToolbar = content !== null || dirEntries !== null;

  const fontFamilyVar =
    display.fontFamily === 'sans' ? 'var(--font-sans)' :
    display.fontFamily === 'serif' ? 'var(--font-serif)' :
    'var(--font-mono)';

  const contentWidthStyle = useMemo(() => {
    switch (display.contentWidth) {
      case 'narrow':
        return { maxWidth: `min(${560 * display.zoom}px, 100%)` };
      case 'wide':
        return { maxWidth: '100%' };
      case 'medium':
      default:
        return { maxWidth: `min(${680 * display.zoom}px, 100%)` };
    }
  }, [display.contentWidth, display.zoom]);

  const markdownStyle = useMemo(() => ({
    fontFamily: fontFamilyVar,
    fontSize: `${display.zoom}rem`,
    ...contentWidthStyle,
  }), [contentWidthStyle, fontFamilyVar, display.zoom]);

  const renderContent = () => {
    if (fileDeleted) {
      return (
        <main id="main-content">
          <EmptyState type="file-deleted" onAction={handleOpen} actionLabel="Open Another File" />
        </main>
      );
    }
    if (fileError) {
      return (
        <main id="main-content">
          <EmptyState type="error" message={fileError} onAction={handleOpen} actionLabel="Open Another File" />
        </main>
      );
    }
    if (content === null && dirEntries !== null) {
      return (
        <main id="main-content" className="empty-state">
          <p className="empty-state-message">Select a file to start reading</p>
        </main>
      );
    }
    if (content === null) {
      return (
        <main id="main-content">
          <WelcomeView onOpen={handleOpen} />
        </main>
      );
    }
    return (
      <main id="main-content" className="content-column">
        <SupportBanner nudgeState={nudgeState} />
        <div className="content-wrapper">
          <div className={`content-area${minimapVisible ? ' hide-scrollbar' : ''}`} ref={scrollContainerRef}>
            <MarkdownView
              content={content}
              colors={display.resolvedColors}
              filePath={filePath}
              style={markdownStyle}
              contentRef={contentRef}
            />
          </div>
          <Minimap
            visible={minimapVisible}
            contentRef={contentRef}
            scrollContainerRef={scrollContainerRef}
          />
        </div>
        <StatusBar filePath={filePath} rootPath={dirPath} content={content} />
      </main>
    );
  };

  return (
    <div className="app">
      <SkipLink />
      <div className={`titlebar${isWelcome ? ' titlebar-compact' : ''}`} onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('button, .toolbar-btn, .toolbar-dropdown-wrapper, .toolbar-filename, .toolbar-zoom-group')) return;
        window.electronAPI.toggleMaximize();
      }}>
        {showToolbar && (
          <Toolbar
            zoom={display.zoom}
            fontFamily={display.fontFamily}
            fileName={filePath ? filePath.split('/').pop() || null : null}
            filePath={filePath}
            onFileContextMenu={handleFileContextMenu}
            onZoomIn={display.zoomIn}
            onZoomOut={display.zoomOut}
            onZoomReset={display.resetZoom}
            onFontChange={display.setFontFamily}
            sidebarVisible={sidebarVisible}
            hasSidebar={dirEntries !== null}
            onToggleSidebar={() => setSidebarVisible((v) => !v)}
            minimapVisible={minimapVisible}
            onToggleMinimap={() => setMinimapVisible((v) => !v)}
            onSearch={() => setSearchVisible((v) => !v)}
            onExportPDF={handleExportPDF}
            onCopyHTML={handleCopyHTML}
            onOpenSettings={() => setSettingsVisible(true)}
            hasContent={content !== null}
          />
        )}
      </div>
      <CommandPalette
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onFileSelect={handleFileSelect}
      />
      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        theme={display.theme}
        colorTheme={display.colorTheme}
        contentWidth={display.contentWidth}
        systemAccentColor={display.systemAccentColor}
        onThemeChange={display.setTheme}
        onColorThemeChange={display.setColorTheme}
        onContentWidthChange={display.setContentWidth}
      />
      <AboutDialog
        visible={aboutVisible}
        onClose={() => setAboutVisible(false)}
      />
      <UpdateDialog
        visible={updateVisible}
        onClose={() => setUpdateVisible(false)}
        readyVersion={updateReady}
      />
      <div className="main-layout">
        {dirEntries && (
          <nav aria-label="Files" className={`sidebar-container${sidebarVisible ? ' open' : ''}`}>
            <DirectoryBrowser
              entries={dirEntries}
              activePath={filePath}
              rootPath={dirPath}
              onFileSelect={handleFileSelect}
              onFileContextMenu={handleFileContextMenu}
            />
          </nav>
        )}
        {renderContent()}
      </div>
      <ToastNotification toasts={toasts} onDismiss={dismissToast} />
      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          filePath={contextMenu.filePath}
          onClose={() => setContextMenu(null)}
          onCopyHTML={handleCopyHTML}
          onExportPDF={handleExportPDF}
        />
      )}
    </div>
  );
}
