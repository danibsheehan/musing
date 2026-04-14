import type { Block } from "../../types/block";
import { tipTapContentFromBlock } from "../blockEditorCommands";

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/\n/g, "&#10;");
}

/** Inject `data-block-id` on the root element of a TipTap HTML fragment (browser). */
export function injectBlockIdOnRoot(html: string, blockId: string): string {
  if (typeof document === "undefined") {
    return html.replace(
      /^<(\w+)/,
      `<$1 data-block-id="${escapeAttr(blockId)}" `
    );
  }
  const wrap = document.createElement("div");
  wrap.innerHTML = html.trim();
  const first = wrap.firstElementChild;
  if (!first) {
    const p = document.createElement("p");
    p.setAttribute("data-block-id", blockId);
    return p.outerHTML;
  }
  if (!first.hasAttribute("data-block-id")) {
    first.setAttribute("data-block-id", blockId);
  }
  return wrap.innerHTML;
}

function blockToHtmlFragment(block: Block): string {
  if (block.type === "databaseEmbed") {
    const enc = encodeURIComponent(block.content);
    return `<div data-type="musing-database-embed" data-block-id="${escapeAttr(block.id)}" data-payload="${escapeAttr(enc)}"></div>`;
  }
  const inner = tipTapContentFromBlock(block);
  return injectBlockIdOnRoot(inner, block.id);
}

/** One TipTap document HTML for the whole page (multiple top-level blocks). */
export function blocksToDocHtml(blocks: Block[]): string {
  return blocks.map(blockToHtmlFragment).join("");
}
