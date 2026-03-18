import React from 'react';

interface EmptyStateProps {
  type: 'no-files' | 'file-deleted' | 'error';
  message?: string;
  onAction?: () => void;
  actionLabel?: string;
}

export function EmptyState({ type, message, onAction, actionLabel }: EmptyStateProps) {
  const defaultMessages = {
    'no-files': 'No Markdown files in this directory.',
    'file-deleted': 'This file has been deleted.',
    'error': 'Could not read the file.',
  };

  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        {type === 'no-files' && (
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 26V6a2 2 0 012-2h8l4 4h8a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2z" />
            <path d="M12 16h8M16 12v8" opacity="0.3" />
          </svg>
        )}
        {type === 'file-deleted' && (
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 4h10l6 6v16a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z" />
            <path d="M12 16l8 8M20 16l-8 8" opacity="0.5" />
          </svg>
        )}
        {type === 'error' && (
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="16" cy="16" r="12" />
            <path d="M16 10v8M16 22v1" />
          </svg>
        )}
      </div>
      <p className="empty-state-message">{message || defaultMessages[type]}</p>
      {onAction && (
        <button className="empty-state-action" onClick={onAction}>
          {actionLabel || 'Try Again'}
        </button>
      )}
    </div>
  );
}
