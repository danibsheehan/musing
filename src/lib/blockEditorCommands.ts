import type { Editor } from "@tiptap/core";
import type { BlockType } from "../types/block";

/** Applies the block shape for `type` to the current selection (slash menu + type changes). */
export function applyBlockTypeToEditor(editor: Editor, type: BlockType): void {
  const chain = editor.chain().focus();
  switch (type) {
    case "paragraph":
      chain.setParagraph();
      break;
    case "heading":
      chain.setHeading({ level: 1 });
      break;
    case "heading2":
      chain.setHeading({ level: 2 });
      break;
    case "blockquote":
      chain.setParagraph().toggleBlockquote();
      break;
    case "codeBlock":
      chain.toggleCodeBlock();
      break;
    case "bulletList":
      chain.toggleBulletList();
      break;
    case "orderedList":
      chain.toggleOrderedList();
      break;
    case "horizontalRule":
      chain.setHorizontalRule();
      break;
  }
  chain.run();
}
