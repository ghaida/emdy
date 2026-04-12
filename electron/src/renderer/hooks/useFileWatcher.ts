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

    const removeChanged = window.electronAPI.onFileChanged((changedPath) => {
      if (changedPath === filePath) {
        callbacksRef.current.onChanged(changedPath);
      }
    });

    const removeDeleted = window.electronAPI.onFileDeleted((deletedPath) => {
      if (deletedPath === filePath) {
        callbacksRef.current.onDeleted(deletedPath);
      }
    });

    return () => {
      window.electronAPI.unwatchFile();
      removeChanged();
      removeDeleted();
    };
  }, [filePath]);
}
