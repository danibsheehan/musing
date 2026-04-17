import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Page, WorkspaceSnapshot } from "../types/page";
import type { Block } from "../types/block";
import type { WorkspaceDatabase } from "../types/database";
import { createEmptyBlocks } from "../lib/defaultBlocks";
import { createWorkspaceDatabase } from "../lib/databaseFactory";
import { parseDatabaseEmbedPayload } from "../lib/databaseEmbed";
import {
  loadWorkspace,
  parseWorkspaceJson,
  saveWorkspace,
  STORAGE_KEY,
} from "../lib/workspaceStorage";
import { getSupabase, isSupabaseConfigured } from "../lib/supabaseClient";
import {
  fetchWorkspaceRow,
  snapshotFromRemoteJson,
  upsertWorkspaceRow,
} from "../lib/supabaseWorkspace";
import { siblingsOf, subtreeIds, ancestryChain } from "../lib/workspaceTree";
import {
  WorkspaceContext,
  type RemoteSyncStatus,
  type WorkspaceContextValue,
} from "./workspace-context";

function nowIso(): string {
  return new Date().toISOString();
}

function persist(snapshot: WorkspaceSnapshot) {
  saveWorkspace(snapshot);
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>(() => loadWorkspace());
  const [externalWorkspaceRevision, setExternalWorkspaceRevision] = useState(0);
  const [remoteSyncStatus, setRemoteSyncStatus] = useState<RemoteSyncStatus>(() =>
    isSupabaseConfigured() ? "connecting" : "disabled"
  );
  const [remoteSyncError, setRemoteSyncError] = useState<string | null>(null);

  const snapshotRef = useRef(snapshot);
  const remoteReadyRef = useRef(false);
  const remoteUserIdRef = useRef<string | null>(null);
  const remoteSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    const flush = () => saveWorkspace(snapshotRef.current);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || e.newValue == null) return;
      const next = parseWorkspaceJson(e.newValue);
      if (!next) return;
      setSnapshot(next);
      setExternalWorkspaceRevision((n) => n + 1);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const scheduleRemoteSave = useCallback(() => {
    if (!isSupabaseConfigured() || !remoteReadyRef.current) return;
    const uid = remoteUserIdRef.current;
    if (!uid) return;
    if (remoteSaveTimerRef.current) clearTimeout(remoteSaveTimerRef.current);
    remoteSaveTimerRef.current = setTimeout(() => {
      remoteSaveTimerRef.current = null;
      void (async () => {
        try {
          const client = getSupabase();
          await upsertWorkspaceRow(client, uid, snapshotRef.current);
          setRemoteSyncError(null);
          setRemoteSyncStatus("synced");
        } catch (e) {
          setRemoteSyncStatus("error");
          setRemoteSyncError(e instanceof Error ? e.message : "Cloud save failed");
        }
      })();
    }, 800);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    let cancelled = false;
    const client = getSupabase();

    remoteReadyRef.current = false;

    void (async () => {
      try {
        const {
          data: { session },
        } = await client.auth.getSession();
        let s = session;
        if (!s) {
          const { data, error } = await client.auth.signInAnonymously();
          if (error || !data.session) {
            if (!cancelled) {
              setRemoteSyncStatus("error");
              setRemoteSyncError(
                error?.message ?? "Anonymous sign-in failed. Enable it under Authentication → Providers in Supabase."
              );
            }
            return;
          }
          s = data.session;
        }

        if (!s?.user || cancelled) return;
        remoteUserIdRef.current = s.user.id;

        const row = await fetchWorkspaceRow(client, s.user.id);
        if (cancelled) return;

        if (row?.snapshot != null) {
          const snap = snapshotFromRemoteJson(row.snapshot);
          if (snap) {
            setSnapshot(snap);
            saveWorkspace(snap);
            setExternalWorkspaceRevision((n) => n + 1);
          }
        } else {
          await upsertWorkspaceRow(client, s.user.id, snapshotRef.current);
        }

        if (!cancelled) {
          remoteReadyRef.current = true;
          setRemoteSyncStatus("synced");
          setRemoteSyncError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRemoteSyncStatus("error");
          setRemoteSyncError(e instanceof Error ? e.message : "Cloud sync failed");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (remoteSaveTimerRef.current) {
        clearTimeout(remoteSaveTimerRef.current);
        remoteSaveTimerRef.current = null;
      }
      remoteReadyRef.current = false;
      remoteUserIdRef.current = null;
    };
  }, []);

  const flushRemoteWorkspace = useCallback(async (): Promise<void> => {
    if (!isSupabaseConfigured()) return;
    if (!remoteReadyRef.current) return;
    const uid = remoteUserIdRef.current;
    if (!uid) return;
    if (remoteSaveTimerRef.current) {
      clearTimeout(remoteSaveTimerRef.current);
      remoteSaveTimerRef.current = null;
    }
    try {
      const client = getSupabase();
      await upsertWorkspaceRow(client, uid, snapshotRef.current);
      setRemoteSyncError(null);
      setRemoteSyncStatus("synced");
    } catch (e) {
      setRemoteSyncStatus("error");
      setRemoteSyncError(e instanceof Error ? e.message : "Cloud save failed");
      throw e;
    }
  }, []);

  const commit = useCallback(
    (updater: (prev: WorkspaceSnapshot) => WorkspaceSnapshot) => {
      setSnapshot((prev) => {
        const next = updater(prev);
        persist(next);
        scheduleRemoteSave();
        return next;
      });
    },
    [scheduleRemoteSave]
  );

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
      commit((prev) => {
        const page = prev.pages.find((p) => p.id === id);
        const dbId = page?.databaseId ?? null;
        return {
          ...prev,
          pages: prev.pages.map((p) =>
            p.id === id ? { ...p, title: trimmed, updatedAt: nowIso() } : p
          ),
          databases:
            dbId != null
              ? prev.databases.map((d) =>
                  d.id === dbId ? { ...d, title: trimmed } : d
                )
              : prev.databases,
        };
      });
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
          layout: "document",
          databaseId: null,
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

  const createDatabasePage = useCallback(
    (parentId: string | null): string => {
      const dbId = uuidv4();
      const pageId = uuidv4();
      const db = createWorkspaceDatabase(dbId);
      commit((prev) => {
        const sibs = siblingsOf(prev.pages, parentId);
        const nextOrder =
          sibs.length === 0 ? 0 : Math.max(...sibs.map((p) => p.order)) + 1;
        const page: Page = {
          id: pageId,
          title: db.title,
          parentId,
          order: nextOrder,
          updatedAt: nowIso(),
          layout: "database",
          databaseId: dbId,
          blocks: createEmptyBlocks(),
        };
        return {
          ...prev,
          pages: [...prev.pages, page],
          databases: [...prev.databases, db],
          lastOpenedPageId: pageId,
        };
      });
      return pageId;
    },
    [commit]
  );

  const getDatabase = useCallback(
    (databaseId: string) => snapshot.databases.find((d) => d.id === databaseId),
    [snapshot.databases]
  );

  const updateDatabase = useCallback(
    (databaseId: string, updater: (prev: WorkspaceDatabase) => WorkspaceDatabase) => {
      commit((prev) => ({
        ...prev,
        databases: prev.databases.map((d) =>
          d.id === databaseId ? updater(d) : d
        ),
      }));
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
        const removedDbIds = new Set<string>();
        for (const rid of removed) {
          const pg = prev.pages.find((p) => p.id === rid);
          if (pg?.layout === "database" && pg.databaseId) {
            removedDbIds.add(pg.databaseId);
          }
        }

        let remaining = prev.pages.filter((p) => !removed.has(p.id));
        remaining = remaining.map((page) => ({
          ...page,
          blocks: page.blocks.map((b) => {
            if (b.type !== "databaseEmbed") return b;
            const pl = parseDatabaseEmbedPayload(b.content);
            if (!pl || removedDbIds.has(pl.databaseId)) {
              return { ...b, type: "paragraph" as const, content: "<p></p>" };
            }
            return b;
          }),
        }));

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

        const databases = prev.databases.filter((d) => !removedDbIds.has(d.id));

        return {
          ...prev,
          pages: remaining,
          databases,
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
      databases: snapshot.databases,
      homePageId: snapshot.homePageId,
      lastOpenedPageId: snapshot.lastOpenedPageId,
      externalWorkspaceRevision,
      remoteSyncStatus,
      remoteSyncError,
      getPage,
      getDatabase,
      setLastOpenedPageId,
      resolveOpenPageId,
      updatePageTitle,
      updatePageBlocks,
      updateDatabase,
      createPage,
      createDatabasePage,
      deletePageSubtree,
      movePageWithinSiblings,
      ancestryFor,
      childrenOf,
      flushRemoteWorkspace,
    }),
    [
      snapshot.pages,
      snapshot.databases,
      snapshot.homePageId,
      snapshot.lastOpenedPageId,
      externalWorkspaceRevision,
      remoteSyncStatus,
      remoteSyncError,
      getPage,
      getDatabase,
      setLastOpenedPageId,
      resolveOpenPageId,
      updatePageTitle,
      updatePageBlocks,
      updateDatabase,
      createPage,
      createDatabasePage,
      deletePageSubtree,
      movePageWithinSiblings,
      ancestryFor,
      childrenOf,
      flushRemoteWorkspace,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}
