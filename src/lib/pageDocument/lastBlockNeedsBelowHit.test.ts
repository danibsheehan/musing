import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { lastTopLevelBlockNeedsBelowHit } from "./lastBlockNeedsBelowHit";

function makeEditor(html: string) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const editor = new Editor({
    element: el,
    extensions: [StarterKit],
    content: html,
  });
  return { editor, el };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("lastTopLevelBlockNeedsBelowHit", () => {
  it("is false for a trailing paragraph", () => {
    const { editor, el } = makeEditor("<p>hi</p>");
    expect(lastTopLevelBlockNeedsBelowHit(editor.state.doc)).toBe(false);
    editor.destroy();
    el.remove();
  });

  it("is true when the last top-level node is a code block", () => {
    const { editor, el } = makeEditor("<p>a</p><pre><code>b</code></pre>");
    expect(lastTopLevelBlockNeedsBelowHit(editor.state.doc)).toBe(true);
    editor.destroy();
    el.remove();
  });

  it("is true when the last top-level node is a bullet list", () => {
    const { editor, el } = makeEditor("<p>a</p><ul><li>x</li></ul>");
    expect(lastTopLevelBlockNeedsBelowHit(editor.state.doc)).toBe(true);
    editor.destroy();
    el.remove();
  });

  it("is true when the last top-level node is an ordered list", () => {
    const { editor, el } = makeEditor("<p>a</p><ol><li>x</li></ol>");
    expect(lastTopLevelBlockNeedsBelowHit(editor.state.doc)).toBe(true);
    editor.destroy();
    el.remove();
  });

  it("is true when the last top-level node is a blockquote", () => {
    const { editor, el } = makeEditor("<p>a</p><blockquote><p>q</p></blockquote>");
    expect(lastTopLevelBlockNeedsBelowHit(editor.state.doc)).toBe(true);
    editor.destroy();
    el.remove();
  });

  it("is false when a non-matching type is last (e.g. heading)", () => {
    const { editor, el } = makeEditor("<p>a</p><h1>t</h1>");
    expect(lastTopLevelBlockNeedsBelowHit(editor.state.doc)).toBe(false);
    editor.destroy();
    el.remove();
  });
});
