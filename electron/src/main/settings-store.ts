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

let current = load();

export function registerSettingsHandlers() {
  ipcMain.handle('settings:get', () => {
    return { ...current };
  });

  ipcMain.handle('settings:set', (_event, key: string, value: unknown) => {
    (current as unknown as Record<string, unknown>)[key] = value;
    save(current);
  });
}
