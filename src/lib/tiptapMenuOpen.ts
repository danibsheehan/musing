import type { Editor } from "@tiptap/core";
import { textBeforeCursorInBlock } from "./editorBlockText";

/** A `/…` or `@…` token at the end of the text before the caret. */
export type TokenMatch = {
  /** Text after the trigger character (the menu filter). */
  query: string;
  /** Length of the whole token including the trigger character. */
  length: number;
};

const SLASH_TOKEN = /\/[^ \n]*$/;
const PAGE_TOKEN = /@([^ \n]*)$/;

/** `/query` at the end of `textBefore` (slash menu), or null. */
export function matchSlashToken(textBefore: string): TokenMatch | null {
  const m = textBefore.match(SLASH_TOKEN);
  return m ? { query: m[0].slice(1), length: m[0].length } : null;
}

/** `@query` at the end of `textBefore` (page picker), or null. */
export function matchPageToken(textBefore: string): TokenMatch | null {
  const m = textBefore.match(PAGE_TOKEN);
  return m ? { query: m[1] ?? "", length: m[0].length } : null;
}

export function isSlashMenuOpen(editor: Editor): boolean {
  const textBefore = textBeforeCursorInBlock(editor.state.selection.$from);
  return matchSlashToken(textBefore) !== null;
}

export function isPagePickerOpen(editor: Editor): boolean {
  const textBefore = textBeforeCursorInBlock(editor.state.selection.$from);
  return matchPageToken(textBefore) !== null;
}

/** Removes `/…` before the caret (slash menu filter). Returns whether a range was deleted. */
export function removeSlashCommandToken(editor: Editor): boolean {
  const { state } = editor;
  const { from, $from } = state.selection;
  const textBefore = textBeforeCursorInBlock($from);
  const token = matchSlashToken(textBefore);
  if (!token) return false;
  const delFrom = from - token.length;
  return editor.chain().focus().deleteRange({ from: delFrom, to: from }).run();
}

/** Removes `@…` before the caret (page picker filter). Returns whether a range was deleted. */
export function removePagePickerToken(editor: Editor): boolean {
  const { state } = editor;
  const { from, $from } = state.selection;
  const textBefore = textBeforeCursorInBlock($from);
  const token = matchPageToken(textBefore);
  if (!token) return false;
  const delFrom = from - token.length;
  return editor.chain().focus().deleteRange({ from: delFrom, to: from }).run();
}
