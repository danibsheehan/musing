import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { useWorkspace } from "../context/useWorkspace";
import { getUsage, isAiServiceConfigured, type UsageResult } from "../lib/aiClient";
import Sidebar from "./Sidebar";
import ThemePreferenceSelect from "./ThemePreferenceSelect";

function RemoteSyncBadge() {
  const { remoteSyncStatus, remoteSyncError } = useWorkspace();

  if (remoteSyncStatus === "disabled") return null;

  const label =
    remoteSyncStatus === "connecting"
      ? "Cloud: connecting…"
      : remoteSyncStatus === "synced"
        ? "Cloud: saved"
        : "Cloud: error";

  return (
    <div
      className={`remote-sync-badge remote-sync-${remoteSyncStatus}`}
      title={remoteSyncError ?? undefined}
      role="status"
    >
      {label}
      {remoteSyncStatus === "error" && remoteSyncError ? (
        <span className="remote-sync-detail"> — {remoteSyncError}</span>
      ) : null}
    </div>
  );
}

function pctUsed(used: number, cap: number): number {
  return cap > 0 ? Math.round((used / cap) * 100) : 0;
}

function AiUsageBadge() {
  const [usage, setUsage] = useState<UsageResult | null>(null);

  useEffect(() => {
    if (!isAiServiceConfigured()) return;
    getUsage()
      .then(setUsage)
      .catch((err: unknown) => {
        console.error("Failed to load AI usage", err);
      });
  }, []);

  if (!usage) return null;

  const anthropicPct = pctUsed(usage.anthropic.tokens, usage.anthropic.monthlyTokenCap);
  const voyagePct = pctUsed(usage.voyage.tokens, usage.voyage.monthlyTokenCap);
  const pct = Math.max(anthropicPct, voyagePct);

  const detail =
    `Chat: ${usage.anthropic.tokens}/${usage.anthropic.monthlyTokenCap} tokens, ` +
    `${usage.anthropic.requests}/${usage.anthropic.monthlyRequestCap} requests — ` +
    `Embeddings: ${usage.voyage.tokens}/${usage.voyage.monthlyTokenCap} tokens, ` +
    `${usage.voyage.requests}/${usage.voyage.monthlyRequestCap} requests`;

  return (
    <div className="ai-usage-badge" title={detail} role="status">
      AI: {pct}% used
    </div>
  );
}

export default function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <header className="app-main-header">
          <ThemePreferenceSelect />
          <AiUsageBadge />
          <RemoteSyncBadge />
        </header>
        <Outlet />
      </div>
    </div>
  );
}
