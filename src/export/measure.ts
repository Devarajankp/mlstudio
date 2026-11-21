/**
 * Lays the document out in an off-screen copy and reads back where the browser put every word, line,
 * border and picture. The PDF writer then draws the very same positions as vector text, and the
 * paginator cuts the result into pages (lines, table rows, pictures and text boxes are never split).
 */
import { isLegacy, runToUnicode } from '../lib/legacy';
import { seriesOfFamily } from '../lib/fonts';
import { familyName, hexOf } from './shared';

export interface StructNode {
  tag: string;
  parent: StructNode | null;
  kids: StructNode[];
  alt?: string;
}

interface Base {
  atom: string;
}
export type Prim =
  | (Base & { k: 'text'; x: number; y: number; h: number; base: number; text: string; actual?: string; family: string; size: number; bold: boolean; italic: boolean; color: string; node: StructNode })
  | (Base & { k: 'rect'; x: number; y: number; w: number; h: number; fill: string })
  | (Base & { k: 'line'; x1: number; y1: number; x2: number; y2: number; w: number; color: string })
  | (Base & { k: 'img'; x: number; y: number; w: number; h: number; src: string; alt: string; node: StructNode })
  | (Base & { k: 'link'; x: number; y: number; w: number; h: number; url: string })
  | (Base & { k: 'dot'; x: number; y: number; r: number; color: string })
  | (Base & { k: 'num'; x: number; base: number; text: string; size: number; family: string; color: string; node: StructNode });

export interface Atom {
  top: number;
  bottom: number;
  order: number;
  force?: boolean;
}

export interface Measured {
  prims: Prim[];
  atoms: Map<string, Atom>;
  height: number;
  root: StructNode;
}

const TAGS: Record<string, string> = { P: 'P', H1: 'H1', H2: 'H2', H3: 'H3', UL: 'L', OL: 'L', LI: 'LI', TABLE: 'Table', TR: 'TR', TD: 'TD', TH: 'TH', BLOCKQUOTE: 'BlockQuote', IMG: 'Figure' };

