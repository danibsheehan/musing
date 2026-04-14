import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
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
      })
    ).toBe("<h1></h1>");
  });

  it("keeps non-empty content when type changes", () => {
    expect(
      tipTapContentFromBlock({
        type: "heading",
        content: "<p>Hello</p>",
      })
    ).toBe("<p>Hello</p>");
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
});
