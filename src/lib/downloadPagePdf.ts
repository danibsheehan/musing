import type { Page } from "../types/page";
import type { WorkspaceDatabase } from "../types/database";
import { pageToExportHtml } from "./pageToExportHtml";
import { sanitizeExportBasename } from "./sanitizeExportFilename";

const PDF_EXPORT_STYLES = `
.pdf-root {
  box-sizing: border-box;
  font-family: system-ui, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.45;
  color: #111;
  background: #fff;
  padding: 8px 12px;
  max-width: 720px;
}
.pdf-page-title {
  font-size: 32px;
  font-weight: 700;
  line-height: 1.25;
  margin: 0 0 18px;
  padding-bottom: 14px;
  border-bottom: 2px solid #1a1a1a;
  color: #000;
  letter-spacing: 0.01em;
  -webkit-font-smoothing: antialiased;
}
.pdf-block { margin: 0 0 0.85rem; }
.pdf-block:last-child { margin-bottom: 0; }
.pdf-hr {
  border: none;
  border-top: 1px solid #ccc;
  margin: 1rem 0;
}
.pdf-embed-missing, .pdf-missing {
  color: #666;
  font-style: italic;
  margin: 0.5rem 0;
}
.pdf-export-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.pdf-export-table th,
.pdf-export-table td {
  border: 1px solid #ccc;
  padding: 6px 8px;
  text-align: left;
  vertical-align: top;
}
.pdf-export-table th {
  background: #f4f4f4;
  font-weight: 600;
}
.pdf-db-embed { overflow-x: auto; }
.pdf-db-full { margin-top: 0.5rem; }
.pdf-block pre {
  background: #f4f3ec;
  padding: 0.65rem 0.85rem;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 0.88em;
}
.pdf-block code {
  font-family: ui-monospace, Consolas, monospace;
}
.pdf-block blockquote {
  margin: 0.5rem 0;
  padding-left: 1rem;
  border-left: 3px solid #ccc;
  color: #333;
}
`;

export async function downloadPageAsPdf(
  page: Page,
  getDatabase: (id: string) => WorkspaceDatabase | undefined
): Promise<void> {
  const html2pdf = (await import("html2pdf.js")).default;
  const inner = pageToExportHtml(page, getDatabase);
  const container = document.createElement("div");
  container.innerHTML = `<style>${PDF_EXPORT_STYLES}</style><div class="pdf-root">${inner}</div>`;
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "720px";
  document.body.appendChild(container);
  const root = container.querySelector(".pdf-root") as HTMLElement;

  try {
    await html2pdf()
      .set({
        margin: [12, 12, 12, 12],
        filename: `${sanitizeExportBasename(page.title)}.pdf`,
        image: { type: "jpeg", quality: 0.92 },
        enableLinks: true,
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(root)
      .save();
  } finally {
    container.remove();
  }
}
