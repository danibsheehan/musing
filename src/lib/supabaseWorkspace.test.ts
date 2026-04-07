import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspaceSnapshot } from "../types/page";
import { describe, expect, it, vi } from "vitest";
import { fetchWorkspaceRow, snapshotFromRemoteJson, upsertWorkspaceRow } from "./supabaseWorkspace";

const minimalSnapshot = (): WorkspaceSnapshot => ({
  version: 2,
  homePageId: "page-1",
  lastOpenedPageId: "page-1",
  pages: [
    {
      id: "page-1",
      title: "T",
      parentId: null,
      order: 0,
      updatedAt: "2020-01-01T00:00:00.000Z",
      layout: "document",
      databaseId: null,
      blocks: [{ id: "b1", type: "paragraph", content: "<p>x</p>" }],
    },
  ],
  databases: [],
});

function createQueryMock(result: { data: unknown; error: Error | null }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from, select, eq, maybeSingle };
}

function createUpsertMock(result: { error: Error | null }) {
  const upsert = vi.fn().mockResolvedValue(result);
  const from = vi.fn().mockReturnValue({ upsert });
  return { from, upsert };
}

describe("snapshotFromRemoteJson", () => {
  it("returns a parsed snapshot for valid remote JSON", () => {
    const snap = minimalSnapshot();
    const out = snapshotFromRemoteJson(snap);
    expect(out).not.toBeNull();
    expect(out!.version).toBe(2);
    expect(out!.homePageId).toBe("page-1");
  });

  it("returns null when snapshot does not parse as workspace", () => {
    expect(snapshotFromRemoteJson({ version: 99 })).toBeNull();
  });

  it("returns null when JSON.stringify fails", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(snapshotFromRemoteJson(circular)).toBeNull();
  });
});

describe("fetchWorkspaceRow", () => {
  it("returns null when no row is found", async () => {
    const { from } = createQueryMock({ data: null, error: null });
    const client = { from } as unknown as SupabaseClient;
    await expect(fetchWorkspaceRow(client, "user-1")).resolves.toBeNull();
    expect(from).toHaveBeenCalledWith("workspaces");
  });

  it("returns the row when present", async () => {
    const row = {
      user_id: "user-1",
      snapshot: minimalSnapshot(),
      updated_at: "2020-01-02T00:00:00.000Z",
    };
    const { from } = createQueryMock({ data: row, error: null });
    const client = { from } as unknown as SupabaseClient;
    await expect(fetchWorkspaceRow(client, "user-1")).resolves.toEqual(row);
  });

  it("throws when Supabase returns an error", async () => {
    const err = new Error("query failed");
    const { from } = createQueryMock({ data: null, error: err });
    const client = { from } as unknown as SupabaseClient;
    await expect(fetchWorkspaceRow(client, "user-1")).rejects.toThrow("query failed");
  });
});

describe("upsertWorkspaceRow", () => {
  it("resolves when upsert succeeds", async () => {
    const { from, upsert } = createUpsertMock({ error: null });
    const client = { from } as unknown as SupabaseClient;
    const snap = minimalSnapshot();
    await expect(upsertWorkspaceRow(client, "user-1", snap)).resolves.toBeUndefined();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        snapshot: snap,
        updated_at: expect.any(String),
      }),
      { onConflict: "user_id" }
    );
  });

  it("throws when Supabase returns an error", async () => {
    const err = new Error("upsert failed");
    const { from } = createUpsertMock({ error: err });
    const client = { from } as unknown as SupabaseClient;
    await expect(upsertWorkspaceRow(client, "user-1", minimalSnapshot())).rejects.toThrow("upsert failed");
  });
});
