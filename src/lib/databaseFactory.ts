import { v4 as uuidv4 } from "uuid";
import type { WorkspaceDatabase } from "../types/database";

export function createWorkspaceDatabase(id: string): WorkspaceDatabase {
  const namePropId = uuidv4();
  const viewId = uuidv4();
  return {
    id,
    title: "New database",
    properties: [{ id: namePropId, name: "Name", type: "title" }],
    rows: [],
    views: [{ id: viewId, name: "Default", type: "table" }],
  };
}
