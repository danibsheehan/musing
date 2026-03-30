import { useCallback, useMemo, useState, type ReactNode } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Page, WorkspaceSnapshot } from "../types/page";
import type { Block } from "../types/block";
import { createEmptyBlocks } from "../lib/defaultBlocks";
import { loadWorkspace, saveWorkspace } from "../lib/workspaceStorage";
import { siblingsOf, subtreeIds, ancestryChain } from "../lib/workspaceTree";
import { WorkspaceContext, type WorkspaceContextValue } from "./workspace-context";

function nowIso(): string {
  return new Date().toISOString();
}

function persist(snapshot: WorkspaceSnapshot) {
  saveWorkspace(snapshot);
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>(() => loadWorkspace());

  const commit = useCallback((updater: (prev: WorkspaceSnapshot) => WorkspaceSnapshot) => {
    setSnapshot((prev) => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, []);

  const getPage = useCallback(
    (id: string) => snapshot.pages.find((p) => p.id === id),
    [snapshot.pages]
  );

  const setLastOpenedPageId = useCallback(
    (id: string) => {
      commit((prev) => ({ ...prev, lastOpenedPageId: id }));
    },
    [commit]
  );

  const resolveOpenPageId = useCallback(() => {
    const { lastOpenedPageId, homePageId, pages } = snapshot;
    if (lastOpenedPageId && pages.some((p) => p.id === lastOpenedPageId)) {
      return lastOpenedPageId;
    }
    if (pages.some((p) => p.id === homePageId)) return homePageId;
    return pages[0]?.id ?? homePageId;
  }, [snapshot]);

  const updatePageTitle = useCallback(
    (id: string, title: string) => {
      const trimmed = title.trim() || "Untitled";
      commit((prev) => ({
        ...prev,
        pages: prev.pages.map((p) =>
          p.id === id ? { ...p, title: trimmed, updatedAt: nowIso() } : p
        ),
      }));
    },
    [commit]
  );

  const updatePageBlocks = useCallback(
    (id: string, blocks: Block[]) => {
      commit((prev) => ({
        ...prev,
        pages: prev.pages.map((p) =>
          p.id === id ? { ...p, blocks, updatedAt: nowIso() } : p
        ),
      }));
    },
    [commit]
  );

  const createPage = useCallback(
    (parentId: string | null): string => {
      const id = uuidv4();
      commit((prev) => {
        const sibs = siblingsOf(prev.pages, parentId);
        const nextOrder =
          sibs.length === 0 ? 0 : Math.max(...sibs.map((p) => p.order)) + 1;
        const page: Page = {
          id,
          title: "Untitled",
          parentId,
          order: nextOrder,
          updatedAt: nowIso(),
          blocks: createEmptyBlocks(),
        };
        return {
          ...prev,
          pages: [...prev.pages, page],
          lastOpenedPageId: id,
        };
      });
      return id;
    },
    [commit]
  );

  const deletePageSubtree = useCallback(
    (id: string): { removedIds: Set<string>; fallbackPageId: string | null } => {
      const removed = subtreeIds(snapshot.pages, id);
      let fallbackPageId: string | null = null;

      commit((prev) => {
        const target = prev.pages.find((p) => p.id === id);
        const parentId = target?.parentId ?? null;
        const remaining = prev.pages.filter((p) => !removed.has(p.id));
        if (remaining.length === 0) return prev;

        const pickFallback = (): string | null => {
          if (parentId && remaining.some((p) => p.id === parentId)) return parentId;
          const roots = siblingsOf(remaining, null);
          return roots[0]?.id ?? remaining[0]?.id ?? null;
        };

        fallbackPageId = pickFallback();

        let homePageId = prev.homePageId;
        if (removed.has(homePageId)) {
          homePageId = fallbackPageId ?? remaining[0]?.id ?? homePageId;
        }

        let lastOpened = prev.lastOpenedPageId;
        if (lastOpened && removed.has(lastOpened)) {
          lastOpened = fallbackPageId;
        }

        return {
          ...prev,
          pages: remaining,
          homePageId,
          lastOpenedPageId: lastOpened,
        };
      });

      return { removedIds: removed, fallbackPageId };
    },
    [commit, snapshot.pages]
  );

  const movePageWithinSiblings = useCallback(
    (id: string, direction: "up" | "down") => {
      commit((prev) => {
        const page = prev.pages.find((p) => p.id === id);
        if (!page) return prev;
        const sibs = siblingsOf(prev.pages, page.parentId);
        const idx = sibs.findIndex((p) => p.id === id);
        if (idx < 0) return prev;
        const swapWith = direction === "up" ? idx - 1 : idx + 1;
        if (swapWith < 0 || swapWith >= sibs.length) return prev;

        const a = sibs[idx];
        const b = sibs[swapWith];
        const orderA = a.order;
        const orderB = b.order;

        return {
          ...prev,
          pages: prev.pages.map((p) => {
            if (p.id === a.id) return { ...p, order: orderB, updatedAt: nowIso() };
            if (p.id === b.id) return { ...p, order: orderA, updatedAt: nowIso() };
            return p;
          }),
        };
      });
    },
    [commit]
  );

  const ancestryFor = useCallback(
    (pageId: string) => ancestryChain(snapshot.pages, pageId),
    [snapshot.pages]
  );

  const childrenOf = useCallback(
    (parentId: string | null) => siblingsOf(snapshot.pages, parentId),
    [snapshot.pages]
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      pages: snapshot.pages,
      homePageId: snapshot.homePageId,
      lastOpenedPageId: snapshot.lastOpenedPageId,
      getPage,
      setLastOpenedPageId,
      resolveOpenPageId,
      updatePageTitle,
      updatePageBlocks,
      createPage,
      deletePageSubtree,
      movePageWithinSiblings,
      ancestryFor,
      childrenOf,
    }),
    [
      snapshot.pages,
      snapshot.homePageId,
      snapshot.lastOpenedPageId,
      getPage,
      setLastOpenedPageId,
      resolveOpenPageId,
      updatePageTitle,
      updatePageBlocks,
      createPage,
      deletePageSubtree,
      movePageWithinSiblings,
      ancestryFor,
      childrenOf,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}
