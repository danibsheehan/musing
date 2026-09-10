import { Paragraph } from "docx";
import { describe, expect, it } from "vitest";
import { htmlFragmentToDocxBlocks } from "./htmlToDocx";

function serialized(block: unknown): string {
  return JSON.stringify(block);
}

describe("htmlFragmentToDocxBlocks", () => {
  it("converts a paragraph to a docx Paragraph", () => {
    const blocks = htmlFragmentToDocxBlocks("<p>Hello</p>");
    expect(blocks.length).toBe(1);
    expect(blocks[0]).toBeInstanceOf(Paragraph);
    expect(serialized(blocks[0])).toContain('"Hello"');
  });

  it("treats empty input as an empty paragraph", () => {
    const blocks = htmlFragmentToDocxBlocks("");
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks.every((b) => b instanceof Paragraph)).toBe(true);
  });

  it("maps bold inline markup", () => {
    const blocks = htmlFragmentToDocxBlocks("<p><strong>B</strong></p>");
    expect(blocks.length).toBe(1);
    expect(serialized(blocks[0])).toContain('"w:b"');
  });

  it("maps nested bold+italic markup", () => {
    const blocks = htmlFragmentToDocxBlocks("<p><strong><em>BI</em></strong></p>");
    const s = serialized(blocks[0]);
    expect(s).toContain('"w:b"');
    expect(s).toContain('"w:i"');
    expect(s).toContain('"BI"');
  });

  it("sanitizes malicious markup before converting", () => {
    const blocks = htmlFragmentToDocxBlocks('<p>hi</p><img src="x.png" onerror="alert(1)">');
    expect(blocks.every((b) => !serialized(b).includes("onerror"))).toBe(true);
  });

  it("produces multiple blocks for sibling paragraphs", () => {
    const blocks = htmlFragmentToDocxBlocks("<p>One</p><p>Two</p>");
    expect(blocks.length).toBe(2);
  });

  it.each([
    ["h1", "Heading1"],
    ["h2", "Heading2"],
    ["h3", "Heading3"],
  ] as const)("maps <%s> to the %s style with its text", (tag, style) => {
    const blocks = htmlFragmentToDocxBlocks(`<${tag}>Title</${tag}>`);
    expect(blocks.length).toBe(1);
    const s = serialized(blocks[0]);
    expect(s).toContain(style);
    expect(s).toContain('"Title"');
  });

  it("maps a blockquote's paragraphs, joined and italicized", () => {
    const blocks = htmlFragmentToDocxBlocks(
      "<blockquote><p>Quote one</p><p>Quote two</p></blockquote>",
    );
    expect(blocks.length).toBe(1);
    const s = serialized(blocks[0]);
    expect(s).toContain('"w:i"');
    expect(s).toContain("Quote one\\nQuote two");
  });

  it("maps a blockquote with no <p> children to its trimmed text content", () => {
    const blocks = htmlFragmentToDocxBlocks("<blockquote>  Plain quote  </blockquote>");
    expect(serialized(blocks[0])).toContain("Plain quote");
  });

  it("maps <pre> to a monospace paragraph with verbatim text", () => {
    const blocks = htmlFragmentToDocxBlocks("<pre>const x = 1;\n  indented</pre>");
    const s = serialized(blocks[0]);
    expect(s).toContain("Consolas");
    expect(s).toContain("const x = 1;\\n  indented");
  });

  it("maps inline <code> to a monospace run", () => {
    const blocks = htmlFragmentToDocxBlocks("<p>Run <code>npm test</code></p>");
    const s = serialized(blocks[0]);
    expect(s).toContain("Consolas");
    expect(s).toContain('"npm test"');
  });

  it("maps <hr> to a thematic break paragraph", () => {
    const blocks = htmlFragmentToDocxBlocks("<hr>");
    expect(serialized(blocks[0])).toContain("w:pBdr");
  });

  it("maps an unordered list with a bullet prefix per item", () => {
    const blocks = htmlFragmentToDocxBlocks("<ul><li>First</li><li>Second</li></ul>");
    expect(blocks.length).toBe(2);
    expect(serialized(blocks[0])).toContain("• First");
    expect(serialized(blocks[1])).toContain("• Second");
  });

  it("maps an ordered list with numbered prefixes", () => {
    const blocks = htmlFragmentToDocxBlocks("<ol><li>First</li><li>Second</li></ol>");
    expect(blocks.length).toBe(2);
    expect(serialized(blocks[0])).toContain("1. First");
    expect(serialized(blocks[1])).toContain("2. Second");
  });

  it("only prefixes the first paragraph of a multi-paragraph list item", () => {
    const blocks = htmlFragmentToDocxBlocks(
      "<ul><li><p>First para</p><p>Second para</p></li></ul>",
    );
    expect(blocks.length).toBe(2);
    expect(serialized(blocks[0])).toContain("• ");
    expect(serialized(blocks[0])).toContain("First para");
    expect(serialized(blocks[1])).not.toContain("• ");
    expect(serialized(blocks[1])).toContain("Second para");
  });

  it("maps a link to an external hyperlink with resolved href and inner text", () => {
    const blocks = htmlFragmentToDocxBlocks('<p><a href="http://example.com/x">Click</a></p>');
    const s = serialized(blocks[0]);
    expect(s).toContain("w:externalHyperlink");
    expect(s).toContain("http://example.com/x");
    expect(s).toContain('"Click"');
  });

  it("flattens a div wrapping multiple paragraphs", () => {
    const blocks = htmlFragmentToDocxBlocks("<div><p>Inside one</p><p>Inside two</p></div>");
    expect(blocks.length).toBe(2);
    expect(serialized(blocks[0])).toContain("Inside one");
    expect(serialized(blocks[1])).toContain("Inside two");
  });

  it("treats a bare text node inside a div as its own paragraph", () => {
    const blocks = htmlFragmentToDocxBlocks("<div>Bare text<p>Inside</p></div>");
    expect(blocks.length).toBe(2);
    expect(serialized(blocks[0])).toContain("Bare text");
    expect(serialized(blocks[1])).toContain("Inside");
  });

  it("treats a bare top-level text node as its own whitespace-collapsed paragraph", () => {
    const blocks = htmlFragmentToDocxBlocks("  Bare   top-level  text  <p>Then a paragraph</p>");
    expect(blocks.length).toBe(2);
    expect(serialized(blocks[0])).toContain("Bare top-level text");
    expect(serialized(blocks[1])).toContain("Then a paragraph");
  });

  it("falls back to a plain paragraph for an unrecognized tag with content", () => {
    const blocks = htmlFragmentToDocxBlocks("<section>Fallback text</section>");
    expect(blocks.length).toBe(1);
    expect(serialized(blocks[0])).toContain("Fallback text");
  });

  it("drops an unrecognized empty tag entirely", () => {
    const blocks = htmlFragmentToDocxBlocks("<svg></svg>");
    expect(blocks.length).toBe(0);
  });
});
