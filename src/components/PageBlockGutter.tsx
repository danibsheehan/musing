import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { Editor as TiptapEditor } from "@tiptap/core";
import {
  insertParagraphBelowBlockAtIndex,
  reorderTopLevelBlocksByIndex,
} from "../lib/pageDocument/blockGutterOps";

type Row = { blockId: string; top: number; height: number };

type Props = {
  editor: TiptapEditor | null;
  /** Shell that wraps the gutter column + editor (used for block top offsets). */
  measurementRootRef: RefObject<HTMLElement | null>;
};

const DRAG_MIME = "application/x-musing-block-index";

function parseIndexFromDataTransfer(dt: DataTransfer | null): number | null {
  if (!dt) return null;
  const raw = dt.getData(DRAG_MIME) || dt.getData("text/plain");
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

function getTopLevelBlockElements(editor: TiptapEditor): HTMLElement[] {
  const pm = editor.view.dom as HTMLElement;
  const out: HTMLElement[] = [];
  for (const child of Array.from(pm.children)) {
    if (!(child instanceof HTMLElement) || !child.hasAttribute("data-block-id")) continue;
    out.push(child);
  }
  return out;
}

/** Map viewport Y to top-level block index (same order as `data-block-id` children of ProseMirror). */
function topLevelBlockIndexAtClientY(editor: TiptapEditor, clientY: number): number {
  const blocks = getTopLevelBlockElements(editor);
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let index = 0; index < blocks.length; index++) {
    const r = blocks[index].getBoundingClientRect();
    if (clientY >= r.top && clientY <= r.bottom) {
      return index;
    }
    const mid = (r.top + r.bottom) / 2;
    const d = Math.abs(clientY - mid);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = index;
    }
  }
  return bestIdx;
}

/** Y offset (px) from shell top for a horizontal “insert here” line. */
function dropLineTopPx(editor: TiptapEditor, shellEl: HTMLElement, clientY: number): number | null {
  const blocks = getTopLevelBlockElements(editor);
  if (blocks.length === 0) return null;
  const shellRect = shellEl.getBoundingClientRect();
  const lastR = blocks[blocks.length - 1].getBoundingClientRect();
  if (clientY > lastR.bottom) {
    return lastR.bottom - shellRect.top;
  }
  const idx = topLevelBlockIndexAtClientY(editor, clientY);
  const el = blocks[idx];
  if (!el) return null;
  return el.getBoundingClientRect().top - shellRect.top;
}

