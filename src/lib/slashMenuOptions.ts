import type { BlockType } from "../types/block";

/** Slash palette entries: block types plus non-block actions (e.g. emoji picker). */
export type SlashMenuChoice = BlockType | "emoji";

export type SlashMenuItem = {
  type: SlashMenuChoice;
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

const batch3: SlashMenuItem[] = [
  { type: "databaseEmbed", label: "Linked database" },
  { type: "emoji", label: "Emoji" },
];

export const SLASH_MENU_ITEMS: SlashMenuItem[] = [...batch1, ...batch2, ...batch3];

/** Filters by label (case-insensitive substring). Empty `query` returns all items. */
export function filterSlashMenuItems(
  items: readonly SlashMenuItem[],
  query: string
): SlashMenuItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  return items.filter((item) => item.label.toLowerCase().includes(q));
}
