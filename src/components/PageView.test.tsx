import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceContext, type WorkspaceContextValue } from "../context/workspace-context";
import type { Page } from "../types/page";
import PageView from "./PageView";

vi.mock("./Editor", () => ({ default: () => <div data-testid="editor" /> }));
const chromeMounts = vi.hoisted(() => ({ count: 0 }));

vi.mock("./PageChrome", async () => {
  const { useEffect } = await import("react");
  return {
    default: function PageChromeMock() {
      useEffect(() => {
        chromeMounts.count += 1;
      }, []);
      return <div data-testid="chrome" />;
    },
  };
});
vi.mock("./DatabaseCanvas", () => ({ default: () => <div data-testid="database" /> }));
vi.mock("./RelatedPagesSection", () => ({ default: () => null }));
vi.mock("../hooks/usePageIndexing", () => ({ usePageIndexing: vi.fn() }));
vi.mock("../lib/aiClient", () => ({
  isAiServiceConfigured: () => false,
  summarizePage: vi.fn(),
}));

const page = (id: string): Page => ({
  id,
  title: id,
  parentId: null,
  order: 0,
  updatedAt: "2020-01-01T00:00:00.000Z",
  layout: "document",
  databaseId: null,
  blocks: [{ id: `b-${id}`, type: "paragraph", content: "<p>x</p>" }],
});

/** `getPage` returns a fresh object on every call, as it does after each workspace update. */
function createMockWorkspaceValue(
  setLastOpenedPageId: WorkspaceContextValue["setLastOpenedPageId"],
  title?: string,
): WorkspaceContextValue {
  return {
    pages: [],
    databases: [],
    homePageId: "p1",
    lastOpenedPageId: null,
    externalWorkspaceRevision: 0,
    remoteSyncStatus: "disabled",
    remoteSyncError: null,
    getPage: (id: string) => ({ ...page(id), title: title ?? id }),
    getDatabase: vi.fn(),
    setLastOpenedPageId,
    resolveOpenPageId: vi.fn(() => "p1"),
    updatePageTitle: vi.fn(),
    updatePageBlocks: vi.fn(),
    updateDatabase: vi.fn(),
    createPage: vi.fn(),
    createDatabasePage: vi.fn(),
    deletePageSubtree: vi.fn(),
    movePageWithinSiblings: vi.fn(),
    ancestryFor: vi.fn(() => []),
    childrenOf: vi.fn(() => []),
  };
}

function GoToSecondPage() {
  const navigate = useNavigate();
  return <button onClick={() => navigate("/page/p2")}>go</button>;
}

function tree(value: WorkspaceContextValue) {
  return (
    <MemoryRouter initialEntries={["/page/p1"]}>
      <WorkspaceContext.Provider value={value}>
        <GoToSecondPage />
        <Routes>
          <Route path="/page/:pageId" element={<PageView />} />
        </Routes>
      </WorkspaceContext.Provider>
    </MemoryRouter>
  );
}

describe("PageView", () => {
  beforeEach(() => {
    chromeMounts.count = 0;
  });

  it("records the page as last opened when it is shown", () => {
    const setLastOpenedPageId = vi.fn();
    render(tree(createMockWorkspaceValue(setLastOpenedPageId)));

    expect(screen.getByTestId("editor")).toBeInTheDocument();
    expect(setLastOpenedPageId).toHaveBeenCalledTimes(1);
    expect(setLastOpenedPageId).toHaveBeenCalledWith("p1");
  });

  // Regression: the effect used to depend on the page object, which is replaced on every workspace
  // update. A tab that received another tab's change re-saved its own copy, and that stale write
  // overwrote what the other tab had typed since.
  it("does not record it again when the same page arrives as a new object", () => {
    const setLastOpenedPageId = vi.fn();
    const { rerender } = render(tree(createMockWorkspaceValue(setLastOpenedPageId)));

    rerender(tree(createMockWorkspaceValue(setLastOpenedPageId)));
    rerender(tree(createMockWorkspaceValue(setLastOpenedPageId)));

    expect(setLastOpenedPageId).toHaveBeenCalledTimes(1);
  });

  it("records the new page when the user opens a different one", async () => {
    const user = userEvent.setup();
    const setLastOpenedPageId = vi.fn();
    render(tree(createMockWorkspaceValue(setLastOpenedPageId)));

    await user.click(screen.getByRole("button", { name: "go" }));

    expect(setLastOpenedPageId).toHaveBeenCalledTimes(2);
    expect(setLastOpenedPageId).toHaveBeenLastCalledWith("p2");
  });

  // Regression: the page chrome was keyed on the title too, so a rename remounted it and threw
  // away an open summary panel and any export in progress.
  it("keeps the page chrome mounted when the page is renamed", () => {
    const setLastOpenedPageId = vi.fn();
    const { rerender } = render(tree(createMockWorkspaceValue(setLastOpenedPageId)));
    expect(chromeMounts.count).toBe(1);

    rerender(tree(createMockWorkspaceValue(setLastOpenedPageId, "Renamed")));

    expect(chromeMounts.count).toBe(1);
  });

  it("mounts a fresh page chrome when the user opens a different page", async () => {
    const user = userEvent.setup();
    render(tree(createMockWorkspaceValue(vi.fn())));
    expect(chromeMounts.count).toBe(1);

    await user.click(screen.getByRole("button", { name: "go" }));

    expect(chromeMounts.count).toBe(2);
  });
});
