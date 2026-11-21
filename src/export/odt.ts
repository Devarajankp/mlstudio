import { strToU8, zipSync } from 'fflate';
import type { Editor, JSONContent } from '@tiptap/core';
import { expandTokens, type DocMeta } from '../lib/docmeta';
import { pageDims, type PageLayout } from '../lib/page';
import { docForExport, escXml, familyName, hexOf, loadImage, px2cm, type LegacyMode } from './shared';

const cm = (px: number) => `${px2cm(px).toFixed(3)}cm`;
const pt = (v: number) => `${v}pt`;

interface St {
  paras: Map<string, string>; // key -> style xml
  texts: Map<string, string>;
  fonts: Set<string>;
  pics: Array<{ name: string; bytes: Uint8Array; mime: string }>;
  tables: number;
  lists: number;
  listStyles: string[];
  contentW: number;
}

function sizePt(css: unknown): number {
  const m = String(css ?? '').match(/([\d.]+)\s*(px|pt)/);
  if (!m) return 12;
  return m[2] === 'px' ? Math.round(((parseFloat(m[1]) * 72) / 96) * 10) / 10 : parseFloat(m[1]);
}

function paraStyle(st: St, attrs: Record<string, unknown>, extra = ''): string {
  const parts: string[] = [];
  const ta = attrs.textAlign as string | undefined;
  if (ta) parts.push(`fo:text-align="${ta === 'justify' ? 'justify' : ta === 'center' ? 'center' : ta === 'right' ? 'end' : 'start'}"`);
  if (attrs.indentLeft) parts.push(`fo:margin-left="${cm(attrs.indentLeft as number)}"`);
  if (attrs.indentFirst) parts.push(`fo:text-indent="${cm(attrs.indentFirst as number)}"`);
  if (attrs.lineSpacing) parts.push(`fo:line-height="${Math.round((attrs.lineSpacing as number) * 100)}%"`);
  parts.push(`fo:margin-top="${pt((attrs.spaceBefore as number) ?? 0)}"`, `fo:margin-bottom="${pt((attrs.spaceAfter as number) ?? 8)}"`);
  const key = parts.join(' ') + extra;
  if (!st.paras.has(key)) st.paras.set(key, `P${st.paras.size + 1}`);
  return st.paras.get(key)!;
}

function textStyle(st: St, marks: NonNullable<JSONContent['marks']>, baseSize?: number, baseBold?: boolean): string | null {
  const m = (t: string) => marks.find((x) => x.type === t);
  const ts = m('textStyle')?.attrs ?? {};
  const font = familyName(ts.fontFamily as string | undefined);
  st.fonts.add(font);
  const size = ts.fontSize ? sizePt(ts.fontSize) : (baseSize ?? 12);
  const bold = !!m('bold') || !!baseBold;
  const italic = !!m('italic');
  const color = ts.color ? hexOf(ts.color as string) : '';
  const hl = m('highlight')?.attrs?.color ? hexOf(m('highlight')!.attrs!.color as string) : '';
  const a: string[] = [`style:font-name="${escXml(font)}"`, `style:font-name-complex="${escXml(font)}"`, `fo:font-size="${size}pt"`, `style:font-size-complex="${size}pt"`];
  if (bold) a.push('fo:font-weight="bold"', 'style:font-weight-complex="bold"');
  if (italic) a.push('fo:font-style="italic"', 'style:font-style-complex="italic"');
  if (m('underline')) a.push('style:text-underline-style="solid"', 'style:text-underline-width="auto"', 'style:text-underline-color="font-color"');
  if (m('strike')) a.push('style:text-line-through-style="solid"');
  if (m('superscript')) a.push('style:text-position="super 58%"');
  if (m('subscript')) a.push('style:text-position="sub 58%"');
  if (color) a.push(`fo:color="${color}"`);
  if (hl) a.push(`fo:background-color="${hl}"`);
  const key = a.join(' ');
  if (!st.texts.has(key)) st.texts.set(key, `T${st.texts.size + 1}`);
  return st.texts.get(key)!;
}

