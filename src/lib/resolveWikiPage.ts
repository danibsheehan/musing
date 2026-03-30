import type { Page } from "../types/page";

/** Case-insensitive title match; first page wins if titles collide. */
export function resolveWikiTarget(
  pages: Page[],
  rawLabel: string
): { id: string; title: string } | null {
  const label = rawLabel.trim();
  if (!label) return null;
  const needle = label.toLowerCase();
  const page = pages.find((p) => p.title.trim().toLowerCase() === needle);
  return page ? { id: page.id, title: page.title } : null;
}

export function filterPagesForPicker(
  pages: Page[],
  opts: { query: string; excludePageId: string }
): Page[] {
  const q = opts.query.trim().toLowerCase();
  return pages
    .filter((p) => p.id !== opts.excludePageId)
    .filter((p) => !q || p.title.toLowerCase().includes(q))
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}
