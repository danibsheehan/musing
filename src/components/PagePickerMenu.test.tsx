import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Page } from "../types/page";
import PagePickerMenu from "./PagePickerMenu";

const samplePage = (overrides: Partial<Page> = {}): Page => ({
  id: "p1",
  title: "Alpha",
  parentId: null,
  order: 0,
  updatedAt: "",
  layout: "document",
  databaseId: null,
  blocks: [],
  ...overrides,
});

describe("PagePickerMenu", () => {
  it("shows a message when there are no pages", () => {
    render(
      <PagePickerMenu
        position={{ top: 0, left: 0 }}
        pages={[]}
        selectedIndex={0}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText("No matching pages")).toBeInTheDocument();
  });

  it("calls onSelect with the page when a row is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const pages = [samplePage({ id: "a", title: "First" }), samplePage({ id: "b", title: "Second" })];

    render(
      <PagePickerMenu
        position={{ top: 0, left: 0 }}
        pages={pages}
        selectedIndex={0}
        onSelect={onSelect}
      />
    );

    await user.click(screen.getByText("Second"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(pages[1]);
  });

  it("highlights the selected row", () => {
    const pages = [samplePage({ title: "A" }), samplePage({ id: "p2", title: "B" })];
    render(
      <PagePickerMenu
        position={{ top: 0, left: 0 }}
        pages={pages}
        selectedIndex={1}
        onSelect={vi.fn()}
      />
    );

    const row = screen.getByText("B").closest("div");
    expect(row).toHaveStyle({ backgroundColor: "rgb(238, 238, 238)" });
  });
});
