import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, BookOpen, Bold, CalendarDays, ChevronDown, Eraser, FileDown, FilePlus2,
  FolderOpen, Highlighter, IndentDecrease, IndentIncrease, Italic, Keyboard, Languages, List, ListOrdered, Minus, Moon,
  Printer, Redo2, RemoveFormatting, Ruler as RulerIcon, Save, Search, Strikethrough, Subscript, Sun, Superscript,
  Underline as UnderlineIcon, Undo2, ZoomIn, ZoomOut, Copy, Baseline, Table2, SlidersHorizontal, Image as ImageIcon, SquareDashed, PanelTop,
  PanelBottom, Hash, Bookmark as BookmarkIcon, Link2, Type, FileText, Settings2, Pencil, TableCellsMerge, TableCellsSplit,
  Rows3, Columns3, Trash2, PaintBucket, SeparatorHorizontal, FilePlus, Info, Printer as PrinterIcon,
} from 'lucide-react';
import type { DialogName } from './Dialogs';
import { formatInfo, FORMATS, type Format } from '../export/files';
import { DEFAULT_FONT, FONTS, fontByFamily, fontsVersion, getRecentFonts, normalizeFamilyValue, pushRecentFont, subscribeFonts, type FontEntry } from '../lib/fonts';
import { isLegacy, unicodeToLegacy } from '../lib/legacy';
import { MARGIN_PRESETS, PAGE_SIZES, PX_PER_CM, type PageLayout, type PageSizeId } from '../lib/page';
import { applyFontFamily, insertPlain } from '../editor/fontCommands';
import { KEYBOARD_MODES, type KeyboardMode } from '../utils/keyboardLayouts';
import type { ConvertSubTab } from './ConverterStudio';

export interface ViewState {
  ruler: boolean;
  guides: boolean;
  vkb: boolean;
  dark: boolean;
  zoom: number;
  unit?: 'cm' | 'in';
}

export interface RibbonActions {
  newDoc(): void;
  openFile(): void;
  save(): void;
  exportTxt(): void;
  exportHtml(): void;
  print(): void;
  find(): void;
  lookup(): void;
  openConvert(sub: ConvertSubTab): void;
  cleanup(): void;
  copyUnicode(): void;
  copyLegacy(series: 'ml' | 'fml'): void;
  saveAs(): void;
  exportAs(fmt: Format): void;
  pickImage(): void;
}

interface RibbonProps {
  editor: Editor;
  mode: KeyboardMode;
  onMode: (m: KeyboardMode) => void;
  layout: PageLayout;
  onLayout: (l: PageLayout) => void;
  view: ViewState;
  onView: (patch: Partial<ViewState>) => void;
  actions: RibbonActions;
  dialog: (d: DialogName) => void;
}

type TabId = 'file' | 'home' | 'insert' | 'layout' | 'view' | 'tools' | 'table' | 'picture';
const TABS: Array<[TabId, string]> = [
  ['file', 'File'],
  ['home', 'Home'],
  ['insert', 'Insert'],
  ['layout', 'Layout'],
  ['view', 'View'],
  ['tools', 'Tools'],
];

const SIZES = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 96, 120, 150, 200];
const SPACINGS = [1, 1.15, 1.5, 2, 2.5, 3];
const SAMPLE_ML = 'മലയാളം';

/* ------------------------------------------------------------------ small building blocks */

export const Btn: React.FC<{
  icon?: React.ReactNode;
  label?: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
  big?: boolean;
  onClick: () => void;
}> = ({ icon, label, title, active, disabled, big, onClick }) => (
  <button
    type="button"
    className={`msx-btn${active ? ' is-active' : ''}${big ? ' msx-btn-big' : ''}`}
    title={title}
    aria-label={title}
    aria-pressed={active}
    disabled={disabled}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
  >
    {icon}
    {label && <span>{label}</span>}
  </button>
);

export const Group: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="msx-group">
    <div className="msx-group-body">{children}</div>
    <div className="msx-group-title">{title}</div>
  </div>
);

/** Dropdown anchored with position:fixed so it is never clipped by the scrolling ribbon. */
export function usePopover() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const toggle = () => {
    const r = btn.current?.getBoundingClientRect();
    if (r) setPos({ left: Math.min(r.left, window.innerWidth - 300), top: r.bottom + 2 });
    setOpen((o) => !o);
  };
  return { open, setOpen, pos, btn, box, toggle };
}

/* ------------------------------------------------------------------ font picker */

