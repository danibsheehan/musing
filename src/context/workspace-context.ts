import { createContext } from "react";
import type { Page } from "../types/page";
import type { Block } from "../types/block";

export type WorkspaceContextValue = {
  pages: Page[];
  homePageId: string;
  lastOpenedPageId: string | null;
  /** Bumps when workspace is reloaded from localStorage (e.g. another tab); editors should resync. */
  externalWorkspaceRevision: number;
  getPage: (id: string) => Page | undefined;
  setLastOpenedPageId: (id: string) => void;
  resolveOpenPageId: () => string;
  updatePageTitle: (id: string, title: string) => void;
  updatePageBlocks: (id: string, blocks: Block[]) => void;
  createPage: (parentId: string | null) => string;
  deletePageSubtree: (id: string) => { removedIds: Set<string>; fallbackPageId: string | null };
  movePageWithinSiblings: (id: string, direction: "up" | "down") => void;
  ancestryFor: (pageId: string) => Page[];
  childrenOf: (parentId: string | null) => Page[];
};

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
