import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { WorkspaceContext, type WorkspaceContextValue } from "../context/workspace-context";
import { isAiServiceConfigured, relatedPages, type RelatedPagesResult } from "../lib/aiClient";
import RelatedPagesSection from "./RelatedPagesSection";

vi.mock("../lib/aiClient", () => ({
  isAiServiceConfigured: vi.fn(),
  relatedPages: vi.fn(),
}));

function createMockWorkspaceValue(
  overrides: Partial<WorkspaceContextValue> = {},
): WorkspaceContextValue {
  return {
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
    ...overrides,
  };
}

function renderSection(value: WorkspaceContextValue) {
  return render(
    <MemoryRouter>
      <WorkspaceContext.Provider value={value}>
        <RelatedPagesSection pageId="page-a" />
      </WorkspaceContext.Provider>
    </MemoryRouter>,
  );
}

describe("RelatedPagesSection", () => {
  beforeEach(() => {
    vi.mocked(isAiServiceConfigured).mockReset();
    vi.mocked(relatedPages).mockReset();
  });

  it("renders nothing when the AI service is not configured", () => {
    vi.mocked(isAiServiceConfigured).mockReturnValue(false);
    const { container } = renderSection(createMockWorkspaceValue());
    expect(container).toBeEmptyDOMElement();
  });

  it("renders related page links with titles, falling back to 'Untitled'", async () => {
    vi.mocked(isAiServiceConfigured).mockReturnValue(true);
    vi.mocked(relatedPages).mockResolvedValue({
      related: [
        { pageId: "p1", similarity: 0.9 },
        { pageId: "p2", similarity: 0.5 },
      ],
    });
    const getPage = vi.fn((id: string) =>
      id === "p1" ? ({ id: "p1", title: "Roadmap" } as never) : undefined,
    );

    renderSection(createMockWorkspaceValue({ getPage }));

    expect(await screen.findByText("Related (2)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Roadmap" })).toHaveAttribute("href", "/page/p1");
    expect(screen.getByRole("link", { name: "Untitled" })).toHaveAttribute("href", "/page/p2");
  });

  it("shows an empty message when there are no related pages", async () => {
    vi.mocked(isAiServiceConfigured).mockReturnValue(true);
    vi.mocked(relatedPages).mockResolvedValue({ related: [] });

    renderSection(createMockWorkspaceValue());

    expect(await screen.findByText("No related pages yet.")).toBeInTheDocument();
  });

  it("shows an error message when loading related pages fails", async () => {
    vi.mocked(isAiServiceConfigured).mockReturnValue(true);
    vi.mocked(relatedPages).mockRejectedValue(new Error("boom"));

    renderSection(createMockWorkspaceValue());

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load related pages.");
  });

  it("ignores a successful response that resolves after the component unmounts", async () => {
    vi.mocked(isAiServiceConfigured).mockReturnValue(true);
    let resolveRelatedPages: (result: RelatedPagesResult) => void;
    vi.mocked(relatedPages).mockReturnValue(
      new Promise((resolve) => {
        resolveRelatedPages = resolve;
      }),
    );

    const { unmount } = renderSection(createMockWorkspaceValue());
    unmount();

    resolveRelatedPages!({ related: [] });
    await Promise.resolve();
  });

  it("ignores a rejection that arrives after the component unmounts", async () => {
    vi.mocked(isAiServiceConfigured).mockReturnValue(true);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let rejectRelatedPages: (reason: unknown) => void;
    vi.mocked(relatedPages).mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectRelatedPages = reject;
      }),
    );

    const { unmount } = renderSection(createMockWorkspaceValue());
    unmount();

    const error = new Error("boom");
    rejectRelatedPages!(error);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to load related pages", error);
    consoleErrorSpy.mockRestore();
  });
});
