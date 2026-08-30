import { supabaseAdmin } from "./supabaseAdmin.js";

export type EmbeddingMatch = { pageId: string; blockId: string; similarity: number };
export type RelatedPageMatch = { pageId: string; similarity: number };

export async function matchEmbeddings(
  userId: string,
  queryEmbedding: number[],
  matchCount: number,
): Promise<EmbeddingMatch[]> {
  const { data, error } = await supabaseAdmin.rpc("match_note_embeddings", {
    query_embedding: queryEmbedding,
    match_user_id: userId,
    match_count: matchCount,
  });
  if (error) throw error;

  return ((data ?? []) as { page_id: string; block_id: string; similarity: number }[]).map(
    (row) => ({
      pageId: row.page_id,
      blockId: row.block_id,
      similarity: row.similarity,
    }),
  );
}

export async function matchRelatedPages(
  userId: string,
  sourcePageId: string,
  matchCount: number,
): Promise<RelatedPageMatch[]> {
  const { data, error } = await supabaseAdmin.rpc("match_related_pages", {
    match_user_id: userId,
    source_page_id: sourcePageId,
    match_count: matchCount,
  });
  if (error) throw error;

  return ((data ?? []) as { page_id: string; similarity: number }[]).map((row) => ({
    pageId: row.page_id,
    similarity: row.similarity,
  }));
}
