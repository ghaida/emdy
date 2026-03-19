import React from 'react';

interface WelcomeViewProps {
  onOpen: () => void;
}

export function WelcomeView({ onOpen }: WelcomeViewProps) {
  return (
    <div className="welcome">
      <div className="welcome-brand">
        <h1>EMDY-1</h1>
        <p>A minimal Markdown reader</p>
      </div>
      <div className="welcome-actions">
        <button onClick={onOpen}>Open</button>
      </div>
      <div className="welcome-hints">
        <div className="welcome-hint">
          <kbd>Cmd+O</kbd>
          <span>Open file or folder</span>
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
