import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, BookOpen, Copy, CornerDownLeft, History, Search, X } from 'lucide-react';
import {
  isMalayalamQuery,
  searchEnglish,
  searchMalayalam,
  type Direction,
  type EnEntry,
  type MlEntry,
} from '../lib/dictionary';
import { canonicalizeUnicode } from '../lib/legacy';
import { getLayoutMap, normalizeMalayalamKeyboardInput, type KeyboardMode } from '../utils/keyboardLayouts';
import { fetchManglishSuggestions, offlinePhoneticTransliterate } from '../utils/manglishTransliterator';

export interface DictRequest {
  q: string;
  dir: Direction;
  nonce: number;
}

interface Props {
  request: DictRequest | null;
  mode: KeyboardMode;
  /** insert text at the editor caret and switch back to the editor */
  onInsert: (text: string) => void;
  toast: (msg: string) => void;
}

const POS_NAMES: Record<string, string> = {
  n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb', prep: 'preposition', conj: 'conjunction', pron: 'pronoun',
  interj: 'interjection', det: 'determiner', abbr: 'abbreviation', prefix: 'prefix', suffix: 'suffix', num: 'numeral',
};
const posName = (p: string) => (p ? (POS_NAMES[p.toLowerCase()] ?? p) : 'other');
const RECENT_KEY = 'msx-dict-recent';

