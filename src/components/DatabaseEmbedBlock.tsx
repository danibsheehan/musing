import { Link } from "react-router-dom";
import { useWorkspace } from "../context/useWorkspace";
import { findDatabaseOwnerPage } from "../lib/findDatabaseOwnerPage";
import { parseDatabaseEmbedPayload } from "../lib/databaseEmbed";
import type { Block as BlockType } from "../types/block";
import DatabaseTableView from "./DatabaseTableView";

type Props = {
  block: BlockType;
  isFocused: boolean;
  setFocusedBlockId: (id: string) => void;
  onBackspace: (id: string) => void;
  onEnter: (id: string) => void;
};

export default function DatabaseEmbedBlock({
  block,
  isFocused,
  setFocusedBlockId,
  onBackspace,
  onEnter,
}: Props) {
  const { pages, getDatabase, updateDatabase } = useWorkspace();
  const payload = parseDatabaseEmbedPayload(block.content);
  const db = payload ? getDatabase(payload.databaseId) : null;
  const owner = payload ? findDatabaseOwnerPage(pages, payload.databaseId) : undefined;

  return (
    <div
      className={`database-embed-block${isFocused ? " database-embed-focused" : ""}`}
      tabIndex={0}
      role="group"
      aria-label="Linked database"
      onClick={() => setFocusedBlockId(block.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onEnter(block.id);
          return;
        }
        if (e.key === "Backspace" && e.currentTarget === e.target) {
          e.preventDefault();
          onBackspace(block.id);
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
