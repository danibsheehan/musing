import { Link } from "react-router-dom";
import { useEffect, useRef, type RefObject } from "react";
import { useWorkspace } from "../context/useWorkspace";
import { findDatabaseOwnerPage } from "../lib/findDatabaseOwnerPage";
import { parseDatabaseEmbedPayload } from "../lib/databaseEmbed";
import type { AddBlockAfterEnterOptions, Block as BlockType } from "../types/block";
import DatabaseTableView from "./DatabaseTableView";

type Props = {
  block: BlockType;
  isFocused: boolean;
  setFocusedBlockId: (id: string) => void;
  onBackspace: (id: string) => void;
  onEnter: (id: string, options?: AddBlockAfterEnterOptions) => void;
  /** Unused for embed blocks; accepted so `Block` can spread document props. */
  onConfirmSlashCommand?: (blockId: string) => void;
  onConfirmPagePickerCommand?: (blockId: string) => void;
  onSlashMenuOpenChange?: (blockId: string | null) => void;
  isPostSlashNewRowLocked?: (blockId: string) => boolean;
  /** Unused; accepted so `Block` can spread document props. */
  slashTypeSyncedInEditorRef?: RefObject<string | null>;
  /** Unused; accepted so `Block` can spread document props. */
  setSlashMenuQuery?: (query: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveBlockDelta: (id: string, delta: -1 | 1) => void;
  /** Passed through from `Block`; unused for embed rows. */
  pageBlockCount?: number;
  /** Passed through from `Block`. */
  onClearBlockSelection?: () => void;
};

export default function DatabaseEmbedBlock({
  block,
  isFocused,
  setFocusedBlockId,
  onBackspace,
  onEnter,
  isPostSlashNewRowLocked,
  canMoveUp,
  canMoveDown,
  onMoveBlockDelta,
  onClearBlockSelection,
}: Props) {
  const { pages, getDatabase, updateDatabase } = useWorkspace();
  const payload = parseDatabaseEmbedPayload(block.content);
  const db = payload ? getDatabase(payload.databaseId) : null;
  const owner = payload ? findDatabaseOwnerPage(pages, payload.databaseId) : undefined;
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" || !isFocused) return;

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
      onBackspace(block.id);
    };

    el.addEventListener("keydown", onKeyDown, true);
    return () => el.removeEventListener("keydown", onKeyDown, true);
  }, [isFocused, block.id, onBackspace]);

  return (
    <div
      ref={rootRef}
      className={`database-embed-block${isFocused ? " database-embed-focused" : ""}`}
      tabIndex={0}
      role="group"
      aria-label="Linked database"
      onPointerDownCapture={() => onClearBlockSelection?.()}
      onClick={() => setFocusedBlockId(block.id)}
      onKeyDown={(e) => {
        if (e.altKey && !e.metaKey && !e.ctrlKey) {
          if (e.key === "ArrowUp" && canMoveUp) {
            e.preventDefault();
            onMoveBlockDelta(block.id, -1);
            return;
          }
          if (e.key === "ArrowDown" && canMoveDown) {
            e.preventDefault();
            onMoveBlockDelta(block.id, 1);
            return;
          }
        }
        if (e.key === "Enter") {
          e.preventDefault();
          if (isPostSlashNewRowLocked?.(block.id)) return;
          onEnter(block.id);
          return;
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
  );
}
