import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Mark, type Node as PMNode } from '@tiptap/pm/model';
import { seriesOfMarks } from './marks';
import { isLegacy, reconvertWord, unicodeWindows, type LegacySeries } from '../lib/legacy';

interface Run {
  from: number;
  to: number;
  text: string;
  series: LegacySeries;
  marks: readonly Mark[];
}

/** Maximal runs of consecutive text nodes that share identical marks and sit in a legacy font. */
function legacyRuns(block: PMNode, blockPos: number): Run[] {
  const runs: Run[] = [];
  let cur: Run | null = null;
  block.forEach((child, offset) => {
    const abs = blockPos + 1 + offset;
    const series = child.isText ? seriesOfMarks(child.marks) : 'unicode';
    if (child.isText && isLegacy(series)) {
      if (cur && cur.series === series && cur.to === abs && Mark.sameSet(cur.marks, child.marks)) {
        cur.to = abs + child.nodeSize;
        cur.text += child.text!;
      } else {
        cur = { from: abs, to: abs + child.nodeSize, text: child.text!, series, marks: child.marks };
        runs.push(cur);
      }
    } else {
      cur = null;
    }
  });
  return runs;
}

interface Edit {
  from: number;
  to: number;
  old: string;
  text: string;
  series: LegacySeries;
  marks: readonly Mark[];
}

export const legacySyncKey = new PluginKey('legacySync');

/**
 * Keeps text that sits in a legacy font encoded as legacy character codes.
 *
 * Whenever Unicode Malayalam appears inside a legacy-font run (typed by any keyboard layout,
 * Manglish, pasted or inserted from the dictionary) the affected word is re-encoded:
 *   mixed legacy+Unicode word  ->  Unicode  ->  normalised  ->  legacy codes
 * and the cursor is moved to the matching place inside the re-encoded word.
 */
export const LegacySync = Extension.create({
  name: 'legacySync',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: legacySyncKey,
        appendTransaction(trs, oldState, newState) {
          if (!trs.some((t) => t.docChanged)) return null;
          if (trs.some((t) => t.getMeta('legacySync') || t.getMeta('legacyConvert'))) return null;

          const start = oldState.doc.content.findDiffStart(newState.doc.content);
          if (start == null) return null;
          const end = oldState.doc.content.findDiffEnd(newState.doc.content);
          const docEnd = newState.doc.content.size;
          const to = end ? Math.max(end.b, start) : docEnd;

          const edits: Edit[] = [];
          newState.doc.nodesBetween(Math.max(0, start - 1), Math.min(docEnd, to + 1), (node, pos) => {
            if (!node.isTextblock) return true;
            for (const run of legacyRuns(node, pos)) {
              for (const [ws, we] of unicodeWindows(run.text)) {
                const old = run.text.slice(ws, we);
                const text = reconvertWord(old, run.series);
                if (text !== old) edits.push({ from: run.from + ws, to: run.from + we, old, text, series: run.series, marks: run.marks });
              }
            }
            return false;
          });
          if (!edits.length) return null;

          const sel = newState.selection;
          let cursorFrom: number | null = null;
          let cursorOffset = 0;
          if (sel.empty) {
            const hit = edits.find((e) => sel.head >= e.from && sel.head <= e.to);
            if (hit) {
              cursorFrom = hit.from;
              cursorOffset = reconvertWord(hit.old.slice(0, sel.head - hit.from), hit.series).length;
            }
          }

          const tr = newState.tr;
          for (const e of [...edits].sort((a, b) => b.from - a.from)) {
            if (e.text) tr.replaceWith(e.from, e.to, newState.schema.text(e.text, e.marks));
            else tr.delete(e.from, e.to);
          }
          if (cursorFrom != null) {
            const p = Math.min(tr.mapping.map(cursorFrom, -1) + cursorOffset, tr.doc.content.size);
            tr.setSelection(TextSelection.create(tr.doc, p));
          }
          tr.setMeta('legacySync', true);
          return tr;
        },
      }),
    ];
  },
});
