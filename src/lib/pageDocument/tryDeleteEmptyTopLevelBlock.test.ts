import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextSelection } from "@tiptap/pm/state";
import { afterEach, describe, expect, it } from "vitest";
import { blockIdOnBlocks } from "../../extensions/blockIdOnBlocks";
import { tryDeleteEmptyTopLevelBlock } from "./tryDeleteEmptyTopLevelBlock";

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

function caretInBlockWithId(editor: Editor, blockId: string) {
  const { doc } = editor.state;
  let pos = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i);
    if ((node.attrs.blockId as string | undefined) === blockId) {
      const inner = pos + 1;
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(doc, inner)));
      return;
    }
    pos += node.nodeSize;
  }
  throw new Error(`no block with id ${blockId}`);
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("tryDeleteEmptyTopLevelBlock", () => {
  it("removes an empty second paragraph when the selection is inside it", () => {
    const { editor, el } = makeEditor(`<p data-block-id="a">keep</p><p data-block-id="b"></p>`);
    caretInBlockWithId(editor, "b");
    expect(editor.state.doc.childCount).toBe(2);
    expect(tryDeleteEmptyTopLevelBlock(editor)).toBe(true);
    expect(editor.state.doc.childCount).toBe(1);
    expect(editor.getText()).toBe("keep");
    editor.destroy();
    el.remove();
  });

  it("treats br-only second paragraph as empty and removes it", () => {
    const { editor, el } = makeEditor(
      `<p data-block-id="a">keep</p><p data-block-id="b"><br /></p>`,
    );
    caretInBlockWithId(editor, "b");
    expect(tryDeleteEmptyTopLevelBlock(editor)).toBe(true);
    expect(editor.state.doc.childCount).toBe(1);
    expect(editor.getText()).toBe("keep");
    editor.destroy();
    el.remove();
  });

  it("removes the empty paragraph the caret is in even when another block shares its id", () => {
    const { editor, el } = makeEditor(`<p data-block-id="x">keep</p><p data-block-id="x"></p>`);
    // Caret inside the second paragraph: after "keep" (nodeSize 6) plus the paragraph's open token.
    editor.commands.setTextSelection(7);
    expect(tryDeleteEmptyTopLevelBlock(editor)).toBe(true);
    expect(editor.state.doc.childCount).toBe(1);
    expect(editor.getText()).toBe("keep");
    editor.destroy();
    el.remove();
  });

  it("removes an empty paragraph that has no block id", () => {
    const { editor, el } = makeEditor(`<p>keep</p><p></p>`);
    editor.commands.setTextSelection(7);
    expect(editor.state.doc.child(1).attrs.blockId).toBeNull();
    expect(tryDeleteEmptyTopLevelBlock(editor)).toBe(true);
    expect(editor.state.doc.childCount).toBe(1);
    editor.destroy();
    el.remove();
  });

  it("returns false with a single top-level block", () => {
    const { editor, el } = makeEditor(`<p data-block-id="a"></p>`);
    caretInBlockWithId(editor, "a");
    expect(tryDeleteEmptyTopLevelBlock(editor)).toBe(false);
    expect(editor.state.doc.childCount).toBe(1);
    editor.destroy();
    el.remove();
  });

  it("returns false when the current block is not an empty paragraph", () => {
    const { editor, el } = makeEditor(`<p data-block-id="a">one</p><p data-block-id="b">two</p>`);
    caretInBlockWithId(editor, "b");
    expect(tryDeleteEmptyTopLevelBlock(editor)).toBe(false);
    expect(editor.state.doc.childCount).toBe(2);
    editor.destroy();
    el.remove();
  });
});
