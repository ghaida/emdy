import React, { useMemo } from 'react';
import { Settings } from 'lucide-react';

interface StatusBarProps {
  filePath: string | null;
  content: string | null;
  onOpenSettings: () => void;
}

export function StatusBar({ filePath, content, onOpenSettings }: StatusBarProps) {
  const wordCount = useMemo(() => {
    if (!content) return 0;
    return content.split(/\s+/).filter(Boolean).length;
  }, [content]);

  return (
    <div className="status-bar">
      <div className="status-left">
        <button className="status-btn" onClick={onOpenSettings} title="Settings">
          <Settings size={12} strokeWidth={1.5} />
        </button>
        {filePath && <span className="status-path" title={filePath}>{filePath}</span>}
      </div>
      {content && <span className="status-words">{wordCount.toLocaleString()} words</span>}
    </div>
  );
}
