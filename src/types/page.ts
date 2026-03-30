import type { Block } from "./block";

export type Page = {
  id: string;
  title: string;
  parentId: string | null;
  order: number;
  updatedAt: string;
  blocks: Block[];
};

export type WorkspaceSnapshot = {
  version: 1;
  homePageId: string;
  lastOpenedPageId: string | null;
  pages: Page[];
};
