import { v4 as uuidv4 } from "uuid";
import type { WorkspaceDatabase } from "../types/database";

type Props = {
  database: WorkspaceDatabase;
  readOnly?: boolean;
  onChange?: (next: WorkspaceDatabase) => void;
  className?: string;
};

export default function DatabaseTableView({
  database,
  readOnly,
  onChange,
  className,
}: Props) {
  const addRow = () => {
    if (!onChange || readOnly) return;
    const empty: Record<string, string> = {};
    for (const p of database.properties) {
      empty[p.id] = "";
    }
    onChange({
      ...database,
      rows: [...database.rows, { id: uuidv4(), values: empty }],
    });
  };

  const setCell = (rowId: string, propId: string, value: string) => {
    if (!onChange || readOnly) return;
    onChange({
      ...database,
      rows: database.rows.map((r) =>
        r.id === rowId ? { ...r, values: { ...r.values, [propId]: value } } : r
      ),
    });
  };

  const colCount = Math.max(1, database.properties.length);

  return (
    <div className={className ?? "database-table-view"}>
      <table className="database-table">
        <thead>
          <tr>
            {database.properties.map((col) => (
              <th key={col.id}>{col.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {database.rows.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="database-table-empty">
                No rows yet
              </td>
            </tr>
          ) : (
            database.rows.map((row) => (
              <tr key={row.id}>
                {database.properties.map((col) => (
                  <td key={col.id}>
                    <input
                      type="text"
                      className="database-cell-input"
                      readOnly={readOnly}
                      value={row.values[col.id] ?? ""}
                      onChange={(e) => setCell(row.id, col.id, e.target.value)}
                      aria-label={`${col.name} cell`}
                    />
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {!readOnly && onChange && (
        <button type="button" className="database-add-row" onClick={addRow}>
          + New row
        </button>
      )}
    </div>
  );
}