function loadRecent(): Array<{ q: string; dir: Direction }> {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

export const DictionaryPanel: React.FC<Props> = ({ request, mode, onInsert, toast }) => {
  const [dir, setDir] = useState<Direction>('en-ml');
  const [input, setInput] = useState('');
  const [enMatches, setEnMatches] = useState<EnEntry[]>([]);
  const [mlMatches, setMlMatches] = useState<MlEntry[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [chips, setChips] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState(loadRecent);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastNonce = useRef(-1);

  // lookups requested from the editor (F9 / ribbon button)
  useEffect(() => {
    if (!request || request.nonce === lastNonce.current) return;
    lastNonce.current = request.nonce;
    setDir(request.dir);
    setInput(request.q);
  }, [request]);

  const latinInMl = dir === 'ml-en' && /[A-Za-z]/.test(input) && !isMalayalamQuery(input);

  // debounced search
  useEffect(() => {
    let dead = false;
    const q = input.trim();
    if (!q) {
      setEnMatches([]);
      setMlMatches([]);
      setSelected('');
      setChips([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        if (dir === 'en-ml') {
          const r = await searchEnglish(q);
          if (dead) return;
          setEnMatches(r.matches);
          setSelected(r.exact ? r.exact[0] : (r.matches[0]?.[0] ?? ''));
        } else if (latinInMl) {
          setMlMatches([]);
          setSelected('');
          const first = offlinePhoneticTransliterate(q);
          setChips(first ? [first] : []);
          const more = await fetchManglishSuggestions(q);
          if (!dead) setChips([...new Set([first, ...more].filter((x) => x && /[ഀ-ൿ]/.test(x)))].slice(0, 6));
        } else {
          setChips([]);
          const r = await searchMalayalam(q);
          if (dead) return;
          setMlMatches(r.matches);
          setSelected(r.exact ? r.exact[0] : (r.matches[0]?.[0] ?? ''));
        }
      } finally {
        if (!dead) setLoading(false);
      }
    }, 120);
    return () => {
      dead = true;
      clearTimeout(t);
    };
  }, [input, dir, latinInMl]);

  const remember = (q: string) => {
    const next = [{ q, dir }, ...recent.filter((r) => !(r.q === q && r.dir === dir))].slice(0, 12);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };

  const pick = (key: string) => {
    setSelected(key);
    remember(key);
  };

  const enEntry = useMemo(() => enMatches.find((e) => e[0] === selected) ?? null, [enMatches, selected]);
  const mlEntry = useMemo(() => mlMatches.find((e) => e[0] === selected) ?? null, [mlMatches, selected]);

  const copy = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
      toast('Copied');
    } catch {
      toast('Select the text and press Ctrl+C');
    }
  };

  // Malayalam typing inside the search box (Inscript, GIST, …) when searching Malayalam → English
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (dir !== 'ml-en' || e.ctrlKey || e.metaKey || e.altKey) return;
    const map = getLayoutMap(mode);
    const def = map?.[e.keyCode];
    if (!def) return;
    const ch = e.shiftKey ? def[1] : def[0];
    if (!ch) return;
    e.preventDefault();
    const el = e.currentTarget;
    const s = el.selectionStart ?? el.value.length;
    const t = el.selectionEnd ?? s;
    setInput(canonicalizeUnicode(normalizeMalayalamKeyboardInput(el.value.slice(0, s) + ch + el.value.slice(t))));
    requestAnimationFrame(() => el.setSelectionRange(s + ch.length, s + ch.length));
  };

  const switchDir = () => {
    setDir((d) => (d === 'en-ml' ? 'ml-en' : 'en-ml'));
    setInput('');
    inputRef.current?.focus();
  };

  const groupedEn = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const [pos, ml] of enEntry?.[1] ?? []) m.set(pos, [...(m.get(pos) ?? []), ml]);
    return [...m.entries()];
  }, [enEntry]);

  const noResult = input.trim() && !loading && !latinInMl && (dir === 'en-ml' ? !enMatches.length : !mlMatches.length);
  const list = dir === 'en-ml' ? enMatches.map((e) => e[0]) : mlMatches.map((e) => e[0]);

  return (
    <div className="msx-dict">
      <div className="msx-dict-bar">
        <BookOpen size={20} />
        <h2>Dictionary</h2>
        <div className="msx-dict-dir" role="group" aria-label="Direction">
          <button className={dir === 'en-ml' ? 'is-active' : ''} onClick={() => dir !== 'en-ml' && switchDir()}>English → മലയാളം</button>
          <button className="msx-dict-swap" title="Swap direction" onClick={switchDir}><ArrowLeftRight size={15} /></button>
          <button className={dir === 'ml-en' ? 'is-active' : ''} onClick={() => dir !== 'ml-en' && switchDir()}>മലയാളം → English</button>
        </div>
        <div className="msx-dict-search">
          <Search size={16} />
          <input
            ref={inputRef}
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={dir === 'en-ml' ? 'Type an English word…  e.g. computer' : 'Type a Malayalam word (or in English letters: namaskaram)…'}
            aria-label="Search the dictionary"
            spellCheck={false}
          />
          {input && (
            <button title="Clear" onClick={() => { setInput(''); inputRef.current?.focus(); }}>
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {latinInMl && (
        <div className="msx-dict-chips">
          <span>Searching in English letters? Pick the Malayalam spelling:</span>
          {chips.map((c) => (
            <button key={c} onClick={() => setInput(c)}>{c}</button>
          ))}
          {!chips.length && <i>thinking…</i>}
        </div>
      )}

      <div className="msx-dict-body">
        <div className="msx-dict-list" role="listbox" aria-label="Matches">
          {!input.trim() && recent.filter((r) => r.dir === dir).length > 0 && (
            <>
              <div className="msx-dict-label"><History size={13} /> Recent</div>
              {recent.filter((r) => r.dir === dir).map((r) => (
                <button key={r.q} className="msx-dict-item" onClick={() => setInput(r.q)}>{r.q}</button>
              ))}
            </>
          )}
          {list.map((k) => (
            <button key={k} role="option" aria-selected={k === selected} className={`msx-dict-item${k === selected ? ' is-active' : ''}`} onClick={() => pick(k)}>
              {k}
            </button>
          ))}
          {noResult && <div className="msx-empty">No entry for “{input.trim()}”.{dir === 'en-ml' ? ' Check the spelling or try the start of the word.' : ' Try a shorter spelling — at least 2 letters.'}</div>}
          {dir === 'en-ml' && input.trim().length === 1 && <div className="msx-empty">Type at least 2 letters for suggestions.</div>}
          {loading && <div className="msx-empty">Searching…</div>}
        </div>

        <div className="msx-dict-detail">
          {!input.trim() && !selected && (
            <div className="msx-dict-welcome">
              <BookOpen size={36} />
              <p>Search ~58,000 English words and ~150,000 Malayalam words.</p>
              <p>Select a word in the editor and press <kbd>F9</kbd> to look it up here.</p>
            </div>
          )}

          {enEntry && dir === 'en-ml' && (
            <article>
              <header>
                <h3>{enEntry[0]}</h3>
              </header>
              {groupedEn.map(([pos, defs]) => (
                <section key={pos}>
                  <div className="msx-dict-pos">{posName(pos)}</div>
                  <ul>
                    {defs.map((d, i) => (
                      <li key={i}>
                        <span className="msx-ml">{d}</span>
                        <span className="msx-dict-actions">
                          <button title="Copy" onClick={() => copy(d)}><Copy size={14} /></button>
                          <button title="Insert into document" onClick={() => onInsert(d)}><CornerDownLeft size={14} /> Insert</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </article>
          )}

          {mlEntry && dir === 'ml-en' && (
            <article>
              <header>
                <h3 className="msx-ml">{mlEntry[0]}</h3>
              </header>
              {[0, 1, 2].map((rank) => {
                const items = mlEntry[1].filter((x) => (rank === 0 ? x[2] === 0 : rank === 1 ? x[2] === 1 : x[2] >= 2));
                if (!items.length) return null;
                return (
                  <section key={rank}>
                    <div className="msx-dict-pos">{rank === 0 ? 'Exact translations' : rank === 1 ? 'Close matches' : 'Appears in'}</div>
                    <ul>
                      {items.map(([en, pos], i) => (
                        <li key={i}>
                          <span>
                            {en} {pos && <em>{posName(pos)}</em>}
                          </span>
                          <span className="msx-dict-actions">
                            <button title="Copy" onClick={() => copy(en)}><Copy size={14} /></button>
                            <button title="Insert into document" onClick={() => onInsert(en)}><CornerDownLeft size={14} /> Insert</button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </article>
          )}
        </div>
      </div>

      <footer className="msx-dict-foot">
        Data: <a href="https://olam.in/open/enml/" target="_blank" rel="noreferrer">Olam English–Malayalam dictionary</a> (ODbL 1.0) via{' '}
        <a href="https://github.com/kiranps/English-Malayalam-Dictionary" target="_blank" rel="noreferrer">kiranps/English-Malayalam-Dictionary</a>.
        Malayalam → English is built by reversing the same data.
      </footer>
    </div>
  );
};
