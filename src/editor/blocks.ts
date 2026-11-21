import { Node, mergeAttributes } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table';
import { TableHeader } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    msxBlocks: {
      insertPageBreak: () => ReturnType;
      insertBookmark: (name: string) => ReturnType;
      insertTextBox: (attrs?: Partial<TextBoxAttrs>) => ReturnType;
      setCellBackground: (color: string | null) => ReturnType;
      setCellVAlign: (v: 'top' | 'middle' | 'bottom') => ReturnType;
      setTableStyle: (attrs: { borders?: string; borderColor?: string; borderWidth?: number; align?: string; width?: string }) => ReturnType;
      setImageProps: (attrs: Record<string, unknown>) => ReturnType;
      setBoxProps: (attrs: Record<string, unknown>) => ReturnType;
      setLineProps: (attrs: Record<string, unknown>) => ReturnType;
      setTableProps: (attrs: Record<string, unknown>) => ReturnType;
    };
  }
}

export interface TextBoxAttrs {
  width: number;
  height: number | null;
  borderColor: string;
  borderWidth: number;
  borderStyle: string;
  fill: string;
  radius: number;
  align: 'left' | 'center' | 'right';
  wrap: 'inline' | 'left' | 'right' | 'free';
  x: number;
  y: number;
}

/** Style shared by the text box in the editor and in the HTML that exports are measured from. */
export function textBoxStyle(a: Partial<TextBoxAttrs>): string {
  const w = a.width ?? 280;
  let s = `width:${w}px;border:${a.borderWidth ?? 1.5}px ${a.borderStyle ?? 'solid'} ${a.borderColor ?? '#334155'};background:${a.fill ?? '#ffffff'};border-radius:${a.radius ?? 2}px;`;
  if (a.height) s += `min-height:${a.height}px;`;
  const wrap = a.wrap ?? 'inline';
  if (wrap === 'left') s += 'float:left;margin:4pt 12pt 4pt 0;';
  else if (wrap === 'right') s += 'float:right;margin:4pt 0 4pt 12pt;';
  else if (wrap === 'free') s += `position:absolute;left:${a.x ?? 0}px;top:${a.y ?? 0}px;margin:0;z-index:6;`;
  else s += a.align === 'center' ? 'margin:6pt auto;' : a.align === 'right' ? 'margin:6pt 0 6pt auto;' : 'margin:6pt 0;';
  return s;
}

/** Style of a picture: size, effects (transparency, brightness …), border, rotation and wrapping. */
export function imageStyle(a: Record<string, unknown>): string {
  const n = (k: string, d: number) => (typeof a[k] === 'number' ? (a[k] as number) : d);
  let s = '';
  if (a.width) s += `width:${a.width}px;max-width:100%;`;
  const f: string[] = [];
  if (n('brightness', 100) !== 100) f.push(`brightness(${n('brightness', 100)}%)`);
  if (n('contrast', 100) !== 100) f.push(`contrast(${n('contrast', 100)}%)`);
  if (n('saturate', 100) !== 100) f.push(`saturate(${n('saturate', 100)}%)`);
  if (n('grayscale', 0)) f.push(`grayscale(${n('grayscale', 0)}%)`);
  if (n('sepia', 0)) f.push(`sepia(${n('sepia', 0)}%)`);
  if (n('blur', 0)) f.push(`blur(${n('blur', 0)}px)`);
  if (f.length) s += `filter:${f.join(' ')};`;
  if (n('opacity', 100) !== 100) s += `opacity:${n('opacity', 100) / 100};`;
  const t: string[] = [];
  if (n('rotate', 0)) t.push(`rotate(${n('rotate', 0)}deg)`);
  if (a.flipH) t.push('scaleX(-1)');
  if (a.flipV) t.push('scaleY(-1)');
  if (t.length) s += `transform:${t.join(' ')};`;
  if (n('borderWidth', 0)) s += `border:${n('borderWidth', 0)}px solid ${a.borderColor ?? '#000000'};`;
  if (n('radius', 0)) s += `border-radius:${n('radius', 0)}px;`;
  if (a.shadow) s += 'box-shadow:3px 4px 10px rgba(0,0,0,.35);';
  const wrap = (a.wrap as string) || 'inline';
  if (wrap === 'left') s += 'float:left;margin:4pt 12pt 4pt 0;';
  else if (wrap === 'right') s += 'float:right;margin:4pt 0 4pt 12pt;';
  else if (wrap === 'front' || wrap === 'behind') s += `position:absolute;left:${n('x', 0)}px;top:${n('y', 0)}px;margin:0;z-index:6;${wrap === 'behind' ? 'mix-blend-mode:multiply;' : ''}`;
  return s;
}

