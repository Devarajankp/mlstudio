/**
 * Legacy "ISFOC" Malayalam font encoding (the ML-TT / FML-TT font families: Karthika, Ambili,
 * Revathi, Chandrika …) ⇄ Unicode.
 *
 * ORIGINAL WORK. The tables below were written by reading the glyph layout of C-DAC ISFOC fonts
 * (which letter each character code draws) and checking the result by drawing converted text in
 * those fonts. Nothing here is copied from another converter or from a third-party map file.
 * Shapes the fonts draw as one glyph (conjuncts, chillu letters) are listed as `CONJ`; everything
 * else is a single letter or sign. Pre-base vowel signs (െ േ ൈ and the ra-sign) are written
 * BEFORE the consonant in legacy text, exactly as they are drawn.
 */

const V = '്'; // virama / chandrakkala

/** code letter → Malayalam consonant (single letters) */
const CONS_CODES = 'IJKLMNOPQRSTUVWX' + 'XYZ[\\]^_`abcdefghijkl';
const CONS_UNI = 'കഖഗഘങചഛജഝഞടഠഡഢണ' + 'തഥദധനപഫബഭമയരറലളഴവശഷസഹ';
// (built explicitly below to avoid index mistakes)
const CONS: Array<[string, string]> = [
  ['I', 'ക'], ['J', 'ഖ'], ['K', 'ഗ'], ['L', 'ഘ'], ['M', 'ങ'], ['N', 'ച'], ['O', 'ഛ'], ['P', 'ജ'],
  ['Q', 'ഝ'], ['R', 'ഞ'], ['S', 'ട'], ['T', 'ഠ'], ['U', 'ഡ'], ['V', 'ഢ'], ['W', 'ണ'], ['X', 'ത'],
  ['Y', 'ഥ'], ['Z', 'ദ'], ['[', 'ധ'], ['\\', 'ന'], [']', 'പ'], ['^', 'ഫ'], ['_', 'ബ'], ['`', 'ഭ'],
  ['a', 'മ'], ['b', 'യ'], ['c', 'ര'], ['d', 'റ'], ['e', 'ല'], ['f', 'ള'], ['g', 'ഴ'], ['h', 'വ'],
  ['i', 'ശ'], ['j', 'ഷ'], ['k', 'സ'], ['l', 'ഹ'],
];
void CONS_CODES; void CONS_UNI;

/** independent vowels */
const VOWELS: Array<[string, string]> = [['A', 'അ'], ['B', 'ആ'], ['C', 'ഇ'], ['D', 'ഉ'], ['E', 'ഋ'], ['F', 'എ'], ['G', 'ഏ'], ['H', 'ഒ']];

/** post-base signs */
const POST: Array<[string, string]> = [
  ['m', 'ാ'], ['n', 'ി'], ['o', 'ീ'], ['p', 'ു'], ['q', 'ൂ'], ['r', 'ൃ'], ['u', 'ൗ'], ['w', 'ം'], ['x', 'ഃ'],
];

/** single glyphs that draw a whole conjunct or chillu letter (code → Unicode) */
const CONJ: Array<[number, string]> = [
  [161, 'ക്ക'], [162, 'ക്ല'], [163, 'ക്ഷ'], [164, 'ഗ്ഗ'], [165, 'ഗ്ല'], [166, 'ങ്ക'], [167, 'ങ്ങ'], [168, 'ച്ച'],
  [169, 'ഞ്ച'], [170, 'ഞ്ഞ'], [171, 'ട്ട'], [172, 'ൺ'], [173, 'ണ്ട'], [174, 'ണ്ണ'], [175, 'ത്ത'], [176, 'ത്ഥ'],
  [177, 'ദ്ദ'], [178, 'ദ്ധ'], [179, 'ൻ'], [180, 'ന്ത'], [181, 'ന്ദ'], [182, 'ന്ന'], [183, 'ന്മ'], [184, 'പ്പ'],
  [185, 'പ്ല'], [186, 'ബ്ബ'], [187, 'ബ്ല'], [188, 'മ്പ'], [189, 'മ്മ'], [190, 'മ്ല'], [191, 'യ്യ'], [192, 'ർ'],
  [193, 'റ്റ'], [194, 'ൽ'], [195, 'ല്ല'], [196, 'ൾ'], [197, 'ള്ള'], [198, 'വ്വ'], [199, 'ശ്ല'], [200, 'ശ്ശ'],
  [201, 'സ്ല'], [202, 'സ്സ'], [203, 'ഫ്ല'], [204, 'സ്റ്റ'], [205, 'ഡ്ഡ'], [206, 'ക്ട'], [207, 'ബ്ധ'], [208, 'ബ്ദ'],
  [209, 'ച്ഛ'], [210, 'ഹ്മ'], [211, 'ഹ്ന'], [212, 'ന്ധ'], [213, 'ത്സ'], [214, 'ജ്ജ'], [215, 'ണ്മ'], [216, 'സ്ഥ'],
  [217, 'ന്ഥ'], [218, 'ജ്ഞ'], [219, 'ത്ഭ'], [220, 'ഗ്മ'], [221, 'ശ്ച'], [222, 'ണ്ഡ'], [223, 'ത്മ'], [224, 'ക്ത'],
  [225, 'ഗ്ന'], [226, 'ന്റ'], [227, 'ഷ്ട'], [228, 'റ്റ'], [229, 'ല്പ'],
];

