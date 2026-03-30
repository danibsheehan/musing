import type { Page } from "../types/page";

export function findDatabaseOwnerPage(
  pages: Page[],
  databaseId: string
): Page | undefined {
  return pages.find((p) => p.layout === "database" && p.databaseId === databaseId);
}
