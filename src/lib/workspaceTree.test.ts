import type { Page } from "../types/page";
import { ancestryChain, siblingsOf, subtreeIds } from "./workspaceTree";

const page = (overrides: Partial<Page> = {}): Page => ({
  id: "p",
  title: "T",
  parentId: null,
  order: 0,
  updatedAt: "",
  layout: "document",
  databaseId: null,
  blocks: [],
  ...overrides,
});

describe("siblingsOf", () => {
  it("returns only pages with the given parentId sorted by order", () => {
    const pages: Page[] = [
      page({ id: "a", parentId: null, order: 2, title: "A" }),
      page({ id: "b", parentId: "x", order: 0, title: "B" }),
      page({ id: "c", parentId: null, order: 0, title: "C" }),
      page({ id: "d", parentId: null, order: 1, title: "D" }),
    ];
    expect(siblingsOf(pages, null).map((p) => p.id)).toEqual(["c", "d", "a"]);
  });

  it("returns empty array when no matches", () => {
    expect(siblingsOf([page({ id: "only", parentId: null })], "missing-parent")).toEqual([]);
  });
});

describe("subtreeIds", () => {
  it("includes root and all descendants", () => {
    const pages: Page[] = [
      page({ id: "root", parentId: null, order: 0 }),
      page({ id: "c1", parentId: "root", order: 0 }),
      page({ id: "c2", parentId: "root", order: 1 }),
      page({ id: "gc", parentId: "c1", order: 0 }),
    ];
    expect([...subtreeIds(pages, "root")].sort()).toEqual(["c1", "c2", "gc", "root"]);
  });

  it("handles a single-node tree", () => {
    expect([...subtreeIds([page({ id: "solo", parentId: null })], "solo")]).toEqual(["solo"]);
  });

  it("does not infinite-loop on cyclic parent pointers", () => {
    const pages: Page[] = [
      page({ id: "a", parentId: "b", order: 0 }),
      page({ id: "b", parentId: "a", order: 0 }),
    ];
    expect(subtreeIds(pages, "a").size).toBe(2);
  });
});

describe("ancestryChain", () => {
  it("returns root-to-leaf order", () => {
    const pages: Page[] = [
      page({ id: "root", parentId: null, order: 0, title: "Root" }),
      page({ id: "mid", parentId: "root", order: 0, title: "Mid" }),
      page({ id: "leaf", parentId: "mid", order: 0, title: "Leaf" }),
    ];
    expect(ancestryChain(pages, "leaf").map((p) => p.id)).toEqual(["root", "mid", "leaf"]);
  });

  it("returns a single page when it is the root", () => {
    const pages: Page[] = [page({ id: "root", parentId: null, order: 0 })];
    expect(ancestryChain(pages, "root").map((p) => p.id)).toEqual(["root"]);
  });

  it("returns empty chain when page id is unknown", () => {
    expect(ancestryChain([page({ id: "a", parentId: null, order: 0 })], "nope")).toEqual([]);
  });
});
