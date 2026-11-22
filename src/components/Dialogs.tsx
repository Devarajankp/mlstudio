import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { Trash2, Upload } from 'lucide-react';
import type { KeyboardMode } from '../utils/keyboardLayouts';
import { Dialog, Field } from './Dialog';
import { TypingField } from './TypingField';
import { PAGE_NUM_FORMATS, type DocMeta, type HAlign, type PageNumFormat } from '../lib/docmeta';
import { PAGE_SIZES, PX_PER_CM, type PageLayout } from '../lib/page';
import { FONTS } from '../lib/fonts';
import { SYMBOL_SETS, cpLabel, findSymbols } from '../lib/symbols';
import { addCustomFont, probeFont, removeCustomFont, type Probe } from '../lib/customFonts';
import type { Series } from '../lib/legacy';
import { FORMATS, formatInfo, type Format, type SaveOptions } from '../export/files';
import { insertPlain } from '../editor/fontCommands';
import { APP_NAME, APP_VERSION, BUILD_DATE, REPO_URL, RELEASES_URL, desktop, isNewer, latestVersion, IS_DESKTOP } from '../lib/app';

export type DialogName = 'symbols' | 'link' | 'bookmark' | 'headerfooter' | 'pagenum' | 'datetime' | 'pagesetup' | 'paragraph' | 'properties' | 'saveas' | 'fonts' | 'picture' | 'picfmt' | 'about';

export interface HostProps {
  dialog: DialogName | null;
  close(): void;
  open(d: DialogName): void;
  editor: Editor;
  mode: KeyboardMode;
  layout: PageLayout;
  onLayout(l: PageLayout): void;
  meta: DocMeta;
  onMeta(m: DocMeta): void;
  docName: string;
  fmt: Format;
  saveOpts: SaveOptions;
  onSaveOpts(o: SaveOptions): void;
  onSave(name: string, fmt: Format, o: SaveOptions): Promise<void> | void;
  toast(m: string): void;
}

const cmOf = (px: number) => +(px / PX_PER_CM).toFixed(2);
const pxOf = (cm: number) => Math.round(cm * PX_PER_CM);
const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }> = ({ primary, className = '', ...p }) => <button type="button" {...p} className={`msx-btn msx-dlgbtn${primary ? ' is-primary' : ''} ${className}`} />;

/* ------------------------------------------------------------------ symbols */

