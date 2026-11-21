import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { EditorContent, useEditorState } from '@tiptap/react';
import { ChevronDown, ChevronUp, Replace, X } from 'lucide-react';
import { Ruler, VRuler } from './Ruler';
import { VirtualKeyboard } from './VirtualKeyboard';
import { PX_PER_CM, pageDims, type PageLayout } from '../lib/page';
import { findMatches, replaceMatches, type Match } from '../editor/docTools';
import { insertPlain, legacyBackspace, normalizeAroundCursor, unicodeBeforeCursor } from '../editor/fontCommands';
import { seriesOfMarks } from '../editor/marks';
import { isLegacy } from '../lib/legacy';
import { getLayoutMap, KEYBOARD_MODES, type KeyboardMode } from '../utils/keyboardLayouts';
import { fetchManglishSuggestions, offlinePhoneticTransliterate } from '../utils/manglishTransliterator';
import type { ViewState } from './Ribbon';
import { ObjectFrame } from './ObjectFrame';
import { FloatingToolbar } from './FloatingToolbar';
import { headerFooterFor, type DocMeta } from '../lib/docmeta';

interface Props {
  editor: Editor;
  mode: KeyboardMode;
  onMode: (m: KeyboardMode) => void;
  layout: PageLayout;
  onLayout: (l: PageLayout) => void;
  view: ViewState;
  onView: (patch: Partial<ViewState>) => void;
  findOpen: boolean;
  onFindClose: () => void;
  toast: (msg: string) => void;
  /** lets App route its own keydown shortcuts (F-keys, Ctrl+G) through the editor's key handler ref */
  registerKeyHandler: (fn: (e: KeyboardEvent) => boolean) => void;
  meta: DocMeta;
  onImageFile: (f: File) => boolean;
  openLink: () => void;
  openDialog: (d: import('./Dialogs').DialogName) => void;
}

