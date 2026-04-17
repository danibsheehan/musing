import { Outlet } from "react-router-dom";
import { useWorkspace } from "../context/useWorkspace";
import Sidebar from "./Sidebar";
import ThemePreferenceSelect from "./ThemePreferenceSelect";
import WorkspaceAskPanel from "./WorkspaceAskPanel";

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

export default function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <header className="app-main-header">
          <ThemePreferenceSelect />
          <div className="app-main-header-end">
            <WorkspaceAskPanel />
            <RemoteSyncBadge />
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
