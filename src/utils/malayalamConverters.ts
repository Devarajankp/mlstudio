/**
 * Legacy (ML-TT / MLW-TT) <-> Unicode font conversion
 * 1. Unicode -> ML Series (mode = 1)
 * 2. Unicode -> FML Series (mode = 0)
 * 3. ML / FML Series -> Unicode (ML_Unicode)
 * 4. Malayalam Unicode -> Manglish (ml2en)
 */

import { correctNewChillu } from './keyboardLayouts';

function Unicode_FML(l: string): string {
  return l === 'ം'
    ? 'w+=+'
    : l === 'ഠഃ'
    ? 'x+=+'
    : l === 'അ'
    ? 'A+=+'
    : l === 'ആ'
    ? 'B+=+'
    : l === 'ഇ'
    ? 'C+=+'
    : l === 'ഈ'
    ? 'Cu+=+'
    : l === 'ഉ'
    ? 'D+=+'
    : l === 'ഊ'
    ? 'Du+=+'
    : l === 'ഋ'
    ? 'E+=+'
    : l === 'ഌ'
    ? 'f+=+'
    : l === 'എ'
    ? 'F+=+'
    : l === 'ഏ'
    ? 'G+=+'
    : l === 'ഐ'
    ? 'sF+=+'
    : l === 'ഒ'
    ? 'H+=+'
    : l === 'ഓ'
    ? 'Hm+=+'
    : l === 'ഔ'
    ? 'Hu+=+'
    : l === 'ക'
    ? 'I+=+'
    : l === 'ഖ'
    ? 'J+=+'
    : l === 'ഗ'
    ? 'K+=+'
    : l === 'ഘ'
    ? 'L+=+'
    : l === 'ങ'
    ? 'M+=+'
    : l === 'ച'
    ? 'N+=+'
    : l === 'ഛ'
    ? 'O+=+'
    : l === 'ജ'
    ? 'P+=+'
    : l === 'ഝ'
    ? 'Q+=+'
    : l === 'ഞ'
    ? 'R+=+'
    : l === 'ട'
    ? 'S+=+'
    : l === 'ഠ'
    ? 'T+=+'
    : l === 'ഡ'
    ? 'U+=+'
    : l === 'ഢ'
    ? 'V+=+'
    : l === 'ണ'
    ? 'W+=+'
    : l === 'ത'
    ? 'X+=+'
    : l === 'ഥ'
    ? 'Y+=+'
    : l === 'ദ'
    ? 'Z+=+'
    : l === 'ധ'
    ? '[+=+'
    : l === 'ന'
    ? '\\+=+'
    : l === 'പ'
    ? ']+=+'
    : l === 'ഫ'
    ? '^+=+'
    : l === 'ബ'
    ? '_+=+'
    : l === 'ഭ'
    ? '`+=+'
    : l === 'മ'
    ? 'a+=+'
    : l === 'യ'
    ? 'b+=+'
    : l === 'ര'
    ? 'c+=+'
    : l === 'റ'
    ? 'd+=+'
    : l === 'ല'
    ? 'e+=+'
    : l === 'ള'
    ? 'f+=+'
    : l === 'ഴ'
    ? 'g+=+'
    : l === 'വ'
    ? 'h+=+'
    : l === 'ശ'
    ? 'i+=+'
    : l === 'ഷ'
    ? 'j+=+'
    : l === 'സ'
    ? 'k'
    : l === 'ഹ'
    ? 'l+=+'
    : l === 'ാ'
    ? 'm+=+'
    : l === 'ി'
    ? 'n+=+'
    : l === 'ീ'
    ? 'o+=+'
    : l === 'ു'
    ? 'p+=+'
    : l === 'ൂ'
    ? 'q+=+'
    : l === 'ൃ' || l === 'ൄ'
    ? 'r+=+'
    : l === 'െ'
    ? 's'
    : l === 'േ'
    ? 't'
    : l === 'ൈ'
    ? '!!ss!!'
    : l === 'ൊ'
    ? 'sm'
    : l === 'ോ'
    ? 'tm'
    : l === 'ൌ'
    ? 'su'
    : l === '്'
    ? 'v'
    : l === 'ൗ'
    ? 'u+=+'
    : l === 'ൺ'
    ? '¬+=+'
    : l === 'ൻ'
    ? '³+=+'
    : l === 'ർ'
    ? 'À+=+'
    : l === 'ൽ'
    ? 'Â+=+'
    : l === 'ൾ'
    ? 'Ä+=+'
    : l.charCodeAt(0) === 8204
    ? ''
    : '!^_^!' + l + '!^_^!';
}

