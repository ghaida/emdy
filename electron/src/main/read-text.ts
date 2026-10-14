// The one way a document is read into a window, with the size cap every open
// path shares.
import fs from 'node:fs/promises';
import { FILE_TOO_LARGE } from '../shared/read-errors';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function readTextFile(filePath: string): Promise<string> {
  // Checked before the file is opened: opening a FIFO waits for a writer.
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) throw new Error('Not a file');
  if (stat.size > MAX_FILE_BYTES) throw new Error(FILE_TOO_LARGE);
  // The file can grow after that check, so the read stops one byte past the
  // cap and refuses a file that gets there, rather than reading it whole.
  const handle = await fs.open(filePath, 'r');
  try {
    const chunks: Buffer[] = [];
    let length = 0;
    // One byte more than the stat found: a file that hasn't changed arrives
    // whole, and the next read finds its end.
    let chunkSize = stat.size + 1;
    while (length <= MAX_FILE_BYTES) {
      const chunk = Buffer.allocUnsafe(Math.min(chunkSize, MAX_FILE_BYTES + 1 - length));
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, length);
      if (bytesRead === 0) return Buffer.concat(chunks, length).toString('utf-8');
      chunks.push(chunk.subarray(0, bytesRead));
      length += bytesRead;
      chunkSize = 64 * 1024;
    }
    throw new Error(FILE_TOO_LARGE);
  } finally {
    await handle.close();
  }
}
