/**
 * Malayalam keyboard layouts & post-processing rules
 * Includes: Inscript [F2], GIST [F3], Typewriter [F4], Panchari [F5], Varityper Phonetic [F6], English [F7], and Manglish (Phonetic Transliteration).
 */

export type KeyboardMode =
  | 'manglish'
  | 'inscript'
  | 'gist'
  | 'typewriter'
  | 'panchari'
  | 'varityper'
  | 'english';

export interface KeyDef {
  code: string;
  keyCode: number;
  en: string;
  enShift: string;
  normal: string;
  shift: string;
  width?: string;
}

export interface KeyboardLayoutInfo {
  id: KeyboardMode;
  name: string;
  malayalamName: string;
  shortcut: string;
  badge: string;
  description: string;
}

export const KEYBOARD_MODES: KeyboardLayoutInfo[] = [
  {
    id: 'manglish',
    name: 'Manglish',
    malayalamName: 'മംഗ്ലീഷ്',
    shortcut: 'F1',
    badge: 'Phonetic + Google Input',
    description: 'Type Malayalam phonetically using English letters (e.g. "namaskaram" → "നമസ്കാരം") with live candidate suggestions.',
  },
  {
    id: 'inscript',
    name: 'Inscript',
    malayalamName: 'ഇൻസ്ക്രിപ്റ്റ്',
    shortcut: 'F2',
    badge: 'Standard Govt Layout',
    description: 'Official Government of India standard Malayalam Inscript keyboard layout with vowels on the left and consonants on the right.',
  },
  {
    id: 'gist',
    name: 'GIST',
    malayalamName: 'ജിസ്റ്റ് (MBI)',
    shortcut: 'F3',
    badge: 'C-DAC GIST MBI',
    description: 'Classic C-DAC GIST MBI Malayalam layout widely used in newspaper desks and legacy DTP publishing.',
  },
  {
    id: 'typewriter',
    name: 'Typewriter',
    malayalamName: 'ടൈപ്പ്റൈറ്റർ',
    shortcut: 'F4',
    badge: 'Kerala Typewriter',
    description: 'Traditional mechanical Malayalam Remington/Godrej typewriter layout with automatic pre-base vowel reordering.',
  },
  {
    id: 'panchari',
    name: 'Panchari',
    malayalamName: 'പഞ്ചാരി',
    shortcut: 'F5',
    badge: 'DTP Panchari',
    description: 'Popular DTP operator layout optimized for rapid Malayalam book and magazine typesetting.',
  },
  {
    id: 'varityper',
    name: 'Varityper',
    malayalamName: 'വാരിടൈപ്പർ',
    shortcut: 'F6',
    badge: 'Conjunct Phonetic',
    description: 'High-speed layout featuring dedicated single-keystrokes for common Malayalam geminate conjuncts (ക്ക, ന്ന, ല്ല, പ്പ, ട്ട).',
  },
  {
    id: 'english',
    name: 'English',
    malayalamName: 'ഇംഗ്ലീഷ്',
    shortcut: 'F7',
    badge: 'Direct QWERTY',
    description: 'Standard English QWERTY pass-through for typing English words, numbers, or code inside your Malayalam document.',
  },
];

// Key mapping tables
type KeyMapTable = Record<number, [string, string]>; // keyCode -> [normal, shift]

