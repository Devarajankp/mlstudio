/**
 * Manglish (English -> Malayalam) Transliteration & Dictionary Engine
 * Combines:
 * 1. Live Google Input Tools API (`ml-t-i0-und`) for multi-candidate Malayalam transliteration suggestions
 * 2. Offline Mozhi / Varnam phonetic Malayalam transliteration engine as instant zero-latency fallback
 * 3. English <-> Malayalam Dictionary (Olam vocabulary + live dictionary lookup)
 */

export const COMMON_MANGLISH_WORDS: Record<string, string[]> = {
  namaskaram: ['നമസ്കാരം', 'നമസ്‌കാരം', 'നമസ്ക്കാരം'],
  malayalam: ['മലയാളം', 'മലയാള', 'മലയാളത്തിൽ'],
  keralam: ['കേരളം', 'കേരള', 'കേരളത്തിൽ'],
  kerala: ['കേരള', 'കേരളം', 'കേരളത്തിൽ'],
  enthu: ['എന്ത്', 'എന്തു'],
  entha: ['എന്താ', 'എന്താണ്'],
  evide: ['എവിടെ', 'എവിടെയാണ്'],
  engane: ['എങ്ങനെ', 'എങ്ങനെയാണ്'],
  eppol: ['എപ്പോൾ', 'എപ്പോഴാണ്'],
  sukhamano: ['സുഖമാണോ', 'സുഖമല്ലേ'],
  sukham: ['സുഖം', 'സുഖമാണ്'],
  nanni: ['നന്ദി', 'നന്നി'],
  sneham: ['സ്നേഹം', 'സ്‌നേഹം'],
  pranayam: ['പ്രണയം', 'പ്രണയ'],
  veedu: ['വീട്', 'വീടു'],
  amma: ['അമ്മ', 'അമ്മേ'],
  achan: ['അച്ഛൻ', 'അച്ചൻ'],
  chechi: ['ചേച്ചി'],
  chetan: ['ചേട്ടൻ'],
  suhruthu: ['സുഹൃത്ത്', 'സുഹൃത്തു'],
  vidyalayam: ['വിദ്യാലയം'],
  pusthakam: ['പുസ്തകം'],
  mazha: ['മഴ'],
  puzha: ['പുഴ'],
  kadal: ['കടൽ'],
  akasham: ['ആകാശം'],
  sooryan: ['സൂര്യൻ'],
  chandran: ['ചന്ദ്രൻ'],
  nakshathram: ['നക്ഷത്രം'],
  bhoomi: ['ഭൂമി'],
  lokam: ['ലോകം'],
  jeevitham: ['ജീവിതം'],
  samayam: ['സമയം'],
  divasam: ['ദിവസം'],
  rathri: ['രാത്രി'],
  ravile: ['രാവിലെ'],
  vaikunneram: ['വൈകുന്നേരം'],
  innu: ['ഇന്ന്'],
  nale: ['നാളെ'],
  innale: ['ഇന്നലെ'],
  ivide: ['ഇവിടെ'],
  avide: ['അവിടെ'],
  njan: ['ഞാൻ'],
  nee: ['നീ'],
  ningal: ['നിങ്ങൾ'],
  avan: ['അവൻ'],
  aval: ['അവൾ'],
  avar: ['അവർ'],
  nammal: ['നമ്മൾ'],
  njammalkku: ['ഞങ്ങൾക്ക്'],
  ente: ['എന്റെ'],
  ninte: ['നിന്റെ'],
  ningalude: ['നിങ്ങളുടെ'],
  avante: ['അവന്റെ'],
  avalude: ['അവളുടെ'],
  avarude: ['അവരുടെ'],
  athe: ['അതെ'],
  alla: ['അല്ല'],
  undu: ['ഉണ്ട്'],
  illa: ['ഇല്ല'],
  venam: ['വേണം'],
  venda: ['വേണ്ട'],
  ariyam: ['അറിയാം'],
  ariyilla: ['അറിയില്ല'],
  varu: ['വരൂ', 'വരു'],
  poku: ['പോകൂ', 'പോകു'],
  irikkuka: ['ഇരിക്കുക'],
  parayuka: ['പറയുക'],
  kelkkuka: ['കേൾക്കുക'],
  ezhuthuka: ['എഴുതുക'],
  vayikkuka: ['വായിക്കുക'],
  padikkuka: ['പഠിക്കുക'],
  joli: ['ജോലി'],
  panam: ['പണം'],
  bhakshanam: ['ഭക്ഷണം'],
  vellam: ['വെള്ളം'],
  chaya: ['ചായ'],
  kappi: ['കാപ്പി'],
  choru: ['ചോറ്'],
  sadhya: ['സദ്യ'],
  onam: ['ഓണം'],
  vishu: ['വിഷു'],
  thiruvananthapuram: ['തിരുവനന്തപുരം'],
  kochi: ['കൊച്ചി'],
  kozhikode: ['കോഴിക്കോട്'],
  thrissur: ['തൃശ്ശൂർ', 'തൃശൂർ'],
  kannur: ['കണ്ണൂർ'],
  kollam: ['കൊല്ലം'],
  alappuzha: ['ആലപ്പുഴ'],
  kottayam: ['കോട്ടയം'],
  idukki: ['ഇടുക്കി'],
  palakkad: ['പാലക്കാട്'],
  malappuram: ['മലപ്പുറം'],
  wayanad: ['വയനാട്'],
  pathanamthitta: ['പത്തനംതിട്ട'],
  kasaragod: ['കാസർഗോഡ്'],
};

