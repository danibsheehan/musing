import { afterEach, describe, expect, it, vi } from "vitest";
import type { Block } from "../../types/block";
import { blocksToDocHtml } from "./blocksToDocHtml";

const paragraphBlock = (id: string, content: string): Block => ({
  id,
  type: "paragraph",
  content,
});

describe("blocksToDocHtml block id injection", () => {
  it("creates an empty paragraph with data-block-id when the content has no element root", () => {
    const out = blocksToDocHtml([paragraphBlock("block-1", "hi")]);
    expect(out).toBe('<p data-block-id="block-1"></p>');
  });

  it("adds data-block-id to the first element when missing", () => {
    const out = blocksToDocHtml([paragraphBlock("id-a", "<p>hi</p>")]);
    expect(out).toContain('data-block-id="id-a"');
    expect(out).toContain("hi");
  });

  it("does not overwrite an existing data-block-id", () => {
    const out = blocksToDocHtml([paragraphBlock("ignored", '<p data-block-id="keep-me">x</p>')]);
    expect(out).toContain('data-block-id="keep-me"');
    expect(out).not.toContain("ignored");
  });

  it("sanitizes malicious markup while still injecting the block id", () => {
    const out = blocksToDocHtml([
      paragraphBlock("id-a", '<p>hi<img src="x.png" onerror="alert(1)"></p>'),
    ]);
    expect(out).not.toContain("onerror");
    expect(out).toContain('data-block-id="id-a"');
  });

  it("escapes blockId in the SSR-style path when document is undefined", () => {
    vi.stubGlobal("document", undefined);
    const out = blocksToDocHtml([paragraphBlock('a&b"c', "<p>x</p>")]);
    expect(out).toContain("data-block-id=");
    expect(out).toContain("&amp;");
    expect(out).toContain("&quot;");
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("blocksToDocHtml", () => {
  it("returns an empty string for no blocks", () => {
    expect(blocksToDocHtml([])).toBe("");
  });

  it("serializes a database embed with encoded payload and round-trippable block id", () => {
    const blocks: Block[] = [
      {
        id: 'emb"&<>',
        type: "databaseEmbed",
        content: '{"x":"a&b"}',
      },
    ];
    const html = blocksToDocHtml(blocks);
    expect(html).toContain('data-type="musing-database-embed"');
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    const node = wrap.firstElementChild as HTMLElement;
    expect(node.getAttribute("data-block-id")).toBe('emb"&<>');
    expect(node.getAttribute("data-payload")).toBe(encodeURIComponent('{"x":"a&b"}'));
  });

  it("round-trips a paragraph block id that needs attribute escaping", () => {
    const blocks: Block[] = [
      {
        id: 'p"&<>',
        type: "paragraph",
        content: "<p>body</p>",
      },
    ];
    const html = blocksToDocHtml(blocks);
    expect(html).toContain("body");
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    const p = wrap.querySelector("p");
    expect(p?.getAttribute("data-block-id")).toBe('p"&<>');
  });

  it("uses horizontal rule fragment with block id", () => {
    const blocks: Block[] = [
      {
        id: "hr-1",
        type: "horizontalRule",
        content: "<p></p>",
      },
    ];
    const html = blocksToDocHtml(blocks);
    expect(html).toContain("hr");
    expect(html).toContain('data-block-id="hr-1"');
  });
});