export const INSCRIPT_MAP: KeyMapTable = {
  192: ['ൊ', 'ഒ'],
  49: ['1', '!'],
  50: ['2', '@'],
  51: ['3', '​സ്റ്റ'],
  52: ['4', '₨'],
  53: ['5', '%'],
  54: ['6', '​ന്റ'],
  55: ['7', 'ക്ഷ'],
  56: ['8', 'ൾ'],
  57: ['9', '('],
  48: ['0', ')'],
  189: ['-', 'ഃ'],
  187: ['ൃ', 'ഋ'],
  81: ['ൗ', 'ഔ'],
  87: ['ൈ', 'ഐ'],
  69: ['ാ', 'ആ'],
  82: ['ീ', 'ഈ'],
  84: ['ൂ', 'ഊ'],
  89: ['ബ', 'ഭ'],
  85: ['ഹ', 'ങ'],
  73: ['ഗ', 'ഘ'],
  79: ['ദ', 'ധ'],
  80: ['ജ', 'ഝ'],
  219: ['ഡ', 'ഢ'],
  221: ['‍', 'ഞ'],
  220: ['‌', 'ർ'],
  65: ['ോ', 'ഓ'],
  83: ['േ', 'ഏ'],
  68: ['്', 'അ'],
  70: ['ി', 'ഇ'],
  71: ['ു', 'ഉ'],
  72: ['പ', 'ഫ'],
  74: ['ര', 'റ'],
  75: ['ക', 'ഖ'],
  76: ['ത', 'ഥ'],
  186: ['ച', 'ഛ'],
  222: ['ട', 'ഠ'],
  90: ['െ', 'എ'],
  88: ['ം', 'ൺ'],
  67: ['മ', 'ണ'],
  86: ['ന', 'ൻ'],
  66: ['വ', 'ഴ'],
  78: ['ല', 'ള'],
  77: ['സ', 'ശ'],
  188: [',', 'ഷ'],
  190: ['.', 'ൽ'],
  191: ['യ', '?'],
};

export const GIST_MAP: KeyMapTable = {
  192: ['`', '~'],
  49: ['1', '!'],
  50: ['2', '@'],
  51: ['3', '₨'],
  52: ['4', '/'],
  53: ['5', '('],
  54: ['6', ')'],
  55: ['7', '-'],
  56: ['8', '{'],
  57: ['9', '}'],
  48: ['0', ':'],
  189: ['?', ':'],
  187: ['ഘ', 'ഝ'],
  81: ['ദ', 'ധ'],
  87: ['പ', 'ഫ'],
  69: ['ല', 'ൽ'],
  82: ['റ', '്ര'],
  84: ['വ', '്വ'],
  89: ['യ', '്യ'],
  85: ['െ', 'എ'],
  73: ['േ', 'ഴ'],
  79: ['ൂ', 'ൗ'],
  80: ['ൃ', 'ഒ'],
  219: ['ഏ', 'ൺ'],
  221: ['ഛ', 'ഋ'],
  220: ['ഡ', 'ഢ'],
  65: ['്‌', 'ഃ'],
  83: ['മ', 'ം'],
  68: ['ന', 'ൻ'],
  70: ['ക', 'ഖ'],
  71: ['ത', 'ഥ'],
  72: ['്', 'റ്റ'],
  74: ['ര', 'ർ'],
  75: ['ു', 'ഉ'],
  76: ['ാ', 'ആ'],
  186: ['ി', 'ീ'],
  222: ["'", '"'],
  90: ['ഗ', 'ങ'],
  88: ['ള', 'ൾ'],
  67: ['സ', 'ശ'],
  86: ['ച', 'അ'],
  66: ['ജ', 'ഞ'],
  78: ['ണ', 'ഇ'],
  77: ['ട', 'ഠ'],
  188: ['ഷ', 'ഹ'],
  190: ['ഭ', 'ബ'],
  191: ['.', ','],
};

export const TYPEWRITER_MAP: KeyMapTable = {
  192: ['്', 'ം'],
  49: ['1', 'ഝ'],
  50: ['2', 'ആ'],
  51: ['3', 'ഈ'],
  52: ['4', 'ഊ'],
  53: ['5', 'ഏ'],
  54: ['6', 'ഐ'],
  55: ['7', 'ഓ'],
  56: ['8', 'ഔ'],
  57: ['9', '('],
  48: ['0', ')'],
  189: ['-', 'ഃ'],
  187: ['=', '+'],
  81: ['ഴ', 'ഒ'],
  87: ['ജ', 'ഋ'],
  69: ['പ', 'ഫ'],
  82: ['ന', 'ൻ'],
  84: ['എ', 'ഇ'],
  89: ['റ', '്ര'],
  85: ['യ', '്യ'],
  73: ['വ', '്വ'],
  79: ['ൂ', 'ൗ'],
  80: ['ദ', 'ധ'],
  219: [',', 'ൃ'],
  221: ['ക്ക', 'ട്ട'],
  220: ['്', ''],
  65: ['മ', 'ഠ'],
  83: ['െ', 'േ'],
  68: ['ക', 'ഖ'],
  70: ['ത', 'ഥ'],
  71: ['ര', 'ർ'],
  72: ['ല', 'ൽ'],
  74: ['ി', 'ീ'],
  75: ['ു', 'ഉ'],
  76: ['ാ', 'അ'],
  186: ['.', 'ആ'],
  222: ['ന്ന', ':'],
  90: ['ഗ', 'ഘ'],
  88: ['ള', 'ൾ'],
  67: ['സ', 'ശ'],
  86: ['ച', 'ഛ'],
  66: ['ങ', 'ഞ'],
  78: ['ണ', 'ൺ'],
  77: ['ട', 'റ്റ'],
  188: ['ഷ', 'ഹ'],
  190: ['ഭ', 'ബ'],
  191: ['ഡ', 'ഢ'],
};

