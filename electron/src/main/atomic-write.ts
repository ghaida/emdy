// State files are written to a temp file and renamed into place, so a crash
// mid-write can't leave a truncated file that the next launch reads as empty.
import fs from 'node:fs';

export function writeTextAtomic(filePath: string, text: string) {
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text, { mode: 0o600 });
  fs.renameSync(tmp, filePath);
}

export function writeJsonAtomic(filePath: string, data: unknown) {
  writeTextAtomic(filePath, JSON.stringify(data, null, 2));
}
