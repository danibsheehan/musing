import { describe, expect, it, vi } from "vitest";
import type { EmojiItem } from "@tiptap/extension-emoji";
import { getEmojiSuggestionItems } from "./emojiSuggestionItems";

vi.mock("@tiptap/extension-emoji", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tiptap/extension-emoji")>();
  const noEmojiItem: EmojiItem = {
    name: "no_emoji_char_test",
    shortcodes: ["no_emoji_char_test"],
    tags: [],
    group: "",
    emoticons: [],
    version: 0,
    emoji: "",
  };
  return { ...actual, emojis: [...actual.emojis, noEmojiItem] };
});

describe("getEmojiSuggestionItems", () => {
  it("returns at most 48 items for an empty query", () => {
    const items = getEmojiSuggestionItems("");
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(48);
  });

  it("returns popular items with emoji characters for an empty query", () => {
    const items = getEmojiSuggestionItems("   ");
    expect(items.every((i) => typeof i.emoji === "string" && i.emoji.length > 0)).toBe(true);
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
          i.tags.some((t) => t.includes(lower)),
      ),
    ).toBe(true);
  });

  it("returns no items for a query that matches nothing", () => {
    const items = getEmojiSuggestionItems("zzznonexistenttoken12345");
    expect(items).toEqual([]);
  });

  it("stops once it collects 48 matches for a broadly matching query", () => {
    const items = getEmojiSuggestionItems("a");
    expect(items.length).toBe(48);
  });

  it("skips entries without an emoji character even when they match the query", () => {
    const items = getEmojiSuggestionItems("no_emoji_char_test");
    expect(items).toEqual([]);
  });
});
