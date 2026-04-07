import { describe, expect, it } from "vitest";
import type { Page } from "../types/page";
import { findDatabaseOwnerPage } from "./findDatabaseOwnerPage";

const doc = (id: string): Page => ({
  id,
  title: "Doc",
  parentId: null,
  order: 0,
  updatedAt: "",
  layout: "document",
  databaseId: null,
  blocks: [],
});

const dbPage = (id: string, databaseId: string): Page => ({
  id,
  title: "DB page",
  parentId: null,
  order: 0,
  updatedAt: "",
  layout: "database",
  databaseId,
  blocks: [],
});

describe("findDatabaseOwnerPage", () => {
  it("returns the page that owns the database id", () => {
    const pages: Page[] = [doc("a"), dbPage("b", "db-1"), doc("c")];
    expect(findDatabaseOwnerPage(pages, "db-1")).toEqual(pages[1]);
  });

  it("returns undefined when no database page matches", () => {
    const pages: Page[] = [doc("a"), dbPage("b", "other")];
    expect(findDatabaseOwnerPage(pages, "missing")).toBeUndefined();
  });

  it("ignores document pages with the same id string in a non-database field", () => {
    const pages: Page[] = [doc("db-1")];
    expect(findDatabaseOwnerPage(pages, "db-1")).toBeUndefined();
  });
});
