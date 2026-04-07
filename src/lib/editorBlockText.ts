import type { ResolvedPos } from "@tiptap/pm/model";

/** Plain text from the start of the current textblock through the cursor (for slash / @ menus). */
export function textBeforeCursorInBlock($from: ResolvedPos): string {
  const parent = $from.parent;
  if (!parent.isTextblock) return "";
  return parent.textBetween(0, $from.parentOffset);
}