export const PANCHARI_MAP: KeyMapTable = {
  192: ['ജ', 'ങ'],
  49: ['ഡ', '1'],
  50: ['ട', '2'],
  51: ['ഖ', '3'],
  52: ['ധ', '4'],
  53: ['ഛ', '5'],
  54: ['ഭ', '6'],
  55: ['ഥ', '7'],
  56: ['ഘ', '8'],
  57: ['ഠ', '9'],
  48: ['ഢ', '0'],
  189: ['-', '('],
  187: ['ഫ', ')'],
  81: ['ഷ', 'ക്ഷ'],
  87: ['ക', ':'],
  69: ['ാ', 'ആ'],
  82: ['വ', '്വ'],
  84: ['ര', '്ര'],
  89: ['ത', ';'],
  85: ['യ', '്യ'],
  73: ['ല', 'ൽ'],
  79: ['ി', 'ഇ'],
  80: ['', 'ഉ'],
  219: ['ഒ', 'ഝ'],
  221: ['ു', 'ൂ'],
  220: ['ൃ', '/'],
  65: ['അ', 'ഃ'],
  83: ['സ', "'"],
  68: ['ദ', '"'],
  70: ['ന', 'ൻ'],
  71: ['ണ', 'ൺ'],
  72: ['മ', 'േ'],
  74: ['ഗ', 'ം'],
  75: ['ഏ', ','],
  76: ['ീ', 'ൗ'],
  186: ['ഐ', 'ഃ'],
  222: ['!', 'ഋ'],
  90: ['ഹ', 'ൾ'],
  88: ['റ', 'ർ'],
  67: ['ഞ', 'ഔ'],
  86: ['ച', 'ഓ'],
  66: ['ബ', '='],
  78: ['പ', '%'],
  77: ['എ', '?'],
  188: ['്', '.'],
  190: ['ള', 'ഴ'],
  191: ['ശ', 'െ'],
};

export const VARITYPER_MAP: KeyMapTable = {
  192: ['ഫ', 'ങ'],
  49: ['്‌വ', 'റ്റ'],
  50: ['ൃ', 'ശ്ശ'],
  51: ['ങ്ക', 'ഗ്ഗ'],
  52: ['മ്പ', 'ഐ'],
  53: ['മ്മ', 'ഞ്ച'],
  54: ['ഖ', 'ഘ'],
  55: ['ഞ', 'ൈ'],
  56: ['ഡ', 'ഃ'],
  57: ['ൺ', 'ഢ'],
  48: ['ൗ', 'ത്സ'],
  189: ['ോ', 'ഓ'],
  187: ['ഏ', 'ഛ'],
  81: ['ക്ക', 'ഒ'],
  87: ['ന്ന', 'ല്ല'],
  69: ['േ', 'ഷ'],
  82: ['ം', 'ഗ'],
  84: ['ന', 'ഇ'],
  89: ['പ', 'എ'],
  85: ['മ', 'ധ'],
  73: ['സ', 'ഭ'],
  79: ['റ', 'ജ'],
  80: ['ഃ', 'ൊ'],
  219: ['?', 'ഔ'],
  221: [' ', 'ഈ'],
  220: ['ൃ', 'ഴ'],
  65: ['ണ്ണ', 'ഠ'],
  83: ['വ', 'ൾ'],
  68: ['ത', 'പ്പ'],
  70: ['യ', 'ണ്ട'],
  71: ['െ', 'ശ'],
  72: ['ാ', 'ട്ട'],
  74: ['ു', 'ദ'],
  75: ['ി', '്ര'],
  76: ['ക', 'ീ'],
  186: ['്‌', 'ങ്ങ'],
  222: ['ര', 'ൂ'],
  90: ['ർ', 'ഉ'],
  88: ['അ', 'ബ'],
  67: ['ൽ', 'ഥ'],
  86: ['ച', 'ന്ത'],
  66: ['ത്ത', 'ഹ'],
  78: ['ള', '്യ'],
  77: ['ല', 'ആ'],
  188: ['ൻ', ','],
  190: ['ണ', '.'],
  191: ['്', 'ഞ്ഞ'],
};

