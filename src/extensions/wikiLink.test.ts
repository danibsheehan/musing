import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import type { Page } from "../types/page";
import { WikiLink } from "./wikiLink";

const page = (overrides: Partial<Page> = {}): Page => ({
  id: "p1",
  title: "Target Page",
  parentId: null,
  order: 0,
  updatedAt: "",
  layout: "document",
  databaseId: null,
  blocks: [],
  ...overrides,
});

function makeEditor(html: string, pages: Page[]) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const editor = new Editor({
    element: el,
    extensions: [StarterKit, WikiLink.configure({ getPages: () => pages })],
    content: html,
  });
  return { editor, el };
}

/** Types text, then completes the `[[label]]` input rule via the closing `]]`. */
function typeWikiLink(editor: Editor, label: string) {
  editor.commands.insertContent(`[[${label}`);
  const from = editor.state.selection.from;
  editor.view.someProp("handleTextInput", (f) =>
    f(editor.view, from, from, "]]", () => editor.state.tr),
  );
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("WikiLink", () => {
  it("resolves [[Target Page]] to a wiki-link mark via getPages", () => {
    const { editor, el } = makeEditor("<p></p>", [page()]);

    typeWikiLink(editor, "Target Page");

    expect(editor.getHTML()).toBe(
      '<p><a data-wiki-page-id="p1" class="wiki-link" href="/page/p1" rel="noopener noreferrer">Target Page</a></p>',
    );

    editor.destroy();
    el.remove();
  });

  it("does not match when no page resolves for the label", () => {
    const { editor, el } = makeEditor("<p></p>", [page()]);

    typeWikiLink(editor, "Nonexistent Page");

    expect(editor.getHTML()).not.toContain("wiki-link");
    expect(editor.getText()).toContain("Nonexistent Page");

    editor.destroy();
    el.remove();
  });

  it("renders a missing-link span when a wikiLink mark has no pageId", () => {
    const { editor, el } = makeEditor("<p>Broken</p>", [page()]);

    editor.chain().selectAll().setMark("wikiLink", { pageId: null }).run();

    expect(editor.getHTML()).toContain('class="wiki-link-missing"');
    expect(editor.getHTML()).not.toContain("<a");

    editor.destroy();
    el.remove();
  });

  it("round-trips data-wiki-page-id through setContent/getHTML (parseHTML)", () => {
    const { editor, el } = makeEditor("<p></p>", [page()]);

    editor.commands.setContent('<p><a data-wiki-page-id="p1">Some Link Text</a></p>');

    expect(editor.getHTML()).toBe(
      '<p><a data-wiki-page-id="p1" class="wiki-link" href="/page/p1" rel="noopener noreferrer">Some Link Text</a></p>',
    );

    editor.destroy();
    el.remove();
  });
});