const ch = (c: number) => String.fromCharCode(c);

const toUni = new Map<string, string>(); // legacy glyph → Unicode (consonant, conjunct, chillu)
const toLeg = new Map<string, string>(); // Unicode consonant / conjunct → legacy glyph
const consonantGlyph = new Set<string>();
for (const [k, u] of CONS) { toUni.set(k, u); toLeg.set(u, k); consonantGlyph.add(k); }
for (const [code, u] of CONJ) {
  toUni.set(ch(code), u);
  if (!toLeg.has(u)) toLeg.set(u, ch(code)); // first listed glyph wins (193 over 228)
}
const vowelToUni = new Map(VOWELS);
const vowelToLeg = new Map(VOWELS.map(([k, u]) => [u, k] as [string, string]));
const postToUni = new Map(POST);
const postToLeg = new Map(POST.map(([k, u]) => [u, k] as [string, string]));

const CONSONANTS = new Set(CONS.map(([, u]) => u));
const CHILLU: Record<string, string> = { 'ൺ': ch(172), 'ൻ': ch(179), 'ർ': ch(192), 'ൽ': ch(194), 'ൾ': ch(196) };
/** keys longest first so that the 3-letter shapes (സ്റ്റ) win over their 2-letter prefixes */
const CONJ_KEYS = [...toLeg.keys()].filter((k) => k.length > 1 && !(k in CHILLU)).sort((a, b) => b.length - a.length);

const RA_PRE = '{'; // the ra-sign (്ര) is drawn BEFORE its consonant
const SIGN_YA = 'y'; // ്യ
const SIGN_VA = 'z'; // ്വ

const OLD_CHILLU: Array<[RegExp, string]> = [
  [/ണ്‍/g, 'ൺ'], [/ന്‍/g, 'ൻ'], [/ര്‍/g, 'ർ'], [/ല്‍/g, 'ൽ'], [/ള്‍/g, 'ൾ'],
];

/* ---------------------------------------------------------------- Unicode → legacy */

export function unicodeToIsfoc(input: string): string {
  let s = input.replace(/‌/g, '');
  for (const [re, to] of OLD_CHILLU) s = s.replace(re, to);
  // two-part vowel signs written as separate pieces
  s = s.replace(/ൊ/g, 'ൊ').replace(/ോ/g, 'ോ').replace(/ൌ/g, 'ൌ').replace(/െെ/g, 'ൈ');
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (CHILLU[c]) { out += CHILLU[c]; i++; continue; }
    if (CONSONANTS.has(c)) {
      let body = '';
      let ra = false;
      let j = i;
      for (;;) {
        const key = CONJ_KEYS.find((k) => s.startsWith(k, j));
        if (key) { body += toLeg.get(key); j += key.length; } else { body += toLeg.get(s[j]); j += 1; }
        // ്യ  ്വ  ്ര signs may follow any letter, several in a row
        while (s[j] === V && (s[j + 1] === 'യ' || s[j + 1] === 'വ' || s[j + 1] === 'ര')) {
          if (s[j + 1] === 'യ') body += SIGN_YA; else if (s[j + 1] === 'വ') body += SIGN_VA; else ra = true;
          j += 2;
        }
        if (s[j] === V && CONSONANTS.has(s[j + 1])) { body += 'v'; j += 1; continue; } // visible chandrakkala
        break;
      }
      // vowel sign
      const sign = s[j];
      let pre = '';
      let post = '';
      let used = 0;
      if (sign === 'െ') { pre = 's'; used = 1; }
      else if (sign === 'േ') { pre = 't'; used = 1; }
      else if (sign === 'ൈ') { pre = 'ss'; used = 1; }
      else if (sign === 'ൊ') { pre = 's'; post = 'm'; used = 1; }
      else if (sign === 'ോ') { pre = 't'; post = 'm'; used = 1; }
      else if (sign === 'ൌ') { pre = 's'; post = 'u'; used = 1; }
      else if (postToLeg.has(sign)) { post = postToLeg.get(sign)!; used = 1; }
      if (!used && s[j] === V) { post = 'v'; used = 1; } // word-final chandrakkala
      out += pre + (ra ? RA_PRE : '') + body + post;
      i = j + used;
      // anusvara / visarga after a vowel sign
      while (postToLeg.has(s[i]) && (s[i] === 'ം' || s[i] === 'ഃ')) { out += postToLeg.get(s[i]); i++; }
      continue;
    }
    // independent vowels
    const rest = s.slice(i);
    if (rest.startsWith('ഈ')) { out += 'Cu'; i += 1; continue; }
    if (rest.startsWith('ഊ')) { out += 'Du'; i += 1; continue; }
    if (rest.startsWith('ഐ')) { out += 'sF'; i += 1; continue; }
    if (rest.startsWith('ഓ')) { out += 'Hm'; i += 1; continue; }
    if (rest.startsWith('ഔ')) { out += 'Hu'; i += 1; continue; }
    if (vowelToLeg.has(c)) { out += vowelToLeg.get(c); i++; continue; }
    if (postToLeg.has(c)) { out += postToLeg.get(c); i++; continue; } // stray sign / anusvara
    out += c; i++;
  }
  return out;
}

