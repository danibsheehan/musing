import type { Block } from "../types/block";

const ZERO_WIDTH_CHARS = /[\u200b-\u200d\ufeff]/g;

/** Strips HTML markup from a block's content, matching isBlockHtmlVisuallyEmpty's approach. */
export function blockHtmlToPlainText(html: string): string {
  if (typeof document === "undefined") {
    return html
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  const host = document.createElement("div");
  host.innerHTML = html.trim() || "<p></p>";
  return (host.textContent ?? "").replace(ZERO_WIDTH_CHARS, "").trim();
}

/** Plain-text blocks for sending to the AI service -- never send raw HTML markup off-device. */
export function blocksToPlainText(
  blocks: Block[],
): { id: string; type: string; content: string }[] {
  return blocks.map((block) => ({
    id: block.id,
    type: block.type,
    content: blockHtmlToPlainText(block.content),
  }));
}

/** Whole-page plain text for summarization, in block order. */
export function pageBlocksToPlainText(blocks: Block[]): string {
  return blocks
    .map((block) => blockHtmlToPlainText(block.content))
    .filter((text) => text.length > 0)
    .join("\n\n");
}
