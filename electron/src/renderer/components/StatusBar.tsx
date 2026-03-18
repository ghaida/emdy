import React, { useMemo } from 'react';

interface StatusBarProps {
  filePath: string | null;
  rootPath: string | null;
  content: string | null;
}

export function StatusBar({ filePath, rootPath, content }: StatusBarProps) {
  const wordCount = useMemo(() => {
    if (!content) return 0;
    return content.split(/\s+/).filter(Boolean).length;
  }, [content]);

  const displayPath = useMemo(() => {
    if (!filePath) return null;
    if (rootPath) {
      return filePath.replace(rootPath, '').replace(/^\//, '');
    }
    return filePath.split('/').pop() || filePath;
  }, [filePath, rootPath]);

  return (
    <div className="status-bar">
      {displayPath && <span className="status-path" title={filePath || ''}>{displayPath}</span>}
      <div className="status-right">
        {content && <span className="status-words">{wordCount.toLocaleString()} words</span>}
      </div>
    </div>
  );
}
