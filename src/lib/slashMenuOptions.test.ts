import { describe, expect, it } from "vitest";
import { filterSlashMenuItems, SLASH_MENU_ITEMS } from "./slashMenuOptions";

describe("filterSlashMenuItems", () => {
  it("returns a copy of every item for an empty query", () => {
    const result = filterSlashMenuItems(SLASH_MENU_ITEMS, "");
    expect(result).toEqual(SLASH_MENU_ITEMS);
    expect(result).not.toBe(SLASH_MENU_ITEMS);
  });

  it("returns a copy of every item for a whitespace-only query", () => {
    const result = filterSlashMenuItems(SLASH_MENU_ITEMS, "   ");
    expect(result).toEqual(SLASH_MENU_ITEMS);
  });

  it("matches case-insensitively by label substring", () => {
    const result = filterSlashMenuItems(SLASH_MENU_ITEMS, "head");
    expect(result.map((i) => i.type)).toEqual(["heading", "heading2"]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterSlashMenuItems(SLASH_MENU_ITEMS, "nonexistent")).toEqual([]);
  });

  it("trims surrounding whitespace before matching", () => {
    const result = filterSlashMenuItems(SLASH_MENU_ITEMS, "  quote  ");
    expect(result.map((i) => i.type)).toEqual(["blockquote"]);
  });
});
