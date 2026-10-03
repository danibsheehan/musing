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
            /** TipTap defaults this to true, which clones the id onto the new block when Enter is pressed at the end of a block; `ensureTopLevelBlockIds` assigns a fresh one instead. Splits in the middle or at the start are cloned by ProseMirror itself and are caught by `ensureTopLevelBlockIds` too. */
            keepOnSplit: false,
            parseHTML: (el) => (el as HTMLElement).getAttribute?.("data-block-id") ?? null,
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
