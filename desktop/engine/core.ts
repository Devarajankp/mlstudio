/**
 * Universal-typing core: turns one physical key press into "delete N characters, then type TEXT".
 * Pure logic (no Windows calls) so it can be tested anywhere. The Windows layer only has to
 * feed it key codes and replay the result with real Backspace + Unicode key events.
 */
import { getLayoutMap, normalizeMalayalamKeyboardInput, type KeyboardMode } from './keyboardLayouts';
import { canonicalizeUnicode, unicodeToLegacy } from './legacy';

/** unicode = Noto Sans Malayalam & friends. ml = ML-TT / Ambili … series. fml = MLW-TT … series. */
export type Output = 'unicode' | 'ml' | 'fml';
export type Mode = Exclude<KeyboardMode, 'manglish' | 'english'>;

export interface KeyResult {
  /** true when the key was consumed; the caller must NOT pass the original key to the app */
  handled: boolean;
  backspaces: number;
  text: string;
}

const ZWSP = /​/g;
const PASS: KeyResult = { handled: false, backspaces: 0, text: '' };

export class KeyEngine {
  mode: Mode = 'inscript';
  output: Output = 'unicode';
  /** Unicode of the word being typed (may contain ZWSP markers used for vowel-sign reordering) */
  private uni = '';
  /** exactly what we have put on screen for that word */
  private shown = '';

  /** forget the current word (call on space, enter, mouse click, focus change, cursor keys …) */
  reset(): void {
    this.uni = '';
    this.shown = '';
  }

  private render(u: string): string {
    const clean = u.replace(ZWSP, '');
    return this.output === 'unicode' ? clean : unicodeToLegacy(clean, this.output);
  }

  /** @param vk Windows virtual-key code (same numbers as browser keyCode for letters/punctuation) */
  key(vk: number, shift: boolean): KeyResult {
    const def = getLayoutMap(this.mode)?.[vk];
    if (!def) {
      this.reset();
      return PASS;
    }
    let ch = shift ? def[1] : def[0];
    if (!ch) {
      this.reset();
      return PASS;
    }
    // Typewriter: a prefix vowel sign is typed before its consonant – mark it so it can be moved after it.
    if (this.mode === 'typewriter' && /^[െേൈ]$/.test(ch)) {
      const last = this.uni.replace(ZWSP, '').slice(-1);
      if (!(ch === 'െ' && last === 'െ')) ch = '​' + ch;
    }
    const nextUni = canonicalizeUnicode(normalizeMalayalamKeyboardInput(this.uni + ch));
    const nextShown = this.render(nextUni);

    let common = 0;
    const a = Array.from(this.shown);
    const b = Array.from(nextShown);
    while (common < a.length && common < b.length && a[common] === b[common]) common++;
    const res: KeyResult = { handled: true, backspaces: a.length - common, text: b.slice(common).join('') };
    this.uni = nextUni;
    this.shown = nextShown;
    return res;
  }
}
