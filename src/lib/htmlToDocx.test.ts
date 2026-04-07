import { Paragraph } from "docx";
import { describe, expect, it } from "vitest";
import { htmlFragmentToDocxBlocks } from "./htmlToDocx";

describe("htmlFragmentToDocxBlocks", () => {
  it("converts a paragraph to a docx Paragraph", () => {
    const blocks = htmlFragmentToDocxBlocks("<p>Hello</p>");
    expect(blocks.length).toBe(1);
    expect(blocks[0]).toBeInstanceOf(Paragraph);
  });

  it("treats empty input as an empty paragraph", () => {
    const blocks = htmlFragmentToDocxBlocks("");
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks.every((b) => b instanceof Paragraph)).toBe(true);
  });

  it("maps bold inline markup", () => {
    const blocks = htmlFragmentToDocxBlocks("<p><strong>B</strong></p>");
    expect(blocks.length).toBe(1);
    expect(blocks[0]).toBeInstanceOf(Paragraph);
  });

  it("produces multiple blocks for sibling paragraphs", () => {
    const blocks = htmlFragmentToDocxBlocks("<p>One</p><p>Two</p>");
    expect(blocks.length).toBe(2);
  });
});
