export type BlockType = "paragraph" | "heading";

export type Block = {
  id: string;
  type: BlockType;
  content: string;
};
