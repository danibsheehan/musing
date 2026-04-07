import type { Page } from "../types/page";
import { filterPagesForPicker, resolveWikiTarget } from "./resolveWikiPage";

const samplePage = (overrides: Partial<Page> = {}): Page => ({
  id: "p1",
  title: "Home",
  parentId: null,
  order: 0,
  updatedAt: "",
  layout: "document",
  databaseId: null,
  blocks: [],
  ...overrides,
});

describe("resolveWikiTarget", () => {
  it("returns null for whitespace-only label", () => {
    expect(resolveWikiTarget([samplePage()], "   ")).toBeNull();
  });

  it("matches title case-insensitively", () => {
    expect(resolveWikiTarget([samplePage()], "home")).toEqual({
      id: "p1",
      title: "Home",
    });
  });

  it("uses first page when titles collide case-insensitively", () => {
    const pages: Page[] = [
      samplePage({ id: "first", title: "Note" }),
      samplePage({ id: "second", title: "note" }),
    ];
    expect(resolveWikiTarget(pages, "NOTE")).toEqual({ id: "first", title: "Note" });
  });
});

describe("filterPagesForPicker", () => {
  it("excludes the given page id", () => {
    const pages: Page[] = [
      samplePage({ id: "a", title: "Alpha" }),
      samplePage({ id: "b", title: "Beta" }),
    ];
    expect(filterPagesForPicker(pages, { query: "", excludePageId: "a" }).map((p) => p.id)).toEqual([
      "b",
    ]);
  });

  it("filters by case-insensitive title substring", () => {
    const pages: Page[] = [
      samplePage({ id: "1", title: "Apple" }),
      samplePage({ id: "2", title: "Banana" }),
    ];
    const out = filterPagesForPicker(pages, { query: "app", excludePageId: "none" });
    expect(out.map((p) => p.id)).toEqual(["1"]);
  });

  it("returns all non-excluded pages when query is whitespace", () => {
    const pages: Page[] = [
      samplePage({ id: "x", title: "Zed" }),
      samplePage({ id: "y", title: "Yak" }),
    ];
    const out = filterPagesForPicker(pages, { query: "   ", excludePageId: "y" });
    expect(out.map((p) => p.id)).toEqual(["x"]);
  });

  it("sorts by title with base sensitivity", () => {
    const pages: Page[] = [
      samplePage({ id: "c", title: "Charlie" }),
      samplePage({ id: "a", title: "alpha" }),
      samplePage({ id: "b", title: "Bravo" }),
    ];
    const out = filterPagesForPicker(pages, { query: "", excludePageId: "noop" });
    expect(out.map((p) => p.title)).toEqual(["alpha", "Bravo", "Charlie"]);
  });
});
