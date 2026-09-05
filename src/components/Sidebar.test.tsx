import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { Page } from "../types/page";
import { WorkspaceContext, type WorkspaceContextValue } from "../context/workspace-context";
import { siblingsOf, ancestryChain } from "../lib/workspaceTree";
import Sidebar from "./Sidebar";

const page = (overrides: Partial<Page> = {}): Page => ({
  id: "page-a",
  title: "Alpha",
  parentId: null,
  order: 0,
  updatedAt: "",
  layout: "document",
  databaseId: null,
  blocks: [],
  ...overrides,
});

function createMockWorkspaceValue(
  pages: Page[],
  overrides: Partial<WorkspaceContextValue> = {},
): WorkspaceContextValue {
  return {
    pages,
    databases: [],
    homePageId: pages[0]?.id ?? "home",
    lastOpenedPageId: null,
    externalWorkspaceRevision: 0,
    remoteSyncStatus: "disabled",
    remoteSyncError: null,
    getPage: vi.fn((id: string) => pages.find((p) => p.id === id)),
    getDatabase: vi.fn(),
    setLastOpenedPageId: vi.fn(),
    resolveOpenPageId: vi.fn(() => pages[0]?.id ?? "home"),
    updatePageTitle: vi.fn(),
    updatePageBlocks: vi.fn(),
    updateDatabase: vi.fn(),
    createPage: vi.fn(() => "new-page-id"),
    createDatabasePage: vi.fn(() => "new-db-page-id"),
    deletePageSubtree: vi.fn(() => ({ removedIds: new Set<string>(), fallbackPageId: null })),
    movePageWithinSiblings: vi.fn(),
    ancestryFor: vi.fn((id: string) => ancestryChain(pages, id)),
    childrenOf: vi.fn((parentId: string | null) => siblingsOf(pages, parentId)),
    ...overrides,
  };
}

function RouteMarker() {
  const { pageId } = useParams<{ pageId: string }>();
  return <span data-testid="route">page:{pageId}</span>;
}

function renderSidebar(value: WorkspaceContextValue, initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <WorkspaceContext.Provider value={value}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <Sidebar />
                <span data-testid="route">home</span>
              </>
            }
          />
          <Route
            path="/page/:pageId"
            element={
              <>
                <Sidebar />
                <RouteMarker />
              </>
            }
          />
        </Routes>
      </WorkspaceContext.Provider>
    </MemoryRouter>,
  );
}

