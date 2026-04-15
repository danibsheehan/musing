import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { blockIdOnBlocks } from "../../extensions/blockIdOnBlocks";
import {
  insertParagraphBelowBlock,
  insertParagraphBelowBlockAtIndex,
  reorderTopLevelBlocksByIndex,
} from "./blockGutterOps";

function makeEditor(html: string) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const editor = new Editor({
    element: el,
    extensions: [StarterKit, blockIdOnBlocks],
    content: html,
  });
  return { editor, el };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("insertParagraphBelowBlockAtIndex", () => {
  it("inserts a new paragraph after the block at the given index", () => {
    const { editor, el } = makeEditor(
      `<p data-block-id="a">one</p><p data-block-id="b">two</p>`
    );
    expect(insertParagraphBelowBlockAtIndex(editor, 0)).toBe(true);
    expect(editor.state.doc.childCount).toBe(3);
    expect(editor.getText()).toContain("one");
    expect(editor.getText()).toContain("two");
    const last = editor.state.doc.child(editor.state.doc.childCount - 1);
    expect(last.type.name).toBe("paragraph");
    expect(typeof (last.attrs.blockId as string | null)).toBe("string");
    expect((last.attrs.blockId as string).length).toBeGreaterThan(0);
    editor.destroy();
    el.remove();
  });

  it("returns false for an out-of-range index", () => {
    const { editor, el } = makeEditor(`<p data-block-id="a">x</p>`);
    expect(insertParagraphBelowBlockAtIndex(editor, -1)).toBe(false);
    expect(insertParagraphBelowBlockAtIndex(editor, 1)).toBe(false);
    expect(editor.state.doc.childCount).toBe(1);
    editor.destroy();
    el.remove();
  });
});

describe("insertParagraphBelowBlock", () => {
  it("inserts after the last top-level node with the given blockId", () => {
    const { editor, el } = makeEditor(
      `<p data-block-id="dup">first</p><p data-block-id="dup">second</p>`
    );
    expect(insertParagraphBelowBlock(editor, "dup")).toBe(true);
    expect(editor.state.doc.childCount).toBe(3);
    expect(editor.state.doc.child(1).textContent).toBe("second");
    const inserted = editor.state.doc.child(2);
    expect(inserted.type.name).toBe("paragraph");
    expect(inserted.textContent).toBe("");
    editor.destroy();
    el.remove();
  });

  it("returns false when no block has the id", () => {
    const { editor, el } = makeEditor(`<p data-block-id="a">x</p>`);
    expect(insertParagraphBelowBlock(editor, "missing")).toBe(false);
    expect(editor.state.doc.childCount).toBe(1);
    editor.destroy();
    el.remove();
  });
});

describe("reorderTopLevelBlocksByIndex", () => {
  it("moves a block from one index to another", () => {
    const { editor, el } = makeEditor(
      `<p data-block-id="r0">A</p><p data-block-id="r1">B</p><p data-block-id="r2">C</p>`
    );
    expect(reorderTopLevelBlocksByIndex(editor, 0, 2)).toBe(true);
    expect(editor.getText()).toMatch(/B.*C.*A/s);
    editor.destroy();
    el.remove();
  });

  it("returns true when from and to are equal (no-op)", () => {
    const { editor, el } = makeEditor(`<p data-block-id="a">x</p>`);
    expect(reorderTopLevelBlocksByIndex(editor, 0, 0)).toBe(true);
    expect(editor.getText()).toBe("x");
    editor.destroy();
    el.remove();
  });

  it("returns false for invalid indices", () => {
    const { editor, el } = makeEditor(
      `<p data-block-id="a">x</p><p data-block-id="b">y</p>`
    );
    expect(reorderTopLevelBlocksByIndex(editor, -1, 0)).toBe(false);
    expect(reorderTopLevelBlocksByIndex(editor, 0, 5)).toBe(false);
    editor.destroy();
    el.remove();
  });
});
