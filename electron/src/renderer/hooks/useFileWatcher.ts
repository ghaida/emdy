import { useEffect, useRef } from 'react';

interface FileWatcherCallbacks {
  onChanged: (filePath: string) => void;
  onDeleted: (filePath: string) => void;
}

export function useFileWatcher(filePath: string | null, callbacks: FileWatcherCallbacks) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!filePath) return;

    window.electronAPI.watchFile(filePath);

    const removeChanged = window.electronAPI.onFileChanged((path) => {
      callbacksRef.current.onChanged(path);
    });

    const removeDeleted = window.electronAPI.onFileDeleted((path) => {
      callbacksRef.current.onDeleted(path);
    });

    return () => {
      window.electronAPI.unwatchFile();
      removeChanged();
      removeDeleted();
    };
  }, [filePath]);
}