const CONSONANT_MAP: [string, string][] = [
  ['ksh', 'ക്ഷ'],
  ['nth', 'ന്ത'],
  ['nch', 'ഞ്ച'],
  ['nj', 'ഞ്ഞ'],
  ['ng', 'ങ്ങ'],
  ['nk', 'ങ്ക'],
  ['nd', 'ണ്ട'],
  ['nt', 'ന്റ'],
  ['mp', 'മ്പ'],
  ['kk', 'ക്ക'],
  ['gg', 'ഗ്ഗ'],
  ['cch', 'ച്ച'],
  ['chh', 'ഛ'],
  ['ch', 'ച'],
  ['jj', 'ജ്ജ'],
  ['jh', 'ഝ'],
  ['tt', 'ട്ട'],
  ['tth', 'ത്ത'],
  ['th', 'ത'],
  ['dh', 'ധ'],
  ['dd', 'ഡ്ഡ'],
  ['nn', 'ന്ന'],
  ['pp', 'പ്പ'],
  ['ph', 'ഫ'],
  ['bb', 'ബ്ബ'],
  ['bh', 'ഭ'],
  ['mm', 'മ്മ'],
  ['yy', 'യ്യ'],
  ['ll', 'ല്ല'],
  ['vv', 'വ്വ'],
  ['sh', 'ഷ'],
  ['ss', 'സ്സ'],
  ['zh', 'ഴ'],
  ['kh', 'ഖ'],
  ['gh', 'ഘ'],
  ['k', 'ക'],
  ['g', 'ഗ'],
  ['j', 'ജ'],
  ['t', 'ട'],
  ['d', 'ദ'],
  ['N', 'ണ'],
  ['n', 'ന'],
  ['p', 'പ'],
  ['f', 'ഫ'],
  ['b', 'ബ'],
  ['m', 'മ'],
  ['y', 'യ'],
  ['r', 'ര'],
  ['R', 'റ'],
  ['L', 'ള'],
  ['l', 'ല'],
  ['v', 'വ'],
  ['w', 'വ'],
  ['S', 'ശ'],
  ['s', 'സ'],
  ['h', 'ഹ'],
];

const VOWELS_STANDALONE: [string, string][] = [
  ['aa', 'ആ'],
  ['ee', 'ഈ'],
  ['oo', 'ഊ'],
  ['ai', 'ഐ'],
  ['au', 'ഔ'],
  ['ou', 'ഔ'],
  ['A', 'ആ'],
  ['I', 'ഈ'],
  ['U', 'ഊ'],
  ['E', 'ഏ'],
  ['O', 'ഓ'],
  ['a', 'അ'],
  ['i', 'ഇ'],
  ['u', 'ഉ'],
  ['e', 'എ'],
  ['o', 'ഒ'],
];

