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
      />
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
      />
    );

    const heading = screen.getByText("Heading 1").closest("div");
    expect(heading).toBeTruthy();
    expect(heading).toHaveStyle({ backgroundColor: "rgb(238, 238, 238)" });
  });
});
