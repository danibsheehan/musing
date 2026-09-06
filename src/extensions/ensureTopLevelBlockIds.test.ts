import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { blockIdOnBlocks } from "./blockIdOnBlocks";
import { ensureTopLevelBlockIds } from "./ensureTopLevelBlockIds";

function makeEditor(html: string) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const editor = new Editor({
    element: el,
    extensions: [StarterKit, blockIdOnBlocks, ensureTopLevelBlockIds],
    content: html,
  });
  return { editor, el };
}

async function tick() {
  await new Promise<void>((r) => setTimeout(r, 0));
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("ensureTopLevelBlockIds", () => {
  it("assigns a blockId to a top-level node missing one, on create", async () => {
    const { editor, el } = makeEditor("<p>a</p>");
    await tick();

    const id = editor.state.doc.firstChild?.attrs.blockId as string | null;
    expect(id).toEqual(expect.any(String));
    expect(id).not.toBe("");

    editor.destroy();
    el.remove();
  });

  it("preserves an existing blockId instead of overwriting it", async () => {
    const { editor, el } = makeEditor('<p data-block-id="existing-1">a</p>');
    await tick();

    expect(editor.state.doc.firstChild?.attrs.blockId).toBe("existing-1");

    editor.destroy();
    el.remove();
  });

  it("assigns ids to different missing nodes independently", async () => {
    const { editor, el } = makeEditor('<p data-block-id="existing-1">a</p><p>b</p>');
    await tick();

    const ids = [editor.state.doc.child(0).attrs.blockId, editor.state.doc.child(1).attrs.blockId];
    expect(ids[0]).toBe("existing-1");
    expect(ids[1]).toEqual(expect.any(String));
    expect(ids[1]).not.toBe("existing-1");

    editor.destroy();
    el.remove();
  });

  it("assigns a blockId to a node inserted after creation, via appendTransaction", async () => {
    const { editor, el } = makeEditor('<p data-block-id="existing-1">a</p>');
    await tick();

    const endPos = editor.state.doc.content.size;
    editor.chain().insertContentAt(endPos, "<p>new paragraph</p>").run();

    const newNode = editor.state.doc.child(editor.state.doc.childCount - 1);
    expect(newNode.textContent).toBe("new paragraph");
    expect(newNode.attrs.blockId).toEqual(expect.any(String));
    expect(newNode.attrs.blockId).not.toBeNull();

    editor.destroy();
    el.remove();
  });
});
