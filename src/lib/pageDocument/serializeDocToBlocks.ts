import type { Editor } from "@tiptap/core";
import { DOMSerializer } from "@tiptap/pm/model";
import { v4 as uuidv4 } from "uuid";
import type { Block, BlockType } from "../../types/block";

function pmNodeToBlockType(node: {
  type: { name: string };
  attrs: Record<string, unknown>;
}): BlockType {
  switch (node.type.name) {
    case "paragraph":
      return "paragraph";
    case "heading":
      return node.attrs.level === 2 ? "heading2" : "heading";
    case "blockquote":
      return "blockquote";
    case "codeBlock":
      return "codeBlock";
    case "bulletList":
      return "bulletList";
    case "orderedList":
      return "orderedList";
    case "horizontalRule":
      return "horizontalRule";
    case "musingDatabaseEmbed":
      return "databaseEmbed";
    default:
      return "paragraph";
  }
}

/**
 * Serializes the editor’s top-level document children to app `Block[]` (storage shape unchanged).
 */
export function serializeDocToBlocks(editor: Editor): Block[] {
  if (typeof document === "undefined") {
    return [];
  }
  const { doc, schema } = editor.state;
  const serializer = DOMSerializer.fromSchema(schema);
  const blocks: Block[] = [];

  doc.content.forEach((node) => {
    if (node.type.name === "musingDatabaseEmbed") {
      const payload = (node.attrs.payload as string | undefined) ?? "{}";
      blocks.push({
        id: (node.attrs.blockId as string | null) ?? uuidv4(),
        type: "databaseEmbed",
        content: payload,
      });
      return;
    }

    const wrap = document.createElement("div");
    wrap.appendChild(serializer.serializeNode(node));
    const html = wrap.innerHTML;
    const blockId = (node.attrs.blockId as string | null) ?? uuidv4();
    blocks.push({
      id: blockId,
      type: pmNodeToBlockType(node),
      content: html,
    });
  });

  return blocks;
}
