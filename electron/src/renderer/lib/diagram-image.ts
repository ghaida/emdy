// Turns rendered diagram SVG into standalone images: an SVG data URL (for the
// print document) or PNG bytes (clipboard, Copy RTF). Chromium draws both as
// images, so they're isolated from the page's CSS, and they can only use fonts
// that are installed on the system or embedded in the SVG itself.

import plexRegularUrl from '../fonts/IBMPlexSans-Regular.ttf?url';
import plexBoldUrl from '../fonts/IBMPlexSans-Bold.ttf?url';
import plexItalicUrl from '../fonts/IBMPlexSans-Italic.ttf?url';

const ROOT_TAG = /<svg\b[^>]*>/i;

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Parse Mermaid's SVG markup. Mermaid serializes it as HTML (`<br>`, `&nbsp;`
 * in labels), which isn't valid XML, so it goes through the HTML parser.
 */
export function parseSvg(svg: string): SVGSVGElement | null {
  return new DOMParser().parseFromString(svg, 'text/html').querySelector('svg');
}

/**
 * Rewrite rendered SVG as a standalone image: well-formed XML (an SVG image is
 * parsed as XML, so a single `<br>` would break it) with a fixed pixel size,
 * since Mermaid's width="100%" and inline max-width have no container to
 * resolve against.
 */
export function standaloneSvg(svg: string, width: number, height: number): string {
  const root = parseSvg(svg);
  if (!root) return svg;
  // The HTML parser keeps the xmlns Mermaid writes on label <div>s as a plain
  // attribute, and a serializer can then declare the namespace twice. The
  // elements already carry their namespace, so the attribute can go.
  root.querySelectorAll('[xmlns]').forEach((el) => el.removeAttribute('xmlns'));
  root.setAttribute('width', String(round(width)));
  root.setAttribute('height', String(round(height)));
  root.style.removeProperty('max-width');
  return new XMLSerializer().serializeToString(root);
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

const PLEX_FACES = [
  { url: plexRegularUrl, weight: 400, style: 'normal' },
  { url: plexBoldUrl, weight: 700, style: 'normal' },
  { url: plexItalicUrl, weight: 400, style: 'italic' },
];

let fontCss: Promise<string> | null = null;

function bundledFontCss(): Promise<string> {
  if (!fontCss) {
    fontCss = Promise.all(
      PLEX_FACES.map(async ({ url, weight, style }) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Couldn't load ${url} (${res.status})`);
        const data = toBase64(new Uint8Array(await res.arrayBuffer()));
        return `@font-face{font-family:"IBM Plex Sans";font-weight:${weight};font-style:${style};src:url(data:font/ttf;base64,${data}) format("truetype");}`;
      })
    ).then((rules) => rules.join(''));
    fontCss.catch(() => {
      fontCss = null;
    });
  }
  return fontCss;
}

/** Embed the bundled IBM Plex Sans faces, so an image of an on-screen diagram
 * renders with the same font the app measured its labels in. */
export async function embedBundledFonts(svg: string): Promise<string> {
  const css = await bundledFontCss();
  return svg.replace(ROOT_TAG, (tag) => `${tag}<style>${css}</style>`);
}

export interface PngOptions {
  /** Device pixels per CSS pixel. */
  scale?: number;
  /** Margin around the diagram, in CSS pixels. */
  padding?: number;
  /** Opaque fill behind the diagram; transparent when omitted. */
  background?: string;
}

/** Chromium refuses canvases past ~32k px a side; stay well inside that. */
const MAX_CANVAS_SIDE = 16384;

export interface PngImage {
  bytes: Uint8Array;
  /** Device pixels per CSS pixel actually used: the requested scale, or less
   * when a huge diagram had to be clamped to fit the canvas limit. */
  scale: number;
}

export async function svgToPng(
  svg: string,
  width: number,
  height: number,
  { scale = 2, padding = 0, background }: PngOptions = {}
): Promise<PngImage> {
  if (!(width > 0 && height > 0)) throw new Error('Diagram has no measurable size');
  scale = Math.min(scale, MAX_CANVAS_SIDE / (Math.max(width, height) + padding * 2));

  const img = new Image();
  img.src = svgDataUrl(standaloneSvg(svg, width, height));
  await img.decode();

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((width + padding * 2) * scale);
  canvas.height = Math.ceil((height + padding * 2) * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, padding * scale, padding * scale, width * scale, height * scale);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG encoding failed');
  return { bytes: new Uint8Array(await blob.arrayBuffer()), scale };
}
