import React, { useRef, useEffect, useState } from 'react';
import { useTransition } from '../hooks/useTransition';
import { useFocusTrap } from '../hooks/useFocusTrap';

const SUPPORT_URL = 'https://buy.stripe.com/eVq14o0r23dZ7H12breZ200';
const WEBSITE_URL = 'https://emdyapp.com';
const PRIVACY_URL = 'https://emdyapp.com/privacy.html';
const LICENSE_URL = 'https://github.com/ghaida/emdy/blob/main/LICENSE';

interface AboutDialogProps {
  visible: boolean;
  onClose: () => void;
}

export function AboutDialog({ visible, onClose }: AboutDialogProps) {
  const { mounted, active } = useTransition(visible);
  const modalRef = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState('');
  const [update, setUpdate] = useState<{ version: string; url: string } | null | 'checking'>('checking');
  useFocusTrap(modalRef, visible);

  useEffect(() => {
    if (visible) {
      window.electronAPI.getAppVersion().then(setVersion);
      setUpdate('checking');
      window.electronAPI.checkForUpdate().then(({ ok, update }) => setUpdate(ok ? update : null));
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
        <button className="settings-close about-close" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
        </button>
        <img src="emdy-icon.png" alt="Emdy" className="about-icon-img" width="80" height="80" />
        <h2 id="about-modal-title" className="about-name">Emdy</h2>
        <p className="about-version">
          Version {version}
          {update === 'checking' ? '' : update ? (
            <> · <button className="about-update-link" onClick={() => window.electronAPI.openExternal(update.url)}>{update.version} available</button></>
          ) : (
            <span className="about-up-to-date"> · Up to date</span>
          )}
        </p>
        <p className="about-tagline">A Markdown reader for macOS</p>
        <button
          className="settings-support-btn"
          onClick={() => window.electronAPI.openExternal(SUPPORT_URL)}
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
        <div className="about-links-row">
          <button
            className="about-link"
            onClick={() => window.electronAPI.openExternal(PRIVACY_URL)}
          >
            Privacy
          </button>
          <span className="about-link-sep">·</span>
          <button
            className="about-link"
            onClick={() => window.electronAPI.openExternal(LICENSE_URL)}
          >
            License (GPLv3)
          </button>
        </div>
      </div>
    </div>
  );
}
