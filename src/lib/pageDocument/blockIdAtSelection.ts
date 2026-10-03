import type { Editor } from "@tiptap/core";

/** App-level `blockId` on the top-level doc child that contains the selection. */
export function blockIdAtSelection(editor: Editor): string | null {
  const { $from } = editor.state.selection;
  if ($from.depth < 1) return null;
  const top = $from.node(1);
  const id = top.attrs?.blockId as string | null | undefined;
  return id ?? null;
}
