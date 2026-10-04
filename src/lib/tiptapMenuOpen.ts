import type { Editor } from "@tiptap/core";
import { textBeforeCursorInBlock } from "./editorBlockText";

/** A `/…` or `@…` token at the end of the text before the caret. */
export type TokenMatch = {
  /** Text after the trigger character (the menu filter). */
  query: string;
  /** Length of the whole token including the trigger character. */
  length: number;
};

/**
 * A token only starts at the very beginning of the text or right after a regular space, so a
 * `/` or `@` inside a word (a URL, a date, an email address) is ordinary text, as in Notion. A tab,
 * a non-breaking space and a soft line break (reported as a newline) do not count as a boundary,
 * and a token ends at a space or a newline.
 */
const SLASH_TOKEN = /(?:^| )\/([^ \n]*)$/;
const PAGE_TOKEN = /(?:^| )@([^ \n]*)$/;

/** `/query` at the end of `textBefore` (slash menu), or null. */
export function matchSlashToken(textBefore: string): TokenMatch | null {
  const m = textBefore.match(SLASH_TOKEN);
  return m ? { query: m[1], length: 1 + m[1].length } : null;
}

/** `@query` at the end of `textBefore` (page picker), or null. */
export function matchPageToken(textBefore: string): TokenMatch | null {
  const m = textBefore.match(PAGE_TOKEN);
  return m ? { query: m[1], length: 1 + m[1].length } : null;
}

export function isSlashMenuOpen(editor: Editor): boolean {
  const textBefore = textBeforeCursorInBlock(editor.state.selection.$from);
  return matchSlashToken(textBefore) !== null;
}

export function isPagePickerOpen(editor: Editor): boolean {
  const textBefore = textBeforeCursorInBlock(editor.state.selection.$from);
  return matchPageToken(textBefore) !== null;
}
