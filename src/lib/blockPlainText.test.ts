import { afterEach, describe, expect, it, vi } from "vitest";
import type { Block } from "../types/block";
import { blockHtmlToPlainText, blocksToPlainText, pageBlocksToPlainText } from "./blockPlainText";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("blockHtmlToPlainText", () => {
  it("strips HTML tags and returns the visible text", () => {
    expect(blockHtmlToPlainText("<p><strong>Hello</strong> world</p>")).toBe("Hello world");
  });

  it("sanitizes malicious markup before extracting text", () => {
    const text = blockHtmlToPlainText('<p>hi</p><img src="x.png" onerror="alert(1)">');
    expect(text).not.toContain("onerror");
    expect(text).toBe("hi");
  });

  it("falls back to an empty paragraph for blank/whitespace-only html", () => {
    expect(blockHtmlToPlainText("   ")).toBe("");
  });

  it("returns an empty string when the sanitized host reports no textContent", () => {
    const fakeHost = { innerHTML: "", textContent: null } as unknown as HTMLDivElement;
    vi.spyOn(document, "createElement").mockImplementation(() => fakeHost);
    expect(blockHtmlToPlainText("<p>Hi</p>")).toBe("");
  });

  it("uses the regex-strip path when document is unavailable (SSR)", () => {
    vi.stubGlobal("document", undefined);
    const text = blockHtmlToPlainText("<p>Hello&nbsp;world</p>");
    expect(text).toBe("Hello world");
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
