import React, { useMemo, useRef } from 'react';
import { PX_PER_CM, PX_PER_MM, cm } from '../lib/page';

export type RulerUnit = 'cm' | 'in';

/** Tick marks around `origin` (px) inside [0,length]: level 3 = labelled major, 2 = half, 1 = quarter/5mm, 0 = minor. */
export function scaleTicks(origin: number, length: number, unit: RulerUnit): Array<{ x: number; level: number; label?: string }> {
  const step = unit === 'cm' ? PX_PER_MM : 96 / 16;
  const per = unit === 'cm' ? 10 : 16;
  const out: Array<{ x: number; level: number; label?: string }> = [];
  const kMin = -Math.floor(origin / step);
  const kMax = Math.floor((length - origin) / step);
  for (let k = kMin; k <= kMax; k++) {
    const a = Math.abs(k);
    let level = 0;
    if (a % per === 0) level = 3;
    else if (a % (per / 2) === 0) level = 2;
    else if (unit === 'in' ? a % 4 === 0 : false) level = 1;
    else if (unit === 'in' ? a % 2 === 0 : false) level = 0.5;
    out.push({ x: origin + k * step, level, label: level === 3 && k !== 0 ? String(a / per) : undefined });
  }
  return out;
}

interface RulerProps {
  pageWidth: number;
  margins: { left: number; right: number };
  /** indent of the current paragraph, relative to the left margin (px) */
  indent: { left: number; first: number };
  onMargins: (m: { left: number; right: number }) => void;
  onIndent: (left: number, first: number) => void;
  unit?: RulerUnit;
  /** bottom ruler: scale and margins only */
  simple?: boolean;
}

type Drag = 'margin-left' | 'margin-right' | 'first' | 'hanging' | 'both' | null;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const snap = (v: number) => Math.round(v / PX_PER_MM) * PX_PER_MM;

/** Word-style horizontal ruler: cm scale, draggable page margins and first-line / hanging / left indents. */
export const Ruler: React.FC<RulerProps> = ({ pageWidth, margins, indent, onMargins, onIndent, unit = 'cm', simple = false }) => {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag>(null);
  const textWidth = pageWidth - margins.left - margins.right;

  const ticks = useMemo(() => {
    const out: React.ReactNode[] = [];
    scaleTicks(margins.left, pageWidth, unit).forEach((t, i) => {
      const h = t.level === 3 ? 13 : t.level === 2 ? 16 : t.level === 1 ? 17 : t.level === 0.5 ? 18 : 19;
      out.push(<line key={i} x1={t.x} x2={t.x} y1={simple ? 0 : h} y2={simple ? 22 - h : 22} />);
      if (t.label) out.push(<text key={`t${i}`} x={t.x} y={simple ? 28 : 11} textAnchor="middle">{t.label}</text>);
    });
    return out;
  }, [margins.left, pageWidth, unit, simple]);

  const xOf = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return (e.clientX - r.left) * (pageWidth / r.width);
  };

  const start = (kind: Exclude<Drag, null>) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = kind;
  };

  const move = (e: React.PointerEvent) => {
    const kind = drag.current;
    if (!kind) return;
    const x = xOf(e);
    if (kind === 'margin-left') {
      onMargins({ left: clamp(snap(x), 0, pageWidth - margins.right - 120), right: margins.right });
    } else if (kind === 'margin-right') {
      onMargins({ left: margins.left, right: clamp(snap(pageWidth - x), 0, pageWidth - margins.left - 120) });
    } else {
      const rel = snap(x - margins.left);
      if (kind === 'first') onIndent(indent.left, clamp(rel - indent.left, -indent.left, textWidth - indent.left - 24));
      else if (kind === 'hanging') {
        const left = clamp(rel, 0, textWidth - 24);
        onIndent(left, indent.left + indent.first - left); // first-line marker stays put
      } else onIndent(clamp(rel, 0, textWidth - 24), indent.first); // move both together
    }
  };

  const end = () => {
    drag.current = null;
  };

  const xFirst = margins.left + indent.left + indent.first;
  const xLeft = margins.left + indent.left;

  return (
    <div ref={ref} className={`msx-ruler${simple ? ' is-bottom' : ''}`} style={{ width: pageWidth }} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <div className="msx-ruler-margin" style={{ left: 0, width: margins.left }} />
      <div className="msx-ruler-margin" style={{ right: 0, width: margins.right }} />
      <svg width={pageWidth} height={34} className="msx-ruler-scale" aria-hidden>
        {ticks}
      </svg>
      <div className="msx-ruler-edge" style={{ left: margins.left - 4 }} title={`Left margin ${cm(margins.left)} cm`} onPointerDown={start('margin-left')} />
      <div className="msx-ruler-edge" style={{ left: pageWidth - margins.right - 4 }} title={`Right margin ${cm(margins.right)} cm`} onPointerDown={start('margin-right')} />
      {!simple && (
        <>
          <div className="msx-ind msx-ind-first" style={{ left: xFirst - 5 }} title={`First line indent ${cm(indent.left + indent.first)} cm`} onPointerDown={start('first')} />
          <div className="msx-ind msx-ind-hang" style={{ left: xLeft - 5 }} title={`Hanging indent ${cm(indent.left)} cm`} onPointerDown={start('hanging')} />
          <div className="msx-ind msx-ind-both" style={{ left: xLeft - 5 }} title={`Left indent ${cm(indent.left)} cm`} onPointerDown={start('both')} />
        </>
      )}
    </div>
  );
};

