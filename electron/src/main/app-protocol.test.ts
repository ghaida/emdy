// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { APP_CSP, appFilePath, contentTypeFor, serveAppFile } from './app-protocol';

// Where the packaged renderer lives: inside app.asar, next to the main bundle.
const DIR = '/Applications/Emdy.app/Contents/Resources/app.asar/.vite/renderer/main_window';

describe('appFilePath', () => {
  it('maps a path under app://local/ to the same path in the renderer folder', () => {
    expect(appFilePath('app://local/index.html', DIR)).toBe(`${DIR}/index.html`);
    expect(appFilePath('app://local/assets/index-BH7AaF3T.js', DIR)).toBe(`${DIR}/assets/index-BH7AaF3T.js`);
  });

  it('gives the page for the root', () => {
    expect(appFilePath('app://local/', DIR)).toBe(`${DIR}/index.html`);
    expect(appFilePath('app://local', DIR)).toBe(`${DIR}/index.html`);
  });

  it('ignores the query and decodes the path once', () => {
    expect(appFilePath('app://local/assets/a%20b.png?v=2', DIR)).toBe(`${DIR}/assets/a b.png`);
    expect(appFilePath('app://local/a%2520b.png', DIR)).toBe(`${DIR}/a%20b.png`);
  });

  it('allows dot segments that stay inside the folder', () => {
    expect(appFilePath('app://local/assets/../index.html', DIR)).toBe(`${DIR}/index.html`);
    expect(appFilePath('app://local/assets/..%2Findex.html', DIR)).toBe(`${DIR}/index.html`);
  });

  it('refuses a path that leaves the folder', () => {
    // The URL parser drops a plain .. at the root by itself; one with an
    // encoded slash only appears once decoded, so the joined path is checked.
    expect(appFilePath('app://local/..%2F..%2Fbuild%2Findex.js', DIR)).toBeNull();
    expect(appFilePath('app://local/%2e%2e%2F..%2F..%2F..%2FInfo.plist', DIR)).toBeNull();
    expect(appFilePath('app://local/..%2F', DIR)).toBeNull();
    // A sibling whose name starts with the folder's.
    expect(appFilePath('app://local/..%2Fmain_window-other%2Fx.js', DIR)).toBeNull();
  });

  it('refuses other hosts and schemes, and anything that is not a URL', () => {
    expect(appFilePath('app://other/index.html', DIR)).toBeNull();
    expect(appFilePath('local-file://local/index.html', DIR)).toBeNull();
    expect(appFilePath('file:///index.html', DIR)).toBeNull();
    expect(appFilePath('not a url', DIR)).toBeNull();
  });

  it('refuses malformed percent-encoding and NUL bytes', () => {
    expect(appFilePath('app://local/%E0%A4%A.js', DIR)).toBeNull();
    expect(appFilePath('app://local/index.html%00.png', DIR)).toBeNull();
  });
});

describe('contentTypeFor', () => {
  it.each([
    ['index.html', 'text/html'],
    ['assets/index-BH7AaF3T.js', 'text/javascript'],
    ['assets/index-Xsnt6yQZ.css', 'text/css'],
    ['assets/IBMPlexSans-Regular-Bl2SjS7V.ttf', 'font/ttf'],
    ['assets/IBMPlexSans-Regular.woff2', 'font/woff2'],
    ['assets/logo.svg', 'image/svg+xml'],
    ['emdy-icon.png', 'image/png'],
    ['EMDY-ICON.PNG', 'image/png'],
  ])('%s is %s', (file, type) => {
    expect(contentTypeFor(path.join(DIR, file))).toBe(type);
  });

  it('falls back to plain bytes for anything else', () => {
    expect(contentTypeFor(path.join(DIR, 'LICENSE'))).toBe('application/octet-stream');
  });
});

describe('serveAppFile', () => {
  // A small renderer build, with a file next to it that must stay out of reach.
  let base: string;
  let root: string;
  beforeAll(() => {
    base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'emdy-app-protocol-')));
    root = path.join(base, 'main_window');
    fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>Emdy</title>');
    fs.writeFileSync(path.join(root, 'assets', 'index.js'), 'export {};');
    fs.writeFileSync(path.join(root, 'assets', 'plex.ttf'), Buffer.from([0, 1, 0, 0]));
    fs.writeFileSync(path.join(base, 'secret.txt'), 'outside the renderer');
  });
  afterAll(() => {
    fs.rmSync(base, { recursive: true, force: true });
  });

  it('serves the page with its type and the CSP', async () => {
    const res = await serveAppFile('app://local/index.html', root);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html');
    expect(res.headers.get('content-security-policy')).toBe(APP_CSP);
    expect(await res.text()).toBe('<!doctype html><title>Emdy</title>');
  });

  it('serves scripts and fonts with their types', async () => {
    const script = await serveAppFile('app://local/assets/index.js', root);
    expect(script.status).toBe(200);
    expect(script.headers.get('content-type')).toBe('text/javascript');
    expect(script.headers.get('content-security-policy')).toBeNull();
    expect(await script.text()).toBe('export {};');

    const font = await serveAppFile('app://local/assets/plex.ttf', root);
    expect(font.headers.get('content-type')).toBe('font/ttf');
    expect([...new Uint8Array(await font.arrayBuffer())]).toEqual([0, 1, 0, 0]);
  });

  it('answers 404 for a missing file or a folder', async () => {
    expect((await serveAppFile('app://local/assets/missing.js', root)).status).toBe(404);
    expect((await serveAppFile('app://local/assets', root)).status).toBe(404);
  });

  it('answers 404 for a path outside the renderer folder, even when the file exists', async () => {
    expect((await serveAppFile('app://local/..%2Fsecret.txt', root)).status).toBe(404);
    expect((await serveAppFile('app://other/index.html', root)).status).toBe(404);
  });
});

describe('APP_CSP', () => {
  it('is the policy the renderer had on file://, unchanged by the move to app://', () => {
    expect(APP_CSP).toBe(
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' local-file: data: https:; font-src 'self'; connect-src 'self' https://emdyapp.com; object-src 'none'; base-uri 'self'; form-action 'none'"
    );
  });
});
