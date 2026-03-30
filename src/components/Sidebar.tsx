import { useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { useWorkspace } from "../context/useWorkspace";
import { subtreeIds } from "../lib/workspaceTree";
import type { Page } from "../types/page";

function PageTreeRows({
  parentId,
  depth,
  renamingId,
  setRenamingId,
  renameDraft,
  setRenameDraft,
}: {
  parentId: string | null;
  depth: number;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
  renameDraft: string;
  setRenameDraft: (s: string) => void;
}) {
  const {
    childrenOf,
    createPage,
    deletePageSubtree,
    movePageWithinSiblings,
    updatePageTitle,
    pages: allPages,
  } = useWorkspace();
  const navigate = useNavigate();
  const { pageId: activeId } = useParams<{ pageId: string }>();
  const pages = childrenOf(parentId);

  const beginRename = (p: Page) => {
    setRenamingId(p.id);
    setRenameDraft(p.title);
  };

  const commitRename = (id: string) => {
    const t = renameDraft.trim() || "Untitled";
    updatePageTitle(id, t);
    setRenamingId(null);
  };

  return (
    <ul className="sidebar-tree" role="list" style={{ paddingLeft: depth === 0 ? 0 : 12 }}>
      {pages.map((p) => {
        const children = childrenOf(p.id);
        const sibs = childrenOf(p.parentId);
        const idx = sibs.findIndex((x) => x.id === p.id);
        const canUp = idx > 0;
        const canDown = idx >= 0 && idx < sibs.length - 1;

        return (
          <li key={p.id} className="sidebar-tree-item">
            <div className="sidebar-row">
              {renamingId === p.id ? (
                <input
                  className="sidebar-rename-input"
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onBlur={() => commitRename(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (e.target as HTMLInputElement).blur();
                    }
                    if (e.key === "Escape") {
                      setRenamingId(null);
                    }
                  }}
                  autoFocus
                  aria-label="Rename page"
                />
              ) : (
                <NavLink
                  to={`/page/${p.id}`}
                  className={({ isActive }) =>
                    `sidebar-link${isActive ? " sidebar-link-active" : ""}`
                  }
                >
                  <span className="sidebar-link-text">{p.title || "Untitled"}</span>
                </NavLink>
              )}
              <span className="sidebar-row-actions">
                <button
                  type="button"
                  className="sidebar-icon-btn"
                  title="Move up"
                  disabled={!canUp}
                  onClick={() => movePageWithinSiblings(p.id, "up")}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="sidebar-icon-btn"
                  title="Move down"
                  disabled={!canDown}
                  onClick={() => movePageWithinSiblings(p.id, "down")}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="sidebar-icon-btn"
                  title="Rename"
                  onClick={() => beginRename(p)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="sidebar-icon-btn"
                  title="Add subpage"
                  onClick={() => {
                    const id = createPage(p.id);
                    navigate(`/page/${id}`);
                  }}
                >
                  +
                </button>
                <button
                  type="button"
                  className="sidebar-icon-btn sidebar-danger"
                  title="Delete page"
                  onClick={() => {
                    if (subtreeIds(allPages, p.id).size >= allPages.length) {
                      window.alert("You can't delete the last page.");
                      return;
                    }
                    if (
                      !window.confirm(
                        "Delete this page and everything inside it? This cannot be undone."
                      )
                    ) {
                      return;
                    }
                    const { fallbackPageId } = deletePageSubtree(p.id);
                    if (activeId === p.id && fallbackPageId) {
                      navigate(`/page/${fallbackPageId}`, { replace: true });
                    } else if (activeId === p.id && !fallbackPageId) {
                      navigate("/", { replace: true });
                    }
                  }}
                >
                  ×
                </button>
              </span>
            </div>
            {children.length > 0 && (
              <PageTreeRows
                parentId={p.id}
                depth={depth + 1}
                renamingId={renamingId}
                setRenamingId={setRenamingId}
                renameDraft={renameDraft}
                setRenameDraft={setRenameDraft}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function Sidebar() {
  const { createPage } = useWorkspace();
  const navigate = useNavigate();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  return (
    <aside className="app-sidebar">
      <div className="sidebar-header">
        <NavLink to="/" className="sidebar-brand" end>
          Pages
        </NavLink>
        <button
          type="button"
          className="sidebar-new-page"
          onClick={() => {
            const id = createPage(null);
            navigate(`/page/${id}`);
          }}
        >
          New page
        </button>
      </div>
      <PageTreeRows
        parentId={null}
        depth={0}
        renamingId={renamingId}
        setRenamingId={setRenamingId}
        renameDraft={renameDraft}
        setRenameDraft={setRenameDraft}
      />
    </aside>
  );
}
