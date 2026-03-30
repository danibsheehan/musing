export type BlockType =
  | "paragraph"
  | "heading"
  | "heading2"
  | "blockquote"
  | "codeBlock"
  | "bulletList"
  | "orderedList"
  | "horizontalRule";

export type Block = {
  id: string;
  type: BlockType;
  content: string;
};
