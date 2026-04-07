import { describe, expect, it, vi } from "vitest";
import { createWorkspaceDatabase } from "./databaseFactory";

vi.mock("uuid", () => ({
  v4: vi
    .fn()
    .mockReturnValueOnce("prop-id-1")
    .mockReturnValueOnce("view-id-1"),
}));

describe("createWorkspaceDatabase", () => {
  it("creates a database with a title property, default view, and the given id", () => {
    const db = createWorkspaceDatabase("db-fixed");
    expect(db.id).toBe("db-fixed");
    expect(db.title).toBe("New database");
    expect(db.properties).toEqual([{ id: "prop-id-1", name: "Name", type: "title" }]);
    expect(db.rows).toEqual([]);
    expect(db.views).toEqual([{ id: "view-id-1", name: "Default", type: "table" }]);
  });
});
