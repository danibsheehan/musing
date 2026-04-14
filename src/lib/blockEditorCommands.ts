import type { Editor } from "@tiptap/core";
import type { Block, BlockType } from "../types/block";

/** True when HTML has no visible text (whitespace / ZWSP / empty tags only). */
export function isBlockHtmlVisuallyEmpty(html: string): boolean {
  if (typeof document === "undefined") {
    const stripped = html
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/[\u200b-\u200d\ufeff\s]/g, "");
    return stripped.length === 0;
  }
  const host = document.createElement("div");
  host.innerHTML = html.trim() || "<p></p>";
  const text = (host.textContent ?? "")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .trim();
  return text.length === 0;
}

/**
 * TipTap `useEditor({ content })` re-applies `content` whenever it differs from the live doc.
 * After a slash command, React may still store `<p></p>` while the editor already shows `<h1>`;
 * that mismatch resets the block to a paragraph. For visually empty blocks, derive HTML from `type`.
 */
export function tipTapContentFromBlock(block: Pick<Block, "type" | "content">): string {
  if (block.type === "databaseEmbed") {
    return block.content;
  }
  if (!isBlockHtmlVisuallyEmpty(block.content)) {
    return block.content;
  }
  switch (block.type) {
    case "paragraph":
      return "<p></p>";
    case "heading":
      return "<h1></h1>";
    case "heading2":
      return "<h2></h2>";
    case "blockquote":
      return "<blockquote><p></p></blockquote>";
    case "codeBlock":
      return "<pre><code></code></pre>";
    case "bulletList":
      return "<ul><li><p></p></li></ul>";
    case "orderedList":
      return "<ol><li><p></p></li></ol>";
    case "horizontalRule":
      return "<hr />";
    default:
      return "<p></p>";
  }
}

/**
 * Each musing row is one TipTap doc, but StarterKit allows `block+`, so commands like
 * `setHorizontalRule` or a stray split can leave extra top-level siblings. That looks
 * like an extra "block" under the current one while React still has a single row.
 *
 * Strips extra top-level nodes from serialized HTML, then setContent — avoids fragile
 * doc positions and avoids JSON setContent re-parsing quirks for `horizontalRule`.
 */
export function collapseEditorToSingleRootBlock(editor: Editor): void {
  if (editor.state.doc.childCount <= 1) return;
  if (typeof document === "undefined") return;
  const html = editor.getHTML();
  const host = document.createElement("div");
  host.innerHTML = html;
  const firstEl = host.firstElementChild;
  if (!firstEl) return;
  host.replaceChildren(firstEl);
  editor.commands.setContent(host.innerHTML, { emitUpdate: false });
}

/** Applies the block shape for `type` to the current selection (slash menu + type changes). */
export function applyBlockTypeToEditor(editor: Editor, type: BlockType): void {
  const chain = editor.chain().focus();
  switch (type) {
    case "paragraph":
      chain.setParagraph();
      break;
    case "heading":
      chain.setHeading({ level: 1 });
      break;
    case "heading2":
      chain.setHeading({ level: 2 });
      break;
    case "blockquote":
      chain.setParagraph().toggleBlockquote();
      break;
    case "codeBlock":
      chain.toggleCodeBlock();
      break;
    case "bulletList":
      chain.toggleBulletList();
      break;
    case "orderedList":
      chain.toggleOrderedList();
      break;
    case "horizontalRule":
      chain.setHorizontalRule();
      break;
    case "databaseEmbed":
      return;
  }
  chain.run();
}
