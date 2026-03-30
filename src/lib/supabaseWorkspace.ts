import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspaceSnapshot } from "../types/page";
import { parseWorkspaceJson } from "./workspaceStorage";

export type WorkspaceRow = {
  user_id: string;
  snapshot: unknown;
  updated_at: string;
};

export function snapshotFromRemoteJson(snapshot: unknown): WorkspaceSnapshot | null {
  try {
    return parseWorkspaceJson(JSON.stringify(snapshot));
  } catch {
    return null;
  }
}

export async function fetchWorkspaceRow(
  client: SupabaseClient,
  userId: string
): Promise<WorkspaceRow | null> {
  const { data, error } = await client
    .from("workspaces")
    .select("user_id, snapshot, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return data as WorkspaceRow;
}

export async function upsertWorkspaceRow(
  client: SupabaseClient,
  userId: string,
  snapshot: WorkspaceSnapshot
): Promise<void> {
  const { error } = await client.from("workspaces").upsert(
    {
      user_id: userId,
      snapshot,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
}
