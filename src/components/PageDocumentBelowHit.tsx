import { useCallback, useEffect, useState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { insertParagraphBelowBlockAtIndex } from "../lib/pageDocument/blockGutterOps";
import { lastTopLevelBlockNeedsBelowHit } from "../lib/pageDocument/lastBlockNeedsBelowHit";

type Props = {
  editor: TiptapEditor;
};

export default function PageDocumentBelowHit({ editor }: Props) {
  const [visible, setVisible] = useState(() =>
    lastTopLevelBlockNeedsBelowHit(editor.state.doc)
  );

  const sync = useCallback(() => {
    if (editor.isDestroyed) return;
    setVisible(lastTopLevelBlockNeedsBelowHit(editor.state.doc));
  }, [editor]);

  useEffect(() => {
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => sync());
    };
    schedule();
    editor.on("update", schedule);
    editor.on("selectionUpdate", schedule);
    return () => {
      cancelAnimationFrame(raf);
      editor.off("update", schedule);
      editor.off("selectionUpdate", schedule);
    };
  }, [editor, sync]);

  const onClick = useCallback(() => {
    if (editor.isDestroyed) return;
    const { doc } = editor.state;
    if (doc.childCount === 0) return;
    insertParagraphBelowBlockAtIndex(editor, doc.childCount - 1);
  }, [editor]);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="page-document-editor-below-hit"
      aria-label="Add paragraph below"
      title="Add paragraph below"
      onPointerDown={(e) => e.preventDefault()}
      onClick={onClick}
    />
  );
}