/* ---------------------------------------------------------------- page break */
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: 'div[data-page-break]' }],
  renderHTML: () => ['div', { 'data-page-break': 'true', class: 'msx-hardbreak' }],
  addCommands: () => ({
    insertPageBreak:
      () =>
      ({ chain }) =>
        chain().insertContent([{ type: 'pageBreak' }, { type: 'paragraph' }]).run(),
  }),
});

/* ---------------------------------------------------------------- bookmark */
export const Bookmark = Node.create({
  name: 'bookmark',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes: () => ({ name: { default: '' } }),
  parseHTML: () => [{ tag: 'span[data-bookmark]', getAttrs: (el) => ({ name: (el as HTMLElement).getAttribute('data-bookmark') || '' }) }],
  renderHTML: ({ node }) => ['span', { 'data-bookmark': node.attrs.name, id: `bm-${node.attrs.name}`, class: 'msx-bookmark', title: `Bookmark: ${node.attrs.name}` }],
  addCommands: () => ({
    insertBookmark:
      (name) =>
      ({ chain }) =>
        chain().insertContent({ type: 'bookmark', attrs: { name } }).run(),
  }),
});

/* ---------------------------------------------------------------- text box */
export const TextBox = Node.create({
  name: 'textBox',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,
  addAttributes: () => ({
    width: { default: 280 },
    height: { default: null },
    borderColor: { default: '#334155' },
    borderWidth: { default: 1.5 },
    borderStyle: { default: 'solid' },
    fill: { default: '#ffffff' },
    radius: { default: 2 },
    align: { default: 'left' },
    wrap: { default: 'inline' },
    x: { default: 0 },
    y: { default: 0 },
  }),
  parseHTML: () => [
    {
      tag: 'div[data-textbox]',
      getAttrs: (el) => {
        const e = el as HTMLElement;
        const g = (k: string, d: string) => e.getAttribute(k) ?? d;
        return {
          width: parseFloat(e.style.width) || 280,
          height: parseFloat(g('data-h', '')) || null,
          borderColor: g('data-bc', '#334155'),
          borderWidth: parseFloat(g('data-bw', '1.5')),
          borderStyle: g('data-bs', 'solid'),
          fill: g('data-fill', '#ffffff'),
          radius: parseFloat(g('data-r', '2')),
          align: g('data-align', 'left'),
          wrap: g('data-wrap', 'inline'),
          x: parseFloat(g('data-x', '0')) || 0,
          y: parseFloat(g('data-y', '0')) || 0,
        };
      },
    },
  ],
  renderHTML: ({ node, HTMLAttributes }) => {
    const a = node.attrs;
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-textbox': 'true',
        'data-bc': a.borderColor,
        'data-bw': a.borderWidth,
        'data-bs': a.borderStyle,
        'data-fill': a.fill,
        'data-r': a.radius,
        'data-align': a.align,
        'data-wrap': a.wrap,
        'data-x': a.x,
        'data-y': a.y,
        ...(a.height ? { 'data-h': a.height } : {}),
        class: 'msx-textbox',
        style: textBoxStyle(a),
      }),
      0,
    ];
  },
  addCommands: () => ({
    insertTextBox:
      (attrs) =>
      ({ chain }) =>
        chain()
          .insertContent([{ type: 'textBox', attrs: attrs ?? {}, content: [{ type: 'paragraph' }] }, { type: 'paragraph' }])
          .run(),
  }),
});

