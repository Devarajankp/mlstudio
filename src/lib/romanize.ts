/** Unicode Malayalam → simple English-letter ("Manglish") text. Original, rule-based and intentionally plain. */
const IND: Record<string, string> = { അ: 'a', ആ: 'aa', ഇ: 'i', ഈ: 'ee', ഉ: 'u', ഊ: 'oo', ഋ: 'ru', എ: 'e', ഏ: 'ee', ഐ: 'ai', ഒ: 'o', ഓ: 'oo', ഔ: 'au' };
const CON: Record<string, string> = {
  ക: 'k', ഖ: 'kh', ഗ: 'g', ഘ: 'gh', ങ: 'ng', ച: 'ch', ഛ: 'chh', ജ: 'j', ഝ: 'jh', ഞ: 'nj', ട: 't', ഠ: 'th', ഡ: 'd', ഢ: 'dh',
  ണ: 'n', ത: 'th', ഥ: 'th', ദ: 'd', ധ: 'dh', ന: 'n', പ: 'p', ഫ: 'f', ബ: 'b', ഭ: 'bh', മ: 'm', യ: 'y', ര: 'r', റ: 'r',
  ല: 'l', ള: 'l', ഴ: 'zh', വ: 'v', ശ: 'sh', ഷ: 'sh', സ: 's', ഹ: 'h',
};
const SIGN: Record<string, string> = { 'ാ': 'aa', 'ി': 'i', 'ീ': 'ee', 'ു': 'u', 'ൂ': 'oo', 'ൃ': 'ru', 'െ': 'e', 'േ': 'ee', 'ൈ': 'ai', 'ൊ': 'o', 'ോ': 'oo', 'ൌ': 'au', 'ൗ': 'au' };
const CHILLU: Record<string, string> = { 'ൺ': 'n', 'ൻ': 'n', 'ർ': 'r', 'ൽ': 'l', 'ൾ': 'l', 'ൿ': 'k' };

export function malayalamToManglish(input: string): string {
  const s = input.replace(/‌|‍/g, '');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (CON[c]) {
      out += CON[c];
      const n = s[i + 1];
      if (n === '്') { i++; continue; } // consonant cluster: no vowel
      if (n && SIGN[n]) { out += SIGN[n]; i++; continue; }
      out += 'a';
    } else if (IND[c]) out += IND[c];
    else if (CHILLU[c]) out += CHILLU[c];
    else if (c === 'ം') out += 'm';
    else if (c === 'ഃ') out += 'h';
    else if (c === '്') continue;
    else out += c;
  }
  return out;
}