export default function PageBlockGutter({ editor, measurementRootRef }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const dragSourceIndexRef = useRef<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [dropLineTop, setDropLineTop] = useState<number | null>(null);
  /** Shell element for the drop line portal (set on drag start, cleared on end — avoids reading ref during render). */
  const [dropPortalHost, setDropPortalHost] = useState<HTMLElement | null>(null);
  const dndWindowCleanupRef = useRef<(() => void) | null>(null);

  const measure = useCallback(() => {
    const ed = editor;
    const layout = measurementRootRef.current;
    if (!ed || ed.isDestroyed || !layout) {
      setRows([]);
      return;
    }
    const pm = ed.view.dom as HTMLElement;
    if (!pm.isConnected) {
      setRows([]);
      return;
    }

    const layoutRect = layout.getBoundingClientRect();
    const next: Row[] = [];

    for (const child of Array.from(pm.children)) {
      if (!(child instanceof HTMLElement)) continue;
      if (!child.hasAttribute("data-block-id")) continue;
      const id = child.getAttribute("data-block-id");
      if (!id) continue;
      const cr = child.getBoundingClientRect();
      next.push({
        blockId: id,
        top: cr.top - layoutRect.top,
        height: Math.max(cr.height, 28),
      });
    }
    setRows(next);
  }, [editor, measurementRootRef]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    let raf = 0;
    const scheduleMeasure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => measure());
    };

    scheduleMeasure();
    editor.on("update", scheduleMeasure);
    editor.on("selectionUpdate", scheduleMeasure);
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, true);

    const pm = editor.view.dom as HTMLElement;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleMeasure) : null;
    ro?.observe(pm);
    if (pm.parentElement) ro?.observe(pm.parentElement);

    return () => {
      cancelAnimationFrame(raf);
      editor.off("update", scheduleMeasure);
      editor.off("selectionUpdate", scheduleMeasure);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
      ro?.disconnect();
    };
  }, [editor, measure]);

  const onAddBelow = useCallback(
    (blockIndex: number) => {
      if (!editor || editor.isDestroyed) return;
      insertParagraphBelowBlockAtIndex(editor, blockIndex);
    },
    [editor]
  );

  const onDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      const ed = editor;
      if (!ed || ed.isDestroyed) return;

      dndWindowCleanupRef.current?.();
      dndWindowCleanupRef.current = null;

      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData(DRAG_MIME, String(index));
      try {
        e.dataTransfer.setData("text/plain", String(index));
      } catch {
        /* ignore */
      }
      dragSourceIndexRef.current = index;
      const shell0 = measurementRootRef.current;
      setDropPortalHost(shell0);
      if (shell0) {
        setDropTargetIndex(topLevelBlockIndexAtClientY(ed, e.clientY));
        setDropLineTop(dropLineTopPx(ed, shell0, e.clientY));
      }

      /* Rows use pointer-events: none except buttons — drag path is usually over the editor, so row-level drop never fires. */
      const onWindowDragOver = (ev: DragEvent) => {
        if (dragSourceIndexRef.current === null) return;
        ev.preventDefault();
        if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
        if (ed.isDestroyed) return;
        const shell = measurementRootRef.current;
        setDropTargetIndex(topLevelBlockIndexAtClientY(ed, ev.clientY));
        if (shell) {
          setDropLineTop(dropLineTopPx(ed, shell, ev.clientY));
        }
      };

      const onWindowDrop = (ev: DragEvent) => {
        if (dragSourceIndexRef.current === null) return;
        ev.preventDefault();
        ev.stopPropagation();
        const from = parseIndexFromDataTransfer(ev.dataTransfer);
        const to = ed.isDestroyed ? 0 : topLevelBlockIndexAtClientY(ed, ev.clientY);
        dndWindowCleanupRef.current?.();
        dndWindowCleanupRef.current = null;
        dragSourceIndexRef.current = null;
        setDropTargetIndex(null);
        setDropLineTop(null);
        setDropPortalHost(null);
        if (from === null || ed.isDestroyed) return;
        reorderTopLevelBlocksByIndex(ed, from, to);
      };

      dndWindowCleanupRef.current = () => {
        window.removeEventListener("dragover", onWindowDragOver, true);
        window.removeEventListener("drop", onWindowDrop, true);
      };
      window.addEventListener("dragover", onWindowDragOver, true);
      window.addEventListener("drop", onWindowDrop, true);
    },
    [editor, measurementRootRef]
  );

  const onDragEnd = useCallback(() => {
    dndWindowCleanupRef.current?.();
    dndWindowCleanupRef.current = null;
    dragSourceIndexRef.current = null;
    setDropTargetIndex(null);
    setDropLineTop(null);
    setDropPortalHost(null);
  }, []);

  if (!editor || rows.length === 0) return null;

  const dropLinePortal =
    dropPortalHost && dropLineTop !== null
      ? createPortal(
          <div
            className="page-block-gutter__drop-line"
            style={{ top: dropLineTop }}
            aria-hidden
          />,
          dropPortalHost
        )
      : null;

  return (
    <>
      {dropLinePortal}
      <div className="page-block-gutter" aria-label="Block actions">
      {rows.map((row, index) => (
        <div
          key={`${index}-${row.blockId}`}
          className={
            "page-block-gutter__row" +
            (dropTargetIndex === index ? " page-block-gutter__row--drop-target" : "")
          }
          style={{ top: row.top, height: row.height }}
        >
          <button
            type="button"
            className="page-block-gutter__btn page-block-gutter__btn--add"
            aria-label="Add block below"
            title="Add block below"
            onPointerDown={(ev) => ev.preventDefault()}
            onClick={() => onAddBelow(index)}
          >
            +
          </button>
          <button
            type="button"
            className="page-block-gutter__btn page-block-gutter__btn--drag"
            aria-label="Drag to reorder"
            title="Drag to reorder"
            draggable
            onDragStart={(e) => onDragStart(e, index)}
            onDragEnd={onDragEnd}
          >
            ::
          </button>
        </div>
      ))}
    </div>
    </>
  );
}