async function loadFonts(html: string): Promise<void> {
  const fams = new Set<string>(['Noto Sans Malayalam']);
  for (const m of html.matchAll(/font-family:\s*([^;">]+)/g)) fams.add(familyName(m[1].replace(/&quot;/g, '"')));
  const jobs: Promise<unknown>[] = [];
  for (const f of fams) for (const style of ['', 'bold ', 'italic ', 'italic bold ']) jobs.push(document.fonts.load(`${style}16px "${f}"`, 'മAa1').catch(() => []));
  await Promise.all(jobs);
  await document.fonts.ready;
}

export async function measure(html: string, contentW: number): Promise<Measured> {
  await loadFonts(html);
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-100000px;top:0;visibility:hidden;pointer-events:none';
  const root = document.createElement('div');
  root.className = 'msx-prose msx-measure';
  root.style.cssText = `width:${contentW}px;min-height:0`;
  root.innerHTML = html;
  host.appendChild(root);
  document.body.appendChild(host);
  try {
    return collect(root);
  } finally {
    host.remove();
  }
}

function collect(root: HTMLElement): Measured {
  const rootRect = root.getBoundingClientRect();
  const X = (v: number) => v - rootRect.left;
  const Y = (v: number) => v - rootRect.top;
  const prims: Prim[] = [];
  const atoms = new Map<string, Atom>();
  let order = 0;
  const addAtom = (key: string, top: number, bottom: number, force = false) => {
    const a = atoms.get(key);
    if (a) {
      a.top = Math.min(a.top, top);
      a.bottom = Math.max(a.bottom, bottom);
    } else atoms.set(key, { top, bottom, order: order++, force });
  };

  /* ---- structure tree (for tagged / accessible PDF) */
  const rootNode: StructNode = { tag: 'Document', parent: null, kids: [] };
  const nodes = new Map<Element, StructNode>();
  const tagOf = (el: Element) => (el.classList.contains('msx-textbox') ? 'Div' : TAGS[el.tagName]);
  const structOf = (el: Element | null): StructNode => {
    if (!el || el === root) return rootNode;
    const hit = nodes.get(el);
    if (hit) return hit;
    const tag = tagOf(el);
    if (!tag) {
      const up = structOf(el.parentElement);
      nodes.set(el, up);
      return up;
    }
    const parent = structOf(el.parentElement);
    const n: StructNode = { tag, parent, kids: [] };
    parent.kids.push(n);
    nodes.set(el, n);
    return n;
  };

  /* ---- unbreakable containers: outermost table row / text box */
  const ids = new Map<Element, string>();
  const idOf = (el: Element, p: string) => {
    let v = ids.get(el);
    if (!v) ids.set(el, (v = `${p}${ids.size}`));
    return v;
  };
  const outermost = (el: Element, sel: string): Element | null => {
    let found: Element | null = null;
    let t = el.closest(sel);
    while (t && root.contains(t)) {
      found = t;
      t = t.parentElement?.closest(sel) ?? null;
    }
    return found;
  };
  const containerAtom = (el: Element): string | null => {
    const box = outermost(el, '.msx-textbox');
    const row = outermost(el, 'tr');
    const pick = box && row ? (box.contains(row) ? box : row) : (box ?? row);
    if (!pick) return null;
    const key = idOf(pick, pick === row ? 'R' : 'B');
    const r = pick.getBoundingClientRect();
    addAtom(key, Y(r.top), Y(r.bottom));
    return key;
  };

  /* ---- text and pictures, in document order */
  const blockOf = (el: Element) => el.closest('p,h1,h2,h3,li,td,th,blockquote,div') ?? root;
  type Pending = Extract<Prim, { k: 'text' }> & { block: Element; own: boolean };
  const texts: Pending[] = [];
  const firstOfLi = new Map<Element, Pending>();
  const extras: Array<() => void> = [];

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let imgN = 0;
  for (let n: Node | null = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === 1) {
      const el = n as HTMLElement;
      if (el.tagName === 'IMG') {
        const r = el.getBoundingClientRect();
        const own = containerAtom(el) ?? `I${imgN++}`;
        if (!own.startsWith('R') && !own.startsWith('B')) addAtom(own, Y(r.top), Y(r.bottom));
        prims.push({ k: 'img', atom: own, x: X(r.left), y: Y(r.top), w: r.width, h: r.height, src: (el as HTMLImageElement).src, alt: el.getAttribute('alt') || '', node: structOf(el) });
        const node = structOf(el);
        node.alt = el.getAttribute('alt') || 'Picture';
      }
      continue;
    }
    const tn = n as Text;
    const data = tn.data;
    if (!/\S/.test(data)) continue;
    const pe = tn.parentElement!;
    if (pe.closest('[data-bookmark]')) continue;
    const cs = getComputedStyle(pe);
    const family = familyName(cs.fontFamily);
    const size = parseFloat(cs.fontSize) || 16;
    const bold = parseInt(cs.fontWeight, 10) >= 600 || cs.fontWeight === 'bold';
    const italic = cs.fontStyle === 'italic';
    const color = hexOf(cs.color);
    let deco = '';
    for (let e: Element | null = pe; e && e !== root; e = e.parentElement) {
      deco += ' ' + getComputedStyle(e).textDecorationLine;
      if (/block|table|list-item/.test(getComputedStyle(e).display)) break;
    }
    const under = /underline/.test(deco);
    const strike = /line-through/.test(deco);
    const mark = pe.closest('mark');
    const markBg = mark ? hexOf(getComputedStyle(mark).backgroundColor, '') : '';
    const link = pe.closest('a[href]') as HTMLAnchorElement | null;
    const legacy = isLegacy(seriesOfFamily(family));
    const block = blockOf(pe);
    const own = containerAtom(pe);
    const node = structOf(pe);

    // baseline offset of this text node, measured with a zero-size inline probe
    const probe = document.createElement('span');
    probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    pe.insertBefore(probe, tn);
    const range = document.createRange();
    const words = [...data.matchAll(/\S+/g)];
    let d = 0;
    {
      const w0 = words[0];
      range.setStart(tn, w0.index!);
      range.setEnd(tn, w0.index! + w0[0].length);
      const r0 = range.getClientRects()[0] ?? range.getBoundingClientRect();
      d = probe.getBoundingClientRect().bottom - r0.top;
    }
    probe.remove();

    let prev: DOMRect | null = null;
    for (const w of words) {
      const start = w.index!;
      const rects: Array<{ rect: DOMRect; text: string }> = [];
      range.setStart(tn, start);
      range.setEnd(tn, start + w[0].length);
      const all = Array.from(range.getClientRects()).filter((r) => r.width > 0);
      if (all.length <= 1) rects.push({ rect: all[0] ?? range.getBoundingClientRect(), text: w[0] });
      else {
        // the word wraps: split it where the line changes
        const chars = Array.from(w[0]);
        let off = start;
        let group = '';
        let gRect: DOMRect | null = null;
        for (const ch of chars) {
          range.setStart(tn, off);
          range.setEnd(tn, off + ch.length);
          const r = range.getClientRects()[0];
          off += ch.length;
          if (!r || r.width === 0) {
            group += ch;
            continue;
          }
          if (gRect && Math.abs(r.top - gRect.top) > 2) {
            rects.push({ rect: gRect, text: group });
            group = '';
            gRect = null;
          }
          if (!gRect) gRect = r;
          group += ch;
        }
        if (group && gRect) rects.push({ rect: gRect, text: group });
      }
      for (const { rect, text } of rects) {
        const p = { k: 'text', atom: own ?? '', x: X(rect.left), y: Y(rect.top), h: rect.height, base: Y(rect.top + d), text, actual: legacy ? runToUnicode(text) : /[\u0d00-\u0d7f]/.test(text) ? text : undefined, family, size, bold, italic, color, node, block, own: !!own } as Pending;
        texts.push(p);
        const li = pe.closest('li');
        if (li && !firstOfLi.has(li)) firstOfLi.set(li, p);
        const gapFrom = prev && Math.abs(rect.top - prev.top) < 2 && rect.left > prev.right ? prev.right : null;
        const rx = X(rect.left);
        const rw = rect.width;
        const ry = Y(rect.top);
        extras.push(() => {
          const atom = p.atom;
          const x0 = gapFrom !== null ? X(gapFrom) : rx;
          if (markBg) prims.push({ k: 'rect', atom, x: x0, y: ry, w: rw + (rx - x0), h: rect.height, fill: markBg });
          if (under) prims.push({ k: 'line', atom, x1: x0, y1: p.base + size * 0.12, x2: rx + rw, y2: p.base + size * 0.12, w: Math.max(0.8, size * 0.06), color });
          if (strike) prims.push({ k: 'line', atom, x1: x0, y1: p.base - size * 0.3, x2: rx + rw, y2: p.base - size * 0.3, w: Math.max(0.8, size * 0.06), color });
          if (link) prims.push({ k: 'link', atom, x: rx, y: ry, w: rw, h: rect.height, url: link.getAttribute('href') || '' });
        });
        prev = rect;
      }
    }
  }

  /* ---- lines: cluster words of one block by baseline */
  const byBlock = new Map<Element, Pending[]>();
  for (const t of texts) if (!t.own) (byBlock.get(t.block) ?? byBlock.set(t.block, []).get(t.block)!).push(t);
  for (const [block, list] of byBlock) {
    const bid = idOf(block, 'P');
    list.sort((a, b) => a.base - b.base);
    let cluster = -1;
    let last = -1e9;
    for (const t of list) {
      if (t.base - last > 3) cluster++;
      last = t.base;
      t.atom = `L${bid}.${cluster}`;
      addAtom(t.atom, t.y, t.y + t.h);
    }
  }
  for (const t of texts) {
    const { block: _b, own: _o, ...rest } = t;
    void _b;
    void _o;
    if (t.own) addAtom(t.atom, 0, 0); // already registered by containerAtom
    prims.push(rest as Prim);
  }
  extras.forEach((f) => f());

  /* ---- list markers */
  for (const [li, first] of firstOfLi) {
    const parent = li.parentElement;
    const ordered = parent?.tagName === 'OL';
    let depth = 0;
    for (let e = parent?.parentElement; e && e !== root; e = e.parentElement) if (e.tagName === 'UL' || e.tagName === 'OL') depth++;
    const size = first.size;
    if (ordered) {
      const idx = Array.from(parent!.children).indexOf(li) + (parseInt(parent!.getAttribute('start') || '1', 10) || 1);
      prims.push({ k: 'num', atom: first.atom, x: first.x - size * 1.6, base: first.base, text: `${idx}.`, size, family: first.family, color: first.color, node: first.node });
    } else {
      prims.push({ k: 'dot', atom: first.atom, x: first.x - size * 0.9, y: first.base - size * 0.28, r: size * (depth === 0 ? 0.12 : 0.1), color: first.color });
    }
  }

  /* ---- boxes: cell backgrounds, borders, text boxes, rules, page breaks */
  const sides = (el: Element, atom: string, r: DOMRect) => {
    const cs = getComputedStyle(el);
    const x = X(r.left), y = Y(r.top), w = r.width, h = r.height;
    const edge = (wid: string, style: string, col: string, x1: number, y1: number, x2: number, y2: number) => {
      const bw = parseFloat(wid);
      if (bw > 0 && style !== 'none' && style !== 'hidden') prims.push({ k: 'line', atom, x1, y1, x2, y2, w: bw, color: hexOf(col) });
    };
    const t = parseFloat(cs.borderTopWidth) / 2, b = parseFloat(cs.borderBottomWidth) / 2, l = parseFloat(cs.borderLeftWidth) / 2, rr = parseFloat(cs.borderRightWidth) / 2;
    edge(cs.borderTopWidth, cs.borderTopStyle, cs.borderTopColor, x, y + t, x + w, y + t);
    edge(cs.borderBottomWidth, cs.borderBottomStyle, cs.borderBottomColor, x, y + h - b, x + w, y + h - b);
    edge(cs.borderLeftWidth, cs.borderLeftStyle, cs.borderLeftColor, x + l, y, x + l, y + h);
    edge(cs.borderRightWidth, cs.borderRightStyle, cs.borderRightColor, x + w - rr, y, x + w - rr, y + h);
  };
  const boxed = Array.from(root.querySelectorAll('td,th,.msx-textbox'));
  for (const el of boxed) {
    const atom = containerAtom(el) ?? '';
    if (!atom) continue;
    const r = el.getBoundingClientRect();
    const bg = hexOf(getComputedStyle(el).backgroundColor, '');
    if (bg && bg !== '#ffffff') prims.unshift({ k: 'rect', atom, x: X(r.left), y: Y(r.top), w: r.width, h: r.height, fill: bg });
    sides(el, atom, r);
  }
  let hrN = 0;
  for (const hr of Array.from(root.querySelectorAll('hr'))) {
    const r = hr.getBoundingClientRect();
    const atom = `H${hrN++}`;
    addAtom(atom, Y(r.top), Y(r.bottom));
    const cs = getComputedStyle(hr);
    prims.push({ k: 'line', atom, x1: X(r.left), y1: Y(r.top) + 0.5, x2: X(r.right), y2: Y(r.top) + 0.5, w: Math.max(1, parseFloat(cs.borderTopWidth)), color: hexOf(cs.borderTopColor, '#999999') });
  }
  let pbN = 0;
  for (const pb of Array.from(root.querySelectorAll('[data-page-break]'))) {
    const r = pb.getBoundingClientRect();
    addAtom(`PB${pbN++}`, Y(r.top), Y(r.top), true);
  }

  return { prims, atoms, height: root.scrollHeight, root: rootNode };
}

/* ------------------------------------------------------------------ pagination */

export interface Placement {
  pages: number;
  /** page index (0-based) and vertical offset of an atom, in the same px as the measurements */
  page(atom: string): number;
  shift(atom: string): number;
}

export function paginate(m: Measured, pageH: number): Placement {
  const list = [...m.atoms.entries()].sort((a, b) => a[1].top - b[1].top || a[1].order - b[1].order);
  const shifts = new Map<string, number>();
  const pagesOf = new Map<string, number>();
  let shift = 0;
  let page = 0;
  let forced = false;
  for (const [key, a] of list) {
    let top = a.top + shift;
    const h = Math.max(0, a.bottom - a.top);
    if (forced && !a.force) {
      page++;
      shift += page * pageH - top;
      top = page * pageH;
      forced = false;
    }
    if (top >= (page + 1) * pageH) page = Math.floor(top / pageH);
    else if (top + h > (page + 1) * pageH + 0.5 && top > page * pageH + 0.5 && h <= pageH) {
      page++;
      shift += page * pageH - top;
      top = page * pageH;
    }
    if (a.force) forced = true;
    shifts.set(key, shift);
    pagesOf.set(key, Math.max(0, Math.floor((top + 0.01) / pageH)));
  }
  const total = Math.max(1, ...[...pagesOf.values()].map((p) => p + 1), 1);
  return { pages: total, page: (k) => pagesOf.get(k) ?? 0, shift: (k) => shifts.get(k) ?? 0 };
}
