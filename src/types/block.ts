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
