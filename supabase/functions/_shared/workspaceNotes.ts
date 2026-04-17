/**
 * Build plain-text context from a workspace snapshot for the Ask assistant.
 * Document pages only; database pages and database embeds are omitted/skipped per product v1.
 */

const DEFAULT_MAX_CHARS = 72_000;

export function htmlToPlain(html: string): string {
  if (!html.trim()) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

type UnknownRecord = Record<string, unknown>;

function isDocumentPage(p: UnknownRecord): boolean {
  return p.layout !== "database";
}

export function buildCappedNotesContext(
  snapshot: unknown,
  maxChars: number = DEFAULT_MAX_CHARS
): { text: string; truncated: boolean } {
  const obj = snapshot as UnknownRecord;
  const pages = Array.isArray(obj.pages) ? (obj.pages as UnknownRecord[]) : [];
  const docPages = pages.filter(isDocumentPage);
  const sorted = [...docPages].sort((a, b) => {
    const ta = String(a.updatedAt ?? "");
    const tb = String(b.updatedAt ?? "");
    return tb.localeCompare(ta);
  });

  let out = "";
  let truncated = false;

  for (const p of sorted) {
    const title = String(p.title ?? "Untitled");
    const blocks = Array.isArray(p.blocks) ? (p.blocks as UnknownRecord[]) : [];
    let section = `## ${title}\n\n`;
    for (const b of blocks) {
      const type = String(b.type ?? "paragraph");
      if (type === "databaseEmbed") {
        section += "[Embedded database omitted]\n\n";
        continue;
      }
      const content = String(b.content ?? "");
      const plain = htmlToPlain(content);
      if (plain) section += `${plain}\n\n`;
    }
    if (out.length + section.length > maxChars) {
      const remaining = maxChars - out.length;
      if (remaining > 400) {
        out += section.slice(0, remaining).trimEnd() + "\n\n[…truncated]";
      }
      truncated = true;
      break;
    }
    out += section;
  }

  const text = out.trim() || "(No document pages yet.)";
  return { text, truncated };
}
