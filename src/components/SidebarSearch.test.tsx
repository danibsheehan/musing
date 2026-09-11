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

  it("dedupes matches for the same page keeping the highest similarity, sorts by similarity, falls back to 'Untitled' for an unknown page, and truncates a long snippet", async () => {
    const longText = "A".repeat(90);
    mocks.searchNotes.mockResolvedValue({
      matches: [
        { pageId: "p1", blockId: "b1", similarity: 0.5 },
        { pageId: "p1", blockId: "b2", similarity: 0.9 },
        { pageId: "p1", blockId: "b3", similarity: 0.3 },
        { pageId: "p2", blockId: "b4", similarity: 0.6 },
        { pageId: "p3", blockId: "b-match", similarity: 0.7 },
      ],
    });

    const SidebarSearch = await loadComponent();
    const value = createMockWorkspaceValue({
      getPage: vi.fn((id: string) => {
        if (id === "p1") return { id: "p1", title: "Page One", blocks: [] } as never;
        if (id === "p3") {
          return {
            id: "p3",
            title: "Page Three",
            blocks: [{ id: "b-match", type: "paragraph", content: `<p>${longText}</p>` }],
          } as never;
        }
        return undefined;
      }),
    });

    render(
      <MemoryRouter>
        <WorkspaceContext.Provider value={value}>
          <SidebarSearch />
        </WorkspaceContext.Provider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Search notes"), { target: { value: "hello" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(3);

    expect(screen.getByText("Page One")).toBeInTheDocument();
    expect(screen.getByText("Untitled")).toBeInTheDocument();
    expect(screen.getByText("Page Three")).toBeInTheDocument();
    expect(screen.getByText(`${"A".repeat(80)}…`)).toBeInTheDocument();

    const untitledOption = screen.getByText("Untitled").closest("button");
    expect(untitledOption?.querySelector(".sidebar-search-result-snippet")).toBeNull();
  });

  it("closes the results panel on an outside click and reopens it on focus", async () => {
    mocks.searchNotes.mockResolvedValue({ matches: [] });
    const SidebarSearch = await loadComponent();
    const value = createMockWorkspaceValue();

    render(
      <MemoryRouter>
        <WorkspaceContext.Provider value={value}>
          <SidebarSearch />
        </WorkspaceContext.Provider>
      </MemoryRouter>,
    );

    const input = screen.getByLabelText("Search notes");

    // Focusing before any search has run does nothing (no results yet).
    fireEvent.focus(input);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "hello" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(await screen.findByRole("listbox")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    fireEvent.focus(input);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("closes the results panel and blurs the input on Escape, but not on other keys", async () => {
    mocks.searchNotes.mockResolvedValue({ matches: [] });
    const SidebarSearch = await loadComponent();
    const value = createMockWorkspaceValue();

    render(
      <MemoryRouter>
        <WorkspaceContext.Provider value={value}>
          <SidebarSearch />
        </WorkspaceContext.Provider>
      </MemoryRouter>,
    );

    const input = screen.getByLabelText("Search notes");
    fireEvent.change(input, { target: { value: "hello" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(await screen.findByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "a" });
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(document.activeElement).not.toBe(input);
  });

  it("shows an empty state and logs an error when the search request rejects", async () => {
    mocks.searchNotes.mockRejectedValueOnce(new Error("boom"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const SidebarSearch = await loadComponent();
    const value = createMockWorkspaceValue();

    render(
      <MemoryRouter>
        <WorkspaceContext.Provider value={value}>
          <SidebarSearch />
        </WorkspaceContext.Provider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Search notes"), { target: { value: "hello" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(await screen.findByText("No matches.")).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith("Search failed", expect.any(Error));

    consoleError.mockRestore();
  });

  it("ignores a rejected search response once the query has changed", async () => {
    let rejectFirst: (err: unknown) => void = () => {};
    const firstCall = new Promise<{ matches: [] }>((_resolve, reject) => {
      rejectFirst = reject;
    });
    mocks.searchNotes.mockImplementationOnce(() => firstCall);
    mocks.searchNotes.mockResolvedValueOnce({ matches: [] });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const SidebarSearch = await loadComponent();
    const value = createMockWorkspaceValue();

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

    // Changing the query before the first request settles cancels it.
    fireEvent.change(input, { target: { value: "second" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(await screen.findByText("No matches.")).toBeInTheDocument();

    await act(async () => {
      rejectFirst(new Error("stale"));
    });

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
