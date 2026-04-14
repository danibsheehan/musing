import { useEditor, EditorContent } from "@tiptap/react";
import { type Editor as TiptapEditor } from "@tiptap/core";
import Emoji from "@tiptap/extension-emoji";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { useNavigate } from "react-router-dom";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import PageBlockGutter from "./PageBlockGutter";
import PageDocumentBelowHit from "./PageDocumentBelowHit";
import type { Block as BlockType } from "../types/block";
import { WikiLink } from "../extensions/wikiLink";
import { blockIdOnBlocks } from "../extensions/blockIdOnBlocks";
import { ensureTopLevelBlockIds } from "../extensions/ensureTopLevelBlockIds";
import { MusingDatabaseEmbed } from "../extensions/musingDatabaseEmbed";
import { useWorkspace } from "../context/useWorkspace";
import { blocksToDocHtml } from "../lib/pageDocument/blocksToDocHtml";
import { serializeDocToBlocks } from "../lib/pageDocument/serializeDocToBlocks";
import EditorTextFormatBubble from "./EditorTextFormatBubble";
import {
  createEmojiSuggestionRender,
  emojiSuggestionItems,
} from "../lib/emojiSuggestionRender";
import { EmojiSuggestionPluginKey } from "@tiptap/extension-emoji";

function isEmojiSuggestionOpen(editor: TiptapEditor): boolean {
  const st = EmojiSuggestionPluginKey.getState(editor.state) as
    | { active?: boolean }
    | undefined;
  return !!st?.active;
}

type Props = {
  pageId: string;
  blocks: BlockType[];
  externalWorkspaceRevision: number;
  onBlocksChange: (blocks: BlockType[]) => void;
  registerEditor: (instance: TiptapEditor | null) => void;
  /** Slash menu, @ picker, focus bookkeeping */
  onEditorActivity: (editor: TiptapEditor) => void;
  /** Return true to block default ProseMirror handling (e.g. Backspace on empty row). */
  onEditorKeyDown?: (editor: TiptapEditor, event: KeyboardEvent) => boolean;
};

export default function PageDocumentEditor({
  pageId,
  blocks,
  externalWorkspaceRevision,
  onBlocksChange,
  registerEditor,
  onEditorActivity,
  onEditorKeyDown,
}: Props) {
  const navigate = useNavigate();
  const { pages } = useWorkspace();
  const pagesBox = useRef(pages);
  useEffect(() => {
    pagesBox.current = pages;
  }, [pages]);

  const wikiLinkExtension = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- getPages is called from ProseMirror, not during React render
      WikiLink.configure({
        getPages: () => pagesBox.current,
      }),
    []
  );

  const emojiExtension = useMemo(
    () =>
      Emoji.configure({
        suggestion: {
          items: emojiSuggestionItems,
          render: createEmojiSuggestionRender(),
        },
      }),
    []
  );

  const blocksForSyncRef = useRef(blocks);
  useLayoutEffect(() => {
    blocksForSyncRef.current = blocks;
  }, [blocks]);
  const lastExternalRevisionRef = useRef(externalWorkspaceRevision);
  const onEditorKeyDownRef = useRef(onEditorKeyDown);
  useLayoutEffect(() => {
    onEditorKeyDownRef.current = onEditorKeyDown;
  }, [onEditorKeyDown]);

  const editorShellRef = useRef<HTMLDivElement>(null);

  const editor = useEditor(
    {
      parseOptions: {
        preserveWhitespace: "full",
      },
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2] },
          /** Each app `Block` is a top-level node; default TrailingNode adds an empty `<p>` after headings/HR — looks like an extra block. */
          trailingNode: false,
        }),
        blockIdOnBlocks,
        ensureTopLevelBlockIds,
        MusingDatabaseEmbed,
        emojiExtension,
        Placeholder.configure({
          placeholder: "Press '/' for commands",
          showOnlyCurrent: false,
        }),
        wikiLinkExtension,
      ],
      content: blocksToDocHtml(blocks),
      editorProps: {
        handleClick(_view, _pos, event) {
          if (event.button !== 0) return false;
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return false;
          }
          const target = event.target as HTMLElement | null;
          const a = target?.closest?.("a.wiki-link");
          if (a instanceof HTMLAnchorElement) {
            const wikiPageId = a.getAttribute("data-wiki-page-id");
            if (wikiPageId) {
              event.preventDefault();
              navigate(`/page/${wikiPageId}`);
              return true;
            }
          }
          return false;
        },
        handleKeyDown(view, event) {
          const ed =
            (view.dom as HTMLElement & { editor?: TiptapEditor }).editor ??
            null;
          const keyDown = onEditorKeyDownRef.current;
          if (ed && !ed.isDestroyed && keyDown?.(ed, event)) {
            return true;
          }
          if (ed && !ed.isDestroyed && isEmojiSuggestionOpen(ed)) {
            if (
              event.key === "Enter" ||
              event.key === "ArrowUp" ||
              event.key === "ArrowDown" ||
              event.key === "Escape" ||
              event.key === "Tab"
            ) {
              return false;
            }
          }
          return false;
        },
      },
      onUpdate: ({ editor: ed }) => {
        onBlocksChange(serializeDocToBlocks(ed));
        onEditorActivity(ed);
      },
      onSelectionUpdate: ({ editor: ed }) => {
        onEditorActivity(ed);
      },
    },
    [pageId, wikiLinkExtension, emojiExtension]
  );

  const editorRef = useRef(editor);
  useLayoutEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    registerEditor(editor ?? null);
    return () => registerEditor(null);
  }, [editor, registerEditor]);

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || ed.isDestroyed) return;
    if (lastExternalRevisionRef.current === externalWorkspaceRevision) return;
    lastExternalRevisionRef.current = externalWorkspaceRevision;
    ed.commands.setContent(blocksToDocHtml(blocksForSyncRef.current), {
      emitUpdate: false,
    });
  }, [externalWorkspaceRevision, editor]);

  return (
    <div className="page-document-editor">
      {editor ? <EditorTextFormatBubble editor={editor} blockId="page-doc" /> : null}
      <div ref={editorShellRef} className="page-document-editor__shell">
        {editor ? (
          <>
            <PageBlockGutter editor={editor} measurementRootRef={editorShellRef} />
            <div className="page-document-editor__mainCol">
              <EditorContent
                editor={editor}
                className="page-document-editor-content editor-content"
              />
              <PageDocumentBelowHit editor={editor} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
