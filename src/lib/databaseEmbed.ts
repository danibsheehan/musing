export type DatabaseEmbedPayload = {
  databaseId: string;
  viewId: string | null;
};

export function stringifyDatabaseEmbedPayload(
  databaseId: string,
  viewId?: string | null
): string {
  const payload: DatabaseEmbedPayload = {
    databaseId,
    viewId: viewId ?? null,
  };
  return JSON.stringify(payload);
}

export function parseDatabaseEmbedPayload(content: string): DatabaseEmbedPayload | null {
  try {
    const raw = JSON.parse(content) as unknown;
    if (typeof raw !== "object" || raw === null) return null;
    const o = raw as Record<string, unknown>;
    if (typeof o.databaseId !== "string") return null;
    const viewId = o.viewId;
    return {
      databaseId: o.databaseId,
      viewId: typeof viewId === "string" ? viewId : null,
    };
  } catch {
    return null;
  }
}