function MLRendering1(l: string, e: number): string {
  l = l
    .replaceAll('I+=+vI', '¡')
    .replaceAll('I+=+ve', '¢')
    .replaceAll('I+=+vj', '£')
    .replaceAll('K+=+vK', '¤')
    .replaceAll('K+=+ve', '¥')
    .replaceAll('M+=+vI', '¦')
    .replaceAll('M+=+vM', '§')
    .replaceAll('N+=+vN', '¨')
    .replaceAll('R+=+vN', '©')
    .replaceAll('R+=+vR', 'ª')
    .replaceAll('S+=+vS', '«');
  if (e === 1) {
    l = l.replaceAll('W+=+vS', '­');
  } else if (e === 0) {
    l = l.replaceAll('W+=+vS', 'ï');
  }
  return l
    .replaceAll('W+=+vW', '®')
    .replaceAll('X+=+vX', '¯')
    .replaceAll('X+=+vY', '°')
    .replaceAll('Z+=+vZ', '±')
    .replaceAll('Z+=+v[', '²')
    .replaceAll('\\+=+vX', '´')
    .replaceAll('\\+=+vZ', 'µ')
    .replaceAll('\\+=+v\\', '¶')
    .replaceAll('\\+=+va', '·')
    .replaceAll(']+=v]', '¸')
    .replaceAll(']+=ve', '¹')
    .replaceAll('_+=+v_', 'º')
    .replaceAll('_+=+ve', '»')
    .replaceAll('a+=+v]', '¼')
    .replaceAll('a+=+va', '½')
    .replaceAll('a+=+ve', '¾')
    .replaceAll('b+=+vb', '¿')
    .replaceAll('d+=+vd', 'Á')
    .replaceAll('e+=+ve', 'Ã')
    .replaceAll('f+=+vf', 'Å')
    .replaceAll('h+=+vh', 'Æ')
    .replaceAll('i+=+ve', 'Ç')
    .replaceAll('i+=+vi', 'È')
    .replaceAll('k+=+ve', 'É')
    .replaceAll('k+=+vk', 'Ê')
    .replaceAll('l+=+ve', 'Ë')
    .replaceAll('k+=+vä', 'Ì')
    .replaceAll('U+=+vU', 'Í')
    .replaceAll('I+=+vS', 'Î')
    .replaceAll('_+=+v[', 'Ï')
    .replaceAll('_+=+vZ', 'Ð')
    .replaceAll('N+=+vO', 'Ñ')
    .replaceAll('l+=+va', 'Ò')
    .replaceAll('l+=+v\\', 'Ó')
    .replaceAll('\\+=+v[', 'Ô')
    .replaceAll('X+=+vk', 'Õ')
    .replaceAll('P+=+vP', 'Ö')
    .replaceAll('W+=+va', '×')
    .replaceAll('k+=+vY', 'Ø')
    .replaceAll('\\+=+vY', 'Ù')
    .replaceAll('P+=+vR', 'Ú')
    .replaceAll('X+=+v`', 'Û')
    .replaceAll('K+=+va', 'Ü')
    .replaceAll('i+=+vN', 'Ý')
    .replaceAll('W+=+v[', 'Þ')
    .replaceAll('X+=+va', 'ß')
    .replaceAll('I+=+vX', 'à')
    .replaceAll('K+=+v\\', 'á')
    .replaceAll('³+=+vd', 'â')
    .replaceAll('j+=+vS', 'ã')
    .replaceAll('d+=+vd', 'ä')
    .replaceAll('e+=+v]', 'ev]')
    .replaceAll('kvk', 'Ê');
}

