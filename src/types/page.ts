import type { Block } from "./block";
import type { WorkspaceDatabase } from "./database";

export type PageLayout = "document" | "database";

export type Page = {
  id: string;
  title: string;
  parentId: string | null;
  order: number;
  updatedAt: string;
  /** Document pages use TipTap blocks; database pages use `databaseId` and ignore body for UI. */
  layout: PageLayout;
  /** Set when `layout === "database"`; references `WorkspaceSnapshot.databases`. */
  databaseId: string | null;
  blocks: Block[];
};

export type WorkspaceSnapshot = {
  version: 2;
  homePageId: string;
  lastOpenedPageId: string | null;
  pages: Page[];
  databases: WorkspaceDatabase[];
};