const SymbolDialog: React.FC<HostProps> = ({ editor, close }) => {
  const [set, setSet] = useState(SYMBOL_SETS[0].id);
  const [q, setQ] = useState('');
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('msx-symbols-recent') || '[]');
    } catch {
      return [];
    }
  });
  const [last, setLast] = useState('');
  const chars = useMemo(() => (q ? findSymbols(q) : (SYMBOL_SETS.find((s) => s.id === set)?.chars ?? [])), [q, set]);
  const put = (ch: string) => {
    insertPlain(editor, ch);
    setLast(ch);
    const next = [ch, ...recent.filter((r) => r !== ch)].slice(0, 24);
    setRecent(next);
    try {
      localStorage.setItem('msx-symbols-recent', JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  return (
    <Dialog title="Symbols" onClose={close} width={720} footer={<><span className="msx-hint">{last ? `${cpLabel(last)} inserted` : 'Click a symbol to insert it at the cursor. The window stays open.'}</span><Btn primary onClick={close}>Done</Btn></>}>
      <div className="msx-sym-layout">
        <nav>
          {SYMBOL_SETS.map((s) => (
            <button key={s.id} type="button" className={s.id === set && !q ? 'is-active' : ''} onClick={() => { setSet(s.id); setQ(''); }}>
              {s.label} <small>{s.chars.length}</small>
            </button>
          ))}
        </nav>
        <div>
          <input className="msx-input" placeholder="Type a character or a code like U+20B9 to find it…" value={q} onChange={(e) => setQ(e.target.value)} />
          {recent.length > 0 && !q && (
            <div className="msx-sym-recent">
              <b>Recent</b>
              {recent.map((r) => <button key={r} type="button" onClick={() => put(r)}>{r}</button>)}
            </div>
          )}
          <div className="msx-sym-grid">
            {chars.map((ch, i) => (
              <button key={ch + i} type="button" title={cpLabel(ch)} onClick={() => put(ch)}>
                {ch === '‌' ? 'ZWNJ' : ch === '‍' ? 'ZWJ' : ch}
              </button>
            ))}
            {!chars.length && <div className="msx-empty">Nothing found.</div>}
          </div>
        </div>
      </div>
    </Dialog>
  );
};

/* ------------------------------------------------------------------ link */

const LinkDialog: React.FC<HostProps> = ({ editor, close, mode }) => {
  const sel = editor.state.selection;
  const existing = editor.getAttributes('link').href as string | undefined;
  const selText = sel.empty ? '' : editor.state.doc.textBetween(sel.from, sel.to, ' ');
  const [text, setText] = useState(selText);
  const [href, setHref] = useState(existing ?? 'https://');
  const marks: string[] = [];
  editor.state.doc.descendants((n) => { if (n.type.name === 'bookmark') marks.push(n.attrs.name); });
  const apply = () => {
    let url = href.trim();
    if (!url) return;
    if (!url.startsWith('#') && !/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
    const c = editor.chain().focus();
    if (selText || existing) c.extendMarkRange('link').setLink({ href: url }).run();
    else c.insertContent({ type: 'text', text: text || url, marks: [{ type: 'link', attrs: { href: url } }] }).run();
    close();
  };
  return (
    <Dialog title={existing ? 'Edit link' : 'Insert link'} onClose={close} footer={<>{existing && <Btn onClick={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); close(); }}>Remove link</Btn>}<Btn onClick={close}>Cancel</Btn><Btn primary onClick={apply}>OK</Btn></>}>
      {!selText && !existing && <Field label="Text to show"><TypingField className="msx-input" mode={mode} value={text} onChange={setText} autoFocus /></Field>}
      <Field label="Address" hint="Web address, e-mail (mailto:…), or #bookmark name to jump inside this document">
        <input className="msx-input" value={href} onChange={(e) => setHref(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && apply()} />
      </Field>
      {marks.length > 0 && (
        <div className="msx-chiprow"><span>Bookmarks:</span>{marks.map((m) => <button key={m} type="button" onClick={() => setHref('#' + m)}>{m}</button>)}</div>
      )}
    </Dialog>
  );
};

/* ------------------------------------------------------------------ bookmark */

const BookmarkDialog: React.FC<HostProps> = ({ editor, close }) => {
  const [name, setName] = useState('');
  const list: Array<{ name: string; pos: number }> = [];
  editor.state.doc.descendants((n, pos) => { if (n.type.name === 'bookmark') list.push({ name: n.attrs.name, pos }); });
  const valid = /^[A-Za-z][A-Za-z0-9_]*$/.test(name);
  return (
    <Dialog title="Bookmark" onClose={close} footer={<Btn onClick={close}>Close</Btn>}>
      <Field label="Bookmark name" hint="Letters, digits and _ ; must start with a letter. Link to it with #name.">
        <div className="msx-row"><input className="msx-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /><Btn primary disabled={!valid || list.some((l) => l.name === name)} onClick={() => { editor.chain().focus().insertBookmark(name).run(); setName(''); close(); }}>Add</Btn></div>
      </Field>
      <div className="msx-list">
        {list.map((b) => (
          <div key={b.pos} className="msx-listrow">
            <span>🔖 {b.name}</span>
            <Btn onClick={() => { editor.chain().focus().setTextSelection(b.pos).scrollIntoView().run(); close(); }}>Go to</Btn>
            <Btn title="Delete" onClick={() => { editor.chain().focus().setNodeSelection(b.pos).deleteSelection().run(); close(); }}><Trash2 size={14} /></Btn>
          </div>
        ))}
        {!list.length && <div className="msx-empty">No bookmarks yet.</div>}
      </div>
    </Dialog>
  );
};

/* ------------------------------------------------------------------ header / footer / page numbers */

const AlignSel: React.FC<{ v: HAlign; on(v: HAlign): void }> = ({ v, on }) => (
  <select className="msx-select" value={v} onChange={(e) => on(e.target.value as HAlign)}>
    <option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option>
  </select>
);

const PageNumFields: React.FC<{ meta: DocMeta; onMeta(m: DocMeta): void }> = ({ meta, onMeta }) => {
  const pn = meta.pn;
  const set = (p: Partial<typeof pn>) => onMeta({ ...meta, pn: { ...pn, ...p } });
  return (
    <>
      <label className="msx-check"><input type="checkbox" checked={pn.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> Show page numbers</label>
      <div className="msx-grid2">
        <Field label="Position"><select className="msx-select" value={pn.position} onChange={(e) => set({ position: e.target.value as 'header' | 'footer' })}><option value="footer">Bottom of page (footer)</option><option value="header">Top of page (header)</option></select></Field>
        <Field label="Alignment"><AlignSel v={pn.align} on={(align) => set({ align })} /></Field>
        <Field label="Format"><select className="msx-select" value={pn.format} onChange={(e) => set({ format: e.target.value as PageNumFormat })}>{PAGE_NUM_FORMATS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select></Field>
        <Field label="Start at"><input className="msx-input" type="number" min={0} value={pn.start} onChange={(e) => set({ start: Math.max(0, parseInt(e.target.value) || 1) })} /></Field>
      </div>
    </>
  );
};

const HeaderFooterDialog: React.FC<HostProps> = ({ close, meta, onMeta, mode }) => {
  const hf = meta.hf;
  const set = (p: Partial<typeof hf>) => onMeta({ ...meta, hf: { ...hf, ...p } });
  const fonts = FONTS.filter((f) => f.series === 'unicode' || f.group.startsWith('English'));
  return (
    <Dialog title="Header, footer & page numbers" onClose={close} width={560} footer={<Btn primary onClick={close}>Done</Btn>}>
      <Field label="Header text" hint="Use {page}, {pages}, {date}, {title}, {author}. Type Malayalam with the active typing method.">
        <div className="msx-row"><TypingField className="msx-input" mode={mode} value={hf.header} onChange={(header) => set({ header })} /><AlignSel v={hf.headerAlign} on={(headerAlign) => set({ headerAlign })} /></div>
      </Field>
      <Field label="Footer text">
        <div className="msx-row"><TypingField className="msx-input" mode={mode} value={hf.footer} onChange={(footer) => set({ footer })} /><AlignSel v={hf.footerAlign} on={(footerAlign) => set({ footerAlign })} /></div>
      </Field>
      <div className="msx-grid2">
        <Field label="Font"><select className="msx-select" value={hf.font} onChange={(e) => set({ font: e.target.value })}>{fonts.map((f) => <option key={f.family} value={f.family}>{f.label}</option>)}</select></Field>
        <Field label="Size (pt)"><input className="msx-input" type="number" min={6} max={36} value={hf.size} onChange={(e) => set({ size: Math.min(36, Math.max(6, +e.target.value || 10)) })} /></Field>
      </div>
      <label className="msx-check"><input type="checkbox" checked={hf.skipFirst} onChange={(e) => set({ skipFirst: e.target.checked })} /> No header / footer on the first page</label>
      <hr />
      <PageNumFields meta={meta} onMeta={onMeta} />
    </Dialog>
  );
};

const PageNumDialog: React.FC<HostProps> = ({ close, meta, onMeta }) => (
  <Dialog title="Page number" onClose={close} footer={<Btn primary onClick={close}>Done</Btn>}><PageNumFields meta={meta} onMeta={onMeta} /></Dialog>
);

/* ------------------------------------------------------------------ date & time */

function dateFormats(d: Date): Array<[string, string]> {
  const f = (loc: string, o: Intl.DateTimeFormatOptions) => d.toLocaleString(loc, o);
  const p = (n: number) => String(n).padStart(2, '0');
  return [
    ['dd/mm/yyyy', `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`],
    ['dd-mm-yyyy', `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`],
    ['yyyy-mm-dd (ISO)', `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`],
    ['d MMMM yyyy', f('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })],
    ['EEEE, d MMMM yyyy', f('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })],
    ['Time (12 hour)', f('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })],
    ['Time (24 hour)', f('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })],
    ['Date and time', f('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })],
    ['മലയാളം: തീയതി', f('ml-IN', { day: 'numeric', month: 'long', year: 'numeric' })],
    ['മലയാളം: ആഴ്ച + തീയതി', f('ml-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })],
    ['മലയാളം അക്കങ്ങൾ: തീയതി', f('ml-IN-u-nu-mlym', { day: 'numeric', month: 'long', year: 'numeric' })],
    ['മലയാളം: സമയം', f('ml-IN', { hour: 'numeric', minute: '2-digit', hour12: true })],
  ];
}

const DateTimeDialog: React.FC<HostProps> = ({ editor, close }) => {
  const list = useMemo(() => dateFormats(new Date()), []);
  const [i, setI] = useState(0);
  return (
    <Dialog title="Date & time" onClose={close} footer={<><Btn onClick={close}>Cancel</Btn><Btn primary onClick={() => { insertPlain(editor, list[i][1]); close(); }}>Insert</Btn></>}>
      <div className="msx-list">
        {list.map(([name, text], k) => (
          <button key={name} type="button" className={`msx-listrow msx-pick${k === i ? ' is-active' : ''}`} onClick={() => setI(k)} onDoubleClick={() => { insertPlain(editor, text); close(); }}>
            <small>{name}</small>
            <span>{text}</span>
          </button>
        ))}
      </div>
    </Dialog>
  );
};

/* ------------------------------------------------------------------ page setup */

const PageSetupDialog: React.FC<HostProps> = ({ close, layout, onLayout }) => {
  const [l, setL] = useState<PageLayout>(layout);
  const groups = useMemo(() => {
    const m = new Map<string, Array<[string, string]>>();
    for (const [id, s] of Object.entries(PAGE_SIZES)) m.set(s.group, [...(m.get(s.group) ?? []), [id, s.label]]);
    return [...m.entries()];
  }, []);
  const mg = (k: keyof PageLayout['margins'], v: string) => setL({ ...l, margins: { ...l.margins, [k]: Math.max(0, pxOf(parseFloat(v) || 0)) } });
  return (
    <Dialog title="Page setup" onClose={close} width={520} footer={<><Btn onClick={close}>Cancel</Btn><Btn primary onClick={() => { onLayout(l); close(); }}>OK</Btn></>}>
      <Field label="Paper size">
        <select className="msx-select" value={l.size} onChange={(e) => setL({ ...l, size: e.target.value })}>
          {groups.map(([g, items]) => <optgroup key={g} label={g}>{items.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</optgroup>)}
        </select>
      </Field>
      {l.size === 'custom' && (
        <div className="msx-grid2">
          <Field label="Width (cm)"><input className="msx-input" type="number" step="0.1" min="3" value={cmOf(l.customW ?? 794)} onChange={(e) => setL({ ...l, customW: Math.max(60, pxOf(+e.target.value)) })} /></Field>
          <Field label="Height (cm)"><input className="msx-input" type="number" step="0.1" min="3" value={cmOf(l.customH ?? 1123)} onChange={(e) => setL({ ...l, customH: Math.max(60, pxOf(+e.target.value)) })} /></Field>
        </div>
      )}
      <Field label="Orientation"><select className="msx-select" value={l.landscape ? 'l' : 'p'} onChange={(e) => setL({ ...l, landscape: e.target.value === 'l' })}><option value="p">Portrait</option><option value="l">Landscape</option></select></Field>
      <div className="msx-grid2">
        {(['top', 'bottom', 'left', 'right'] as const).map((k) => (
          <Field key={k} label={`${k[0].toUpperCase()}${k.slice(1)} margin (cm)`}><input className="msx-input" type="number" step="0.1" min="0" value={cmOf(l.margins[k])} onChange={(e) => mg(k, e.target.value)} /></Field>
        ))}
      </div>
    </Dialog>
  );
};

/* ------------------------------------------------------------------ paragraph (line / paragraph spacing, indents) */

const ParagraphDialog: React.FC<HostProps> = ({ editor, close }) => {
  const a = editor.getAttributes(editor.isActive('heading') ? 'heading' : 'paragraph');
  const [line, setLine] = useState<string>(a.lineSpacing ? String(a.lineSpacing) : '');
  const [before, setBefore] = useState(String(a.spaceBefore ?? 0));
  const [after, setAfter] = useState(String(a.spaceAfter ?? 8));
  const [left, setLeft] = useState(String(cmOf(a.indentLeft || 0)));
  const [first, setFirst] = useState(String(cmOf(a.indentFirst || 0)));
  const [all, setAll] = useState(false);
  const apply = () => {
    const c = editor.chain().focus();
    if (all) c.selectAll();
    c.setLineSpacing(line ? Math.max(0.5, +line) : null).setParaSpacing(+before || 0, +after || 0).setIndents(pxOf(+left || 0), pxOf(+first || 0)).run();
    close();
  };
  return (
    <Dialog title="Paragraph" onClose={close} footer={<><Btn onClick={close}>Cancel</Btn><Btn primary onClick={apply}>OK</Btn></>}>
      <Field label="Line spacing" hint="1 = single, 1.5, 2 = double … any number from 0.5 up">
        <div className="msx-row">
          <select className="msx-select" value={['', '1', '1.15', '1.5', '2', '2.5', '3'].includes(line) ? line : 'x'} onChange={(e) => setLine(e.target.value === 'x' ? '1.25' : e.target.value)}>
            <option value="">Default (1.5)</option>{['1', '1.15', '1.5', '2', '2.5', '3'].map((s) => <option key={s} value={s}>{s}</option>)}<option value="x">Custom…</option>
          </select>
          <input className="msx-input" type="number" step="0.05" min="0.5" max="10" value={line} placeholder="1.5" onChange={(e) => setLine(e.target.value)} />
        </div>
      </Field>
      <div className="msx-grid2">
        <Field label="Space before (pt)"><input className="msx-input" type="number" min="0" value={before} onChange={(e) => setBefore(e.target.value)} /></Field>
        <Field label="Space after (pt)"><input className="msx-input" type="number" min="0" value={after} onChange={(e) => setAfter(e.target.value)} /></Field>
        <Field label="Left indent (cm)"><input className="msx-input" type="number" step="0.1" min="0" value={left} onChange={(e) => setLeft(e.target.value)} /></Field>
        <Field label="First line (cm, − = hanging)"><input className="msx-input" type="number" step="0.1" value={first} onChange={(e) => setFirst(e.target.value)} /></Field>
      </div>
      <label className="msx-check"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Apply to the whole document</label>
    </Dialog>
  );
};

/* ------------------------------------------------------------------ properties */

const PropertiesDialog: React.FC<HostProps> = ({ close, meta, onMeta, mode }) => {
  const [p, setP] = useState(meta.props);
  const f = (k: keyof typeof p, label: string, multi = false) => (
    <Field label={label}><TypingField className="msx-input" mode={mode} multiline={multi} rows={3} value={p[k]} onChange={(v) => setP({ ...p, [k]: v })} /></Field>
  );
  return (
    <Dialog title="Document properties" onClose={close} footer={<><Btn onClick={close}>Cancel</Btn><Btn primary onClick={() => { onMeta({ ...meta, props: { ...p, modified: new Date().toISOString() } }); close(); }}>OK</Btn></>}>
      {f('title', 'Title')}{f('author', 'Author')}{f('subject', 'Subject')}{f('keywords', 'Keywords (comma separated)')}{f('company', 'Organisation')}{f('description', 'Description / comments', true)}
      <small className="msx-hint">Created {new Date(p.created).toLocaleString()} · saved into DOCX, ODT, PDF, HTML and .mlstudio files.</small>
    </Dialog>
  );
};

/* ------------------------------------------------------------------ about */

const CREDITS: Array<[string, string]> = [
  ['Inscript keyboard layout', 'Government of India / C-DAC standard (a public standard).'],
  ['Phonetic (Manglish) scheme', 'Inspired by the Mozhi / Varamozhi style of phonetic Malayalam typing; implemented from scratch.'],
  ['Online word suggestions', 'Google Input Tools web service (optional, needs internet; subject to Google’s terms).'],
  ['English ⇄ Malayalam dictionary', 'Olam dataset (ODbL 1.0) via kiranps/English-Malayalam-Dictionary (MIT).'],
  ['Fonts', 'Noto Sans/Serif Malayalam (Google), Chilanka, Manjari, Gayathri, Meera, Rachana, Karumbi, Keraleeyam, Dyuthi, Anjali Old Lipi, Uroob (SMC / RIT), Anek Malayalam and Baloo Chettan 2 (Ek Type) – all SIL Open Font License 1.1. No proprietary fonts are bundled.'],
  ['Editor engine', 'TipTap / ProseMirror (MIT).'],
  ['Documents & PDF', 'docx, pdf-lib, fontkit, fflate, qpdf-wasm (MIT / Apache-2.0 / BSD).'],
  ['Desktop app', 'Electron (MIT) and koffi (MIT).'],
  ['Icons', 'Lucide (ISC).'],
];
const SHORTCUTS: Array<[string, string]> = [
  ['F1 – F7', 'Typing mode: Manglish, Inscript, GIST, Typewriter, Panchari, Varityper, English'],
  ['Ctrl+G', 'Switch Manglish ⇄ English'],
  ['F8', 'On-screen keyboard'],
  ['F9', 'Dictionary for the current word'],
  ['Ctrl+S / Ctrl+Shift+S', 'Save / Save as'],
  ['Ctrl+P', 'Print'],
  ['Alt+T / Alt+W', 'New tab / close tab'],
  ['Ctrl + / Ctrl − / Ctrl 0', 'Zoom in / out / 100 %'],
  ['Ctrl+Alt+R', 'Read the document aloud (Esc stops)'],
  ['Ctrl+/', 'This help (About)'],
  ['Tab / Shift+Tab', 'Move between toolbar buttons; Enter or Space presses a button'],
];

const AboutDialog: React.FC<HostProps> = ({ close }) => {
  const [msg, setMsg] = useState('');
  const check = async () => {
    setMsg('Checking…');
    const d = desktop();
    if (d) return setMsg(await d.checkUpdate());
    const l = await latestVersion();
    if (!l) return setMsg('Could not reach the update list (are you offline?).');
    setMsg(isNewer(l.version) ? `Version ${l.version} is available — reload this page to get it.` : `You have the latest version (${APP_VERSION}).`);
  };
  const link = (url: string, label: string) => (
    <a href={url} target="_blank" rel="noreferrer" onClick={(e) => { const d = desktop(); if (d) { e.preventDefault(); d.openExternal(url); } }}>{label}</a>
  );
  return (
    <Dialog title={`About ${APP_NAME}`} onClose={close} width={620} footer={<Btn primary onClick={close}>Close</Btn>}>
      <div className="msx-about-head">
        <img src="brand/logo-48.png" alt="" width={56} height={56} />
        <div>
          <h2>{APP_NAME} <small>മലയാളം സ്റ്റുഡിയോ</small></h2>
          <p>Version <b>{APP_VERSION}</b> · built {BUILD_DATE} · {IS_DESKTOP ? 'Windows app' : 'web app'}</p>
          <p className="msx-about-links">
            {REPO_URL && <>{link(REPO_URL, 'Source on GitHub')} · {link(RELEASES_URL, 'Download the Windows app')} · {link(`${REPO_URL}/issues`, 'Report a problem')}</>}
          </p>
        </div>
      </div>
      <div className="msx-row"><Btn onClick={check}>Check for updates</Btn><span role="status" className="msx-hint">{msg}</span></div>
      <h3 className="msx-about-h">Keyboard shortcuts</h3>
      <table className="msx-about-table"><tbody>{SHORTCUTS.map(([k, v]) => <tr key={k}><th scope="row"><kbd>{k}</kbd></th><td>{v}</td></tr>)}</tbody></table>
      <h3 className="msx-about-h">Accessibility</h3>
      <p className="msx-hint">Works with screen readers (NVDA, JAWS, Narrator, TalkBack): every button is labelled, changes of typing mode and saving are announced, and the whole app can be used with the keyboard only. Use the 🎨 button for larger text, high contrast and reduced motion, and “Read document aloud”.</p>
      <h3 className="msx-about-h">Credits &amp; licences</h3>
      <table className="msx-about-table"><tbody>{CREDITS.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody></table>
      <p className="msx-hint">Malayalam Studio is an independent project and is not affiliated with or endorsed by Microsoft, Google, C-DAC or any font or dictionary publisher. All trademarks belong to their owners. Free software under the MIT licence for its own code; see LICENSE and THIRD_PARTY_NOTICES in the project.</p>
    </Dialog>
  );
};

/* ------------------------------------------------------------------ save as */

const SaveDialog: React.FC<HostProps> = ({ close, docName, fmt, saveOpts, onSave, open, meta }) => {
  const [name, setName] = useState(docName || meta.props.title || 'Untitled');
  const [fm, setFm] = useState<Format>(fmt);
  const [o, setO] = useState<SaveOptions>(saveOpts);
  const [busy, setBusy] = useState(false);
  const pdf = o.pdf;
  const setPdf = (p: Partial<typeof pdf>) => setO({ ...o, pdf: { ...pdf, ...p } });
  const locked = !!pdf.userPassword || !!pdf.ownerPassword;
  return (
    <Dialog title="Save as" onClose={close} width={540} footer={<><Btn onClick={() => open('properties')}>Properties…</Btn><Btn onClick={close}>Cancel</Btn><Btn primary disabled={busy} onClick={async () => { setBusy(true); try { await onSave(name, fm, o); close(); } finally { setBusy(false); } }}>{busy ? 'Saving…' : 'Save'}</Btn></>}>
      <div className="msx-row">
        <Field label="File name"><input className="msx-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label="Type"><select className="msx-select" value={fm} onChange={(e) => setFm(e.target.value as Format)}>{FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select></Field>
      </div>
      {(fm === 'docx' || fm === 'odt' || fm === 'pdf') && (
        <Field label="Legacy fonts (ML-TT, MLW-TT…)" hint="Keep: the text stays in the legacy font, exactly as typed. Convert: the text becomes Unicode (Noto Sans Malayalam) so it reads and searches anywhere.">
          <select className="msx-select" value={o.legacy} onChange={(e) => setO({ ...o, legacy: e.target.value as 'keep' | 'unicode' })}><option value="keep">Keep the legacy font</option><option value="unicode">Convert to Unicode</option></select>
        </Field>
      )}
      {fm === 'txt' && (
        <Field label="Save the text as" hint="Unicode works everywhere. ML / FML series save the old-style legacy character codes (for use with ML-TT / MLW-TT fonts).">
          <select className="msx-select" value={o.txtAs} onChange={(e) => setO({ ...o, txtAs: e.target.value as 'unicode' | 'ml' | 'fml' })}><option value="unicode">Unicode series</option><option value="ml">ML series (legacy)</option><option value="fml">FML series (legacy)</option></select>
        </Field>
      )}
      {fm === 'mlstudio' && <label className="msx-check"><input type="checkbox" checked={o.embedFonts} onChange={(e) => setO({ ...o, embedFonts: e.target.checked })} /> Include the fonts I added (so the file opens correctly anywhere)</label>}
      {fm === 'pdf' && (
        <fieldset className="msx-fieldset">
          <legend>PDF options</legend>
          <Field label="Quality"><select className="msx-select" value={pdf.quality} onChange={(e) => setPdf({ quality: e.target.value as 'standard' | 'high' })}><option value="high">Maximum print quality – original pictures, vector text</option><option value="standard">Standard – smaller file (pictures reduced)</option></select></Field>
          <label className="msx-check"><input type="checkbox" checked={pdf.tagged} onChange={(e) => setPdf({ tagged: e.target.checked })} /> Accessible PDF (tagged structure, title, language, screen-reader text)</label>
          <div className="msx-grid2">
            <Field label="Password to open (optional)"><input className="msx-input" type="password" value={pdf.userPassword} onChange={(e) => setPdf({ userPassword: e.target.value })} autoComplete="new-password" /></Field>
            <Field label="Password for permissions (optional)"><input className="msx-input" type="password" value={pdf.ownerPassword} onChange={(e) => setPdf({ ownerPassword: e.target.value })} autoComplete="new-password" /></Field>
          </div>
          <div className="msx-checks">
            <label className="msx-check"><input type="checkbox" checked={pdf.allowPrint} onChange={(e) => setPdf({ allowPrint: e.target.checked })} /> Allow printing</label>
            <label className="msx-check"><input type="checkbox" checked={pdf.allowCopy} onChange={(e) => setPdf({ allowCopy: e.target.checked })} /> Allow copying text</label>
            <label className="msx-check"><input type="checkbox" checked={pdf.allowModify} onChange={(e) => setPdf({ allowModify: e.target.checked })} /> Allow editing</label>
          </div>
          <small className="msx-hint">{locked ? 'AES-256 encryption is applied. Screen readers are still allowed.' : 'Leave both passwords empty for an open PDF. Turning off a permission also uses AES-256.'}</small>
        </fieldset>
      )}
      <small className="msx-hint">{formatInfo(fm).label} · saved with the document properties.</small>
    </Dialog>
  );
};

/* ------------------------------------------------------------------ fonts */

interface Pending { file: File; bytes: ArrayBuffer; probe: Probe; series: Series; handwriting: boolean }

const FontsDialog: React.FC<HostProps> = ({ close, toast }) => {
  const [pending, setPending] = useState<Pending[]>([]);
  const [, bump] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { bump((n) => n + 1); }, []);
  const mine = FONTS.filter((f) => f.custom);
  const pick = async (files: FileList | null) => {
    const out: Pending[] = [];
    for (const file of Array.from(files ?? [])) {
      try {
        const bytes = await file.arrayBuffer();
        const probe = await probeFont(bytes, file.name);
        out.push({ file, bytes, probe, series: probe.series, handwriting: false });
      } catch {
        toast(`${file.name}: this is not a usable font file`);
      }
    }
    setPending((p) => [...p, ...out]);
  };
  const add = async () => {
    for (const p of pending) await addCustomFont(p.bytes, p.probe, { series: p.series, handwriting: p.handwriting });
    toast(`${pending.length} font${pending.length === 1 ? '' : 's'} added`);
    setPending([]);
    bump((n) => n + 1);
  };
  return (
    <Dialog title="My fonts" onClose={close} width={600} footer={<Btn primary onClick={close}>Done</Btn>}>
      <p className="msx-hint">Add .ttf, .otf, .woff or .woff2 files. The font is kept in this browser / app, appears in the font list, and works with the typing method that matches its type.</p>
      <input ref={input} type="file" accept=".ttf,.otf,.woff,.woff2" multiple hidden onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
      <Btn onClick={() => input.current?.click()}><Upload size={14} /> Choose font files…</Btn>
      {pending.map((p, i) => (
        <div key={i} className="msx-fontadd">
          <b>{p.probe.family}</b> <small>{p.probe.weight >= 600 ? 'Bold' : 'Regular'}{p.probe.style === 'italic' ? ' Italic' : ''} · {p.probe.hasMalayalam ? 'has Malayalam letters' : 'no Malayalam letters'}</small>
          <div className="msx-row">
            <select className="msx-select" value={p.series} onChange={(e) => setPending(pending.map((x, k) => (k === i ? { ...x, series: e.target.value as Series } : x)))}>
              <option value="unicode">Unicode font (Malayalam Unicode or English)</option>
              <option value="ml">Legacy – ML-TT series (fonts you added)</option>
              <option value="fml">Legacy – MLW-TT series (fonts you added)</option>
            </select>
            <Btn title="Remove" onClick={() => setPending(pending.filter((_, k) => k !== i))}><Trash2 size={14} /></Btn>
          </div>
          <div className="msx-fontsample-line" style={{ fontFamily: 'inherit' }}>{p.probe.hasMalayalam ? 'മലയാളം ടൈപ്പിംഗ് 123' : 'The quick brown fox 123'}</div>
        </div>
      ))}
      {pending.length > 0 && <Btn primary onClick={add}>Add {pending.length} font{pending.length === 1 ? '' : 's'}</Btn>}
      <hr />
      <b>Added fonts</b>
      <div className="msx-list">
        {mine.map((f) => (
          <div key={f.family} className="msx-listrow">
            <span style={{ fontFamily: `"${f.family}"` }}>{f.label}</span>
            <small>{f.handwriting ? 'handwriting · ' : ''}{f.series === 'unicode' ? 'Unicode' : f.series === 'ml' ? 'ML-TT' : 'MLW-TT'}</small>
            <Btn title="Remove this font" onClick={async () => { await removeCustomFont(f.family); bump((n) => n + 1); }}><Trash2 size={14} /></Btn>
          </div>
        ))}
        {!mine.length && <div className="msx-empty">No fonts added yet.</div>}
      </div>
    </Dialog>
  );
};

/* ------------------------------------------------------------------ picture from web address */

const PictureDialog: React.FC<HostProps> = ({ editor, close }) => {
  const [url, setUrl] = useState('https://');
  const [alt, setAlt] = useState('');
  return (
    <Dialog title="Picture from a web address" onClose={close} footer={<><Btn onClick={close}>Cancel</Btn><Btn primary onClick={() => { editor.chain().focus().setImage({ src: url, alt }).run(); close(); }}>Insert</Btn></>}>
      <Field label="Address of the picture"><input className="msx-input" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus /></Field>
      <Field label="Description (for screen readers)"><input className="msx-input" value={alt} onChange={(e) => setAlt(e.target.value)} /></Field>
      <small className="msx-hint">Pictures from the web are only exported to PDF/DOCX when the site allows it; for best results use “From this computer”.</small>
    </Dialog>
  );
};

/* ------------------------------------------------------------------ format picture (transparency, effects, position) */

const Slider: React.FC<{ label: string; value: number; min: number; max: number; unit?: string; onChange(v: number): void }> = ({ label, value, min, max, unit = '%', onChange }) => (
  <Field label={`${label}: ${value}${unit}`}>
    <div className="msx-row"><input type="range" min={min} max={max} value={value} onChange={(e) => onChange(+e.target.value)} style={{ flex: 1 }} /><input className="msx-input" type="number" style={{ width: 70 }} min={min} max={max} value={value} onChange={(e) => onChange(Math.min(max, Math.max(min, +e.target.value || 0)))} /></div>
  </Field>
);

const PictureFormatDialog: React.FC<HostProps> = ({ editor, close }) => {
  const [, bump] = useState(0);
  const a = editor.getAttributes('image') as Record<string, number | string | boolean>;
  const set = (p: Record<string, unknown>) => { editor.chain().setImageProps(p).run(); bump((n) => n + 1); };
  const n = (k: string, d: number) => (typeof a[k] === 'number' ? (a[k] as number) : d);
  const reset = () => set({ opacity: 100, brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, blur: 0, rotate: 0, radius: 0, borderWidth: 0, flipH: false, flipV: false, shadow: false });
  return (
    <Dialog title="Format picture" onClose={close} width={520} footer={<><Btn onClick={reset}>Reset effects</Btn><Btn primary onClick={close}>Done</Btn></>}>
      <fieldset className="msx-fieldset"><legend>Transparency &amp; colour</legend>
        <Slider label="Transparency (opacity)" value={n('opacity', 100)} min={5} max={100} onChange={(v) => set({ opacity: v })} />
        <Slider label="Brightness" value={n('brightness', 100)} min={20} max={200} onChange={(v) => set({ brightness: v })} />
        <Slider label="Contrast" value={n('contrast', 100)} min={20} max={200} onChange={(v) => set({ contrast: v })} />
        <Slider label="Colour saturation" value={n('saturate', 100)} min={0} max={300} onChange={(v) => set({ saturate: v })} />
        <Slider label="Black & white" value={n('grayscale', 0)} min={0} max={100} onChange={(v) => set({ grayscale: v })} />
        <Slider label="Sepia (old photo)" value={n('sepia', 0)} min={0} max={100} onChange={(v) => set({ sepia: v })} />
        <Slider label="Blur" value={n('blur', 0)} min={0} max={20} unit="px" onChange={(v) => set({ blur: v })} />
      </fieldset>
      <fieldset className="msx-fieldset"><legend>Shape, border &amp; rotation</legend>
        <Slider label="Rounded corners" value={n('radius', 0)} min={0} max={200} unit="px" onChange={(v) => set({ radius: v })} />
        <div className="msx-grid2">
          <Field label="Border thickness"><input className="msx-input" type="number" min={0} max={30} value={n('borderWidth', 0)} onChange={(e) => set({ borderWidth: Math.max(0, +e.target.value || 0) })} /></Field>
          <Field label="Border colour"><input type="color" className="msx-input" value={String(a.borderColor || '#000000')} onChange={(e) => set({ borderColor: e.target.value, borderWidth: n('borderWidth', 0) || 2 })} /></Field>
        </div>
        <Slider label="Rotation" value={n('rotate', 0)} min={-180} max={180} unit="°" onChange={(v) => set({ rotate: v })} />
        <div className="msx-checks">
          <label className="msx-check"><input type="checkbox" checked={!!a.flipH} onChange={(e) => set({ flipH: e.target.checked })} /> Flip left–right</label>
          <label className="msx-check"><input type="checkbox" checked={!!a.flipV} onChange={(e) => set({ flipV: e.target.checked })} /> Flip upside-down</label>
          <label className="msx-check"><input type="checkbox" checked={!!a.shadow} onChange={(e) => set({ shadow: e.target.checked })} /> Shadow</label>
        </div>
      </fieldset>
      <fieldset className="msx-fieldset"><legend>Position &amp; text wrapping (overlay)</legend>
        <Field label="Wrapping">
          <select className="msx-select" value={String(a.wrap || 'inline')} onChange={(e) => set({ wrap: e.target.value, ...(e.target.value === 'front' || e.target.value === 'behind' ? { x: n('x', 0) || 40, y: n('y', 0) || 40 } : {}) })}>
            <option value="inline">In line with text</option><option value="left">Square – picture on the left</option><option value="right">Square – picture on the right</option><option value="front">In front of text (overlay)</option><option value="behind">Behind text (see-through watermark)</option>
          </select>
        </Field>
        {(a.wrap === 'front' || a.wrap === 'behind') && (
          <div className="msx-grid2">
            <Field label="From left (px)"><input className="msx-input" type="number" value={n('x', 0)} onChange={(e) => set({ x: +e.target.value || 0 })} /></Field>
            <Field label="From top (px)"><input className="msx-input" type="number" value={n('y', 0)} onChange={(e) => set({ y: +e.target.value || 0 })} /></Field>
          </div>
        )}
        <small className="msx-hint">Drag the ✥ grip above the picture to move it; drag the white squares to resize; use the round handle to rotate.</small>
      </fieldset>
    </Dialog>
  );
};

/* ------------------------------------------------------------------ host */

export const Dialogs: React.FC<HostProps> = (p) => {
  switch (p.dialog) {
    case 'symbols': return <SymbolDialog {...p} />;
    case 'link': return <LinkDialog {...p} />;
    case 'bookmark': return <BookmarkDialog {...p} />;
    case 'headerfooter': return <HeaderFooterDialog {...p} />;
    case 'pagenum': return <PageNumDialog {...p} />;
    case 'datetime': return <DateTimeDialog {...p} />;
    case 'pagesetup': return <PageSetupDialog {...p} />;
    case 'paragraph': return <ParagraphDialog {...p} />;
    case 'properties': return <PropertiesDialog {...p} />;
    case 'saveas': return <SaveDialog {...p} />;
    case 'fonts': return <FontsDialog {...p} />;
    case 'picture': return <PictureDialog {...p} />;
    case 'picfmt': return <PictureFormatDialog {...p} />;
    case 'about': return <AboutDialog {...p} />;
    default: return null;
  }
};