/* ---------------------------------------------------------------- tables */
const cellAttrs = {
  backgroundColor: {
    default: null as string | null,
    parseHTML: (el: HTMLElement) => el.getAttribute('data-bg') || el.style.backgroundColor || null,
    renderHTML: (a: Record<string, unknown>) => (a.backgroundColor ? { 'data-bg': a.backgroundColor as string, style: `background-color:${a.backgroundColor}` } : {}),
  },
  vAlign: {
    default: null as string | null,
    parseHTML: (el: HTMLElement) => el.getAttribute('data-va') || el.style.verticalAlign || null,
    renderHTML: (a: Record<string, unknown>) => (a.vAlign ? { 'data-va': a.vAlign as string, style: `vertical-align:${a.vAlign}` } : {}),
  },
};

export const MsxTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      borders: { default: 'all', parseHTML: (el: HTMLElement) => el.getAttribute('data-borders') || 'all', renderHTML: (a: Record<string, unknown>) => ({ 'data-borders': a.borders as string }) },
      borderColor: { default: '#000000', parseHTML: (el: HTMLElement) => el.getAttribute('data-bc') || '#000000', renderHTML: (a: Record<string, unknown>) => ({ 'data-bc': a.borderColor as string, style: `--tb:${a.borderColor}` }) },
      borderWidth: { default: 1, parseHTML: (el: HTMLElement) => parseFloat(el.getAttribute('data-bw') || '1'), renderHTML: (a: Record<string, unknown>) => ({ 'data-bw': String(a.borderWidth), style: `--tw:${a.borderWidth}px` }) },
      align: { default: 'left', parseHTML: (el: HTMLElement) => el.getAttribute('data-align') || 'left', renderHTML: (a: Record<string, unknown>) => ({ 'data-align': a.align as string }) },
      rowHeight: { default: null, parseHTML: (el: HTMLElement) => parseFloat(el.getAttribute('data-rh') || '') || null, renderHTML: (a: Record<string, unknown>) => (a.rowHeight ? { 'data-rh': String(a.rowHeight), style: `--rh:${a.rowHeight}px` } : {}) },
      fullWidth: { default: false, parseHTML: (el: HTMLElement) => el.getAttribute('data-full') === '1', renderHTML: (a: Record<string, unknown>) => (a.fullWidth ? { 'data-full': '1' } : {}) },
    };
  },
});
export const MsxCell = TableCell.extend({ addAttributes() { return { ...this.parent?.(), ...cellAttrs }; } });
export const MsxHeader = TableHeader.extend({ addAttributes() { return { ...this.parent?.(), ...cellAttrs }; } });

const IMG_NUM: Array<[string, number]> = [['opacity', 100], ['brightness', 100], ['contrast', 100], ['saturate', 100], ['grayscale', 0], ['sepia', 0], ['blur', 0], ['rotate', 0], ['radius', 0], ['borderWidth', 0], ['x', 0], ['y', 0]];
export const MsxImage = Image.extend({
  addAttributes() {
    const extra: Record<string, unknown> = {
      width: { default: null, parseHTML: (el: HTMLElement) => parseFloat(el.getAttribute('width') || el.style.width) || null, rendered: false },
      align: { default: 'left', parseHTML: (el: HTMLElement) => el.getAttribute('data-align') || 'left', rendered: false },
      wrap: { default: 'inline', parseHTML: (el: HTMLElement) => el.getAttribute('data-wrap') || 'inline', rendered: false },
      borderColor: { default: '#000000', parseHTML: (el: HTMLElement) => el.getAttribute('data-bc') || '#000000', rendered: false },
      flipH: { default: false, parseHTML: (el: HTMLElement) => el.getAttribute('data-fh') === '1', rendered: false },
      flipV: { default: false, parseHTML: (el: HTMLElement) => el.getAttribute('data-fv') === '1', rendered: false },
      shadow: { default: false, parseHTML: (el: HTMLElement) => el.getAttribute('data-sh') === '1', rendered: false },
    };
    for (const [k, d] of IMG_NUM) extra[k] = { default: d, parseHTML: (el: HTMLElement) => { const v = parseFloat(el.getAttribute(`data-${k}`) ?? ''); return Number.isFinite(v) ? v : d; }, rendered: false };
    return { ...this.parent?.(), ...extra };
  },
  renderHTML({ node, HTMLAttributes }) {
    const a = node.attrs;
    const data: Record<string, string> = { 'data-align': a.align, 'data-wrap': a.wrap, 'data-bc': a.borderColor, style: imageStyle(a) };
    if (a.flipH) data['data-fh'] = '1';
    if (a.flipV) data['data-fv'] = '1';
    if (a.shadow) data['data-sh'] = '1';
    for (const [k, d] of IMG_NUM) if (a[k] !== d) data[`data-${k}`] = String(a[k]);
    if (a.width) data.width = String(a.width);
    return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, data)];
  },
});