function MLRendering2(l: string): string {
  return l.replaceAll('vb', 'y').replaceAll('vh', 'z');
}

function MLRendering3(l: string): string {
  for (;;) {
    const e = l.indexOf('+=+t');
    if (e < 1) break;
    const r = l.substring(0, e - 1);
    const c = l.substring(e + 4);
    l = r + '-t' + l.substring(e - 1, e) + c;
  }
  return l;
}

function MLRendering4(l: string): string {
  for (;;) {
    const e = l.indexOf('+=+s');
    if (e < 1) break;
    const r = l.substring(0, e - 1);
    const c = l.substring(e + 4);
    l = r + '-s' + l.substring(e - 1, e) + c;
  }
  return l;
}

const VC_CHARS = [
  'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '[', '\\', ']', '^', '_', '`',
  'a', 'b', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l',
  '¡', '¢', '£', '¤', '¥', '¦', '§', '¨', '©', 'ª', '«', '¬', '­', '®', '¯', '°', '±', '²', '³', '´', 'µ', '¶', '·', '¸', '¹', 'º', '»', '¼', '½', '¾', '¿',
  'À', 'Á', 'Â', 'Ã', 'Ä', 'Å', 'Æ', 'Ç', 'È', 'É', 'Ê', 'Ë', 'Ì', 'Í', 'Î', 'Ï', 'Ð', 'Ñ', 'Ò', 'Ó', 'Ô', 'Õ', 'Ö', '×', 'Ø', 'Ù', 'Ú', 'Û', 'Ü', 'Ý', 'Þ', 'ß', 'à', 'á', 'ã', 'å',
];

function MLRendering5(l: string): string {
  for (const ch of VC_CHARS) {
    l = l.replaceAll(`${ch}+=+vc`, `{${ch}`);
  }
  return l;
}

function MLRendering6(l: string): string {
  return l
    .replaceAll('+=+m', 'm')
    .replaceAll('+=+w', 'w')
    .replaceAll('Á', 'ä')
    .replaceAll('+=+n', 'n')
    .replaceAll('+=+o', 'o')
    .replaceAll('+=+p', 'p')
    .replaceAll('+=+q', 'q')
    .replaceAll('+=+r', 'r')
    .replaceAll('+=+y', 'y')
    .replaceAll('+=+v', 'v')
    .replaceAll('\\v-sd', 'sâ')
    .replaceAll('\\vd', 'â')
    .replaceAll('tu', 'ut')
    .replaceAll('su', 'us');
}

function MLRendering7(l: string): string {
  for (;;) {
    const e = l.indexOf('v-sc');
    if (e < 1) break;
    l = l.substring(0, e - 1) + '-s{' + l.substring(e - 1, e) + l.substring(e + 4);
  }
  return l;
}

function MLRendering8(l: string): string {
  for (;;) {
    const e = l.indexOf('v-tc');
    if (e < 1) break;
    l = l.substring(0, e - 1) + '-t{' + l.substring(e - 1, e) + l.substring(e + 4);
  }
  return l;
}

function MLRendering9(l: string): string {
  for (;;) {
    const e = l.indexOf('+=+-tz');
    if (e < 1) break;
    l = l.substring(0, e - 1) + '-t' + l.substring(e - 1, e) + 'z' + l.substring(e + 6);
  }
  return l;
}

function MLRendering10(l: string): string {
  for (;;) {
    const e = l.indexOf('+=+-sz');
    if (e < 1) break;
    l = l.substring(0, e - 1) + '-s' + l.substring(e - 1, e) + 'z' + l.substring(e + 6);
  }
  return l;
}

function MLRendering11(l: string): string {
  for (;;) {
    const e = l.indexOf('+=+-sy');
    if (e < 1) break;
    l = l.substring(0, e - 1) + '-s' + l.substring(e - 1, e) + 'y' + l.substring(e + 6);
  }
  return l;
}

function MLRendering12(l: string): string {
  for (;;) {
    const e = l.indexOf('+=+-ty');
    if (e < 1) break;
    l = l.substring(0, e - 1) + '-t' + l.substring(e - 1, e) + 'y' + l.substring(e + 6);
  }
  return l;
}

function MLRendering13(l: string): string {
  for (;;) {
    const e = l.indexOf('+=+!!ss!!');
    if (e < 1) break;
    l = l.substring(0, e - 1) + '-ss' + l.substring(e - 1, e) + l.substring(e + 9);
  }
  return l;
}

function MLRendering14(l: string): string {
  for (;;) {
    const e = l.indexOf('{-ss');
    if (e < 1) break;
    const r = l.substring(0, e - 1);
    l = r + '!-ss{' + l.substring(e + 4);
  }
  return l;
}

function correctEnglish(l: string): string {
  return l
    .replaceAll('kt', 'tk')
    .replaceAll('ks', 'sk')
    .replaceAll('^ve', '^vf')
    .replaceAll('+=+', '-')
    .replaceAll('!^_^!', '')
    .replaceAll('^_^', '')
    .replaceAll('kvc', '{k')
    .replaceAll('k!!ss!!', 'ssk')
    .replaceAll('{!!ss!!', 'ss{')
    .replaceAll('{ss', 'ss{');
}

/**
 * Convert Malayalam Unicode string to ML Series (mode = 1) or FML Series (mode = 0)
 * Conversion routine
 */
export function unicodeToMlFml(input: string, mode: 0 | 1): string {
  const normalized = correctNewChillu(input);
  let c = '';
  for (let a = 0; a < normalized.length; a++) {
    c += Unicode_FML(normalized.substring(a, a + 1));
  }
  c = MLRendering1(c, mode);
  c = MLRendering2(c);
  c = MLRendering3(c);
  c = MLRendering4(c);
  c = MLRendering5(c);
  c = MLRendering6(c);
  c = MLRendering7(c);
  c = MLRendering8(c);
  c = MLRendering9(c);
  c = MLRendering10(c);
  c = MLRendering11(c);
  c = MLRendering12(c);
  c = MLRendering13(c);
  c = MLRendering14(c);
  return correctEnglish(c);
}

function FML_Unicode(r: string): string {
  const map: Record<string, string> = {
    '-': '',
    A: 'അ',
    B: 'ആ',
    C: 'ഇ',
    D: 'ഉ',
    E: 'ഋ',
    F: 'എ',
    G: 'ഏ',
    H: 'ഒ',
    I: 'ക',
    J: 'ഖ',
    K: 'ഗ',
    L: 'ഘ',
    M: 'ങ',
    N: 'ച',
    O: 'ഛ',
    P: 'ജ',
    Q: 'ഝ',
    R: 'ഞ',
    S: 'ട',
    T: 'ഠ',
    U: 'ഡ',
    V: 'ഢ',
    W: 'ണ',
    X: 'ത',
    Y: 'ഥ',
    Z: 'ദ',
    '[': 'ധ',
    '\\': 'ന',
    ']': 'പ',
    '^': 'ഫ',
    _: 'ബ',
    '`': 'ഭ',
    a: 'മ',
    b: 'യ',
    c: 'ര',
    d: 'റ',
    e: 'ല',
    f: 'ള',
    g: 'ഴ',
    h: 'വ',
    i: 'ശ',
    j: 'ഷ',
    k: 'സ',
    l: 'ഹ',
    m: 'ാ',
    n: 'ി',
    o: 'ീ',
    p: 'ു',
    q: 'ൂ',
    r: 'ൃ',
    s: 'െ',
    t: 'േ',
    u: 'ൗ',
    v: '്',
    w: 'ം',
    x: 'ഃ',
    y: '്യ',
    z: '്വ',
    '{': '്ര',
    '|': '്യു',
    '}': '്യൂ',
    '¡': 'ക്ക',
    '¢': 'ക്ല',
    '£': 'ക്ഷ',
    '¤': 'ഗ്ഗ',
    '¥': 'ഗ്ല',
    '¦': 'ങ്ക',
    '§': 'ങ്ങ',
    '¨': 'ച്ച',
    '©': 'ഞ്ച',
    'ª': 'ഞ്ഞ',
    '«': 'ട്ട',
    '¬': 'ൺ',
    '­': 'ണ്ട',
    ï: 'ണ്ട',
    '®': 'ണ്ണ',
    '¯': 'ത്ത',
    '°': 'ത്ഥ',
    '±': 'ദ്ദ',
    '²': 'ദ്ധ',
    '³': 'ൻ',
    '´': 'ന്ത',
    µ: 'ന്ദ',
    '¶': 'ന്ന',
    '·': 'ന്മ',
    '¸': 'പ്പ',
    '¹': 'പ്ല',
    º: 'ബ്ബ',
    '»': 'ബ്ല',
    '¼': 'മ്പ',
    '½': 'മ്മ',
    '¾': 'മ്ല',
    '¿': 'യ്യ',
    À: 'ർ',
    Á: 'റ്റ',
    Â: 'ൽ',
    Ã: 'ല്ല',
    Ä: 'ൾ',
    Å: 'ള്ള',
    Æ: 'വ്വ',
    Ç: 'ശ്ല',
    È: 'ശ്ശ',
    É: 'സ്ല',
    Ê: 'സ്സ',
    Ë: 'ഹ്ല',
    Ì: 'സ്റ്റ',
    Í: 'ഡ്ഡ',
    Î: 'ക്ട',
    Ï: 'ബ്ധ',
    Ð: 'ബ്ദ',
    Ñ: 'ച്ഛ',
    Ò: 'ഹ്മ',
    Ó: 'ഹ്ന',
    Ô: 'ന്ധ',
    Õ: 'ത്സ',
    Ö: 'ജ്ജ',
    '×': 'ണ്മ',
    Ø: 'സ്ഥ',
    Ù: 'ന്ഥ',
    Ú: 'ജ്ഞ',
    Û: 'ത്ഭ',
    Ü: 'ഗ്മ',
    Ý: 'ശ്ച',
    Þ: 'ണ്ഡ',
    ß: 'ത്മ',
    à: 'ക്ത',
    á: 'ഗ്ന',
    â: 'ന്റ',
    ã: 'ഷ്ട',
    ä: 'റ്റ',
    å: 'ല്പ',
    æ: 'കു',
    ç: 'ക്കു',
    è: 'ങ്കു',
    é: 'ണു',
    ê: 'രു',
    ë: 'നു',
    ì: 'ന്നു',
    í: 'യ്ക്ക',
    þ: '-',
  };
  return r in map ? map[r] : r;
}

