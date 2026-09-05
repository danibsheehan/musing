import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceDatabase } from "../types/database";
import DatabasePickerMenu from "./DatabasePickerMenu";

const database = (overrides: Partial<WorkspaceDatabase> = {}): WorkspaceDatabase => ({
  id: "db1",
  title: "Tasks",
  properties: [],
  rows: [],
  views: [],
  ...overrides,
});

describe("DatabasePickerMenu", () => {
  it("shows a message when there are no databases", () => {
    render(
      <DatabasePickerMenu
        position={{ top: 0, left: 0 }}
        databases={[]}
        selectedIndex={0}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Create a database page from the sidebar first")).toBeInTheDocument();
  });

  it("renders an option per database and calls onSelect with the clicked one", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const databases = [
      database({ id: "a", title: "First" }),
      database({ id: "b", title: "Second" }),
    ];

    render(
      <DatabasePickerMenu
        position={{ top: 0, left: 0 }}
        databases={databases}
        selectedIndex={0}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByText("Second"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(databases[1]);
  });

  it("marks the selected option via aria-selected", () => {
    const databases = [database({ id: "a", title: "A" }), database({ id: "b", title: "B" })];
    render(
      <DatabasePickerMenu
        position={{ top: 0, left: 0 }}
        databases={databases}
        selectedIndex={1}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("option", { name: "B" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "A" })).toHaveAttribute("aria-selected", "false");
  });
});
