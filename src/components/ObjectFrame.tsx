import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { Move, RotateCw } from 'lucide-react';
import { TableMap } from '@tiptap/pm/tables';
import { currentObject, moveObject, setAttrsAt, setTableColumnWidths, tableColumnWidths, zoomOf, type Obj } from '../editor/objects';

interface Props {
  editor: Editor;
  pageRef: React.RefObject<HTMLDivElement | null>;
}

interface Box { l: number; t: number; w: number; h: number }
type H = [id: string, cursor: string, x: 0 | 0.5 | 1, y: 0 | 0.5 | 1];

const ALL: H[] = [['nw', 'nwse-resize', 0, 0], ['n', 'ns-resize', 0.5, 0], ['ne', 'nesw-resize', 1, 0], ['e', 'ew-resize', 1, 0.5], ['se', 'nwse-resize', 1, 1], ['s', 'ns-resize', 0.5, 1], ['sw', 'nesw-resize', 0, 1], ['w', 'ew-resize', 0, 0.5]];
const HANDLES: Record<string, H[]> = {
  image: ALL,
  textBox: ALL,
  hr: ALL.filter((h) => h[0] === 'e' || h[0] === 'w'),
  table: ALL.filter((h) => ['e', 's', 'se', 'w'].includes(h[0])),
};