const VOWEL_SIGNS: [string, string][] = [
  ['aa', 'ാ'],
  ['ee', 'ീ'],
  ['oo', 'ൂ'],
  ['ai', 'ൈ'],
  ['au', 'ൗ'],
  ['ou', 'ൗ'],
  ['ru', 'ൃ'],
  ['A', 'ാ'],
  ['I', 'ീ'],
  ['U', 'ൂ'],
  ['E', 'േ'],
  ['O', 'ോ'],
  ['a', ''],
  ['i', 'ി'],
  ['u', 'ു'],
  ['e', 'െ'],
  ['o', 'ൊ'],
];

const CHILLU_ENDINGS: Record<string, string> = {
  n: 'ൻ',
  N: 'ൺ',
  r: 'ർ',
  l: 'ൽ',
  L: 'ൾ',
  m: 'ം',
};

/**
 * Pure client-side Mozhi phonetic Malayalam transliterator (instant fallback)
 */
export function offlinePhoneticTransliterate(word: string): string {
  const clean = word.trim();
  if (!clean) return '';
  const lower = clean.toLowerCase();
  if (COMMON_MANGLISH_WORDS[lower]) {
    return COMMON_MANGLISH_WORDS[lower][0];
  }

  let i = 0;
  let result = '';

  while (i < clean.length) {
    const rem = clean.slice(i);

    // Check word-final chillu or anusvara
    if (rem.length === 1 && rem in CHILLU_ENDINGS && i > 0) {
      result += CHILLU_ENDINGS[rem];
      i += 1;
      continue;
    }

    // Check consonant match
    let matchedConsonant: [string, string] | null = null;
    for (const [en, ml] of CONSONANT_MAP) {
      if (rem.toLowerCase().startsWith(en.toLowerCase())) {
        // Respect case-sensitive N, L, R, S if exact match exists
        if (['N', 'L', 'R', 'S'].includes(en) && !rem.startsWith(en)) {
          continue;
        }
        matchedConsonant = [en, ml];
        break;
      }
    }

    if (matchedConsonant) {
      const [enCons, mlCons] = matchedConsonant;
      i += enCons.length;
      const afterCons = clean.slice(i);

      // Check if followed by y/r/v cluster (e.g. kya, pra, sva)
      let clusterSign = '';
      if (afterCons.startsWith('y') && afterCons.length > 1) {
        clusterSign = '്യ';
        i += 1;
      } else if (afterCons.startsWith('r') && !afterCons.startsWith('ru') && afterCons.length > 1) {
        clusterSign = '്ര';
        i += 1;
      } else if ((afterCons.startsWith('v') || afterCons.startsWith('w')) && afterCons.length > 1) {
        clusterSign = '്വ';
        i += 1;
      }

      const afterCluster = clean.slice(i);
      let matchedVowel: [string, string] | null = null;
      for (const [vEn, vMl] of VOWEL_SIGNS) {
        if (
          (['A', 'I', 'U', 'E', 'O'].includes(vEn) && afterCluster.startsWith(vEn)) ||
          (!['A', 'I', 'U', 'E', 'O'].includes(vEn) &&
            afterCluster.toLowerCase().startsWith(vEn.toLowerCase()))
        ) {
          matchedVowel = [vEn, vMl];
          break;
        }
      }

      if (matchedVowel) {
        i += matchedVowel[0].length;
        result += mlCons + clusterSign + matchedVowel[1];
      } else {
        result += mlCons + clusterSign + '്';
      }
      continue;
    }

    // Check standalone vowel
    let matchedStandaloneVowel: [string, string] | null = null;
    for (const [vEn, vMl] of VOWELS_STANDALONE) {
      if (
        (['A', 'I', 'U', 'E', 'O'].includes(vEn) && rem.startsWith(vEn)) ||
        (!['A', 'I', 'U', 'E', 'O'].includes(vEn) && rem.toLowerCase().startsWith(vEn.toLowerCase()))
      ) {
        matchedStandaloneVowel = [vEn, vMl];
        break;
      }
    }

    if (matchedStandaloneVowel) {
      result += matchedStandaloneVowel[1];
      i += matchedStandaloneVowel[0].length;
      continue;
    }

    // Fallback: pass character as-is
    result += clean[i];
    i += 1;
  }

  return result;
}

