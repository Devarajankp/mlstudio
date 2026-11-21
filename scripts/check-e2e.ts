import { readFileSync } from 'fs';
import { unicodeToLegacy, legacyToUnicode, canonicalizeUnicode } from '../src/lib/legacy';
const r = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const conv = (s: string, series: 'ml' | 'fml') => s.split(' ').map((w) => (w ? unicodeToLegacy(w, series) : w)).join(' ');
let bad = 0, total = 0;
for (const layout of Object.keys(r.layouts)) {
  const L = r.layouts[layout];
  const words: string[] = L.unicode.words;
  const expectUni = words.map((w) => canonicalizeUnicode(w)).join(' ') + ' ';
  const gotUni = canonicalizeUnicode(L.unicode.final);
  total++;
  if (gotUni !== expectUni) { bad++; console.log(`✗ ${layout}/unicode typed text differs from the intended words`); const g = gotUni.split(' '), e = expectUni.split(' '); e.forEach((w, i) => w !== g[i] && console.log(`    want ${w}  got ${g[i]}`)); }
  else console.log(`✓ ${layout}/unicode  typed all ${words.length} words exactly`);
  for (const s of ['ml', 'fml'] as const) {
    total++;
    const want = conv(gotUni, s), got = L[s].final;
    if (want === got) console.log(`✓ ${layout}/${s.padEnd(3)}  stored as ${s.toUpperCase()} codes, identical to converting the Unicode result`);
    else {
      bad++; console.log(`✗ ${layout}/${s}  legacy text differs`);
      const g = got.split(' '), w = want.split(' ');
      w.forEach((x: string, i: number) => x !== g[i] && console.log(`    word ${words[i]}: want ${JSON.stringify(x)}  got ${JSON.stringify(g[i])}  (back-converted: ${legacyToUnicode(g[i] || '')})`));
    }
  }
}
const first = r.layouts.inscript.unicode.words[0] as string;
const chars = Array.from(first);
const exp = [first, chars.slice(0, -1).join(''), chars.slice(0, -2).join('')].map((u) => unicodeToLegacy(u, 'ml'));
console.log('\nbackspace in legacy word:', r.backspace.map((x: string) => legacyToUnicode(x)).join('  →  '), '  (expected', [first, chars.slice(0, -1).join(''), chars.slice(0, -2).join('')].join(' → ') + ')');
console.log('backspace exact legacy match:', JSON.stringify(r.backspace) === JSON.stringify(exp));
console.log('manglish→legacy "amma" stored as', JSON.stringify(r.manglishLegacy), '→ reads back as', legacyToUnicode(r.manglishLegacy.trim()));
console.log(`\n${total - bad}/${total} layout×font combinations correct`);
