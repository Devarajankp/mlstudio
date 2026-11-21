import { PDFArray, PDFDict, PDFDocument, PDFFont, PDFHexString, PDFName, PDFNumber, PDFOperator, PDFPage, PDFRef, PDFString, rgb } from 'pdf-lib';
import * as fontkit from 'fontkit';
import decompressSrc from 'wawoff2/build/decompress_binding.js?raw';
import { unzlibSync } from 'fflate';
import type { Editor } from '@tiptap/core';
import { fontBytes, latinFallback } from '../lib/fontBytes';
import { headerFooterFor, type DocMeta } from '../lib/docmeta';
import { pageDims, type PageLayout } from '../lib/page';
import { measure, paginate, type Prim, type StructNode } from './measure';
import { dataUrlToBytes, docForExport, hexOf, jsonToHtml, loadImage, px2pt, type LegacyMode } from './shared';

export interface PdfOptions {
  quality: 'standard' | 'high';
  tagged: boolean;
  legacy: LegacyMode;
  userPassword: string;
  ownerPassword: string;
  allowPrint: boolean;
  allowCopy: boolean;
  allowModify: boolean;
}
export const DEFAULT_PDF: PdfOptions = { quality: 'high', tagged: true, legacy: 'keep', userPassword: '', ownerPassword: '', allowPrint: true, allowCopy: true, allowModify: false };

/* ------------------------------------------------------------------ fonts */

interface FkGlyph { id: number }
interface FkPos { xAdvance: number; xOffset: number; yOffset: number }
interface FkFont {
  unitsPerEm: number;
  layout(s: string): { glyphs: FkGlyph[]; positions: FkPos[] };
  hasGlyphForCodePoint(cp: number): boolean;
}
interface Loaded { pdf: PDFFont; fk: FkFont }

/** WOFF 1.0 -> plain sfnt (user fonts may be .woff). */
function woff1ToSfnt(b: Uint8Array): Uint8Array {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const flavor = dv.getUint32(4), n = dv.getUint16(12);
  const dir: Array<{ tag: number; data: Uint8Array; sum: number }> = [];
  for (let i = 0; i < n; i++) {
    const o = 44 + i * 20;
    const off = dv.getUint32(o + 4), comp = dv.getUint32(o + 8), orig = dv.getUint32(o + 12);
    const raw = b.subarray(off, off + comp);
    dir.push({ tag: dv.getUint32(o), data: comp < orig ? unzlibSync(raw) : raw, sum: dv.getUint32(o + 16) });
  }
  let size = 12 + n * 16;
  dir.forEach((d) => (size += (d.data.length + 3) & ~3));
  const out = new Uint8Array(size), ov = new DataView(out.buffer);
  ov.setUint32(0, flavor); ov.setUint16(4, n);
  const es = 2 ** Math.floor(Math.log2(n));
  ov.setUint16(6, es * 16); ov.setUint16(8, Math.log2(es)); ov.setUint16(10, n * 16 - es * 16);
  let pos = 12 + n * 16;
  dir.sort((a, c) => a.tag - c.tag).forEach((d, i) => {
    const e = 12 + i * 16;
    ov.setUint32(e, d.tag); ov.setUint32(e + 4, d.sum); ov.setUint32(e + 8, pos); ov.setUint32(e + 12, d.data.length);
    out.set(d.data, pos);
    pos += (d.data.length + 3) & ~3;
  });
  return out;
}

/** wawoff2's own wrapper only works in Node (its Module is not exported in browsers), so the emscripten file is evaluated here. */
interface W2 { decompress(b: Uint8Array): ArrayBuffer | false; onRuntimeInitialized?: () => void }
let w2: Promise<W2> | null = null;
function woff2(): Promise<W2> {
  if (!w2) {
    w2 = new Promise<W2>((resolve) => {
      const m = new Function(`${decompressSrc}\n;return Module;`)() as W2;
      m.onRuntimeInitialized = () => resolve(m);
      if (typeof m.decompress === 'function') resolve(m);
    });
  }
  return w2;
}

