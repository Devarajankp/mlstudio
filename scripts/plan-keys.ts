// Builds keystroke plans (key codes + shift) that type real words with a given layout. Used by the browser test.
import { INSCRIPT_MAP, TYPEWRITER_MAP, GIST_MAP, KEYBOARD_MODES, getLayoutMap, type KeyboardMode } from '../src/utils/keyboardLayouts';
import { writeFileSync } from 'fs';
const words = ['കേരളം','മലയാളം','കുട്ടി','പുസ്തകം','കൊച്ചി','ഓർമ്മ','സ്വാതന്ത്ര്യം','ക്ലാസ്','ഗൗരി','ടൈപ്പിംഗ്','കണ്ട','അവന്റെ','ബ്ലോക്ക്','ചെയ്യും','വിദ്യാർത്ഥി','തിരുവനന്തപുരം'];
type Step = { kc: number; shift: boolean };
function inverse(map: Record<number, [string, string]>) {
  const inv = new Map<string, Step>();
  for (const [kc, [n, s]] of Object.entries(map)) { if (n && !inv.has(n)) inv.set(n, { kc: +kc, shift: false }); if (s && !inv.has(s)) inv.set(s, { kc: +kc, shift: true }); }
  return inv;
}
function seqFor(word: string, inv: Map<string, Step>, prefixSigns: boolean): Step[] | null {
  // optional visual-order rewrite for typewriter layouts (prefix signs typed first)
  let w = word;
  if (prefixSigns) {
    w = w.replace(/([ക-ഺ](?:്[ക-ഺ])*)ൊ/g, 'െ$1ാ').replace(/([ക-ഺ](?:്[ക-ഺ])*)ോ/g, 'േ$1ാ')
         .replace(/([ക-ഺ](?:്[ക-ഺ])*)ൌ/g, 'െ$1ൗ').replace(/([ക-ഺ](?:്[ക-ഺ])*)([െേൈ])/g, '$2$1');
  }
  const keys = [...inv.keys()].sort((a, b) => b.length - a.length);
  const out: Step[] = []; let i = 0;
  while (i < w.length) {
    const k = keys.find((x) => x && w.startsWith(x, i));
    if (!k) return null;
    out.push(inv.get(k)!); i += k.length;
  }
  return out;
}
const plan: Record<string, { word: string; seq: Step[] }[]> = {};
for (const [id, prefix] of [['inscript', false], ['gist', false], ['typewriter', true]] as const) {
  const map = getLayoutMap(id as KeyboardMode)!; const inv = inverse(map as any);
  plan[id] = words.flatMap((word) => { const seq = seqFor(word, inv, prefix); return seq ? [{ word, seq }] : []; });
}
const out = { modes: KEYBOARD_MODES.map((m) => ({ id: m.id, shortcut: m.shortcut, name: m.name })), plan };
writeFileSync(process.argv[2], JSON.stringify(out));
console.log(out.modes.map((m) => `${m.shortcut}=${m.id}`).join('  '));
for (const k of Object.keys(plan)) console.log(k, 'typeable words:', plan[k].length + '/' + words.length, plan[k].map((p) => p.word).join(' '));
