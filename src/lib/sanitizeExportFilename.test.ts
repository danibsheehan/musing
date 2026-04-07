import { describe, expect, it } from "vitest";
import { sanitizeExportBasename } from "./sanitizeExportFilename";

describe("sanitizeExportBasename", () => {
  it("uses Untitled for empty and whitespace-only input", () => {
    expect(sanitizeExportBasename("")).toBe("Untitled");
    expect(sanitizeExportBasename("   \t  ")).toBe("Untitled");
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizeExportBasename("  My Doc  ")).toBe("My Doc");
  });

  it("replaces illegal filename characters with hyphens", () => {
    expect(sanitizeExportBasename('a/b?x*y:z|"<>\\')).toBe("a-b-x-y-z-----");
  });

  it("collapses internal whitespace to single spaces", () => {
    expect(sanitizeExportBasename("Hello   world")).toBe("Hello world");
  });

  it("strips trailing periods and spaces after truncation", () => {
    expect(sanitizeExportBasename("...")).toBe("Untitled");
  });

  it("truncates to 120 characters", () => {
    const long = "a".repeat(200);
    expect(sanitizeExportBasename(long)).toHaveLength(120);
    expect(sanitizeExportBasename(long)).toBe("a".repeat(120));
  });

  it("returns Untitled when the basename is only dots after cleaning", () => {
    expect(sanitizeExportBasename(".".repeat(120))).toBe("Untitled");
  });
});
