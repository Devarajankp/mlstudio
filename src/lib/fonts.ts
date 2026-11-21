import manifest from '../data/fonts.json';
import type { Series } from './legacy';

export interface FontFaceDef {
  file: string;
  weight: number | string;
  style: string;
}
export interface FontEntry {
  family: string;
  label: string;
  series: Series;
  group: string;
  faces: FontFaceDef[];
  /** added by the user (stored in this browser / app) */
  custom?: boolean;
  /** show in the Handwriting studio style list */
  handwriting?: boolean;
}

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();

const bundled: FontEntry[] = (manifest as Array<Omit<FontEntry, 'group'>>).map((m) => ({
  ...m,
  label: tidy(m.label),
  group:
    m.series === 'unicode'
      ? 'Malayalam Unicode'
      : m.series === 'ml'
        ? 'Legacy ML series (ML-TT …)'
        : 'Legacy FML series (MLW-TT …)',
}));

const WEB_FACES: Record<string, Array<[string, number]>> = {
  'Noto Serif Malayalam': [['noto-serif-malayalam-malayalam', 400], ['noto-serif-malayalam-malayalam', 700]],
  Manjari: [['manjari-malayalam', 400], ['manjari-malayalam', 700]],
  Chilanka: [['chilanka-malayalam', 400]],
  Gayathri: [['gayathri-malayalam', 400], ['gayathri-malayalam', 700]],
};
const webUnicode = Object.keys(WEB_FACES).map<FontEntry>((family) => ({
  family,
  label: family,
  series: 'unicode',
  group: 'Malayalam Unicode',
  faces: WEB_FACES[family].map(([f, w]) => ({ file: `web/${f}-${w}-normal.woff2`, weight: w, style: 'normal' })),
}));

const latin = ['Arial', 'Calibri', 'Cambria', 'Georgia', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Verdana', 'Courier New'].map<FontEntry>(
  (family) => ({ family, label: family, series: 'unicode', group: 'English / Latin', faces: [] }),
);

export const FONTS: FontEntry[] = [...bundled.filter((f) => f.series === 'unicode'), ...webUnicode, ...latin, ...bundled.filter((f) => f.series !== 'unicode')];

export const DEFAULT_FONT = 'Noto Sans Malayalam';

export const byName = new Map(FONTS.map((f) => [f.family.toLowerCase(), f]));

/** CSS font-family value -> plain first family name without quotes. */
export function normalizeFamilyValue(css: string | null | undefined): string {
  if (!css) return '';
  return css.split(',')[0].replace(/["']/g, '').trim();
}

export const quoteFamily = (family: string): string => `"${family}"`;

export function seriesOfFamily(family: string | null | undefined): Series {
  const f = byName.get(normalizeFamilyValue(family).toLowerCase());
  return f ? f.series : 'unicode';
}

export const fontByFamily = (family: string): FontEntry | undefined => byName.get(normalizeFamilyValue(family).toLowerCase());

/** Default legacy font to use when text is converted to the ML / FML series. */
export function defaultLegacyFamily(series: 'ml' | 'fml'): string {
  const pick = FONTS.find((f) => f.series === series && /Karthika$/.test(f.family)) ?? FONTS.find((f) => f.series === series);
  return pick ? pick.family : DEFAULT_FONT;
}

let injected = false;
/** Register every bundled face. Browsers download a face only when text actually uses it. */
export function injectFontFaces(): void {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const base = import.meta.env.BASE_URL;
  const css = FONTS.flatMap((f) =>
    f.faces.map(
      (face) =>
        `@font-face{font-family:"${f.family}";src:url("${base}fonts/${face.file}") format("woff2");font-weight:${face.weight};font-style:${face.style};font-display:swap}`,
    ),
  ).join('\n');
  const el = document.createElement('style');
  el.id = 'msx-font-faces';
  el.textContent = css;
  document.head.appendChild(el);
}

/* ------------------------------------------------------------------ live font registry (fonts the user adds) */

const listeners = new Set<() => void>();
let version = 0;
/** React: re-render when the font list changes (useSyncExternalStore friendly). */
export const subscribeFonts = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const fontsVersion = (): number => version;
export function notifyFontsChanged(): void {
  version++;
  listeners.forEach((l) => l());
}

/** Add (or replace) a font entry at run time. */
export function registerFontEntry(entry: FontEntry): void {
  const i = FONTS.findIndex((f) => f.family.toLowerCase() === entry.family.toLowerCase());
  if (i >= 0) FONTS.splice(i, 1, entry);
  else FONTS.push(entry);
  byName.set(entry.family.toLowerCase(), entry);
  notifyFontsChanged();
}
export function unregisterFontEntry(family: string): void {
  const i = FONTS.findIndex((f) => f.family.toLowerCase() === family.toLowerCase());
  if (i >= 0) FONTS.splice(i, 1);
  byName.delete(family.toLowerCase());
  notifyFontsChanged();
}
