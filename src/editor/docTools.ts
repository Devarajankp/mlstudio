import type { Editor, JSONContent } from '@tiptap/core';
import { Mark } from '@tiptap/pm/model';
import { DEFAULT_FONT, normalizeFamilyValue, quoteFamily, seriesOfFamily } from '../lib/fonts';
import { canonicalizeUnicode, isLegacy, runToUnicode, unicodeToLegacy } from '../lib/legacy';
import { correctNewChillu, normalizeMalayalamKeyboardInput } from '../utils/keyboardLayouts';
import { seriesOfMarks } from './marks';

/* ---------------------------------------------------------------- export as Unicode */

/** Copy of a document JSON where every legacy-font run is converted back to Unicode (font -> Noto Sans Malayalam). */
export function toUnicodeJSON(node: JSONContent): JSONContent {
  const out: JSONContent = { ...node };
  if (node.type === 'text' && node.text) {
    const ts = node.marks?.find((m) => m.type === 'textStyle');
    const family = normalizeFamilyValue(ts?.attrs?.fontFamily as string | undefined);
    if (family && isLegacy(seriesOfFamily(family))) {
      out.text = runToUnicode(node.text);
      out.marks = node.marks!.map((m) => (m.type === 'textStyle' ? { ...m, attrs: { ...m.attrs, fontFamily: quoteFamily(DEFAULT_FONT) } } : m));
    }
  }
  if (node.content) out.content = node.content.map(toUnicodeJSON);
  return out;
}

/** Plain Unicode text, one line per paragraph. */
export function docToUnicodeText(editor: Editor): string {
  const lines: string[] = [];
  editor.state.doc.descendants((node) => {
    if (!node.isTextblock) return true;
    let line = '';
    node.forEach((child) => {
      if (child.isText) line += isLegacy(seriesOfMarks(child.marks)) ? runToUnicode(child.text!) : child.text!;
      else if (child.type.name === 'hardBreak') line += '\n';
    });
    lines.push(line);
    return false;
  });
  return lines.join('\n');
}

/** Plain text (Unicode) -> document JSON; pass a legacy font family to place already-encoded text in that font. */
export function textToDoc(text: string, family?: string): JSONContent {
  const marks = family ? [{ type: 'textStyle', attrs: { fontFamily: quoteFamily(family) } }] : undefined;
  return {
    type: 'doc',
    content: text.split(/\r?\n/).map((line) => (line ? { type: 'paragraph', content: [{ type: 'text', text: line, marks }] } : { type: 'paragraph' })),
  };
}

/* ---------------------------------------------------------------- find & replace */

export interface Match {
  from: number;
  to: number;
  marks: readonly Mark[];
  replacement: string; // replacement text already encoded for this match's font
}

/** Matches of `query` in the document. Text inside legacy fonts is searched with the query encoded for that font. */
export function findMatches(editor: Editor, query: string, replacement: string, matchCase: boolean): Match[] {
  const out: Match[] = [];
  if (!query) return out;
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    const series = seriesOfMarks(node.marks);
    const q = isLegacy(series) ? unicodeToLegacy(query, series) : query;
    const rep = isLegacy(series) ? unicodeToLegacy(replacement, series) : replacement;
    const hay = matchCase ? node.text! : node.text!.toLowerCase();
    const needle = matchCase ? q : q.toLowerCase();
    if (!needle) return;
    let i = 0;
    while ((i = hay.indexOf(needle, i)) !== -1) {
      out.push({ from: pos + i, to: pos + i + needle.length, marks: node.marks, replacement: rep });
      i += needle.length;
    }
  });
  return out;
}

export function replaceMatches(editor: Editor, matches: Match[]): number {
  if (!matches.length) return 0;
  const { state, view } = editor;
  const tr = state.tr;
  for (const m of [...matches].sort((a, b) => b.from - a.from)) {
    if (m.replacement) tr.replaceWith(m.from, m.to, state.schema.text(m.replacement, m.marks));
    else tr.delete(m.from, m.to);
  }
  tr.setMeta('legacyConvert', true);
  view.dispatch(tr);
  return matches.length;
}

/* ---------------------------------------------------------------- clean-up */

/** Chillu / vowel-sign clean-up (the original "Spell & Chillu check") on Unicode text in the selection, or the whole document. */
export function cleanupUnicode(editor: Editor): number {
  const { state, view } = editor;
  const { from, to, empty } = state.selection;
  const a = empty ? 0 : from;
  const b = empty ? state.doc.content.size : to;
  const tr = state.tr;
  let changed = 0;
  const jobs: Array<{ s: number; e: number; text: string; marks: readonly Mark[] }> = [];
  state.doc.nodesBetween(a, b, (node, pos) => {
    if (!node.isText || isLegacy(seriesOfMarks(node.marks))) return;
    const s = Math.max(pos, a);
    const e = Math.min(pos + node.nodeSize, b);
    const part = node.text!.slice(s - pos, e - pos);
    const fixed = canonicalizeUnicode(correctNewChillu(normalizeMalayalamKeyboardInput(part)));
    if (fixed !== part) jobs.push({ s, e, text: fixed, marks: node.marks });
  });
  for (const j of jobs.sort((x, y) => y.s - x.s)) {
    tr.replaceWith(j.s, j.e, state.schema.text(j.text, j.marks));
    changed++;
  }
  if (changed) {
    tr.setMeta('legacyConvert', true);
    view.dispatch(tr);
  }
  return changed;
}
