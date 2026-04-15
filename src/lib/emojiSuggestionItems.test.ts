import { describe, expect, it } from "vitest";
import { getEmojiSuggestionItems } from "./emojiSuggestionItems";

describe("getEmojiSuggestionItems", () => {
  it("returns at most 48 items for an empty query", () => {
    const items = getEmojiSuggestionItems("");
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(48);
  });

  it("returns popular items with emoji characters for an empty query", () => {
    const items = getEmojiSuggestionItems("   ");
    expect(items.every((i) => typeof i.emoji === "string" && i.emoji.length > 0)).toBe(
      true
    );
  });

  it("filters by query and caps at 48", () => {
    const items = getEmojiSuggestionItems("smile");
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(48);
    const lower = "smile";
    expect(
      items.some(
        (i) =>
          i.name.includes(lower) ||
          i.shortcodes.some((s) => s.includes(lower)) ||
          i.tags.some((t) => t.includes(lower))
      )
    ).toBe(true);
  });

  it("returns no items for a query that matches nothing", () => {
    const items = getEmojiSuggestionItems("zzznonexistenttoken12345");
    expect(items).toEqual([]);
  });
});
