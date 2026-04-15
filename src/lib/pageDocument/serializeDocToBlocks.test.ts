import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { blockIdOnBlocks } from "../../extensions/blockIdOnBlocks";
import { MusingDatabaseEmbed } from "../../extensions/musingDatabaseEmbed";
import { stringifyDatabaseEmbedPayload } from "../databaseEmbed";
import { serializeDocToBlocks } from "./serializeDocToBlocks";

function makeEditor(html: string) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const editor = new Editor({
    element: el,
    extensions: [StarterKit, blockIdOnBlocks, MusingDatabaseEmbed],
    content: html,
  });
  return { editor, el };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("serializeDocToBlocks", () => {
  it("maps each top-level node to a block with id, type, and HTML content", () => {
    const { editor, el } = makeEditor(
      `<p data-block-id="row-1">hello</p><h1 data-block-id="row-2">Title</h1>`
    );
    const blocks = serializeDocToBlocks(editor);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      id: "row-1",
      type: "paragraph",
    });
    expect(blocks[0].content).toContain("hello");
    expect(blocks[1]).toMatchObject({
      id: "row-2",
      type: "heading",
    });
    expect(blocks[1].content.toLowerCase()).toContain("title");
    editor.destroy();
    el.remove();
  });

  it("maps level-2 headings to heading2", () => {
    const { editor, el } = makeEditor(`<h2 data-block-id="h2">Sub</h2>`);
    const blocks = serializeDocToBlocks(editor);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ id: "h2", type: "heading2" });
    editor.destroy();
    el.remove();
  });

  it("serializes a database embed node with decoded payload", () => {
    const payload = stringifyDatabaseEmbedPayload("db-test");
    const enc = encodeURIComponent(payload);
    const { editor, el } = makeEditor(
      `<p data-block-id="p1">x</p><div data-type="musing-database-embed" data-block-id="emb-1" data-payload="${enc}"></div>`
    );
    const blocks = serializeDocToBlocks(editor);
    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toEqual({
      id: "emb-1",
      type: "databaseEmbed",
      content: payload,
    });
    editor.destroy();
    el.remove();
  });
});
