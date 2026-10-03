import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { v4 as uuidv4 } from "uuid";
import type { EditorState, Transaction } from "@tiptap/pm/state";

function ensureBlockIdsTransaction(state: EditorState): Transaction | null {
  const { doc } = state;
  const tr = state.tr;
  /** `Transform.setNodeMarkup` uses `doc.nodeAt(pos)` — must be the start of the block (0 for first child; `nodeAt(1)` is null for empty paragraphs). */
  let pos = 0;
  const seen = new Set<string>();
  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i);
    let id = node.attrs?.blockId as string | null | undefined;
    if (!id || seen.has(id)) {
      id = uuidv4();
      tr.setNodeMarkup(pos, undefined, {
        ...(node.attrs ?? {}),
        blockId: id,
      });
    }
    seen.add(id);
    pos += node.nodeSize;
  }
  if (tr.steps.length === 0) return null;
  return tr;
}

/**
 * Keeps top-level `blockId`s present and unique: assigns one to any child missing one, and a
 * fresh one to any child whose id repeats an earlier sibling's (split, paste, list lift, or
 * workspaces saved before this check existed). The first occurrence keeps its id.
 */
export const ensureTopLevelBlockIds = Extension.create({
  name: "ensureTopLevelBlockIds",
  priority: 10000,

  onCreate({ editor }) {
    queueMicrotask(() => {
      if (editor.isDestroyed) return;
      const tr = ensureBlockIdsTransaction(editor.state);
      if (tr) editor.view.dispatch(tr);
    });
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("ensureTopLevelBlockIds"),
        appendTransaction(_trs, _old, newState) {
          return ensureBlockIdsTransaction(newState);
        },
      }),
    ];
  },
});
