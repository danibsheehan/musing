import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NodeViewProps } from "@tiptap/react";
import type { Page } from "../types/page";
import type { WorkspaceDatabase } from "../types/database";
import { stringifyDatabaseEmbedPayload } from "../lib/databaseEmbed";
import { useWorkspace } from "../context/useWorkspace";
import DatabaseEmbedNodeView from "./DatabaseEmbedNodeView";

vi.mock("../context/useWorkspace");

const samplePage = (overrides: Partial<Page> = {}): Page => ({
  id: "owner1",
  title: "Tasks page",
  parentId: null,
  order: 0,
  updatedAt: "",
  layout: "database",
  databaseId: "db1",
  blocks: [],
  ...overrides,
});

const sampleDatabase = (overrides: Partial<WorkspaceDatabase> = {}): WorkspaceDatabase => ({
  id: "db1",
  title: "Tasks",
  properties: [{ id: "name", name: "Name", type: "title" }],
  rows: [],
  views: [{ id: "v1", name: "Table", type: "table" }],
  ...overrides,
});

function makeNodeProps(payload: string | null): NodeViewProps {
  return {
    node: { attrs: { payload }, nodeSize: 1 },
    editor: {
      chain: () => ({
        focus: () => ({
          deleteRange: () => ({ run: vi.fn() }),
          insertContentAt: () => ({ run: vi.fn() }),
        }),
      }),
    },
    getPos: () => 0,
    selected: false,
    updateAttributes: vi.fn(),
    deleteNode: vi.fn(),
    extension: {},
    HTMLAttributes: {},
    decorations: [],
    innerDecorations: {},
    view: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as NodeViewProps;
}

describe("DatabaseEmbedNodeView", () => {
  beforeEach(() => {
    vi.mocked(useWorkspace).mockReset();
  });

  it("shows a broken-link message when the payload doesn't parse", () => {
    vi.mocked(useWorkspace).mockReturnValue({
      pages: [],
      getDatabase: vi.fn().mockReturnValue(undefined),
      updateDatabase: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    render(
      <MemoryRouter>
        <DatabaseEmbedNodeView {...makeNodeProps("not json")} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Linked database missing.")).toBeInTheDocument();
  });

  it("shows a broken-link message when the referenced database no longer exists", () => {
    vi.mocked(useWorkspace).mockReturnValue({
      pages: [],
      getDatabase: vi.fn().mockReturnValue(undefined),
      updateDatabase: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const payload = stringifyDatabaseEmbedPayload("missing-db");
    render(
      <MemoryRouter>
        <DatabaseEmbedNodeView {...makeNodeProps(payload)} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Linked database missing.")).toBeInTheDocument();
  });

  it("renders the linked database's table and an 'Open as page' link when an owner page exists", () => {
    const database = sampleDatabase();
    const owner = samplePage();
    vi.mocked(useWorkspace).mockReturnValue({
      pages: [owner],
      getDatabase: vi.fn().mockReturnValue(database),
      updateDatabase: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const payload = stringifyDatabaseEmbedPayload("db1");
    render(
      <MemoryRouter>
        <DatabaseEmbedNodeView {...makeNodeProps(payload)} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open as page" })).toHaveAttribute(
      "href",
      "/page/owner1",
    );
  });

  it("omits the 'Open as page' link when no page owns the database", () => {
    const database = sampleDatabase();
    vi.mocked(useWorkspace).mockReturnValue({
      pages: [],
      getDatabase: vi.fn().mockReturnValue(database),
      updateDatabase: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const payload = stringifyDatabaseEmbedPayload("db1");
    render(
      <MemoryRouter>
        <DatabaseEmbedNodeView {...makeNodeProps(payload)} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "Open as page" })).not.toBeInTheDocument();
  });

  it("calls updateDatabase via the table view's onChange", async () => {
    const database = sampleDatabase({ rows: [{ id: "r1", values: { name: "old" } }] });
    const updateDatabase = vi.fn();
    vi.mocked(useWorkspace).mockReturnValue({
      pages: [],
      getDatabase: vi.fn().mockReturnValue(database),
      updateDatabase,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const payload = stringifyDatabaseEmbedPayload("db1");
    render(
      <MemoryRouter>
        <DatabaseEmbedNodeView {...makeNodeProps(payload)} />
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Name cell" }), "x");

    expect(updateDatabase).toHaveBeenCalledWith("db1", expect.any(Function));
  });
});
