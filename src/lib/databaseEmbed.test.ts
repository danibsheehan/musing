import {
  parseDatabaseEmbedPayload,
  stringifyDatabaseEmbedPayload,
} from "./databaseEmbed";

describe("stringifyDatabaseEmbedPayload", () => {
  it("serializes databaseId and null viewId by default", () => {
    expect(JSON.parse(stringifyDatabaseEmbedPayload("db-1"))).toEqual({
      databaseId: "db-1",
      viewId: null,
    });
  });

  it("includes string viewId when provided", () => {
    expect(JSON.parse(stringifyDatabaseEmbedPayload("db-1", "v-2"))).toEqual({
      databaseId: "db-1",
      viewId: "v-2",
    });
  });

  it("treats explicit undefined like absent viewId", () => {
    expect(JSON.parse(stringifyDatabaseEmbedPayload("db-1", undefined))).toEqual({
      databaseId: "db-1",
      viewId: null,
    });
  });
});

describe("parseDatabaseEmbedPayload", () => {
  it("parses valid payload with viewId", () => {
    const raw = stringifyDatabaseEmbedPayload("db-a", "view-b");
    expect(parseDatabaseEmbedPayload(raw)).toEqual({
      databaseId: "db-a",
      viewId: "view-b",
    });
  });

  it("normalizes non-string viewId to null", () => {
    expect(
      parseDatabaseEmbedPayload(JSON.stringify({ databaseId: "d", viewId: 42 }))
    ).toEqual({ databaseId: "d", viewId: null });
  });

  it("returns null for invalid JSON", () => {
    expect(parseDatabaseEmbedPayload("{")).toBeNull();
  });

  it("returns null for non-object root", () => {
    expect(parseDatabaseEmbedPayload("[]")).toBeNull();
    expect(parseDatabaseEmbedPayload('"s"')).toBeNull();
  });

  it("returns null when databaseId is missing or not a string", () => {
    expect(parseDatabaseEmbedPayload("{}")).toBeNull();
    expect(parseDatabaseEmbedPayload(JSON.stringify({ databaseId: 1 }))).toBeNull();
  });
});
