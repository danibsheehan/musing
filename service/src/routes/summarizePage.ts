import type { Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "../lib/anthropic.js";
import { sha256 } from "../lib/hash.js";
import { getCachedOutput, setCachedOutput } from "../lib/aiOutputsCache.js";
import { llmRateLimiter } from "../lib/tokenBucket.js";
import { recordUsage } from "../middleware/budget.js";
import { requireEnv } from "../lib/env.js";

type SummarizePageBody = { pageId?: unknown; content?: unknown };
type SummaryOutput = { summary: string };

/** Guards a single request's spend independent of the monthly budget check (prior usage only). */
const MAX_CONTENT_LENGTH = 20000;
const MAX_TOKENS = 512;

/**
 * Bump this when the prompt text below changes meaningfully, so previously-cached
 * summaries (keyed on content + model + this version) don't keep serving stale output.
 */
const PROMPT_VERSION = "v1";

function summaryInputHash(content: string, model: string): string {
  return sha256(`${PROMPT_VERSION}:${model}:${content}`);
}

export async function summarizePageHandler(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Missing authenticated user" });
    return;
  }

  const body = req.body as SummarizePageBody;
  if (
    typeof body.pageId !== "string" ||
    body.pageId.trim().length === 0 ||
    typeof body.content !== "string" ||
    body.content.trim().length === 0
  ) {
    res
      .status(400)
      .json({ error: "pageId (non-empty string) and content (non-empty string) are required" });
    return;
  }
  if (body.content.length > MAX_CONTENT_LENGTH) {
    res.status(400).json({
      error: `content too long (${body.content.length} > ${MAX_CONTENT_LENGTH} characters)`,
    });
    return;
  }

  const pageId = body.pageId;
  const content = body.content;
  const model = requireEnv("CHAT_MODEL");
  const inputHash = summaryInputHash(content, model);

  const cached = await getCachedOutput<SummaryOutput>(userId, pageId, "summary", inputHash);
  if (cached) {
    res.json({ summary: cached.summary, cached: true });
    return;
  }

  await llmRateLimiter.acquire();

  let response: Anthropic.Message;
  try {
    response = await getAnthropicClient().messages.create({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: `Summarize this note in 2-3 sentences:\n\n${content}` }],
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      res.status(502).json({ error: "Summarization provider request failed" });
      return;
    }
    throw error;
  }

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text",
  );
  const summary = textBlock?.text ?? "";
  const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

  // Record usage immediately once Anthropic is actually billed — mirrors embed-page's
  // ordering, so a downstream cache-write failure can't hide real spend from the budget cap.
  await recordUsage(userId, "anthropic", tokensUsed);

  if (!summary) {
    // Billed but nothing usable came back — don't cache an empty result forever.
    res.status(502).json({ error: "Summarization provider returned no summary text" });
    return;
  }

  await setCachedOutput(userId, pageId, "summary", inputHash, { summary });
  res.json({ summary, cached: false });
}
