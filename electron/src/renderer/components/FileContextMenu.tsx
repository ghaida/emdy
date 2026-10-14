import React, { useEffect, useRef } from 'react';
import { Clipboard, FileDown, FolderOpen, ExternalLink } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface FileContextMenuProps {
  x: number;
  y: number;
  filePath: string;
  isOpenFile: boolean;
  onClose: () => void;
  onCopyHTML: () => void;
  onExportPDF: () => void;
}

export function FileContextMenu({ x, y, filePath, isOpenFile, onClose, onCopyHTML, onExportPDF }: FileContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true);

  useEffect(() => {
    const firstItem = ref.current?.querySelector<HTMLElement>('button');
    firstItem?.focus();
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div className="context-menu" ref={ref} style={{ top: y, left: x }} role="menu">
      {/* Copy and PDF act on the open document, so they're offered only for it. */}
      {isOpenFile && (
        <>
          <button className="context-menu-item" role="menuitem" onClick={() => { onCopyHTML(); onClose(); }}>
            <Clipboard size={14} strokeWidth={1.5} />
            Copy to Clipboard
          </button>
          <button className="context-menu-item" role="menuitem" onClick={() => { onExportPDF(); onClose(); }}>
            <FileDown size={14} strokeWidth={1.5} />
            Download as PDF
          </button>
          <div className="context-menu-separator" />
        </>
      )}
      <button className="context-menu-item" role="menuitem" onClick={() => { window.electronAPI.showItemInFolder(filePath); onClose(); }}>
        <FolderOpen size={14} strokeWidth={1.5} />
        Show in Finder
      </button>
      <button className="context-menu-item" role="menuitem" onClick={() => { window.electronAPI.openInNewWindow(filePath); onClose(); }}>
        <ExternalLink size={14} strokeWidth={1.5} />
        Open in New Window
      </button>
    </div>
  );
}
