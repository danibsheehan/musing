import { describe, expect, it } from "vitest";
import { stepMenuIndex } from "./useFloatingMenu";

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
