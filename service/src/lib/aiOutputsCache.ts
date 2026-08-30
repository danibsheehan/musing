import { supabaseAdmin } from "./supabaseAdmin.js";

export async function getCachedOutput<T>(
  userId: string,
  pageId: string,
  kind: string,
  inputHash: string,
): Promise<T | null> {
  const { data } = await supabaseAdmin
    .from("ai_outputs")
    .select("output")
    .eq("user_id", userId)
    .eq("page_id", pageId)
    .eq("kind", kind)
    .eq("input_hash", inputHash)
    .maybeSingle<{ output: T }>();

  return data?.output ?? null;
}

export async function setCachedOutput(
  userId: string,
  pageId: string,
  kind: string,
  inputHash: string,
  output: unknown,
): Promise<void> {
  await supabaseAdmin
    .from("ai_outputs")
    .upsert(
      { user_id: userId, page_id: pageId, kind, input_hash: inputHash, output },
      { onConflict: "user_id,page_id,kind,input_hash" },
    );
}
