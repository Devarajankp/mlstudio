/** Document-level settings that are not part of the text: properties, header / footer, page numbers. */

export interface DocProps {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  description: string;
  company: string;
  created: string; // ISO
  modified: string; // ISO
}

export type HAlign = 'left' | 'center' | 'right';

export interface HeaderFooter {
  header: string;
  footer: string;
  headerAlign: HAlign;
  footerAlign: HAlign;
  font: string;
  size: number; // pt
  skipFirst: boolean; // no header/footer on page 1
}

export type PageNumFormat = 'n' | 'page-n' | 'n-of-total' | 'page-n-of-total' | 'dash-n' | 'ml-n';

export interface PageNumbering {
  enabled: boolean;
  position: 'header' | 'footer';
  align: HAlign;
  format: PageNumFormat;
  start: number;
}

export interface DocMeta {
  props: DocProps;
  hf: HeaderFooter;
  pn: PageNumbering;
}

export const PAGE_NUM_FORMATS: Array<[PageNumFormat, string]> = [
  ['n', '1, 2, 3'],
  ['page-n', 'Page 1'],
  ['n-of-total', '1 of 5'],
  ['page-n-of-total', 'Page 1 of 5'],
  ['dash-n', '– 1 –'],
  ['ml-n', '൧, ൨, ൩ (Malayalam digits)'],
];

export const newProps = (): DocProps => {
  const now = new Date().toISOString();
  return { title: '', author: '', subject: '', keywords: '', description: '', company: '', created: now, modified: now };
};

export const DEFAULT_META = (): DocMeta => ({
  props: newProps(),
  hf: { header: '', footer: '', headerAlign: 'center', footerAlign: 'center', font: 'Noto Sans Malayalam', size: 10, skipFirst: false },
  pn: { enabled: false, position: 'footer', align: 'center', format: 'n', start: 1 },
});

const ML_DIGITS = '൦൧൨൩൪൫൬൭൮൯';
export const toMlDigits = (s: string): string => s.replace(/\d/g, (d) => ML_DIGITS[+d]);

/** The page-number text for page `n` of `total`. */
export function formatPageNumber(pn: PageNumbering, n: number, total: number): string {
  const num = n + pn.start - 1;
  const all = total + pn.start - 1;
  switch (pn.format) {
    case 'page-n':
      return `Page ${num}`;
    case 'n-of-total':
      return `${num} of ${all}`;
    case 'page-n-of-total':
      return `Page ${num} of ${all}`;
    case 'dash-n':
      return `– ${num} –`;
    case 'ml-n':
      return toMlDigits(String(num));
    default:
      return String(num);
  }
}

/** Replace {page} {pages} {date} {title} {author} in header / footer text. */
export function expandTokens(text: string, n: number, total: number, props: DocProps): string {
  return text
    .replace(/\{page\}/gi, String(n))
    .replace(/\{pages\}/gi, String(total))
    .replace(/\{date\}/gi, new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }))
    .replace(/\{title\}/gi, props.title)
    .replace(/\{author\}/gi, props.author);
}

/** Final header / footer lines for a page (text, align), page number merged in. */
export function headerFooterFor(meta: DocMeta, page: number, total: number): { header: Array<[string, HAlign]>; footer: Array<[string, HAlign]> } {
  const out = { header: [] as Array<[string, HAlign]>, footer: [] as Array<[string, HAlign]> };
  const skip = meta.hf.skipFirst && page === 1;
  if (!skip) {
    if (meta.hf.header.trim()) out.header.push([expandTokens(meta.hf.header, page, total, meta.props), meta.hf.headerAlign]);
    if (meta.hf.footer.trim()) out.footer.push([expandTokens(meta.hf.footer, page, total, meta.props), meta.hf.footerAlign]);
  }
  if (meta.pn.enabled && !(meta.hf.skipFirst && page === 1 && false)) out[meta.pn.position].push([formatPageNumber(meta.pn, page, total), meta.pn.align]);
  return out;
}