const suggestionCache = new Map<string, string[]>();

/**
 * Fetches live Malayalam transliteration candidates from Google Input Tools (`ml-t-i0-und`)
 * with instant fallback to our built-in dictionary + Mozhi phonetic engine.
 */
export async function fetchManglishSuggestions(word: string): Promise<string[]> {
  const clean = word.trim();
  if (!clean) return [];

  if (suggestionCache.has(clean)) {
    return suggestionCache.get(clean)!;
  }

  const localCandidates = COMMON_MANGLISH_WORDS[clean.toLowerCase()] || [];
  const phoneticFallback = offlinePhoneticTransliterate(clean);

  try {
    const url = `https://inputtools.google.com/request?text=${encodeURIComponent(
      clean
    )}&itc=ml-t-i0-und&num=6&cp=0&cs=1&ie=utf-8&oe=utf-8&app=malayalamstudio`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data?.[0] === 'SUCCESS' && Array.isArray(data?.[1]?.[0]?.[1])) {
        const apiCandidates: string[] = data[1][0][1];
        const merged = Array.from(new Set([...apiCandidates, ...localCandidates, phoneticFallback, clean])).filter(Boolean);
        suggestionCache.set(clean, merged);
        return merged;
      }
    }
  } catch {
    // Fallback to offline phonetic transliterator if offline or blocked
  }

  const fallbackList = Array.from(new Set([...localCandidates, phoneticFallback, clean])).filter(Boolean);
  suggestionCache.set(clean, fallbackList);
  return fallbackList;
}

export interface DictionaryEntry {
  word: string;
  partOfSpeech: string;
  meanings: string[];
  examples?: string;
}