function inline(node: JSONContent, st: St, baseSize?: number, baseBold?: boolean): string {
  let out = '';
  for (const ch of node.content ?? []) {
    if (ch.type === 'hardBreak') out += '<text:line-break/>';
    else if (ch.type === 'bookmark') out += `<text:bookmark text:name="${escXml(String(ch.attrs?.name))}"/>`;
    else if (ch.type === 'text' && ch.text !== undefined) {
      const style = textStyle(st, ch.marks ?? [], baseSize, baseBold);
      let t = escXml(ch.text).replace(/ {2,}/g, (s) => ` <text:s text:c="${s.length - 1}"/>`).replace(/\t/g, '<text:tab/>');
      t = `<text:span text:style-name="${style}">${t}</text:span>`;
      const href = ch.marks?.find((x) => x.type === 'link')?.attrs?.href as string | undefined;
      if (href) t = `<text:a xlink:type="simple" xlink:href="${escXml(href)}">${t}</text:a>`;
      out += t;
    }
  }
  return out;
}

function pBlock(node: JSONContent, st: St, extraStyle = ''): string {
  const a = node.attrs ?? {};
  if (node.type === 'heading') {
    const lvl = (a.level as number) ?? 1;
    const s = paraStyle(st, a, `|h${lvl}`);
    return `<text:h text:style-name="${s}" text:outline-level="${lvl}">${inline(node, st, [20, 16, 13][lvl - 1], true)}</text:h>`;
  }
  return `<text:p text:style-name="${paraStyle(st, a, extraStyle)}">${inline(node, st)}</text:p>`;
}

async function picture(node: JSONContent, st: St): Promise<string> {
  const img = await loadImage(node.attrs?.src as string);
  if (!img) return '';
  const w = Math.min(node.attrs?.width || img.w, st.contentW);
  const h = Math.round((img.h * w) / img.w);
  const name = `Pictures/img${st.pics.length + 1}.${img.kind === 'jpg' ? 'jpg' : img.kind}`;
  st.pics.push({ name, bytes: img.bytes, mime: img.kind === 'jpg' ? 'image/jpeg' : `image/${img.kind}` });
  const al = (node.attrs?.align as string) || 'left';
  const ps = paraStyle(st, { textAlign: al === 'left' ? undefined : al });
  const alt = escXml(String(node.attrs?.alt || 'Picture'));
  return `<text:p text:style-name="${ps}"><draw:frame draw:name="Picture${st.pics.length}" text:anchor-type="as-char" svg:width="${cm(w)}" svg:height="${cm(h)}"><draw:image xlink:href="${name}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/><svg:title>${alt}</svg:title><svg:desc>${alt}</svg:desc></draw:frame></text:p>`;
}

async function listXml(node: JSONContent, st: St, level: number): Promise<string> {
  const ordered = node.type === 'orderedList';
  const style = ordered ? 'LNum' : 'LBul';
  let out = `<text:list${level === 0 ? ` text:style-name="${style}"` : ''}>`;
  for (const item of node.content ?? []) {
    out += '<text:list-item>';
    for (const ch of item.content ?? []) out += ch.type === 'bulletList' || ch.type === 'orderedList' ? await listXml(ch, st, level + 1) : pBlock(ch, st);
    out += '</text:list-item>';
  }
  return out + '</text:list>';
}

function cellStyle(st: St, kind: string): string {
  const key = `cell|${kind}`;
  if (!st.paras.has(key)) st.paras.set(key, `C${st.paras.size + 1}`);
  return st.paras.get(key)!;
}

