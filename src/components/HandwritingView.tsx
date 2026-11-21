import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, PenTool, Type, Upload } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { FONTS, type FontEntry } from '../lib/fonts';
import { isLegacy, unicodeToLegacy } from '../lib/legacy';
import { addCustomFont, probeFont } from '../lib/customFonts';
import { TypingBar, TypingField } from './TypingField';
import { writeBlob } from '../export/files';
import { encryptPdf, DEFAULT_PDF } from '../export/pdf';
import { safeFileName, escXml } from '../export/shared';
import type { KeyboardMode } from '../utils/keyboardLayouts';

interface Props {
  text: string;
  onChangeText: (text: string) => void;
  onBack: () => void;
  showToast: (msg: string) => void;
  mode: KeyboardMode;
  onMode: (m: KeyboardMode) => void;
}

type Paper = 'white' | 'yellow' | 'old' | 'plain';
type Out = 'png' | 'jpg' | 'webp' | 'svg' | 'pdf' | 'txt';
const OUTS: Array<{ id: Out; label: string; mime: string }> = [
  { id: 'png', label: 'PNG image (.png)', mime: 'image/png' },
  { id: 'jpg', label: 'JPEG image (.jpg)', mime: 'image/jpeg' },
  { id: 'webp', label: 'WebP image (.webp)', mime: 'image/webp' },
  { id: 'svg', label: 'SVG vector (.svg)', mime: 'image/svg+xml' },
  { id: 'pdf', label: 'PDF (.pdf)', mime: 'application/pdf' },
  { id: 'txt', label: 'Plain text (.txt)', mime: 'text/plain' },
];

const PAPERS: Record<Paper, { bg: string; line: string; margin: string; border: string; label: string }> = {
  white: { bg: '#ffffff', line: '#dbe4ee', margin: '#fecaca', border: '#cbd5e1', label: 'White ruled paper' },
  yellow: { bg: '#fef9c3', line: '#fde047', margin: '#fca5a5', border: '#eab308', label: 'Yellow paper' },
  old: { bg: '#f5ebe0', line: '#e3d5ca', margin: '#d5bdaf', border: '#d6ccc2', label: 'Old vintage paper' },
  plain: { bg: '#ffffff', line: 'transparent', margin: 'transparent', border: '#e2e8f0', label: 'Plain white (no lines)' },
};
const INKS: Array<[string, string]> = [['#111827', 'Black'], ['#0000d9', 'Royal blue'], ['#b91c1c', 'Crimson'], ['#15803d', 'Green'], ['#6d28d9', 'Violet']];

const fieldCls = 'w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100';
const labelCls = 'block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1';

function usable(): FontEntry[] {
  const own = FONTS.filter((f) => f.handwriting);
  const ml = FONTS.filter((f) => !f.handwriting && f.group !== 'English / Latin' && !f.group.startsWith('English') && (f.series === 'unicode' || f.custom));
  return [...own, ...ml];
}