const FontPicker: React.FC<{ editor: Editor; current: string; onAdd(): void; onOnline(): void }> = ({ editor, current, onAdd, onOnline }) => {
  const p = usePopover();
  const [q, setQ] = useState('');
  // re-render when fonts are added / finish loading (this was why saved fonts only showed after reopening My fonts)
  const ver = useSyncExternalStore(subscribeFonts, fontsVersion);
  const [recentTick, setRecentTick] = useState(0);
  const sample = useMemo(() => ({ unicode: SAMPLE_ML, ml: unicodeToLegacy(SAMPLE_ML, 'ml'), fml: unicodeToLegacy(SAMPLE_ML, 'fml') }), []);
  const groups = useMemo(() => {
    const m = new Map<string, FontEntry[]>();
    if (!q) {
      const recent = getRecentFonts().map((r) => FONTS.find((f) => f.family.toLowerCase() === r.toLowerCase())).filter((f): f is FontEntry => !!f);
      if (recent.length) m.set('Recently used', recent);
    }
    for (const f of FONTS) if (f.label.toLowerCase().includes(q.toLowerCase())) m.set(f.group, [...(m.get(f.group) ?? []), f]);
    return [...m.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, ver, recentTick, p.open]);
  const label = fontByFamily(current)?.label ?? (current || DEFAULT_FONT);

  return (
    <>
      <button ref={p.btn} type="button" className="msx-select msx-fontbtn" title="Font" onMouseDown={(e) => e.preventDefault()} onClick={p.toggle}>
        <span>{label}</span>
        <ChevronDown size={13} />
      </button>
      {p.open && (
        <div ref={p.box} className="msx-popover msx-fontlist" style={{ left: p.pos.left, top: p.pos.top }}>
          <input autoFocus className="msx-input" placeholder="Search fonts…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="msx-row" style={{ padding: '4px 0' }}>
            <button type="button" className="msx-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => { p.setOpen(false); onAdd(); }}>＋ Add font…</button>
            <button type="button" className="msx-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => { p.setOpen(false); onOnline(); }}>⬇ Get fonts online…</button>
          </div>
          <div className="msx-fontscroll">
            {groups.map(([group, fonts]) => (
              <div key={group}>
                <div className="msx-fontgroup">{group}</div>
                {fonts.map((f) => (
                  <button
                    key={group + f.family}
                    type="button"
                    className={`msx-fontrow${normalizeFamilyValue(current) === f.family ? ' is-active' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      applyFontFamily(editor, f.family);
                      pushRecentFont(f.family);
                      setRecentTick((n) => n + 1);
                      p.setOpen(false);
                    }}
                  >
                    <span>{f.label}</span>
                    <span className="msx-fontsample" style={{ fontFamily: `"${f.family}"` }}>
                      {f.group === 'English / Latin' ? 'Abc 123' : isLegacy(f.series) ? sample[f.series] : sample.unicode}
                    </span>
                  </button>
                ))}
              </div>
            ))}
            {!groups.length && <div className="msx-empty">No font matches “{q}”.</div>}
          </div>
        </div>
      )}
    </>
  );
};

/* ------------------------------------------------------------------ the ribbon */

const TableGrid: React.FC<{ onPick(r: number, c: number): void; onDraw(): void }> = ({ onPick, onDraw }) => {
  const [h, setH] = useState<[number, number]>([0, 0]);
  const [rows, setRows] = useState(8);
  const [cols, setCols] = useState(6);
  return (
    <div>
      <div className="msx-tablegrid-label">{h[0] ? `${h[0]} × ${h[1]}` : 'Insert table'}</div>
      <div className="msx-tablegrid" onMouseLeave={() => setH([0, 0])}>
        {Array.from({ length: 80 }, (_, k) => { const r = Math.floor(k / 10) + 1; const c = (k % 10) + 1; return <i key={k} className={r <= h[0] && c <= h[1] ? 'on' : ''} onMouseEnter={() => setH([r, c])} onClick={() => onPick(r, c)} />; })}
      </div>
      <div className="msx-row" style={{ padding: 4 }}>
        <input className="msx-input" type="number" min={1} max={100} value={rows} onChange={(e) => setRows(+e.target.value)} style={{ width: 54 }} title="Rows" /> ×
        <input className="msx-input" type="number" min={1} max={30} value={cols} onChange={(e) => setCols(+e.target.value)} style={{ width: 54 }} title="Columns" />
        <button type="button" className="msx-btn" onClick={() => onPick(Math.max(1, rows), Math.max(1, cols))}>Insert</button>
      </div>
      <button type="button" className="msx-fontrow" onClick={onDraw}>✏️ Draw table…</button>
    </div>
  );
};

/** Drag a rectangle on the page; the table gets as many rows / columns as fit the box. */
const DrawTable: React.FC<{ editor: Editor; done(): void }> = ({ editor, done }) => {
  const [a, setA] = useState<[number, number] | null>(null);
  const [b, setB] = useState<[number, number] | null>(null);
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && done(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [done]);
  const box = a && b ? { left: Math.min(a[0], b[0]), top: Math.min(a[1], b[1]), width: Math.abs(a[0] - b[0]), height: Math.abs(a[1] - b[1]) } : null;
  const dims = box ? { c: Math.max(1, Math.round(box.width / 90)), r: Math.max(1, Math.round(box.height / 30)) } : null;
  return (
    <div className="msx-drawtable no-print" style={{ position: 'fixed' }}
      onMouseDown={(e) => { setA([e.clientX, e.clientY]); setB([e.clientX, e.clientY]); }}
      onMouseMove={(e) => a && setB([e.clientX, e.clientY])}
      onMouseUp={() => {
        if (box && dims) {
          const at = editor.view.posAtCoords({ left: box.left + 2, top: box.top + 2 });
          const c = editor.chain().focus();
          if (at) c.setTextSelection(at.pos);
          c.insertTable({ rows: dims.r, cols: dims.c, withHeaderRow: false }).run();
        }
        done();
      }}>
      <div style={{ position: 'fixed', top: 8, left: '50%', transform: 'translateX(-50%)', background: '#111', color: '#fff', padding: '4px 12px', borderRadius: 6, fontSize: 12 }}>Drag to draw the table{dims ? ` — ${dims.r} rows × ${dims.c} columns` : ''} · Esc to cancel</div>
      {box && <div className="msx-drawtable-box" style={box} />}
    </div>
  );
};

export const Ribbon: React.FC<RibbonProps> = ({ editor, mode, onMode, layout, onLayout, view, onView, actions, dialog }) => {
  const [tab, setTab] = useState<TabId>('home');
  const tblPick = usePopover();
  const exp = usePopover();
  const [draw, setDraw] = useState(false);
  const marg = usePopover();

  const st = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const ts = e.getAttributes('textStyle');
      const para = e.getAttributes(e.isActive('heading') ? 'heading' : 'paragraph');
      return {
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        underline: e.isActive('underline'),
        strike: e.isActive('strike'),
        sub: e.isActive('subscript'),
        sup: e.isActive('superscript'),
        bullet: e.isActive('bulletList'),
        ordered: e.isActive('orderedList'),
        align: (['left', 'center', 'right', 'justify'] as const).find((a) => e.isActive({ textAlign: a })) ?? 'left',
        style: e.isActive('heading', { level: 1 }) ? 'h1' : e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : 'p',
        fontFamily: normalizeFamilyValue(ts.fontFamily as string | undefined),
        fontSize: parseFloat(ts.fontSize as string) || 0,
        color: (ts.color as string) || '#000000',
        lineSpacing: Number(para.lineSpacing) || 0,
        inTable: e.isActive('table'),
        inImage: e.isActive('image'),
        imgW: Number(e.getAttributes('image').width) || 0,
        imgAlt: String(e.getAttributes('image').alt ?? ''),
        imgAlign: String(e.getAttributes('image').align ?? 'left'),
        imgWrap: String(e.getAttributes('image').wrap ?? 'inline'),
        imgOpacity: Number(e.getAttributes('image').opacity ?? 100),
        rowH: Number(e.getAttributes('table').rowHeight ?? 0),
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      };
    },
  });

  const run = () => editor.chain().focus();

  return (
    <div className="msx-ribbon no-print">
      <div className="msx-tabs" role="tablist">
        {[...TABS, ...(st.inTable ? [['table', 'Table design & layout'] as [TabId, string]] : []), ...(st.inImage ? [['picture', 'Picture'] as [TabId, string]] : [])].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`msx-tab${tab === id ? ' is-active' : ''}${id === 'file' ? ' msx-tab-file' : ''}${id === 'table' || id === 'picture' ? ' msx-tab-ctx' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className="msx-ribbon-body">
        {tab === 'file' && (
          <>
            <Group title="Document">
              <Btn big icon={<FilePlus2 size={22} />} label="New" title="New document" onClick={actions.newDoc} />
              <Btn big icon={<FolderOpen size={22} />} label="Open" title="Open .mlstudio, .docx, .odt, .html or .txt" onClick={actions.openFile} />
              <Btn big icon={<Save size={22} />} label="Save" title="Save (Ctrl+S) in the type chosen beside the file name" onClick={actions.save} />
              <Btn big icon={<FilePlus size={22} />} label="Save as…" title="Choose name, type and options" onClick={actions.saveAs} />
              <Btn big icon={<Info size={22} />} label="Properties" title="Title, author, subject, keywords" onClick={() => dialog('properties')} />
            </Group>
            <Group title="Save a copy as">
              <div className="msx-row">
                {FORMATS.slice(0, 3).map((f) => <Btn key={f.id} icon={<FileDown size={15} />} label={f.ext} title={`Save as ${f.label}`} onClick={() => actions.exportAs(f.id)} />)}
              </div>
              <div className="msx-row">
                {FORMATS.slice(3).map((f) => <Btn key={f.id} icon={<FileDown size={15} />} label={f.ext} title={`Save as ${f.label}`} onClick={() => actions.exportAs(f.id)} />)}
              </div>
            </Group>
            <Group title="Print & fonts">
              <Btn big icon={<PrinterIcon size={22} />} label="Print" title="Print directly (Ctrl+P)" onClick={actions.print} />
              <Btn big icon={<Type size={22} />} label="My fonts" title="Add your own fonts" onClick={() => dialog('fonts')} />
              <Btn big icon={<Type size={22} />} label="Get fonts" title="Install free open-licence Malayalam fonts from the internet" onClick={() => dialog('onlinefonts')} />
            </Group>
            <Group title="Help">
              <Btn big icon={<Info size={22} />} label="About" title="About Malayalam Studio: version, updates, shortcuts, credits (F1)" onClick={() => dialog('about')} />
            </Group>
          </>
        )}

        {tab === 'home' && (
          <>
            <Group title="Print">
              <Btn big icon={<PrinterIcon size={22} />} label="Print" title="Print directly (Ctrl+P)" onClick={actions.print} />
            </Group>
            <Group title="Undo">
              <Btn icon={<Undo2 size={16} />} title="Undo (Ctrl+Z)" disabled={!st.canUndo} onClick={() => run().undo().run()} />
              <Btn icon={<Redo2 size={16} />} title="Redo (Ctrl+Y)" disabled={!st.canRedo} onClick={() => run().redo().run()} />
            </Group>

            <Group title="Font">
              <div className="msx-row">
                <FontPicker editor={editor} current={st.fontFamily} onAdd={() => dialog('fonts')} onOnline={() => dialog('onlinefonts')} />
                <input className="msx-select msx-size" list="msx-sizes" title="Font size (pt) - type any number" key={st.fontSize} defaultValue={st.fontSize || ''} placeholder="12" inputMode="decimal"
                  onKeyDown={(e) => { if (e.key === 'Enter') { const v = parseFloat((e.target as HTMLInputElement).value); if (v > 0 && v < 1000) run().setFontSize(`${v}pt`).run(); } }}
                  onChange={(e) => { const v = e.target.value; if (SIZES.includes(Number(v))) run().setFontSize(`${v}pt`).run(); }} />
                <datalist id="msx-sizes">{SIZES.map((z) => <option key={z} value={z} />)}</datalist>
              </div>
              <div className="msx-row">
                <Btn icon={<Bold size={16} />} title="Bold (Ctrl+B)" active={st.bold} onClick={() => run().toggleBold().run()} />
                <Btn icon={<Italic size={16} />} title="Italic (Ctrl+I)" active={st.italic} onClick={() => run().toggleItalic().run()} />
                <Btn icon={<UnderlineIcon size={16} />} title="Underline (Ctrl+U)" active={st.underline} onClick={() => run().toggleUnderline().run()} />
                <Btn icon={<Strikethrough size={16} />} title="Strikethrough" active={st.strike} onClick={() => run().toggleStrike().run()} />
                <Btn icon={<Subscript size={16} />} title="Subscript" active={st.sub} onClick={() => run().toggleSubscript().run()} />
                <Btn icon={<Superscript size={16} />} title="Superscript" active={st.sup} onClick={() => run().toggleSuperscript().run()} />
                <label className="msx-btn msx-colorbtn" title="Text colour" onMouseDown={(e) => e.stopPropagation()}>
                  <Baseline size={16} />
                  <i style={{ background: st.color }} />
                  <input type="color" value={st.color.startsWith('#') ? st.color : '#000000'} onChange={(e) => run().setColor(e.target.value).run()} />
                </label>
                <label className="msx-btn msx-colorbtn" title="Highlight colour">
                  <Highlighter size={16} />
                  <i style={{ background: '#fde047' }} />
                  <input type="color" defaultValue="#fde047" onChange={(e) => run().setHighlight({ color: e.target.value }).run()} />
                </label>
                <Btn
                  icon={<RemoveFormatting size={16} />}
                  title="Clear formatting (keeps the font)"
                  onClick={() => run().unsetBold().unsetItalic().unsetUnderline().unsetStrike().unsetSubscript().unsetSuperscript().unsetColor().unsetHighlight().unsetFontSize().run()}
                />
              </div>
            </Group>

            <Group title="Paragraph">
              <div className="msx-row">
                <Btn icon={<List size={16} />} title="Bullets" active={st.bullet} onClick={() => run().toggleBulletList().run()} />
                <Btn icon={<ListOrdered size={16} />} title="Numbering" active={st.ordered} onClick={() => run().toggleOrderedList().run()} />
                <Btn icon={<IndentDecrease size={16} />} title="Decrease indent (Ctrl+Shift+M)" onClick={() => editor.commands.setIndents(Math.max(0, (editor.getAttributes('paragraph').indentLeft || 0) - 48), editor.getAttributes('paragraph').indentFirst || 0)} />
                <Btn icon={<IndentIncrease size={16} />} title="Increase indent (Ctrl+M)" onClick={() => editor.commands.setIndents((editor.getAttributes('paragraph').indentLeft || 0) + 48, editor.getAttributes('paragraph').indentFirst || 0)} />
              </div>
              <div className="msx-row">
                <Btn icon={<AlignLeft size={16} />} title="Align left (Ctrl+Shift+L)" active={st.align === 'left'} onClick={() => run().setTextAlign('left').run()} />
                <Btn icon={<AlignCenter size={16} />} title="Centre (Ctrl+Shift+E)" active={st.align === 'center'} onClick={() => run().setTextAlign('center').run()} />
                <Btn icon={<AlignRight size={16} />} title="Align right (Ctrl+Shift+R)" active={st.align === 'right'} onClick={() => run().setTextAlign('right').run()} />
                <Btn icon={<AlignJustify size={16} />} title="Justify (Ctrl+Shift+J)" active={st.align === 'justify'} onClick={() => run().setTextAlign('justify').run()} />
                <select className="msx-select" title="Line spacing" value={st.lineSpacing || ''} onChange={(e) => editor.commands.setLineSpacing(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Line 1.5</option>
                  {SPACINGS.map((s) => (
                    <option key={s} value={s}>
                      {s.toFixed(2).replace(/0$/, '')}
                    </option>
                  ))}
                </select>
              </div>
            </Group>

            <Group title="Styles">
              <select
                className="msx-select msx-style"
                title="Paragraph style"
                value={st.style}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'p') run().setParagraph().run();
                  else run().setHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run();
                }}
              >
                <option value="p">Normal</option>
                <option value="h1">Heading 1</option>
                <option value="h2">Heading 2</option>
                <option value="h3">Heading 3</option>
              </select>
            </Group>

            <Group title="Editing">
              <Btn big icon={<Search size={20} />} label="Find & Replace" title="Find & Replace (Ctrl+F)" onClick={actions.find} />
              <Btn big icon={<BookOpen size={20} />} label="Dictionary" title="Look up the selected word (F9)" onClick={actions.lookup} />
            </Group>
          </>
        )}

        {tab === 'insert' && (
          <>
            <Group title="Table">
              <button ref={tblPick.btn} type="button" className="msx-btn msx-btn-big" title="Insert a table" onMouseDown={(e) => e.preventDefault()} onClick={tblPick.toggle}>
                <Table2 size={22} />
                <span>Table ▾</span>
              </button>
              {tblPick.open && (
                <div ref={tblPick.box} className="msx-popover" style={{ left: tblPick.pos.left, top: tblPick.pos.top }}>
                  <TableGrid onPick={(r, c) => { run().insertTable({ rows: r, cols: c, withHeaderRow: false }).run(); tblPick.setOpen(false); }} onDraw={() => { setDraw(true); tblPick.setOpen(false); }} />
                </div>
              )}
              <Btn big icon={<Pencil size={22} />} label="Draw table" title="Drag on the page to draw a table" onClick={() => setDraw(true)} />
            </Group>
            <Group title="Illustrations">
              <Btn big icon={<ImageIcon size={22} />} label="Picture" title="Insert a picture from your computer (you can also paste or drop one)" onClick={actions.pickImage} />
              <Btn big icon={<Link2 size={22} />} label="From web" title="Picture from a web address" onClick={() => dialog('picture')} />
              <Btn big icon={<SquareDashed size={22} />} label="Text box" title="Draw a text box (drag its right edge to resize)" onClick={() => run().insertTextBox().run()} />
            </Group>
            <Group title="Header & footer">
              <Btn big icon={<PanelTop size={22} />} label="Header" title="Header text" onClick={() => dialog('headerfooter')} />
              <Btn big icon={<PanelBottom size={22} />} label="Footer" title="Footer text" onClick={() => dialog('headerfooter')} />
              <Btn big icon={<Hash size={22} />} label="Page number" title="Page numbers" onClick={() => dialog('pagenum')} />
            </Group>
            <Group title="Text">
              <Btn big icon={<CalendarDays size={22} />} label="Date & time" title="Date and time in English or Malayalam" onClick={() => dialog('datetime')} />
              <Btn big icon={<Languages size={22} />} label="Symbols" title="Symbols and special characters" onClick={() => dialog('symbols')} />
            </Group>
            <Group title="Links">
              <Btn big icon={<Link2 size={22} />} label="Link" title="Hyperlink (Ctrl+K)" onClick={() => dialog('link')} />
              <Btn big icon={<BookmarkIcon size={22} />} label="Bookmark" title="Bookmark" onClick={() => dialog('bookmark')} />
            </Group>
            <Group title="Break">
              <Btn big icon={<SeparatorHorizontal size={22} />} label="Page break" title="Start a new page (Ctrl+Enter)" onClick={() => run().insertPageBreak().run()} />
              <Btn big icon={<Minus size={22} />} label="Line" title="Horizontal line" onClick={() => run().setHorizontalRule().run()} />
            </Group>
          </>
        )}

        {tab === 'table' && (
          <>
            <Group title="Rows & columns">
              <div className="msx-row">
                <Btn icon={<Rows3 size={16} />} label="Row above" title="Insert row above" onClick={() => run().addRowBefore().run()} />
                <Btn icon={<Rows3 size={16} />} label="Row below" title="Insert row below" onClick={() => run().addRowAfter().run()} />
                <Btn icon={<Trash2 size={16} />} label="Delete row" title="Delete row" onClick={() => run().deleteRow().run()} />
              </div>
              <div className="msx-row">
                <Btn icon={<Columns3 size={16} />} label="Column left" title="Insert column left" onClick={() => run().addColumnBefore().run()} />
                <Btn icon={<Columns3 size={16} />} label="Column right" title="Insert column right" onClick={() => run().addColumnAfter().run()} />
                <Btn icon={<Trash2 size={16} />} label="Delete column" title="Delete column" onClick={() => run().deleteColumn().run()} />
              </div>
            </Group>
            <Group title="Merge">
              <Btn big icon={<TableCellsMerge size={20} />} label="Merge cells" title="Merge the selected cells (drag across cells first)" onClick={() => run().mergeCells().run()} />
              <Btn big icon={<TableCellsSplit size={20} />} label="Split cell" title="Split a merged cell" onClick={() => run().splitCell().run()} />
            </Group>
            <Group title="Style">
              <div className="msx-row">
                <Btn label="Header row" title="Toggle header row" onClick={() => run().toggleHeaderRow().run()} />
                <Btn label="Header column" title="Toggle header column" onClick={() => run().toggleHeaderColumn().run()} />
                <label className="msx-btn msx-colorbtn" title="Cell shading"><PaintBucket size={16} /><i style={{ background: '#fde68a' }} /><input type="color" defaultValue="#fde68a" onChange={(e) => run().setCellBackground(e.target.value).run()} /></label>
                <Btn label="No shading" title="Remove shading" onClick={() => run().setCellBackground(null).run()} />
              </div>
              <div className="msx-row">
                <select className="msx-select" title="Borders" defaultValue="all" onChange={(e) => run().setTableStyle({ borders: e.target.value }).run()}>
                  <option value="all">All borders</option><option value="outside">Outside only</option><option value="horizontal">Horizontal lines</option><option value="vertical">Vertical lines</option><option value="none">No borders</option>
                </select>
                <select className="msx-select" title="Border width" defaultValue="1" onChange={(e) => run().setTableStyle({ borderWidth: Number(e.target.value) }).run()}>
                  {[0.5, 1, 1.5, 2, 3, 4].map((w) => <option key={w} value={w}>{w}px</option>)}
                </select>
                <label className="msx-btn msx-colorbtn" title="Border colour"><Baseline size={16} /><i style={{ background: '#000' }} /><input type="color" defaultValue="#000000" onChange={(e) => run().setTableStyle({ borderColor: e.target.value }).run()} /></label>
              </div>
            </Group>
            <Group title="Layout">
              <div className="msx-row">
                <select className="msx-select" title="Vertical alignment in cell" defaultValue="top" onChange={(e) => run().setCellVAlign(e.target.value as 'top' | 'middle' | 'bottom').run()}>
                  <option value="top">Align top</option><option value="middle">Align middle</option><option value="bottom">Align bottom</option>
                </select>
                <select className="msx-select" title="Table position" defaultValue="left" onChange={(e) => run().setTableStyle({ align: e.target.value }).run()}>
                  <option value="left">Table left</option><option value="center">Table centre</option><option value="right">Table right</option>
                </select>
                <select className="msx-select" title="Table width" defaultValue="auto" onChange={(e) => run().setTableStyle({ width: e.target.value }).run()}>
                  <option value="auto">Width: as set</option><option value="full">Width: full page</option>
                </select>
              </div>
            </Group>
            <Group title="Size">
              <div className="msx-row"><span className="msx-hint">Row height</span><input className="msx-input" style={{ width: 62 }} type="number" min={0} step={2} key={st.rowH} defaultValue={st.rowH || ''} placeholder="auto" onBlur={(e) => run().setTableProps({ rowHeight: e.target.value ? Number(e.target.value) : null }).run()} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} /><span className="msx-hint">px</span></div>
              <small className="msx-hint">Drag the table frame handles to resize; drag the ✥ grip to move.</small>
            </Group>
            <Group title="Delete">
              <Btn big icon={<Trash2 size={20} />} label="Delete table" title="Delete the whole table" onClick={() => run().deleteTable().run()} />
            </Group>
          </>
        )}

        {tab === 'picture' && (
          <>
            <Group title="Size">
              <div className="msx-row">
                <span className="msx-hint">Width</span>
                <input className="msx-input" style={{ width: 70 }} type="number" min={1} step={0.5} key={st.imgW} defaultValue={st.imgW ? +(st.imgW / PX_PER_CM).toFixed(1) : ''} placeholder="cm" onBlur={(e) => e.target.value && run().setImageProps({ width: Math.round(Number(e.target.value) * PX_PER_CM) }).run()} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
                <span className="msx-hint">cm</span>
              </div>
              <div className="msx-row">
                {[25, 50, 75, 100].map((p) => <Btn key={p} label={`${p}%`} title={`${p}% of the text width`} onClick={() => run().setImageProps({ width: Math.round(((layout.landscape ? 1 : 1) * (document.querySelector('.msx-prose') as HTMLElement | null)?.clientWidth! || 600) * p / 100) }).run()} />)}
              </div>
            </Group>
            <Group title="Position">
              <Btn icon={<AlignLeft size={16} />} title="Left" active={st.imgAlign === 'left'} onClick={() => run().setImageProps({ align: 'left' }).run()} />
              <Btn icon={<AlignCenter size={16} />} title="Centre" active={st.imgAlign === 'center'} onClick={() => run().setImageProps({ align: 'center' }).run()} />
              <Btn icon={<AlignRight size={16} />} title="Right" active={st.imgAlign === 'right'} onClick={() => run().setImageProps({ align: 'right' }).run()} />
            </Group>
            <Group title="Adjust">
              <Btn big icon={<SlidersHorizontal size={22} />} label="Format…" title="Transparency, brightness, contrast, border, rotation, overlay" onClick={() => dialog('picfmt')} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <select className="msx-select" title="Text wrapping / overlay" value={String(st.imgWrap)} onChange={(e) => run().setImageProps({ wrap: e.target.value, ...(e.target.value === 'front' || e.target.value === 'behind' ? { x: 40, y: 40 } : {}) }).run()}>
                  <option value="inline">In line with text</option><option value="left">Square – left</option><option value="right">Square – right</option><option value="front">In front of text</option><option value="behind">Behind text</option>
                </select>
                <div className="msx-row"><span className="msx-hint">Opacity</span><input type="range" min={5} max={100} value={st.imgOpacity} onChange={(e) => run().setImageProps({ opacity: Number(e.target.value) }).run()} style={{ width: 90 }} /></div>
              </div>
            </Group>
            <Group title="Accessibility">
              <input className="msx-input" style={{ width: 240 }} key={st.imgAlt} defaultValue={st.imgAlt} placeholder="Describe the picture (alt text)" onBlur={(e) => run().setImageProps({ alt: e.target.value }).run()} />
            </Group>
            <Group title="Delete">
              <Btn big icon={<Trash2 size={20} />} label="Delete" title="Delete picture" onClick={() => run().deleteSelection().run()} />
            </Group>
          </>
        )}

        {tab === 'layout' && (
          <>
            <Group title="Page setup">
              <div className="msx-row">
                <select className="msx-select" title="Page size" value={layout.size} onChange={(e) => onLayout({ ...layout, size: e.target.value as PageSizeId })}>
                  {Object.entries(PAGE_SIZES).reduce<Array<[string, Array<[string, string]>]>>((acc, [id, s]) => { const g = acc.find((x) => x[0] === s.group); if (g) g[1].push([id, s.label]); else acc.push([s.group, [[id, s.label]]]); return acc; }, []).map(([g, items]) => (
                    <optgroup key={g} label={g}>{items.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</optgroup>
                  ))}
                </select>
                <select className="msx-select" title="Orientation" value={layout.landscape ? 'l' : 'p'} onChange={(e) => onLayout({ ...layout, landscape: e.target.value === 'l' })}>
                  <option value="p">Portrait</option>
                  <option value="l">Landscape</option>
                </select>
              </div>
              <div className="msx-row">
                <button ref={marg.btn} type="button" className="msx-select" onMouseDown={(e) => e.preventDefault()} onClick={marg.toggle}>Margins ▾</button>
                {marg.open && (
                  <div ref={marg.box} className="msx-popover" style={{ left: marg.pos.left, top: marg.pos.top }}>
                    {MARGIN_PRESETS.map((m) => (
                      <button key={m.label} type="button" className="msx-fontrow" onClick={() => { onLayout({ ...layout, margins: m.margins }); marg.setOpen(false); }}>{m.label}</button>
                    ))}
                  </div>
                )}
                <Btn icon={<Settings2 size={15} />} label="More…" title="Custom paper size and exact margins" onClick={() => dialog('pagesetup')} />
              </div>
            </Group>
            <Group title="Paragraph">
              <div className="msx-row">
                <select className="msx-select" title="Line spacing" value={st.lineSpacing || ''} onChange={(e) => editor.commands.setLineSpacing(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Line 1.5</option>
                  {SPACINGS.map((s) => <option key={s} value={s}>{s}</option>)}
                  {st.lineSpacing && !SPACINGS.includes(st.lineSpacing) && <option value={st.lineSpacing}>{st.lineSpacing}</option>}
                </select>
                <Btn icon={<Settings2 size={15} />} label="Spacing & indents…" title="Exact line spacing, space before / after, indents" onClick={() => dialog('paragraph')} />
              </div>
            </Group>
            <Group title="Page">
              <Btn big icon={<Hash size={22} />} label="Page numbers" title="Page numbers: position, format, start" onClick={() => dialog('pagenum')} />
              <Btn big icon={<PanelTop size={22} />} label="Header & footer" title="Header and footer" onClick={() => dialog('headerfooter')} />
              <Btn big icon={<SeparatorHorizontal size={22} />} label="Page break" title="Page break" onClick={() => run().insertPageBreak().run()} />
            </Group>
          </>
        )}

        {tab === 'view' && (
          <>
            <Group title="Show">
              <Btn big icon={<RulerIcon size={22} />} label="Ruler" title="Show / hide ruler" active={view.ruler} onClick={() => onView({ ruler: !view.ruler })} />
              <Btn big icon={<Minus size={22} />} label="Page breaks" title="Show approximate page break guides" active={view.guides} onClick={() => onView({ guides: !view.guides })} />
              <Btn big icon={<Keyboard size={22} />} label="On-screen keyboard" title="Show / hide on-screen keyboard (F8)" active={view.vkb} onClick={() => onView({ vkb: !view.vkb })} />
            </Group>
            <Group title="Zoom">
              <Btn icon={<ZoomOut size={16} />} title="Zoom out" onClick={() => onView({ zoom: Math.max(0.25, +(view.zoom - (view.zoom > 1.01 ? 0.1 : 0.05)).toFixed(2)) })} />
              <select className="msx-select" value={Math.round(view.zoom * 100)} onChange={(e) => onView({ zoom: Number(e.target.value) / 100 })}>
                {[25, 50, 75, 90, 100, 110, 125, 150, 175, 200, 250, 300].map((z) => (
                  <option key={z} value={z}>
                    {z}%
                  </option>
                ))}
                {![25, 50, 75, 90, 100, 110, 125, 150, 175, 200, 250, 300].includes(Math.round(view.zoom * 100)) && <option value={Math.round(view.zoom * 100)}>{Math.round(view.zoom * 100)}%</option>}
              </select>
              <Btn icon={<ZoomIn size={16} />} title="Zoom in" onClick={() => onView({ zoom: Math.min(3, +(view.zoom + (view.zoom >= 0.99 ? 0.1 : 0.05)).toFixed(2)) })} />
            </Group>
            <Group title="Ruler unit">
              <select className="msx-select" value={view.unit ?? 'cm'} onChange={(e) => onView({ unit: e.target.value as 'cm' | 'in' })} title="Ruler units">
                <option value="cm">Centimetres / mm</option>
                <option value="in">Inches (1/16)</option>
              </select>
            </Group>
            <Group title="Theme">
              <Btn big icon={view.dark ? <Sun size={22} /> : <Moon size={22} />} label={view.dark ? 'Light' : 'Dark'} title="Toggle dark mode" onClick={() => onView({ dark: !view.dark })} />
            </Group>
          </>
        )}

        {tab === 'tools' && (
          <>
            <Group title="Typing method  (F1 – F7)">
              <div className="msx-modes">
                {KEYBOARD_MODES.map((m) => (
                  <button key={m.id} type="button" className={`msx-mode${mode === m.id ? ' is-active' : ''}`} title={m.description} onClick={() => onMode(m.id)}>
                    <kbd>{m.shortcut}</kbd> {m.name}
                  </button>
                ))}
              </div>
            </Group>
            <Group title="Convert text">
              <Btn big icon={<Languages size={20} />} label="Unicode → ML" title="Open the converter: Unicode to ML series" onClick={() => actions.openConvert('ml')} />
              <Btn big icon={<Languages size={20} />} label="Unicode → FML" title="Open the converter: Unicode to FML series" onClick={() => actions.openConvert('fml')} />
              <Btn big icon={<Languages size={20} />} label="Legacy → Unicode" title="Open the converter: ML/FML to Unicode" onClick={() => actions.openConvert('to_unicode')} />
              <Btn big icon={<Languages size={20} />} label="Unicode → Manglish" title="Open the converter: Unicode to Manglish" onClick={() => actions.openConvert('to_manglish')} />
            </Group>
            <Group title="Text tools">
              <Btn big icon={<Eraser size={20} />} label="Chillu clean-up" title="Fix chillu letters and split vowel signs (selection or whole document)" onClick={actions.cleanup} />
              <Btn big icon={<Copy size={20} />} label="Copy as Unicode" title="Copy the whole document (or selection) as Unicode text" onClick={actions.copyUnicode} />
              <Btn big icon={<Copy size={20} />} label="Copy as ML" title="Copy the whole document (or selection) as ML series (legacy) text" onClick={() => actions.copyLegacy('ml')} />
              <Btn big icon={<Copy size={20} />} label="Copy as FML" title="Copy the whole document (or selection) as FML series (legacy) text" onClick={() => actions.copyLegacy('fml')} />
            </Group>
          </>
        )}
      </div>
      {draw && <DrawTable editor={editor} done={() => setDraw(false)} />}
    </div>
  );
};
