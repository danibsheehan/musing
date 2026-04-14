import type { WorkspaceDatabase } from "../types/database";

type Props = {
  position: { top: number; left: number };
  databases: WorkspaceDatabase[];
  selectedIndex: number;
  onSelect: (db: WorkspaceDatabase) => void;
};

export default function DatabasePickerMenu({
  position,
  databases,
  selectedIndex,
  onSelect,
}: Props) {
  return (
    <div
      data-musing-database-picker-menu
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        background: "white",
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "8px",
        boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
        zIndex: 1000,
        minWidth: "12rem",
        maxHeight: "240px",
        overflowY: "auto",
      }}
    >
      {databases.length === 0 ? (
        <div style={{ padding: "4px 8px", color: "#666", fontSize: "0.85rem" }}>
          Create a database page from the sidebar first
        </div>
      ) : (
        databases.map((db, index) => (
          <div
            key={db.id}
            onClick={() => onSelect(db)}
            style={{
              padding: "4px 8px",
              backgroundColor: selectedIndex === index ? "#eee" : "transparent",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            {db.title}
          </div>
        ))
      )}
    </div>
  );
}
