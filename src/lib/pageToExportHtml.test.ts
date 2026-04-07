import { describe, expect, it } from "vitest";
import type { Block } from "../types/block";
import type { Page } from "../types/page";
import type { WorkspaceDatabase } from "../types/database";
import { stringifyDatabaseEmbedPayload } from "./databaseEmbed";
import { databaseToExportTableHtml, pageToExportHtml } from "./pageToExportHtml";

const paragraph = (content: string): Block => ({
  id: "b1",
  type: "paragraph",
  content,
});

const sampleDb = (id: string): WorkspaceDatabase => ({
  id,
  title: "DB",
  properties: [
    { id: "c1", name: "Name", type: "title" },
    { id: "c2", name: "Note", type: "text" },
  ],
  rows: [{ id: "r1", values: { c1: "A & B", c2: "<ok>" } }],
  views: [{ id: "v1", name: "Default", type: "table" }],
});

describe("databaseToExportTableHtml", () => {
  it("escapes header and cell text", () => {
    const html = databaseToExportTableHtml(sampleDb("db1"));
    expect(html).toContain("&amp;");
    expect(html).toContain("&lt;ok&gt;");
    expect(html).toContain("A &amp; B");
  });

  it("renders an empty table body when there are no rows", () => {
    const db: WorkspaceDatabase = {
      ...sampleDb("db1"),
      rows: [],
    };
    const html = databaseToExportTableHtml(db);
    expect(html).toContain("No rows yet");
    expect(html).toMatch(/colspan="\d+"/);
  });
});

describe("pageToExportHtml", () => {
  const docPage = (overrides: Partial<Page> = {}): Page => ({
    id: "p1",
    title: 'Title <script>',
    parentId: null,
    order: 0,
    updatedAt: "",
    layout: "document",
    databaseId: null,
    blocks: [paragraph("<p>Body</p>")],
    ...overrides,
  });

  it("escapes the page title in the heading", () => {
    const html = pageToExportHtml(docPage(), () => undefined);
    expect(html).toContain("Title &lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("uses Untitled when the title is blank", () => {
    const html = pageToExportHtml(docPage({ title: "   " }), () => undefined);
    expect(html).toContain(">Untitled<");
  });

  it("embeds database HTML for database layout pages", () => {
    const db = sampleDb("db-1");
    const page: Page = {
      ...docPage({ title: "Sheet", layout: "database", databaseId: "db-1", blocks: [] }),
    };
    const html = pageToExportHtml(page, (id) => (id === "db-1" ? db : undefined));
    expect(html).toContain("pdf-db-full");
    expect(html).toContain("Sheet");
    expect(html).toContain("pdf-export-table");
  });

  it("shows missing message when database layout references a removed database", () => {
    const page: Page = {
      ...docPage({ title: "Gone", layout: "database", databaseId: "missing", blocks: [] }),
    };
    const html = pageToExportHtml(page, () => undefined);
    expect(html).toContain("This database no longer exists.");
  });

  it("renders database embed blocks and handles invalid or missing databases", () => {
    const db = sampleDb("db-1");
    const blocks: Block[] = [
      {
        id: "e1",
        type: "databaseEmbed",
        content: stringifyDatabaseEmbedPayload("db-1"),
      },
      { id: "e2", type: "databaseEmbed", content: "not-json" },
      {
        id: "e3",
        type: "databaseEmbed",
        content: stringifyDatabaseEmbedPayload("ghost"),
      },
      { id: "hr", type: "horizontalRule", content: "" },
    ];
    const html = pageToExportHtml(docPage({ blocks }), (id) => (id === "db-1" ? db : undefined));
    expect(html).toContain("pdf-db-embed");
    expect(html).toContain("Invalid database embed.");
    expect(html).toContain("Linked database missing.");
    expect(html).toContain('class="pdf-hr"');
  });
});
