import { ipcMain, app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

interface Settings {
  fontFamily: string;
  theme: string;
  colorTheme: string;
  zoom: number;
  contentWidth: string;
}

const defaults: Settings = {
  fontFamily: 'sans',
  theme: 'system',
  colorTheme: 'warm',
  zoom: 1.0,
  contentWidth: 'medium',
};

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function load(): Settings {
  try {
    const data = fs.readFileSync(settingsPath, 'utf-8');
    return { ...defaults, ...JSON.parse(data) };
  } catch {
    return { ...defaults };
  }
}

function save(settings: Settings) {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), { mode: 0o600 });
}

const current = load();

export function getSettings(): Settings {
  return { ...current };
}

const VALID_FONT_FAMILIES = new Set(['sans', 'serif', 'mono']);
const VALID_THEMES = new Set(['light', 'dark', 'system']);
const VALID_COLOR_THEMES = new Set(['warm', 'cool', 'neutral', 'fresh', 'neon']);

function validateSetting(key: string, value: unknown): boolean {
  switch (key) {
    case 'fontFamily': return typeof value === 'string' && VALID_FONT_FAMILIES.has(value);
    case 'theme': return typeof value === 'string' && VALID_THEMES.has(value);
    case 'colorTheme': return typeof value === 'string' && VALID_COLOR_THEMES.has(value);
    case 'zoom': return typeof value === 'number' && value >= 0.5 && value <= 3.0;
    default: return false;
  }
}

export function registerSettingsHandlers() {
  ipcMain.handle('settings:get', () => {
    return { ...current };
  });

  ipcMain.handle('settings:set', (_event, key: string, value: unknown) => {
    if (typeof key !== 'string' || !validateSetting(key, value)) return;
    (current as unknown as Record<string, unknown>)[key] = value;
    save(current);
  });
}

// --- Nudge state ---

interface NudgeState {
  filesOpened: number;
  appLaunches: number;
  firstLaunchDate: string | null;
  dismissedUntil: string | null;
  dismissCount: number;
  contributed: boolean;
}

const nudgeDefaults: NudgeState = {
  filesOpened: 0,
  appLaunches: 0,
  firstLaunchDate: null,
  dismissedUntil: null,
  dismissCount: 0,
  contributed: false,
};

const nudgePath = path.join(app.getPath('userData'), 'nudge.json');

function loadNudge(): NudgeState {
  try {
    const data = fs.readFileSync(nudgePath, 'utf-8');
    return { ...nudgeDefaults, ...JSON.parse(data) };
  } catch {
    return { ...nudgeDefaults };
  }
}

function saveNudge(state: NudgeState) {
  fs.writeFileSync(nudgePath, JSON.stringify(state, null, 2), { mode: 0o600 });
}

const nudge = loadNudge();

function validateNudgeSetting(key: string, value: unknown): boolean {
  switch (key) {
    case 'dismissedUntil': return value === null || (typeof value === 'string' && !isNaN(Date.parse(value)));
    case 'dismissCount': return typeof value === 'number' && Number.isInteger(value) && value >= 0;
    case 'contributed': return typeof value === 'boolean';
    default: return false;
  }
}

export function registerNudgeHandlers() {
  ipcMain.handle('nudge:get', () => {
    return { ...nudge };
  });

  ipcMain.handle('nudge:set', (_event, key: string, value: unknown) => {
    if (typeof key !== 'string' || !validateNudgeSetting(key, value)) return;
    (nudge as unknown as Record<string, unknown>)[key] = value;
    saveNudge(nudge);
  });
}

export function nudgeTrackAppLaunch() {
  if (!nudge.firstLaunchDate) {
    nudge.firstLaunchDate = new Date().toISOString();
  }
  nudge.appLaunches++;
  saveNudge(nudge);
}

export function nudgeTrackFileOpen() {
  nudge.filesOpened++;
  saveNudge(nudge);
}
