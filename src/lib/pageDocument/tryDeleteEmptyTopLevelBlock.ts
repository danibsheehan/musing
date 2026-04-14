import type { Editor } from "@tiptap/core";
import { isBlockHtmlVisuallyEmpty } from "../blockEditorCommands";
import { blockIdAtSelection } from "./blockIdAtSelection";
import { serializeDocToBlocks } from "./serializeDocToBlocks";

/**
 * When the doc has multiple top-level blocks and the current one is an empty paragraph,
 * delete that block (ProseMirror often keeps a `<br>` so “empty” rows feel stuck).
 */
export function tryDeleteEmptyTopLevelBlock(editor: Editor): boolean {
  if (editor.view.composing) return false;
  const { state } = editor;
  const { doc, selection } = state;
  if (doc.childCount <= 1 || !selection.empty) return false;

  const blockId = blockIdAtSelection(editor);
  if (!blockId) return false;

  const blocks = serializeDocToBlocks(editor);
  const current = blocks.find((b) => b.id === blockId);
  if (!current || current.type !== "paragraph") return false;
  if (!isBlockHtmlVisuallyEmpty(current.content)) return false;

  let pos = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i);
    if ((node.attrs.blockId as string | undefined) === blockId) {
      const from = pos;
      const to = pos + node.nodeSize;
      return editor.chain().focus().deleteRange({ from, to }).run();
    }
    pos += node.nodeSize;
  }
  return false;
}