function correctRendering1(r: string): string {
  for (;;) {
    const e = r.indexOf('t');
    if (e < 0) break;
    r = r.substring(0, e) + r.substring(e + 1, e + 2) + '^_^' + r.substring(e + 2);
  }
  return r;
}

function correctRendering2(r: string): string {
  for (;;) {
    const e = r.indexOf('s');
    if (e < 0) break;
    r = r.substring(0, e) + r.substring(e + 1, e + 2) + '^_^' + r.substring(e + 2);
  }
  return r;
}

function correctRendering3(r: string): string {
  for (;;) {
    const e = r.indexOf('{');
    if (e < 0) break;
    r = r.substring(0, e) + r.substring(e + 1, e + 2) + '^_^' + r.substring(e + 2);
  }
  return r;
}

function correctRendering4(r: string): string {
  for (;;) {
    const e = r.indexOf('െെ');
    if (e < 0) break;
    r = r.substring(0, e) + r.substring(e + 2, e + 3) + 'ൈ' + r.substring(e + 3);
  }
  return r;
}

function correctRendering5(r: string): string {
  for (;;) {
    const e = r.indexOf('s{');
    if (e < 0) break;
    r = r.substring(0, e - 1) + r.substring(e - 1, e) + '{s' + r.substring(e + 2);
  }
  return r;
}