/** Word-style selection frame: resize handles, a move grip and (pictures) a rotate handle around the active object. */
export const ObjectFrame: React.FC<Props> = ({ editor, pageRef }) => {
  const [obj, setObj] = useState<Obj | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [drop, setDrop] = useState<Box | null>(null);
  const dragging = useRef(false);
  const raf = useRef(0);

  const update = useCallback(() => {
    const page = pageRef.current;
    const o = currentObject(editor);
    if (!o || !page) {
      setObj(null);
      setBox(null);
      return;
    }
    const z = zoomOf(page);
    const r = o.el.getBoundingClientRect();
    const p = page.getBoundingClientRect();
    setObj(o);
    setBox({ l: (r.left - p.left) / z, t: (r.top - p.top) / z, w: r.width / z, h: r.height / z });
  }, [editor, pageRef]);

  useEffect(() => {
    const sched = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(update);
    };
    editor.on('transaction', sched);
    editor.on('selectionUpdate', sched);
    window.addEventListener('resize', sched);
    const ro = new ResizeObserver(sched);
    if (pageRef.current) ro.observe(pageRef.current);
    document.fonts?.addEventListener?.('loadingdone', sched);
    sched();
    return () => {
      editor.off('transaction', sched);
      editor.off('selectionUpdate', sched);
      window.removeEventListener('resize', sched);
      ro.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', sched);
    };
  }, [editor, update, pageRef]);

  if (!obj || !box) return null;
  const z = zoomOf(pageRef.current!);
  const attrs = obj.node.attrs as Record<string, number | string | null>;
  const free = (obj.kind === 'image' && (attrs.wrap === 'front' || attrs.wrap === 'behind')) || (obj.kind === 'textBox' && attrs.wrap === 'free');

  const track = (ev: React.PointerEvent, onMove: (dx: number, dy: number, e: PointerEvent) => void, onUp?: (e: PointerEvent) => void) => {
    ev.preventDefault();
    ev.stopPropagation();
    const x0 = ev.clientX;
    const y0 = ev.clientY;
    dragging.current = true;
    const move = (e: PointerEvent) => onMove((e.clientX - x0) / z, (e.clientY - y0) / z, e);
    const up = (e: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      dragging.current = false;
      onUp?.(e);
      update();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const startResize = (h: H) => (ev: React.PointerEvent) => {
    const [, , hx, hy] = h;
    const dirX = hx === 1 ? 1 : hx === 0 ? -1 : 0;
    const dirY = hy === 1 ? 1 : hy === 0 ? -1 : 0;
    const { pos, kind } = obj;
    const w0 = box.w;
    const h0 = box.h;
    const a0 = { ...attrs };
    let widths: number[] = [];
    let rows = 1;
    if (kind === 'table') {
      const map = TableMap.get(obj.node);
      rows = map.height;
      widths = tableColumnWidths(obj.el, map.width);
    }
    track(ev, (dx, dy) => {
      const live = editor.state.doc.nodeAt(pos);
      if (!live) return;
      if (kind === 'image') {
        let w = w0;
        if (dirX !== 0) w = w0 + dirX * dx;
        else w = w0 + dirY * dy * (w0 / h0);
        w = Math.max(16, Math.round(w));
        const upd: Record<string, unknown> = { width: w };
        if (free) {
          if (dirX < 0) upd.x = Math.round(Number(a0.x) + (w0 - w));
          if (dirY < 0) upd.y = Math.round(Number(a0.y) + (h0 - (w * h0) / w0));
        }
        setAttrsAt(editor, pos, upd);
      } else if (kind === 'textBox') {
        const upd: Record<string, unknown> = {};
        if (dirX) {
          upd.width = Math.max(60, Math.round(w0 + dirX * dx));
          if (free && dirX < 0) upd.x = Math.round(Number(a0.x) + (w0 - Number(upd.width)));
        }
        if (dirY) {
          upd.height = Math.max(30, Math.round(h0 + dirY * dy));
          if (free && dirY < 0) upd.y = Math.round(Number(a0.y) + (h0 - Number(upd.height)));
        }
        setAttrsAt(editor, pos, upd);
      } else if (kind === 'hr') {
        setAttrsAt(editor, pos, { width: Math.max(20, Math.round(w0 + dirX * dx)) });
      } else {
        if (dirX) {
          const total = Math.max(60, w0 + dirX * dx);
          const f = total / w0;
          setTableColumnWidths(editor, pos, widths.map((w) => Math.max(24, w * f)));
        }
        if (dirY) setAttrsAt(editor, pos, { rowHeight: Math.max(18, Math.round((h0 + dirY * dy) / rows)) });
      }
    });
  };

  const startRotate = (ev: React.PointerEvent) => {
    const page = pageRef.current!.getBoundingClientRect();
    const cx = page.left + (box.l + box.w / 2) * z;
    const cy = page.top + (box.t + box.h / 2) * z;
    track(ev, (_dx, _dy, e) => {
      let a = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90;
      a = ((Math.round(e.shiftKey ? a : a / 5) * (e.shiftKey ? 1 : 5)) % 360 + 360) % 360;
      setAttrsAt(editor, obj.pos, { rotate: a > 180 ? a - 360 : a });
    });
  };

  const startMove = (ev: React.PointerEvent) => {
    if (free) {
      const x0 = Number(attrs.x) || 0;
      const y0 = Number(attrs.y) || 0;
      track(ev, (dx, dy) => setAttrsAt(editor, obj.pos, { x: Math.round(x0 + dx), y: Math.round(y0 + dy) }));
      return;
    }
    const o = obj;
    // Pictures and text boxes: a plain drag lifts them out of the text so they can be placed anywhere on the page.
    // Hold Alt to move them to another position inside the text instead.
    if ((obj.kind === 'image' || obj.kind === 'textBox') && !ev.altKey) {
      const dom = editor.view.nodeDOM(obj.pos) as HTMLElement | null;
      const prose = editor.view.dom.getBoundingClientRect();
      const r = dom?.getBoundingClientRect();
      if (dom && r) {
        const x0 = Math.round((r.left - prose.left) / z);
        const y0 = Math.round((r.top - prose.top) / z);
        const wrap = obj.kind === 'image' ? 'front' : 'free';
        let lifted = false;
        track(ev, (dx, dy) => {
          if (!lifted && Math.abs(dx) + Math.abs(dy) < 4) return;
          lifted = true;
          setAttrsAt(editor, obj.pos, { wrap, x: Math.round(x0 + dx), y: Math.max(0, Math.round(y0 + dy)) });
        });
        return;
      }
    }
    track(
      ev,
      (_dx, _dy, e) => {
        const at = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
        if (!at) return setDrop(null);
        const page = pageRef.current!.getBoundingClientRect();
        try {
          const c = editor.view.coordsAtPos(at.pos);
          setDrop({ l: (c.left - page.left) / z, t: (c.top - page.top) / z, w: o.kind === 'image' ? 2 : box.w, h: o.kind === 'image' ? c.bottom - c.top : 3 });
        } catch {
          setDrop(null);
        }
      },
      (e) => {
        setDrop(null);
        moveObject(editor, o, e.clientX, e.clientY);
      },
    );
  };

  const S = 9;
  return (
    <div className="msx-frames no-print" aria-hidden>
      <div className={`msx-frame is-${obj.kind}`} style={{ left: box.l, top: box.t, width: box.w, height: box.h, ['--z' as string]: 1 / z }}>
        <button type="button" className="msx-frame-grip" title={free ? 'Drag to move' : obj.kind === 'table' || obj.kind === 'hr' ? 'Drag to move to another place in the text' : 'Drag to move anywhere (hold Alt to move within the text)'} onPointerDown={startMove}>
          <Move size={12} />
        </button>
        {HANDLES[obj.kind].map((h) => (
          <i key={h[0]} className="msx-frame-h" style={{ left: `calc(${h[2] * 100}% - ${S / 2}px)`, top: `calc(${h[3] * 100}% - ${S / 2}px)`, cursor: h[1] }} onPointerDown={startResize(h)} />
        ))}
        {obj.kind === 'image' && (
          <>
            <span className="msx-frame-stem" />
            <button type="button" className="msx-frame-rot" title="Drag to rotate (Shift = exact degrees)" onPointerDown={startRotate}>
              <RotateCw size={11} />
            </button>
          </>
        )}
      </div>
      {drop && <div className="msx-frame-drop" style={{ left: drop.l, top: drop.t, width: drop.w, height: drop.h }} />}
    </div>
  );
};
