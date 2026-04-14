import type { Editor } from "@tiptap/core";

/** App-level `blockId` on the top-level doc child that contains the selection. */
export function blockIdAtSelection(editor: Editor): string | null {
  const { $from } = editor.state.selection;
  if ($from.depth < 1) return null;
  const top = $from.node(1);
  const id = top.attrs?.blockId as string | null | undefined;
  return id ?? null;
}

/** Position at which `doc.nodeAt(pos)` is that top-level block (0 for the first child; not `1`, which falls inside an empty paragraph). */
export function findBlockPositionById(editor: Editor, blockId: string): number | null {
  const { doc } = editor.state;
  let pos = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i);
    if ((node.attrs.blockId as string | undefined) === blockId) return pos;
    pos += node.nodeSize;
  }
  return null;
}
