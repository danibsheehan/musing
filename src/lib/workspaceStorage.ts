import { v4 as uuidv4 } from "uuid";
import type { Block } from "../types/block";
import type { Page, WorkspaceSnapshot } from "../types/page";
import { createEmptyBlocks } from "./defaultBlocks";

export const STORAGE_KEY = "musing:workspace";

function nowIso(): string {
  return new Date().toISOString();
}

function seedWorkspace(): WorkspaceSnapshot {
  const id = uuidv4();
  const page: Page = {
    id,
    title: "Home",
    parentId: null,
    order: 0,
    updatedAt: nowIso(),
    blocks: createEmptyBlocks(),
  };
  return {
    version: 1,
    homePageId: id,
    lastOpenedPageId: id,
    pages: [page],
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
]);

function isValidBlock(b: unknown): b is Block {
  if (typeof b !== "object" || b === null) return false;
  const x = b as Record<string, unknown>;
  return (
    typeof x.id === "string" &&
    typeof x.type === "string" &&
    VALID_BLOCK_TYPES.has(x.type as Block["type"]) &&
    typeof x.content === "string"
  );
}

function normalizePage(p: Page): Page {
  if (!Array.isArray(p.blocks) || p.blocks.length === 0 || !p.blocks.every(isValidBlock)) {
    return { ...p, blocks: createEmptyBlocks(), updatedAt: nowIso() };
  }
  return p;
}

export function normalizeSnapshot(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  return {
    ...snapshot,
    pages: snapshot.pages.map((page) => normalizePage(page)),
  };
}

/** Parse and validate workspace JSON from localStorage or a storage event. */
export function parseWorkspaceJson(raw: string): WorkspaceSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as WorkspaceSnapshot;
    if (
      parsed?.version !== 1 ||
      !Array.isArray(parsed.pages) ||
      typeof parsed.homePageId !== "string"
    ) {
      return null;
    }
    const homeExists = parsed.pages.some((p) => p.id === parsed.homePageId);
    if (!homeExists && parsed.pages.length > 0) {
      return normalizeSnapshot({ ...parsed, homePageId: parsed.pages[0].id });
    }
    if (!homeExists) return null;
    return normalizeSnapshot(parsed);
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
