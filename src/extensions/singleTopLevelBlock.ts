import { Extension } from "@tiptap/core";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";

/** Delete all top-level nodes after the first (doc positions are 0…doc.content.size). */
export function collapseExtraTopLevelBlocks(state: EditorState): Transaction | null {
  const doc = state.doc;
  if (doc.childCount <= 1) return null;
  const first = doc.child(0);
  const from = first.nodeSize;
  const to = doc.content.size;
  if (from >= to) return null;
  const tr = state.tr.delete(from, to);
  if (tr.steps.length === 0) return null;
  return tr;
}

/**
 * Each musing row is one TipTap doc, but StarterKit allows multiple top-level blocks.
 * Extra siblings look like a second empty line (and duplicate Placeholder text) with only one React row.
 * Strip trailing top-level nodes on load (TipTap builds initial state without dispatch, so
 * `appendTransaction` alone does not run) and after every transaction.
 */
export const singleTopLevelBlock = Extension.create({
  name: "singleTopLevelBlock",
  priority: 10000,
  onCreate({ editor }) {
    queueMicrotask(() => {
      if (editor.isDestroyed) return;
      const tr = collapseExtraTopLevelBlocks(editor.state);
      if (tr) editor.view.dispatch(tr);
    });
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("musingSingleTopLevelBlock"),
        appendTransaction(_trs, _old, newState) {
          return collapseExtraTopLevelBlocks(newState);
        },
      }),
    ];
  },
});
