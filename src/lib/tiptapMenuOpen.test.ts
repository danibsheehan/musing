import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { blockIdOnBlocks } from "../extensions/blockIdOnBlocks";
import {
  isPagePickerOpen,
  isSlashMenuOpen,
  matchPageToken,
  matchSlashToken,
} from "./tiptapMenuOpen";

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

describe("isSlashMenuOpen", () => {
  it("is true when the textblock ends with / and an optional filter", () => {
    const { editor, el } = makeEditor(`<p data-block-id="x"></p>`);
    editor.chain().focus().insertContent("hello /w").run();
    expect(isSlashMenuOpen(editor)).toBe(true);
    editor.destroy();
    el.remove();
  });

  it("is true for a lone / at end of block", () => {
    const { editor, el } = makeEditor(`<p data-block-id="x"></p>`);
    editor.chain().focus().insertContent("hi /").run();
    expect(isSlashMenuOpen(editor)).toBe(true);
    editor.destroy();
    el.remove();
  });

  it("is false when there is no slash suffix", () => {
    const { editor, el } = makeEditor(`<p data-block-id="x"></p>`);
    editor.chain().focus().insertContent("hello").run();
    expect(isSlashMenuOpen(editor)).toBe(false);
    editor.destroy();
    el.remove();
  });

  it("is false when slash is not at end (e.g. later text)", () => {
    const { editor, el } = makeEditor(`<p data-block-id="x"></p>`);
    editor.chain().focus().insertContent("/x more").run();
    expect(isSlashMenuOpen(editor)).toBe(false);
    editor.destroy();
    el.remove();
  });
});

describe("triggers after a soft line break", () => {
  it("does not open the slash menu for / typed right after a soft break", () => {
    const { editor, el } = makeEditor(`<p data-block-id="x"></p>`);
    editor.chain().focus().insertContent("line1").setHardBreak().insertContent("/he").run();
    expect(isSlashMenuOpen(editor)).toBe(false);
    editor.destroy();
    el.remove();
  });

  it("does not open it when a space precedes the soft break either", () => {
    const { editor, el } = makeEditor(`<p data-block-id="x"></p>`);
    editor.chain().focus().insertContent("line1 ").setHardBreak().insertContent("/he").run();
    expect(isSlashMenuOpen(editor)).toBe(false);
    editor.destroy();
    el.remove();
  });

  it("closes once a soft break follows the typed token", () => {
    const { editor, el } = makeEditor(`<p data-block-id="x"></p>`);
    editor.chain().focus().insertContent("/he").run();
    expect(isSlashMenuOpen(editor)).toBe(true);
    editor.chain().focus().setHardBreak().run();
    expect(isSlashMenuOpen(editor)).toBe(false);
    editor.destroy();
    el.remove();
  });

  it("does not open the page picker for @ typed right after a soft break", () => {
    const { editor, el } = makeEditor(`<p data-block-id="x"></p>`);
    editor.chain().focus().insertContent("line1 ").setHardBreak().insertContent("@al").run();
    expect(isPagePickerOpen(editor)).toBe(false);
    editor.destroy();
    el.remove();
  });
});

describe("isPagePickerOpen", () => {
  it("is true when the textblock ends with @filter", () => {
    const { editor, el } = makeEditor(`<p data-block-id="x"></p>`);
    editor.chain().focus().insertContent("note @pag").run();
    expect(isPagePickerOpen(editor)).toBe(true);
    editor.destroy();
    el.remove();
  });

  it("is true for @ alone at end", () => {
    const { editor, el } = makeEditor(`<p data-block-id="x"></p>`);
    editor.chain().focus().insertContent("x @").run();
    expect(isPagePickerOpen(editor)).toBe(true);
    editor.destroy();
    el.remove();
  });

  it("is false without @ suffix", () => {
    const { editor, el } = makeEditor(`<p data-block-id="x"></p>`);
    editor.chain().focus().insertContent("note").run();
    expect(isPagePickerOpen(editor)).toBe(false);
    editor.destroy();
    el.remove();
  });
});

describe("matchSlashToken", () => {
  it("matches a lone / with an empty query", () => {
    expect(matchSlashToken("/")).toEqual({ query: "", length: 1 });
  });

  it("matches / plus a filter at the end of the text", () => {
    expect(matchSlashToken("abc /he")).toEqual({ query: "he", length: 3 });
  });

  it("returns null when a space comes after the token", () => {
    expect(matchSlashToken("/he llo")).toBeNull();
  });

  it("returns null when there is no slash", () => {
    expect(matchSlashToken("hello")).toBeNull();
    expect(matchSlashToken("")).toBeNull();
  });

  it("does not match a slash in the middle of a word, URL, date or path", () => {
    expect(matchSlashToken("abc/he")).toBeNull();
    expect(matchSlashToken("http://www.google.com")).toBeNull();
    expect(matchSlashToken("see example.com/p")).toBeNull();
    expect(matchSlashToken("10/3/2026")).toBeNull();
    expect(matchSlashToken("and/or")).toBeNull();
    expect(matchSlashToken("(/he")).toBeNull();
  });

  it("matches only at the start of the text or right after a space", () => {
    expect(matchSlashToken("/he")).toEqual({ query: "he", length: 3 });
    expect(matchSlashToken("see /he")).toEqual({ query: "he", length: 3 });
    expect(matchSlashToken("a\t/he")).toBeNull();
    expect(matchSlashToken("a\u00a0/he")).toBeNull();
  });

  it("does not match after a line break, and a token cannot run across one", () => {
    expect(matchSlashToken("line1\n/he")).toBeNull();
    expect(matchSlashToken("line1 \n/he")).toBeNull();
    expect(matchSlashToken("/he\n")).toBeNull();
  });

  it("uses the last slash, keeping any earlier slash in the query", () => {
    expect(matchSlashToken("/a/b")).toEqual({ query: "a/b", length: 4 });
  });
});

describe("matchPageToken", () => {
  it("matches a lone @ with an empty query", () => {
    expect(matchPageToken("@")).toEqual({ query: "", length: 1 });
  });

  it("matches @ plus a filter at the end of the text", () => {
    expect(matchPageToken("see @alp")).toEqual({ query: "alp", length: 4 });
  });

  it("returns null when a space comes after the token", () => {
    expect(matchPageToken("@alp ha")).toBeNull();
  });

  it("returns null when there is no @", () => {
    expect(matchPageToken("hello")).toBeNull();
  });

  it("does not match an @ inside an email address or word", () => {
    expect(matchPageToken("write to a@b.com")).toBeNull();
    expect(matchPageToken("jane@gmail.com")).toBeNull();
    expect(matchPageToken('"@alp')).toBeNull();
  });

  it("matches only at the start of the text or right after a space", () => {
    expect(matchPageToken("@alp")).toEqual({ query: "alp", length: 4 });
    expect(matchPageToken("mail @alp")).toEqual({ query: "alp", length: 4 });
    expect(matchPageToken("a\t@alp")).toBeNull();
  });

  it("does not match after a line break", () => {
    expect(matchPageToken("line1\n@alp")).toBeNull();
    expect(matchPageToken("line1 \n@alp")).toBeNull();
  });
});
