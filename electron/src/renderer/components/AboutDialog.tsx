import React, { useRef, useEffect, useState } from 'react';
import { useTransition } from '../hooks/useTransition';
import { useFocusTrap } from '../hooks/useFocusTrap';

const GUMROAD_URL = 'https://gumroad.com/l/emdy';
const WEBSITE_URL = 'https://emdyapp.com';

interface AboutDialogProps {
  visible: boolean;
  onClose: () => void;
}

export function AboutDialog({ visible, onClose }: AboutDialogProps) {
  const { mounted, active } = useTransition(visible);
  const modalRef = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState('');
  useFocusTrap(modalRef, visible);

  useEffect(() => {
    if (visible) {
      window.electronAPI.getAppVersion().then(setVersion);
      if (modalRef.current) {
        const firstFocusable = modalRef.current.querySelector<HTMLElement>('button, [href], input');
        firstFocusable?.focus();
      }
    }
  }, [visible]);

  if (!mounted) return null;

  return (
    <div className={`settings-overlay${active ? ' active' : ''}`} onClick={onClose}>
      <div
        ref={modalRef}
        className={`about-modal${active ? ' active' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-modal-title"
      >
        <div className="about-icon">E</div>
        <h2 id="about-modal-title" className="about-name">Emdy</h2>
        <p className="about-version">Version {version}</p>
        <p className="about-tagline">A Markdown reader for macOS</p>
        <div className="about-divider" />
        <button
          className="settings-support-btn"
          onClick={() => window.electronAPI.openExternal(GUMROAD_URL)}
        >
          Support Emdy
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </button>
        <button
          className="about-link"
          onClick={() => window.electronAPI.openExternal(WEBSITE_URL)}
        >
          emdyapp.com
        </button>
      </div>
    </div>
  );
}
