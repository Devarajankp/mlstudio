import { AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, Header, HeadingLevel, ImageRun, InternalHyperlink, Bookmark, LevelFormat, Packer, PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType, PageBreak, type ParagraphChild, type FileChild } from 'docx';
import type { Editor, JSONContent } from '@tiptap/core';
import type { DocMeta, HAlign } from '../lib/docmeta';
import { pageDims, type PageLayout } from '../lib/page';
import { docForExport, familyName, hexOf, loadImage, type LegacyMode } from './shared';

const tw = (px: number) => Math.round(px * 15); // px -> twips
const ALIGN: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED };
const hex6 = (c: string | null | undefined) => hexOf(c, '').replace('#', '').toUpperCase();

interface Ctx {
  lists: Array<{ reference: string; ordered: boolean }>;
  contentW: number;
}

function sizeHalfPt(css: string | undefined): number {
  const m = css?.match(/([\d.]+)\s*(px|pt)/);
  if (!m) return 24;
  const pt = m[2] === 'px' ? (parseFloat(m[1]) * 72) / 96 : parseFloat(m[1]);
  return Math.round(pt * 2);
}

function runs(node: JSONContent, base: { size?: number; bold?: boolean } = {}): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  for (const ch of node.content ?? []) {
    if (ch.type === 'hardBreak') out.push(new TextRun({ break: 1 }));
    else if (ch.type === 'bookmark') out.push(new Bookmark({ id: String(ch.attrs?.name), children: [] }));
    else if (ch.type === 'text' && ch.text !== undefined) {
      const marks = ch.marks ?? [];
      const m = (t: string) => marks.find((x) => x.type === t);
      const ts = m('textStyle')?.attrs ?? {};
      const font = familyName(ts.fontFamily as string | undefined);
      const size = ts.fontSize ? sizeHalfPt(ts.fontSize as string) : (base.size ?? 24);
      const bold = !!m('bold') || !!base.bold;
      const italics = !!m('italic');
      const hl = m('highlight')?.attrs?.color as string | undefined;
      const color = hex6(ts.color as string | undefined);
      const run = new TextRun({
        text: ch.text,
        font: { ascii: font, hAnsi: font, cs: font, eastAsia: font },
        size,
        sizeComplexScript: size,
        bold,
        boldComplexScript: bold,
        italics,
        italicsComplexScript: italics,
        underline: m('underline') ? {} : undefined,
        strike: !!m('strike'),
        subScript: !!m('subscript'),
        superScript: !!m('superscript'),
        color: color || undefined,
        shading: hl ? { type: ShadingType.CLEAR, fill: hex6(hl) || 'FFFF00', color: 'auto' } : undefined,
      });
      const link = m('link')?.attrs?.href as string | undefined;
      if (link?.startsWith('#')) out.push(new InternalHyperlink({ anchor: link.slice(1), children: [run] }));
      else if (link) out.push(new ExternalHyperlink({ link, children: [run] }));
      else out.push(run);
    }
  }
  return out;
}

function para(node: JSONContent, extra: Record<string, unknown> = {}): Paragraph {
  const a = node.attrs ?? {};
  const lvl = ((a.level as number) ?? 1) - 1;
  const heading = node.type === 'heading' ? [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][lvl] : undefined;
  const hs = node.type === 'heading' ? [40, 32, 26][lvl] : undefined;
  return new Paragraph({
    heading,
    alignment: a.textAlign ? ALIGN[a.textAlign as string] : undefined,
    indent: { left: tw(a.indentLeft || 0), firstLine: (a.indentFirst || 0) > 0 ? tw(a.indentFirst) : undefined, hanging: (a.indentFirst || 0) < 0 ? tw(-a.indentFirst) : undefined },
    spacing: {
      line: a.lineSpacing ? Math.round(a.lineSpacing * 240) : undefined,
      before: a.spaceBefore != null ? a.spaceBefore * 20 : undefined,
      after: a.spaceAfter != null ? a.spaceAfter * 20 : 160,
    },
    children: runs(node, { size: hs, bold: node.type === 'heading' }),
    ...extra,
  } as never);
}

async function imageChild(node: JSONContent, c: Ctx): Promise<Paragraph> {
  const img = await loadImage(node.attrs?.src as string);
  if (!img) return new Paragraph({});
  const w = Math.min(node.attrs?.width || img.w, c.contentW);
  const h = Math.round((img.h * w) / img.w);
  return new Paragraph({
    alignment: ALIGN[(node.attrs?.align as string) || 'left'],
    children: [new ImageRun({ type: img.kind, data: img.bytes, transformation: { width: w, height: h }, altText: { title: node.attrs?.alt || 'Picture', description: node.attrs?.alt || 'Picture', name: 'Picture' } } as never)],
  });
}

