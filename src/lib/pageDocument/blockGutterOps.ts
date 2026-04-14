import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { v4 as uuidv4 } from "uuid";
import { blocksToDocHtml } from "./blocksToDocHtml";
import { serializeDocToBlocks } from "./serializeDocToBlocks";

/**
 * Insert a new empty paragraph immediately after the top-level block at `blockIndex` (0-based).
 * Prefer this from the gutter so the row index matches the doc child even if `blockId` is duplicated.
 */
export function insertParagraphBelowBlockAtIndex(editor: Editor, blockIndex: number): boolean {
  if (editor.isDestroyed) return false;
  const paragraph = editor.schema.nodes.paragraph;
  if (!paragraph) return false;

  return editor
    .chain()
    .focus()
    .command(({ tr, state, dispatch }) => {
      if (!dispatch) return true;
      const { doc } = state;
      if (blockIndex < 0 || blockIndex >= doc.childCount) return false;

      let pos = 0;
      for (let j = 0; j < blockIndex; j++) {
        pos += doc.child(j).nodeSize;
      }
      const node = doc.child(blockIndex);
      const insertPos = pos + node.nodeSize;
      const para = paragraph.create({ blockId: uuidv4() });

      tr.insert(insertPos, para);
      const inner = Math.min(insertPos + 1, tr.doc.content.size);
      try {
        tr.setSelection(TextSelection.near(tr.doc.resolve(inner), 1));
      } catch {
        /* selection stays at default */
      }
      dispatch(tr);
      return true;
    })
    .run();
}

/**
 * Insert below the last top-level node whose `blockId` equals `afterBlockId`.
 * (Duplicate ids can exist after paste; first-match would insert in the wrong place.)
 */
export function insertParagraphBelowBlock(editor: Editor, afterBlockId: string): boolean {
  const { doc } = editor.state;
  let lastIdx = -1;
  for (let i = 0; i < doc.childCount; i++) {
    if ((doc.child(i).attrs?.blockId as string | undefined) === afterBlockId) {
      lastIdx = i;
    }
  }
  if (lastIdx < 0) return false;
  return insertParagraphBelowBlockAtIndex(editor, lastIdx);
}

/** Reorder top-level blocks by index (same semantics as array splice move). */
export function reorderTopLevelBlocksByIndex(
  editor: Editor,
  fromIndex: number,
  toIndex: number
): boolean {
  if (editor.isDestroyed || fromIndex === toIndex) return true;
  const { doc } = editor.state;
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= doc.childCount ||
    toIndex >= doc.childCount
  ) {
    return false;
  }
  const blocks = serializeDocToBlocks(editor);
  if (blocks.length !== doc.childCount) return false;
  const next = [...blocks];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  return editor.commands.setContent(blocksToDocHtml(next), { emitUpdate: true });
}
