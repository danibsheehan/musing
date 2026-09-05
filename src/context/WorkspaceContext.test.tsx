import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeEach, vi } from "vitest";
import type { Block } from "../types/block";
import type { Page, WorkspaceSnapshot } from "../types/page";
import { STORAGE_KEY } from "../lib/workspaceStorage";
import { stringifyDatabaseEmbedPayload } from "../lib/databaseEmbed";
import { WorkspaceProvider } from "./WorkspaceContext";
import { useWorkspace } from "./useWorkspace";
import { isSupabaseConfigured, getSupabase } from "../lib/supabaseClient";

const workspaceMocks = vi.hoisted(() => ({
  loadWorkspace: vi.fn(),
  saveWorkspace: vi.fn(),
}));

vi.mock("../lib/workspaceStorage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/workspaceStorage")>();
  return {
    ...actual,
    loadWorkspace: workspaceMocks.loadWorkspace,
    saveWorkspace: workspaceMocks.saveWorkspace,
  };
});

vi.mock("../lib/supabaseClient", () => ({
  isSupabaseConfigured: vi.fn(() => false),
  getSupabase: vi.fn(),
}));

const paragraph = (id: string): Block => ({
  id,
  type: "paragraph",
  content: "<p>x</p>",
});

const page = (overrides: Partial<Page> = {}): Page => ({
  id: "page-a",
  title: "First",
  parentId: null,
  order: 0,
  updatedAt: "2020-01-01T00:00:00.000Z",
  layout: "document",
  databaseId: null,
  blocks: [paragraph("b1")],
  ...overrides,
});

function snapshot(overrides: Partial<WorkspaceSnapshot> = {}): WorkspaceSnapshot {
  const p = page();
  return {
    version: 2,
    homePageId: p.id,
    lastOpenedPageId: p.id,
    pages: [p],
    databases: [],
    ...overrides,
  };
}

function StorageConsumer() {
  const { homePageId, externalWorkspaceRevision } = useWorkspace();
  return (
    <div>
      <span data-testid="home">{homePageId}</span>
      <span data-testid="revision">{externalWorkspaceRevision}</span>
    </div>
  );
}

function OpenPageConsumer() {
  const id = useWorkspace().resolveOpenPageId();
  return <span data-testid="open">{id}</span>;
}

function TreeConsumer({
  targetId,
  ancestryId,
  childrenParentId,
}: {
  targetId: string | null;
  ancestryId?: string;
  childrenParentId?: string | null;
}) {
  const ws = useWorkspace();
  return (
    <div>
      <pre data-testid="pages">{JSON.stringify(ws.pages)}</pre>
      <pre data-testid="databases">{JSON.stringify(ws.databases)}</pre>
      <span data-testid="home">{ws.homePageId}</span>
      <span data-testid="lastOpened">{ws.lastOpenedPageId ?? ""}</span>
      <button onClick={() => ws.createPage(targetId)}>createChild</button>
      <button onClick={() => ws.createDatabasePage(targetId)}>createDbChild</button>
      <button onClick={() => targetId && ws.updatePageTitle(targetId, "  New Title  ")}>
        rename
      </button>
      <button onClick={() => targetId && ws.updatePageTitle(targetId, "   ")}>blankRename</button>
      <button onClick={() => targetId && ws.updatePageBlocks(targetId, [paragraph("new-block")])}>
        setBlocks
      </button>
      <button onClick={() => targetId && ws.movePageWithinSiblings(targetId, "up")}>moveUp</button>
      <button onClick={() => targetId && ws.movePageWithinSiblings(targetId, "down")}>
        moveDown
      </button>
      <button onClick={() => targetId && ws.deletePageSubtree(targetId)}>deleteSubtree</button>
      {ancestryId != null && (
        <pre data-testid="ancestry">
          {JSON.stringify(ws.ancestryFor(ancestryId).map((p) => p.id))}
        </pre>
      )}
      {childrenParentId !== undefined && (
        <pre data-testid="children">
          {JSON.stringify(ws.childrenOf(childrenParentId).map((p) => p.id))}
        </pre>
      )}
    </div>
  );
}

function getPages(): Page[] {
  return JSON.parse(screen.getByTestId("pages").textContent ?? "[]") as Page[];
}

function getDatabases() {
  return JSON.parse(screen.getByTestId("databases").textContent ?? "[]") as {
    id: string;
    title: string;
  }[];
}

function SyncConsumer() {
  const { remoteSyncStatus, remoteSyncError } = useWorkspace();
  return (
    <div>
      <span data-testid="sync">{remoteSyncStatus}</span>
      <span data-testid="sync-err">{remoteSyncError ?? ""}</span>
    </div>
  );
}