async function list(node: JSONContent, c: Ctx, level: number, ref?: string): Promise<Paragraph[]> {
  const ordered = node.type === 'orderedList';
  let reference = ref;
  if (!reference) {
    reference = `${ordered ? 'num' : 'bul'}${c.lists.length}`;
    c.lists.push({ reference, ordered });
  }
  const out: Paragraph[] = [];
  for (const item of node.content ?? []) {
    let first = true;
    for (const ch of item.content ?? []) {
      if (ch.type === 'bulletList' || ch.type === 'orderedList') out.push(...(await list(ch, c, Math.min(level + 1, 8))));
      else {
        out.push(para(ch, first ? { numbering: { reference, level } } : { indent: { left: 720 * (level + 1) } }));
        first = false;
      }
    }
  }
  return out;
}

async function table(node: JSONContent, c: Ctx): Promise<Table> {
  const a = node.attrs ?? {};
  const size = Math.max(2, Math.round((a.borderWidth ?? 1) * 6));
  const color = hex6(a.borderColor) || '000000';
  const line = (on: boolean) => ({ style: on && a.borders !== 'none' ? BorderStyle.SINGLE : BorderStyle.NONE, size, color });
  const b = { top: line(true), bottom: line(true), left: line(a.borders === 'all'), right: line(a.borders === 'all') };
  const cols = Math.max(1, ...(node.content ?? []).map((r) => (r.content ?? []).reduce((s, cell) => s + (cell.attrs?.colspan || 1), 0)));
  const colW = Math.floor(tw(c.contentW) / cols);
  const rows: TableRow[] = [];
  for (const row of node.content ?? []) {
    const cells: TableCell[] = [];
    for (const cell of row.content ?? []) {
      const ca = cell.attrs ?? {};
      const kids = await blocks(cell.content ?? [], c);
      cells.push(new TableCell({
        children: (kids.length ? kids : [new Paragraph({})]) as never,
        columnSpan: ca.colspan > 1 ? ca.colspan : undefined,
        rowSpan: ca.rowspan > 1 ? ca.rowspan : undefined,
        width: { size: ca.colwidth ? tw(ca.colwidth[0]) : colW * (ca.colspan || 1), type: WidthType.DXA },
        shading: ca.backgroundColor ? { type: ShadingType.CLEAR, fill: hex6(ca.backgroundColor), color: 'auto' } : cell.type === 'tableHeader' ? { type: ShadingType.CLEAR, fill: 'F1F5F9', color: 'auto' } : undefined,
        verticalAlign: ca.vAlign === 'middle' || ca.vAlign === 'center' ? VerticalAlign.CENTER : ca.vAlign === 'bottom' ? VerticalAlign.BOTTOM : undefined,
        borders: b,
      }));
    }
    rows.push(new TableRow({ children: cells, tableHeader: row.content?.[0]?.type === 'tableHeader' }));
  }
  return new Table({
    rows,
    width: a.fullWidth ? { size: 5000, type: WidthType.PERCENTAGE } : { size: colW * cols, type: WidthType.DXA },
    alignment: ALIGN[a.align || 'left'],
    columnWidths: Array(cols).fill(colW),
  });
}

async function blocks(nodes: JSONContent[], c: Ctx): Promise<FileChild[]> {
  const out: FileChild[] = [];
  for (const n of nodes) {
    switch (n.type) {
      case 'paragraph':
      case 'heading':
        out.push(para(n));
        break;
      case 'bulletList':
      case 'orderedList':
        out.push(...(await list(n, c, 0)));
        break;
      case 'blockquote':
        for (const ch of n.content ?? []) out.push(para(ch, { indent: { left: 720 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: '94A3B8', space: 8 } } }));
        break;
      case 'codeBlock':
        out.push(new Paragraph({ children: [new TextRun({ text: (n.content ?? []).map((x) => x.text).join(''), font: 'Consolas', size: 20 })] }));
        break;
      case 'horizontalRule':
        out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 1 } } }));
        break;
      case 'image':
        out.push(await imageChild(n, c));
        break;
      case 'pageBreak':
        out.push(new Paragraph({ children: [new PageBreak()] }));
        break;
      case 'table':
        out.push(await table(n, c), new Paragraph({}));
        break;
      case 'textBox': {
        const a = n.attrs ?? {};
        const bd = { style: BorderStyle.SINGLE, size: Math.round((a.borderWidth ?? 1.5) * 6), color: hex6(a.borderColor) || '334155' };
        out.push(
          new Table({
            width: { size: tw(a.width || 280), type: WidthType.DXA },
            alignment: ALIGN[a.align || 'left'],
            rows: [new TableRow({ children: [new TableCell({ children: (await blocks(n.content ?? [], c)) as never, borders: { top: bd, bottom: bd, left: bd, right: bd }, shading: { type: ShadingType.CLEAR, fill: hex6(a.fill) || 'FFFFFF', color: 'auto' } })] })],
          }),
          new Paragraph({}),
        );
        break;
      }
      default:
        if (n.content) out.push(...(await blocks(n.content, c)));
    }
  }
  return out;
}

