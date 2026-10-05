import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SlashMenu from "./SlashMenu";

describe("SlashMenu", () => {
  it("calls onSelect with the block type when an item is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <SlashMenu
        position={{ top: 0, left: 0 }}
        selectedIndex={0}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Paragraph"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("paragraph");
  });

  it("highlights the selected index", () => {
    render(
      <SlashMenu
        position={{ top: 0, left: 0 }}
        selectedIndex={1}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("option", { name: /Heading 1/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("shows a closing hint when nothing matches, and closes when that row is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <SlashMenu
        position={{ top: 0, left: 0 }}
        selectedIndex={0}
        onSelect={vi.fn()}
        onClose={onClose}
        items={[]}
      />,
    );

    const row = screen.getByRole("button", { name: /No matching commands/ });
    expect(row).toHaveTextContent("esc to close");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.click(row);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
