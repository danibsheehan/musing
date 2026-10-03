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

  it("gives a duplicated blockId a fresh id on create, keeping the first occurrence", async () => {
    const { editor, el } = makeEditor('<p data-block-id="dup">a</p><p data-block-id="dup">b</p>');
    await tick();

    expect(editor.state.doc.child(0).attrs.blockId).toBe("dup");
    const second = editor.state.doc.child(1).attrs.blockId as string | null;
    expect(second).toEqual(expect.any(String));
    expect(second).not.toBe("dup");

    editor.destroy();
    el.remove();
  });

  it("resolves a three-way duplicate to three distinct ids", async () => {
    const { editor, el } = makeEditor(
      '<p data-block-id="dup">a</p><p data-block-id="dup">b</p><p data-block-id="dup">c</p>',
    );
    await tick();

    const ids = [0, 1, 2].map((i) => editor.state.doc.child(i).attrs.blockId as string);
    expect(ids[0]).toBe("dup");
    expect(new Set(ids).size).toBe(3);

    editor.destroy();
    el.remove();
  });

  it("leaves already-unique ids untouched on later transactions", async () => {
    const { editor, el } = makeEditor('<p data-block-id="a">x</p><p data-block-id="b">y</p>');
    await tick();

    editor.commands.insertContentAt(1, "z");

    expect(editor.state.doc.child(0).attrs.blockId).toBe("a");
    expect(editor.state.doc.child(1).attrs.blockId).toBe("b");

    editor.destroy();
    el.remove();
  });

  it("keeps ids unique when a block is split (Enter)", async () => {
    const { editor, el } = makeEditor('<p data-block-id="orig">ab</p>');
    await tick();

    editor.commands.setTextSelection(2);
    editor.commands.splitBlock();

    expect(editor.state.doc.childCount).toBe(2);
    const ids = [0, 1].map((i) => editor.state.doc.child(i).attrs.blockId as string | null);
    expect(ids[0]).toBe("orig");
    expect(ids[1]).toEqual(expect.any(String));
    expect(ids[1]).not.toBe("orig");

    editor.destroy();
    el.remove();
  });

  it("re-ids pasted HTML that carries an id already in the document", async () => {
    // jsdom has no ClipboardEvent, so view.pasteHTML can't run here; insertContentAt goes through
    // the same parseHTML path that carries `data-block-id` in from pasted HTML.
    const { editor, el } = makeEditor('<p data-block-id="dup">a</p>');
    await tick();

    editor.commands.insertContentAt(
      editor.state.doc.content.size,
      '<p data-block-id="dup">pasted</p>',
    );

    const ids: string[] = [];
    editor.state.doc.forEach((node) => ids.push(node.attrs.blockId as string));
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(ids[0]).toBe("dup");
    expect(new Set(ids).size).toBe(ids.length);

    editor.destroy();
    el.remove();
  });

  it("re-ids a paragraph lifted out of a list that still carries a stale id", async () => {
    const { editor, el } = makeEditor(
      '<p data-block-id="A">a</p><ul><li><p data-block-id="A">b</p></li></ul>',
    );
    await tick();

    let bPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === "b") bPos = pos;
    });
    editor.commands.setTextSelection(bPos);
    editor.commands.liftListItem("listItem");

    const ids: string[] = [];
    editor.state.doc.forEach((node) => ids.push(node.attrs.blockId as string));
    expect(editor.state.doc.child(1).type.name).toBe("paragraph");
    expect(ids[0]).toBe("A");
    expect(new Set(ids).size).toBe(ids.length);

    editor.destroy();
    el.remove();
  });
});
