import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { singleTopLevelBlock } from "./singleTopLevelBlock";

function makeEditor(html: string) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const editor = new Editor({
    element: el,
    extensions: [StarterKit, singleTopLevelBlock],
    content: html,
  });
  return { editor, el };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("singleTopLevelBlock", () => {
  it("collapses two top-level paragraphs to one after create (and on later transactions)", async () => {
    const { editor, el } = makeEditor("<p>a</p><p>b</p>");
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(editor.state.doc.childCount).toBe(1);
    expect(editor.getText()).toBe("a");
    editor.destroy();
    el.remove();
  });

  it("keeps a single paragraph", () => {
    const { editor, el } = makeEditor("<p>only</p>");
    expect(editor.state.doc.childCount).toBe(1);
    expect(editor.getText()).toBe("only");
    editor.destroy();
    el.remove();
  });
});
