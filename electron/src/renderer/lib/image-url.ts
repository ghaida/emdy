// Turns an image path from a Markdown file into the local-file: URL the main
// process serves. The host is a fixed word: local-file is a "standard" scheme,
// so Chromium would otherwise read the first path segment as the host.

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export const LOCAL_FILE_HOST = 'local';

/**
 * The absolute path `src` points at, relative to the file's folder, or null
 * when src is a URL with a scheme (https, data, …) and should be left alone.
 * The Markdown pipeline has already percent-encoded src, so it's decoded once.
 */
export function resolveImagePath(src: string, filePath: string): string | null {
  if (!src || HAS_SCHEME.test(src)) return null;
  let decoded = src;
  try {
    decoded = decodeURIComponent(src);
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