async function toSfnt(bytes: Uint8Array): Promise<Uint8Array> {
  const sig = String.fromCharCode(...bytes.subarray(0, 4));
  if (sig === 'wOF2') return woff2().then((m) => { const r = m.decompress(bytes); if (r === false) throw new Error('woff2 decode failed'); return new Uint8Array(r as ArrayBuffer); });
  if (sig === 'wOFF') return woff1ToSfnt(bytes);
  return bytes;
}

class FontPool {
  private cache = new Map<string, Promise<Loaded | null>>();
  constructor(private doc: PDFDocument) {}
  private load(key: string, get: () => Promise<Uint8Array | null>): Promise<Loaded | null> {
    let p = this.cache.get(key);
    if (!p) {
      p = (async () => {
        const raw = await get();
        if (!raw) return null;
        const ttf = await toSfnt(raw);
        const pdf = await this.doc.embedFont(ttf, { subset: false });
        const fk = fontkit.create(ttf) as unknown as FkFont;
        return { pdf, fk };
      })().catch(() => null);
      this.cache.set(key, p);
    }
    return p;
  }
  main(family: string, bold: boolean, italic: boolean) {
    return this.load(`${family}|${bold}|${italic}`, () => fontBytes(family, bold, italic));
  }
  latin(serif: boolean, bold: boolean, italic: boolean) {
    return this.load(`latin|${serif}|${bold}|${italic}`, () => latinFallback(serif, bold, italic));
  }
}

const hex4 = (n: number) => n.toString(16).padStart(4, '0');
const isMal = (cp: number) => cp >= 0x0d00 && cp <= 0x0d7f;

/** Split into runs that one font can draw: characters missing from the main font go to the Latin fallback. */
async function runsFor(text: string, pool: FontPool, family: string, bold: boolean, italic: boolean) {
  const main = await pool.main(family, bold, italic);
  const serif = /serif|times|georgia|cambria/i.test(family) && !/sans/i.test(family);
  const out: Array<{ text: string; f: Loaded }> = [];
  let cur = '';
  let curF: Loaded | null = null;
  for (const ch of Array.from(text)) {
    const cp = ch.codePointAt(0)!;
    let f = main;
    if (!f || (!f.fk.hasGlyphForCodePoint(cp) && !isMal(cp) && cp !== 0x200c && cp !== 0x200d)) {
      const lat = await pool.latin(serif, bold, italic);
      if (lat && lat.fk.hasGlyphForCodePoint(cp)) f = lat;
      else if (!f) f = lat;
    }
    if (!f) continue;
    if (curF && f !== curF) {
      out.push({ text: cur, f: curF });
      cur = '';
    }
    curF = f;
    cur += ch;
  }
  if (cur && curF) out.push({ text: cur, f: curF });
  return out;
}

/* ------------------------------------------------------------------ drawing helpers */

const op = (name: string, ...args: Array<number | PDFName | PDFHexString | PDFDict>) => PDFOperator.of(name as never, args.map((a) => (typeof a === 'number' ? PDFNumber.of(a) : a)) as never);

function fontKey(page: PDFPage, font: PDFFont): PDFName {
  page.setFont(font);
  return (page as unknown as { fontKey: PDFName }).fontKey;
}

function glyphRun(page: PDFPage, f: Loaded, text: string, x: number, y: number, size: number, color: string, bold: boolean, italic: boolean): number {
  f.pdf.encodeText(text); // registers the glyphs (widths, copy/paste map) with pdf-lib
  const lay = f.fk.layout(text);
  const k = size / f.fk.unitsPerEm;
  const c = hexRgb(color);
  page.pushOperators(op('q'), op('rg', c[0], c[1], c[2]), op('BT'), op('Tf', fontKey(page, f.pdf), size));
  const skew = italic ? 0.2 : 0;
  let pen = 0;
  const passes = bold ? [0, size * 0.022] : [0];
  for (const dx of passes) {
    pen = 0;
    lay.glyphs.forEach((g, i) => {
      const p = lay.positions[i];
      const gx = x + dx + (pen + p.xOffset) * k;
      const gy = y + p.yOffset * k;
      page.pushOperators(op('Tm', 1, 0, skew, 1, gx, gy), op('Tj', PDFHexString.of(hex4(g.id))));
      pen += p.xAdvance;
    });
  }
  page.pushOperators(op('ET'), op('Q'));
  return pen * k;
}

