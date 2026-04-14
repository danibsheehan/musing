import type { ResolvedPos } from "prosemirror-model";
import type { EditorView } from "@tiptap/pm/view";

/** Plain text from the start of the current textblock through the cursor (for slash / @ menus). */
export function textBeforeCursorInBlock($from: ResolvedPos): string {
  const parent = $from.parent;
  if (!parent.isTextblock) return "";
  return parent.textBetween(0, $from.parentOffset);
}

/**
 * Screen coords for floating menus (slash, @). `coordsAtPos(anchor)` can land at (0,0) or outside
 * the editor after `anchor` is 0 or the doc just changed (e.g. deleting a horizontal rule).
 * Falls back to the caret head, then clamped positions, then the editor box.
 */
export function viewCoordsForFloatingMenu(
  view: EditorView,
  anchorPos: number,
  headPos: number
): { top: number; left: number; bottom: number } {
  const rect = view.dom.getBoundingClientRect();
  const docSize = view.state.doc.content.size;
  const margin = 12;

  const inside = (c: {
    top: number;
    left: number;
    bottom: number;
  }): boolean =>
    c.left >= rect.left - margin &&
    c.left <= rect.right + margin &&
    c.bottom >= rect.top - margin &&
    c.top <= rect.bottom + margin;

  const at = (p: number) => {
    const pos = Math.max(0, Math.min(p, docSize));
    return view.coordsAtPos(pos);
  };

  let c = at(anchorPos);
  if (!inside(c)) {
    c = at(headPos);
  }
  if (!inside(c)) {
    c = at(Math.max(1, Math.min(anchorPos, docSize)));
  }
  if (!inside(c)) {
    c = at(Math.max(1, Math.min(headPos, docSize)));
  }
  if (!inside(c)) {
    const y = rect.top + Math.min(24, rect.height * 0.15);
    return { top: y, left: rect.left + 8, bottom: y };
  }
  return c;
}
