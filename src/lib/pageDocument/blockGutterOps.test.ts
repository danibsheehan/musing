import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { blockIdOnBlocks } from "../../extensions/blockIdOnBlocks";
import { insertParagraphBelowBlockAtIndex, reorderTopLevelBlocksByIndex } from "./blockGutterOps";

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
    const { editor, el } = makeEditor(`<p data-block-id="a">one</p><p data-block-id="b">two</p>`);
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

describe("reorderTopLevelBlocksByIndex", () => {
  it("moves a block from one index to another", () => {
    const { editor, el } = makeEditor(
      `<p data-block-id="r0">A</p><p data-block-id="r1">B</p><p data-block-id="r2">C</p>`,
    );
    expect(reorderTopLevelBlocksByIndex(editor, 0, 2)).toBe(true);
    expect(editor.getText()).toMatch(/B.*C.*A/s);
    editor.destroy();
    el.remove();
  });

  const ABC = `<p data-block-id="r0">A</p><p data-block-id="r1">B</p><p data-block-id="r2">C</p>`;
  const blockIds = (editor: Editor) => {
    const ids: string[] = [];
    editor.state.doc.forEach((node) => ids.push(`${node.attrs.blockId}:${node.textContent}`));
    return ids;
  };

  it.each([
    { name: "down by one", from: 0, to: 1, expected: ["r1:B", "r0:A", "r2:C"] },
    { name: "to the last index", from: 0, to: 2, expected: ["r1:B", "r2:C", "r0:A"] },
    { name: "up from the last index", from: 2, to: 0, expected: ["r2:C", "r0:A", "r1:B"] },
  ])("keeps each block's id and text when moving $name", ({ from, to, expected }) => {
    const { editor, el } = makeEditor(ABC);
    expect(reorderTopLevelBlocksByIndex(editor, from, to)).toBe(true);
    expect(blockIds(editor)).toEqual(expected);
    editor.destroy();
    el.remove();
  });

  // The move used to rebuild the whole document from HTML, which re-created every block.
  it("leaves the blocks that did not move untouched", () => {
    const { editor, el } = makeEditor(ABC);
    const before = editor.state.doc;
    reorderTopLevelBlocksByIndex(editor, 0, 2);
    const after = editor.state.doc;
    expect(after.child(0)).toBe(before.child(1));
    expect(after.child(1)).toBe(before.child(2));
    expect(after.child(2)).toBe(before.child(0));
    editor.destroy();
    el.remove();
  });

  it("is undone in one step", () => {
    const { editor, el } = makeEditor(ABC);
    reorderTopLevelBlocksByIndex(editor, 0, 2);
    editor.commands.undo();
    expect(blockIds(editor)).toEqual(["r0:A", "r1:B", "r2:C"]);
    editor.destroy();
    el.remove();
  });

  it("leaves the editor without focus, so no caret shows", async () => {
    const { editor, el } = makeEditor(ABC);
    editor.view.dom.focus();
    expect(document.activeElement).toBe(editor.view.dom);

    reorderTopLevelBlocksByIndex(editor, 0, 2);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(document.activeElement).not.toBe(editor.view.dom);
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
    const { editor, el } = makeEditor(`<p data-block-id="a">x</p><p data-block-id="b">y</p>`);
    expect(reorderTopLevelBlocksByIndex(editor, -1, 0)).toBe(false);
    expect(reorderTopLevelBlocksByIndex(editor, 0, 5)).toBe(false);
    editor.destroy();
    el.remove();
  });
});
