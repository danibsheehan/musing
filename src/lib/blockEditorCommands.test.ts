import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import type { BlockType } from "../types/block";
import {
  applyBlockTypeToEditor,
  collapseEditorToSingleRootBlock,
  isBlockHtmlVisuallyEmpty,
  tipTapContentFromBlock,
} from "./blockEditorCommands";

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

describe("collapseEditorToSingleRootBlock", () => {
  it("removes extra top-level siblings", () => {
    const { editor, el } = makeEditor("<p>a</p><p>b</p>");
    expect(editor.state.doc.childCount).toBe(2);
    collapseEditorToSingleRootBlock(editor);
    expect(editor.state.doc.childCount).toBe(1);
    expect(editor.getText()).toBe("a");
    editor.destroy();
    el.remove();
  });
});

describe("tipTapContentFromBlock", () => {
  it("maps empty paragraph HTML to heading when type is heading", () => {
    expect(
      tipTapContentFromBlock({
        type: "heading",
        content: "<p></p>",
      }),
    ).toBe("<h1></h1>");
  });

  it("keeps non-empty content when type changes", () => {
    expect(
      tipTapContentFromBlock({
        type: "heading",
        content: "<p>Hello</p>",
      }),
    ).toBe("<p>Hello</p>");
  });

  it("returns databaseEmbed content unchanged even when visually empty", () => {
    expect(tipTapContentFromBlock({ type: "databaseEmbed", content: "" })).toBe("");
  });

  it.each([
    ["heading2", "<h2></h2>"],
    ["blockquote", "<blockquote><p></p></blockquote>"],
    ["codeBlock", "<pre><code></code></pre>"],
    ["bulletList", "<ul><li><p></p></li></ul>"],
    ["orderedList", "<ol><li><p></p></li></ol>"],
    ["horizontalRule", "<hr />"],
  ] as const)("maps an empty %s block to %s", (type, expected) => {
    expect(tipTapContentFromBlock({ type, content: "<p></p>" })).toBe(expected);
  });

  it("falls back to an empty paragraph for an unrecognized type", () => {
    expect(
      tipTapContentFromBlock({ type: "not-a-real-type" as BlockType, content: "<p></p>" }),
    ).toBe("<p></p>");
  });
});

describe("isBlockHtmlVisuallyEmpty", () => {
  it("treats br-only and zwsp as empty", () => {
    expect(isBlockHtmlVisuallyEmpty("<p></p>")).toBe(true);
    expect(isBlockHtmlVisuallyEmpty("<p><br /></p>")).toBe(true);
    expect(isBlockHtmlVisuallyEmpty("<p>\u200b</p>")).toBe(true);
  });
});

describe("applyBlockTypeToEditor", () => {
  it("turns the block into a horizontal rule (TipTap may keep a trailing empty paragraph)", () => {
    const { editor, el } = makeEditor("<p></p>");
    applyBlockTypeToEditor(editor, "horizontalRule");
    expect(editor.state.doc.firstChild?.type.name).toBe("horizontalRule");
    editor.destroy();
    el.remove();
  });

  it("turns a heading back into a paragraph", () => {
    const { editor, el } = makeEditor("<h1>Title</h1>");
    applyBlockTypeToEditor(editor, "paragraph");
    expect(editor.state.doc.firstChild?.type.name).toBe("paragraph");
    editor.destroy();
    el.remove();
  });

  it("sets heading level 1", () => {
    const { editor, el } = makeEditor("<p>Title</p>");
    applyBlockTypeToEditor(editor, "heading");
    expect(editor.state.doc.firstChild?.type.name).toBe("heading");
    expect(editor.state.doc.firstChild?.attrs.level).toBe(1);
    editor.destroy();
    el.remove();
  });

  it("sets heading level 2", () => {
    const { editor, el } = makeEditor("<p>Title</p>");
    applyBlockTypeToEditor(editor, "heading2");
    expect(editor.state.doc.firstChild?.type.name).toBe("heading");
    expect(editor.state.doc.firstChild?.attrs.level).toBe(2);
    editor.destroy();
    el.remove();
  });

  it("toggles a blockquote", () => {
    const { editor, el } = makeEditor("<p>Quoted</p>");
    applyBlockTypeToEditor(editor, "blockquote");
    expect(editor.state.doc.firstChild?.type.name).toBe("blockquote");
    editor.destroy();
    el.remove();
  });

  it("toggles a code block", () => {
    const { editor, el } = makeEditor("<p>code</p>");
    applyBlockTypeToEditor(editor, "codeBlock");
    expect(editor.state.doc.firstChild?.type.name).toBe("codeBlock");
    editor.destroy();
    el.remove();
  });

  it("toggles a bullet list", () => {
    const { editor, el } = makeEditor("<p>item</p>");
    applyBlockTypeToEditor(editor, "bulletList");
    expect(editor.state.doc.firstChild?.type.name).toBe("bulletList");
    editor.destroy();
    el.remove();
  });

  it("toggles an ordered list", () => {
    const { editor, el } = makeEditor("<p>item</p>");
    applyBlockTypeToEditor(editor, "orderedList");
    expect(editor.state.doc.firstChild?.type.name).toBe("orderedList");
    editor.destroy();
    el.remove();
  });

  it("is a no-op for databaseEmbed (handled elsewhere)", () => {
    const { editor, el } = makeEditor("<p>Unchanged</p>");
    applyBlockTypeToEditor(editor, "databaseEmbed");
    expect(editor.state.doc.firstChild?.type.name).toBe("paragraph");
    expect(editor.getText()).toBe("Unchanged");
    editor.destroy();
    el.remove();
  });
});
