import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { blockIdOnBlocks } from "./blockIdOnBlocks";

function makeEditor(html: string) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  // No ensureTopLevelBlockIds here: this suite checks the attribute's own split behavior.
  // trailingNode is off to match PageDocumentEditor (the default adds an empty <p> after headings).
  const editor = new Editor({
    element: el,
    extensions: [StarterKit.configure({ trailingNode: false }), blockIdOnBlocks],
    content: html,
  });
  return { editor, el };
}

afterEach(() => {
  document.body.replaceChildren();
});

// keepOnSplit only applies when the caret is at the end of a block (TipTap's splitBlock passes
// the filtered attrs only then). Mid-block and start-of-block splits are copied by ProseMirror
// regardless, so those are covered by ensureTopLevelBlockIds.test.ts, not here.
describe("blockIdOnBlocks", () => {
  it("does not clone blockId onto the new node when Enter is pressed at the end of a paragraph", () => {
    const { editor, el } = makeEditor('<p data-block-id="orig">ab</p>');

    editor.commands.setTextSelection(3);
    editor.commands.splitBlock();

    expect(editor.state.doc.childCount).toBe(2);
    expect(editor.state.doc.child(0).attrs.blockId).toBe("orig");
    expect(editor.state.doc.child(1).attrs.blockId).toBeNull();

    editor.destroy();
    el.remove();
  });

  it("does not clone blockId onto the paragraph created by splitting at the end of a heading", () => {
    const { editor, el } = makeEditor('<h1 data-block-id="h">T</h1>');

    editor.commands.setTextSelection(2);
    editor.commands.splitBlock();

    expect(editor.state.doc.childCount).toBe(2);
    expect(editor.state.doc.child(0).attrs.blockId).toBe("h");
    expect(editor.state.doc.child(1).type.name).toBe("paragraph");
    expect(editor.state.doc.child(1).attrs.blockId).toBeNull();

    editor.destroy();
    el.remove();
  });
});
