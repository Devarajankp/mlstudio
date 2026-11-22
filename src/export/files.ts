/** Save / open: formats, the "Save as" file picker and reading documents back in. */
import type { Editor, JSONContent } from '@tiptap/core';
import { unzipSync, strFromU8 } from 'fflate';
import type { DocMeta } from '../lib/docmeta';
import type { PageLayout } from '../lib/page';
import { byName } from '../lib/fonts';
import { addCustomFont, customFontBytes, probeFont } from '../lib/customFonts';
import { docToUnicodeText, toUnicodeJSON } from '../editor/docTools';
import { unicodeToLegacy } from '../lib/legacy';
import { DEFAULT_PDF, exportPdf, type PdfOptions } from './pdf';
import { exportDocx } from './docx';
import { exportOdt } from './odt';
import { docForExport, escXml, jsonToHtml, safeFileName, type LegacyMode, bakeImageEffects } from './shared';

export type Format = 'mlstudio' | 'docx' | 'odt' | 'pdf' | 'txt' | 'html';

export const FORMATS: Array<{ id: Format; ext: string; label: string; mime: string }> = [
  { id: 'docx', ext: '.docx', label: 'Word document (.docx)', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { id: 'odt', ext: '.odt', label: 'OpenDocument text (.odt)', mime: 'application/vnd.oasis.opendocument.text' },
  { id: 'pdf', ext: '.pdf', label: 'PDF document (.pdf)', mime: 'application/pdf' },
  { id: 'txt', ext: '.txt', label: 'Plain text (.txt)', mime: 'text/plain' },
  { id: 'html', ext: '.html', label: 'Web page (.html)', mime: 'text/html' },
  { id: 'mlstudio', ext: '.mlstudio', label: 'Malayalam Studio file (.mlstudio)', mime: 'application/json' },
];
export const formatInfo = (id: Format) => FORMATS.find((f) => f.id === id)!;

export interface SaveOptions {
  legacy: LegacyMode;
  /** plain-text save: Unicode, or legacy ML / FML series codes */
  txtAs: 'unicode' | 'ml' | 'fml';
  pdf: PdfOptions;
  embedFonts: boolean;
}
export const DEFAULT_SAVE: SaveOptions = { legacy: 'keep', txtAs: 'unicode', pdf: DEFAULT_PDF, embedFonts: true };

export interface DocState {
  editor: Editor;
  layout: PageLayout;
  meta: DocMeta;
}

/* ------------------------------------------------------------------ build */

function usedFamilies(json: JSONContent, acc = new Set<string>()): Set<string> {
  for (const m of json.marks ?? []) if (m.type === 'textStyle' && m.attrs?.fontFamily) acc.add(String(m.attrs.fontFamily).replace(/["']/g, '').split(',')[0].trim());
  json.content?.forEach((c) => usedFamilies(c, acc));
  return acc;
}

const b64 = (buf: ArrayBuffer) => {
  let s = '';
  const u = new Uint8Array(buf);
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};

export async function buildFile(fmt: Format, s: DocState, o: SaveOptions): Promise<Blob> {
  const info = formatInfo(fmt);
  if (fmt === 'pdf' || fmt === 'docx' || fmt === 'odt') await bakeImageEffects(s.editor);
  switch (fmt) {
    case 'pdf':
      return exportPdf(s.editor, s.layout, s.meta, { ...o.pdf, legacy: o.legacy });
    case 'docx':
      return exportDocx(s.editor, s.layout, s.meta, o.legacy);
    case 'odt':
      return exportOdt(s.editor, s.layout, s.meta, o.legacy);
    case 'txt':
      {
      const uni = docToUnicodeText(s.editor);
      const text = o.txtAs === 'unicode' || !o.txtAs ? uni : unicodeToLegacy(uni, o.txtAs);
      // legacy codes are single-byte Latin-1 style characters; Unicode text gets a BOM
      return new Blob([o.txtAs && o.txtAs !== 'unicode' ? text : '﻿' + text], { type: `${info.mime};charset=${o.txtAs && o.txtAs !== 'unicode' ? 'windows-1252' : 'utf-8'}` });
    }
    case 'html': {
      const body = jsonToHtml(toUnicodeJSON(s.editor.getJSON()));
      const P = s.meta.props;
      const html = `<!doctype html><html lang="ml"><head><meta charset="utf-8"><title>${escXml(P.title || 'Untitled')}</title><meta name="author" content="${escXml(P.author)}"><meta name="description" content="${escXml(P.description)}"><style>body{font-family:'Noto Sans Malayalam','Nirmala UI',sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem;line-height:1.6}table{border-collapse:collapse}td,th{border:1px solid #000;padding:4px 8px}img{max-width:100%}</style></head><body>${body}</body></html>`;
      return new Blob([html], { type: `${info.mime};charset=utf-8` });
    }
    default: {
      const json = s.editor.getJSON();
      const fonts: Array<{ family: string; data: string; bold: boolean; italic: boolean }> = [];
      if (o.embedFonts) {
        for (const f of usedFamilies(json)) {
          if (!byName.get(f.toLowerCase())?.custom) continue;
          for (const [bold, italic] of [[false, false], [true, false], [false, true], [true, true]] as const) {
            const bytes = customFontBytes(f, bold, italic);
            if (bytes && !fonts.some((x) => x.family === f && x.data.length === bytes.byteLength)) fonts.push({ family: f, data: b64(bytes), bold, italic });
          }
        }
      }
      const payload = { format: 'mlstudio', version: 2, doc: json, layout: s.layout, meta: s.meta, fonts };
      return new Blob([JSON.stringify(payload)], { type: info.mime });
    }
  }
}

/* ------------------------------------------------------------------ write to disk */

type FSHandle = { createWritable(): Promise<{ write(b: Blob): Promise<void>; close(): Promise<void> }>; name: string };
type PickerWindow = Window & { showSaveFilePicker?: (o: unknown) => Promise<FSHandle>; showOpenFilePicker?: (o: unknown) => Promise<FSHandle[]> };

export type SaveResult = 'saved' | 'downloaded' | 'cancelled';

export function fileNameFor(name: string, fmt: Format): string {
  return safeFileName(name).replace(/\.(docx|odt|pdf|txt|html|mlstudio|json)$/i, '') + formatInfo(fmt).ext;
}

/** Save to a place the user picks (or, when the browser cannot ask, into the Downloads folder). */
export async function writeToDisk(blob: Blob, fileName: string, fmt: Format): Promise<SaveResult> {
  const info = formatInfo(fmt);
  return writeBlob(blob, fileName, info.mime, info.ext, info.label);
}

/** Generic save-to-local for any file type. */
export async function writeBlob(blob: Blob, fileName: string, mime: string, ext: string, description: string): Promise<SaveResult> {
  const w = window as PickerWindow;
  if (w.showSaveFilePicker) {
    try {
      const h = await w.showSaveFilePicker({ suggestedName: fileName, types: [{ description, accept: { [mime]: [ext] } }] });
      const stream = await h.createWritable();
      await stream.write(blob);
      await stream.close();
      return 'saved';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
      /* fall through to a normal download */
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  return 'downloaded';
}

/* ------------------------------------------------------------------ open */

export interface Opened {
  name: string;
  doc: JSONContent | null;
  html?: string;
  text?: string;
  layout?: PageLayout;
  meta?: DocMeta;
}

function odtToHtml(content: string, pics: Record<string, Uint8Array>): string {
  const dom = new DOMParser().parseFromString(content, 'application/xml');
  const styles = new Map<string, { b?: boolean; i?: boolean; u?: boolean; color?: string; font?: string }>();
  dom.querySelectorAll('style\\:style, style').forEach((s) => {
    const name = s.getAttribute('style:name');
    const tp = s.querySelector('style\\:text-properties, text-properties');
    if (name && tp) styles.set(name, { b: tp.getAttribute('fo:font-weight') === 'bold', i: tp.getAttribute('fo:font-style') === 'italic', u: !!tp.getAttribute('style:text-underline-style') && tp.getAttribute('style:text-underline-style') !== 'none', color: tp.getAttribute('fo:color') || undefined, font: tp.getAttribute('style:font-name') || undefined });
  });
  const mime = (n: string) => (/\.png$/i.test(n) ? 'image/png' : /\.jpe?g$/i.test(n) ? 'image/jpeg' : /\.gif$/i.test(n) ? 'image/gif' : 'image/png');
  const walk = (n: Node): string => {
    if (n.nodeType === 3) return escXml(n.nodeValue || '');
    if (n.nodeType !== 1) return '';
    const e = n as Element;
    const kids = () => Array.from(e.childNodes).map(walk).join('');
    switch (e.nodeName) {
      case 'text:p': return `<p>${kids()}</p>`;
      case 'text:h': return `<h${Math.min(3, +(e.getAttribute('text:outline-level') || 1))}>${kids()}</h${Math.min(3, +(e.getAttribute('text:outline-level') || 1))}>`;
      case 'text:s': return ' '.repeat(+(e.getAttribute('text:c') || 1));
      case 'text:tab': return '\t';
      case 'text:line-break': return '<br>';
      case 'text:a': return `<a href="${escXml(e.getAttribute('xlink:href') || '')}">${kids()}</a>`;
      case 'text:list': return `<${e.getAttribute('text:style-name') === 'LNum' ? 'ol' : 'ul'}>${kids()}</${e.getAttribute('text:style-name') === 'LNum' ? 'ol' : 'ul'}>`;
      case 'text:list-item': return `<li>${kids()}</li>`;
      case 'text:span': {
        const s = styles.get(e.getAttribute('text:style-name') || '');
        let h = kids();
        if (s?.b) h = `<strong>${h}</strong>`;
        if (s?.i) h = `<em>${h}</em>`;
        if (s?.u) h = `<u>${h}</u>`;
        if (s?.color || s?.font) h = `<span style="${s.color ? `color:${s.color};` : ''}${s.font ? `font-family:'${s.font}'` : ''}">${h}</span>`;
        return h;
      }
      case 'table:table': return `<table>${Array.from(e.children).filter((c) => c.nodeName === 'table:table-row').map(walk).join('')}</table>`;
      case 'table:table-row': return `<tr>${kids()}</tr>`;
      case 'table:table-cell': return `<td colspan="${e.getAttribute('table:number-columns-spanned') || 1}" rowspan="${e.getAttribute('table:number-rows-spanned') || 1}">${kids()}</td>`;
      case 'table:covered-table-cell': return '';
      case 'draw:image': {
        const href = e.getAttribute('xlink:href') || '';
        const bytes = pics[href];
        if (!bytes) return '';
        let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return `<img src="data:${mime(href)};base64,${btoa(s)}">`;
      }
      default: return kids();
    }
  };
  const body = dom.getElementsByTagName('office:text')[0];
  return body ? Array.from(body.childNodes).map(walk).join('') : '';
}

export async function readFile(file: File): Promise<Opened> {
  const name = file.name;
  const lower = name.toLowerCase();
  if (lower.endsWith('.mlstudio') || lower.endsWith('.json')) {
    const j = JSON.parse(await file.text());
    for (const f of j.fonts ?? []) {
      try {
        const bin = atob(f.data);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        const probe = await probeFont(buf.buffer, f.family);
        if (!byName.get(probe.family.toLowerCase())?.custom) {
          const series = byName.get(f.family.toLowerCase())?.series ?? probe.series;
          await addCustomFont(buf.buffer, probe, { series, handwriting: false });
        }
      } catch {
        /* a bad embedded font is ignored */
      }
    }
    return { name, doc: j.doc ?? j, layout: j.layout, meta: j.meta };
  }
  if (lower.endsWith('.docx')) {
    const mammoth = await import('mammoth');
    const r = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    return { name, doc: null, html: r.value };
  }
  if (lower.endsWith('.odt')) {
    const z = unzipSync(new Uint8Array(await file.arrayBuffer()));
    const pics: Record<string, Uint8Array> = {};
    for (const k of Object.keys(z)) if (k.startsWith('Pictures/')) pics[k] = z[k];
    return { name, doc: null, html: odtToHtml(strFromU8(z['content.xml']), pics) };
  }
  if (lower.endsWith('.html') || lower.endsWith('.htm')) {
    const d = new DOMParser().parseFromString(await file.text(), 'text/html');
    return { name, doc: null, html: d.body.innerHTML };
  }
  return { name, doc: null, text: (await file.text()).replace(/^﻿/, '') };
}

/** Open dialog (File System Access when there is one, otherwise a hidden <input type=file>). */
export function pickFile(accept = '.mlstudio,.docx,.odt,.txt,.html,.htm,.json'): Promise<File | null> {
  return new Promise((resolve) => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = accept;
    i.onchange = () => resolve(i.files?.[0] ?? null);
    i.oncancel = () => resolve(null);
    i.click();
  });
}

export { docForExport };