function correctRendering6(r: string): string {
  for (;;) {
    const e = r.indexOf('t{');
    if (e < 0) break;
    r = r.substring(0, e - 1) + r.substring(e - 1, e) + '{t' + r.substring(e + 2);
  }
  return r;
}

function correctRendering7(r: string): string {
  for (;;) {
    const e = r.indexOf('sz');
    if (e < 0) break;
    r = r.substring(0, e - 1) + r.substring(e - 1, e) + 'zs' + r.substring(e + 2);
  }
  return r;
}

function correctRendering8(r: string): string {
  for (;;) {
    const e = r.indexOf('tz');
    if (e < 0) break;
    r = r.substring(0, e - 1) + r.substring(e - 1, e) + 'zt' + r.substring(e + 2);
  }
  return r;
}

function correctRendering9(r: string): string {
  for (;;) {
    const e = r.indexOf('sy');
    if (e < 0) break;
    r = r.substring(0, e - 1) + r.substring(e - 1, e) + 'ys' + r.substring(e + 2);
  }
  return r;
}

function correctRendering10(r: string): string {
  for (;;) {
    const e = r.indexOf('ty');
    if (e < 0) break;
    r = r.substring(0, e - 1) + r.substring(e - 1, e) + 'yt' + r.substring(e + 2);
  }
  return r;
}

