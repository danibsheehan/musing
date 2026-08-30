import { getSupabase, isSupabaseConfigured } from "./supabaseClient";

const url = import.meta.env.VITE_AI_SERVICE_URL as string | undefined;

/** Every endpoint requires a Supabase session to authenticate as, so both must be configured. */
export function isAiServiceConfigured(): boolean {
  return Boolean(url && !url.includes("YOUR-SERVICE") && isSupabaseConfigured());
}

export class AiServiceError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AiServiceError";
    this.status = status;
  }
}

async function aiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isAiServiceConfigured() || !url) {
    throw new AiServiceError(0, "AI service is not configured");
  }

  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new AiServiceError(401, "No active Supabase session");
  }

  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  const body = (await response.json().catch(() => null)) as { error?: string } | T | null;

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : `AI service request failed (${response.status})`;
    throw new AiServiceError(response.status, message);
  }

  return body as T;
}

export type EmbedPageResult = { embedded: number; skipped: number; removed: number };
export type IncomingBlock = { id: string; type: string; content: string };

export function embedPage(pageId: string, blocks: IncomingBlock[]): Promise<EmbedPageResult> {
  return aiFetch<EmbedPageResult>("/api/embed-page", {
    method: "POST",
    body: JSON.stringify({ pageId, blocks }),
  });
}

export type SearchMatch = { pageId: string; blockId: string; similarity: number };
export type SearchResult = { matches: SearchMatch[] };

export function searchNotes(query: string, limit?: number): Promise<SearchResult> {
  return aiFetch<SearchResult>("/api/search", {
    method: "POST",
    body: JSON.stringify({ query, ...(limit ? { limit } : {}) }),
  });
}

export type SummarizeResult = { summary: string; cached: boolean };

export function summarizePage(pageId: string, content: string): Promise<SummarizeResult> {
  return aiFetch<SummarizeResult>("/api/summarize-page", {
    method: "POST",
    body: JSON.stringify({ pageId, content }),
  });
}

export type RelatedPageMatch = { pageId: string; similarity: number };
export type RelatedPagesResult = { related: RelatedPageMatch[] };

export function relatedPages(pageId: string, limit?: number): Promise<RelatedPagesResult> {
  return aiFetch<RelatedPagesResult>("/api/related-pages", {
    method: "POST",
    body: JSON.stringify({ pageId, ...(limit ? { limit } : {}) }),
  });
}

export type ProviderUsage = {
  tokens: number;
  requests: number;
  monthlyTokenCap: number;
  monthlyRequestCap: number;
};
export type UsageResult = {
  periodStart: string;
  anthropic: ProviderUsage;
  voyage: ProviderUsage;
};

export function getUsage(): Promise<UsageResult> {
  return aiFetch<UsageResult>("/api/usage", { method: "GET" });
}
