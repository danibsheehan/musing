import DOMPurify from "dompurify";

/**
 * Allowlist matches exactly what the current TipTap schema (StarterKit with headings
 * limited to h1/h2, WikiLink mark, Emoji node, block-id attributes) can legitimately
 * produce — see `editor-tiptap` skill and `extensions/*.ts` for the schema itself.
 * `databaseEmbed` blocks store JSON, not HTML, and must never be passed through this.
 */
const ALLOWED_TAGS = [
  "p",
  "h1",
  "h2",
  "blockquote",
  "pre",
  "code",
  "ul",
  "ol",
  "li",
  "hr",
  "strong",
  "em",
  "s",
  "br",
  "a",
  "span",
  "img",
];

const ALLOWED_ATTR = [
  "class",
  "href",
  "rel",
  "data-wiki-page-id",
  "data-block-id",
  "data-type",
  "data-name",
  "src",
  "alt",
  "draggable",
  "loading",
  "align",
];

/** Sanitizes stored block HTML against the app's known TipTap schema (never for `databaseEmbed` content, which is JSON). */
export function sanitizeBlockHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}
