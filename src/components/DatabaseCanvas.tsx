import { useWorkspace } from "../context/useWorkspace";
import DatabaseTableView from "./DatabaseTableView";

type Props = { databaseId: string };

export default function DatabaseCanvas({ databaseId }: Props) {
  const { getDatabase, updateDatabase } = useWorkspace();
  const db = getDatabase(databaseId);
  if (!db) {
    return <p className="database-missing">This database no longer exists.</p>;
  }

  return (
    <div className="database-canvas">
      <DatabaseTableView
        database={db}
        onChange={(next) => updateDatabase(databaseId, () => next)}
      />
    </div>
  );
}
