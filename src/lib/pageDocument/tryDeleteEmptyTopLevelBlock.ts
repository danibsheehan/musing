import type { Editor } from "@tiptap/core";
import { isBlockHtmlVisuallyEmpty } from "../blockEditorCommands";
import { serializeNodeToHtml } from "./serializeDocToBlocks";

/**
 * When the doc has multiple top-level blocks and the current one is an empty paragraph,
 * delete that block (ProseMirror often keeps a `<br>` so “empty” rows feel stuck).
 */
export function tryDeleteEmptyTopLevelBlock(editor: Editor): boolean {
  if (editor.view.composing) return false;
  const { doc, selection } = editor.state;
  if (doc.childCount <= 1 || !selection.empty) return false;

  const { $from } = selection;
  if ($from.depth < 1) return false;
  const node = $from.node(1);
  if (node.type.name !== "paragraph") return false;
  if (!isBlockHtmlVisuallyEmpty(serializeNodeToHtml(editor, node))) return false;

  const from = $from.before(1);
  return editor
    .chain()
    .focus()
    .deleteRange({ from, to: from + node.nodeSize })
    .run();
}
