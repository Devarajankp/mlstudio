import type { Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';
import { TableMap } from '@tiptap/pm/tables';

export type ObjKind = 'image' | 'textBox' | 'hr' | 'table';
export interface Obj {
  kind: ObjKind;
  pos: number;
  node: PMNode;
  el: HTMLElement;
}

const KINDS: Record<string, ObjKind> = { image: 'image', textBox: 'textBox', horizontalRule: 'hr', table: 'table' };

/** The picture / text box / line / table the user is working on (selected, or the caret is inside), if any. */
export function currentObject(editor: Editor): Obj | null {
  const { selection, doc } = editor.state;
  const view = editor.view;
  const find = (pos: number, node: PMNode): Obj | null => {
    const kind = KINDS[node.type.name];
    if (!kind) return null;
    let el = view.nodeDOM(pos) as HTMLElement | null;
    if (!el || !(el instanceof HTMLElement)) return null;
    if (kind === 'table') el = (el.matches('table') ? el : el.querySelector('table')) ?? el;
    return { kind, pos, node, el };
  };
  if (selection instanceof NodeSelection) {
    const o = find(selection.from, selection.node);
    if (o) return o;
  }
  const $from = doc.resolve(selection.from);
  for (let d = $from.depth; d > 0; d--) {
    const n = $from.node(d);
    if (KINDS[n.type.name] === 'table' || KINDS[n.type.name] === 'textBox') {
      const o = find($from.before(d), n);
      if (o) return o;
    }
  }
  return null;
}

/** Change the attributes of the node at `pos` (keeps a picture / line selected). */
export function setAttrsAt(editor: Editor, pos: number, attrs: Record<string, unknown>): void {
  const { state, view } = editor;
  const node = state.doc.nodeAt(pos);
  if (!node) return;
  const wasNode = state.selection instanceof NodeSelection && state.selection.from === pos;
  const tr = state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs });
  if (wasNode) tr.setSelection(NodeSelection.create(tr.doc, pos));
  view.dispatch(tr);
}

/** Apply column widths (px) to every cell of the table at `pos`. */
export function setTableColumnWidths(editor: Editor, pos: number, widths: number[]): void {
  const { state, view } = editor;
  const table = state.doc.nodeAt(pos);
  if (!table) return;
  const map = TableMap.get(table);
  const tr = state.tr;
  for (let r = 0; r < map.height; r++) {
    for (let c = 0; c < map.width; c++) {
      const i = r * map.width + c;
      const off = map.map[i];
      if ((c > 0 && map.map[i - 1] === off) || (r > 0 && map.map[i - map.width] === off)) continue;
      const cell = table.nodeAt(off);
      if (!cell) continue;
      const span = (cell.attrs.colspan as number) || 1;
      tr.setNodeMarkup(pos + 1 + off, undefined, { ...cell.attrs, colwidth: widths.slice(c, c + span).map((w) => Math.round(w)) });
    }
  }
  view.dispatch(tr);
}

export const zoomOf = (el: Element): number => Number((el.closest('.msx-sheet') as HTMLElement | null)?.style.zoom) || 1;

/** Current column widths of a rendered table, in unzoomed px. */
export function tableColumnWidths(el: HTMLElement, cols: number): number[] {
  const z = zoomOf(el);
  const row = (el as HTMLTableElement).rows?.[0];
  const out: number[] = [];
  if (row) {
    for (const cell of Array.from(row.cells)) {
      const span = (cell as HTMLTableCellElement).colSpan || 1;
      const w = cell.getBoundingClientRect().width / z;
      for (let i = 0; i < span; i++) out.push(w / span);
    }
  }
  while (out.length < cols) out.push(100);
  return out.slice(0, cols);
}

/** Move a picture / text box / line / table so it lands where the pointer was released. */
export function moveObject(editor: Editor, obj: Obj, clientX: number, clientY: number): boolean {
  const { state, view } = editor;
  const at = view.posAtCoords({ left: clientX, top: clientY });
  if (!at) return false;
  const size = obj.node.nodeSize;
  const from = obj.pos;
  let target = at.pos;
  const $t = state.doc.resolve(target);
  if (obj.kind === 'image') {
    if (!$t.parent.isTextblock) return false;
  } else {
    if ($t.depth >= 1) {
      const top = $t.before(1);
      const dom = view.nodeDOM(top) as HTMLElement | null;
      const r = dom?.getBoundingClientRect();
      target = r && clientY < r.top + r.height / 2 ? top : $t.after(1);
    }
  }
  if (target >= from && target <= from + size) return false;
  const tr = state.tr.delete(from, from + size);
  const mapped = tr.mapping.map(target, -1);
  tr.insert(mapped, obj.node);
  tr.setSelection(obj.kind === 'table' ? tr.selection : NodeSelection.create(tr.doc, mapped));
  view.dispatch(tr.scrollIntoView());
  return true;
}
