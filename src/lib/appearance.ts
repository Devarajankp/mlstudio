/** Theme colours (all soft, low-glare) + comfort / accessibility preferences. */
export interface Theme { id: string; name: string; accent: string; dark: string }

export const THEMES: Theme[] = [
  { id: 'ocean', name: 'Calm blue', accent: '#3f6b9e', dark: '#5b88bd' },
  { id: 'sage', name: 'Sage green', accent: '#4f7d66', dark: '#6ea287' },
  { id: 'teal', name: 'Soft teal', accent: '#3a7f86', dark: '#58a3aa' },
  { id: 'lavender', name: 'Lavender', accent: '#6b6399', dark: '#8d85bd' },
  { id: 'rose', name: 'Dusty rose', accent: '#a0616f', dark: '#c4808e' },
  { id: 'sand', name: 'Warm sand', accent: '#9b7544', dark: '#bf9a66' },
  { id: 'slate', name: 'Slate grey', accent: '#566472', dark: '#7d8d9c' },
];

export interface UiPrefs {
  theme: string;      // theme id or 'custom'
  custom: string;     // #rrggbb used when theme === 'custom'
  size: 100 | 115 | 130; // interface size in %
  contrast: boolean;  // high contrast
  motion: boolean;    // reduce motion
}
export const DEFAULT_UI: UiPrefs = { theme: 'ocean', custom: '#3f6b9e', size: 100, contrast: false, motion: false };
const KEY = 'msx-ui';

export function loadUi(): UiPrefs {
  try {
    return { ...DEFAULT_UI, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<UiPrefs>) };
  } catch {
    return DEFAULT_UI;
  }
}
export function saveUi(p: UiPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode */
  }
}

export function accentOf(p: UiPrefs, dark: boolean): string {
  if (p.theme === 'custom' && /^#[0-9a-f]{6}$/i.test(p.custom)) return p.custom;
  const t = THEMES.find((x) => x.id === p.theme) ?? THEMES[0];
  return dark ? t.dark : t.accent;
}

export function applyUi(p: UiPrefs, dark: boolean): void {
  const r = document.documentElement;
  r.style.setProperty('--msx-accent', accentOf(p, dark));
  r.style.setProperty('--ui-zoom', String(p.size / 100));
  r.classList.toggle('hc', p.contrast);
  r.classList.toggle('rm', p.motion);
}
