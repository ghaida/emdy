import React, { createContext, useContext, useRef, useCallback } from 'react';

interface AnnounceContextValue {
  announce: (message: string) => void;
  announceAssertive: (message: string) => void;
}

const AnnounceContext = createContext<AnnounceContextValue>({
  announce: () => {},
  announceAssertive: () => {},
});

export function useAnnounce() {
  return useContext(AnnounceContext);
}

const srOnlyStyle: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

export function AnnounceProvider({ children }: { children: React.ReactNode }) {
  const politeRef = useRef<HTMLDivElement>(null);
  const assertiveRef = useRef<HTMLDivElement>(null);

  const setMessage = useCallback((ref: React.RefObject<HTMLDivElement | null>, message: string) => {
    if (!ref.current) return;
    ref.current.textContent = '';
    requestAnimationFrame(() => {
      if (ref.current) ref.current.textContent = message;
    });
  }, []);

  const announce = useCallback((message: string) => {
    setMessage(politeRef, message);
  }, [setMessage]);

  const announceAssertive = useCallback((message: string) => {
    setMessage(assertiveRef, message);
  }, [setMessage]);

  return (
    <AnnounceContext.Provider value={{ announce, announceAssertive }}>
      {children}
      <div ref={politeRef} aria-live="polite" aria-atomic="true" style={srOnlyStyle} />
      <div ref={assertiveRef} aria-live="assertive" aria-atomic="true" style={srOnlyStyle} />
    </AnnounceContext.Provider>
  );
}
