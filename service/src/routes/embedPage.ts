import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { chunkBlocks, type IncomingBlock } from "../lib/chunking.js";
import { embedTexts } from "../lib/voyage.js";
import { llmRateLimiter } from "../lib/tokenBucket.js";
import { recordUsage } from "../middleware/budget.js";

type EmbedPageBody = {
  pageId?: unknown;
  blocks?: unknown;
};

/** Caps how much a single request can spend in one Voyage call, independent of the monthly budget check. */
const MAX_CHUNKS_PER_REQUEST = 200;

function isIncomingBlock(value: unknown): value is IncomingBlock {
  if (typeof value !== "object" || value === null) return false;
  const block = value as Record<string, unknown>;
  return (
    typeof block.id === "string" &&
    typeof block.type === "string" &&
    typeof block.content === "string"
  );
}

export async function embedPageHandler(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Missing authenticated user" });
    return;
  }

  const body = req.body as EmbedPageBody;
  if (
    typeof body.pageId !== "string" ||
    body.pageId.trim().length === 0 ||
    !Array.isArray(body.blocks) ||
    !body.blocks.every(isIncomingBlock)
  ) {
    res.status(400).json({ error: "pageId (non-empty string) and blocks (Block[]) are required" });
    return;
  }
  const pageId = body.pageId;
  const blocks = body.blocks;

  const chunks = chunkBlocks(blocks);
  const currentBlockIds = new Set(chunks.map((chunk) => chunk.blockId));

  const { data: existingRows, error: fetchError } = await supabaseAdmin
    .from("note_embeddings")
    .select("block_id, content_hash")
    .eq("user_id", userId)
    .eq("page_id", pageId);

  if (fetchError) {
    res.status(500).json({ error: "Failed to read existing embeddings" });
    return;
  }

  const existingHashByBlock = new Map<string, string>(
    (existingRows ?? []).map((row) => [row.block_id as string, row.content_hash as string]),
  );

  const changedChunks = chunks.filter(
    (chunk) => existingHashByBlock.get(chunk.blockId) !== chunk.contentHash,
  );
  const staleBlockIds = [...existingHashByBlock.keys()].filter(
    (blockId) => !currentBlockIds.has(blockId),
  );

  if (changedChunks.length > MAX_CHUNKS_PER_REQUEST) {
    res.status(400).json({
      error: `Too many changed blocks in one request (${changedChunks.length} > ${MAX_CHUNKS_PER_REQUEST}); split the page into smaller embed-page calls`,
    });
    return;
  }

  let embeddings: number[][] = [];
  if (changedChunks.length > 0) {
    await llmRateLimiter.acquire();
    try {
      const result = await embedTexts(changedChunks.map((chunk) => chunk.content));
      if (result.embeddings.length !== changedChunks.length) {
        res
          .status(502)
          .json({ error: "Embedding provider returned an unexpected number of results" });
        return;
      }
      embeddings = result.embeddings;
      // Record usage immediately once Voyage is actually billed — regardless of whether
      // the subsequent Supabase writes below succeed, the spend already happened.
      await recordUsage(userId, "voyage", result.tokensUsed);
    } catch {
      res.status(502).json({ error: "Embedding provider request failed" });
      return;
    }
  }

  const idsToDelete = [...changedChunks.map((chunk) => chunk.blockId), ...staleBlockIds];
  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabaseAdmin
      .from("note_embeddings")
      .delete()
      .eq("user_id", userId)
      .eq("page_id", pageId)
      .in("block_id", idsToDelete);

    if (deleteError) {
      res.status(500).json({ error: "Failed to update embeddings" });
      return;
    }
  }

  if (changedChunks.length > 0) {
    const rows = changedChunks.map((chunk, i) => ({
      user_id: userId,
      page_id: pageId,
      block_id: chunk.blockId,
      content_hash: chunk.contentHash,
      embedding: embeddings[i],
    }));

    const { error: insertError } = await supabaseAdmin.from("note_embeddings").insert(rows);
    if (insertError) {
      res.status(500).json({ error: "Failed to store embeddings" });
      return;
    }
  }

  res.json({
    embedded: changedChunks.length,
    skipped: chunks.length - changedChunks.length,
    removed: staleBlockIds.length,
  });
}