/* ---------------------------------------------------------------- legacy → Unicode */

const isConsGlyph = (c: string | undefined): boolean => !!c && toUni.has(c);

export function isfocToUnicode(input: string): string {
  const s = input;
  let out = '';
  let i = 0;
  while (i < s.length) {
    let pre = '';
    let ra = false;
    const start = i;
    while (s[i] === 's' || s[i] === 't' || s[i] === RA_PRE) {
      if (s[i] === RA_PRE) ra = true; else pre += s[i];
      i++;
      if (pre.length > 2) break;
    }
    const c = s[i];
    // two-glyph independent vowels
    if (pre === 's' && c === 'F' && !ra) { out += 'ഐ'; i++; continue; }
    if (isConsGlyph(c)) {
      let body = toUni.get(c)!;
      let tail = ''; // ്യ / ്വ written after the ra-sign in Unicode (ന്ത്ര്യ)
      i++;
      for (;;) {
        if (s[i] === SIGN_YA) { tail += V + 'യ'; i++; continue; }
        if (s[i] === SIGN_VA) { tail += V + 'വ'; i++; continue; }
        if (s[i] === 'v' && isConsGlyph(s[i + 1])) { body += tail + V + toUni.get(s[i + 1]); tail = ''; i += 2; continue; }
        break;
      }
      if (ra) body += V + 'ര';
      body += tail;
      let sign = '';
      const p = s[i];
      if (p === 'v') { sign = V; i++; }
      else if (postToUni.has(p) && p !== 'w' && p !== 'x') {
        const post = p;
        i++;
        if (pre === 's' && post === 'm') sign = 'ൊ';
        else if (pre === 't' && post === 'm') sign = 'ോ';
        else if (pre === 's' && post === 'u') sign = 'ൌ';
        else sign = postToUni.get(post)!;
        if (!(pre === 's' && (post === 'm' || post === 'u')) && !(pre === 't' && post === 'm')) {
          // pre sign + a different post sign (rare): keep both
          if (pre === 's') sign = 'െ' + sign; else if (pre === 'ss') sign = 'ൈ' + sign; else if (pre === 't') sign = 'േ' + sign;
        }
        pre = '';
      }
      if (pre === 's') sign = 'െ' + sign; else if (pre === 'ss') sign = 'ൈ' + sign; else if (pre === 't') sign = 'േ' + sign;
      out += body + sign;
      while (s[i] === 'w' || s[i] === 'x') { out += postToUni.get(s[i]); i++; }
      continue;
    }
    if (vowelToUni.has(c) && !ra) {
      let v = vowelToUni.get(c)!;
      i++;
      if (c === 'C' && s[i] === 'u') { v = 'ഈ'; i++; }
      else if (c === 'D' && s[i] === 'u') { v = 'ഊ'; i++; }
      else if (c === 'H' && s[i] === 'm') { v = 'ഓ'; i++; }
      else if (c === 'H' && s[i] === 'u') { v = 'ഔ'; i++; }
      out += v;
      continue;
    }
    if (postToUni.has(c) && !pre && !ra) { out += postToUni.get(c); i++; continue; }
    // not a legacy sequence: pass the original characters through unchanged
    if (i === start) { out += s[i] ?? ''; i++; } else { out += s.slice(start, i); }
  }
  return out;
}
