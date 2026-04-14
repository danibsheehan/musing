export type BlockType =
  | "paragraph"
  | "heading"
  | "heading2"
  | "blockquote"
  | "codeBlock"
  | "bulletList"
  | "orderedList"
  | "horizontalRule"
  | "databaseEmbed";

export type Block = {
  id: string;
  type: BlockType;
  content: string;
};

/** Options for `onEnter` when inserting the next app-level block (e.g. ⌘+Enter below a code block). */
export type AddBlockAfterEnterOptions = {
  /** Hide "Press '/' for commands" on the new paragraph until it has content. */
  suppressSlashPlaceholder?: boolean;
};