async function tableXml(node: JSONContent, st: St, tableAttrs?: Record<string, unknown>): Promise<string> {
  const a = tableAttrs ?? node.attrs ?? {};
  const bw = Math.max(0.25, ((a.borderWidth as number) ?? 1) * 0.75);
  const bc = hexOf(a.borderColor as string, '#000000');
  const border = a.borders === 'none' ? 'none' : `${bw}pt solid ${bc}`;
  const rows = node.content ?? [];
  const cols = Math.max(1, ...rows.map((r) => (r.content ?? []).reduce((s, c) => s + (c.attrs?.colspan || 1), 0)));
  const tn = `Tbl${++st.tables}`;
  const full = !!a.fullWidth;
  const align = a.align === 'center' ? 'center' : a.align === 'right' ? 'right' : 'left';
  const total = full ? st.contentW : Math.min(st.contentW, ((a.width as number) || st.contentW));
  st.paras.set(`tbl|${tn}`, `<style:style style:name="${tn}" style:family="table"><style:table-properties style:width="${cm(total)}" table:align="${align}" fo:margin-top="0cm" fo:margin-bottom="0.2cm"/></style:style>`);
  let out = `<table:table table:name="${tn}" table:style-name="${tn}">`;
  for (let i = 0; i < cols; i++) out += '<table:table-column/>';
  const rowSpanLeft: number[] = Array(cols).fill(0);
  for (const row of rows) {
    out += '<table:table-row>';
    let col = 0;
    for (const cell of row.content ?? []) {
      while (col < cols && rowSpanLeft[col] > 0) {
        out += '<table:covered-table-cell/>';
        rowSpanLeft[col]--;
        col++;
      }
      const ca = cell.attrs ?? {};
      const cs = ca.colspan || 1, rs = ca.rowspan || 1;
      const bg = ca.backgroundColor ? hexOf(ca.backgroundColor) : cell.type === 'tableHeader' ? '#f1f5f9' : '';
      const va = ca.vAlign === 'middle' || ca.vAlign === 'center' ? 'middle' : (ca.vAlign as string) || 'top';
      const sname = cellStyle(st, `${border}|${bg}|${va}`);
      st.paras.set(`cellxml|${sname}`, `<style:style style:name="${sname}" style:family="table-cell"><style:table-cell-properties fo:border="${border}" fo:padding="0.1cm" style:vertical-align="${va}"${bg ? ` fo:background-color="${bg}"` : ''}/></style:style>`);
      let inner = '';
      for (const b of cell.content ?? []) inner += await blockXml(b, st);
      out += `<table:table-cell table:style-name="${sname}"${cs > 1 ? ` table:number-columns-spanned="${cs}"` : ''}${rs > 1 ? ` table:number-rows-spanned="${rs}"` : ''} office:value-type="string">${inner || '<text:p/>'}</table:table-cell>`;
      for (let k = 0; k < cs; k++) {
        if (rs > 1) rowSpanLeft[col + k] = rs - 1;
        if (k > 0) out += '<table:covered-table-cell/>';
      }
      col += cs;
    }
    while (col < cols && rowSpanLeft[col] > 0) {
      out += '<table:covered-table-cell/>';
      rowSpanLeft[col]--;
      col++;
    }
    out += '</table:table-row>';
  }
  return out + '</table:table><text:p text:style-name="Standard"/>';
}

async function blockXml(n: JSONContent, st: St): Promise<string> {
  switch (n.type) {
    case 'paragraph':
    case 'heading':
      return pBlock(n, st);
    case 'bulletList':
    case 'orderedList':
      return listXml(n, st, 0);
    case 'blockquote':
      return (n.content ?? []).map((c) => pBlock({ ...c, attrs: { ...c.attrs, indentLeft: ((c.attrs?.indentLeft as number) || 0) + 36 } }, st)).join('');
    case 'codeBlock':
      return `<text:p text:style-name="Standard"><text:span text:style-name="Code">${escXml((n.content ?? []).map((x) => x.text).join(''))}</text:span></text:p>`;
    case 'horizontalRule':
      return '<text:p text:style-name="HR"/>';
    case 'image':
      return picture(n, st);
    case 'pageBreak':
      return '<text:p text:style-name="PB"/>';
    case 'table':
      return tableXml(n, st);
    case 'textBox': {
      const a = n.attrs ?? {};
      const wrapper: JSONContent = { type: 'table', attrs: { borders: 'all', borderColor: a.borderColor, borderWidth: a.borderWidth, align: a.align, width: a.width }, content: [{ type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 1, rowspan: 1, backgroundColor: a.fill }, content: n.content }] }] };
      return tableXml(wrapper, st);
    }
    default:
      return (await Promise.all((n.content ?? []).map((c) => blockXml(c, st)))).join('');
  }
}