describe("WorkspaceProvider", () => {
  beforeEach(() => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false);
    vi.mocked(getSupabase).mockReset();
    workspaceMocks.saveWorkspace.mockClear();
    workspaceMocks.loadWorkspace.mockReset();
    workspaceMocks.loadWorkspace.mockImplementation(() => snapshot());
  });

  it("applies cross-tab storage updates and bumps externalWorkspaceRevision", async () => {
    const snap1 = snapshot({ homePageId: "page-a", pages: [page({ id: "page-a", title: "One" })] });
    const snap2 = snapshot({ homePageId: "page-b", pages: [page({ id: "page-b", title: "Two" })] });
    workspaceMocks.loadWorkspace.mockReturnValue(snap1);

    render(
      <WorkspaceProvider>
        <StorageConsumer />
      </WorkspaceProvider>,
    );

    expect(screen.getByTestId("home")).toHaveTextContent("page-a");
    expect(screen.getByTestId("revision")).toHaveTextContent("0");

    await act(async () => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STORAGE_KEY,
          newValue: JSON.stringify(snap2),
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("home")).toHaveTextContent("page-b");
    });
    expect(screen.getByTestId("revision")).toHaveTextContent("1");
  });

  it("resolveOpenPageId prefers lastOpenedPageId when it exists", () => {
    workspaceMocks.loadWorkspace.mockReturnValue(
      snapshot({
        homePageId: "page-a",
        lastOpenedPageId: "page-b",
        pages: [page({ id: "page-a", title: "A" }), page({ id: "page-b", title: "B", order: 1 })],
      }),
    );

    render(
      <WorkspaceProvider>
        <OpenPageConsumer />
      </WorkspaceProvider>,
    );

    expect(screen.getByTestId("open")).toHaveTextContent("page-b");
  });

  describe("when Supabase is configured", () => {
    beforeEach(() => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      workspaceMocks.loadWorkspace.mockReturnValue(snapshot());
      vi.mocked(getSupabase).mockReturnValue({
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
          signInAnonymously: vi.fn().mockResolvedValue({
            data: { session: null },
            error: new Error("anon failed"),
          }),
        },
      } as never);
    });

    it("sets remote sync error when anonymous sign-in fails", async () => {
      render(
        <WorkspaceProvider>
          <SyncConsumer />
        </WorkspaceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("sync")).toHaveTextContent("error");
      });
      expect(screen.getByTestId("sync-err")).toHaveTextContent("anon failed");
    });
  });

  describe("page creation and edits", () => {
    it("createPage appends a child under the given parent as the new lastOpenedPageId", async () => {
      const user = userEvent.setup();
      workspaceMocks.loadWorkspace.mockReturnValue(
        snapshot({ pages: [page({ id: "page-a", title: "A" })] }),
      );

      render(
        <WorkspaceProvider>
          <TreeConsumer targetId="page-a" />
        </WorkspaceProvider>,
      );

      await user.click(screen.getByRole("button", { name: "createChild" }));

      const pages = getPages();
      expect(pages).toHaveLength(2);
      const child = pages.find((p) => p.id !== "page-a")!;
      expect(child.parentId).toBe("page-a");
      expect(child.title).toBe("Untitled");
      expect(child.order).toBe(0);
      expect(screen.getByTestId("lastOpened")).toHaveTextContent(child.id);
    });

    it("createPage assigns the next order among existing siblings", async () => {
      const user = userEvent.setup();
      workspaceMocks.loadWorkspace.mockReturnValue(
        snapshot({
          pages: [
            page({ id: "root", title: "Root" }),
            page({ id: "page-a", title: "A", parentId: "root", order: 0 }),
            page({ id: "page-b", title: "B", parentId: "root", order: 2 }),
          ],
        }),
      );

      render(
        <WorkspaceProvider>
          <TreeConsumer targetId="root" />
        </WorkspaceProvider>,
      );

      await user.click(screen.getByRole("button", { name: "createChild" }));

      const pages = getPages();
      const child = pages.find((p) => !["root", "page-a", "page-b"].includes(p.id))!;
      expect(child.order).toBe(3);
    });

    it("createDatabasePage adds a database-layout page with a matching database entry", async () => {
      const user = userEvent.setup();
      workspaceMocks.loadWorkspace.mockReturnValue(
        snapshot({ pages: [page({ id: "page-a", title: "A" })] }),
      );

      render(
        <WorkspaceProvider>
          <TreeConsumer targetId={null} />
        </WorkspaceProvider>,
      );

      await user.click(screen.getByRole("button", { name: "createDbChild" }));

      const pages = getPages();
      const dbPage = pages.find((p) => p.id !== "page-a")!;
      expect(dbPage.layout).toBe("database");
      expect(dbPage.parentId).toBeNull();
      expect(dbPage.databaseId).not.toBeNull();

      const databases = getDatabases();
      expect(databases).toHaveLength(1);
      expect(databases[0].id).toBe(dbPage.databaseId);
    });

    it("updatePageTitle trims whitespace and defaults an empty title to 'Untitled'", async () => {
      const user = userEvent.setup();
      workspaceMocks.loadWorkspace.mockReturnValue(
        snapshot({ pages: [page({ id: "page-a", title: "A" })] }),
      );

      render(
        <WorkspaceProvider>
          <TreeConsumer targetId="page-a" />
        </WorkspaceProvider>,
      );

      await user.click(screen.getByRole("button", { name: "rename" }));
      expect(getPages()[0].title).toBe("New Title");

      await user.click(screen.getByRole("button", { name: "blankRename" }));
      expect(getPages()[0].title).toBe("Untitled");
    });

    it("updatePageTitle cascades to a page's linked database title", async () => {
      const user = userEvent.setup();
      workspaceMocks.loadWorkspace.mockReturnValue(
        snapshot({
          pages: [page({ id: "page-a", title: "A", layout: "database", databaseId: "db-1" })],
          databases: [{ id: "db-1", title: "A", properties: [], rows: [], views: [] }],
        }),
      );

      render(
        <WorkspaceProvider>
          <TreeConsumer targetId="page-a" />
        </WorkspaceProvider>,
      );

      await user.click(screen.getByRole("button", { name: "rename" }));

      expect(getDatabases()[0].title).toBe("New Title");
    });

    it("updatePageBlocks replaces a page's blocks", async () => {
      const user = userEvent.setup();
      workspaceMocks.loadWorkspace.mockReturnValue(
        snapshot({ pages: [page({ id: "page-a", title: "A" })] }),
      );

      render(
        <WorkspaceProvider>
          <TreeConsumer targetId="page-a" />
        </WorkspaceProvider>,
      );

      await user.click(screen.getByRole("button", { name: "setBlocks" }));

      expect(getPages()[0].blocks).toEqual([paragraph("new-block")]);
    });
  });

  describe("page moves and deletion", () => {
    it("movePageWithinSiblings swaps order with the previous sibling on 'up'", async () => {
      const user = userEvent.setup();
      workspaceMocks.loadWorkspace.mockReturnValue(
        snapshot({
          pages: [
            page({ id: "page-a", title: "A", order: 0 }),
            page({ id: "page-b", title: "B", order: 1 }),
          ],
        }),
      );

      render(
        <WorkspaceProvider>
          <TreeConsumer targetId="page-b" />
        </WorkspaceProvider>,
      );

      await user.click(screen.getByRole("button", { name: "moveUp" }));

      const pages = getPages();
      expect(pages.find((p) => p.id === "page-a")!.order).toBe(1);
      expect(pages.find((p) => p.id === "page-b")!.order).toBe(0);
    });

    it("movePageWithinSiblings is a no-op at the first position", async () => {
      const user = userEvent.setup();
      workspaceMocks.loadWorkspace.mockReturnValue(
        snapshot({
          pages: [
            page({ id: "page-a", title: "A", order: 0 }),
            page({ id: "page-b", title: "B", order: 1 }),
          ],
        }),
      );

      render(
        <WorkspaceProvider>
          <TreeConsumer targetId="page-a" />
        </WorkspaceProvider>,
      );

      await user.click(screen.getByRole("button", { name: "moveUp" }));

      const pages = getPages();
      expect(pages.find((p) => p.id === "page-a")!.order).toBe(0);
      expect(pages.find((p) => p.id === "page-b")!.order).toBe(1);
    });

    it("movePageWithinSiblings is a no-op at the last position on 'down'", async () => {
      const user = userEvent.setup();
      workspaceMocks.loadWorkspace.mockReturnValue(
        snapshot({
          pages: [
            page({ id: "page-a", title: "A", order: 0 }),
            page({ id: "page-b", title: "B", order: 1 }),
          ],
        }),
      );

      render(
        <WorkspaceProvider>
          <TreeConsumer targetId="page-b" />
        </WorkspaceProvider>,
      );

      await user.click(screen.getByRole("button", { name: "moveDown" }));

      const pages = getPages();
      expect(pages.find((p) => p.id === "page-a")!.order).toBe(0);
      expect(pages.find((p) => p.id === "page-b")!.order).toBe(1);
    });

    it("movePageWithinSiblings is a no-op for an unknown page id", async () => {
      const user = userEvent.setup();
      workspaceMocks.loadWorkspace.mockReturnValue(
        snapshot({ pages: [page({ id: "page-a", title: "A", order: 0 })] }),
      );

      render(
        <WorkspaceProvider>
          <TreeConsumer targetId="missing" />
        </WorkspaceProvider>,
      );

      await user.click(screen.getByRole("button", { name: "moveUp" }));

      expect(getPages()).toHaveLength(1);
      expect(getPages()[0].order).toBe(0);
    });

    it("deletePageSubtree removes the target and its descendants, falling back to the parent", async () => {
      const user = userEvent.setup();
      workspaceMocks.loadWorkspace.mockReturnValue(
        snapshot({
          homePageId: "root",
          lastOpenedPageId: "child",
          pages: [
            page({ id: "root", title: "Root" }),
            page({ id: "target", title: "Target", parentId: "root" }),
            page({ id: "child", title: "Child", parentId: "target" }),
          ],
        }),
      );

      render(
        <WorkspaceProvider>
          <TreeConsumer targetId="target" />
        </WorkspaceProvider>,
      );

      await user.click(screen.getByRole("button", { name: "deleteSubtree" }));

      const pages = getPages();
      expect(pages.map((p) => p.id)).toEqual(["root"]);
      expect(screen.getByTestId("lastOpened")).toHaveTextContent("root");
    });

    it("deletePageSubtree falls back to a remaining root when the parent is also removed", async () => {
      const user = userEvent.setup();
      workspaceMocks.loadWorkspace.mockReturnValue(
        snapshot({
          homePageId: "target",
          pages: [
            page({ id: "target", title: "Target" }),
            page({ id: "child", title: "Child", parentId: "target" }),
            page({ id: "other-root", title: "Other", order: 1 }),
          ],
        }),
      );

      render(
        <WorkspaceProvider>
          <TreeConsumer targetId="target" />
        </WorkspaceProvider>,
      );

      await user.click(screen.getByRole("button", { name: "deleteSubtree" }));

      expect(getPages().map((p) => p.id)).toEqual(["other-root"]);
      expect(screen.getByTestId("home")).toHaveTextContent("other-root");
    });

    it("deletePageSubtree clears databaseEmbed blocks pointing at a removed database and drops it", async () => {
      const user = userEvent.setup();
      const embedBlock: Block = {
        id: "embed-1",
        type: "databaseEmbed",
        content: stringifyDatabaseEmbedPayload("db-1"),
      };
      workspaceMocks.loadWorkspace.mockReturnValue(
        snapshot({
          pages: [
            page({ id: "root", title: "Root" }),
            page({
              id: "target",
              title: "Target",
              parentId: "root",
              layout: "database",
              databaseId: "db-1",
            }),
            page({ id: "other", title: "Other", parentId: "root", order: 1, blocks: [embedBlock] }),
          ],
          databases: [{ id: "db-1", title: "Target", properties: [], rows: [], views: [] }],
        }),
      );

      render(
        <WorkspaceProvider>
          <TreeConsumer targetId="target" />
        </WorkspaceProvider>,
      );

      await user.click(screen.getByRole("button", { name: "deleteSubtree" }));

      expect(getDatabases()).toHaveLength(0);
      const other = getPages().find((p) => p.id === "other")!;
      expect(other.blocks).toEqual([{ id: "embed-1", type: "paragraph", content: "<p></p>" }]);
    });

    it("ancestryFor returns the chain from root to the given page", () => {
      workspaceMocks.loadWorkspace.mockReturnValue(
        snapshot({
          pages: [
            page({ id: "root", title: "Root" }),
            page({ id: "mid", title: "Mid", parentId: "root" }),
            page({ id: "leaf", title: "Leaf", parentId: "mid" }),
          ],
        }),
      );

      render(
        <WorkspaceProvider>
          <TreeConsumer targetId={null} ancestryId="leaf" />
        </WorkspaceProvider>,
      );

      expect(JSON.parse(screen.getByTestId("ancestry").textContent ?? "[]")).toEqual([
        "root",
        "mid",
        "leaf",
      ]);
    });

    it("childrenOf returns the direct children of the given parent, ordered", () => {
      workspaceMocks.loadWorkspace.mockReturnValue(
        snapshot({
          pages: [
            page({ id: "root", title: "Root" }),
            page({ id: "b", title: "B", parentId: "root", order: 1 }),
            page({ id: "a", title: "A", parentId: "root", order: 0 }),
          ],
        }),
      );

      render(
        <WorkspaceProvider>
          <TreeConsumer targetId={null} childrenParentId="root" />
        </WorkspaceProvider>,
      );

      expect(JSON.parse(screen.getByTestId("children").textContent ?? "[]")).toEqual(["a", "b"]);
    });
  });
});
