import { describe, expect, it } from "vitest";
import { stepMenuIndex, typedPastLastMatch } from "./useFloatingMenu";

describe("stepMenuIndex", () => {
  it("moves down and wraps from the last item to the first", () => {
    expect(stepMenuIndex(0, 3, "down")).toBe(1);
    expect(stepMenuIndex(1, 3, "down")).toBe(2);
    expect(stepMenuIndex(2, 3, "down")).toBe(0);
  });

  it("moves up and wraps from the first item to the last", () => {
    expect(stepMenuIndex(2, 3, "up")).toBe(1);
    expect(stepMenuIndex(1, 3, "up")).toBe(0);
    expect(stepMenuIndex(0, 3, "up")).toBe(2);
  });

  it("clamps a stale index that is past the end of a shrunken list before stepping", () => {
    expect(stepMenuIndex(7, 3, "down")).toBe(0);
    expect(stepMenuIndex(7, 3, "up")).toBe(1);
  });

  it("stays on the only item when there is one", () => {
    expect(stepMenuIndex(0, 1, "down")).toBe(0);
    expect(stepMenuIndex(0, 1, "up")).toBe(0);
  });
});

describe("typedPastLastMatch", () => {
  const labels = ["Heading 1", "Heading 2", "Paragraph"];
  const getItems = (query: string) =>
    labels.filter((label) => label.toLowerCase().includes(query.toLowerCase()));

  it("is false while the query still matches something", () => {
    expect(typedPastLastMatch("", getItems)).toBe(false);
    expect(typedPastLastMatch("head", getItems)).toBe(false);
    expect(typedPastLastMatch("heading", getItems)).toBe(false);
  });

  it("is false up to three characters past the last match and true at four", () => {
    expect(typedPastLastMatch("hx", getItems)).toBe(false);
    expect(typedPastLastMatch("hxa", getItems)).toBe(false);
    expect(typedPastLastMatch("hxab", getItems)).toBe(false);
    expect(typedPastLastMatch("hxabc", getItems)).toBe(true);
    expect(typedPastLastMatch("hxabcd", getItems)).toBe(true);
  });

  it("counts from the start when the query never matched", () => {
    expect(typedPastLastMatch("zzz", getItems)).toBe(false);
    expect(typedPastLastMatch("zzzz", getItems)).toBe(true);
  });

  it("is false again once a failing query is shortened back under the limit", () => {
    expect(typedPastLastMatch("hxabc", getItems)).toBe(true);
    expect(typedPastLastMatch("hxab", getItems)).toBe(false);
  });

  it("uses the given limit", () => {
    expect(typedPastLastMatch("zz", getItems, 2)).toBe(true);
    expect(typedPastLastMatch("z", getItems, 2)).toBe(false);
  });
});