/** Horizontal line with colour, thickness, style and width. */
export const MsxHr = HorizontalRule.extend({
  addAttributes() {
    return {
      color: { default: '#8a94a6', parseHTML: (el: HTMLElement) => el.getAttribute('data-c') || '#8a94a6', rendered: false },
      thickness: { default: 1, parseHTML: (el: HTMLElement) => parseFloat(el.getAttribute('data-t') || '1') || 1, rendered: false },
      lineStyle: { default: 'solid', parseHTML: (el: HTMLElement) => el.getAttribute('data-ls') || 'solid', rendered: false },
      width: { default: null, parseHTML: (el: HTMLElement) => parseFloat(el.getAttribute('data-w') || '') || null, rendered: false },
      align: { default: 'left', parseHTML: (el: HTMLElement) => el.getAttribute('data-a') || 'left', rendered: false },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    const a = node.attrs;
    const t = a.lineStyle === 'double' ? Math.max(3, a.thickness) : a.thickness;
    const margin = a.align === 'center' ? '10pt auto' : a.align === 'right' ? '10pt 0 10pt auto' : '10pt 0';
    return ['hr', mergeAttributes(HTMLAttributes, { 'data-c': a.color, 'data-t': String(a.thickness), 'data-ls': a.lineStyle, 'data-a': a.align, ...(a.width ? { 'data-w': String(a.width) } : {}), style: `border:0;border-top:${t}px ${a.lineStyle} ${a.color};width:${a.width ? a.width + 'px' : 'auto'};margin:${margin};height:0` })];
  },
});

/** Commands for the table / picture tools. */
export const BlockCommands = Node.create({
  name: 'msxBlockCommands',
  addCommands: () => ({
    setCellBackground:
      (color) =>
      ({ commands }) =>
        commands.setCellAttribute('backgroundColor', color),
    setCellVAlign:
      (v) =>
      ({ commands }) =>
        commands.setCellAttribute('vAlign', v),
    setTableStyle:
      (attrs) =>
      ({ tr, state, dispatch }) => {
        const { $from } = state.selection;
        for (let d = $from.depth; d > 0; d--) {
          const n = $from.node(d);
          if (n.type.name === 'table') {
            if (dispatch) {
              const patch: Record<string, unknown> = { ...n.attrs };
              if (attrs.borders !== undefined) patch.borders = attrs.borders;
              if (attrs.borderColor !== undefined) patch.borderColor = attrs.borderColor;
              if (attrs.borderWidth !== undefined) patch.borderWidth = attrs.borderWidth;
              if (attrs.align !== undefined) patch.align = attrs.align;
              if (attrs.width !== undefined) patch.fullWidth = attrs.width === 'full';
              dispatch(tr.setNodeMarkup($from.before(d), undefined, patch));
            }
            return true;
          }
        }
        return false;
      },
    setImageProps:
      (attrs) =>
      ({ commands }) =>
        commands.updateAttributes('image', attrs),
    setBoxProps:
      (attrs) =>
      ({ commands }) =>
        commands.updateAttributes('textBox', attrs),
    setLineProps:
      (attrs) =>
      ({ commands }) =>
        commands.updateAttributes('horizontalRule', attrs),
    setTableProps:
      (attrs) =>
      ({ tr, state, dispatch }) => {
        const { $from } = state.selection;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === 'table') {
            if (dispatch) dispatch(tr.setNodeMarkup($from.before(d), undefined, { ...$from.node(d).attrs, ...attrs }));
            return true;
          }
        }
        return false;
      },
  }),
});

export { TableRow };
