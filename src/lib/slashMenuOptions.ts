import type { BlockType } from "../types/block";

export type SlashMenuItem = {
  type: BlockType;
  label: string;
};

/** Batch 1 — body text, headings, quote, code */
const batch1: SlashMenuItem[] = [
  { type: "paragraph", label: "Paragraph" },
  { type: "heading", label: "Heading 1" },
  { type: "heading2", label: "Heading 2" },
  { type: "blockquote", label: "Quote" },
  { type: "codeBlock", label: "Code block" },
];

/** Batch 2 — lists & divider */
const batch2: SlashMenuItem[] = [
  { type: "bulletList", label: "Bullet list" },
  { type: "orderedList", label: "Numbered list" },
  { type: "horizontalRule", label: "Divider" },
];

export const SLASH_MENU_ITEMS: SlashMenuItem[] = [...batch1, ...batch2];
