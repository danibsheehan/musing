import { describe, expect, it } from "vitest";
import type { Block } from "../types/block";
import { blockHtmlToPlainText, blocksToPlainText, pageBlocksToPlainText } from "./blockPlainText";

describe("blockHtmlToPlainText", () => {
  it("strips HTML tags and returns the visible text", () => {
    expect(blockHtmlToPlainText("<p><strong>Hello</strong> world</p>")).toBe("Hello world");
  });

  it("sanitizes malicious markup before extracting text", () => {
    const text = blockHtmlToPlainText('<p>hi</p><img src="x.png" onerror="alert(1)">');
    expect(text).not.toContain("onerror");
    expect(text).toBe("hi");
  });
});

describe("blocksToPlainText", () => {
  it("maps each block to its plain-text content", () => {
    const blocks: Block[] = [
      { id: "b1", type: "paragraph", content: "<p>One</p>" },
      { id: "b2", type: "paragraph", content: "<p>Two</p>" },
    ];
    expect(blocksToPlainText(blocks)).toEqual([
      { id: "b1", type: "paragraph", content: "One" },
      { id: "b2", type: "paragraph", content: "Two" },
    ]);
  });
});

describe("pageBlocksToPlainText", () => {
  it("joins non-empty block text with blank lines", () => {
    const blocks: Block[] = [
      { id: "b1", type: "paragraph", content: "<p>One</p>" },
      { id: "b2", type: "paragraph", content: "<p></p>" },
      { id: "b3", type: "paragraph", content: "<p>Two</p>" },
    ];
    expect(pageBlocksToPlainText(blocks)).toBe("One\n\nTwo");
  });
});
