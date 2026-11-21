import { readFileSync, readdirSync } from 'fs';
import { normalizeMalayalamKeyboardInput } from '../src/utils/keyboardLayouts';
import { unicodeToLegacy, legacyToUnicode, reconvertWord, canonicalizeUnicode, runToUnicode, unicodeWindows, type LegacySeries } from '../src/lib/legacy';

// Real Malayalam words: every single-word key from a spread of dictionary shards.
const dir = 'public/dict/ml';
const files = readdirSync(dir).sort();
const words = new Set<string>();
for (let i = 0; i < files.length; i += 6) {
  for (const [key] of JSON.parse(readFileSync(`${dir}/${files[i]}`, 'utf8')) as [string, unknown][]) {
    if (/^[ഀ-ൿ]+$/.test(key) && key.length >= 2 && key.length <= 14) words.add(canonicalizeUnicode(key));
  }
}
const list = [...words].map((w) => canonicalizeUnicode(normalizeMalayalamKeyboardInput(w))).filter((w, i, a) => a.indexOf(w) === i).slice(0, 6000);
console.log(`testing ${list.length} real Malayalam words x 2 series`);

const fails: Record<string, string[]> = { roundtrip: [], idempotent: [], typing: [] };
const note = (k: string, w: string, extra: string) => { if (fails[k].length < 8) fails[k].push(`${w} ${extra}`); };
const count: Record<string, number> = { roundtrip: 0, idempotent: 0, typing: 0 };

for (const w of list) {
  for (const s of ['ml', 'fml'] as LegacySeries[]) {
    const leg = unicodeToLegacy(w, s);
    // 1. lossless round trip
    const back = legacyToUnicode(leg);
    if (back !== w) { count.roundtrip++; note('roundtrip', w, `[${s}] -> ${back}`); }
    // 2. re-encoding an already-correct word must not change it
    const again = reconvertWord(leg, s);
    if (again !== leg) { count.idempotent++; note('idempotent', w, `[${s}] ${JSON.stringify(leg)} -> ${JSON.stringify(again)}`); }
    // 3. typing it one code point at a time, re-encoding the word after every key (what LegacySync does)
    let state = '';
    for (const ch of Array.from(w)) state = reconvertWord(state + ch, s);
    if (state !== leg) { count.typing++; note('typing', w, `[${s}] typed=${JSON.stringify(state)} expected=${JSON.stringify(leg)}`); }
  }
}
const total = list.length * 2;
for (const k of Object.keys(count)) {
  console.log(`${k.padEnd(11)} ${(total - count[k]).toString().padStart(5)}/${total} ok  (${((100 * (total - count[k])) / total).toFixed(2)}%)`);
  fails[k].forEach((f) => console.log('   ✗', f));
}
// windows helper sanity
const t = 'abc ക് I-p x';
console.log('windows', JSON.stringify(unicodeWindows(t)), '(expect one window covering the 2nd token)');
