/** Font file bytes for PDF embedding: bundled fonts are fetched, user fonts come from storage. */
import { byName, normalizeFamilyValue, DEFAULT_FONT } from './fonts';
import { customFontBytes } from './customFonts';

const cache = new Map<string, Promise<Uint8Array | null>>();
const base = () => import.meta.env.BASE_URL;

/** System (non-bundled) Latin fonts are substituted in PDFs. */
const LATIN_SUBSTITUTE: Record<string, string> = {
  arial: 'noto-sans-latin',
  calibri: 'noto-sans-latin',
  'segoe ui': 'noto-sans-latin',
  tahoma: 'noto-sans-latin',
  verdana: 'noto-sans-latin',
  'times new roman': 'noto-serif-latin',
  georgia: 'noto-serif-latin',
  cambria: 'noto-serif-latin',
  'courier new': 'noto-sans-mono-latin',
};

async function get(url: string): Promise<Uint8Array | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch {
    return null;
  }
}

/** Closest bundled face to the wanted weight / style. */
function pickFace(faces: Array<{ file: string; weight: number | string; style: string }>, bold: boolean, italic: boolean) {
  const want = bold ? 700 : 400;
  const score = (f: { weight: number | string; style: string }) => {
    const [lo, hi] = String(f.weight).split(' ').map(Number);
    const w = hi ? (want >= lo && want <= hi ? 0 : Math.min(Math.abs(want - lo), Math.abs(want - hi))) : Math.abs(want - lo);
    return w + (f.style === (italic ? 'italic' : 'normal') ? 0 : 1000);
  };
  return [...faces].sort((a, b) => score(a) - score(b))[0];
}

/** Bytes of the font for one family / weight / style. `latinOnly` asks for the Latin companion (for English words). */
export function fontBytes(family: string, bold: boolean, italic: boolean, latin = false): Promise<Uint8Array | null> {
  const name = normalizeFamilyValue(family) || DEFAULT_FONT;
  const k = `${name}|${bold}|${italic}|${latin}`;
  if (cache.has(k)) return cache.get(k)!;
  const p = (async () => {
    const lower = name.toLowerCase();
    const sub = LATIN_SUBSTITUTE[lower];
    if (sub) return get(`${base()}fonts/web/${sub}-${bold ? 700 : 400}-${italic && sub !== 'noto-sans-mono-latin' ? 'italic' : 'normal'}.woff2`);
    const own = customFontBytes(name, bold, italic);
    if (own) return new Uint8Array(own);
    const entry = byName.get(lower);
    if (entry && entry.faces.length) {
      const f = pickFace(entry.faces, bold, italic);
      return get(`${base()}fonts/${f.file}`);
    }
    return null;
  })();
  cache.set(k, p);
  return p;
}

/** Latin glyph fallback (English words inside a Malayalam font). */
export const latinFallback = (serif: boolean, bold: boolean, italic: boolean): Promise<Uint8Array | null> =>
  get(`${base()}fonts/web/noto-${serif ? 'serif' : 'sans'}-latin-${bold ? 700 : 400}-${italic ? 'italic' : 'normal'}.woff2`);
