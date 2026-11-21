import type { Editor } from '@tiptap/core';
import { Fragment, Mark } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { quoteFamily, seriesOfFamily } from '../lib/fonts';
import {
  canonicalizeUnicode,
  hasMalayalam,
  isLegacy,
  runToUnicode,
  unicodeToLegacy,
  type Series,
} from '../lib/legacy';
import { normalizeMalayalamKeyboardInput } from '../utils/keyboardLayouts';
import { seriesOfMarks } from './marks';

/* ------------------------------------------------------------------ font switching */

function withFont(editor: Editor, marks: readonly Mark[], family: string | null): readonly Mark[] {
  const ts = editor.schema.marks.textStyle;
  const cur = marks.find((m) => m.type === ts);
  const attrs = { ...(cur?.attrs ?? {}), fontFamily: family ? quoteFamily(family) : null };
  return ts.create(attrs).addToSet(marks.filter((m) => m.type !== ts));
}

interface Piece {
  text: string;
  marks: readonly Mark[];
}

/** Re-encode one text run for a new font, splitting off English words when going to a legacy font. */
function convertRun(editor: Editor, text: string, marks: readonly Mark[], target: Series, family: string): Piece[] {
  const old = seriesOfMarks(marks);
  const oldLegacy = isLegacy(old);
  const uni = oldLegacy ? runToUnicode(text) : text;

  if (!isLegacy(target)) return [{ text: uni, marks: withFont(editor, marks, family) }];

  const tokens = uni.split(/(\s+)/).filter((t) => t !== '');
  const isSpace = (t: string | undefined) => !!t && /^\s+$/.test(t);
  const mal = tokens.map((t) => !isSpace(t) && hasMalayalam(t));
  // English words keep their own font: only Malayalam words (and spaces between them) go legacy.
  const flags = tokens.map((t, i) => oldLegacy || mal[i] || (isSpace(t) && !!mal[i - 1] && !!mal[i + 1]));

  const pieces: Piece[] = [];
  let buf = '';
  let bufFlag: boolean | null = null;
  const flush = () => {
    if (!buf) return;
    pieces.push(bufFlag ? { text: unicodeToLegacy(buf, target), marks: withFont(editor, marks, family) } : { text: buf, marks });
    buf = '';
  };
  tokens.forEach((t, i) => {
    if (bufFlag !== null && flags[i] !== bufFlag) flush();
    bufFlag = flags[i];
    buf += t;
  });
  flush();
  return pieces;
}

/**
 * Apply a font to the selection. Moving text between a Unicode font and a legacy ML/FML font (or
 * between the two legacy series) re-encodes it, so the same Malayalam is shown correctly.
 * With only a caret, the font simply applies to what is typed next.
 */
export function applyFontFamily(editor: Editor, family: string): void {
  const target = seriesOfFamily(family);
  const { state, view } = editor;
  const { from, to, empty } = state.selection;
  if (empty) {
    editor.chain().focus().setFontFamily(quoteFamily(family)).run();
    return;
  }

  const edits: Array<{ from: number; to: number; pieces: Piece[] }> = [];
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return true;
    node.forEach((child, offset) => {
      if (!child.isText) return;
      const cs = pos + 1 + offset;
      const s = Math.max(cs, from);
      const e = Math.min(cs + child.nodeSize, to);
      if (s >= e) return;
      edits.push({ from: s, to: e, pieces: convertRun(editor, child.text!.slice(s - cs, e - cs), child.marks, target, family) });
    });
    return false;
  });
  if (!edits.length) return;

  const tr = state.tr;
  for (const e of edits.sort((a, b) => b.from - a.from)) {
    tr.replaceWith(e.from, e.to, Fragment.fromArray(e.pieces.filter((p) => p.text).map((p) => state.schema.text(p.text, p.marks))));
  }
  tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(from, -1), tr.mapping.map(to, 1)));
  tr.setMeta('legacyConvert', true);
  view.dispatch(tr);
  view.focus();
}

/* ------------------------------------------------------------------ typing helpers */

/** Insert literal text at the caret (never parsed as HTML). Legacy sync re-encodes it when needed. */
export function insertPlain(editor: Editor, text: string): void {
  if (!text) return;
  editor.chain().focus().insertContent({ type: 'text', text }).run();
}

