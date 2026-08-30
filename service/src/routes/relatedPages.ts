import type { Request, Response } from "express";
import { matchRelatedPages } from "../lib/matchEmbeddings.js";
import { clampLimit } from "../lib/clampLimit.js";

type RelatedPagesBody = { pageId?: unknown; limit?: unknown };

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

/** Vector search only, over embeddings already stored for pageId — no new embed/LLM call. */
export async function relatedPagesHandler(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Missing authenticated user" });
    return;
  }

  const body = req.body as RelatedPagesBody;
  if (typeof body.pageId !== "string" || body.pageId.trim().length === 0) {
    res.status(400).json({ error: "pageId (non-empty string) is required" });
    return;
  }
  const limit = clampLimit(body.limit, DEFAULT_LIMIT, MAX_LIMIT);

  try {
    const related = await matchRelatedPages(userId, body.pageId, limit);
    res.json({ related });
  } catch {
    res.status(500).json({ error: "Failed to compute related pages" });
  }
}