/** Header / footer paragraphs with live page-number fields. */
function hfParagraphs(meta: DocMeta, where: 'header' | 'footer'): Paragraph[] {
  const hf = meta.hf, pn = meta.pn;
  const text = where === 'header' ? hf.header : hf.footer;
  const align: HAlign = where === 'header' ? hf.headerAlign : hf.footerAlign;
  const font = { ascii: hf.font, hAnsi: hf.font, cs: hf.font };
  const size = hf.size * 2;
  const mk = (parts: unknown[], al: HAlign) => new Paragraph({ alignment: ALIGN[al], children: [new TextRun({ children: parts as never, font, size, sizeComplexScript: size, color: '555555' })] });
  const paras: Paragraph[] = [];
  if (text.trim()) {
    const parts: unknown[] = [];
    for (const seg of text.split(/(\{pages?\})/i)) {
      if (/^\{page\}$/i.test(seg)) parts.push(PageNumber.CURRENT);
      else if (/^\{pages\}$/i.test(seg)) parts.push(PageNumber.TOTAL_PAGES);
      else if (seg) parts.push(seg.replace(/\{date\}/gi, new Date().toLocaleDateString('en-IN')).replace(/\{title\}/gi, meta.props.title).replace(/\{author\}/gi, meta.props.author));
    }
    paras.push(mk(parts, align));
  }
  if (pn.enabled && pn.position === where) {
    const parts: unknown[] = [];
    const f = pn.format;
    if (f === 'page-n' || f === 'page-n-of-total') parts.push('Page ');
    if (f === 'dash-n') parts.push('– ');
    parts.push(PageNumber.CURRENT);
    if (f === 'n-of-total' || f === 'page-n-of-total') parts.push(' of ', PageNumber.TOTAL_PAGES);
    if (f === 'dash-n') parts.push(' –');
    paras.push(mk(parts, pn.align));
  }
  return paras;
}

export async function exportDocx(editor: Editor, layout: PageLayout, meta: DocMeta, legacy: LegacyMode): Promise<Blob> {
  const dims = pageDims(layout);
  const m = layout.margins;
  const ctx: Ctx = { lists: [], contentW: dims.w - m.left - m.right };
  const body = await blocks(docForExport(editor, legacy).content ?? [], ctx);
  const P = meta.props;
  const hdr = hfParagraphs(meta, 'header');
  const ftr = hfParagraphs(meta, 'footer');
  const blank = () => [new Paragraph({})];
  const doc = new Document({
    creator: P.author || 'Malayalam Studio',
    title: P.title,
    subject: P.subject,
    keywords: P.keywords,
    description: P.description,
    lastModifiedBy: P.author || 'Malayalam Studio',
    numbering: {
      config: ctx.lists.map((l) => ({
        reference: l.reference,
        levels: Array.from({ length: 9 }, (_, i) => ({
          level: i,
          format: l.ordered ? [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN][i % 3] : LevelFormat.BULLET,
          text: l.ordered ? `%${i + 1}.` : ['•', '◦', '▪'][i % 3],
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720 * (i + 1), hanging: 360 } } },
        })),
      })),
    },
    styles: { default: { document: { run: { font: { ascii: 'Noto Sans Malayalam', hAnsi: 'Noto Sans Malayalam', cs: 'Noto Sans Malayalam' }, size: 24, sizeComplexScript: 24 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: tw(dims.w), height: tw(dims.h) },
            margin: { top: tw(m.top), bottom: tw(m.bottom), left: tw(m.left), right: tw(m.right), header: tw(Math.min(m.top / 2, 48)), footer: tw(Math.min(m.bottom / 2, 48)) },
            pageNumbers: { start: meta.pn.start },
          },
          titlePage: meta.hf.skipFirst,
        },
        headers: { default: new Header({ children: hdr.length ? hdr : blank() }), ...(meta.hf.skipFirst ? { first: new Header({ children: blank() }) } : {}) },
        footers: { default: new Footer({ children: ftr.length ? ftr : blank() }), ...(meta.hf.skipFirst ? { first: new Footer({ children: blank() }) } : {}) },
        children: body.length ? body : blank(),
      },
    ],
  });
  return Packer.toBlob(doc);
}