export const KEYBOARD_ROWS: { code: string; keyCode: number; en: string; enShift: string }[][] = [
  [
    { code: 'Backquote', keyCode: 192, en: '`', enShift: '~' },
    { code: 'Digit1', keyCode: 49, en: '1', enShift: '!' },
    { code: 'Digit2', keyCode: 50, en: '2', enShift: '@' },
    { code: 'Digit3', keyCode: 51, en: '3', enShift: '#' },
    { code: 'Digit4', keyCode: 52, en: '4', enShift: '$' },
    { code: 'Digit5', keyCode: 53, en: '5', enShift: '%' },
    { code: 'Digit6', keyCode: 54, en: '6', enShift: '^' },
    { code: 'Digit7', keyCode: 55, en: '7', enShift: '&' },
    { code: 'Digit8', keyCode: 56, en: '8', enShift: '*' },
    { code: 'Digit9', keyCode: 57, en: '9', enShift: '(' },
    { code: 'Digit0', keyCode: 48, en: '0', enShift: ')' },
    { code: 'Minus', keyCode: 189, en: '-', enShift: '_' },
    { code: 'Equal', keyCode: 187, en: '=', enShift: '+' },
  ],
  [
    { code: 'KeyQ', keyCode: 81, en: 'q', enShift: 'Q' },
    { code: 'KeyW', keyCode: 87, en: 'w', enShift: 'W' },
    { code: 'KeyE', keyCode: 69, en: 'e', enShift: 'E' },
    { code: 'KeyR', keyCode: 82, en: 'r', enShift: 'R' },
    { code: 'KeyT', keyCode: 84, en: 't', enShift: 'T' },
    { code: 'KeyY', keyCode: 89, en: 'y', enShift: 'Y' },
    { code: 'KeyU', keyCode: 85, en: 'u', enShift: 'U' },
    { code: 'KeyI', keyCode: 73, en: 'i', enShift: 'I' },
    { code: 'KeyO', keyCode: 79, en: 'o', enShift: 'O' },
    { code: 'KeyP', keyCode: 80, en: 'p', enShift: 'P' },
    { code: 'BracketLeft', keyCode: 219, en: '[', enShift: '{' },
    { code: 'BracketRight', keyCode: 221, en: ']', enShift: '}' },
    { code: 'Backslash', keyCode: 220, en: '\\', enShift: '|' },
  ],
  [
    { code: 'KeyA', keyCode: 65, en: 'a', enShift: 'A' },
    { code: 'KeyS', keyCode: 83, en: 's', enShift: 'S' },
    { code: 'KeyD', keyCode: 68, en: 'd', enShift: 'D' },
    { code: 'KeyF', keyCode: 70, en: 'f', enShift: 'F' },
    { code: 'KeyG', keyCode: 71, en: 'g', enShift: 'G' },
    { code: 'KeyH', keyCode: 72, en: 'h', enShift: 'H' },
    { code: 'KeyJ', keyCode: 74, en: 'j', enShift: 'J' },
    { code: 'KeyK', keyCode: 75, en: 'k', enShift: 'K' },
    { code: 'KeyL', keyCode: 76, en: 'l', enShift: 'L' },
    { code: 'Semicolon', keyCode: 186, en: ';', enShift: ':' },
    { code: 'Quote', keyCode: 222, en: "'", enShift: '"' },
  ],
  [
    { code: 'KeyZ', keyCode: 90, en: 'z', enShift: 'Z' },
    { code: 'KeyX', keyCode: 88, en: 'x', enShift: 'X' },
    { code: 'KeyC', keyCode: 67, en: 'c', enShift: 'C' },
    { code: 'KeyV', keyCode: 86, en: 'v', enShift: 'V' },
    { code: 'KeyB', keyCode: 66, en: 'b', enShift: 'B' },
    { code: 'KeyN', keyCode: 78, en: 'n', enShift: 'N' },
    { code: 'KeyM', keyCode: 77, en: 'm', enShift: 'M' },
    { code: 'Comma', keyCode: 188, en: ',', enShift: '<' },
    { code: 'Period', keyCode: 190, en: '.', enShift: '>' },
    { code: 'Slash', keyCode: 191, en: '/', enShift: '?' },
  ],
];

