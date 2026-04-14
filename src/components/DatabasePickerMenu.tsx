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
      className="musing-dropdown musing-dropdown--picker"
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
      }}
    >
      {databases.length === 0 ? (
        <div className="musing-dropdown-empty musing-dropdown-empty--sm">
          Create a database page from the sidebar first
        </div>
      ) : (
        databases.map((db, index) => (
          <div
            key={db.id}
            role="option"
            aria-selected={selectedIndex === index}
            className="musing-dropdown-option"
            onClick={() => onSelect(db)}
          >
            {db.title}
          </div>
        ))
      )}
    </div>
  );
}
