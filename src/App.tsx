import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Editor, type JSONContent } from '@tiptap/core';
import { useEditor } from '@tiptap/react';
import { BookOpen, FileText, Languages, Minus, PenLine, Plus, Save, Square, Copy, X } from 'lucide-react';
import { AppMenu } from './components/AppMenu';
import { applyUi, loadUi, saveUi, type UiPrefs } from './lib/appearance';
import { desktop } from './lib/app';
import { Dialogs, type DialogName } from './components/Dialogs';
import { DEFAULT_META, expandTokens, formatPageNumber, type DocMeta } from './lib/docmeta';
import { loadCustomFonts } from './lib/customFonts';
import { DEFAULT_SAVE, FORMATS, buildFile, fileNameFor, formatInfo, pickFile, readFile, writeToDisk, type Format, type SaveOptions } from './export/files';
import { Ribbon, type RibbonActions, type ViewState } from './components/Ribbon';
import { EditorPage } from './components/EditorPage';
import { DictionaryPanel, type DictRequest } from './components/DictionaryPanel';
import { ConverterStudio, type ConvertSubTab } from './components/ConverterStudio';
import { HandwritingView } from './components/HandwritingView';
import { buildExtensions } from './editor/extensions';
import { cleanupUnicode, docToUnicodeText, textToDoc, toUnicodeJSON } from './editor/docTools';
import { insertPlain, selectedOrWord } from './editor/fontCommands';
import { seriesOfMarks } from './editor/marks';
import { DEFAULT_FONT, injectFontFaces, quoteFamily } from './lib/fonts';
import { hasMalayalam, isLegacy } from './lib/legacy';
import { isMalayalamQuery } from './lib/dictionary';
import { DEFAULT_LAYOUT, pageDims, type PageLayout } from './lib/page';
import { KEYBOARD_MODES, type KeyboardMode } from './utils/keyboardLayouts';

injectFontFaces();

type Tab = 'editor' | 'dictionary' | 'convert' | 'handwriting';

const SET_KEY = 'msx-settings';
const SESSION_KEY = 'msx-session';
const SAVE_KEY = 'msx-saveopts';
/** The Windows app restores the previous session; the web version always opens a blank document. */
const IS_DESKTOP = /Electron\//.test(navigator.userAgent);

const BLANK: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };

interface DocTab {
  id: string;
  title: string;
  doc: JSONContent;
  layout: PageLayout;
  meta: DocMeta;
  fmt: Format;
}
const newId = () => Math.random().toString(36).slice(2, 9);
const emptyDoc = (): JSONContent => JSON.parse(JSON.stringify(BLANK));

function readJson<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable or full */
  }
}

interface Settings {
  mode: KeyboardMode;
  layout: PageLayout;
  view: ViewState;
}
const DEFAULT_SETTINGS: Settings = {
  mode: 'manglish',
  layout: DEFAULT_LAYOUT,
  view: { ruler: true, guides: true, vkb: false, dark: false, zoom: 1, unit: 'cm' },
};

