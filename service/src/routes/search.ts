import type { Request, Response } from "express";
import { embedTexts } from "../lib/voyage.js";
import { matchEmbeddings } from "../lib/matchEmbeddings.js";
import { llmRateLimiter } from "../lib/tokenBucket.js";
import { recordUsage } from "../middleware/budget.js";
import { clampLimit } from "../lib/clampLimit.js";

type SearchBody = { query?: unknown; limit?: unknown };

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MAX_QUERY_LENGTH = 1000;

export async function searchHandler(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Missing authenticated user" });
    return;
  }

  const body = req.body as SearchBody;
  if (typeof body.query !== "string" || body.query.trim().length === 0) {
    res.status(400).json({ error: "query (non-empty string) is required" });
    return;
  }
  if (body.query.length > MAX_QUERY_LENGTH) {
    res
      .status(400)
      .json({ error: `query too long (${body.query.length} > ${MAX_QUERY_LENGTH} characters)` });
    return;
  }
  const limit = clampLimit(body.limit, DEFAULT_LIMIT, MAX_LIMIT);

  await llmRateLimiter.acquire();

  let embeddings: number[][];
  let tokensUsed: number;
  try {
    const result = await embedTexts([body.query]);
    embeddings = result.embeddings;
    tokensUsed = result.tokensUsed;
  } catch {
    res.status(502).json({ error: "Embedding provider request failed" });
    return;
  }

  await recordUsage(userId, "voyage", tokensUsed);

  try {
    const matches = await matchEmbeddings(userId, embeddings[0], limit);
    res.json({ matches });
  } catch {
    res.status(500).json({ error: "Search query failed" });
  }
}
