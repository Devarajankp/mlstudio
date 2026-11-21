import { Editor, type JSONContent } from '@tiptap/core';
import { buildExtensions } from '../editor/extensions';
import { toUnicodeJSON } from '../editor/docTools';
import { normalizeFamilyValue, DEFAULT_FONT } from '../lib/fonts';

export type LegacyMode = 'keep' | 'unicode';

/** Document JSON for export. Legacy ML-TT / MLW-TT runs are kept as typed, or converted to Unicode. */
export function docForExport(editor: Editor, legacy: LegacyMode): JSONContent {
  const json = applyBaked(editor.getJSON());
  return legacy === 'unicode' ? toUnicodeJSON(json) : json;
}

/* ---- picture effects (transparency, brightness, …) are baked into the pixels for formats that have no such settings */
const EFFECTS: Array<[string, number]> = [['opacity', 100], ['brightness', 100], ['contrast', 100], ['saturate', 100], ['grayscale', 0], ['sepia', 0], ['blur', 0], ['rotate', 0], ['radius', 0]];
const baked = new Map<string, string>();
const effectKey = (at: Record<string, unknown>): string => `${String(at.src).length}:${String(at.src).slice(-40)}|` + EFFECTS.map(([k]) => at[k]).join(',') + `|${at.flipH ? 1 : 0}${at.flipV ? 1 : 0}`;
const hasEffects = (at: Record<string, unknown>): boolean => EFFECTS.some(([k, d]) => Number(at[k] ?? d) !== d) || !!at.flipH || !!at.flipV;

function walk(n: JSONContent, f: (img: JSONContent) => void): void {
  if (n.type === 'image') f(n);
  n.content?.forEach((c) => walk(c, f));
}

export async function bakeImageEffects(editor: Editor): Promise<void> {
  const todo: JSONContent[] = [];
  walk(editor.getJSON(), (i) => hasEffects(i.attrs ?? {}) && !baked.has(effectKey(i.attrs ?? {})) && todo.push(i));
  for (const i of todo) {
    const at = i.attrs as Record<string, unknown>;
    try {
      const img = new Image();
      img.src = String(at.src);
      await img.decode();
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d')!;
      const n = (k: string, d: number) => Number(at[k] ?? d);
      const r = Math.min(w, h) * (n('radius', 0) / 100);
      if (r > 0) {
        ctx.beginPath();
        ctx.roundRect(0, 0, w, h, r);
        ctx.clip();
      }
      ctx.filter = `brightness(${n('brightness', 100)}%) contrast(${n('contrast', 100)}%) saturate(${n('saturate', 100)}%) grayscale(${n('grayscale', 0)}%) sepia(${n('sepia', 0)}%) blur(${n('blur', 0) * (w / 600)}px)`;
      ctx.globalAlpha = n('opacity', 100) / 100;
      ctx.translate(w / 2, h / 2);
      ctx.rotate((n('rotate', 0) * Math.PI) / 180);
      ctx.scale(at.flipH ? -1 : 1, at.flipV ? -1 : 1);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      baked.set(effectKey(at), c.toDataURL('image/png'));
    } catch {
      /* keep the original picture */
    }
  }
}

function applyBaked(json: JSONContent): JSONContent {
  if (!baked.size) return json;
  const copy = JSON.parse(JSON.stringify(json)) as JSONContent;
  walk(copy, (i) => {
    const at = i.attrs ?? {};
    const src = baked.get(effectKey(at));
    if (!src || !hasEffects(at)) return;
    i.attrs = { ...at, src, flipH: false, flipV: false, ...Object.fromEntries(EFFECTS.map(([k, d]) => [k, d])) };
  });
  return copy;
}

/** HTML of a document JSON (uses a throw-away editor so the real one is untouched). */
export function jsonToHtml(json: JSONContent): string {
  const tmp = new Editor({ extensions: buildExtensions(), content: json });
  const html = tmp.getHTML();
  tmp.destroy();
  return html;
}

export const px2pt = (px: number): number => (px * 72) / 96;
export const px2cm = (px: number): number => (px / 96) * 2.54;

export function hexOf(css: string | null | undefined, fallback = '#000000'): string {
  if (!css) return fallback;
  const m = css.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/);
  if (m) {
    if (m[4] !== undefined && parseFloat(m[4]) === 0) return fallback;
    return '#' + [m[1], m[2], m[3]].map((v) => (+v).toString(16).padStart(2, '0')).join('');
  }
  if (/^#[0-9a-f]{3}$/i.test(css)) return '#' + css.slice(1).split('').map((c) => c + c).join('');
  if (/^#[0-9a-f]{6}$/i.test(css)) return css.toLowerCase();
  return fallback;
}

export function dataUrlToBytes(url: string): { bytes: Uint8Array; mime: string } | null {
  const m = url.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!m) return null;
  const mime = m[1] || 'application/octet-stream';
  if (m[2]) {
    const bin = atob(m[3]);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return { bytes: out, mime };
  }
  return { bytes: new TextEncoder().encode(decodeURIComponent(m[3])), mime };
}

export interface ImageData {
  bytes: Uint8Array;
  kind: 'png' | 'jpg' | 'gif' | 'bmp';
  w: number;
  h: number;
}

/** Load any image source (data URL / blob / http) to PNG or JPEG bytes plus its pixel size. `maxW` downsizes it. */
export async function loadImage(src: string, opts: { maxW?: number; jpeg?: boolean } = {}): Promise<ImageData | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    await img.decode();
    let w = img.naturalWidth || 300;
    let h = img.naturalHeight || 200;
    const direct = dataUrlToBytes(src);
    const keep = direct && /^image\/(png|jpeg|jpg|gif|bmp)$/.test(direct.mime) && (!opts.maxW || w <= opts.maxW);
    if (keep && direct) {
      const kind = direct.mime === 'image/png' ? 'png' : direct.mime === 'image/gif' ? 'gif' : direct.mime === 'image/bmp' ? 'bmp' : 'jpg';
      return { bytes: direct.bytes, kind, w, h };
    }
    if (opts.maxW && w > opts.maxW) {
      h = Math.round((h * opts.maxW) / w);
      w = opts.maxW;
    }
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    if (opts.jpeg) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);
    const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('image'))), opts.jpeg ? 'image/jpeg' : 'image/png', 0.88));
    return { bytes: new Uint8Array(await blob.arrayBuffer()), kind: opts.jpeg ? 'jpg' : 'png', w, h };
  } catch {
    return null;
  }
}

export const familyName = (css: string | null | undefined): string => normalizeFamilyValue(css) || DEFAULT_FONT;

export function safeFileName(name: string): string {
  return (name || 'Untitled').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Untitled';
}

export const escXml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
