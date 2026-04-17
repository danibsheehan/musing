import { useCallback, useId, useRef, useState, type KeyboardEvent } from "react";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { invokeWorkspaceAsk, type AskChatMessage } from "../lib/workspaceAsk";
import { useWorkspace } from "../context/useWorkspace";

export default function WorkspaceAskPanel() {
  const headingId = useId();
  const { remoteSyncStatus, remoteSyncError, flushRemoteWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AskChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextTruncated, setContextTruncated] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const canUseAsk =
    isSupabaseConfigured() && remoteSyncStatus === "synced" && !remoteSyncError;

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const newChat = useCallback(() => {
    setMessages([]);
    setError(null);
    setContextTruncated(false);
    setInput("");
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || !canUseAsk) return;

    const nextMessages: AskChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      await flushRemoteWorkspace();
      const { answer, truncated } = await invokeWorkspaceAsk(nextMessages);
      setMessages([...nextMessages, { role: "assistant", content: answer }]);
      setContextTruncated(truncated);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [input, loading, canUseAsk, messages, flushRemoteWorkspace]);

  const onKeyDown = (ev: KeyboardEvent<HTMLTextAreaElement>) => {
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      void send();
    }
  };

  return (
    <>
      <button
        type="button"
        className="workspace-ask-toggle"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? "workspace-ask-dialog" : undefined}
      >
        Ask
      </button>

      {open ? (
        <div className="workspace-ask-root" role="presentation">
          <button
            type="button"
            className="workspace-ask-backdrop"
            aria-label="Close Ask panel"
            onClick={close}
          />
          <div
            id="workspace-ask-dialog"
            className="workspace-ask-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
          >
            <div className="workspace-ask-panel-header">
              <h2 id={headingId} className="workspace-ask-title">
                Ask your notes
              </h2>
              <div className="workspace-ask-header-actions">
                <button type="button" className="workspace-ask-secondary" onClick={newChat}>
                  New chat
                </button>
                <button type="button" className="workspace-ask-secondary" onClick={close}>
                  Close
                </button>
              </div>
            </div>

            <p className="workspace-ask-disclosure">
              Answers use your synced document pages (not database tables). Text is sent to Supabase,
              then to the configured AI provider. Large workspaces are truncated to limit cost.
            </p>

            {!isSupabaseConfigured() || remoteSyncStatus === "disabled" ? (
              <p className="workspace-ask-warning">
                Ask requires cloud sync. Set <code>VITE_SUPABASE_URL</code> and{" "}
                <code>VITE_SUPABASE_ANON_KEY</code>, then reload.
              </p>
            ) : null}

            {remoteSyncStatus === "connecting" ? (
              <p className="workspace-ask-warning">Connecting to cloud… try again in a moment.</p>
            ) : null}

            {remoteSyncStatus === "error" && remoteSyncError ? (
              <p className="workspace-ask-warning">Cloud sync error: {remoteSyncError}</p>
            ) : null}

            {contextTruncated ? (
              <p className="workspace-ask-truncation" role="status">
                Last reply used truncated notes (older pages may be omitted).
              </p>
            ) : null}

            <div className="workspace-ask-messages" ref={listRef}>
              {messages.length === 0 ? (
                <p className="workspace-ask-empty">Ask a question about your notes.</p>
              ) : (
                messages.map((m, i) => (
                  <div
                    key={`${i}-${m.role}-${m.content.slice(0, 24)}`}
                    className={`workspace-ask-bubble workspace-ask-bubble-${m.role}`}
                  >
                    {m.content}
                  </div>
                ))
              )}
            </div>

            {error ? (
              <p className="workspace-ask-error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="workspace-ask-compose">
              <textarea
                className="workspace-ask-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Message… (Enter to send, Shift+Enter for newline)"
                rows={3}
                disabled={loading || !canUseAsk}
                aria-label="Message"
              />
              <button
                type="button"
                className="workspace-ask-send"
                onClick={() => void send()}
                disabled={loading || !canUseAsk || !input.trim()}
              >
                {loading ? "…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
