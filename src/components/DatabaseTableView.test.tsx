import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceDatabase } from "../types/database";
import DatabaseTableView from "./DatabaseTableView";

const sampleDatabase = (overrides: Partial<WorkspaceDatabase> = {}): WorkspaceDatabase => ({
  id: "db1",
  title: "Tasks",
  properties: [
    { id: "name", name: "Name", type: "title" },
    { id: "status", name: "Status", type: "text" },
  ],
  rows: [],
  views: [{ id: "v1", name: "Table", type: "table" }],
  ...overrides,
});

describe("DatabaseTableView", () => {
  it("renders a column header for each property", () => {
    render(<DatabaseTableView database={sampleDatabase()} />);
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
  });

  it("shows an empty-state row when there are no rows", () => {
    render(<DatabaseTableView database={sampleDatabase()} />);
    expect(screen.getByText("No rows yet")).toBeInTheDocument();
  });

  it("renders a cell input per row/property with its stored value", () => {
    const database = sampleDatabase({
      rows: [{ id: "r1", values: { name: "Buy milk", status: "todo" } }],
    });
    render(<DatabaseTableView database={database} />);

    expect(screen.queryByText("No rows yet")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name cell" })).toHaveValue("Buy milk");
    expect(screen.getByRole("textbox", { name: "Status cell" })).toHaveValue("todo");
  });

  it("calls onChange with an updated cell value when a cell is edited", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const database = sampleDatabase({
      rows: [{ id: "r1", values: { name: "Buy milk", status: "" } }],
    });
    render(<DatabaseTableView database={database} onChange={onChange} />);

    await user.type(screen.getByRole("textbox", { name: "Status cell" }), "x");

    expect(onChange).toHaveBeenCalledWith({
      ...database,
      rows: [{ id: "r1", values: { name: "Buy milk", status: "x" } }],
    });
  });

  it("calls onChange with a new empty row when 'New row' is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const database = sampleDatabase();
    render(<DatabaseTableView database={database} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "+ New row" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as WorkspaceDatabase;
    expect(next.rows).toHaveLength(1);
    expect(next.rows[0].values).toEqual({ name: "", status: "" });
  });

  it("hides the add-row button and disables edits when readOnly", () => {
    const onChange = vi.fn();
    const database = sampleDatabase({
      rows: [{ id: "r1", values: { name: "Buy milk", status: "todo" } }],
    });
    render(<DatabaseTableView database={database} onChange={onChange} readOnly />);

    expect(screen.queryByRole("button", { name: "+ New row" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name cell" })).toHaveAttribute("readonly");
  });

  it("does not render the add-row button without an onChange handler", () => {
    render(<DatabaseTableView database={sampleDatabase()} />);
    expect(screen.queryByRole("button", { name: "+ New row" })).not.toBeInTheDocument();
  });
});