export const HandwritingView: React.FC<Props> = ({ text, onChangeText, onBack, showToast, mode, onMode }) => {
  const [, tick] = useState(0);
  const fonts = usable();
  const [family, setFamily] = useState(() => (fonts.find((f) => f.family === 'Chilanka') ?? fonts[0])?.family ?? 'Chilanka');
  const [paper, setPaper] = useState<Paper>('yellow');
  const [align, setAlign] = useState<'left' | 'center' | 'right'>('left');
  const [ink, setInk] = useState('#0000d9');
  const [size, setSize] = useState(34);
  const [gap, setGap] = useState(52);
  const [width, setWidth] = useState(960);
  const [out, setOut] = useState<Out>('png');
  const [fname, setFname] = useState('handwriting');
  const [pw, setPw] = useState('');
  const upload = useRef<HTMLInputElement>(null);

  const font = fonts.find((f) => f.family === family) ?? fonts[0];
  const css = `"${font?.family ?? family}", 'Noto Sans Malayalam', sans-serif`;
  const legacy = !!font && isLegacy(font.series);
  /** the string that is really drawn: legacy fonts need legacy codes */
  const drawn = (t: string) => (legacy ? unicodeToLegacy(t, font.series as 'ml' | 'fml') : t);
  const c = PAPERS[paper];
  const groups = useMemo(() => {
    const m = new Map<string, FontEntry[]>();
    for (const f of fonts) m.set(f.handwriting ? 'My handwriting fonts' : f.group, [...(m.get(f.handwriting ? 'My handwriting fonts' : f.group) ?? []), f]);
    return [...m.entries()];
  }, [fonts]);

  useEffect(() => {
    if (!fonts.some((f) => f.family === family) && fonts[0]) setFamily(fonts[0].family);
  });

  const addFonts = async (files: FileList | null) => {
    let n = 0;
    for (const file of Array.from(files ?? [])) {
      try {
        const bytes = await file.arrayBuffer();
        const probe = await probeFont(bytes, file.name);
        const fam = await addCustomFont(bytes, probe, { series: probe.series, handwriting: true });
        setFamily(fam);
        n++;
      } catch {
        showToast(`${file.name} is not a usable font`);
      }
    }
    if (n) {
      tick((x) => x + 1);
      showToast(`${n} handwriting font${n === 1 ? '' : 's'} added`);
    }
  };

  /* lay the text out once: used by every output type */
  const layout = async () => {
    const ctx = document.createElement('canvas').getContext('2d')!;
    try {
      await document.fonts.load(`${size}px "${font?.family}"`, drawn('മലയാളം abc'));
    } catch {
      /* font may already be ready */
    }
    ctx.font = `${size}px ${css}`;
    const pad = 64;
    const max = width - pad * 2;
    const lines: string[] = [];
    for (const para of (text || 'മലയാളം കൈയ്യക്ഷരം').split('\n')) {
      let cur = '';
      for (const w of para.split(' ')) {
        const test = cur ? `${cur} ${w}` : w;
        if (ctx.measureText(drawn(test)).width > max && cur) {
          lines.push(cur);
          cur = w;
        } else cur = test;
      }
      lines.push(cur);
    }
    return { lines, pad, height: Math.max(560, pad * 2 + lines.length * gap + 40) };
  };

  const xOf = (pad: number) => (align === 'center' ? width / 2 : align === 'right' ? width - pad : pad);

  const drawCanvas = async () => {
    const { lines, pad, height } = await layout();
    const cv = document.createElement('canvas');
    const scale = out === 'png' || out === 'pdf' ? 2 : 1.5;
    cv.width = width * scale;
    cv.height = height * scale;
    const ctx = cv.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, width, height);
    if (paper !== 'plain') {
      ctx.strokeStyle = c.line;
      ctx.lineWidth = 1;
      for (let y = pad + gap; y < height - 24; y += gap) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.strokeStyle = c.margin;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pad - 16, 0);
      ctx.lineTo(pad - 16, height);
      ctx.stroke();
    }
    ctx.font = `${size}px ${css}`;
    ctx.fillStyle = ink;
    ctx.textAlign = align;
    lines.forEach((l, i) => ctx.fillText(drawn(l), xOf(pad), pad + (i + 1) * gap - 8));
    return { cv, lines, pad, height };
  };

  const save = async () => {
    const base = safeFileName(fname || 'handwriting').replace(/\.[a-z0-9]+$/i, '');
    const info = OUTS.find((o) => o.id === out)!;
    const ext = '.' + out;
    try {
      let blob: Blob;
      if (out === 'txt') blob = new Blob(['﻿' + (text || '')], { type: 'text/plain;charset=utf-8' });
      else if (out === 'svg') {
        const { lines, pad, height } = await layout();
        const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
        const rules = paper === 'plain' ? '' : Array.from({ length: Math.floor((height - pad - 24) / gap) }, (_, i) => `<line x1="0" x2="${width}" y1="${pad + (i + 1) * gap}" y2="${pad + (i + 1) * gap}" stroke="${c.line}"/>`).join('') + `<line x1="${pad - 16}" x2="${pad - 16}" y1="0" y2="${height}" stroke="${c.margin}" stroke-width="1.5"/>`;
        const body = lines.map((l, i) => `<text x="${xOf(pad)}" y="${pad + (i + 1) * gap - 8}" text-anchor="${anchor}">${escXml(drawn(l))}</text>`).join('');
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${c.bg}"/>${rules}<g font-family="${css.replace(/"/g, "'")}" font-size="${size}" fill="${ink}">${body}</g></svg>`;
        blob = new Blob([svg], { type: info.mime });
      } else {
        const { cv } = await drawCanvas();
        const toBlob = (t: string, q?: number) => new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('image failed'))), t, q));
        if (out === 'pdf') {
          const png = await (await toBlob('image/png')).arrayBuffer();
          const pdf = await PDFDocument.create();
          const img = await pdf.embedPng(png);
          const pageW = 595.28;
          const pageH = (pageW * img.height) / img.width;
          const page = pdf.addPage([pageW, pageH]);
          page.drawImage(img, { x: 0, y: 0, width: pageW, height: pageH });
          pdf.setTitle(base);
          pdf.setProducer('Malayalam Studio');
          let bytes = await pdf.save();
          if (pw) bytes = await encryptPdf(bytes, { ...DEFAULT_PDF, userPassword: pw, ownerPassword: pw });
          blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
        } else blob = await toBlob(info.mime, 0.95);
      }
      const r = await writeBlob(blob, base + ext, info.mime, ext, info.label);
      if (r !== 'cancelled') showToast(r === 'saved' ? `Saved ${base}${ext}` : `Saved ${base}${ext} to your downloads`);
    } catch (e) {
      console.error(e);
      showToast('Could not save the handwriting sheet');
    }
  };

  return (
    <div className="space-y-6 p-3">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onBack} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium flex items-center gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to editor
            </button>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2"><PenTool className="w-4 h-4 text-blue-700" /> Malayalam Handwriting Studio</h2>
              <p className="text-xs text-slate-500">Pick a handwriting style or add your own font, then save as an image, PDF, SVG or text.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className={labelCls}>File name</label>
              <input className={fieldCls} style={{ width: 150 }} value={fname} onChange={(e) => setFname(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Save as</label>
              <select className={fieldCls} value={out} onChange={(e) => setOut(e.target.value as Out)}>
                {OUTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            {out === 'pdf' && (
              <div>
                <label className={labelCls}>PDF password (optional)</label>
                <input className={fieldCls} style={{ width: 130 }} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
              </div>
            )}
            <button type="button" onClick={save} className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5">
              <Download className="w-4 h-4" /> Save
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="lg:col-span-2">
            <label className={labelCls}>Handwriting style</label>
            <div className="flex gap-2">
              <select value={family} onChange={(e) => setFamily(e.target.value)} className={fieldCls}>
                {groups.map(([g, list]) => (
                  <optgroup key={g} label={g}>{list.map((f) => <option key={f.family} value={f.family}>{f.label}</option>)}</optgroup>
                ))}
              </select>
              <input ref={upload} type="file" hidden multiple accept=".ttf,.otf,.woff,.woff2" onChange={(e) => { addFonts(e.target.files); e.target.value = ''; }} />
              <button type="button" title="Add your own handwriting font (.ttf, .otf, .woff, .woff2)" onClick={() => upload.current?.click()} className="px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs flex items-center gap-1 whitespace-nowrap">
                <Upload className="w-3.5 h-3.5" /> Add font
              </button>
            </div>
          </div>
          <div>
            <label className={labelCls}>Paper</label>
            <select value={paper} onChange={(e) => setPaper(e.target.value as Paper)} className={fieldCls}>
              {(Object.keys(PAPERS) as Paper[]).map((p) => <option key={p} value={p}>{PAPERS[p].label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Alignment</label>
            <select value={align} onChange={(e) => setAlign(e.target.value as 'left' | 'center' | 'right')} className={fieldCls}>
              <option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Ink</label>
            <div className="flex gap-2">
              <select value={INKS.some((i) => i[0] === ink) ? ink : ''} onChange={(e) => e.target.value && setInk(e.target.value)} className={fieldCls}>
                {!INKS.some((i) => i[0] === ink) && <option value="">Custom</option>}
                {INKS.map(([v, l]) => <option key={v} value={v}>{l} ink</option>)}
              </select>
              <input type="color" value={ink} onChange={(e) => setInk(e.target.value)} title="Any ink colour" style={{ width: 34, height: 30 }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"><span>Text size</span><span>{size}px</span></div>
            <input type="range" min={14} max={96} value={size} onChange={(e) => setSize(+e.target.value)} className="w-full" />
          </div>
          <div>
            <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"><span>Line gap / width</span><span>{gap} / {width}px</span></div>
            <div className="flex gap-2">
              <input type="range" min={24} max={120} value={gap} onChange={(e) => setGap(+e.target.value)} className="w-1/2" title="Line gap" />
              <input type="range" min={500} max={1800} step={20} value={width} onChange={(e) => setWidth(+e.target.value)} className="w-1/2" title="Sheet width" />
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs"><Type className="w-3.5 h-3.5" /> <span>Typing method (F1–F7 also work here):</span></div>
        <TypingBar mode={mode} onMode={onMode} />
      </div>

      <div className="overflow-x-auto pb-4 flex justify-center">
        <div
          style={{
            width, maxWidth: '100%', backgroundColor: c.bg,
            backgroundImage: paper === 'plain' ? 'none' : `repeating-linear-gradient(to bottom, transparent 0px, transparent ${gap - 1}px, ${c.line} ${gap - 1}px, ${c.line} ${gap}px)`,
            borderColor: c.border,
          }}
          className="relative min-h-[480px] rounded-xl border shadow-sm pl-14 pr-10 py-10"
        >
          {paper !== 'plain' && <div style={{ backgroundColor: c.margin }} className="absolute top-0 bottom-0 left-10 w-[1.5px]" />}
          <TypingField
            multiline
            rows={12}
            mode={mode}
            value={text}
            onChange={onChangeText}
            placeholder="ഇവിടെ മലയാളത്തിൽ എഴുതുക…"
            style={{ fontFamily: css, fontSize: `${size}px`, lineHeight: `${gap}px`, color: ink, textAlign: align, width: '100%', minHeight: 420, background: 'transparent', border: 0, outline: 'none', resize: 'none', padding: 0 }}
          />
        </div>
      </div>
    </div>
  );
};
