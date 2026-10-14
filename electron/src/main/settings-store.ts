import { ipcMain, app, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { writeJsonAtomic } from './atomic-write';
import { sanitizeSettings, validateSetting, type Settings } from './settings-schema';

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function load(): Settings {
  try {
    return sanitizeSettings(JSON.parse(fs.readFileSync(settingsPath, 'utf-8')));
  } catch {
    return sanitizeSettings(null);
  }
}

function save(settings: Settings) {
  writeJsonAtomic(settingsPath, settings);
}

const current = load();

export function getSettings(): Settings {
  return { ...current };
}

export function registerSettingsHandlers() {
  ipcMain.handle('settings:get', () => {
    return { ...current };
  });

  ipcMain.on('settings:get-sync', (event) => {
    event.returnValue = { ...current };
  });

  ipcMain.handle('settings:set', (event, key: string, value: unknown) => {
    if (typeof key !== 'string' || !validateSetting(key, value)) return;
    (current as unknown as Record<string, unknown>)[key] = value;
    save(current);
    // Other windows follow; the sender already applied it.
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed() && win.webContents.id !== event.sender.id) {
        win.webContents.send('settings:changed', key, value);
      }
    }
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
  writeJsonAtomic(nudgePath, state);
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
