import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  PanelLeft,
  PanelRight,
  Search,
  Type,
  Minus,
  Plus,
  FileDown,
  Copy,
  MoreHorizontal,
  Settings,
} from 'lucide-react';
import type { FontFamily } from '../lib/types';

const ICON = { size: 16, strokeWidth: 1.5 } as const;
const COLLAPSE_WIDTH = 700;

interface ToolbarProps {
  zoom: number;
  fontFamily: FontFamily;
  fileName: string | null;
  filePath: string | null;
  onFileContextMenu: (e: React.MouseEvent, path: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onFontChange: (font: FontFamily) => void;
  sidebarVisible: boolean;
  hasSidebar: boolean;
  onToggleSidebar: () => void;
  minimapVisible: boolean;
  onToggleMinimap: () => void;
  onSearch: () => void;
  onExportPDF: () => void;
  onCopyHTML: () => void;
  onOpenSettings: () => void;
  hasContent: boolean;
}

const fonts: { value: FontFamily; label: string; family: string }[] = [
  { value: 'sans', label: 'Sans', family: 'var(--font-sans)' },
  { value: 'serif', label: 'Serif', family: 'var(--font-serif)' },
  { value: 'mono', label: 'Mono', family: 'var(--font-mono)' },
];

export function Toolbar({
  zoom,
  fontFamily,
  fileName,
  filePath,
  onFileContextMenu,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFontChange,
  sidebarVisible,
  hasSidebar,
  onToggleSidebar,
  minimapVisible,
  onToggleMinimap,
  onSearch,
  onExportPDF,
  onCopyHTML,
  onOpenSettings,
  hasContent,
}: ToolbarProps) {
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [rovingIndex, setRovingIndex] = useState(0);
  const fontMenuRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    if (!fontMenuOpen && !overflowOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (fontMenuOpen && fontMenuRef.current && !fontMenuRef.current.contains(e.target as Node)) {
        setFontMenuOpen(false);
      }
      if (overflowOpen && overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [fontMenuOpen, overflowOpen]);

  // Watch window width for collapse
  useEffect(() => {
    const check = () => setCollapsed(window.innerWidth < COLLAPSE_WIDTH);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const getToolbarButtons = useCallback((): HTMLButtonElement[] => {
    if (!toolbarRef.current) return [];
    return Array.from(
      toolbarRef.current.querySelectorAll<HTMLButtonElement>('[data-toolbar-btn]')
    );
  }, []);

  const handleToolbarKeyDown = useCallback((e: React.KeyboardEvent) => {
    const buttons = getToolbarButtons();
    if (buttons.length === 0) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const direction = e.key === 'ArrowRight' ? 1 : -1;
      const next = (rovingIndex + direction + buttons.length) % buttons.length;
      setRovingIndex(next);
      buttons[next]?.focus();
    }
  }, [rovingIndex, getToolbarButtons]);

  useEffect(() => {
    const buttons = getToolbarButtons();
    buttons.forEach((btn, i) => {
      btn.tabIndex = i === rovingIndex ? 0 : -1;
    });
  }, [rovingIndex, getToolbarButtons, fontMenuOpen, overflowOpen, collapsed, hasContent]);

  const pct = Math.round(zoom * 100);
  const currentFont = fonts.find((f) => f.value === fontFamily) || fonts[0];

  return (
    <div className="toolbar" role="toolbar" aria-label="Document tools" ref={toolbarRef} onKeyDown={handleToolbarKeyDown}>
      {/* Left: sidebar toggle + filename */}
      <div className="toolbar-left">
        {hasSidebar && (
          <button
            className="toolbar-btn"
            onClick={onToggleSidebar}
            data-tooltip="Toggle sidebar  ⌘B"
            aria-label="Toggle sidebar"
            aria-expanded={sidebarVisible}
            data-toolbar-btn
          >
            <PanelLeft {...ICON} />
          </button>
        )}
        {fileName && filePath && (
          <span
            className="toolbar-filename"
            title={filePath}
            onContextMenu={(e) => onFileContextMenu(e, filePath)}
          >
            {fileName}
          </span>
        )}
      </div>

      {/* Center: spacer for drag region */}
      <div className="toolbar-center" />

      {/* Right: search, zoom, font, copy, download, minimap */}
      <div className="toolbar-right">
        {hasContent && !collapsed && (
          <>
            {/* Zoom */}
            <div className="toolbar-zoom-group">
              <button className="toolbar-btn" onClick={onZoomOut} data-tooltip="Zoom out  ⌘−" aria-label="Zoom out" data-toolbar-btn>
                <Minus {...ICON} />
              </button>
              <button className="toolbar-btn zoom-label" onClick={onZoomReset} data-tooltip="Reset zoom  ⌘0" aria-label={`Zoom reset, currently ${pct}%`} data-toolbar-btn>
                {pct}%
              </button>
              <button className="toolbar-btn" onClick={onZoomIn} data-tooltip="Zoom in  ⌘+" aria-label="Zoom in" data-toolbar-btn>
                <Plus {...ICON} />
              </button>
            </div>

            {/* Search */}
            {hasSidebar && (
              <button className="toolbar-btn" onClick={onSearch} data-tooltip="Search  ⌘F" aria-label="Search files" data-toolbar-btn>
                <Search {...ICON} />
              </button>
            )}

            {/* Font dropdown */}
            <div className="toolbar-dropdown-wrapper" ref={fontMenuRef}>
              <button
                className={`toolbar-btn${fontMenuOpen ? ' active' : ''}`}
                onClick={() => setFontMenuOpen((v) => !v)}
                data-tooltip="Font"
                aria-label="Font"
                aria-haspopup="true"
                aria-expanded={fontMenuOpen}
                data-toolbar-btn
              >
                <Type {...ICON} />
              </button>
              {fontMenuOpen && (
                <div className="toolbar-dropdown" role="menu">
                  {fonts.map((f) => (
                    <button
                      key={f.value}
                      className={`toolbar-dropdown-item${fontFamily === f.value ? ' active' : ''}`}
                      style={{ fontFamily: f.family }}
                      onClick={() => { onFontChange(f.value); setFontMenuOpen(false); }}
                      role="menuitem"
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Copy */}
            <button className="toolbar-btn" onClick={onCopyHTML} data-tooltip="Copy formatted" aria-label="Copy to clipboard" data-toolbar-btn>
              <Copy {...ICON} />
            </button>

            {/* Export PDF */}
            <button className="toolbar-btn" onClick={onExportPDF} data-tooltip="Export PDF  ⌘⇧E" aria-label="Export as PDF" data-toolbar-btn>
              <FileDown {...ICON} />
            </button>


            {/* Settings */}
            <button className="toolbar-btn" onClick={onOpenSettings} data-tooltip="Settings" aria-label="Settings" data-toolbar-btn>
              <Settings {...ICON} />
            </button>

            {/* Minimap — rightmost */}
            <button
              className="toolbar-btn"
              onClick={onToggleMinimap}
              data-tooltip="Toggle minimap  ⌘M"
              aria-label="Toggle minimap"
              aria-expanded={minimapVisible}
              data-toolbar-btn
            >
              <PanelRight {...ICON} />
            </button>
          </>
        )}

        {/* Search when no content but sidebar open */}
        {!hasContent && hasSidebar && (
          <button className="toolbar-btn" onClick={onSearch} data-tooltip="Search  ⌘F" aria-label="Search files" data-toolbar-btn>
            <Search {...ICON} />
          </button>
        )}

        {/* Collapsed: overflow menu */}
        {hasContent && collapsed && (
          <>
            <div className="toolbar-dropdown-wrapper" ref={overflowRef}>
              <button
                className={`toolbar-btn${overflowOpen ? ' active' : ''}`}
                onClick={() => setOverflowOpen((v) => !v)}
                data-tooltip="More actions"
                aria-label="More actions"
                aria-haspopup="true"
                aria-expanded={overflowOpen}
                data-toolbar-btn
              >
                <MoreHorizontal {...ICON} />
              </button>
              {overflowOpen && (
                <div className="toolbar-dropdown toolbar-overflow-dropdown" role="menu">
                  <div className="toolbar-overflow-group">
                    <span className="toolbar-overflow-label">Font</span>
                    {fonts.map((f) => (
                      <button
                        key={f.value}
                        className={`toolbar-dropdown-item${fontFamily === f.value ? ' active' : ''}`}
                        style={{ fontFamily: f.family }}
                        onClick={() => { onFontChange(f.value); setOverflowOpen(false); }}
                        role="menuitem"
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="toolbar-overflow-divider" />
                  <button className="toolbar-dropdown-item" onClick={() => { onExportPDF(); setOverflowOpen(false); }} role="menuitem">
                    <FileDown size={14} strokeWidth={1.5} /> Export PDF
                  </button>
                  <button className="toolbar-dropdown-item" onClick={() => { onCopyHTML(); setOverflowOpen(false); }} role="menuitem">
                    <Copy size={14} strokeWidth={1.5} /> Copy as formatted text
                  </button>
                </div>
              )}
            </div>


            {/* Minimap — rightmost even in collapsed */}
            <button
              className="toolbar-btn"
              onClick={onToggleMinimap}
              data-tooltip="Toggle minimap  ⌘M"
              aria-label="Toggle minimap"
              aria-expanded={minimapVisible}
              data-toolbar-btn
            >
              <PanelRight {...ICON} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
