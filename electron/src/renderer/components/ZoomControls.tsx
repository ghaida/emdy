import React from 'react';
import { iconSize } from '../lib/design-tokens';

const sz = iconSize.md;
const sw = '1.2';

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

export function ZoomControls({ zoom, onZoomIn, onZoomOut, onZoomReset }: ZoomControlsProps) {
  const pct = Math.round(zoom * 100);
  return (
    <div className="zoom-controls">
      <button className="toolbar-btn" onClick={onZoomOut} title="Zoom out (Cmd -)">
        <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw}>
          <path d="M4 8h8" />
        </svg>
      </button>
      <button className="toolbar-btn zoom-label" onClick={onZoomReset} title="Reset zoom">
        {pct}%
      </button>
      <button className="toolbar-btn" onClick={onZoomIn} title="Zoom in (Cmd +)">
        <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw}>
          <path d="M4 8h8M8 4v8" />
        </svg>
      </button>
    </div>
  );
}
