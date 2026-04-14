import { Extension } from "@tiptap/core";

/**
 * Stable `data-block-id` on each top-level block node so we can round-trip `Block[]`
 * from one ProseMirror document.
 */
export const blockIdOnBlocks = Extension.create({
  name: "blockIdOnBlocks",

  addGlobalAttributes() {
    return [
      {
        types: [
          "paragraph",
          "heading",
          "blockquote",
          "codeBlock",
          "bulletList",
          "orderedList",
          "horizontalRule",
        ],
        attributes: {
          blockId: {
            default: null as string | null,
            parseHTML: (el) =>
              (el as HTMLElement).getAttribute?.("data-block-id") ?? null,
            renderHTML: (attrs) => {
              const id = attrs.blockId as string | null | undefined;
              if (!id) return {};
              return { "data-block-id": id };
            },
          },
        },
      },
    ];
  },
});
