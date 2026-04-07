import { v4 as uuidv4 } from "uuid";
import type { Block } from "../types/block";
import type { WorkspaceDatabase } from "../types/database";
import type { Page, WorkspaceSnapshot } from "../types/page";
import { createEmptyBlocks } from "./defaultBlocks";
import { parseDatabaseEmbedPayload } from "./databaseEmbed";

export const STORAGE_KEY = "musing:workspace";

function nowIso(): string {
  return new Date().toISOString();
}

function seedWorkspace(): WorkspaceSnapshot {
  const id = uuidv4();
  const page: Page = {
    id,
    title: "Untitled",
    parentId: null,
    order: 0,
    updatedAt: nowIso(),
    layout: "document",
    databaseId: null,
    blocks: createEmptyBlocks(),
  };
  return {
    version: 2,
    homePageId: id,
    lastOpenedPageId: id,
    pages: [page],
    databases: [],
  };
}

const VALID_BLOCK_TYPES = new Set<Block["type"]>([
  "paragraph",
  "heading",
  "heading2",
  "blockquote",
  "codeBlock",
  "bulletList",
  "orderedList",
  "horizontalRule",
  "databaseEmbed",
]);

function isValidBlock(b: unknown): b is Block {
  if (typeof b !== "object" || b === null) return false;
  const x = b as Record<string, unknown>;
  if (
    typeof x.id !== "string" ||
    typeof x.type !== "string" ||
    typeof x.content !== "string" ||
    !VALID_BLOCK_TYPES.has(x.type as Block["type"])
  ) {
    return false;
  }
  if (x.type === "databaseEmbed") {
    return parseDatabaseEmbedPayload(x.content) !== null;
  }
  return true;
}

function isValidDatabaseProperty(p: unknown): p is WorkspaceDatabase["properties"][number] {
  if (typeof p !== "object" || p === null) return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    (o.type === "title" || o.type === "text")
  );
}

function isValidDatabaseRow(r: unknown): r is WorkspaceDatabase["rows"][number] {
  if (typeof r !== "object" || r === null) return false;
  const o = r as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.values !== "object" || o.values === null) {
    return false;
  }
  const vals = o.values as Record<string, unknown>;
  return Object.values(vals).every((v) => typeof v === "string");
}

function isValidDatabaseView(v: unknown): v is WorkspaceDatabase["views"][number] {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.name === "string" && o.type === "table";
}

function isValidDatabase(d: unknown): d is WorkspaceDatabase {
  if (typeof d !== "object" || d === null) return false;
  const o = d as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.title !== "string") return false;
  if (!Array.isArray(o.properties) || !o.properties.every(isValidDatabaseProperty)) {
    return false;
  }
  if (!Array.isArray(o.rows) || !o.rows.every(isValidDatabaseRow)) return false;
  if (!Array.isArray(o.views) || !o.views.every(isValidDatabaseView)) return false;
  return o.views.length > 0;
}

function normalizeDatabase(d: WorkspaceDatabase): WorkspaceDatabase {
  return d;
}

function normalizePage(p: Page): Page {
  const raw = p as Record<string, unknown>;
  let layout: Page["layout"] = raw.layout === "database" ? "database" : "document";
  let databaseId: string | null =
    typeof p.databaseId === "string" ? p.databaseId : null;
  if (layout === "database" && !databaseId) {
    layout = "document";
    databaseId = null;
  }
  const base: Page = {
    ...p,
    layout,
    databaseId: layout === "database" ? databaseId : null,
  };
  if (!Array.isArray(p.blocks) || p.blocks.length === 0 || !p.blocks.every(isValidBlock)) {
    return { ...base, blocks: createEmptyBlocks(), updatedAt: nowIso() };
  }
  return base;
}

type LegacyPageV1 = {
  id: string;
  title: string;
  parentId: string | null;
  order: number;
  updatedAt: string;
  blocks: Block[];
};

type LegacySnapshotV1 = {
  version: 1;
  homePageId: string;
  lastOpenedPageId: string | null;
  pages: LegacyPageV1[];
};

function migrateV1ToV2(raw: LegacySnapshotV1): WorkspaceSnapshot {
  const pages: Page[] = raw.pages.map((p) => ({
    ...p,
    layout: "document" as const,
    databaseId: null,
  }));
  return {
    version: 2,
    homePageId: raw.homePageId,
    lastOpenedPageId: raw.lastOpenedPageId,
    pages,
    databases: [],
  };
}

export function normalizeSnapshot(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  const databases = Array.isArray(snapshot.databases)
    ? snapshot.databases.filter(isValidDatabase).map(normalizeDatabase)
    : [];

  const pages = snapshot.pages.map((page) => normalizePage(page));

  const dbIds = new Set(databases.map((d) => d.id));
  const fixedPages = pages.map((page) => {
    if (page.layout === "database" && page.databaseId && !dbIds.has(page.databaseId)) {
      return {
        ...page,
        layout: "document" as const,
        databaseId: null,
        blocks: page.blocks.length ? page.blocks : createEmptyBlocks(),
        updatedAt: nowIso(),
      };
    }
    return page;
  });

  return {
    ...snapshot,
    version: 2,
    pages: fixedPages,
    databases,
  };
}

/** Parse and validate workspace JSON from localStorage or a storage event. */
export function parseWorkspaceJson(raw: string): WorkspaceSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const p = parsed as Record<string, unknown>;

    if (p.version === 1) {
      const migrated = migrateV1ToV2(p as unknown as LegacySnapshotV1);
      return normalizeSnapshot(migrated);
    }

    if (p.version !== 2) return null;
    if (!Array.isArray(p.pages) || typeof p.homePageId !== "string") return null;

    const snap: WorkspaceSnapshot = {
      version: 2,
      homePageId: p.homePageId,
      lastOpenedPageId: typeof p.lastOpenedPageId === "string" ? p.lastOpenedPageId : null,
      pages: p.pages as Page[],
      databases: Array.isArray(p.databases) ? (p.databases as WorkspaceDatabase[]) : [],
    };

    const homeExists = snap.pages.some((pg) => pg.id === snap.homePageId);
    if (!homeExists && snap.pages.length > 0) {
      return normalizeSnapshot({ ...snap, homePageId: snap.pages[0].id });
    }
    if (!homeExists) return null;
    return normalizeSnapshot(snap);
  } catch {
    return null;
  }
}

export function loadWorkspace(): WorkspaceSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedWorkspace();
    return parseWorkspaceJson(raw) ?? seedWorkspace();
  } catch {
    return seedWorkspace();
  }
}

export function saveWorkspace(snapshot: WorkspaceSnapshot): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}
