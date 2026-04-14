import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * Finds doc positions for the slash-menu filter suffix (`/…` at end of the block’s text)
 * in the top-level node with this `blockId`. Does not use the selection (menus can blur the editor).
 */
export function findSlashMenuFilterDeleteRange(
  doc: PMNode,
  blockId: string
): { from: number; to: number } | null {
  let blockPos = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i);
    if ((node.attrs?.blockId as string | undefined) !== blockId) {
      blockPos += node.nodeSize;
      continue;
    }

    const innerFrom = blockPos + 1;
    const innerTo = blockPos + node.nodeSize - 1;
    if (innerTo <= innerFrom) return null;

    const text = doc.textBetween(innerFrom, innerTo, "\n", " ");
    const m = text.match(/\/[^ \n]*$/);
    if (!m) return null;

    const suffix = m[0];
    for (let len = suffix.length; len <= innerTo - innerFrom; len++) {
      const from = innerTo - len;
      if (from < innerFrom) break;
      if (doc.textBetween(from, innerTo) === suffix) {
        return { from, to: innerTo };
      }
    }
    return null;
  }
  return null;
}
