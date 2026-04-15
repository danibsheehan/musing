import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { blockIdOnBlocks } from "../../extensions/blockIdOnBlocks";
import { findSlashMenuFilterDeleteRange } from "./slashMenuDeleteRange";

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

describe("findSlashMenuFilterDeleteRange", () => {
  it("returns null when the block has no trailing slash filter", () => {
    const { editor, el } = makeEditor(
      `<p data-block-id="b1">hello world</p>`
    );
    expect(findSlashMenuFilterDeleteRange(editor.state.doc, "b1")).toBeNull();
    editor.destroy();
    el.remove();
  });

  it("returns null for a wrong blockId", () => {
    const { editor, el } = makeEditor(
      `<p data-block-id="b1">text /foo</p>`
    );
    expect(findSlashMenuFilterDeleteRange(editor.state.doc, "other")).toBeNull();
    editor.destroy();
    el.remove();
  });

  it("finds range for a trailing / only", () => {
    const { editor, el } = makeEditor(`<p data-block-id="b1">hello /</p>`);
    const doc = editor.state.doc;
    const r = findSlashMenuFilterDeleteRange(doc, "b1");
    expect(r).not.toBeNull();
    expect(doc.textBetween(r!.from, r!.to)).toBe("/");
    editor.destroy();
    el.remove();
  });

  it("finds range for /foo", () => {
    const { editor, el } = makeEditor(
      `<p data-block-id="b1">hello /foo</p>`
    );
    const doc = editor.state.doc;
    const r = findSlashMenuFilterDeleteRange(doc, "b1");
    expect(r).not.toBeNull();
    expect(doc.textBetween(r!.from, r!.to)).toBe("/foo");
    editor.destroy();
    el.remove();
  });

  it("uses the correct block when multiple top-level blocks exist", () => {
    const { editor, el } = makeEditor(
      `<p data-block-id="a">first</p><p data-block-id="b">second /bar</p>`
    );
    const doc = editor.state.doc;
    expect(findSlashMenuFilterDeleteRange(doc, "a")).toBeNull();
    const r = findSlashMenuFilterDeleteRange(doc, "b");
    expect(r).not.toBeNull();
    expect(doc.textBetween(r!.from, r!.to)).toBe("/bar");
    editor.destroy();
    el.remove();
  });

  it("matches trailing filter after a newline inside the block", () => {
    const { editor, el } = makeEditor(
      `<p data-block-id="b1">line one\n/z</p>`
    );
    const doc = editor.state.doc;
    const r = findSlashMenuFilterDeleteRange(doc, "b1");
    expect(r).not.toBeNull();
    expect(doc.textBetween(r!.from, r!.to)).toBe("/z");
    editor.destroy();
    el.remove();
  });

  it("matches the last slash segment when multiple appear", () => {
    const { editor, el } = makeEditor(
      `<p data-block-id="b1">see /x and /y</p>`
    );
    const doc = editor.state.doc;
    const r = findSlashMenuFilterDeleteRange(doc, "b1");
    expect(r).not.toBeNull();
    expect(doc.textBetween(r!.from, r!.to)).toBe("/y");
    editor.destroy();
    el.remove();
  });
});