function hexRgb(h: string): [number, number, number] {
  const v = hexOf(h);
  return [parseInt(v.slice(1, 3), 16) / 255, parseInt(v.slice(3, 5), 16) / 255, parseInt(v.slice(5, 7), 16) / 255];
}

/* ------------------------------------------------------------------ main */

export async function exportPdf(editor: Editor, layout: PageLayout, meta: DocMeta, opts: PdfOptions): Promise<Blob> {
  const dims = pageDims(layout);
  const m = layout.margins;
  const contentW = dims.w - m.left - m.right;
  const contentH = dims.h - m.top - m.bottom;
  const json = docForExport(editor, opts.legacy);
  const measured = await measure(jsonToHtml(json), contentW);
  const place = paginate(measured, contentH);
  const total = place.pages;

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit as never);
  const pool = new FontPool(doc);
  const P = meta.props;
  doc.setTitle(P.title || 'Untitled');
  doc.setAuthor(P.author);
  doc.setSubject(P.subject);
  doc.setKeywords(P.keywords.split(/[,;]\s*/).filter(Boolean));
  doc.setCreator('Malayalam Studio');
  doc.setProducer('Malayalam Studio');
  doc.setLanguage('ml-IN');
  doc.setCreationDate(new Date(P.created));
  doc.setModificationDate(new Date());

  const W = px2pt(dims.w), H = px2pt(dims.h);
  const pages: PDFPage[] = Array.from({ length: total }, () => doc.addPage([W, H]));
  const ctx = doc.context;

  // structure tree bookkeeping
  const mcids: number[] = pages.map(() => 0);
  const parentArr: Array<Array<{ node: StructNode }>> = pages.map(() => []);
  const mcrs = new Map<StructNode, Array<{ page: number; mcid: number }>>();
  const link = new Map<StructNode, Array<{ page: number; mcid: number }>>();
  void link;
  const tagged = (pi: number, node: StructNode | null, draw: () => void) => {
    const page = pages[pi];
    if (opts.tagged && node) {
      const mcid = mcids[pi]++;
      parentArr[pi][mcid] = { node };
      (mcrs.get(node) ?? mcrs.set(node, []).get(node)!).push({ page: pi, mcid });
      page.pushOperators(op('BDC', PDFName.of(node.tag === 'Figure' ? 'Figure' : 'P'), ctx.obj({ MCID: mcid }) as PDFDict));
      draw();
      page.pushOperators(op('EMC'));
    } else draw();
  };
  const artifact = (pi: number, draw: () => void) => {
    const page = pages[pi];
    if (opts.tagged) page.pushOperators(op('BMC', PDFName.of('Artifact')));
    draw();
    if (opts.tagged) page.pushOperators(op('EMC'));
  };

  // placement of a primitive on its page (pdf points, y up)
  const at = (p: { atom: string }) => {
    const pg = place.page(p.atom);
    return { pg, dy: place.shift(p.atom) - pg * contentH };
  };
  const ox = m.left;
  const X = (x: number) => px2pt(ox + x);
  const Yp = (pg: number, y: number, dy: number) => H - px2pt(m.top + y + dy);

  const order = (p: Prim) => (p.k === 'rect' ? 0 : p.k === 'img' ? 1 : p.k === 'text' || p.k === 'num' || p.k === 'dot' ? 2 : p.k === 'line' ? 3 : 4);
  const sorted = [...measured.prims].sort((a, b) => order(a) - order(b));

  const imgCache = new Map<string, Awaited<ReturnType<PDFDocument['embedPng']>> | null>();
  for (const p of sorted) {
    const { pg, dy } = at(p);
    const page = pages[pg];
    if (p.k === 'rect') {
      const c = hexRgb(p.fill);
      artifact(pg, () => page.drawRectangle({ x: X(p.x), y: Yp(pg, p.y + p.h, dy), width: px2pt(p.w), height: px2pt(p.h), color: rgb(c[0], c[1], c[2]) }));
    } else if (p.k === 'line') {
      const c = hexRgb(p.color);
      artifact(pg, () => page.drawLine({ start: { x: X(p.x1), y: Yp(pg, p.y1, dy) }, end: { x: X(p.x2), y: Yp(pg, p.y2, dy) }, thickness: px2pt(p.w), color: rgb(c[0], c[1], c[2]) }));
    } else if (p.k === 'dot') {
      const c = hexRgb(p.color);
      artifact(pg, () => page.drawCircle({ x: X(p.x), y: Yp(pg, p.y, dy), size: px2pt(p.r), color: rgb(c[0], c[1], c[2]) }));
    } else if (p.k === 'img') {
      let emb = imgCache.get(p.src);
      if (emb === undefined) {
        const maxW = opts.quality === 'high' ? undefined : Math.round(p.w * 1.6);
        const data = await loadImage(p.src, { maxW, jpeg: opts.quality === 'standard' && !/png|gif|svg/.test(dataUrlToBytes(p.src)?.mime ?? 'png') });
        try {
          emb = data ? (data.kind === 'jpg' ? await doc.embedJpg(data.bytes) : await doc.embedPng(data.bytes)) : null;
        } catch {
          emb = null;
        }
        imgCache.set(p.src, emb);
      }
      if (emb) tagged(pg, p.node, () => page.drawImage(emb!, { x: X(p.x), y: Yp(pg, p.y + p.h, dy), width: px2pt(p.w), height: px2pt(p.h) }));
    } else if (p.k === 'text') {
      const baseY = Yp(pg, p.base, 0) - px2pt(dy);
      const size = px2pt(p.size);
      // draw inside a marked-content sequence (text is async: runs are prepared first)
      const runs = await runsFor(p.text, pool, p.family, p.bold, p.italic);
      tagged(pg, p.node, () => {
        if (p.actual) page.pushOperators(op('BDC', PDFName.of('Span'), ctx.obj({ ActualText: PDFHexString.fromText(p.actual) }) as PDFDict));
        let x = X(p.x);
        for (const r of runs) x += glyphRun(page, r.f, r.text, x, baseY, size, p.color, p.bold, p.italic);
        if (p.actual) page.pushOperators(op('EMC'));
      });
    } else if (p.k === 'num') {
      const f = await pool.latin(false, false, false);
      if (f) artifact(pg, () => glyphRun(page, f, p.text, X(p.x), Yp(pg, p.base, dy), px2pt(p.size), p.color, false, false));
    } else if (p.k === 'link' && p.url) {
      const url = p.url;
      const rect = [X(p.x), Yp(pg, p.y + p.h, dy), X(p.x + p.w), Yp(pg, p.y, dy)];
      const annotDict: Record<string, unknown> = { Type: 'Annot', Subtype: 'Link', Rect: rect, Border: [0, 0, 0], F: 4 };
      if (!url.startsWith('#')) annotDict.A = { S: 'URI', URI: PDFString.of(url) };
      const annot = ctx.obj(annotDict as never);
      let arr = page.node.get(PDFName.of('Annots')) as PDFArray | undefined;
      if (!arr) {
        arr = ctx.obj([]);
        page.node.set(PDFName.of('Annots'), arr);
      }
      arr.push(ctx.register(annot));
    }
  }

  // header / footer / page numbers
  const hfFont = await pool.main(meta.hf.font, false, false);
  for (let i = 0; i < total; i++) {
    const hf = headerFooterFor(meta, i + 1, total);
    const size = meta.hf.size;
    const draw = (lines: Array<[string, 'left' | 'center' | 'right']>, yPt: number) =>
      lines.forEach(([text, al], li) => {
        if (!text || !hfFont) return;
        const lay = hfFont.fk.layout(text);
        const wPt = (lay.positions.reduce((s, q) => s + q.xAdvance, 0) * size) / hfFont.fk.unitsPerEm;
        const x0 = px2pt(m.left), x1 = W - px2pt(m.right);
        const x = al === 'left' ? x0 : al === 'right' ? x1 - wPt : (x0 + x1) / 2 - wPt / 2;
        artifact(i, () => glyphRun(pages[i], hfFont, text, x, yPt - li * size * 1.3, size, '#555555', false, false));
      });
    draw(hf.header, H - px2pt(Math.max(12, m.top / 2)) - size * 0.3);
    draw(hf.footer, px2pt(Math.max(12, m.bottom / 2)) + size * 0.3 + (hf.footer.length - 1) * size * 1.3);
  }

  if (opts.tagged) buildStructure(doc, pages, measured.root, mcrs, parentArr, P.title);
  doc.catalog.set(PDFName.of('ViewerPreferences'), ctx.obj({ DisplayDocTitle: true }));

  let bytes = await doc.save({ useObjectStreams: false });
  if (opts.userPassword || opts.ownerPassword || !opts.allowPrint || !opts.allowCopy || !opts.allowModify) bytes = await encryptPdf(bytes, opts);
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

