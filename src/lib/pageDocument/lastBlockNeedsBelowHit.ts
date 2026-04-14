import type { Node as PMNode } from "@tiptap/pm/model";

/** Last top-level node types where the caret cannot sit “below” the block — offer a click strip to add a paragraph. */
export function lastTopLevelBlockNeedsBelowHit(doc: PMNode): boolean {
  if (doc.childCount === 0) return false;
  const last = doc.child(doc.childCount - 1);
  const name = last.type.name;
  return (
    name === "codeBlock" ||
    name === "bulletList" ||
    name === "orderedList" ||
    name === "blockquote"
  );
}