export function getLayoutMap(mode: KeyboardMode): KeyMapTable | null {
  switch (mode) {
    case 'inscript':
      return INSCRIPT_MAP;
    case 'gist':
      return GIST_MAP;
    case 'typewriter':
      return TYPEWRITER_MAP;
    case 'panchari':
      return PANCHARI_MAP;
    case 'varityper':
      return VARITYPER_MAP;
    default:
      return null;
  }
}

/**
 * Post-processes Malayalam text buffer after a keystroke in Inscript, GIST, Typewriter, Panchari, or Varityper
 * Replicates Convert01, Convert02, Convert03, Convert04, and correctNewChillu
 */
export function normalizeMalayalamKeyboardInput(text: string): string {
  let out = text;

  // Vowel combinations (Convert01)
  out = out
    .replace(/ഒാ/g, 'ഓ')
    .replace(/ഒൗ/g, 'ഔ')
    .replace(/ഇൗ/g, 'ഈ')
    .replace(/ഉൗ/g, 'ഊ')
    .replace(/എെ/g, 'ഐ')
    .replace(/െെ/g, 'ൈ')
    .replace(/ൊ/g, 'ൊ')
    .replace(/ോ/g, 'ോ')
    .replace(/ൌ/g, 'ൌ');

  // Pre-base vowel sign reordering for Typewriter / GIST / Panchari (where user types െ or േ before consonant)
  // e.g. \u200Bെ + ക -> കെ
  out = out
    .replace(/\u200B([െേൈ])([ക-ഹളഴറ])/g, '$2$1')
    .replace(/([\u0D15-\u0D27\u0D29-\u0D30\u0D32-\u0D39])([െേൈ])്റ/g, '$1്ര$2') // not after ന / റ: ന്റ and റ്റ are real conjuncts
    .replace(/([ക-ഹളഴറ])([െേൈ])്വ/g, '$1്വ$2')
    .replace(/([ക-ഹളഴറ])([െേൈ])്യ/g, '$1്യ$2')
    // a vowel sign can never be followed by a virama: the sign belongs after the whole conjunct (കെ്ക -> ക്കെ)
    .replace(/([ക-ഹളഴറ])([െേൈ])((?:്[ക-ഹളഴറ])+)/g, '$1$3$2');

  // Convert02 & Convert04 chillu / conjunct normalizations
  out = out
    .replace(/ൻറ/g, 'ന്റ')
    .replace(/ന്പ/g, 'മ്പ')
    .replace(/ന്െറ/g, 'ന്റെ')
    .replace(/ൻറേ/g, 'ന്റേ')
    .replace(/െന്റെ/g, 'ന്റൈ')
    .replace(/ണ്‍/g, 'ൺ')
    .replace(/ന്‍/g, 'ൻ')
    .replace(/ര്‍/g, 'ർ')
    .replace(/ല്‍/g, 'ൽ')
    .replace(/ള്‍/g, 'ൾ');

  return out;
}

export function correctNewChillu(text: string): string {
  return text
    .replaceAll('ണ്‍', 'ൺ')
    .replaceAll('ന്‍', 'ൻ')
    .replaceAll('ര്‍', 'ർ')
    .replaceAll('ല്‍', 'ൽ')
    .replaceAll('ള്‍', 'ൾ')
    .replaceAll('ോ', 'ോ')
    .replaceAll('ൊ', 'ൊ')
    .replaceAll('൦', '0')
    .replaceAll('൧', '1')
    .replaceAll('൨', '2')
    .replaceAll('൩', '3')
    .replaceAll('൪', '4')
    .replaceAll('൫', '5')
    .replaceAll('൬', '6')
    .replaceAll('൭', '7')
    .replaceAll('൮', '8')
    .replaceAll('൯', '9');
}
