import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import {
  CAPS,
  currentPeriodStart,
  usageForProvider,
  type AiUsageRow,
} from "../middleware/budget.js";

export async function usageHandler(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Missing authenticated user" });
    return;
  }

  const { data: row, error } = await supabaseAdmin
    .from("ai_usage")
    .select(
      "period_start, anthropic_tokens_used, anthropic_requests_used, voyage_tokens_used, voyage_requests_used",
    )
    .eq("user_id", userId)
    .maybeSingle<AiUsageRow>();

  if (error) {
    res.status(500).json({ error: "Failed to read usage" });
    return;
  }

  const anthropicUsage = usageForProvider(row, "anthropic");
  const voyageUsage = usageForProvider(row, "voyage");

  res.json({
    periodStart: currentPeriodStart(),
    anthropic: { ...anthropicUsage, ...CAPS.anthropic },
    voyage: { ...voyageUsage, ...CAPS.voyage },
  });
}
