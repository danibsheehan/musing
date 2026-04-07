import type { Block } from "../types/block";
import type { WorkspaceDatabase } from "../types/database";
import type { Page } from "../types/page";
import { parseDatabaseEmbedPayload } from "./databaseEmbed";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function databaseToExportTableHtml(db: WorkspaceDatabase): string {
  const cols = db.properties;
  const colCount = Math.max(1, cols.length);
  const head = `<thead><tr>${cols.map((c) => `<th>${escapeHtml(c.name)}</th>`).join("")}</tr></thead>`;
  const body =
    db.rows.length === 0
      ? `<tbody><tr><td colspan="${colCount}">No rows yet</td></tr></tbody>`
      : `<tbody>${db.rows
          .map(
            (row) =>
              `<tr>${cols
                .map((c) => `<td>${escapeHtml(row.values[c.id] ?? "")}</td>`)
                .join("")}</tr>`
          )
          .join("")}</tbody>`;
  return `<table class="pdf-export-table">${head}${body}</table>`;
}

function blockToHtml(
  block: Block,
  getDatabase: (id: string) => WorkspaceDatabase | undefined
): string {
  switch (block.type) {
    case "databaseEmbed": {
      const payload = parseDatabaseEmbedPayload(block.content);
      if (!payload) {
        return `<div class="pdf-block pdf-embed-missing">Invalid database embed.</div>`;
      }
      const db = getDatabase(payload.databaseId);
      if (!db) {
        return `<div class="pdf-block pdf-embed-missing">Linked database missing.</div>`;
      }
      return `<div class="pdf-block pdf-db-embed">${databaseToExportTableHtml(db)}</div>`;
    }
    case "horizontalRule":
      return `<div class="pdf-block"><hr class="pdf-hr" /></div>`;
    default:
      return `<div class="pdf-block">${block.content}</div>`;
  }
}

export function pageToExportHtml(
  page: Page,
  getDatabase: (id: string) => WorkspaceDatabase | undefined
): string {
  const title = escapeHtml(page.title.trim() || "Untitled");

  if (page.layout === "database" && page.databaseId) {
    const db = getDatabase(page.databaseId);
    const body = db
      ? databaseToExportTableHtml(db)
      : `<p class="pdf-missing">This database no longer exists.</p>`;
    return `<h1 class="pdf-page-title">${title}</h1><div class="pdf-db-full">${body}</div>`;
  }

  const blocks = page.blocks.map((b) => blockToHtml(b, getDatabase)).join("");
  return `<h1 class="pdf-page-title">${title}</h1>${blocks}`;
}