export const EditorPage: React.FC<Props> = ({ editor, mode, onMode, layout, onLayout, view, onView, findOpen, onFindClose, toast, registerKeyHandler, meta, onImageFile, openLink, openDialog }) => {
  const { w: pageW, h: pageH } = pageDims(layout);
  const m = layout.margins;
  const contentH = pageH - m.top - m.bottom;

  /* ---------------------------------------------------------------- Manglish composer (IME style) */
  const [buffer, setBuffer] = useState('');
  const [cands, setCands] = useState<string[]>([]);
  const [sel, setSel] = useState(0);
  const [popPos, setPopPos] = useState<{ left: number; top: number } | null>(null);
  const bufRef = useRef('');
  const candsRef = useRef<string[]>([]);
  const selRef = useRef(0);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  candsRef.current = cands;
  selRef.current = sel;

  const [activeKey, setActiveKey] = useState<number | null>(null);
  const [shift, setShift] = useState(false);

  const setBuf = useCallback(
    (v: string) => {
      bufRef.current = v;
      setBuffer(v);
      setSel(0);
      if (!v) {
        setCands([]);
        setPopPos(null);
        return;
      }
      setCands([offlinePhoneticTransliterate(v), v].filter((x, i, a) => x && a.indexOf(x) === i)); // instant, then enriched
      try {
        const c = editor.view.coordsAtPos(editor.state.selection.head);
        setPopPos({ left: c.left, top: c.bottom + 4 });
      } catch {
        /* view not ready */
      }
      fetchManglishSuggestions(v).then((list) => {
        if (bufRef.current === v && list.length) setCands(list.slice(0, 7));
      });
    },
    [editor],
  );

  const commit = useCallback(
    (suffix: string, index?: number) => {
      const b = bufRef.current;
      if (!b) return;
      const pick = candsRef.current[index ?? selRef.current] ?? offlinePhoneticTransliterate(b);
      setBuf('');
      insertPlain(editor, pick + suffix);
    },
    [editor, setBuf],
  );

  /* ---------------------------------------------------------------- key handling */
  const handleKey = useCallback(
    (e: KeyboardEvent): boolean => {
      setActiveKey(e.keyCode);
      const md = modeRef.current;
      const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
      const b = bufRef.current;

      if (md === 'manglish' && plain) {
        if (/^[a-zA-Z]$/.test(e.key)) {
          setBuf(b + e.key);
          return true;
        }
        if (b) {
          const n = candsRef.current.length;
          if (e.key === 'Backspace') return setBuf(b.slice(0, -1)), true;
          if (e.key === ' ') return commit(' '), true;
          if (e.key === 'Enter' || e.key === 'Tab') return commit(''), true;
          if (e.key === 'Escape') return setBuf(''), insertPlain(editor, b), true;
          if (e.key === 'ArrowDown' || e.key === 'ArrowRight') return n > 1 && (setSel((i) => (i + 1) % n), true);
          if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') return n > 1 && (setSel((i) => (i - 1 + n) % n), true);
          if (/^[1-7]$/.test(e.key) && Number(e.key) <= n) return commit('', Number(e.key) - 1), true;
          if (e.key.length === 1) return commit(e.key), true; // punctuation / digit: commit word, then type it
          commit(''); // Home, End, PageUp… : commit and let the key act
          return false;
        }
      }

      const map = getLayoutMap(md);
      if (map && plain) {
        const def = map[e.keyCode];
        if (def) {
          let ch = e.shiftKey ? def[1] : def[0];
          if (ch && md === 'typewriter' && /^[\u0D46\u0D47\u0D48]$/.test(ch)) {
            // pre-base vowel sign: second െ makes ൈ, otherwise mark it so the next consonant pulls it into place
            if (!(ch === '\u0D46' && unicodeBeforeCursor(editor) === '\u0D46')) ch = '\u200B' + ch;
          }
          if (ch) {
            insertPlain(editor, ch);
            normalizeAroundCursor(editor);
          }
          return true;
        }
      }

      if (e.key === 'Backspace' && plain && legacyBackspace(editor)) return true;
      return false;
    },
    [editor, setBuf, commit],
  );

  const keyRef = useRef(handleKey);
  keyRef.current = handleKey;

  useEffect(() => {
    registerKeyHandler((e) => keyRef.current(e));
  }, [registerKeyHandler]);

  // leaving Manglish (or the editor losing focus) drops a half-typed word into the text as Latin
  useEffect(() => {
    if (mode !== 'manglish' && bufRef.current) {
      const b = bufRef.current;
      setBuf('');
      insertPlain(editor, b);
    }
  }, [mode, editor, setBuf]);
  useEffect(() => {
    const dom = editor.view.dom;
    const blur = () => bufRef.current && setBuf('');
    dom.addEventListener('blur', blur);
    return () => dom.removeEventListener('blur', blur);
  }, [editor, setBuf]);

  useEffect(() => {
    const dn = (e: KeyboardEvent) => e.key === 'Shift' && setShift(true);
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShift(false);
      setActiveKey(null);
    };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', dn);
      window.removeEventListener('keyup', up);
    };
  }, []);

  /* ---------------------------------------------------------------- editor state for ruler / status bar */
  const st = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const p = e.getAttributes(e.isActive('heading') ? 'heading' : 'paragraph');
      const marks = e.state.selection.$from.marks();
      return {
        indentLeft: Number(p.indentLeft) || 0,
        indentFirst: Number(p.indentFirst) || 0,
        words: e.storage.characterCount.words() as number,
        chars: e.storage.characterCount.characters() as number,
        series: seriesOfMarks(marks),
        head: e.state.selection.head,
      };
    },
  });

  const pageRef = useRef<HTMLDivElement>(null);
  const [docH, setDocH] = useState(contentH);
  useLayoutEffect(() => {
    const el = pageRef.current?.querySelector('.ProseMirror');
    if (!el) return;
    const ro = new ResizeObserver(() => setDocH((el as HTMLElement).offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [editor]);

  const pages = Math.max(1, Math.ceil(docH / contentH));
  const currentPage = useMemo(() => {
    try {
      const c = editor.view.coordsAtPos(st.head);
      const top = pageRef.current?.querySelector('.ProseMirror')?.getBoundingClientRect().top ?? 0;
      return Math.min(pages, Math.max(1, Math.floor((c.top - top) / (view.zoom * contentH)) + 1));
    } catch {
      return 1;
    }
  }, [editor, st.head, contentH, pages, view.zoom]);

  /* ---------------------------------------------------------------- find & replace */
  const [q, setQ] = useState('');
  const [rep, setRep] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [idx, setIdx] = useState(0);
  const [matches, setMatches] = useState<Match[]>([]);
  useEffect(() => {
    if (!findOpen) return;
    setMatches(findMatches(editor, q, rep, matchCase));
    setIdx(0);
  }, [findOpen, q, rep, matchCase, editor]);

  const goto = (i: number) => {
    if (!matches.length) return;
    const k = (i + matches.length) % matches.length;
    setIdx(k);
    editor.chain().setTextSelection({ from: matches[k].from, to: matches[k].to }).scrollIntoView().run();
  };
  const refresh = () => setMatches(findMatches(editor, q, rep, matchCase));

  /* ---------------------------------------------------------------- virtual keyboard bridge */
  const vInsert = (t: string) => {
    insertPlain(editor, t);
    if (mode !== 'english' && mode !== 'manglish') normalizeAroundCursor(editor);
  };
  const vBackspace = () => {
    if (!legacyBackspace(editor)) editor.chain().focus().deleteSelection().run() || editor.commands.keyboardShortcut('Backspace');
  };

  const onLinkClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
    const href = a?.getAttribute('href');
    if (!a || !href) return;
    if (href.startsWith('#')) {
      e.preventDefault();
      let pos = -1;
      editor.state.doc.descendants((n, p) => { if (n.type.name === 'bookmark' && n.attrs.name === href.slice(1)) pos = p; });
      if (pos >= 0) editor.chain().setTextSelection(pos).scrollIntoView().run();
      else toast(`No bookmark named “${href.slice(1)}”`);
    } else if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      window.open(href, '_blank', 'noopener');
    } else if (!editor.state.selection.empty) {
      /* keep selection */
    } else if (e.detail === 2) openLink();
  };
  const onPaste = (e: React.ClipboardEvent) => {
    const f = Array.from(e.clipboardData.files).find((x) => x.type.startsWith('image/'));
    if (f && onImageFile(f)) e.preventDefault();
  };
  const onDrop = (e: React.DragEvent) => {
    const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith('image/'));
    if (f && onImageFile(f)) e.preventDefault();
  };

  const modeInfo = KEYBOARD_MODES.find((x) => x.id === mode)!;
  const pageCSS = {
    width: pageW,
    minHeight: pageH,
    padding: `${m.top}px ${m.right}px ${m.bottom}px ${m.left}px`,
    ['--msx-content-h' as string]: `${contentH}px`,
  } as React.CSSProperties;

  return (
    <div className="msx-editor-shell" id="msx-doc" role="main" aria-label="Document editor">
      <div className="msx-modebar no-print">
        <span className="msx-modebar-label">Typing:</span>
        {KEYBOARD_MODES.map((k) => (
          <button key={k.id} type="button" className={`msx-mode${mode === k.id ? ' is-active' : ''}`} title={`${k.description}`} onClick={() => { onMode(k.id); editor.commands.focus(); }}>
            <kbd>{k.shortcut}</kbd> {k.name}
          </button>
        ))}
        <span className="msx-modebar-hint">Ctrl+G: Manglish ⇄ English</span>
      </div>

      {findOpen && (
        <div className="msx-find no-print">
          <input autoFocus className="msx-input" placeholder="Find…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && goto(e.shiftKey ? idx - 1 : idx + (matches.length && matches[idx] ? 1 : 0))} />
          <input className="msx-input" placeholder="Replace with…" value={rep} onChange={(e) => setRep(e.target.value)} />
          <label className="msx-check">
            <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} /> Match case
          </label>
          <span className="msx-hint">{q ? `${matches.length ? idx + 1 : 0} of ${matches.length}` : ''}</span>
          <button type="button" className="msx-btn" title="Previous" onClick={() => goto(idx - 1)}><ChevronUp size={15} /></button>
          <button type="button" className="msx-btn" title="Next" onClick={() => goto(idx + 1)}><ChevronDown size={15} /></button>
          <button type="button" className="msx-btn" title="Replace this match" disabled={!matches.length} onClick={() => { replaceMatches(editor, [matches[idx]]); refresh(); }}><Replace size={15} /> Replace</button>
          <button type="button" className="msx-btn" title="Replace all matches" disabled={!matches.length} onClick={() => { const n = replaceMatches(editor, matches); refresh(); toast(`Replaced ${n} occurrence${n === 1 ? '' : 's'}`); }}>All</button>
          <button type="button" className="msx-btn" title="Close" onClick={onFindClose}><X size={15} /></button>
        </div>
      )}

      <div className="msx-workspace" onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); onView({ zoom: Math.min(3, Math.max(0.25, +(view.zoom - Math.sign(e.deltaY) * 0.1).toFixed(2))) }); } }}>
        <div className="msx-sheet" style={{ zoom: view.zoom, width: pageW }}>
          {view.ruler && (
            <Ruler
              pageWidth={pageW}
              margins={{ left: m.left, right: m.right }}
              indent={{ left: st.indentLeft, first: st.indentFirst }}
              onMargins={(mm) => onLayout({ ...layout, margins: { ...m, ...mm } })}
              onIndent={(l, f) => editor.commands.setIndents(l, f)}
              unit={view.unit ?? 'cm'}
            />
          )}
          <div ref={pageRef} className="msx-page" style={pageCSS}>
            {view.guides &&
              Array.from({ length: pages - 1 }, (_, i) => (
                <div key={i} className="msx-pagebreak no-print" style={{ top: m.top + (i + 1) * contentH }}>
                  <span>Page {i + 2}</span>
                </div>
              ))}
            {Array.from({ length: pages }, (_, i) => {
              const hf = headerFooterFor(meta, i + 1, pages);
              const mk = (rows: Array<[string, 'left' | 'center' | 'right']>, top: number, h: number) =>
                rows.length > 0 && (
                  <div key={top} className="msx-hf no-print" style={{ top, height: h, paddingLeft: m.left, paddingRight: m.right, fontSize: `${meta.hf.size}pt`, fontFamily: `"${meta.hf.font}", 'Noto Sans Malayalam', sans-serif` }}>
                    {rows.map(([t, al], k) => <div key={k} style={{ textAlign: al }}>{t}</div>)}
                  </div>
                );
              const pageTop = i * pageH;
              return (
                <React.Fragment key={i}>
                  {mk(hf.header, pageTop + Math.max(6, m.top / 2 - 8), 24)}
                  {mk(hf.footer, pageTop + pageH - Math.max(30, m.bottom / 2 + 8), 24)}
                </React.Fragment>
              );
            })}
            <div onClick={onLinkClick} onPaste={onPaste} onDrop={onDrop}>
              <EditorContent editor={editor} />
            </div>
            <ObjectFrame editor={editor} pageRef={pageRef} />
            {view.ruler && (['left', 'right'] as const).map((side) => (
              <VRuler key={side} side={side} height={Math.max(pageH, m.top + pages * contentH + m.bottom)} pages={pages} contentH={contentH} margins={{ top: m.top, bottom: m.bottom }} onMargins={(mm) => onLayout({ ...layout, margins: { ...m, ...mm } })} unit={view.unit ?? 'cm'} />
            ))}
          </div>
          {view.ruler && (
            <Ruler simple pageWidth={pageW} margins={{ left: m.left, right: m.right }} indent={{ left: 0, first: 0 }} onMargins={(mm) => onLayout({ ...layout, margins: { ...m, ...mm } })} onIndent={() => undefined} unit={view.unit ?? 'cm'} />
          )}
        </div>
      </div>

      <FloatingToolbar editor={editor} openDialog={openDialog} />

      {view.vkb && (
        <div className="msx-vkb no-print">
          <VirtualKeyboard mode={mode} onInsertText={vInsert} onBackspace={vBackspace} onEnter={() => editor.chain().focus().splitBlock().run()} activeKeyCode={activeKey} physicalShift={shift} compact />
        </div>
      )}

      {buffer && popPos && (
        <div className="msx-composer no-print" style={{ left: popPos.left, top: popPos.top }} onMouseDown={(e) => e.preventDefault()}>
          <div className="msx-composer-buf">{buffer}</div>
          {cands.map((c, i) => (
            <button key={c + i} type="button" className={i === sel ? 'is-active' : ''} onClick={() => { commit('', i); editor.commands.focus(); }}>
              <b>{i + 1}</b> {c}
            </button>
          ))}
          <div className="msx-composer-hint">Space/Enter = insert · ↑↓ choose · 1–7 pick · Esc = keep English</div>
        </div>
      )}

      <div className="msx-status no-print">
        <span>Page {currentPage} of {pages}</span>
        <span>{st.words} words</span>
        <span>{st.chars} characters</span>
        <span title={modeInfo.description}>{modeInfo.name} <kbd>{modeInfo.shortcut}</kbd></span>
        <span title="Text typed now is stored in this encoding">
          Font type: {st.series === 'unicode' ? 'Unicode' : st.series === 'ml' ? 'ML series (legacy)' : 'FML series (legacy)'}
        </span>
        <span className="msx-status-spacer" />
        <span>{(pageW / PX_PER_CM).toFixed(1)} × {(pageH / PX_PER_CM).toFixed(1)} cm</span>
        <span className="msx-zoom" title="Zoom (Ctrl + mouse wheel, Ctrl +/−, Ctrl 0)">
          <button type="button" aria-label="Zoom out" onClick={() => onView({ zoom: Math.max(0.25, +(view.zoom - 0.1).toFixed(2)) })}>−</button>
          <input type="range" min={25} max={300} step={5} value={Math.round(view.zoom * 100)} aria-label="Zoom" onChange={(e) => onView({ zoom: Number(e.target.value) / 100 })} />
          <button type="button" aria-label="Zoom in" onClick={() => onView({ zoom: Math.min(3, +(view.zoom + 0.1).toFixed(2)) })}>+</button>
          <button type="button" className="msx-zoom-pct" onClick={() => onView({ zoom: 1 })} title="Reset to 100%">{Math.round(view.zoom * 100)}%</button>
        </span>
      </div>
    </div>
  );
};

// re-exported so App can tell whether the caret is inside a legacy-font run
export const caretIsLegacy = (editor: Editor): boolean => isLegacy(seriesOfMarks(editor.state.selection.$from.marks()));
