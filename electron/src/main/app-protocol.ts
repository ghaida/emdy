// The app: protocol, which serves the packaged renderer from app://local/
// instead of file://, so the renderer never needs the extra privileges
// Electron gives file:// pages. Kept free of Electron imports so it can be
// unit-tested; index.ts registers the scheme and hands requests to serveAppFile.
import fs from 'node:fs/promises';
import path from 'node:path';

const APP_HOST = 'local';

/** The renderer's Content Security Policy: sent with the page, and on every response in the session. */
export const APP_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' local-file: data: https:; font-src 'self'; connect-src 'self' https://emdyapp.com; object-src 'none'; base-uri 'self'; form-action 'none'";

// Module scripts load only with a JavaScript type, so every type is set here
// rather than left to sniffing.
const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/**
 * The file an app: URL asks for in the renderer folder, or null when the URL
 * isn't one Emdy serves: another scheme or host, bad encoding, or a path that
 * leaves the folder. The root is the page.
 */
export function appFilePath(url: string, rendererDir: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'app:' || parsed.host !== APP_HOST) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(parsed.pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const root = path.resolve(rendererDir);
  const file = path.join(root, decoded === '' || decoded === '/' ? 'index.html' : decoded);
  return file.startsWith(root + path.sep) ? file : null;
}

export function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/** The answer to an app: request: the file with its type (the page with the CSP too), else 404. */
export async function serveAppFile(url: string, rendererDir: string): Promise<Response> {
  const file = appFilePath(url, rendererDir);
  if (!file) return notFound();
  // Null when the file is missing, or is a folder.
  const body = await fs.readFile(file).catch(() => null);
  if (!body) return notFound();
  const type = contentTypeFor(file);
  const headers: Record<string, string> = { 'Content-Type': type };
  if (type === 'text/html') headers['Content-Security-Policy'] = APP_CSP;
  return new Response(body, { headers });
}

function notFound(): Response {
  return new Response('Not found', { status: 404 });
}
