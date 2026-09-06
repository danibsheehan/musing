import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ComponentProps } from "react";
import type { Page } from "../types/page";
import type { WorkspaceDatabase } from "../types/database";
import { stringifyDatabaseEmbedPayload } from "../lib/databaseEmbed";
import { useWorkspace } from "../context/useWorkspace";
import type { Block } from "../types/block";
import DatabaseEmbedBlock from "./DatabaseEmbedBlock";

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
  views: [],
  ...overrides,
});

const block = (overrides: Partial<Block> = {}): Block => ({
  id: "block-1",
  type: "databaseEmbed",
  content: stringifyDatabaseEmbedPayload("db1"),
  ...overrides,
});

function mockWorkspace(overrides: { pages?: Page[]; db?: WorkspaceDatabase | undefined }) {
  vi.mocked(useWorkspace).mockReturnValue({
    pages: overrides.pages ?? [],
    getDatabase: vi.fn().mockReturnValue(overrides.db),
    updateDatabase: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

function baseProps(): ComponentProps<typeof DatabaseEmbedBlock> {
  return {
    block: block(),
    isFocused: false,
    setFocusedBlockId: vi.fn(),
    onBackspace: vi.fn(),
    onEnter: vi.fn(),
    canMoveUp: true,
    canMoveDown: true,
    onMoveBlockDelta: vi.fn(),
  };
}

function renderBlock(props: ReturnType<typeof baseProps>) {
  return render(
    <MemoryRouter>
      <DatabaseEmbedBlock {...props} />
    </MemoryRouter>,
  );
}

describe("DatabaseEmbedBlock", () => {
  beforeEach(() => {
    vi.mocked(useWorkspace).mockReset();
  });

  it("shows a broken-link message when the referenced database no longer exists", () => {
    mockWorkspace({ db: undefined });
    renderBlock(baseProps());
    expect(screen.getByText("Linked database missing.")).toBeInTheDocument();
  });

  it("renders the linked database's table and an 'Open as page' link when an owner page exists", () => {
    mockWorkspace({ pages: [samplePage()], db: sampleDatabase() });
    renderBlock(baseProps());

    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open as page" })).toHaveAttribute(
      "href",
      "/page/owner1",
    );
  });

  it("calls setFocusedBlockId when clicked", async () => {
    const user = userEvent.setup();
    mockWorkspace({ pages: [samplePage()], db: sampleDatabase() });
    const props = baseProps();
    renderBlock(props);

    await user.click(screen.getByRole("group", { name: "Linked database" }));
    expect(props.setFocusedBlockId).toHaveBeenCalledWith("block-1");
  });

  it("calls onMoveBlockDelta on Alt+ArrowUp/ArrowDown, respecting canMoveUp/canMoveDown", () => {
    mockWorkspace({ pages: [], db: sampleDatabase() });
    const props = baseProps();
    props.canMoveUp = false;
    renderBlock(props);

    const root = screen.getByRole("group", { name: "Linked database" });
    root.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowUp",
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(props.onMoveBlockDelta).not.toHaveBeenCalled();

    root.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(props.onMoveBlockDelta).toHaveBeenCalledWith("block-1", 1);
  });

  it("calls onEnter on Enter unless post-slash-new-row is locked", () => {
    mockWorkspace({ pages: [], db: sampleDatabase() });
    const props = baseProps();
    props.isPostSlashNewRowLocked = () => true;
    renderBlock(props);

    const root = screen.getByRole("group", { name: "Linked database" });
    root.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
    expect(props.onEnter).not.toHaveBeenCalled();
  });

  it("calls onBackspace when Backspace is pressed while focused and not editing a nested field", () => {
    mockWorkspace({ pages: [], db: sampleDatabase() });
    const props = baseProps();
    props.isFocused = true;
    renderBlock(props);

    const root = screen.getByRole("group", { name: "Linked database" });
    root.focus();
    root.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }),
    );
    expect(props.onBackspace).toHaveBeenCalledWith("block-1");
  });

  it("does not call onBackspace when the active element is a nested text input", async () => {
    const user = userEvent.setup();
    mockWorkspace({
      pages: [],
      db: sampleDatabase({ rows: [{ id: "r1", values: { name: "" } }] }),
    });
    const props = baseProps();
    props.isFocused = true;
    renderBlock(props);

    const input = screen.getByRole("textbox", { name: "Name cell" });
    await user.click(input);
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }),
    );
    expect(props.onBackspace).not.toHaveBeenCalled();
  });
});
