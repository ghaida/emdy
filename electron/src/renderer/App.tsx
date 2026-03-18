import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MarkdownView } from './components/MarkdownView';
import { DirectoryBrowser } from './components/DirectoryBrowser';
import { Toolbar } from './components/Toolbar';
import { CommandPalette } from './components/CommandPalette';
import { SettingsModal } from './components/SettingsModal';
import { Minimap } from './components/Minimap';
import { StatusBar } from './components/StatusBar';
import { EmptyState } from './components/EmptyState';
import { WelcomeView } from './components/WelcomeView';
import { ToastNotification, type Toast } from './components/ToastNotification';
import { FileContextMenu } from './components/FileContextMenu';
import { useDisplaySettings } from './hooks/useDisplaySettings';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useFileWatcher } from './hooks/useFileWatcher';
import type { FileEntry } from './lib/types';

let toastId = 0;

export function App() {
  const [content, setContent] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [dirEntries, setDirEntries] = useState<FileEntry[] | null>(null);
  const [dirPath, setDirPath] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [minimapVisible, setMinimapVisible] = useState(false);
  const [fileDeleted, setFileDeleted] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; filePath: string } | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const display = useDisplaySettings();

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleOpenFile = useCallback(async () => {
    try {
      const result = await window.electronAPI.openFileDialog();
      if (result) {
        setContent(result.content);
        setFilePath(result.filePath);
        setFileDeleted(false);
        setFileError(null);
      }
    } catch {
      setFileError('Could not open file.');
      addToast('Failed to open file', 'error');
    }
  }, [addToast]);

  const handleOpenDir = useCallback(async () => {
    try {
      const result = await window.electronAPI.openDirDialog();
      if (result) {
        setDirEntries(result.entries);
        setDirPath(result.dirPath);
        setSidebarVisible(true);
        if (result.entries.length === 0) {
          addToast('No Markdown files found in this directory', 'info');
        }
      }
    } catch {
      addToast('Failed to open directory', 'error');
    }
  }, [addToast]);

  const handleFileSelect = useCallback(async (path: string) => {
    try {
      const fileContent = await window.electronAPI.readFile(path);
      setContent(fileContent);
      setFilePath(path);
      setFileDeleted(false);
      setFileError(null);
    } catch {
      setFileError('Could not read the file.');
      addToast('Failed to read file', 'error');
    }
  }, [addToast]);

  const handleExportPDF = useCallback(async () => {
    const ok = await window.electronAPI.exportPDF();
    if (ok) addToast('PDF exported', 'success');
  }, [addToast]);

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
    },
  });

  useKeyboardShortcuts({
    onZoomIn: display.zoomIn,
    onZoomOut: display.zoomOut,
    onZoomReset: display.resetZoom,
    onOpenFile: handleOpenFile,
    onFind: () => setSearchVisible((v) => !v),
  });

  // Handle menu events from main process
  useEffect(() => {
    const removeMenu = window.electronAPI.onMenuEvent((event) => {
      switch (event) {
        case 'open-file': handleOpenFile(); break;
        case 'open-dir': handleOpenDir(); break;
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
      }
    });

    const removeFileOpen = window.electronAPI.onFileOpen((path, fileContent) => {
      setContent(fileContent);
      setFilePath(path);
      setFileDeleted(false);
      setFileError(null);
    });

    return () => { removeMenu(); removeFileOpen(); };
  }, [handleOpenFile, handleOpenDir, handleExportPDF, display, addToast]);

  // Welcome = nothing loaded at all. Once a folder or file is open, show toolbar.
  const isWelcome = content === null && dirEntries === null;
  const showToolbar = content !== null || dirEntries !== null;

  const fontFamilyVar =
    display.fontFamily === 'sans' ? 'var(--font-sans)' :
    display.fontFamily === 'serif' ? 'var(--font-serif)' :
    'var(--font-mono)';

  const renderContent = () => {
    if (fileDeleted) {
      return <EmptyState type="file-deleted" onAction={handleOpenFile} actionLabel="Open Another File" />;
    }
    if (fileError) {
      return <EmptyState type="error" message={fileError} onAction={handleOpenFile} actionLabel="Open Another File" />;
    }
    if (content === null && dirEntries !== null) {
      return (
        <div className="empty-state">
          <p className="empty-state-message">Select a file to start reading</p>
        </div>
      );
    }
    if (content === null) {
      return <WelcomeView onOpenDir={handleOpenDir} />;
    }
    return (
      <div className="content-wrapper">
        <div className={`content-area${minimapVisible ? ' hide-scrollbar' : ''}`} ref={scrollContainerRef}>
          <MarkdownView
            content={content}
            colors={display.resolvedColors}
            style={{
              fontFamily: fontFamilyVar,
              fontSize: `${display.zoom}rem`,
            }}
            contentRef={contentRef}
          />
        </div>
        <Minimap
          visible={minimapVisible}
          contentRef={contentRef}
          scrollContainerRef={scrollContainerRef}
        />
      </div>
    );
  };

  return (
    <div className="app">
      <div className={`titlebar${isWelcome ? ' titlebar-compact' : ''}`}>
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
        onThemeChange={display.setTheme}
        onColorThemeChange={display.setColorTheme}
      />
      <div className="main-layout">
        {sidebarVisible && dirEntries && (
          <DirectoryBrowser
            entries={dirEntries}
            activePath={filePath}
            rootPath={dirPath}
            onFileSelect={handleFileSelect}
            onFileContextMenu={handleFileContextMenu}
          />
        )}
        {renderContent()}
      </div>
      {showToolbar && <StatusBar filePath={filePath} content={content} onOpenSettings={() => setSettingsVisible(true)} />}
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
