/** Page geometry at 96 dpi (CSS px). 1 cm = 96/2.54 px. */
export const PX_PER_CM = 96 / 2.54;
export const PX_PER_MM = PX_PER_CM / 10;

export type PageSizeId = string;

const mm = (v: number) => Math.round(v * PX_PER_MM);
const inch = (v: number) => Math.round(v * 96);
const sz = (label: string, w: number, h: number, group: string) => ({ label, w, h, group });

export const PAGE_SIZES: Record<string, { label: string; w: number; h: number; group: string }> = {
  a3: sz('A3 (29.7 × 42 cm)', mm(297), mm(420), 'ISO'),
  a4: sz('A4 (21 × 29.7 cm)', 794, 1123, 'ISO'),
  a5: sz('A5 (14.8 × 21 cm)', mm(148), mm(210), 'ISO'),
  a6: sz('A6 (10.5 × 14.8 cm)', mm(105), mm(148), 'ISO'),
  a7: sz('A7 (7.4 × 10.5 cm)', mm(74), mm(105), 'ISO'),
  b4: sz('B4 (25 × 35.3 cm)', mm(250), mm(353), 'ISO'),
  b5: sz('B5 (17.6 × 25 cm)', mm(176), mm(250), 'ISO'),
  b6: sz('B6 (12.5 × 17.6 cm)', mm(125), mm(176), 'ISO'),
  letter: sz('Letter (8.5 × 11 in)', inch(8.5), inch(11), 'US'),
  legal: sz('Legal (8.5 × 14 in)', inch(8.5), inch(14), 'US'),
  tabloid: sz('Tabloid (11 × 17 in)', inch(11), inch(17), 'US'),
  executive: sz('Executive (7.25 × 10.5 in)', inch(7.25), inch(10.5), 'US'),
  statement: sz('Statement (5.5 × 8.5 in)', inch(5.5), inch(8.5), 'US'),
  folio: sz('Folio (8.5 × 13 in)', inch(8.5), inch(13), 'US'),
  crown: sz('Crown (18.9 × 24.6 cm)', mm(189), mm(246), 'Indian / book'),
  demy: sz('Demy (21.6 × 27.9 cm)', mm(216), mm(279), 'Indian / book'),
  royal: sz('Royal (15.6 × 23.4 cm)', mm(156), mm(234), 'Indian / book'),
  foolscap: sz('Foolscap (21.6 × 33 cm)', mm(216), mm(330), 'Indian / book'),
  dl: sz('Envelope DL (11 × 22 cm)', mm(110), mm(220), 'Envelope'),
  c5: sz('Envelope C5 (16.2 × 22.9 cm)', mm(162), mm(229), 'Envelope'),
  env10: sz('Envelope #10 (4.1 × 9.5 in)', inch(4.125), inch(9.5), 'Envelope'),
  card: sz('Visiting card (9 × 5.5 cm)', mm(90), mm(55), 'Other'),
  postcard: sz('Postcard (10 × 15 cm)', mm(100), mm(150), 'Other'),
  custom: sz('Custom size…', 794, 1123, 'Other'),
};

export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PageLayout {
  size: PageSizeId;
  landscape: boolean;
  margins: Margins;
  /** used when size is 'custom' (px at 96 dpi) */
  customW?: number;
  customH?: number;
}

export const DEFAULT_LAYOUT: PageLayout = { size: 'a4', landscape: false, margins: { top: 96, right: 96, bottom: 96, left: 96 } };

export const MARGIN_PRESETS: Array<{ label: string; margins: Margins }> = [
  { label: 'Normal (2.54 cm)', margins: { top: 96, right: 96, bottom: 96, left: 96 } },
  { label: 'Narrow (1.27 cm)', margins: { top: 48, right: 48, bottom: 48, left: 48 } },
  { label: 'Moderate (1.9 cm)', margins: { top: 96, right: 72, bottom: 96, left: 72 } },
  { label: 'Wide (5 cm sides)', margins: { top: 96, right: 192, bottom: 96, left: 192 } },
  { label: 'Mirrored / book (3.2 + 2.5 cm)', margins: { top: 96, right: 96, bottom: 96, left: 120 } },
  { label: 'None (0 cm)', margins: { top: 0, right: 0, bottom: 0, left: 0 } },
];

export function pageDims(l: PageLayout): { w: number; h: number } {
  const s = PAGE_SIZES[l.size] ?? PAGE_SIZES.a4;
  const w = l.size === 'custom' ? l.customW || s.w : s.w;
  const h = l.size === 'custom' ? l.customH || s.h : s.h;
  return l.landscape ? { w: h, h: w } : { w, h };
}

export const cm = (px: number): string => (px / PX_PER_CM).toFixed(2);
