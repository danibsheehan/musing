import { describe, expect, it } from "vitest";
import { clampLimit } from "./clampLimit.js";

describe("clampLimit", () => {
  it("returns the default when value is not a positive number", () => {
    expect(clampLimit(undefined, 10, 50)).toBe(10);
    expect(clampLimit("5", 10, 50)).toBe(10);
    expect(clampLimit(0, 10, 50)).toBe(10);
    expect(clampLimit(-3, 10, 50)).toBe(10);
  });

  it("returns value when within range", () => {
    expect(clampLimit(20, 10, 50)).toBe(20);
  });

  it("clamps to max when value exceeds it", () => {
    expect(clampLimit(999, 10, 50)).toBe(50);
  });
});