/* ------------------------------------------------------------------ tagged PDF structure */

function buildStructure(doc: PDFDocument, pages: PDFPage[], root: StructNode, mcrs: Map<StructNode, Array<{ page: number; mcid: number }>>, parentArr: Array<Array<{ node: StructNode }>>, title: string): void {
  const ctx = doc.context;
  const treeRef = ctx.nextRef();
  const refs = new Map<StructNode, PDFRef>();
  const build = (n: StructNode, parentRef: PDFRef): PDFRef => {
    const ref = ctx.nextRef();
    refs.set(n, ref);
    const kids: unknown[] = [];
    for (const k of n.kids) kids.push(build(k, ref));
    for (const r of mcrs.get(n) ?? []) kids.push(ctx.obj({ Type: 'MCR', Pg: pages[r.page].ref, MCID: r.mcid }));
    const dict: Record<string, unknown> = { Type: 'StructElem', S: PDFName.of(n.tag), P: parentRef, K: kids };
    if (n.alt !== undefined) dict.Alt = PDFHexString.fromText(n.alt || 'Picture');
    if (n.tag === 'Document' && title) dict.T = PDFHexString.fromText(title);
    ctx.assign(ref, ctx.obj(dict as never));
    return ref;
  };
  const docRef = build(root, treeRef);
  // ParentTree: page -> [struct element per MCID]
  const nums: unknown[] = [];
  pages.forEach((pg, i) => {
    pg.node.set(PDFName.of('StructParents'), PDFNumber.of(i));
    nums.push(PDFNumber.of(i), ctx.obj(parentArr[i].map((e) => (e && refs.get(e.node)) || docRef)));
  });
  ctx.assign(treeRef, ctx.obj({ Type: 'StructTreeRoot', K: [docRef], ParentTree: ctx.obj({ Nums: nums as never }) }));
  doc.catalog.set(PDFName.of('StructTreeRoot'), treeRef);
  doc.catalog.set(PDFName.of('MarkInfo'), ctx.obj({ Marked: true }));
}

/* ------------------------------------------------------------------ password / permissions (qpdf, AES-256) */

export async function encryptPdf(bytes: Uint8Array, o: PdfOptions): Promise<Uint8Array> {
  const mod = await import('@neslinesli93/qpdf-wasm');
  const wasm = (await import('@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url')).default as string;
  const qpdf = (await (mod.default as unknown as (cfg: unknown) => Promise<unknown>)({
    locateFile: () => wasm,
    print: () => undefined,
    printErr: () => undefined,
  })) as { FS: { writeFile(p: string, d: Uint8Array): void; readFile(p: string): Uint8Array }; callMain(a: string[]): void };
  qpdf.FS.writeFile('/in.pdf', bytes);
  const owner = o.ownerPassword || o.userPassword || Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  qpdf.callMain(['--encrypt', o.userPassword, owner, '256', `--print=${o.allowPrint ? 'full' : 'none'}`, `--extract=${o.allowCopy ? 'y' : 'n'}`, `--modify=${o.allowModify ? 'all' : 'none'}`, '--accessibility=y', '--', '/in.pdf', '/out.pdf']);
  return qpdf.FS.readFile('/out.pdf');
}
