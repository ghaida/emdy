// Color string parsing shared by the clipboard export (copy-html) and the
// Mermaid theme mapping, so both accept the same forms.

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Parse an authored color string into r/g/b/a. It covers only the sRGB forms
 * it can do correctly: `#rgb`/`#rgba`/`#rrggbb`/`#rrggbbaa`
 * and `rgb()`/`rgba()` — including percent channels (`50%` → 127.5), percent
 * alpha (`50%` → 0.5), comma OR space separation, and the space-syntax slash
 * alpha (`rgb(10 20 30 / .5)`). Alpha is clamped to [0,1]. Returns null for
 * hsl/oklch/lab/named; callers that need those resolve them through a canvas
 * first (see copy-html's normalizeViaCanvas). */
export function parseRgba(value: string): Rgba | null {
  const s = value.trim();

  const hex = /^#([0-9a-fA-F]+)$/.exec(s);
  if (hex) {
    const h = hex[1];
    const dbl = (c: string) => parseInt(c + c, 16);
    if (h.length === 3) return { r: dbl(h[0]), g: dbl(h[1]), b: dbl(h[2]), a: 1 };
    if (h.length === 4) return { r: dbl(h[0]), g: dbl(h[1]), b: dbl(h[2]), a: dbl(h[3]) / 255 };
    if (h.length === 6)
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: 1,
      };
    if (h.length === 8)
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: parseInt(h.slice(6, 8), 16) / 255,
      };
    return null;
  }

  const fn = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (fn) {
    let body = fn[1].trim();

    // Space-syntax alpha: "r g b / a". Split the alpha off first.
    let alphaStr: string | undefined;
    const slash = body.split('/');
    if (slash.length === 2) {
      alphaStr = slash[1].trim();
      body = slash[0].trim();
    } else if (slash.length > 2) {
      return null;
    }

    // Channels: comma- OR whitespace-separated.
    const parts = body.split(/[\s,]+/).filter(Boolean);
    if (parts.length < 3) return null;
    if (alphaStr === undefined && parts.length >= 4) alphaStr = parts[3];

    // A channel is either 0-255 or a percentage of 255.
    const channel = (p: string): number =>
      p.endsWith('%') ? (parseFloat(p) / 100) * 255 : parseFloat(p);

    const r = channel(parts[0]);
    const g = channel(parts[1]);
    const b = channel(parts[2]);
    let a = 1;
    if (alphaStr !== undefined) {
      a = alphaStr.endsWith('%') ? parseFloat(alphaStr) / 100 : parseFloat(alphaStr);
    }
    if ([r, g, b, a].some((n) => Number.isNaN(n))) return null;
    a = Math.max(0, Math.min(1, a)); // clamp alpha to [0,1]
    return { r, g, b, a };
  }

  return null;
}

export function toHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const h = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}