describe("Sidebar", () => {
  it("renders root pages and their nested children", () => {
    const pages = [
      page({ id: "root", title: "Root" }),
      page({ id: "child", title: "Child", parentId: "root" }),
    ];
    renderSidebar(createMockWorkspaceValue(pages));

    expect(screen.getByRole("link", { name: "Root" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Child" })).toBeInTheDocument();
  });

  it("shows a database icon prefix and falls back to 'Untitled' for an empty title", () => {
    const pages = [page({ id: "db1", title: "", layout: "database" })];
    renderSidebar(createMockWorkspaceValue(pages));

    expect(screen.getByRole("link", { name: "▦ Untitled" })).toBeInTheDocument();
  });

  it("marks the page matching the current route as active", () => {
    const pages = [page({ id: "a", title: "A" }), page({ id: "b", title: "B", order: 1 })];
    renderSidebar(createMockWorkspaceValue(pages), "/page/a");

    expect(screen.getByRole("link", { name: "A" })).toHaveClass("sidebar-link-active");
    expect(screen.getByRole("link", { name: "B" })).not.toHaveClass("sidebar-link-active");
  });

  describe("moving siblings", () => {
    it("disables move-up for the first sibling and move-down for the last", () => {
      const pages = [
        page({ id: "a", title: "A", order: 0 }),
        page({ id: "b", title: "B", order: 1 }),
        page({ id: "c", title: "C", order: 2 }),
      ];
      renderSidebar(createMockWorkspaceValue(pages));

      const rows = screen.getAllByRole("listitem");
      expect(within(rows[0]).getByRole("button", { name: "Move up" })).toBeDisabled();
      expect(within(rows[0]).getByRole("button", { name: "Move down" })).toBeEnabled();
      expect(within(rows[2]).getByRole("button", { name: "Move up" })).toBeEnabled();
      expect(within(rows[2]).getByRole("button", { name: "Move down" })).toBeDisabled();
    });

    it("calls movePageWithinSiblings when an enabled move button is clicked", async () => {
      const user = userEvent.setup();
      const pages = [
        page({ id: "a", title: "A", order: 0 }),
        page({ id: "b", title: "B", order: 1 }),
      ];
      const value = createMockWorkspaceValue(pages);
      renderSidebar(value);

      const rows = screen.getAllByRole("listitem");
      await user.click(within(rows[1]).getByRole("button", { name: "Move up" }));

      expect(value.movePageWithinSiblings).toHaveBeenCalledWith("b", "up");
    });
  });

  describe("renaming", () => {
    it("commits a trimmed title on blur and falls back to 'Untitled' when blank", () => {
      const pages = [page({ id: "page-a", title: "Alpha" })];
      const value = createMockWorkspaceValue(pages);
      renderSidebar(value);

      fireEvent.click(screen.getByRole("button", { name: "Rename" }));
      const input = screen.getByLabelText("Rename page");
      expect(input).toHaveValue("Alpha");

      fireEvent.change(input, { target: { value: "  New Name  " } });
      fireEvent.blur(input);
      expect(value.updatePageTitle).toHaveBeenCalledWith("page-a", "New Name");

      fireEvent.click(screen.getByRole("button", { name: "Rename" }));
      fireEvent.change(screen.getByLabelText("Rename page"), { target: { value: "   " } });
      fireEvent.blur(screen.getByLabelText("Rename page"));
      expect(value.updatePageTitle).toHaveBeenCalledWith("page-a", "Untitled");
    });

    it("cancels renaming on Escape without requiring a further commit", () => {
      const pages = [page({ id: "page-a", title: "Alpha" })];
      renderSidebar(createMockWorkspaceValue(pages));

      fireEvent.click(screen.getByRole("button", { name: "Rename" }));
      const input = screen.getByLabelText("Rename page");
      fireEvent.change(input, { target: { value: "Changed" } });
      fireEvent.keyDown(input, { key: "Escape" });

      expect(screen.getByRole("link", { name: "Alpha" })).toBeInTheDocument();
    });
  });

  describe("creating pages", () => {
    it("adding a subpage navigates to the newly created page", async () => {
      const user = userEvent.setup();
      const pages = [page({ id: "root", title: "Root" })];
      renderSidebar(createMockWorkspaceValue(pages));

      await user.click(screen.getByRole("button", { name: "Add subpage" }));

      expect(screen.getByTestId("route")).toHaveTextContent("page:new-page-id");
    });

    it("the 'New' menu's Page option creates a root page and navigates to it", async () => {
      const user = userEvent.setup();
      const value = createMockWorkspaceValue([]);
      renderSidebar(value);

      await user.click(screen.getByRole("button", { name: /^Page/ }));

      expect(value.createPage).toHaveBeenCalledWith(null);
      expect(screen.getByTestId("route")).toHaveTextContent("page:new-page-id");
    });

    it("the 'New' menu's Table option creates a database page and navigates to it", async () => {
      const user = userEvent.setup();
      const value = createMockWorkspaceValue([]);
      renderSidebar(value);

      await user.click(screen.getByRole("button", { name: /^Table/ }));

      expect(value.createDatabasePage).toHaveBeenCalledWith(null);
      expect(screen.getByTestId("route")).toHaveTextContent("page:new-db-page-id");
    });
  });

  describe("deleting pages", () => {
    it("alerts instead of deleting when it is the only remaining page", async () => {
      const user = userEvent.setup();
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
      const pages = [page({ id: "only", title: "Only" })];
      const value = createMockWorkspaceValue(pages);
      renderSidebar(value);

      await user.click(screen.getByRole("button", { name: "Delete page" }));

      expect(alertSpy).toHaveBeenCalledWith("You can't delete the last page.");
      expect(value.deletePageSubtree).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });

    it("does not delete when the confirmation is declined", async () => {
      const user = userEvent.setup();
      vi.spyOn(window, "confirm").mockReturnValue(false);
      const pages = [page({ id: "a", title: "A" }), page({ id: "b", title: "B", order: 1 })];
      const value = createMockWorkspaceValue(pages);
      renderSidebar(value);

      const rows = screen.getAllByRole("listitem");
      await user.click(within(rows[0]).getByRole("button", { name: "Delete page" }));

      expect(value.deletePageSubtree).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it("navigates to the fallback page when deleting the currently open page", async () => {
      const user = userEvent.setup();
      vi.spyOn(window, "confirm").mockReturnValue(true);
      const pages = [
        page({ id: "root", title: "Root" }),
        page({ id: "target", title: "Target", parentId: "root" }),
      ];
      const value = createMockWorkspaceValue(pages, {
        deletePageSubtree: vi.fn(() => ({
          removedIds: new Set(["target"]),
          fallbackPageId: "root",
        })),
      });
      renderSidebar(value, "/page/target");

      const rows = screen.getAllByRole("listitem");
      await user.click(within(rows[1]).getByRole("button", { name: "Delete page" }));

      expect(value.deletePageSubtree).toHaveBeenCalledWith("target");
      expect(screen.getByTestId("route")).toHaveTextContent("page:root");
      vi.restoreAllMocks();
    });

    it("navigates home when deleting the currently open page leaves no fallback", async () => {
      const user = userEvent.setup();
      vi.spyOn(window, "confirm").mockReturnValue(true);
      const pages = [
        page({ id: "target", title: "Target" }),
        page({ id: "other", title: "Other", order: 1 }),
      ];
      const value = createMockWorkspaceValue(pages, {
        deletePageSubtree: vi.fn(() => ({
          removedIds: new Set(["target"]),
          fallbackPageId: null,
        })),
      });
      renderSidebar(value, "/page/target");

      const rows = screen.getAllByRole("listitem");
      await user.click(within(rows[0]).getByRole("button", { name: "Delete page" }));

      expect(screen.getByTestId("route")).toHaveTextContent("home");
      vi.restoreAllMocks();
    });

    it("does not navigate when deleting a page other than the currently open one", async () => {
      const user = userEvent.setup();
      vi.spyOn(window, "confirm").mockReturnValue(true);
      const pages = [page({ id: "a", title: "A" }), page({ id: "b", title: "B", order: 1 })];
      const value = createMockWorkspaceValue(pages);
      renderSidebar(value, "/page/a");

      const rows = screen.getAllByRole("listitem");
      await user.click(within(rows[1]).getByRole("button", { name: "Delete page" }));

      expect(value.deletePageSubtree).toHaveBeenCalledWith("b");
      expect(screen.getByTestId("route")).toHaveTextContent("page:a");
      vi.restoreAllMocks();
    });
  });
});
