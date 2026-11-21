/**
 * Legacy-font (ML-TT / MLW-TT "ASCII-encoded Malayalam") conversion helpers.
 *
 * Document model: text that is shown in a legacy font is STORED as legacy character codes
 * (exactly like Word/PageMaker DTP files). Everything typed or pasted as Unicode inside such
 * a run is converted on the fly (see editor/legacySync.ts). These helpers are the pure part.
 */
import { unicodeToMlFml, mlFmlToUnicode } from './malayalamConverters';
import { normalizeMalayalamKeyboardInput } from './keyboardLayouts';

export type Series = 'unicode' | 'ml' | 'fml';
export type LegacySeries = 'ml' | 'fml';

const MAL = /[ഀ-ൿ]/;
/** Malayalam block plus zero-width characters the keyboard layouts emit. */
const UNI_CHUNK = /([ഀ-ൿ​-‍]+)/;

export const hasMalayalam = (s: string): boolean => MAL.test(s);
export const isLegacy = (s: Series): s is LegacySeries => s === 'ml' || s === 'fml';

/** Join two-part vowel signs / vowels into their single code points so that equal text compares equal. */
export function canonicalizeUnicode(s: string): string {
  return s
    .replace(/ൊ/g, 'ൊ') // െ + ാ -> ൊ
    .replace(/ോ/g, 'ോ') // േ + ാ -> ോ
    .replace(/ൌ/g, 'ൌ') // െ + ൗ -> ൌ
    .replace(/െെ/g, 'ൈ') // െ + െ -> ൈ
    .replace(/ഒാ/g, 'ഓ') // ഒ + ാ -> ഓ
    .replace(/ഒൗ/g, 'ഔ') // ഒ + ൗ -> ഔ
    .replace(/ഇൗ/g, 'ഈ') // ഇ + ൗ -> ഈ
    .replace(/ഉൗ/g, 'ഊ') // ഉ + ൗ -> ഊ
    .replace(/എെ/g, 'ഐ'); // എ + െ -> ഐ
}

/**
 * The inherited reverse converter occasionally leaves a pre-base vowel sign in an impossible
 * position after a conjunct glyph (e.g. സ്സോ -> സ്സാേ, ക്കൈ -> കൈ്ക, ന്റൈ -> ൈന്റ).
 * Those orders are never valid Unicode, so they can be repaired unambiguously.
 */
const C = '[\\u0D15-\\u0D3A]'; // Malayalam consonants
const FIX_AE = /ാേ/g; // ാേ -> ോ
const FIX_AE2 = /ാെ/g; // ാെ -> ൊ
const FIX_SIGN_VIRAMA = new RegExp(`(${C})([\\u0D46\\u0D47\\u0D48])((?:\\u0D4D${C})+)`, 'g'); // C+sign+്C -> C+്C+sign
const FIX_DOUBLE_SIGN = new RegExp(`([\\u0D46\\u0D47\\u0D48])([\\u0D46\\u0D47\\u0D48])(${C}(?:\\u0D4D${C})*)`, 'g'); // sign sign cluster -> sign cluster sign

export function legacyToUnicode(s: string): string {
  const u = mlFmlToUnicode(s)
    .replace(FIX_AE, 'ോ')
    .replace(FIX_AE2, 'ൊ')
    .replace(FIX_SIGN_VIRAMA, '$1$3$2')
    .replace(FIX_DOUBLE_SIGN, '$1$3$2');
  return canonicalizeUnicode(u);
}

export function unicodeToLegacy(s: string, series: LegacySeries): string {
  return unicodeToMlFml(canonicalizeUnicode(s), series === 'fml' ? 0 : 1);
}

/**
 * A run inside a legacy font can briefly contain a mix: old legacy codes plus freshly typed
 * Unicode. Unicode chunks are kept, legacy chunks are reversed, giving one Unicode string.
 */
export function runToUnicode(run: string): string {
  return run
    .split(UNI_CHUNK)
    .map((part, i) => (i % 2 === 1 || !part ? part : legacyToUnicode(part)))
    .join('');
}

/** Re-encode one word (no whitespace) of a legacy run: mixed -> Unicode -> normalised -> legacy. */
export function reconvertWord(word: string, series: LegacySeries): string {
  const uni = canonicalizeUnicode(normalizeMalayalamKeyboardInput(runToUnicode(word)));
  return unicodeToLegacy(uni, series);
}

/** Word windows (start,end) of a run that contain Unicode Malayalam and therefore need re-encoding. */
export function unicodeWindows(text: string): Array<[number, number]> {
  const wins: Array<[number, number]> = [];
  const re = /[ഀ-ൿ​-‍]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let s = m.index;
    let e = m.index + m[0].length;
    while (s > 0 && !/\s/.test(text[s - 1])) s--;
    while (e < text.length && !/\s/.test(text[e])) e++;
    const last = wins[wins.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(e, last[1]);
    else wins.push([s, e]);
  }
  return wins;
}
