import type { Editor } from "@tiptap/core";
import { textBeforeCursorInBlock } from "./editorBlockText";

export function isSlashMenuOpen(editor: Editor): boolean {
  const textBefore = textBeforeCursorInBlock(editor.state.selection.$from);
  return /\/[^ \n]*$/.test(textBefore);
}

export function isPagePickerOpen(editor: Editor): boolean {
  const textBefore = textBeforeCursorInBlock(editor.state.selection.$from);
  return /@([^ \n]*)$/.test(textBefore);
}

/** Removes `/…` before the caret (slash menu filter). Returns whether a range was deleted. */
export function removeSlashCommandToken(editor: Editor): boolean {
  const { state } = editor;
  const { from, $from } = state.selection;
  const textBefore = textBeforeCursorInBlock($from);
  const m = textBefore.match(/\/[^ \n]*$/);
  if (!m) return false;
  const delFrom = from - m[0].length;
  return editor.chain().focus().deleteRange({ from: delFrom, to: from }).run();
}

/** Removes `@…` before the caret (page picker filter). Returns whether a range was deleted. */
export function removePagePickerToken(editor: Editor): boolean {
  const { state } = editor;
  const { from, $from } = state.selection;
  const textBefore = textBeforeCursorInBlock($from);
  const m = textBefore.match(/@([^ \n]*)$/);
  if (!m) return false;
  const delFrom = from - m[0].length;
  return editor.chain().focus().deleteRange({ from: delFrom, to: from }).run();
}
