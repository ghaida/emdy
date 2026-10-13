// Turns an image path from a Markdown file into the local-file: URL the main
// process serves. The host is a fixed word: local-file is a "standard" scheme,
// so Chromium would otherwise read the first path segment as the host.

import { LOCAL_FILE_HOST } from '../../shared/local-file';

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export { LOCAL_FILE_HOST };

/**
 * The absolute path `src` points at, relative to the file's folder, or null
 * when src is a URL with a scheme (https, data, …) and should be left alone.
 * The Markdown pipeline has already percent-encoded src, so it's decoded once.
 * A literal ? or # starts a query or fragment, as on GitHub
 * (logo.png#gh-dark-mode-only), and is cut before decoding, so an encoded
 * one (%3F, %23) stays part of the file name.
 */
export function resolveImagePath(src: string, filePath: string): string | null {
  if (!src || HAS_SCHEME.test(src)) return null;
  const pathPart = src.split(/[?#]/, 1)[0];
  let decoded = pathPart;
  try {
    decoded = decodeURIComponent(pathPart);
  } catch {
    // Not valid percent-encoding; use it as written.
  }
  const dir = filePath.slice(0, filePath.lastIndexOf('/'));
  const joined = decoded.startsWith('/') ? decoded : `${dir}/${decoded}`;
  const out: string[] = [];
  for (const part of joined.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      out.pop();
      continue;
    }
    out.push(part);
  }
  return `/${out.join('/')}`;
}

/** The src to render: a local-file URL for a path, or the original URL. */
export function localImageUrl(src: string, filePath: string): string {
  const abs = resolveImagePath(src, filePath);
  if (abs === null) return src;
  return `local-file://${LOCAL_FILE_HOST}${abs.split('/').map((seg) => encodeURIComponent(seg)).join('/')}`;
}
