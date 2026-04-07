import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { Page } from "../types/page";
import type { WorkspaceDatabase } from "../types/database";
import type { Block } from "../types/block";
import { parseDatabaseEmbedPayload } from "./databaseEmbed";
import { htmlFragmentToDocxBlocks } from "./htmlToDocx";
import { sanitizeExportBasename } from "./sanitizeExportFilename";

function databaseToDocxTable(db: WorkspaceDatabase): Table {
  const cols = db.properties;
  const colCount = Math.max(1, cols.length);
  const headerRow = new TableRow({
    tableHeader: true,
    children: cols.map(
      (c) =>
        new TableCell({
          shading: { fill: "E8E8E8", type: ShadingType.CLEAR },
          children: [
            new Paragraph({ children: [new TextRun({ text: c.name, bold: true })] }),
          ],
        })
    ),
  });
  const bodyRows =
    db.rows.length === 0
      ? [
          new TableRow({
            children: [
              new TableCell({
                columnSpan: colCount,
                children: [new Paragraph("No rows yet")],
              }),
            ],
          }),
        ]
      : db.rows.map(
          (row) =>
            new TableRow({
              children: cols.map(
                (c) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun(row.values[c.id] ?? "")],
                      }),
                    ],
                  })
              ),
            })
        );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows],
  });
}

function blockToDocx(
  block: Block,
  getDatabase: (id: string) => WorkspaceDatabase | undefined
): (Paragraph | Table)[] {
  switch (block.type) {
    case "databaseEmbed": {
      const payload = parseDatabaseEmbedPayload(block.content);
      if (!payload) {
        return [
          new Paragraph({
            children: [new TextRun({ text: "Invalid database embed.", italics: true })],
          }),
        ];
      }
      const db = getDatabase(payload.databaseId);
      if (!db) {
        return [
          new Paragraph({
            children: [new TextRun({ text: "Linked database missing.", italics: true })],
          }),
        ];
      }
      return [databaseToDocxTable(db)];
    }
    case "horizontalRule":
      return [new Paragraph({ thematicBreak: true, children: [new TextRun("")] })];
    default:
      return htmlFragmentToDocxBlocks(block.content);
  }
}

function pageToDocxChildren(
  page: Page,
  getDatabase: (id: string) => WorkspaceDatabase | undefined
): (Paragraph | Table)[] {
  const title = page.title.trim() || "Untitled";
  const out: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      text: title,
      spacing: { after: 280 },
    }),
  ];

  if (page.layout === "database" && page.databaseId) {
    const db = getDatabase(page.databaseId);
    if (!db) {
      out.push(
        new Paragraph({
          children: [
            new TextRun({ text: "This database no longer exists.", italics: true }),
          ],
        })
      );
    } else {
      out.push(databaseToDocxTable(db));
    }
    return out;
  }

  for (const block of page.blocks) {
    out.push(...blockToDocx(block, getDatabase));
  }
  return out;
}

export async function downloadPageAsDocx(
  page: Page,
  getDatabase: (id: string) => WorkspaceDatabase | undefined
): Promise<void> {
  const docTitle = page.title.trim() || "Untitled";
  const doc = new Document({
    creator: "musing",
    title: docTitle,
    sections: [
      {
        children: pageToDocxChildren(page, getDatabase),
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeExportBasename(page.title)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
