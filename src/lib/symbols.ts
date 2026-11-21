/** Symbol sets for the Symbol dialog – built from Unicode ranges so there are thousands of characters. */

export interface SymbolSet {
  id: string;
  label: string;
  chars: string[];
}

const range = (from: number, to: number, skip: (c: string) => boolean = () => false): string[] => {
  const out: string[] = [];
  for (let cp = from; cp <= to; cp++) {
    const ch = String.fromCodePoint(cp);
    if (/\p{Cn}|\p{Cc}|\p{Cs}/u.test(ch) || skip(ch)) continue;
    out.push(ch);
  }
  return out;
};

export const MALAYALAM_SPECIAL = ['ൺ', 'ൻ', 'ർ', 'ൽ', 'ൾ', 'ൿ', '്', 'ം', 'ഃ', 'ഽ', 'ഀ', 'ഁ', '൹', '₹', '൦', '൧', '൨', '൩', '൪', '൫', '൬', '൭', '൮', '൯', '൰', '൱', '൲', '൳', '൴', '൵', '൶', '൷', '൸', '‌', '‍', '“', '”', '‘', '’', '–', '—', '…'];

export const SYMBOL_SETS: SymbolSet[] = [
  { id: 'ml-special', label: 'Malayalam – special', chars: MALAYALAM_SPECIAL },
  { id: 'ml', label: 'Malayalam – all letters & signs', chars: range(0x0d00, 0x0d7f) },
  { id: 'punct', label: 'Punctuation', chars: [...range(0xa1, 0xbf), ...range(0x2010, 0x2027), ...range(0x2030, 0x205e), ...range(0x3001, 0x3003)] },
  { id: 'currency', label: 'Currency', chars: [...'$¢£¤¥₹'.split(''), ...range(0x20a0, 0x20c0)] },
  { id: 'math', label: 'Mathematics', chars: [...'±×÷≠≈≤≥∞√∑∏∫∂∆∇'.split(''), ...range(0x2200, 0x22ff), ...range(0x27c0, 0x27ef)] },
  { id: 'arrows', label: 'Arrows', chars: [...range(0x2190, 0x21ff), ...range(0x27f0, 0x27ff), ...range(0x2900, 0x297f)] },
  { id: 'numbers', label: 'Fractions, super/subscripts, circled', chars: [...range(0x2150, 0x218b), ...range(0x2070, 0x209f), ...range(0xb2, 0xb3), ...range(0x2460, 0x24ff), ...range(0x2776, 0x2793)] },
  { id: 'shapes', label: 'Shapes & boxes', chars: [...range(0x25a0, 0x25ff), ...range(0x2500, 0x257f), ...range(0x2580, 0x259f)] },
  { id: 'misc', label: 'Miscellaneous symbols', chars: range(0x2600, 0x26ff) },
  { id: 'ding', label: 'Dingbats', chars: range(0x2700, 0x27bf) },
  { id: 'tech', label: 'Technical & letterlike', chars: [...range(0x2100, 0x214f), ...range(0x2300, 0x23ff)] },
  { id: 'greek', label: 'Greek', chars: range(0x0370, 0x03ff) },
  { id: 'latin', label: 'Latin accents', chars: [...range(0xc0, 0xff), ...range(0x100, 0x17f)] },
  { id: 'emoji', label: 'Emoji & pictures', chars: [...range(0x1f300, 0x1f5ff), ...range(0x1f600, 0x1f64f), ...range(0x1f680, 0x1f6ff), ...range(0x1f900, 0x1f9ff)] },
];

export const cpLabel = (ch: string): string => 'U+' + ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0');

/** Plain-language name of a character where the browser can tell us (none offline); fall back to the code point. */
export function findSymbols(query: string): string[] {
  const q = query.trim();
  if (!q) return [];
  const hex = q.replace(/^u\+?/i, '').replace(/^0x/i, '');
  if (/^[0-9a-f]{2,6}$/i.test(hex)) {
    try {
      return [String.fromCodePoint(parseInt(hex, 16))];
    } catch {
      return [];
    }
  }
  return Array.from(q);
}
