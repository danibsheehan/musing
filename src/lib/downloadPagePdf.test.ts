import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Page } from "../types/page";
import { downloadPageAsPdf } from "./downloadPagePdf";
import { sanitizeExportBasename } from "./sanitizeExportFilename";

const html2pdfMock = vi.hoisted(() => vi.fn());

vi.mock("html2pdf.js", () => ({
  default: html2pdfMock,
}));

const page = (overrides: Partial<Page> = {}): Page => ({
  id: "page-a",
  title: "My Report",
  parentId: null,
  order: 0,
  updatedAt: "",
  layout: "document",
  databaseId: null,
  blocks: [{ id: "b1", type: "paragraph", content: "<p>Body</p>" }],
  ...overrides,
});

describe("downloadPageAsPdf", () => {
  let save: ReturnType<typeof vi.fn>;
  let from: ReturnType<typeof vi.fn>;
  let set: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    save = vi.fn().mockResolvedValue(undefined);
    from = vi.fn().mockReturnValue({ save });
    set = vi.fn().mockReturnValue({ from });
    html2pdfMock.mockReset().mockReturnValue({ set });
  });

  it("builds an off-screen container with the exported page HTML, sets the sanitized filename, and cleans up", async () => {
    const p = page({ title: "My Report" });
    await downloadPageAsPdf(p, () => undefined);

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ filename: `${sanitizeExportBasename("My Report")}.pdf` }),
    );
    const root = from.mock.calls[0][0] as HTMLElement;
    expect(root.className).toBe("pdf-root");
    expect(root.textContent).toContain("My Report");
    expect(root.textContent).toContain("Body");
    expect(save).toHaveBeenCalledTimes(1);
    expect(document.body.contains(root)).toBe(false);
  });

  it("removes the off-screen container even when save() rejects", async () => {
    save.mockRejectedValueOnce(new Error("render failed"));
    const p = page();

    await expect(downloadPageAsPdf(p, () => undefined)).rejects.toThrow("render failed");

    const root = from.mock.calls[0][0] as HTMLElement;
    expect(document.body.contains(root)).toBe(false);
  });
});
