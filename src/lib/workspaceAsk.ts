import { getSupabase } from "./supabaseClient";

export type AskChatMessage = { role: "user" | "assistant"; content: string };

export type WorkspaceAskResult = {
  answer: string;
  truncated: boolean;
};

/**
 * Calls the Supabase Edge Function `workspace-ask` with JWT from the current session.
 * Requires cloud sync (anonymous session is enough).
 */
export async function invokeWorkspaceAsk(messages: AskChatMessage[]): Promise<WorkspaceAskResult> {
  const supabase = getSupabase();
  const {
    data: { session: initialSession },
  } = await supabase.auth.getSession();
  if (!initialSession?.access_token) {
    throw new Error("No session. Enable Supabase cloud sync to use Ask.");
  }

  // Stale access tokens yield 401 from the Edge gateway (verify_jwt). Refresh before each call.
  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  const accessToken =
    !refreshError && refreshed.session?.access_token
      ? refreshed.session.access_token
      : initialSession.access_token;

  const { data, error } = await supabase.functions.invoke<{
    answer?: string;
    truncated?: boolean;
    error?: string;
    detail?: string;
  }>("workspace-ask", {
    body: { messages },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) {
    let msg = error.message;
    const ctx = "context" in error ? error.context : undefined;
    if (ctx instanceof Response) {
      try {
        const j = (await ctx.json()) as { error?: string; detail?: string };
        if (j.detail) msg = `${j.error ?? "Request failed"}: ${j.detail}`;
        else if (j.error) msg = j.error;
      } catch {
        /* keep msg */
      }
    }
    throw new Error(msg);
  }

  if (data && typeof data === "object" && "error" in data && data.error) {
    const d = data as { error: string; detail?: string };
    throw new Error(d.detail ? `${d.error}: ${d.detail}` : String(d.error));
  }

  if (!data?.answer || typeof data.answer !== "string") {
    throw new Error("No answer from assistant");
  }

  return {
    answer: data.answer,
    truncated: Boolean(data.truncated),
  };
}
