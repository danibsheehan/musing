import { createContext } from "react";
import type { Page } from "../types/page";
import type { Block } from "../types/block";
import type { WorkspaceDatabase } from "../types/database";

/** Cloud sync via Supabase (optional; disabled when env vars are missing). */
export type RemoteSyncStatus = "disabled" | "connecting" | "synced" | "error";

export type WorkspaceContextValue = {
  pages: Page[];
  databases: WorkspaceDatabase[];
  homePageId: string;
  lastOpenedPageId: string | null;
  /** Bumps when workspace is reloaded from localStorage (e.g. another tab); editors should resync. */
  externalWorkspaceRevision: number;
  remoteSyncStatus: RemoteSyncStatus;
  /** Set when `remoteSyncStatus` is `error`. */
  remoteSyncError: string | null;
  getPage: (id: string) => Page | undefined;
  getDatabase: (id: string) => WorkspaceDatabase | undefined;
  setLastOpenedPageId: (id: string) => void;
  resolveOpenPageId: () => string;
  updatePageTitle: (id: string, title: string) => void;
  updatePageBlocks: (id: string, blocks: Block[]) => void;
  updateDatabase: (
    databaseId: string,
    updater: (prev: WorkspaceDatabase) => WorkspaceDatabase
  ) => void;
  createPage: (parentId: string | null) => string;
  createDatabasePage: (parentId: string | null) => string;
  deletePageSubtree: (id: string) => { removedIds: Set<string>; fallbackPageId: string | null };
  movePageWithinSiblings: (id: string, direction: "up" | "down") => void;
  ancestryFor: (pageId: string) => Page[];
  childrenOf: (parentId: string | null) => Page[];
};

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
