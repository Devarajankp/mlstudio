import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { Bold, Italic, Underline, Highlighter, Baseline, PaintBucket, Trash2, RotateCcw, RotateCw, FlipHorizontal, SlidersHorizontal, Plus, Minus, Rows3, Columns3, Table2, Strikethrough } from 'lucide-react';
import { CellSelection } from '@tiptap/pm/tables';
import { TextSelection } from '@tiptap/pm/state';
import { currentObject, setAttrsAt, type Obj } from '../editor/objects';
import type { DialogName } from './Dialogs';

const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

const Color: React.FC<{ title: string; value: string; icon: React.ReactNode; onChange(v: string): void }> = ({ title, value, icon, onChange }) => (
  <label className="msx-ft-c" title={title} onMouseDown={(e) => e.stopPropagation()}>
    {icon}
    <i style={{ background: value }} />
    <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} />
  </label>
);
const Sel: React.FC<{ title: string; value: string | number; opts: Array<[string | number, string]>; onChange(v: string): void }> = ({ title, value, opts, onChange }) => (
  <select title={title} value={String(value)} onChange={(e) => onChange(e.target.value)}>
    {!opts.some((o) => String(o[0]) === String(value)) && <option value={String(value)}>{String(value)}</option>}
    {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
  </select>
);
const B: React.FC<{ title: string; on?: boolean; onClick(): void; children: React.ReactNode }> = ({ title, on, onClick, children }) => (
  <button type="button" title={title} className={on ? 'is-on' : ''} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>{children}</button>
);

const BORDER_W = [0, 0.5, 1, 1.5, 2, 3, 4, 6, 8].map((n) => [n, n === 0 ? 'None' : `${n}px`] as [number, string]);
const LINE_STYLE: Array<[string, string]> = [['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted'], ['double', 'Double']];
const WRAP_IMG: Array<[string, string]> = [['inline', 'In line with text'], ['left', 'Square – left'], ['right', 'Square – right'], ['front', 'In front of text'], ['behind', 'Behind text (see-through)']];
const WRAP_BOX: Array<[string, string]> = [['inline', 'In line with text'], ['left', 'Square – left'], ['right', 'Square – right'], ['free', 'Free (drag anywhere)']];

interface Props {
  editor: Editor;
  openDialog: (d: DialogName) => void;
}

/** Small tool box that floats at the top-right of the selected text, table, text box, line or picture (like Word's mini toolbar). */
export const FloatingToolbar: React.FC<Props> = ({ editor, openDialog }) => {
  const [pointerDown, setPointerDown] = useState(false);
  const [, force] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    const dom = editor.view.dom;
    const down = () => setPointerDown(true);
    const up = () => setTimeout(() => setPointerDown(false), 0);
    dom.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    const re = () => force((n) => n + 1);
    window.addEventListener('scroll', re, true);
    window.addEventListener('resize', re);
    return () => {
      dom.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('scroll', re, true);
      window.removeEventListener('resize', re);
    };
  }, [editor]);

  const st = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const sel = e.state.selection;
      const o = currentObject(e);
      const ts = e.getAttributes('textStyle');
      return {
        v: e.state.doc.content.size + ':' + sel.from + ':' + sel.to + ':' + (o ? o.pos : -1),
        textSel: sel instanceof TextSelection && !sel.empty,
        cells: sel instanceof CellSelection,
        bold: e.isActive('bold'), italic: e.isActive('italic'), underline: e.isActive('underline'), strike: e.isActive('strike'),
        color: (ts.color as string) || '#000000',
        hl: (e.getAttributes('highlight').color as string) || '#fde047',
        size: parseFloat(String(ts.fontSize || '12')) || 12,
        cellBg: (e.getAttributes('tableCell').backgroundColor as string) || (e.getAttributes('tableHeader').backgroundColor as string) || '#fde68a',
      };
    },
  });
  const obj: Obj | null = currentObject(editor);
  const kind = obj?.kind ?? (st.textSel ? 'text' : st.cells ? 'table' : null);
  const a = (obj?.node.attrs ?? {}) as Record<string, string | number | boolean | null>;
  const hidden = !kind || (kind === 'text' && pointerDown);

  useLayoutEffect(() => {
    if (hidden || !ref.current) return setPos(null);
    const el = ref.current;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let right = 0;
    let top = 0;
    let bottom = 0;
    if (obj) {
      const r = obj.el.getBoundingClientRect();
      right = r.right;
      top = r.top - (obj.kind === 'image' ? 52 : 28);
      bottom = r.bottom + 10;
    } else {
      try {
        const sel = editor.state.selection;
        const c1 = editor.view.coordsAtPos(sel.from);
        const c2 = editor.view.coordsAtPos(sel.to);
        right = Math.max(c2.right, c1.right);
        top = Math.min(c1.top, c2.top);
        bottom = Math.max(c1.bottom, c2.bottom) + 8;
      } catch {
        return setPos(null);
      }
    }
    const minTop = (document.querySelector('.msx-workspace') as HTMLElement | null)?.getBoundingClientRect().top ?? 100;
    let y = top - h - 8;
    if (y < minTop + 4) y = bottom + 6;
    const x = Math.max(6, Math.min(window.innerWidth - w - 6, right - w));
    setPos({ left: Math.round(x), top: Math.round(y) });
  }, [hidden, st.v, st.bold, st.italic, kind, obj?.pos, editor, pointerDown]);

  if (hidden) return null;
  const run = () => editor.chain().focus();
  const patch = (attrs: Record<string, unknown>) => obj && setAttrsAt(editor, obj.pos, attrs);
  const num = (v: string) => Number(v);

  let body: React.ReactNode = null;
  if (kind === 'text') {
    body = (
      <>
        <B title="Bold (Ctrl+B)" on={st.bold} onClick={() => run().toggleBold().run()}><Bold size={14} /></B>
        <B title="Italic (Ctrl+I)" on={st.italic} onClick={() => run().toggleItalic().run()}><Italic size={14} /></B>
        <B title="Underline (Ctrl+U)" on={st.underline} onClick={() => run().toggleUnderline().run()}><Underline size={14} /></B>
        <B title="Strikethrough" on={st.strike} onClick={() => run().toggleStrike().run()}><Strikethrough size={14} /></B>
        <span className="sep" />
        <Color title="Text colour" value={st.color} icon={<Baseline size={14} />} onChange={(v) => run().setColor(v).run()} />
        <Color title="Highlight colour" value={st.hl} icon={<Highlighter size={14} />} onChange={(v) => run().setHighlight({ color: v }).run()} />
        <span className="sep" />
        <B title="Smaller" onClick={() => { const n = [...SIZES].reverse().find((s) => s < st.size) ?? 8; run().setFontSize(`${n}pt`).run(); }}><Minus size={13} /></B>
        <span className="tag">{st.size}pt</span>
        <B title="Larger" onClick={() => { const n = SIZES.find((s) => s > st.size) ?? 96; run().setFontSize(`${n}pt`).run(); }}><Plus size={13} /></B>
      </>
    );
  } else if (kind === 'table') {
    const t = (obj?.node.attrs ?? {}) as Record<string, string | number>;
    body = (
      <>
        <span className="tag"><Table2 size={13} /></span>
        <Color title="Cell shading" value={st.cellBg} icon={<PaintBucket size={14} />} onChange={(v) => editor.chain().focus().setCellBackground(v).run()} />
        <Color title="Border colour" value={String(t.borderColor ?? '#000000')} icon={<Baseline size={14} />} onChange={(v) => editor.chain().focus().setTableStyle({ borderColor: v }).run()} />
        <Sel title="Border thickness" value={Number(t.borderWidth ?? 1)} opts={BORDER_W} onChange={(v) => editor.chain().focus().setTableStyle({ borderWidth: num(v) }).run()} />
        <Sel title="Borders" value={String(t.borders ?? 'all')} opts={[['all', 'All borders'], ['outside', 'Outside'], ['horizontal', 'Horizontal'], ['vertical', 'Vertical'], ['none', 'None']]} onChange={(v) => editor.chain().focus().setTableStyle({ borders: v }).run()} />
        <span className="sep" />
        <B title="Insert row below" onClick={() => run().addRowAfter().run()}><Rows3 size={14} /><Plus size={10} /></B>
        <B title="Insert column right" onClick={() => run().addColumnAfter().run()}><Columns3 size={14} /><Plus size={10} /></B>
        <B title="Delete table" onClick={() => run().deleteTable().run()}><Trash2 size={14} /></B>
      </>
    );
  } else if (kind === 'textBox') {
    body = (
      <>
        <Color title="Fill colour" value={String(a.fill)} icon={<PaintBucket size={14} />} onChange={(v) => patch({ fill: v })} />
        <Color title="Border colour" value={String(a.borderColor)} icon={<Baseline size={14} />} onChange={(v) => patch({ borderColor: v })} />
        <Sel title="Border thickness" value={Number(a.borderWidth)} opts={BORDER_W} onChange={(v) => patch({ borderWidth: num(v) })} />
        <Sel title="Border style" value={String(a.borderStyle)} opts={LINE_STYLE} onChange={(v) => patch({ borderStyle: v })} />
        <Sel title="Corners" value={Number(a.radius)} opts={[[0, 'Square'], [2, 'Slight'], [8, 'Rounded'], [16, 'Very round']]} onChange={(v) => patch({ radius: num(v) })} />
        <span className="sep" />
        <Sel title="Text wrapping / position" value={String(a.wrap)} opts={WRAP_BOX} onChange={(v) => patch({ wrap: v })} />
        <B title="Delete text box" onClick={() => { if (obj) editor.chain().focus().deleteRange({ from: obj.pos, to: obj.pos + obj.node.nodeSize }).run(); }}><Trash2 size={14} /></B>
      </>
    );
  } else if (kind === 'hr') {
    body = (
      <>
        <Color title="Line colour" value={String(a.color)} icon={<Baseline size={14} />} onChange={(v) => patch({ color: v })} />
        <Sel title="Thickness" value={Number(a.thickness)} opts={[1, 2, 3, 4, 6, 8, 12].map((n) => [n, `${n}px`] as [number, string])} onChange={(v) => patch({ thickness: num(v) })} />
        <Sel title="Line style" value={String(a.lineStyle)} opts={LINE_STYLE} onChange={(v) => patch({ lineStyle: v })} />
        <Sel title="Length" value={a.width ? 'x' : 'full'} opts={[['full', 'Full width'], ['x', 'Custom (drag ends)']]} onChange={(v) => patch({ width: v === 'full' ? null : Math.round(obj!.el.getBoundingClientRect().width / 2) })} />
        <Sel title="Position" value={String(a.align)} opts={[['left', 'Left'], ['center', 'Centre'], ['right', 'Right']]} onChange={(v) => patch({ align: v })} />
        <B title="Delete line" onClick={() => editor.chain().focus().deleteSelection().run()}><Trash2 size={14} /></B>
      </>
    );
  } else if (kind === 'image') {
    body = (
      <>
        <span className="tag" title="Transparency">Opacity</span>
        <input type="range" min={5} max={100} value={Number(a.opacity)} title={`Opacity ${a.opacity}% (transparency)`} onChange={(e) => patch({ opacity: num(e.target.value) })} />
        <span className="tag">{a.opacity}%</span>
        <span className="sep" />
        <Sel title="Wrapping / overlay" value={String(a.wrap)} opts={WRAP_IMG} onChange={(v) => patch({ wrap: v, ...(v === 'front' || v === 'behind' ? { x: Number(a.x) || 40, y: Number(a.y) || 40 } : {}) })} />
        <B title="Rotate left 90°" onClick={() => patch({ rotate: (((Number(a.rotate) || 0) - 90) % 360) })}><RotateCcw size={14} /></B>
        <B title="Rotate right 90°" onClick={() => patch({ rotate: (((Number(a.rotate) || 0) + 90) % 360) })}><RotateCw size={14} /></B>
        <B title="Flip left-right" on={!!a.flipH} onClick={() => patch({ flipH: !a.flipH })}><FlipHorizontal size={14} /></B>
        <Color title="Border colour" value={String(a.borderColor)} icon={<Baseline size={14} />} onChange={(v) => patch({ borderColor: v, borderWidth: Number(a.borderWidth) || 2 })} />
        <Sel title="Border thickness" value={Number(a.borderWidth)} opts={BORDER_W} onChange={(v) => patch({ borderWidth: num(v) })} />
        <B title="More picture settings…" onClick={() => openDialog('picfmt')}><SlidersHorizontal size={14} /> Format</B>
        <B title="Delete picture" onClick={() => editor.chain().focus().deleteSelection().run()}><Trash2 size={14} /></B>
      </>
    );
  }

  return (
    <div ref={ref} className="msx-ft no-print" style={{ left: pos?.left ?? -999, top: pos?.top ?? -999, visibility: pos ? 'visible' : 'hidden' }} onMouseDown={(e) => { if ((e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'SELECT') e.preventDefault(); }}>
      {body}
    </div>
  );
};
