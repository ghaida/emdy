import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AnnounceProvider } from './hooks/useAnnounce';
import { applyTheme } from './lib/theme-provider';
import './styles/global.css';

// Apply default theme before first render so CSS variables exist
applyTheme('warm', 'light');

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AnnounceProvider>
      <App />
    </AnnounceProvider>
  </React.StrictMode>
);
