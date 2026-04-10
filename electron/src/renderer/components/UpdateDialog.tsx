import React, { useRef, useEffect, useState } from 'react';
import { useTransition } from '../hooks/useTransition';
import { useFocusTrap } from '../hooks/useFocusTrap';

type UpdateState = 'checking' | 'up-to-date' | 'error' | { version: string; url: string; notes?: string[] };

interface UpdateDialogProps {
  visible: boolean;
  onClose: () => void;
  initialResult?: { version: string; url: string; notes?: string[] } | null;
}

export function UpdateDialog({ visible, onClose, initialResult }: UpdateDialogProps) {
  const { mounted, active } = useTransition(visible);
  const modalRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<UpdateState>('checking');
  const [currentVersion, setCurrentVersion] = useState('');
  useFocusTrap(modalRef, visible);

  useEffect(() => {
    if (visible) {
      window.electronAPI.getAppVersion().then(setCurrentVersion);
      if (initialResult) {
        setState(initialResult);
      } else {
        setState('checking');
        window.electronAPI.checkForUpdate().then(({ ok, update }) => {
          if (!ok) setState('error');
          else setState(update ?? 'up-to-date');
        });
      }
    }
  }, [visible, initialResult]);

  if (!mounted) return null;

  return (
    <div className={`settings-overlay${active ? ' active' : ''}`} onClick={onClose}>
      <div
        ref={modalRef}
        className={`update-modal${active ? ' active' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-modal-title"
      >
        <button className="settings-close about-close" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
        </button>
        <h2 id="update-modal-title" className="update-title">Software Update</h2>
        {state === 'checking' && (
          <p className="update-message">Checking for updates…</p>
        )}
        {state === 'up-to-date' && (
          <>
            <p className="update-message">Emdy {currentVersion} is the latest version.</p>
          </>
        )}
        {state === 'error' && (
          <p className="update-message">Could not check for updates. Check your internet connection.</p>
        )}
        {typeof state === 'object' && (
          <>
            <p className="update-message">Emdy {state.version} is available. You have {currentVersion}.</p>
            {state.notes && state.notes.length > 0 && (
              <div className="update-notes-section">
                <h3 className="update-notes-heading">Changes in this update</h3>
                <ul className="update-notes">
                  {state.notes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="update-actions">
              <button
                className="update-download-btn"
                onClick={() => window.electronAPI.openExternal(state.url)}
              >
                Download
              </button>
              <button
                className="update-skip-btn"
                onClick={() => {
                  window.electronAPI.skipUpdate(state.version);
                  onClose();
                }}
              >
                Skip this version
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