export const BUILTIN_DICTIONARY: DictionaryEntry[] = [
  {
    word: 'Love',
    partOfSpeech: 'noun / verb',
    meanings: ['സ്‌നേഹിക്കുക', 'പ്രേമിക്കുക', 'ഇഷ്‌ടപ്പെടുക', 'സ്‌നേഹം', 'പ്രേമം', 'പ്രണയം', 'വാത്സല്യം'],
    examples: 'സ്നേഹം (Sneham) — Affection, Love',
  },
  {
    word: 'Peace',
    partOfSpeech: 'noun',
    meanings: ['സമാധാനം', 'ശാന്തി', 'സ്വസ്ഥത', 'നിശബ്ദത'],
    examples: 'മനസ്സമാധാനം — Peace of mind',
  },
  {
    word: 'Knowledge',
    partOfSpeech: 'noun',
    meanings: ['അറിവ്', 'വിജ്ഞാനം', 'ജ്ഞാനം', 'ബോധം', 'പാണ്ഡിത്യം'],
  },
  {
    word: 'Beautiful',
    partOfSpeech: 'adjective',
    meanings: ['മനോഹരമായ', 'സുന്ദരമായ', 'അഴകുള്ള', 'ഭംഗിയുള്ള'],
  },
  {
    word: 'Friend',
    partOfSpeech: 'noun',
    meanings: ['സുഹൃത്ത്', 'കൂട്ടുകാരൻ', 'ചങ്ങാതി', 'മിത്രം'],
  },
  {
    word: 'Welcome',
    partOfSpeech: 'noun / verb',
    meanings: ['സ്വാഗതം', 'വരിക', 'സ്വീകരിക്കുക'],
  },
  {
    word: 'Gratitude',
    partOfSpeech: 'noun',
    meanings: ['കൃതജ്ഞത', 'നന്ദി', 'ഉപകാരസ്മരണ'],
  },
  {
    word: 'Freedom',
    partOfSpeech: 'noun',
    meanings: ['സ്വാതന്ത്ര്യം', 'മോചനം', 'വിമോചനം'],
  },
  {
    word: 'Nature',
    partOfSpeech: 'noun',
    meanings: ['പ്രകൃതി', 'സ്വഭാവം', 'പ്രകൃതം'],
  },
  {
    word: 'Rain',
    partOfSpeech: 'noun / verb',
    meanings: ['മഴ', 'വർഷം', 'മഴ പെയ്യുക'],
  },
  {
    word: 'Dream',
    partOfSpeech: 'noun / verb',
    meanings: ['സ്വപ്നം', 'കിനാവ്', 'സ്വപ്നം കാണുക'],
  },
  {
    word: 'Truth',
    partOfSpeech: 'noun',
    meanings: ['സത്യം', 'യാഥാർത്ഥ്യം', 'നേര്'],
  },
  {
    word: 'Success',
    partOfSpeech: 'noun',
    meanings: ['വിജയം', 'നേട്ടം', 'സഫലത'],
  },
  {
    word: 'Language',
    partOfSpeech: 'noun',
    meanings: ['ഭാഷ', 'മൊഴി', 'സംസാരരീതി'],
  },
  {
    word: 'Literature',
    partOfSpeech: 'noun',
    meanings: ['സാഹിത്യം', 'ഗ്രന്ഥസമുച്ചയം'],
  },
  {
    word: 'Pencil',
    partOfSpeech: 'noun',
    meanings: ['പെൻസിൽ', 'എഴുത്തുകോൽ'],
  },
  {
    word: 'Education',
    partOfSpeech: 'noun',
    meanings: ['വിദ്യാഭ്യാസം', 'പഠനം', 'ശിക്ഷണം'],
  },
  {
    word: 'Happiness',
    partOfSpeech: 'noun',
    meanings: ['സന്തോഷം', 'ആനന്ദം', 'ആഹ്ലാദം'],
  },
  {
    word: 'Courage',
    partOfSpeech: 'noun',
    meanings: ['ധൈര്യം', 'തന്റേടം', 'വീര്യം'],
  },
  {
    word: 'Time',
    partOfSpeech: 'noun',
    meanings: ['സമയം', 'കാലം', 'നേരം'],
  },
  {
    word: 'Mother',
    partOfSpeech: 'noun',
    meanings: ['അമ്മ', 'മാതാവ്', 'ജനനി'],
  },
  {
    word: 'Father',
    partOfSpeech: 'noun',
    meanings: ['അച്ഛൻ', 'പിതാവ്', 'താതൻ'],
  },
  {
    word: 'Water',
    partOfSpeech: 'noun',
    meanings: ['വെള്ളം', 'ജലം', 'നീര്', 'തീർത്ഥം'],
  },
  {
    word: 'Earth',
    partOfSpeech: 'noun',
    meanings: ['ഭൂമി', 'മണ്ണ്', 'ധരണി', 'ലോകം'],
  },
  {
    word: 'Sky',
    partOfSpeech: 'noun',
    meanings: ['ആകാശം', 'വാനം', 'ഗഗനം'],
  },
];

export const MALAYALAM_QUOTES = [
  {
    quote: 'വാക്കുകൾക്ക് ലോകത്തെ മാറ്റാനുള്ള ശക്തിയുണ്ട്; നല്ല വാക്കുകൾ കൊണ്ട് ഹൃദയങ്ങളെ കീഴടക്കുക.',
    author: 'മലയാളം പഴഞ്ചൊല്ല്',
  },
  {
    quote: 'അറിവ് നേടുക എന്നത് വെളിച്ചത്തിലേക്കുള്ള യാത്രയാണ്.',
    author: 'ശ്രീനാരായണ ഗുരു',
  },
  {
    quote: 'സ്നേഹമാണ് അഖിലസാരമൂഴിയിൽ, സ്നേഹസാരമിഹ സത്യമേകമാം.',
    author: 'കുമാരനാശാൻ',
  },
  {
    quote: 'മലയാള ഭാഷയുടെ തനിമയും സൗന്ദര്യവും നമ്മുടെ അക്ഷരങ്ങളിലാണ് ജീവിക്കുന്നത്.',
    author: 'മലയാളം സ്റ്റുഡിയോ',
  },
];
