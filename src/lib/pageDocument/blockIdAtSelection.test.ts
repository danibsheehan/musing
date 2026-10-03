import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextSelection } from "@tiptap/pm/state";
import { afterEach, describe, expect, it } from "vitest";
import { blockIdOnBlocks } from "../../extensions/blockIdOnBlocks";
import { blockIdAtSelection } from "./blockIdAtSelection";

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
      `<p data-block-id="first">a</p><p data-block-id="second">b</p>`,
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
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(doc, pos)));
    expect(blockIdAtSelection(editor)).toBe("second");
    editor.destroy();
    el.remove();
  });
});
