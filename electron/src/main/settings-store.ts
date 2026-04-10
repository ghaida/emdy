import { ipcMain, app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

interface Settings {
  fontFamily: string;
  theme: string;
  colorTheme: string;
  zoom: number;
}

const defaults: Settings = {
  fontFamily: 'sans',
  theme: 'system',
  colorTheme: 'warm',
  zoom: 1.0,
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
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

const current = load();

export function registerSettingsHandlers() {
  ipcMain.handle('settings:get', () => {
    return { ...current };
  });

  ipcMain.handle('settings:set', (_event, key: string, value: unknown) => {
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
  fs.writeFileSync(nudgePath, JSON.stringify(state, null, 2));
}

const nudge = loadNudge();

export function registerNudgeHandlers() {
  ipcMain.handle('nudge:get', () => {
    return { ...nudge };
  });

  ipcMain.handle('nudge:set', (_event, key: string, value: unknown) => {
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