export { PX_PER_CM };

interface VProps {
  side: 'left' | 'right';
  height: number;
  pages: number;
  contentH: number;
  margins: { top: number; bottom: number };
  onMargins: (m: { top: number; bottom: number }) => void;
  unit: RulerUnit;
}

/** Vertical ruler along the left or right edge of the page: scale restarts on every page, top / bottom margins are draggable. */
export const VRuler: React.FC<VProps> = ({ side, height, pages, contentH, margins, onMargins, unit }) => {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<'top' | 'bottom' | null>(null);
  const ticks = useMemo(() => {
    const out: React.ReactNode[] = [];
    for (let p = 0; p < pages; p++) {
      const top = margins.top + p * contentH;
      scaleTicks(0, contentH, unit).forEach((t, i) => {
        const h = t.level === 3 ? 12 : t.level === 2 ? 9 : t.level === 1 ? 7 : t.level === 0.5 ? 5 : 4;
        const y = top + t.x;
        const x1 = side === 'left' ? 22 - h : 0;
        const x2 = side === 'left' ? 22 : h;
        out.push(<line key={`${p}-${i}`} y1={y} y2={y} x1={x1} x2={x2} />);
        if (t.label) out.push(<text key={`${p}-t${i}`} x={11} y={y + 3} textAnchor="middle">{t.label}</text>);
      });
    }
    return out;
  }, [pages, contentH, margins.top, unit, side]);
  const yOf = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return (e.clientY - r.top) * (height / r.height); };
  const move = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const y = yOf(e);
    if (drag.current === 'top') onMargins({ top: clamp(snap(y), 0, contentH * 0.6), bottom: margins.bottom });
    else onMargins({ top: margins.top, bottom: clamp(snap(height - y), 0, contentH * 0.6) });
  };
  const start = (k: 'top' | 'bottom') => (e: React.PointerEvent) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); drag.current = k; };
  return (
    <div ref={ref} className={`msx-vruler is-${side}`} style={{ height }} onPointerMove={move} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}>
      <div className="msx-ruler-margin" style={{ top: 0, height: margins.top, left: 0, right: 0, bottom: 'auto' }} />
      <div className="msx-ruler-margin" style={{ bottom: 0, height: margins.bottom, left: 0, right: 0, top: 'auto' }} />
      <svg width={22} height={height} className="msx-ruler-scale" aria-hidden>{ticks}</svg>
      <div className="msx-vedge" style={{ top: margins.top - 4 }} title={`Top margin ${cm(margins.top)} cm`} onPointerDown={start('top')} />
      <div className="msx-vedge" style={{ top: height - margins.bottom - 4 }} title={`Bottom margin ${cm(margins.bottom)} cm`} onPointerDown={start('bottom')} />
    </div>
  );
};
