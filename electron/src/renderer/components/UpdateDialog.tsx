import React, { useRef, useEffect, useState } from 'react';
import { useTransition } from '../hooks/useTransition';
import { useFocusTrap } from '../hooks/useFocusTrap';

type DialogState =
  | 'checking'
  | 'up-to-date'
  | 'error'
  | { version: string; notes: string | null };

interface UpdateDialogProps {
  visible: boolean;
  onClose: () => void;
  readyVersion?: { version: string; notes: string | null } | null;
}

type NotesBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'list'; items: string[] };

function parseNotes(notes: string): NotesBlock[] {
  const blocks: NotesBlock[] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length > 0) {
      blocks.push({ kind: 'list', items: current });
      current = [];
    }
  };
  for (const raw of notes.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^[-*]\s+(.+)$/);
    if (m) {
      current.push(m[1].trim());
    } else {
      flush();
      blocks.push({ kind: 'heading', text: line });
    }
  }
  flush();
  return blocks;
}

function UpdateNotes({ notes }: { notes: string }) {
  const blocks = parseNotes(notes);
  if (blocks.length === 0) return null;
  return (
    <div className="update-notes-section">
      {blocks.map((block, i) =>
        block.kind === 'heading' ? (
          <h3 key={i} className="update-notes-heading">{block.text}</h3>
        ) : (
          <ul key={i} className="update-notes">
            {block.items.map((item, j) => <li key={j}>{item}</li>)}
          </ul>
        )
      )}
    </div>
  );
}

export function UpdateDialog({ visible, onClose, readyVersion }: UpdateDialogProps) {
  const { mounted, active } = useTransition(visible);
  const modalRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<DialogState>('checking');
  const [currentVersion, setCurrentVersion] = useState('');
  useFocusTrap(modalRef, visible);

  useEffect(() => {
    if (!visible) return;

    let removeStatus: (() => void) | undefined;
    let removeReady: (() => void) | undefined;

    window.electronAPI.getAppVersion().then(setCurrentVersion);

    if (readyVersion) {
      setState(readyVersion);
    } else {
      setState('checking');
      window.electronAPI.checkForUpdate().then((result) => {
        if (result.status === 'downloaded' && result.version) {
          setState({ version: result.version, notes: result.notes ?? null });
        } else if (result.status === 'error') {
          setState('error');
        } else if (result.status === 'checking') {
          removeStatus = window.electronAPI.onUpdateStatus((status) => {
            if (status === 'not-available') { setState('up-to-date'); removeStatus?.(); }
            else if (status === 'error') { setState('error'); removeStatus?.(); }
          });
          removeReady = window.electronAPI.onUpdateReady((info) => {
            setState({ version: info.version, notes: info.notes });
            removeReady?.();
          });
        }
      });
    }

    return () => { removeStatus?.(); removeReady?.(); };
  }, [visible, readyVersion]);

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
          <p className="update-message">Emdy {currentVersion} is the latest version.</p>
        )}
        {state === 'error' && (
          <p className="update-message">Could not check for updates. Check your internet connection.</p>
        )}
        {typeof state === 'object' && (
          <>
            <p className="update-message">Emdy {state.version} is ready to install. You have {currentVersion}.</p>
            {state.notes && <UpdateNotes notes={state.notes} />}
            <div className="update-actions">
              <button
                className="update-download-btn"
                onClick={() => window.electronAPI.installUpdate()}
              >
                Restart to Update
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
