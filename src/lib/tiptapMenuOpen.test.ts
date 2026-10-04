import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { blockIdOnBlocks } from "../extensions/blockIdOnBlocks";
import {
  isPagePickerOpen,
  isSlashMenuOpen,
  matchPageToken,
  matchSlashToken,
  removePagePickerToken,
  removeSlashCommandToken,
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
    editor.chain().focus().insertContent("hello/w").run();
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

describe("isPagePickerOpen", () => {
  it("is true when the textblock ends with @filter", () => {
    const { editor, el } = makeEditor(`<p data-block-id="x"></p>`);
    editor.chain().focus().insertContent("note@pag").run();
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

describe("removeSlashCommandToken", () => {
  it("deletes the trailing /… range and leaves prior text", () => {
    const { editor, el } = makeEditor(`<p data-block-id="x"></p>`);
    editor.chain().focus().insertContent("hello /foo").run();
    expect(removeSlashCommandToken(editor)).toBe(true);
    expect(editor.getText()).toBe("hello ");
    editor.destroy();
    el.remove();
  });

  it("returns false when there is no slash token", () => {
    const { editor, el } = makeEditor(`<p data-block-id="x"></p>`);
    editor.chain().focus().insertContent("hello").run();
    expect(removeSlashCommandToken(editor)).toBe(false);
    expect(editor.getText()).toBe("hello");
    editor.destroy();
    el.remove();
  });
});

describe("removePagePickerToken", () => {
  it("deletes the trailing @… range and leaves prior text", () => {
    const { editor, el } = makeEditor(`<p data-block-id="x"></p>`);
    editor.chain().focus().insertContent("note@page").run();
    expect(removePagePickerToken(editor)).toBe(true);
    expect(editor.getText()).toBe("note");
    editor.destroy();
    el.remove();
  });

  it("returns false when there is no @ token", () => {
    const { editor, el } = makeEditor(`<p data-block-id="x"></p>`);
    editor.chain().focus().insertContent("note").run();
    expect(removePagePickerToken(editor)).toBe(false);
    expect(editor.getText()).toBe("note");
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

  it("existing behavior: also matches a slash in the middle of a word or URL", () => {
    expect(matchSlashToken("abc/he")).toEqual({ query: "he", length: 3 });
    expect(matchSlashToken("see example.com/p")).toEqual({ query: "p", length: 2 });
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

  it("existing behavior: also matches an @ inside an email address", () => {
    expect(matchPageToken("write to a@b.com")).toEqual({ query: "b.com", length: 6 });
  });
});
