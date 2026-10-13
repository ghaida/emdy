// Pure half of the local-file: protocol, which serves images next to an open
// Markdown file. Kept free of Electron imports so it can be unit-tested.
import path from 'node:path';
import { LOCAL_FILE_HOST } from '../shared/local-file';

const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif', '.bmp', '.ico', '.tif', '.tiff',
]);

/**
 * The file a local-file: URL asks for, or null when the URL isn't one Emdy
 * builds: wrong scheme or host, bad encoding, or not an image. The caller
 * still has to check the path against the allowed roots.
 */
export function localFilePathFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'local-file:' || parsed.host !== LOCAL_FILE_HOST) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(parsed.pathname);
  } catch {
    return null;
  }
  if (!decoded.startsWith('/')) return null;
  const resolved = path.resolve(decoded);
  if (!IMAGE_EXTENSIONS.has(path.extname(resolved).toLowerCase())) return null;
  return resolved;
}
