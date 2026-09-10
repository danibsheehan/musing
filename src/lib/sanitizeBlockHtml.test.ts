import { describe, expect, it } from "vitest";
import { sanitizeBlockHtml } from "./sanitizeBlockHtml";

describe("sanitizeBlockHtml", () => {
  it("strips script tags", () => {
    expect(sanitizeBlockHtml("<p>hi</p><script>alert(1)</script>")).toBe("<p>hi</p>");
  });

  it("strips event handler attributes", () => {
    const result = sanitizeBlockHtml('<img src="x.png" onerror="alert(1)">');
    expect(result).not.toContain("onerror");
    expect(result).toContain('src="x.png"');
  });

  it("preserves a legitimate wiki link", () => {
    const html =
      '<p><a class="wiki-link" href="/page/abc" data-wiki-page-id="abc" rel="noopener noreferrer">Title</a></p>';
    expect(sanitizeBlockHtml(html)).toBe(html);
  });

  it("preserves ordinary formatting", () => {
    const html = "<ul><li><p><strong>bold</strong> and <em>em</em></p></li></ul>";
    expect(sanitizeBlockHtml(html)).toBe(html);
  });
});
