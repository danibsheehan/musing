import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { buildCappedNotesContext } from "../_shared/workspaceNotes.ts";

/** Match `@supabase/supabase-js/cors` so browser preflight succeeds (Allow-Methods is required). */
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

const MAX_CHAT_MESSAGES = 24;

type ChatMessage = { role: string; content: string };

/** Parse OpenAI error JSON so the client can show quota / model / key issues (not hidden behind a generic 502). */
function openAiFailureDetail(status: number, bodyText: string): string {
  const raw = bodyText.trim().slice(0, 1500);
  try {
    const j = JSON.parse(bodyText) as {
      error?: { message?: string; type?: string; code?: string };
    };
    const e = j.error;
    if (e && typeof e.message === "string" && e.message.length > 0) {
      const parts = [e.message];
      if (e.type) parts.unshift(`[${e.type}]`);
      if (e.code) parts.push(`code=${e.code}`);
      return `${status} ${parts.join(" ")}`.slice(0, 1500);
    }
  } catch {
    /* ignore */
  }
  return `${status} ${raw}`.slice(0, 1500);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: row, error: rowError } = await supabase
      .from("workspaces")
      .select("snapshot")
      .maybeSingle();

    if (rowError) throw rowError;

    if (!row?.snapshot) {
      return new Response(JSON.stringify({ error: "No workspace found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as { messages?: ChatMessage[] };
    const messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const windowed = messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-MAX_CHAT_MESSAGES);

    if (windowed.length === 0 || windowed[windowed.length - 1].role !== "user") {
      return new Response(JSON.stringify({ error: "Last message must be from the user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text: notesContext, truncated } = buildCappedNotesContext(row.snapshot);

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Ask is not configured (missing OPENAI_API_KEY on the function)" }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";

    const systemContent = `You help the user understand their personal notes. Answer ONLY using the NOTES section below. If the notes do not contain the answer, say clearly that you cannot find it in the notes. Be concise.

${
  truncated
    ? "The NOTES may be incomplete: older or lower-priority pages were omitted to stay within a size limit. Say so if the user asks about something that might live outside what you see.\n\n"
    : ""
}NOTES:
---
${notesContext}
---`;

    const openaiMessages = [
      { role: "system" as const, content: systemContent },
      ...windowed.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: openaiMessages,
        max_tokens: 2048,
        temperature: 0.35,
      }),
    });

    if (!completion.ok) {
      const errText = await completion.text();
      const detail = openAiFailureDetail(completion.status, errText);
      console.error("OpenAI error", detail);
      return new Response(
        JSON.stringify({
          error: "Assistant request failed",
          detail,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const json = (await completion.json()) as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    };
    const answer = json.choices?.[0]?.message?.content;
    if (!answer || typeof answer !== "string") {
      const fr = json.choices?.[0]?.finish_reason;
      return new Response(
        JSON.stringify({
          error: "Invalid assistant response",
          detail: `Empty or non-text reply${fr ? ` (finish_reason=${fr})` : ""}.`,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ answer, truncated }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
