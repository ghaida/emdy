import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme } from './lib/theme-provider';
import './styles/global.css';

// Apply default theme before first render so CSS variables exist
applyTheme('warm', 'light');

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