/**
 * Convert ASCII ML / FML Series text back into Malayalam Unicode
 * Legacy to Unicode routine
 */
export function mlFmlToUnicode(input: string): string {
  let r = input.replaceAll('-', '').replaceAll('ss', '-s-s-');
  r = correctRendering3(r).replaceAll('^_^', '{');
  r = correctRendering1(r).replaceAll('^_^', 't');
  r = correctRendering2(r).replaceAll('^_^', 's');
  r = correctRendering5(r);
  r = correctRendering6(r);
  r = correctRendering7(r);
  r = correctRendering8(r);
  r = correctRendering9(r);
  r = correctRendering10(r);

  let n = '';
  for (let t = 0; t < r.length; t++) {
    n += FML_Unicode(r.substring(t, t + 1));
  }
  return correctRendering4(n);
}

/**
 * Convert Malayalam Unicode text into phonetic Manglish (English script)
 * Malayalam to Manglish routine
 */
export function malayalamToManglish(input: string): string {
  const o: Record<string, string> = {
    അ: 'a',
    ആ: 'aa',
    ഇ: 'i',
    ഈ: 'ee',
    ഉ: 'u',
    ഊ: 'oo',
    ഋ: 'ru',
    എ: 'e',
    ഏ: 'e',
    ഐ: 'ai',
    ഒ: 'o',
    ഓ: 'o',
    ഔ: 'au',
  };
  const h: Record<string, string> = {
    ക്ക: 'kk',
    ഗ്ഗ: 'gg',
    ങ്ങ: 'ng',
    ച്ച: 'cch',
    ജ്ജ: 'jj',
    ഞ്ഞ: 'nj',
    ട്ട: 'tt',
    ണ്ണ: 'nn',
    ത്ത: 'tth',
    ദ്ദ: 'ddh',
    ദ്ധ: 'ddh',
    ന്ന: 'nn',
    ന്ത: 'nth',
    ങ്ക: 'nk',
    ണ്ട: 'nd',
    ബ്ബ: 'bb',
    പ്പ: 'pp',
    മ്മ: 'mm',
    യ്യ: 'yy',
    ല്ല: 'll',
    വ്വ: 'vv',
    ശ്ശ: 'sh',
    സ്സ: 's',
    ക്സ: 'ks',
    ഞ്ച: 'nch',
    ക്ഷ: 'ksh',
    മ്പ: 'mp',
    റ്റ: 'tt',
    ന്റ: 'nt',
    ന്ത്യ: 'nthy',
  };
  const g: Record<string, string> = {
    ക: 'k',
    ഖ: 'kh',
    ഗ: 'g',
    ഘ: 'gh',
    ങ: 'ng',
    ച: 'ch',
    ഛ: 'chh',
    ജ: 'j',
    ഝ: 'jh',
    ഞ: 'nj',
    ട: 't',
    ഠ: 'dt',
    ഡ: 'd',
    ഢ: 'dd',
    ണ: 'n',
    ത: 'th',
    ഥ: 'th',
    ദ: 'd',
    ധ: 'dh',
    ന: 'n',
    പ: 'p',
    ഫ: 'ph',
    ബ: 'b',
    ഭ: 'bh',
    മ: 'm',
    യ: 'y',
    ര: 'r',
    ല: 'l',
    വ: 'v',
    ശ: 'sh',
    ഷ: 'sh',
    സ: 's',
    ഹ: 'h',
    ള: 'l',
    ഴ: 'zh',
    റ: 'r',
  };
  const t: Record<string, string> = {
    ൽ: 'l',
    ൾ: 'l',
    ൺ: 'n',
    ൻ: 'n',
    ർ: 'r',
    ൿ: 'k',
  };
  const c: Record<string, string> = {
    'ു്': 'u',
    'ാ': 'aa',
    'ി': 'i',
    'ീ': 'ee',
    'ു': 'u',
    'ൂ': 'oo',
    'ൃ': 'ru',
    'െ': 'e',
    'േ': 'e',
    'ൈ': 'y',
    'ൊ': 'o',
    'ോ': 'o',
    'ൌ': 'ou',
    'ൗ': 'au',
    'ഃ': 'a',
  };

  function replaceWithVowelSigns(map: Record<string, string>, str: string): string {
    const keys = Object.keys(map);
    const vowelKeys = Object.keys(c);
    const regex = new RegExp(`(${keys.join('|')})(${vowelKeys.join('|')})`, 'g');
    return str.replace(regex, (_match, k1, k2) => (map[k1] || k1) + (c[k2] || k2));
  }

  let e = correctNewChillu(input).replace(/[\u200B-\u200D\uFEFF]/g, '');
  e = replaceWithVowelSigns(h, e);
  e = replaceWithVowelSigns(o, e);
  e = replaceWithVowelSigns(g, e);

  for (const n of Object.keys(h)) {
    const r = h[n];
    e = e
      .replace(new RegExp(n + '്([\\w])', 'g'), r + '$1')
      .replace(new RegExp(n + '്', 'g'), r + 'u')
      .replace(new RegExp(n, 'g'), r + 'a');
  }
  for (const n of Object.keys(g)) {
    const r = g[n];
    e = e.replace(new RegExp(n + '(?!്)', 'g'), r + 'a');
  }
  for (const n of Object.keys(g)) {
    const r = g[n];
    e = e.replace(new RegExp(n + '്(?![\\s).;,"\'/\\%!])', 'ig'), r);
  }
  for (const n of Object.keys(g)) {
    const r = g[n];
    e = e.replace(new RegExp(n + '്', 'g'), r + 'u');
  }
  for (const n of Object.keys(g)) {
    const r = g[n];
    e = e.replace(new RegExp(n, 'g'), r);
  }
  for (const n of Object.keys(o)) {
    const r = o[n];
    e = e.replace(new RegExp(n, 'g'), r);
  }
  for (const n of Object.keys(t)) {
    const r = t[n];
    e = e.replace(new RegExp(n, 'g'), r);
  }
  e = e.replace(/ം/g, 'm');
  for (const n of Object.keys(c)) {
    const r = c[n];
    e = e.replace(new RegExp(n, 'g'), r);
  }
  return e.replace(/(^\s*\w|[.!?]\s*\w)/g, (ch) => ch.toUpperCase());
}
