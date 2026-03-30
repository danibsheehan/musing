import { v4 as uuidv4 } from "uuid";
import type { Page, WorkspaceSnapshot } from "../types/page";
import { createEmptyBlocks } from "./defaultBlocks";

const STORAGE_KEY = "musing:workspace";

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

export function loadWorkspace(): WorkspaceSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedWorkspace();
    const parsed = JSON.parse(raw) as WorkspaceSnapshot;
    if (
      parsed?.version !== 1 ||
      !Array.isArray(parsed.pages) ||
      typeof parsed.homePageId !== "string"
    ) {
      return seedWorkspace();
    }
    const homeExists = parsed.pages.some((p) => p.id === parsed.homePageId);
    if (!homeExists && parsed.pages.length > 0) {
      return {
        ...parsed,
        homePageId: parsed.pages[0].id,
      };
    }
    if (!homeExists) return seedWorkspace();
    return parsed;
  } catch {
    return seedWorkspace();
  }
}

export function saveWorkspace(snapshot: WorkspaceSnapshot): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}
