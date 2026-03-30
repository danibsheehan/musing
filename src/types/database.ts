export type DatabasePropertyType = "title" | "text";

export type DatabaseProperty = {
  id: string;
  name: string;
  type: DatabasePropertyType;
};

export type DatabaseRow = {
  id: string;
  values: Record<string, string>;
};

export type DatabaseView = {
  id: string;
  name: string;
  type: "table";
};

/** Canonical database entity; referenced by full-page pages and inline embed blocks. */
export type WorkspaceDatabase = {
  id: string;
  title: string;
  properties: DatabaseProperty[];
  rows: DatabaseRow[];
  views: DatabaseView[];
};