/** After a keystroke in Unicode text, repair sequences the keyboard layouts produce (െ+ാ -> ൊ, ZWSP reordering …). */
export function normalizeAroundCursor(editor: Editor): void {
  const { state } = editor;
  const sel = state.selection;
  if (!sel.empty) return;
  const $h = sel.$head;
  if (!$h.parent.isTextblock) return;
  const marks = $h.marks();
  if (isLegacy(seriesOfMarks(marks))) return; // LegacySync normalises legacy words itself
  const off = $h.parentOffset;
  const before = $h.parent.textBetween(Math.max(0, off - 8), off, undefined, '￼');
  if (before.includes('￼')) return;
  const fixed = canonicalizeUnicode(normalizeMalayalamKeyboardInput(before));
  if (fixed === before) return;
  const tr = state.tr.replaceWith(sel.from - before.length, sel.from, state.schema.text(fixed, marks));
  editor.view.dispatch(tr);
}

/**
 * Backspace inside a legacy-coded word removes ONE Malayalam letter/sign (as in a Unicode editor)
 * instead of one hidden legacy code. Returns true when it handled the key.
 */
export function legacyBackspace(editor: Editor): boolean {
  const { state } = editor;
  const sel = state.selection;
  if (!sel.empty) return false;
  const $h = sel.$head;
  const before = $h.nodeBefore;
  if (!before || !before.isText) return false;
  const series = seriesOfMarks(before.marks);
  if (!isLegacy(series)) return false;

  const t = before.text!;
  let ws = t.length;
  while (ws > 0 && !/\s/.test(t[ws - 1])) ws--;
  const word = t.slice(ws);
  if (!word) return false;

  const chars = Array.from(runToUnicode(word));
  chars.pop();
  const next = chars.length ? unicodeToLegacy(chars.join(''), series) : '';
  const from = sel.from - word.length;
  const tr = state.tr;
  if (next) tr.replaceWith(from, sel.from, state.schema.text(next, before.marks));
  else tr.delete(from, sel.from);
  tr.setMeta('legacySync', true);
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

/** Last `n` characters of the word before the caret, as Unicode (legacy-coded words are converted back). */
export function unicodeBeforeCursor(editor: Editor, n = 1): string {
  const before = editor.state.selection.$head.nodeBefore;
  if (!before || !before.isText) return '';
  const t = before.text!;
  let ws = t.length;
  while (ws > 0 && !/\s/.test(t[ws - 1])) ws--;
  const word = t.slice(ws);
  return (isLegacy(seriesOfMarks(before.marks)) ? runToUnicode(word) : word).slice(-n);
}

/* ------------------------------------------------------------------ reading text back as Unicode */

/** Unicode text of the selection, or of the word under the caret (legacy text is converted back). */
export function selectedOrWord(editor: Editor): string {
  const { state } = editor;
  const { from, to, empty, $head } = state.selection;

  if (!empty) {
    let out = '';
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.isTextblock && out) out += '\n';
      if (!node.isText) return true;
      const s = Math.max(pos, from);
      const e = Math.min(pos + node.nodeSize, to);
      const part = node.text!.slice(s - pos, e - pos);
      out += isLegacy(seriesOfMarks(node.marks)) ? runToUnicode(part) : part;
      return false;
    });
    return out.trim();
  }

  const block = $head.parent;
  if (!block.isTextblock) return '';
  let uni = '';
  let caret = 0;
  let seen = 0;
  block.forEach((child) => {
    if (!child.isText) return;
    const series = seriesOfMarks(child.marks);
    const conv = (s: string) => (isLegacy(series) ? runToUnicode(s) : s);
    const cs = seen;
    const ce = seen + child.nodeSize;
    if ($head.parentOffset >= ce) caret += conv(child.text!).length;
    else if ($head.parentOffset > cs) caret += conv(child.text!.slice(0, $head.parentOffset - cs)).length;
    uni += conv(child.text!);
    seen = ce;
  });
  const re = /[^\s.,;:!?()"“”'‘’\-–—]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(uni))) if (caret >= m.index && caret <= m.index + m[0].length) return m[0];
  return '';
}
