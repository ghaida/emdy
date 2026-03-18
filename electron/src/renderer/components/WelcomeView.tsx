import React from 'react';

interface WelcomeViewProps {
  onOpenDir: () => void;
}

export function WelcomeView({ onOpenDir }: WelcomeViewProps) {
  return (
    <div className="welcome">
      <div className="welcome-brand">
        <h1>Emdy</h1>
        <p>A minimal Markdown reader</p>
      </div>
      <div className="welcome-actions">
        <button onClick={onOpenDir}>Open Folder</button>
      </div>
      <div className="welcome-hints">
        <div className="welcome-hint">
          <kbd>Cmd+Shift+O</kbd>
          <span>Open folder</span>
        </div>
        <div className="welcome-hint">
          <kbd>Cmd+O</kbd>
          <span>Open file</span>
        </div>
        <div className="welcome-hint">
          <kbd>Cmd+F</kbd>
          <span>Search</span>
        </div>
        <div className="welcome-hint">
          <kbd>Cmd +/-</kbd>
          <span>Zoom in/out</span>
        </div>
      </div>
    </div>
  );
}
