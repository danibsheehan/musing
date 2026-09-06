import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Block } from "../types/block";
import type { WorkspaceDatabase } from "../types/database";
import type { Page } from "../types/page";
import { stringifyDatabaseEmbedPayload } from "./databaseEmbed";
import { downloadPageAsDocx } from "./downloadPageDocx";
import { sanitizeExportBasename } from "./sanitizeExportFilename";

const page = (overrides: Partial<Page> = {}): Page => ({
  id: "page-a",
  title: "My Page",
  parentId: null,
  order: 0,
  updatedAt: "",
  layout: "document",
  databaseId: null,
  blocks: [],
  ...overrides,
});

const database = (overrides: Partial<WorkspaceDatabase> = {}): WorkspaceDatabase => ({
  id: "db1",
  title: "Tasks",
  properties: [{ id: "name", name: "Name", type: "title" }],
  rows: [{ id: "r1", values: { name: "Buy milk" } }],
  views: [],
  ...overrides,
});

describe("downloadPageAsDocx", () => {
  let clickedAnchor: HTMLAnchorElement | undefined;

  beforeEach(() => {
    clickedAnchor = undefined;
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName === "a") clickedAnchor = el as HTMLAnchorElement;
      return el;
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("triggers a download with the sanitized filename", async () => {
    const p = page({ title: "My Page/Title" });
    await downloadPageAsDocx(p, () => undefined);

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickedAnchor).toBeDefined();
    expect(clickedAnchor!.href).toContain("blob:mock-url");
    expect(clickedAnchor!.download).toBe(`${sanitizeExportBasename("My Page/Title")}.docx`);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("falls back to 'Untitled' for a blank title", async () => {
    const p = page({ title: "   " });
    await downloadPageAsDocx(p, () => undefined);
    expect(clickedAnchor!.download).toBe("Untitled.docx");
  });

  it("resolves for a database-layout page with an existing database", async () => {
    const db = database();
    const p = page({ layout: "database", databaseId: "db1" });
    await expect(
      downloadPageAsDocx(p, (id) => (id === "db1" ? db : undefined)),
    ).resolves.toBeUndefined();
  });

  it("resolves for a database-layout page whose database no longer exists", async () => {
    const p = page({ layout: "database", databaseId: "missing" });
    await expect(downloadPageAsDocx(p, () => undefined)).resolves.toBeUndefined();
  });

  it("resolves for blocks covering every databaseEmbed and horizontal-rule branch", async () => {
    const db = database();
    const blocks: Block[] = [
      { id: "b1", type: "paragraph", content: "<p>Hello</p>" },
      { id: "b2", type: "databaseEmbed", content: stringifyDatabaseEmbedPayload("db1") },
      { id: "b3", type: "databaseEmbed", content: stringifyDatabaseEmbedPayload("missing") },
      { id: "b4", type: "databaseEmbed", content: "not json" },
      { id: "b5", type: "horizontalRule", content: "" },
    ];
    const p = page({ blocks });
    await expect(
      downloadPageAsDocx(p, (id) => (id === "db1" ? db : undefined)),
    ).resolves.toBeUndefined();
  });
});
