import type { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

export type Provider = "anthropic" | "voyage";

function requiredCap(name: string): number {
  const raw = process.env[name];
  const value = Number(raw);
  if (!raw || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be set to a positive number`);
  }
  return value;
}

const CAPS: Record<Provider, { monthlyTokenCap: number; monthlyRequestCap: number }> = {
  anthropic: {
    monthlyTokenCap: requiredCap("AI_MONTHLY_TOKEN_CAP"),
    monthlyRequestCap: requiredCap("AI_MONTHLY_REQUEST_CAP"),
  },
  voyage: {
    monthlyTokenCap: requiredCap("VOYAGE_MONTHLY_TOKEN_CAP"),
    monthlyRequestCap: requiredCap("VOYAGE_MONTHLY_REQUEST_CAP"),
  },
};

type AiUsageRow = {
  period_start: string;
  anthropic_tokens_used: number;
  anthropic_requests_used: number;
  voyage_tokens_used: number;
  voyage_requests_used: number;
};

/** ai_usage.period_start matches Postgres's date_trunc('month', now()) — first of the current UTC month. */
function currentPeriodStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function usageForProvider(
  row: AiUsageRow | null,
  provider: Provider,
): { tokens: number; requests: number } {
  if (!row || row.period_start !== currentPeriodStart()) {
    return { tokens: 0, requests: 0 };
  }
  return provider === "anthropic"
    ? { tokens: row.anthropic_tokens_used, requests: row.anthropic_requests_used }
    : { tokens: row.voyage_tokens_used, requests: row.voyage_requests_used };
}

/** 429s before an LLM call is made if the user's current-month usage is at or over cap. */
export function requireBudget(provider: Provider) {
  return async function budgetMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
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

    const { tokens, requests } = usageForProvider(row, provider);
    const cap = CAPS[provider];

    if (tokens >= cap.monthlyTokenCap || requests >= cap.monthlyRequestCap) {
      res.status(429).json({ error: `Monthly ${provider} budget reached` });
      return;
    }

    next();
  };
}

/**
 * Increments post-call usage from the provider's actual response usage.
 * Not atomic under concurrent requests from the same user — acceptable for a
 * single/small-user app; revisit with a Postgres increment function if that changes.
 */
export async function recordUsage(
  userId: string,
  provider: Provider,
  tokensUsed: number,
): Promise<void> {
  const period = currentPeriodStart();

  const { data: row } = await supabaseAdmin
    .from("ai_usage")
    .select(
      "period_start, anthropic_tokens_used, anthropic_requests_used, voyage_tokens_used, voyage_requests_used",
    )
    .eq("user_id", userId)
    .maybeSingle<AiUsageRow>();

  const current = usageForProvider(row, provider);
  const next = { tokens: current.tokens + tokensUsed, requests: current.requests + 1 };

  const base =
    row && row.period_start === period
      ? row
      : {
          period_start: period,
          anthropic_tokens_used: 0,
          anthropic_requests_used: 0,
          voyage_tokens_used: 0,
          voyage_requests_used: 0,
        };

  await supabaseAdmin.from("ai_usage").upsert(
    {
      user_id: userId,
      period_start: period,
      anthropic_tokens_used: provider === "anthropic" ? next.tokens : base.anthropic_tokens_used,
      anthropic_requests_used:
        provider === "anthropic" ? next.requests : base.anthropic_requests_used,
      voyage_tokens_used: provider === "voyage" ? next.tokens : base.voyage_tokens_used,
      voyage_requests_used: provider === "voyage" ? next.requests : base.voyage_requests_used,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}
