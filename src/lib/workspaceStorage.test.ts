import type { Block } from "../types/block";
import type { WorkspaceDatabase } from "../types/database";
import type { Page, WorkspaceSnapshot } from "../types/page";
import { stringifyDatabaseEmbedPayload } from "./databaseEmbed";
import { normalizeSnapshot, parseWorkspaceJson } from "./workspaceStorage";

vi.mock("uuid", () => ({
  v4: vi.fn(() => "00000000-0000-4000-8000-000000000001"),
}));

const validParagraph = (id: string): Block => ({
  id,
  type: "paragraph",
  content: "<p>x</p>",
});

const minimalPage = (overrides: Partial<Page> = {}): Page => ({
  id: "page-1",
  title: "Untitled",
  parentId: null,
  order: 0,
  updatedAt: "2020-01-01T00:00:00.000Z",
  layout: "document",
  databaseId: null,
  blocks: [validParagraph("b1")],
  ...overrides,
});

const minimalDatabase = (id: string): WorkspaceDatabase => ({
  id,
  title: "DB",
  properties: [{ id: "col-1", name: "Name", type: "title" }],
  rows: [{ id: "row-1", values: { "col-1": "cell" } }],
  views: [{ id: "view-1", name: "Table", type: "table" }],
});

describe("parseWorkspaceJson", () => {
  it("returns null for invalid JSON", () => {
    expect(parseWorkspaceJson("not json")).toBeNull();
  });

  it("returns null when version is neither 1 nor 2", () => {
    expect(parseWorkspaceJson(JSON.stringify({ version: 99, pages: [], homePageId: "x" }))).toBeNull();
  });

  it("returns null for v2 without pages array or homePageId", () => {
    expect(parseWorkspaceJson(JSON.stringify({ version: 2 }))).toBeNull();
    expect(parseWorkspaceJson(JSON.stringify({ version: 2, pages: [] }))).toBeNull();
  });

  it("migrates v1 to v2 with document layout and empty databases", () => {
    const v1 = {
      version: 1,
      homePageId: "h1",
      lastOpenedPageId: "h1",
      pages: [
        {
          id: "h1",
          title: "Untitled",
          parentId: null,
          order: 0,
          updatedAt: "2020-01-01T00:00:00.000Z",
          blocks: [validParagraph("b1")],
        },
      ],
    };
    const out = parseWorkspaceJson(JSON.stringify(v1));
    expect(out).not.toBeNull();
    expect(out!.version).toBe(2);
    expect(out!.databases).toEqual([]);
    expect(out!.pages[0].layout).toBe("document");
    expect(out!.pages[0].databaseId).toBeNull();
  });

  it("repairs homePageId to first page when missing", () => {
    const snap = {
      version: 2,
      homePageId: "ghost",
      lastOpenedPageId: null,
      pages: [minimalPage({ id: "real-home", title: "Real" })],
      databases: [],
    };
    const out = parseWorkspaceJson(JSON.stringify(snap));
    expect(out).not.toBeNull();
    expect(out!.homePageId).toBe("real-home");
  });

  it("returns null when home is missing and there are no pages", () => {
    const snap = {
      version: 2,
      homePageId: "ghost",
      lastOpenedPageId: null,
      pages: [],
      databases: [],
    };
    expect(parseWorkspaceJson(JSON.stringify(snap))).toBeNull();
  });

  it("replaces invalid blocks with createEmptyBlocks-style content", () => {
    const badBlocksPage = minimalPage({
      blocks: [
        {
          id: "x",
          type: "databaseEmbed",
          content: "not-valid-json",
        },
      ],
    });
    const snap = {
      version: 2,
      homePageId: "page-1",
      lastOpenedPageId: null,
      pages: [badBlocksPage],
      databases: [],
    };
    const out = parseWorkspaceJson(JSON.stringify(snap));
    expect(out).not.toBeNull();
    expect(out!.pages[0].blocks).toHaveLength(1);
    expect(out!.pages[0].blocks[0].type).toBe("paragraph");
    expect(out!.pages[0].blocks[0].id).toBe("00000000-0000-4000-8000-000000000001");
    expect(out!.pages[0].blocks[0].content).toBe("<p></p>");
  });

  it("accepts valid databaseEmbed block content", () => {
    const embed = minimalPage({
      blocks: [
        {
          id: "emb",
          type: "databaseEmbed",
          content: stringifyDatabaseEmbedPayload("db-1", "v1"),
        },
      ],
    });
    const out = parseWorkspaceJson(
      JSON.stringify({
        version: 2,
        homePageId: "page-1",
        lastOpenedPageId: null,
        pages: [embed],
        databases: [minimalDatabase("db-1")],
      })
    );
    expect(out).not.toBeNull();
    expect(out!.pages[0].blocks[0].type).toBe("databaseEmbed");
  });

  it("drops malformed databases and fixes orphan database pages", () => {
    const dbBad = {
      id: "db-x",
      title: "Bad",
      properties: [],
      rows: [],
      views: [],
    };
    const orphanDbPage = minimalPage({
      id: "db-page",
      layout: "database",
      databaseId: "missing-db",
      blocks: [validParagraph("b2")],
    });
    const snap: WorkspaceSnapshot = {
      version: 2,
      homePageId: "page-1",
      lastOpenedPageId: null,
      pages: [minimalPage(), orphanDbPage],
      databases: [dbBad as unknown as WorkspaceDatabase],
    };
    const out = parseWorkspaceJson(JSON.stringify(snap));
    expect(out).not.toBeNull();
    expect(out!.databases).toEqual([]);
    const fixed = out!.pages.find((p) => p.id === "db-page");
    expect(fixed?.layout).toBe("document");
    expect(fixed?.databaseId).toBeNull();
  });
});

describe("normalizeSnapshot", () => {
  it("keeps database page when database exists in snapshot", () => {
    const db = minimalDatabase("db-1");
    const dbPage = minimalPage({
      id: "p-db",
      layout: "database",
      databaseId: "db-1",
      blocks: [],
    });
    const snap: WorkspaceSnapshot = {
      version: 2,
      homePageId: "page-1",
      lastOpenedPageId: null,
      pages: [minimalPage(), dbPage],
      databases: [db],
    };
    const out = normalizeSnapshot(snap);
    const p = out.pages.find((x) => x.id === "p-db");
    expect(p?.layout).toBe("database");
    expect(p?.databaseId).toBe("db-1");
    expect(out.databases).toHaveLength(1);
  });

  it("coerces document layout with databaseId to document and clears databaseId", () => {
    const snap: WorkspaceSnapshot = {
      version: 2,
      homePageId: "page-1",
      lastOpenedPageId: null,
      pages: [
        minimalPage({
          layout: "document",
          databaseId: "should-clear",
        }),
      ],
      databases: [],
    };
    const out = normalizeSnapshot(snap);
    expect(out.pages[0].databaseId).toBeNull();
  });
});
