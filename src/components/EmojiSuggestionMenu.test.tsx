import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EmojiItem } from "@tiptap/extension-emoji";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EmojiSuggestionMenu from "./EmojiSuggestionMenu";

const emoji = (overrides: Partial<EmojiItem> = {}): EmojiItem => ({
  name: "grinning",
  emoji: "😀",
  shortcodes: ["grinning"],
  tags: [],
  ...overrides,
});

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe("EmojiSuggestionMenu", () => {
  it("shows a message when there are no matching emoji", () => {
    render(
      <EmojiSuggestionMenu
        editor={{} as never}
        items={[]}
        selectedIndex={0}
        command={vi.fn()}
        clientRect={null}
      />,
    );
    expect(screen.getByText("No matching emoji")).toBeInTheDocument();
  });

  it("renders an option per emoji with its glyph and shortcode", () => {
    const items = [emoji({ name: "grinning", emoji: "😀", shortcodes: ["grinning", "smile"] })];
    render(
      <EmojiSuggestionMenu
        editor={{} as never}
        items={items}
        selectedIndex={0}
        command={vi.fn()}
        clientRect={null}
      />,
    );
    expect(screen.getByText("😀")).toBeInTheDocument();
    expect(screen.getByText(":grinning:")).toBeInTheDocument();
  });

  it("falls back to the emoji's name when it has no shortcodes", () => {
    const items = [emoji({ name: "unnamed-emoji", shortcodes: [] })];
    render(
      <EmojiSuggestionMenu
        editor={{} as never}
        items={items}
        selectedIndex={0}
        command={vi.fn()}
        clientRect={null}
      />,
    );
    expect(screen.getByText(":unnamed-emoji:")).toBeInTheDocument();
  });

  it("marks the selected option via aria-selected", () => {
    const items = [emoji({ name: "a" }), emoji({ name: "b" })];
    render(
      <EmojiSuggestionMenu
        editor={{} as never}
        items={items}
        selectedIndex={1}
        command={vi.fn()}
        clientRect={null}
      />,
    );
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
  });

  it("calls command with the clicked emoji", async () => {
    const user = userEvent.setup();
    const command = vi.fn();
    const items = [emoji({ name: "a" }), emoji({ name: "b" })];
    render(
      <EmojiSuggestionMenu
        editor={{} as never}
        items={items}
        selectedIndex={0}
        command={command}
        clientRect={null}
      />,
    );

    await user.click(screen.getAllByRole("option")[1]);
    expect(command).toHaveBeenCalledWith(items[1]);
  });
});