export async function exportOdt(editor: Editor, layout: PageLayout, meta: DocMeta, legacy: LegacyMode): Promise<Blob> {
  const dims = pageDims(layout);
  const m = layout.margins;
  const st: St = { paras: new Map(), texts: new Map(), fonts: new Set(['Noto Sans Malayalam']), pics: [], tables: 0, lists: 0, listStyles: [], contentW: dims.w - m.left - m.right };
  const json = docForExport(editor, legacy);
  let body = '';
  for (const n of json.content ?? []) body += await blockXml(n, st);

  const P = meta.props;
  const fontDecls = [...st.fonts].map((f) => `<style:font-face style:name="${escXml(f)}" svg:font-family="'${escXml(f)}'"/>`).join('');
  const autoParas = [...st.paras.entries()]
    .map(([key, name]) => {
      if (key.startsWith('tbl|')) return name;
      if (key.startsWith('cellxml|')) return name;
      if (key.startsWith('cell|')) return '';
      const [attrs, h] = key.split('|');
      const heading = h ? ` style:default-outline-level="${h.slice(1)}"` : '';
      void heading;
      return `<style:style style:name="${name}" style:family="paragraph"><style:paragraph-properties ${attrs}/></style:style>`;
    })
    .join('');
  const autoText = [...st.texts.entries()].map(([k, name]) => `<style:style style:name="${name}" style:family="text"><style:text-properties ${k}/></style:style>`).join('');
  const listStyles = `<text:list-style style:name="LBul">${Array.from({ length: 6 }, (_, i) => `<text:list-level-style-bullet text:level="${i + 1}" text:bullet-char="${['•', '◦', '▪'][i % 3]}"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" fo:margin-left="${(i + 1) * 1.27}cm" fo:text-indent="-0.635cm"/></style:list-level-properties></text:list-level-style-bullet>`).join('')}</text:list-style><text:list-style style:name="LNum">${Array.from({ length: 6 }, (_, i) => `<text:list-level-style-number text:level="${i + 1}" style:num-suffix="." style:num-format="${['1', 'a', 'i'][i % 3]}"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" fo:margin-left="${(i + 1) * 1.27}cm" fo:text-indent="-0.635cm"/></style:list-level-properties></text:list-level-style-number>`).join('')}</text:list-style>`;

  const NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"';

  const content = `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${NS} office:version="1.3"><office:font-face-decls>${fontDecls}</office:font-face-decls><office:automatic-styles>${autoParas}${autoText}<style:style style:name="PB" style:family="paragraph"><style:paragraph-properties fo:break-before="page"/></style:style><style:style style:name="HR" style:family="paragraph"><style:paragraph-properties fo:border-bottom="0.75pt solid #999999" fo:margin-bottom="0.2cm"/></style:style><style:style style:name="Code" style:family="text"><style:text-properties style:font-name="Consolas" fo:font-size="10pt"/></style:style>${listStyles}</office:automatic-styles><office:body><office:text>${body || '<text:p/>'}</office:text></office:body></office:document-content>`;

  const tok = (s: string) => escXml(expandTokens(s, 1, 1, P)).replace(/1/g, (x) => x); // header text: tokens resolved by LibreOffice fields below
  void tok;
  const hfXml = (text: string, align: string, pn: boolean) => {
    const parts: string[] = [];
    if (text.trim()) {
      parts.push(
        escXml(text)
          .replace(/\{page\}/gi, '<text:page-number text:select-page="current"/>')
          .replace(/\{pages\}/gi, '<text:page-count/>')
          .replace(/\{title\}/gi, escXml(P.title))
          .replace(/\{author\}/gi, escXml(P.author))
          .replace(/\{date\}/gi, '<text:date/>'),
      );
    }
    void align;
    return parts.join('') + (pn ? '' : '');
  };
  const pnXml = (() => {
    const f = meta.pn.format;
    const num = '<text:page-number text:select-page="current"/>';
    const cnt = '<text:page-count/>';
    return f === 'page-n' ? `Page ${num}` : f === 'n-of-total' ? `${num} of ${cnt}` : f === 'page-n-of-total' ? `Page ${num} of ${cnt}` : f === 'dash-n' ? `– ${num} –` : num;
  })();
  const jc = (a: string) => (a === 'right' ? 'end' : a === 'center' ? 'center' : 'start');
  const area = (where: 'header' | 'footer') => {
    const text = where === 'header' ? meta.hf.header : meta.hf.footer;
    const al = where === 'header' ? meta.hf.headerAlign : meta.hf.footerAlign;
    const lines: string[] = [];
    if (text.trim()) lines.push(`<text:p text:style-name="HF${jc(al)}"><text:span text:style-name="HFT">${hfXml(text, al, false)}</text:span></text:p>`);
    if (meta.pn.enabled && meta.pn.position === where) lines.push(`<text:p text:style-name="HF${jc(meta.pn.align)}"><text:span text:style-name="HFT">${pnXml}</text:span></text:p>`);
    return lines.length ? `<style:${where}>${lines.join('')}</style:${where}>` : '';
  };
  const hfStyles = ['start', 'center', 'end'].map((a) => `<style:style style:name="HF${a}" style:family="paragraph"><style:paragraph-properties fo:text-align="${a}"/></style:style>`).join('') + `<style:style style:name="HFT" style:family="text"><style:text-properties style:font-name="${escXml(meta.hf.font)}" fo:font-size="${meta.hf.size}pt" fo:color="#555555"/></style:style>`;

  const styles = `<?xml version="1.0" encoding="UTF-8"?><office:document-styles ${NS} office:version="1.3"><office:font-face-decls>${fontDecls}<style:font-face style:name="${escXml(meta.hf.font)}" svg:font-family="'${escXml(meta.hf.font)}'"/></office:font-face-decls><office:styles><style:default-style style:family="paragraph"><style:paragraph-properties fo:line-height="150%"/><style:text-properties style:font-name="Noto Sans Malayalam" style:font-name-complex="Noto Sans Malayalam" fo:font-size="12pt" style:font-size-complex="12pt" fo:language="ml" fo:country="IN" style:language-complex="ml" style:country-complex="IN"/></style:default-style><style:style style:name="Standard" style:family="paragraph" style:class="text"/>${hfStyles}</office:styles><office:automatic-styles><style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="${cm(dims.w)}" fo:page-height="${cm(dims.h)}" style:print-orientation="${layout.landscape ? 'landscape' : 'portrait'}" fo:margin-top="${cm(m.top)}" fo:margin-bottom="${cm(m.bottom)}" fo:margin-left="${cm(m.left)}" fo:margin-right="${cm(m.right)}"/></style:page-layout></office:automatic-styles><office:master-styles><style:master-page style:name="Standard" style:page-layout-name="pm1">${area('header')}${area('footer')}</style:master-page></office:master-styles></office:document-styles>`;

  const metaXml = `<?xml version="1.0" encoding="UTF-8"?><office:document-meta ${NS} office:version="1.3"><office:meta><meta:generator>Malayalam Studio</meta:generator><dc:title>${escXml(P.title)}</dc:title><dc:subject>${escXml(P.subject)}</dc:subject><dc:description>${escXml(P.description)}</dc:description><meta:keyword>${escXml(P.keywords)}</meta:keyword><meta:initial-creator>${escXml(P.author)}</meta:initial-creator><dc:creator>${escXml(P.author)}</dc:creator><meta:creation-date>${P.created}</meta:creation-date><dc:date>${new Date().toISOString()}</dc:date><dc:language>ml-IN</dc:language></office:meta></office:document-meta>`;

  const manifest = `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>${st.pics.map((p) => `<manifest:file-entry manifest:full-path="${p.name}" manifest:media-type="${p.mime}"/>`).join('')}</manifest:manifest>`;

  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
    mimetype: [strToU8('application/vnd.oasis.opendocument.text'), { level: 0 }],
    'META-INF/manifest.xml': strToU8(manifest),
    'content.xml': strToU8(content),
    'styles.xml': strToU8(styles),
    'meta.xml': strToU8(metaXml),
  };
  for (const p of st.pics) files[p.name] = p.bytes;
  return new Blob([zipSync(files as never) as BlobPart], { type: 'application/vnd.oasis.opendocument.text' });
}
