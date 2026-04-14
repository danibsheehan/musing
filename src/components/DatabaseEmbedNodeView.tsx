import { Link } from "react-router-dom";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useEffect, useRef } from "react";
import { useWorkspace } from "../context/useWorkspace";
import { findDatabaseOwnerPage } from "../lib/findDatabaseOwnerPage";
import { parseDatabaseEmbedPayload } from "../lib/databaseEmbed";
import DatabaseTableView from "./DatabaseTableView";

/**
 * Linked database block inside the single-page TipTap document (node view).
 */
export default function DatabaseEmbedNodeView({
  node,
  editor,
  getPos,
  selected,
}: NodeViewProps) {
  const payload = parseDatabaseEmbedPayload(node.attrs.payload as string);
  const { pages, getDatabase, updateDatabase } = useWorkspace();
  const db = payload ? getDatabase(payload.databaseId) : null;
  const owner = payload ? findDatabaseOwnerPage(pages, payload.databaseId) : undefined;
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" || !selected) return;

      const ae = document.activeElement;
      if (ae && el.contains(ae)) {
        if (
          ae instanceof HTMLInputElement ||
          ae instanceof HTMLTextAreaElement ||
          ae instanceof HTMLSelectElement
        ) {
          return;
        }
        if (ae instanceof HTMLElement && ae.isContentEditable) {
          return;
        }
      }

      e.preventDefault();
      e.stopPropagation();
      const pos = getPos?.();
      if (pos === undefined) return;
      editor
        .chain()
        .focus()
        .deleteRange({ from: pos, to: pos + node.nodeSize })
        .run();
    };

    el.addEventListener("keydown", onKeyDown, true);
    return () => el.removeEventListener("keydown", onKeyDown, true);
  }, [selected, editor, getPos, node.nodeSize]);

  return (
    <NodeViewWrapper className="database-embed-node-view-root" data-drag-handle="">
      <div
        ref={rootRef}
        className={`database-embed-block${selected ? " database-embed-focused" : ""}`}
        tabIndex={0}
        role="group"
        aria-label="Linked database"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const pos = getPos?.();
            if (pos === undefined) return;
            editor
              .chain()
              .focus()
              .insertContentAt(pos + node.nodeSize, "<p></p>")
              .run();
          }
        }}
      >
        {!payload || !db ? (
          <p className="database-embed-broken">Linked database missing.</p>
        ) : (
          <>
            <div className="database-embed-toolbar">
              {owner && (
                <Link to={`/page/${owner.id}`} className="database-embed-open-link">
                  Open as page
                </Link>
              )}
            </div>
            <DatabaseTableView
              database={db}
              onChange={(next) => updateDatabase(db.id, () => next)}
            />
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
}