function download(name: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function App() {
  const saved = useRef<Settings>({ ...DEFAULT_SETTINGS, ...(readJson<Partial<Settings>>(SET_KEY) ?? {}) });
  const prefFmt = readJson<{ fmt: Format; opts: Partial<SaveOptions> }>(SAVE_KEY);
  const mergeMeta = (m?: Partial<DocMeta>): DocMeta => {
    const d = DEFAULT_META();
    return { props: { ...d.props, ...m?.props }, hf: { ...d.hf, ...m?.hf }, pn: { ...d.pn, ...m?.pn } };
  };
  const initial = useRef<{ tabs: DocTab[]; active: string }>(
    (() => {
      const base: PageLayout = { ...DEFAULT_LAYOUT, ...saved.current.layout };
      const fresh = (): DocTab => ({ id: newId(), title: 'Untitled document', doc: emptyDoc(), layout: base, meta: mergeMeta(), fmt: prefFmt?.fmt ?? 'docx' });
      if (IS_DESKTOP) {
        const s = readJson<{ tabs: DocTab[]; active: string }>(SESSION_KEY);
        if (s?.tabs?.length) {
          const tabs = s.tabs.map((t) => ({ ...t, layout: { ...DEFAULT_LAYOUT, ...t.layout }, meta: mergeMeta(t.meta) }));
          return { tabs, active: tabs.some((t) => t.id === s.active) ? s.active : tabs[0].id };
        }
      }
      const t = fresh();
      return { tabs: [t], active: t.id };
    })(),
  );
  const startTab = initial.current.tabs.find((t) => t.id === initial.current.active)!;
  const [tabs, setTabs] = useState<DocTab[]>(initial.current.tabs);
  const [activeId, setActiveId] = useState(initial.current.active);
  const [dirtyIds, setDirtyIds] = useState<string[]>([]);
  const [mode, setMode] = useState<KeyboardMode>(saved.current.mode);
  const [layout, setLayout] = useState<PageLayout>(startTab.layout);
  const [view, setView] = useState<ViewState>({ ...DEFAULT_SETTINGS.view, ...saved.current.view });
  const [tab, setTab] = useState<Tab>('editor');
  const [title, setTitle] = useState(startTab.title);
  const [meta, setMeta] = useState<DocMeta>(startTab.meta);
  const [fmt, setFmt] = useState<Format>(startTab.fmt);
  const [saveOpts, setSaveOpts] = useState<SaveOptions>(() => ({ ...DEFAULT_SAVE, ...(prefFmt?.opts ?? {}), pdf: { ...DEFAULT_SAVE.pdf, ...(prefFmt?.opts?.pdf ?? {}), userPassword: '', ownerPassword: '' } }));
  const [dialog, setDialog] = useState<DialogName | null>(null);
  const [, setFontTick] = useState(0);
  const [findOpen, setFindOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [status, setStatus] = useState('Ready');
  const [ui, setUi] = useState<UiPrefs>(loadUi);
  const [maxed, setMaxed] = useState(false);
  const [liveMsg, setLiveMsg] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [dictReq, setDictReq] = useState<DictRequest | null>(null);
  const [convSub, setConvSub] = useState<ConvertSubTab>('ml');
  const [convKey, setConvKey] = useState(0);
  const [docText, setDocText] = useState('');
  const addTabRef = useRef<(i?: Partial<DocTab>) => DocTab>(() => { throw new Error('not ready'); });
  const activeRef = useRef(activeId);
  const persistRef = useRef<() => void>(() => undefined);
  const keyHandler = useRef<(e: KeyboardEvent) => boolean>(() => false);
  const saveTimer = useRef<number | undefined>(undefined);
  const toastTimer = useRef<number | undefined>(undefined);

  const toast = useCallback((m: string) => {
    setLiveMsg((p) => (p === m ? m + '\u00a0' : m));
    setToastMsg(m);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(''), 2600);
  }, []);

  const editor = useEditor({
    extensions: buildExtensions(),
    content: startTab.doc,
    autofocus: 'end',
    editorProps: {
      attributes: { class: 'msx-prose', spellcheck: 'false', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Document text. Malayalam and English typing. Press Control slash for help.', lang: 'ml' },
      handleKeyDown: (_v, e) => keyHandler.current(e),
    },
    onUpdate: () => {
      setStatus('Edited');
      setDirtyIds((d) => (d.includes(activeRef.current) ? d : [...d, activeRef.current]));
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => persistRef.current(), 600);
    },
  });

  /* ------------------------------------------------ persistence + theme + print page size */
  useEffect(() => writeJson(SET_KEY, { mode, layout, view }), [mode, layout, view]);
  useEffect(() => {
    if (IS_DESKTOP) persistRef.current();
  }, [layout, meta, title, fmt, tabs, activeId]);
  useEffect(() => writeJson(SAVE_KEY, { fmt, opts: { ...saveOpts, pdf: { ...saveOpts.pdf, userPassword: '', ownerPassword: '' } } }), [fmt, saveOpts]);
  useEffect(() => {
    loadCustomFonts().then(() => setFontTick((n) => n + 1)).catch(() => undefined);
  }, []);
  useEffect(() => {
    document.title = `${title} — Malayalam Studio`;
  }, [title]);
  useEffect(() => {
    activeRef.current = activeId;
  }, [activeId]);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', view.dark);
    applyUi(ui, view.dark);
    saveUi(ui);
  }, [view.dark, ui]);
  useEffect(() => {
    const d = desktop();
    if (!d) return;
    d.isMaximized().then(setMaxed).catch(() => undefined);
    d.onMaximized(setMaxed);
  }, []);
  useEffect(() => {
    const { w, h } = pageDims(layout);
    const m = layout.margins;
    let el = document.getElementById('msx-print-page');
    if (!el) {
      el = document.createElement('style');
      el.id = 'msx-print-page';
      document.head.appendChild(el);
    }
    const q = (t: string) => `"${t.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;
    const box = (pos: 'top' | 'bottom', align: string, content: string) => `@${pos}-${align}{content:${content};font:${meta.hf.size}pt 'Noto Sans Malayalam',sans-serif;color:#444}`;
    const rules: string[] = [];
    const add = (pos: 'top' | 'bottom', align: 'left' | 'center' | 'right', content: string) => rules.push(box(pos, align, content));
    const hfText = (t: string) => (t.trim() ? q(expandTokens(t.replace(/\{page\}|\{pages\}/g, '\u0001'), 1, 1, meta.props).replace(/\u0001/g, '')) : '');
    if (meta.hf.header.trim()) add('top', meta.hf.headerAlign, hfText(meta.hf.header));
    if (meta.hf.footer.trim() && !(meta.pn.enabled && meta.pn.position === 'footer' && meta.pn.align === meta.hf.footerAlign)) add('bottom', meta.hf.footerAlign, hfText(meta.hf.footer));
    if (meta.pn.enabled) {
      const num = meta.pn.format === 'ml-n' ? 'counter(page)' : meta.pn.format === 'page-n' ? '"Page " counter(page)' : meta.pn.format === 'dash-n' ? '"– " counter(page) " –"' : meta.pn.format === 'n-of-total' ? 'counter(page) " / " counter(pages)' : meta.pn.format === 'page-n-of-total' ? '"Page " counter(page) " of " counter(pages)' : 'counter(page)';
      rules.push(box(meta.pn.position === 'header' ? 'top' : 'bottom', meta.pn.align, num));
    }
    void formatPageNumber;
    el.textContent = `@page{size:${w / 96}in ${h / 96}in;margin:${m.top / 96}in ${m.right / 96}in ${m.bottom / 96}in ${m.left / 96}in;${rules.join('')}}`;
  }, [layout, meta]);

  const registerKeyHandler = useCallback((fn: (e: KeyboardEvent) => boolean) => {
    keyHandler.current = fn;
  }, []);

  /* ------------------------------------------------ actions */
  const goEditor = useCallback(() => {
    setTab('editor');
    setTimeout(() => editor?.commands.focus(), 0);
  }, [editor]);

  const lookup = useCallback(() => {
    if (!editor) return;
    const t = selectedOrWord(editor);
    if (!t) return toast('Select a word, or put the cursor inside one, then press F9');
    setDictReq({ q: t, dir: isMalayalamQuery(t) ? 'ml-en' : 'en-ml', nonce: Date.now() });
    setTab('dictionary');
  }, [editor, toast]);

  const insertFromDictionary = useCallback(
    (text: string) => {
      if (!editor) return;
      goEditor();
      setTimeout(() => {
        const inLegacy = isLegacy(seriesOfMarks(editor.state.selection.$from.marks()));
        if (inLegacy && !hasMalayalam(text)) {
          // English inside a legacy font would show as Malayalam glyphs, so put it in a normal font
          editor.chain().focus().insertContent({ type: 'text', text, marks: [{ type: 'textStyle', attrs: { fontFamily: quoteFamily(DEFAULT_FONT) } }] }).run();
        } else insertPlain(editor, text);
      }, 20);
    },
    [editor, goEditor],
  );

  const imgInput = useRef<HTMLInputElement>(null);

  const doSave = useCallback(
    async (name: string, f: Format, o: SaveOptions, keepFmt = false) => {
      if (!editor) return;
      const base = name.replace(/\.(docx|odt|pdf|txt|html?|mlstudio)$/i, '').trim() || 'Untitled document';
      toast(`Preparing ${formatInfo(f).ext} …`);
      try {
        const m: DocMeta = { ...meta, props: { ...meta.props, title: meta.props.title || base, modified: new Date().toISOString() } };
        const blob = await buildFile(f, { editor, layout, meta: m }, o);
        const r = await writeToDisk(blob, fileNameFor(base, f), f);
        if (r === 'cancelled') return toast('Save cancelled');
        setTitle(base);
        if (!keepFmt) setFmt(f);
        setDirtyIds((d) => d.filter((x) => x !== activeRef.current));
        toast(r === 'saved' ? `Saved ${fileNameFor(base, f)}` : `Saved ${fileNameFor(base, f)} to your downloads`);
      } catch (err) {
        console.error(err);
        toast(`Could not save: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    },
    [editor, layout, meta, toast],
  );

  const openDoc = useCallback(async () => {
    const f = await pickFile();
    if (!f || !editor) return;
    try {
      const o = await readFile(f);
      const ext = (f.name.match(/\.(docx|odt|pdf|txt|html?|mlstudio)$/i)?.[1] ?? '').toLowerCase();
      const nf: Format = ext === 'htm' ? 'html' : ext && FORMATS.some((x) => x.id === ext) ? (ext as Format) : fmt;
      if (!editor.isEmpty) addTabRef.current({ fmt: nf });
      else setFmt(nf);
      setTimeout(() => {
        if (o.doc) editor.commands.setContent(o.doc);
        else if (o.html !== undefined) editor.commands.setContent(o.html);
        else editor.commands.setContent(textToDoc(o.text ?? ''));
        if (o.layout) setLayout({ ...DEFAULT_LAYOUT, ...o.layout });
        if (o.meta) setMeta(mergeMeta(o.meta));
        setTitle(f.name.replace(/\.[^.]+$/, ''));
        setDirtyIds((d) => d.filter((x) => x !== activeRef.current));
      }, 30);
      toast(`Opened ${f.name}`);
    } catch (err) {
      console.error(err);
      toast('Could not open that file');
    }
  }, [editor, toast, fmt]);

  const insertImageFile = useCallback(
    (file: File) => {
      if (!editor || !file.type.startsWith('image/')) return false;
      const r = new FileReader();
      r.onload = () => editor.chain().focus().setImage({ src: String(r.result), alt: file.name.replace(/\.[^.]+$/, '') }).run();
      r.readAsDataURL(file);
      return true;
    },
    [editor],
  );

  /* ------------------------------------------------ document tabs */
  const snapshot = useCallback((): DocTab[] => tabs.map((t) => (t.id === activeId && editor ? { ...t, title, doc: editor.getJSON(), layout, meta, fmt } : t)), [tabs, activeId, editor, title, layout, meta, fmt]);

  useEffect(() => {
    persistRef.current = () => {
      if (!IS_DESKTOP || !editor) return;
      writeJson(SESSION_KEY, { tabs: snapshot(), active: activeId });
      setStatus('Saved');
    };
  }, [snapshot, activeId, editor]);

  const loadTab = useCallback(
    (t: DocTab) => {
      if (!editor) return;
      editor.commands.setContent(t.doc, { emitUpdate: false });
      setTitle(t.title);
      setLayout(t.layout);
      setMeta(t.meta);
      setFmt(t.fmt);
      setActiveId(t.id);
      activeRef.current = t.id;
      setTab('editor');
      setTimeout(() => editor.commands.focus('start'), 0);
    },
    [editor],
  );

  const switchTab = useCallback(
    (id: string) => {
      if (id === activeId) return setTab('editor');
      const snap = snapshot();
      const target = snap.find((t) => t.id === id);
      if (!target) return;
      setTabs(snap);
      loadTab(target);
    },
    [activeId, snapshot, loadTab],
  );

  const addTab = useCallback(
    (init?: Partial<DocTab>) => {
      const snap = snapshot();
      const t: DocTab = { id: newId(), title: 'Untitled document', doc: emptyDoc(), layout, meta: mergeMeta(), fmt: prefFmt?.fmt ?? fmt, ...init };
      setTabs([...snap, t]);
      loadTab(t);
      return t;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshot, loadTab, layout, fmt],
  );

  useEffect(() => {
    addTabRef.current = addTab;
  }, [addTab]);

  const closeTab = useCallback(
    (id: string) => {
      const snap = snapshot();
      const t = snap.find((x) => x.id === id);
      if (!t) return;
      const hasText = JSON.stringify(t.doc).includes('"text"') || JSON.stringify(t.doc).includes('"image"') || JSON.stringify(t.doc).includes('"table"');
      if (dirtyIds.includes(id) && hasText && !window.confirm(`Close “${t.title}”? Changes that are not saved to a file will be lost.`)) return;
      setDirtyIds((d) => d.filter((x) => x !== id));
      const rest = snap.filter((x) => x.id !== id);
      if (!rest.length) {
        const nt: DocTab = { id: newId(), title: 'Untitled document', doc: emptyDoc(), layout, meta: mergeMeta(), fmt };
        setTabs([nt]);
        loadTab(nt);
        return;
      }
      setTabs(rest);
      if (id === activeId) {
        const i = snap.findIndex((x) => x.id === id);
        loadTab(rest[Math.min(i, rest.length - 1)]);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshot, activeId, dirtyIds, loadTab, layout, fmt],
  );

  useEffect(() => {
    if (IS_DESKTOP) return;
    const h = (e: BeforeUnloadEvent) => {
      if (dirtyIds.length && editor && !editor.isEmpty) e.preventDefault();
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirtyIds, editor]);

  const toggleSpeak = useCallback(() => {
    const synth = window.speechSynthesis;
    if (!synth) return toast('Read aloud is not available in this browser');
    if (synth.speaking) { synth.cancel(); setSpeaking(false); return; }
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    const text = (empty ? docToUnicodeText(editor) : editor.state.doc.textBetween(from, to, '\n')).trim();
    if (!text) return toast('Nothing to read yet');
    const u = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    const ml = /[\u0D00-\u0D7F]/.test(text);
    const v = voices.find((x) => x.lang.toLowerCase().startsWith(ml ? 'ml' : 'en'));
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = ml ? 'ml-IN' : 'en-IN';
    u.onend = u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
    if (ml && !v) toast('No Malayalam voice found on this device – install one in system language settings');
  }, [editor, toast]);

  const actions: RibbonActions | null = editor && {
    newDoc: () => {
      addTab();
    },
    openFile: () => void openDoc(),
    save: () => void doSave(title, fmt, saveOpts),
    saveAs: () => setDialog('saveas'),
    exportAs: (f) => void doSave(title, f, saveOpts, true),
    exportTxt: () => void doSave(title, 'txt', saveOpts, true),
    exportHtml: () => void doSave(title, 'html', saveOpts, true),
    pickImage: () => imgInput.current?.click(),
    print: () => window.print(),
    find: () => setFindOpen(true),
    lookup,
    openConvert: (sub) => {
      setConvSub(sub);
      setConvKey((k) => k + 1);
      setDocText(docToUnicodeText(editor));
      setTab('convert');
    },
    cleanup: () => {
      const n = cleanupUnicode(editor);
      toast(n ? 'Chillu & vowel clean-up complete' : 'Nothing to fix — already clean');
    },
    copyUnicode: async () => {
      const t = editor.state.selection.empty ? docToUnicodeText(editor) : selectedOrWord(editor);
      try {
        await navigator.clipboard.writeText(t);
        toast('Copied as Unicode text');
      } catch {
        toast('Copy was blocked by the browser — select the text and press Ctrl+C');
      }
    },
  };

  const onImg = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(insertImageFile);
    e.target.value = '';
  };

  /* ------------------------------------------------ global shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const m = KEYBOARD_MODES.find((k) => k.shortcut === e.key);
      if (m && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setMode(m.id);
        toast(`${m.name} typing  (${m.shortcut})`);
        return;
      }
      if (e.key === 'Escape' && window.speechSynthesis?.speaking) {
        window.speechSynthesis.cancel();
        setSpeaking(false);
      } else if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        toggleSpeak();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setDialog('about');
      } else if (e.key === 'F8') {
        e.preventDefault();
        setView((v) => ({ ...v, vkb: !v.vkb }));
      } else if (e.key === 'F9') {
        e.preventDefault();
        lookup();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setMode((cur) => {
          const next = cur === 'manglish' ? 'english' : 'manglish';
          toast(next === 'english' ? 'English typing' : 'Manglish typing');
          return next;
        });
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) setDialog('saveas');
        else actions?.save();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        window.print();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && tab === 'editor') {
        e.preventDefault();
        setDialog('link');
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && tab === 'editor') {
        e.preventDefault();
        editor?.chain().focus().insertPageBreak().run();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setView((v) => ({ ...v, zoom: Math.min(3, +(v.zoom + (v.zoom >= 0.99 ? 0.1 : 0.05)).toFixed(2)) }));
      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        setView((v) => ({ ...v, zoom: Math.max(0.25, +(v.zoom - (v.zoom > 1.01 ? 0.1 : 0.05)).toFixed(2)) }));
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setView((v) => ({ ...v, zoom: 1 }));
      } else if (e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        addTab();
      } else if (e.altKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        closeTab(activeId);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && tab === 'editor') {
        e.preventDefault();
        setFindOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* ------------------------------------------------ accessibility */
  useEffect(() => {
    const name = (el: Element) => {
      if (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')) return;
      const t = el.getAttribute('title');
      if (t && !(el.textContent ?? '').trim()) el.setAttribute('aria-label', t);
    };
    let raf = 0;
    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        document.querySelectorAll('.msx-app button, .msx-app [role=button], .msx-app select, .msx-app input').forEach(name);
        document.querySelectorAll('.msx-app svg:not([aria-hidden])').forEach((s) => s.setAttribute('aria-hidden', 'true'));
      });
    };
    run();
    const mo = new MutationObserver(run);
    mo.observe(document.querySelector('.msx-app') ?? document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); cancelAnimationFrame(raf); };
  }, []);
  useEffect(() => {
    const m = KEYBOARD_MODES.find((k) => k.id === mode);
    if (m) setLiveMsg(`Typing mode: ${m.name}`);
  }, [mode]);

  if (editor) (window as unknown as { __msxEditor?: Editor }).__msxEditor = editor;
  if (!editor || !actions) return <div className="msx-loading">Loading…</div>;

  const TABS: Array<[Tab, string, React.ReactNode]> = [
    ['editor', 'Editor', <FileText size={15} key="e" />],
    ['dictionary', 'Dictionary', <BookOpen size={15} key="d" />],
    ['convert', 'Convert', <Languages size={15} key="c" />],
    ['handwriting', 'Handwriting', <PenLine size={15} key="h" />],
  ];

  const setFromText = (t: string) => {
    editor.commands.setContent(textToDoc(t));
    goEditor();
  };

  return (
    <div className="msx-app">
      <header className="msx-top no-print" role="banner" onDoubleClick={(e) => { if ((e.target as HTMLElement).closest('.msx-top-drag')) desktop()?.toggleMaximize(); }}>
        <a className="msx-skip" href="#msx-doc" onClick={(e) => { e.preventDefault(); goEditor(); setTimeout(() => editor.commands.focus(), 30); }}>Skip to document</a>
        <div className="msx-brand msx-top-drag" title="Malayalam Studio">
          <img src="brand/logo-48.png" alt="" width={22} height={22} />
          <b>Malayalam Studio</b>
        </div>
        <div className="msx-tabstrip" role="tablist" aria-label="Open documents">
          {tabs.map((t) => {
            const on = t.id === activeId;
            return (
              <div key={t.id} role="tab" aria-selected={on} tabIndex={on ? 0 : -1} className={`msx-dtab${on ? ' is-active' : ''}`} onClick={() => switchTab(t.id)} onAuxClick={(e) => e.button === 1 && closeTab(t.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (!(e.target instanceof HTMLInputElement)) { e.preventDefault(); switchTab(t.id); } } }} title={on ? title : t.title}>
                <FileText size={13} aria-hidden />
                {on ? (
                  <input className="msx-dtab-input" value={title} size={Math.min(26, Math.max(10, title.length + 1))} onChange={(e) => setTitle(e.target.value)} aria-label="Document name" spellCheck={false} />
                ) : (
                  <span className="msx-dtab-name">{t.title}</span>
                )}
                {dirtyIds.includes(t.id) && <i className="msx-dtab-dot" title="Not saved to a file" aria-label="unsaved changes" />}
                <button type="button" className="msx-dtab-x" aria-label={`Close ${on ? title : t.title}`} title="Close tab (Alt+W)" onClick={(e) => { e.stopPropagation(); closeTab(t.id); }}><X size={12} /></button>
              </div>
            );
          })}
          <button type="button" className="msx-dtab-new" title="New document tab (Alt+T)" aria-label="New document tab" onClick={() => addTab()}><Plus size={15} /></button>
        </div>
        <div className="msx-top-drag msx-top-fill" />
        <nav className="msx-nav" aria-label="Sections">
          {TABS.map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? 'is-active' : ''}
              aria-current={tab === id ? 'page' : undefined}
              title={label}
              onClick={() => {
                if (id === 'convert' || id === 'handwriting') setDocText(docToUnicodeText(editor));
                if (id === 'editor') return goEditor();
                setTab(id);
              }}
            >
              {icon}<span className="msx-nav-label">{label}</span>
            </button>
          ))}
        </nav>
        <select className="msx-title-ext" value={fmt} onChange={(e) => setFmt(e.target.value as Format)} title="File type used by Save (Ctrl+S)" aria-label="File type">
          {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.ext}</option>)}
        </select>
        <button type="button" className="msx-savebtn" onClick={() => actions.save()} title="Save to your computer (Ctrl+S)"><Save size={13} /> <span className="msx-nav-label">Save</span></button>
        <AppMenu prefs={ui} onPrefs={setUi} dark={view.dark} onDark={(d) => setView((v) => ({ ...v, dark: d }))} speaking={speaking} onSpeak={toggleSpeak} onAbout={() => setDialog('about')} />
        {desktop() && (
          <div className="msx-winctl">
            <button type="button" aria-label="Minimise" title="Minimise" onClick={() => desktop()!.minimize()}><Minus size={14} /></button>
            <button type="button" aria-label={maxed ? 'Restore' : 'Maximise'} title={maxed ? 'Restore' : 'Maximise'} onClick={() => desktop()!.toggleMaximize()}>{maxed ? <Copy size={12} /> : <Square size={12} />}</button>
            <button type="button" className="is-close" aria-label="Close (keeps typing in the tray)" title="Close (Malayalam typing keeps running in the tray)" onClick={() => desktop()!.close()}><X size={15} /></button>
          </div>
        )}
      </header>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{liveMsg}</div>

      <input ref={imgInput} type="file" hidden accept="image/*" multiple onChange={onImg} />

      <div className="msx-main" hidden={tab !== 'editor'}>
        <Ribbon editor={editor} mode={mode} onMode={setMode} layout={layout} onLayout={setLayout} view={view} onView={(p) => setView((v) => ({ ...v, ...p }))} actions={actions} dialog={setDialog} />
        <EditorPage
          editor={editor}
          mode={mode}
          onMode={setMode}
          layout={layout}
          onLayout={setLayout}
          view={view}
          onView={(p) => setView((v) => ({ ...v, ...p }))}
          findOpen={findOpen}
          onFindClose={() => {
            setFindOpen(false);
            editor.commands.focus();
          }}
          toast={toast}
          registerKeyHandler={registerKeyHandler}
          meta={meta}
          onImageFile={insertImageFile}
          openLink={() => setDialog('link')}
          openDialog={setDialog}
        />
      </div>

      {tab === 'dictionary' && (
        <div className="msx-page-tab">
          <DictionaryPanel request={dictReq} mode={mode} onInsert={insertFromDictionary} toast={toast} />
        </div>
      )}
      {tab === 'convert' && (
        <div className="msx-page-tab">
          <ConverterStudio
            key={convKey}
            editorText={docText}
            onApplyToEditor={(t) => {
              setFromText(t);
              toast('Applied to the document');
            }}
            initialSubTab={convSub}
            showToast={toast}
          />
        </div>
      )}
      {tab === 'handwriting' && (
        <div className="msx-page-tab">
          <HandwritingView text={docText} onChangeText={(t) => { setDocText(t); editor.commands.setContent(textToDoc(t)); }} onBack={goEditor} showToast={toast} mode={mode} onMode={setMode} />
        </div>
      )}

      {dialog && (
        <Dialogs dialog={dialog} close={() => { setDialog(null); setTimeout(() => editor.commands.focus(), 0); }} open={setDialog} editor={editor} mode={mode} layout={layout} onLayout={setLayout} meta={meta} onMeta={setMeta} docName={title} fmt={fmt} saveOpts={saveOpts} onSaveOpts={setSaveOpts} onSave={(n, f, o) => { setSaveOpts(o); return doSave(n, f, o); }} toast={toast} />
      )}

      {toastMsg && (
        <div className="msx-toast no-print" role="status">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
