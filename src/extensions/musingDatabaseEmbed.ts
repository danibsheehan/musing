import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import DatabaseEmbedNodeView from "../components/DatabaseEmbedNodeView";

function decodePayload(raw: string | null): string {
  if (raw == null) return "{}";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export const MusingDatabaseEmbed = Node.create({
  name: "musingDatabaseEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      blockId: {
        default: null as string | null,
      },
      payload: {
        default: "{}",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="musing-database-embed"]',
        getAttrs: (el: HTMLElement) => ({
          blockId: el.getAttribute("data-block-id"),
          payload: decodePayload(el.getAttribute("data-payload")),
        }),
      },
    ];
  },

  renderHTML({ node }) {
    const payload = String(node.attrs.payload ?? "");
    return [
      "div",
      mergeAttributes({
        "data-type": "musing-database-embed",
        "data-block-id": node.attrs.blockId as string | undefined,
        "data-payload": encodeURIComponent(payload),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DatabaseEmbedNodeView);
  },
});
