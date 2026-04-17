import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceContext, type WorkspaceContextValue } from "../context/workspace-context";
import HomeRedirect from "./HomeRedirect";

function createMockWorkspaceValue(
  overrides: Partial<WorkspaceContextValue> = {}
): WorkspaceContextValue {
  const base: WorkspaceContextValue = {
    pages: [],
    databases: [],
    homePageId: "home",
    lastOpenedPageId: null,
    externalWorkspaceRevision: 0,
    remoteSyncStatus: "disabled",
    remoteSyncError: null,
    getPage: vi.fn(),
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
    flushRemoteWorkspace: vi.fn(async () => {}),
  };
  return { ...base, ...overrides };
}

function PageTarget() {
  const { id } = useParams();
  return <div>page:{id}</div>;
}

describe("HomeRedirect", () => {
  it("navigates to /page/<id> from resolveOpenPageId()", async () => {
    const value = createMockWorkspaceValue({
      resolveOpenPageId: vi.fn(() => "my-open-page"),
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <WorkspaceContext.Provider value={value}>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/page/:id" element={<PageTarget />} />
          </Routes>
        </WorkspaceContext.Provider>
      </MemoryRouter>
    );

    expect(await screen.findByText("page:my-open-page")).toBeInTheDocument();
    expect(value.resolveOpenPageId).toHaveBeenCalled();
  });
});
