import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import type { Block } from "../types/block";
import type { Page, WorkspaceSnapshot } from "../types/page";
import { STORAGE_KEY } from "../lib/workspaceStorage";
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
      </WorkspaceProvider>
    );

    expect(screen.getByTestId("home")).toHaveTextContent("page-a");
    expect(screen.getByTestId("revision")).toHaveTextContent("0");

    await act(async () => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STORAGE_KEY,
          newValue: JSON.stringify(snap2),
        })
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
        pages: [
          page({ id: "page-a", title: "A" }),
          page({ id: "page-b", title: "B", order: 1 }),
        ],
      })
    );

    render(
      <WorkspaceProvider>
        <OpenPageConsumer />
      </WorkspaceProvider>
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
        </WorkspaceProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("sync")).toHaveTextContent("error");
      });
      expect(screen.getByTestId("sync-err")).toHaveTextContent("anon failed");
    });
  });
});
