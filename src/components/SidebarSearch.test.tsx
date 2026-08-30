import { render, screen, fireEvent } from "@testing-library/react";
import { act } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceContext, type WorkspaceContextValue } from "../context/workspace-context";

const mocks = vi.hoisted(() => ({
  isAiServiceConfigured: vi.fn(() => true),
  searchNotes: vi.fn(),
}));

vi.mock("../lib/aiClient", () => ({
  isAiServiceConfigured: mocks.isAiServiceConfigured,
  searchNotes: mocks.searchNotes,
}));

function createMockWorkspaceValue(
  overrides: Partial<WorkspaceContextValue> = {},
): WorkspaceContextValue {
  const base: WorkspaceContextValue = {
    pages: [],
    databases: [],
    homePageId: "home",
    lastOpenedPageId: null,
    externalWorkspaceRevision: 0,
    remoteSyncStatus: "disabled",
    remoteSyncError: null,
    getPage: vi.fn(() => undefined),
    getDatabase: vi.fn(),
    setLastOpenedPageId: vi.fn(),
    resolveOpenPageId: vi.fn(() => "home"),
    updatePageTitle: vi.fn(),
    updatePageBlocks: vi.fn(),
    updateDatabase: vi.fn(),
    createPage: vi.fn(),
    createDatabasePage: vi.fn(),
    deletePageSubtree: vi.fn(),
    movePageWithinSiblings: vi.fn(),
    ancestryFor: vi.fn(),
    childrenOf: vi.fn(),
  };
  return { ...base, ...overrides };
}

async function loadComponent() {
  return (await import("./SidebarSearch")).default;
}

describe("SidebarSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mocks.isAiServiceConfigured.mockReset().mockReturnValue(true);
    mocks.searchNotes.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not reset or double-fire the debounce when getPage's identity changes mid-debounce", async () => {
    mocks.searchNotes.mockResolvedValue({ matches: [] });
    const SidebarSearch = await loadComponent();
    const value = createMockWorkspaceValue();

    const { rerender } = render(
      <MemoryRouter>
        <WorkspaceContext.Provider value={value}>
          <SidebarSearch />
        </WorkspaceContext.Provider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Search notes"), { target: { value: "hello" } });

    // Simulate an edit elsewhere in the workspace changing getPage's identity
    // mid-debounce (WorkspaceContext gives getPage a new reference on every commit).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    const nextValue = createMockWorkspaceValue({ getPage: vi.fn(() => undefined) });
    rerender(
      <MemoryRouter>
        <WorkspaceContext.Provider value={nextValue}>
          <SidebarSearch />
        </WorkspaceContext.Provider>
      </MemoryRouter>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(mocks.searchNotes).toHaveBeenCalledTimes(1);
    expect(mocks.searchNotes).toHaveBeenCalledWith("hello");
  });

  it("does not let a stale, slower response overwrite a newer query's results", async () => {
    let resolveFirst: (value: { matches: [] }) => void = () => {};
    const firstCall = new Promise<{ matches: [] }>((resolve) => {
      resolveFirst = resolve;
    });
    mocks.searchNotes.mockImplementationOnce(() => firstCall);
    mocks.searchNotes.mockResolvedValueOnce({
      matches: [{ pageId: "p2", blockId: "b2", similarity: 0.9 }],
    });

    const SidebarSearch = await loadComponent();
    const value = createMockWorkspaceValue({
      getPage: vi.fn((id: string) =>
        id === "p2" ? ({ id: "p2", title: "Second Page", blocks: [] } as never) : undefined,
      ),
    });

    render(
      <MemoryRouter>
        <WorkspaceContext.Provider value={value}>
          <SidebarSearch />
        </WorkspaceContext.Provider>
      </MemoryRouter>,
    );

    const input = screen.getByLabelText("Search notes");
    fireEvent.change(input, { target: { value: "first" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    fireEvent.change(input, { target: { value: "second" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    // Second (faster) request resolves first.
    expect(await screen.findByText("Second Page")).toBeInTheDocument();

    // Now the stale first request resolves — it must not clobber the current results.
    await act(async () => {
      resolveFirst({ matches: [] });
    });

    expect(screen.getByText("Second Page")).toBeInTheDocument();
  });
});
