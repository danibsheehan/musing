import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextSelection } from "@tiptap/pm/state";
import { afterEach, describe, expect, it } from "vitest";
import { blockIdOnBlocks } from "../../extensions/blockIdOnBlocks";
import { blockIdAtSelection, findBlockPositionById } from "./blockIdAtSelection";

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

describe("blockIdAtSelection", () => {
  it("returns the blockId of the top-level block that contains the selection", () => {
    const { editor, el } = makeEditor(
      `<p data-block-id="first">a</p><p data-block-id="second">b</p>`
    );
    const { doc } = editor.state;
    let pos = 0;
    for (let i = 0; i < doc.childCount; i++) {
      const node = doc.child(i);
      if ((node.attrs.blockId as string | undefined) === "second") {
        pos += 1;
        break;
      }
      pos += node.nodeSize;
    }
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.create(doc, pos))
    );
    expect(blockIdAtSelection(editor)).toBe("second");
    editor.destroy();
    el.remove();
  });
});

describe("findBlockPositionById", () => {
  it("returns 0 for the first top-level block", () => {
    const { editor, el } = makeEditor(
      `<p data-block-id="alpha">x</p><p data-block-id="beta">y</p>`
    );
    expect(findBlockPositionById(editor, "alpha")).toBe(0);
    editor.destroy();
    el.remove();
  });

  it("returns the doc offset of the second block", () => {
    const { editor, el } = makeEditor(
      `<p data-block-id="alpha">x</p><p data-block-id="beta">y</p>`
    );
    const first = editor.state.doc.child(0);
    expect(findBlockPositionById(editor, "beta")).toBe(first.nodeSize);
    editor.destroy();
    el.remove();
  });

  it("returns null when no block has the id", () => {
    const { editor, el } = makeEditor(`<p data-block-id="only">z</p>`);
    expect(findBlockPositionById(editor, "missing")).toBeNull();
    editor.destroy();
    el.remove();
  });
});
