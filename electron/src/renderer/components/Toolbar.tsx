import React, { useState, useRef, useEffect } from 'react';
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
  hasContent,
}: ToolbarProps) {
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const fontMenuRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);

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

  const pct = Math.round(zoom * 100);
  const currentFont = fonts.find((f) => f.value === fontFamily) || fonts[0];

  return (
    <div className="toolbar">
      {/* Left: sidebar toggle + filename */}
      <div className="toolbar-left">
        {hasSidebar && (
          <button
            className={`toolbar-btn${sidebarVisible ? ' active' : ''}`}
            onClick={onToggleSidebar}
            title="Toggle sidebar"
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
              <button className="toolbar-btn" onClick={onZoomOut} title="Zoom out (Cmd-)">
                <Minus {...ICON} />
              </button>
              <button className="toolbar-btn zoom-label" onClick={onZoomReset} title="Reset zoom">
                {pct}%
              </button>
              <button className="toolbar-btn" onClick={onZoomIn} title="Zoom in (Cmd+)">
                <Plus {...ICON} />
              </button>
            </div>

            {/* Search */}
            {hasSidebar && (
              <button className="toolbar-btn" onClick={onSearch} title="Search (Cmd+F)">
                <Search {...ICON} />
              </button>
            )}

            {/* Font dropdown */}
            <div className="toolbar-dropdown-wrapper" ref={fontMenuRef}>
              <button
                className={`toolbar-btn${fontMenuOpen ? ' active' : ''}`}
                onClick={() => setFontMenuOpen((v) => !v)}
                title="Font"
              >
                <Type {...ICON} />
              </button>
              {fontMenuOpen && (
                <div className="toolbar-dropdown">
                  {fonts.map((f) => (
                    <button
                      key={f.value}
                      className={`toolbar-dropdown-item${fontFamily === f.value ? ' active' : ''}`}
                      style={{ fontFamily: f.family }}
                      onClick={() => { onFontChange(f.value); setFontMenuOpen(false); }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Copy */}
            <button className="toolbar-btn" onClick={onCopyHTML} title="Copy as formatted text">
              <Copy {...ICON} />
            </button>

            {/* Export PDF */}
            <button className="toolbar-btn" onClick={onExportPDF} title="Export PDF">
              <FileDown {...ICON} />
            </button>


            {/* Minimap — rightmost */}
            <button
              className={`toolbar-btn${minimapVisible ? ' active' : ''}`}
              onClick={onToggleMinimap}
              title="Toggle minimap"
            >
              <PanelRight {...ICON} />
            </button>
          </>
        )}

        {/* Search when no content but sidebar open */}
        {!hasContent && hasSidebar && (
          <button className="toolbar-btn" onClick={onSearch} title="Search (Cmd+F)">
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
                title="More actions"
              >
                <MoreHorizontal {...ICON} />
              </button>
              {overflowOpen && (
                <div className="toolbar-dropdown toolbar-overflow-dropdown">
                  <div className="toolbar-overflow-group">
                    <span className="toolbar-overflow-label">Font</span>
                    {fonts.map((f) => (
                      <button
                        key={f.value}
                        className={`toolbar-dropdown-item${fontFamily === f.value ? ' active' : ''}`}
                        style={{ fontFamily: f.family }}
                        onClick={() => { onFontChange(f.value); setOverflowOpen(false); }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="toolbar-overflow-divider" />
                  <button className="toolbar-dropdown-item" onClick={() => { onExportPDF(); setOverflowOpen(false); }}>
                    <FileDown size={14} strokeWidth={1.5} /> Export PDF
                  </button>
                  <button className="toolbar-dropdown-item" onClick={() => { onCopyHTML(); setOverflowOpen(false); }}>
                    <Copy size={14} strokeWidth={1.5} /> Copy as formatted text
                  </button>
                </div>
              )}
            </div>


            {/* Minimap — rightmost even in collapsed */}
            <button
              className={`toolbar-btn${minimapVisible ? ' active' : ''}`}
              onClick={onToggleMinimap}
              title="Toggle minimap"
            >
              <PanelRight {...ICON} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
