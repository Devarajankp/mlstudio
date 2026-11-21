/** Fonts the user adds (TTF / OTF / WOFF / WOFF2). Kept in IndexedDB so they are there next time. */
import { registerFontEntry, unregisterFontEntry, type FontEntry } from './fonts';
import type { Series } from './legacy';

export interface StoredFont {
  id: string;
  family: string;
  label: string;
  series: Series;
  handwriting: boolean;
  weight: number;
  style: 'normal' | 'italic';
  data: ArrayBuffer;
}

const DB = 'msx-fonts';
const STORE = 'fonts';

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((res, rej) => {
    const rq = fn(db.transaction(STORE, mode).objectStore(STORE));
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}

const memory = new Map<string, StoredFont>(); // family|weight|style -> font
const key = (family: string, weight: number, style: string) => `${family.toLowerCase()}|${weight}|${style}`;

export const customGroup = (s: Series): string =>
  s === 'unicode' ? 'My fonts (Unicode)' : s === 'ml' ? 'My fonts (ML-TT series)' : 'My fonts (MLW-TT series)';

async function activate(f: StoredFont): Promise<void> {
  memory.set(key(f.family, f.weight, f.style), f);
  const face = new FontFace(f.family, f.data.slice(0), { weight: String(f.weight), style: f.style });
  await face.load();
  document.fonts.add(face);
}

function publish(family: string): void {
  const faces = [...memory.values()].filter((m) => m.family.toLowerCase() === family.toLowerCase());
  if (!faces.length) return unregisterFontEntry(family);
  const first = faces[0];
  const entry: FontEntry = {
    family: first.family,
    label: first.label,
    series: first.series,
    group: first.handwriting ? 'My handwriting fonts' : customGroup(first.series),
    faces: [], // registered through the FontFace API, not by URL
    custom: true,
    handwriting: first.handwriting,
  };
  registerFontEntry(entry);
}

/** Bytes of a user font (for PDF embedding). Picks the closest weight/style. */
export function customFontBytes(family: string, bold: boolean, italic: boolean): ArrayBuffer | null {
  const all = [...memory.values()].filter((m) => m.family.toLowerCase() === family.toLowerCase());
  if (!all.length) return null;
  const wantW = bold ? 700 : 400;
  const wantS = italic ? 'italic' : 'normal';
  all.sort((a, b) => Math.abs(a.weight - wantW) + (a.style === wantS ? 0 : 1000) - (Math.abs(b.weight - wantW) + (b.style === wantS ? 0 : 1000)));
  return all[0].data;
}

export async function loadCustomFonts(): Promise<void> {
  try {
    const all = (await tx('readonly', (s) => s.getAll())) as StoredFont[];
    const families = new Set<string>();
    for (const f of all) {
      try {
        await activate(f);
        families.add(f.family);
      } catch {
        /* a damaged font is skipped */
      }
    }
    families.forEach(publish);
  } catch {
    /* IndexedDB unavailable (private window) – fonts just won't persist */
  }
}

export interface Probe {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  hasMalayalam: boolean;
  series: Series;
}

/** Read the font name / weight / script coverage and guess whether it is a legacy ML-TT or MLW-TT style font. */
export async function probeFont(bytes: ArrayBuffer, fileName: string): Promise<Probe> {
  const fk = await import('fontkit');
  const font = fk.create(new Uint8Array(bytes)) as unknown as {
    familyName?: string;
    subfamilyName?: string;
    hasGlyphForCodePoint(cp: number): boolean;
    'OS/2'?: { usWeightClass?: number; fsSelection?: { italic?: boolean } };
  };
  const family = (font.familyName || fileName.replace(/\.[^.]+$/, '')).trim();
  const sub = (font.subfamilyName || '').toLowerCase();
  const weight = font['OS/2']?.usWeightClass ?? (/bold/.test(sub) ? 700 : 400);
  const italic = /italic|oblique/.test(sub) || !!font['OS/2']?.fsSelection?.italic;
  const hasMalayalam = font.hasGlyphForCodePoint(0x0d2e);
  let series: Series = 'unicode';
  if (!hasMalayalam) {
    if (/\bMLW|FML|MLW-?TT/i.test(family + fileName)) series = 'fml';
    else if (/\bML[-_ ]?TT|MLTT|^ML[-_ ]|^ML\d/i.test(family + fileName)) series = 'ml';
  }
  return { family, weight, style: italic ? 'italic' : 'normal', hasMalayalam, series };
}

export async function addCustomFont(bytes: ArrayBuffer, probe: Probe, opts: { label?: string; series: Series; handwriting: boolean }): Promise<string> {
  const stored: StoredFont = {
    id: key(probe.family, probe.weight, probe.style),
    family: probe.family,
    label: opts.label?.trim() || probe.family,
    series: opts.series,
    handwriting: opts.handwriting,
    weight: probe.weight,
    style: probe.style,
    data: bytes,
  };
  await activate(stored);
  try {
    await tx('readwrite', (s) => s.put(stored));
  } catch {
    /* works for this session even if it cannot be saved */
  }
  publish(stored.family);
  return stored.family;
}

export async function removeCustomFont(family: string): Promise<void> {
  for (const [k, f] of [...memory]) {
    if (f.family.toLowerCase() === family.toLowerCase()) {
      memory.delete(k);
      try {
        await tx('readwrite', (s) => s.delete(f.id));
      } catch {
        /* ignore */
      }
    }
  }
  unregisterFontEntry(family);
}
