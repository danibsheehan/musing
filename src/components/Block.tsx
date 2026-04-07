import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { applyBlockTypeToEditor } from "../lib/blockEditorCommands";
import type { Block as BlockType } from "../types/block";
import { WikiLink } from "../extensions/wikiLink";
import { useWorkspace } from "../context/useWorkspace";
import { useNavigate } from "react-router-dom";

import { useCallback, useEffect, useMemo, useRef } from "react";
import DatabaseEmbedBlock from "./DatabaseEmbedBlock";

/** True when the caret is right after `/` or still typing the slash-query (e.g. `/p`), without a closing space. */
function isSlashMenuOpen(editor: TiptapEditor): boolean {
  const { from, $from } = editor.state.selection;
  const start = $from.start();
  if (from <= start) return false;
  const textBefore = editor.state.doc.textBetween(start, from);
  return /\/[^ \n]*$/.test(textBefore);
}

/** `@query` at end of block text (Obsidian-style page link picker). */
function isPagePickerOpen(editor: TiptapEditor): boolean {
  const { from, $from } = editor.state.selection;
  const start = $from.start();
  if (from <= start) return false;
  const textBefore = editor.state.doc.textBetween(start, from);
  return /@([^ \n]*)$/.test(textBefore);
}

type DocumentBlockProps = {
  pageId: string;
  block: BlockType;
  menuBlockId: string | null;
  pagePickerBlockId: string | null;
  onContentChange: (id: string, content: string) => void;
  onEnter: (id: string) => void;
  onBackspace: (id: string) => void;
  isFocused: boolean;
  registerEditor: (id: string, instance: TiptapEditor | null) => void;
  setFocusedBlockId: (id: string) => void;
  setShowMenu: (show: boolean) => void;
  setMenuBlockId: (id: string | null) => void;
  setMenuPosition: (pos: { top: number; left: number } | null) => void;
  setShowPagePicker: (show: boolean) => void;
  setPagePickerBlockId: (id: string | null) => void;
  setPagePickerPosition: (pos: { top: number; left: number } | null) => void;
  setPagePickerQuery: (query: string) => void;
  closePagePickerMenu: () => void;
  closeSlashMenu: () => void;
  otherPageCount: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveBlockDelta: (id: string, delta: -1 | 1) => void;
};

function DocumentBlock({
  pageId,
  block,
  menuBlockId,
  pagePickerBlockId,
  onContentChange,
  onEnter,
  onBackspace,
  isFocused,
  registerEditor,
  setFocusedBlockId,
  setShowMenu,
  setMenuBlockId,
  setMenuPosition,
  setShowPagePicker,
  setPagePickerBlockId,
  setPagePickerPosition,
  setPagePickerQuery,
  closePagePickerMenu,
  closeSlashMenu,
  otherPageCount,
  canMoveUp,
  canMoveDown,
  onMoveBlockDelta,
}: DocumentBlockProps) {
  const navigate = useNavigate();
  const { pages } = useWorkspace();
  /** TipTap reads this from input rules only, not during React render. */
  const pagesBox = useRef(pages);
  useEffect(() => {
    pagesBox.current = pages;
  }, [pages]);

  const wikiLinkExtension = useMemo(() => {
    // eslint-disable-next-line react-hooks/refs -- getPages runs in TipTap input rules only
    return WikiLink.configure({
      getPages: () => pagesBox.current,
    });
  }, []);

  const menuBlockIdRef = useRef(menuBlockId);
  const pagePickerBlockIdRef = useRef(pagePickerBlockId);
  const canMoveUpRef = useRef(canMoveUp);
  const canMoveDownRef = useRef(canMoveDown);
  const prevBlockTypeRef = useRef<{ id: string; type: BlockType["type"] } | null>(null);
  const editorRef = useRef<TiptapEditor | null>(null);

  useEffect(() => {
    menuBlockIdRef.current = menuBlockId;
  }, [menuBlockId]);

  useEffect(() => {
    pagePickerBlockIdRef.current = pagePickerBlockId;
  }, [pagePickerBlockId]);

  useEffect(() => {
    canMoveUpRef.current = canMoveUp;
  }, [canMoveUp]);

  useEffect(() => {
    canMoveDownRef.current = canMoveDown;
  }, [canMoveDown]);

  const slashMenuRaf = useRef(0);

  const queueSlashMenuSync = useCallback(
    (ed: TiptapEditor) => {
      cancelAnimationFrame(slashMenuRaf.current);
      slashMenuRaf.current = requestAnimationFrame(() => {
        if (ed.isDestroyed) return;
        const open = isSlashMenuOpen(ed);
        if (open) {
          closePagePickerMenu();
          const { from, $from } = ed.state.selection;
          const blockStart = $from.start();
          const textBefore = ed.state.doc.textBetween(blockStart, from);
          const m = textBefore.match(/\/[^ \n]*$/);
          if (!m) return;
          const slashPos = from - m[0].length;
          const coords = ed.view.coordsAtPos(slashPos);
          setMenuPosition({
            top: coords.bottom + 4,
            left: coords.left,
          });
          setShowMenu(true);
          setMenuBlockId(block.id);
        } else if (menuBlockIdRef.current === block.id) {
          setShowMenu(false);
          setMenuBlockId(null);
          setMenuPosition(null);
        }
      });
    },
    [
      block.id,
      closePagePickerMenu,
      setMenuBlockId,
      setMenuPosition,
      setShowMenu,
    ]
  );

  const pagePickerRaf = useRef(0);

  const queuePagePickerSync = useCallback(
    (ed: TiptapEditor) => {
      cancelAnimationFrame(pagePickerRaf.current);
      pagePickerRaf.current = requestAnimationFrame(() => {
        if (ed.isDestroyed) return;
        if (otherPageCount === 0) {
          if (pagePickerBlockIdRef.current === block.id) {
            setShowPagePicker(false);
            setPagePickerBlockId(null);
            setPagePickerPosition(null);
          }
          return;
        }
        const open = isPagePickerOpen(ed);
        if (open) {
          closeSlashMenu();
          const { from, $from } = ed.state.selection;
          const blockStart = $from.start();
          const textBefore = ed.state.doc.textBetween(blockStart, from);
          const m = textBefore.match(/@([^ \n]*)$/);
          if (!m) return;
          const atPos = from - m[0].length;
          const coords = ed.view.coordsAtPos(atPos);
          setPagePickerPosition({
            top: coords.bottom + 4,
            left: coords.left,
          });
          setPagePickerQuery(m[1] ?? "");
          setShowPagePicker(true);
          setPagePickerBlockId(block.id);
        } else if (pagePickerBlockIdRef.current === block.id) {
          setShowPagePicker(false);
          setPagePickerBlockId(null);
          setPagePickerPosition(null);
        }
      });
    },
    [
      block.id,
      closeSlashMenu,
      otherPageCount,
      setPagePickerBlockId,
      setPagePickerPosition,
      setPagePickerQuery,
      setShowPagePicker,
    ]
  );

  useEffect(
    () => () => cancelAnimationFrame(pagePickerRaf.current),
    []
  );

  useEffect(
    () => () => cancelAnimationFrame(slashMenuRaf.current),
    []
  );

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2],
          },
        }),
        wikiLinkExtension,
      ],
      content: block.content,
      onUpdate: ({ editor }) => {
        onContentChange(block.id, editor.getHTML());
        queueSlashMenuSync(editor);
        queuePagePickerSync(editor);
      },
      onSelectionUpdate: ({ editor }) => {
        queueSlashMenuSync(editor);
        queuePagePickerSync(editor);
      },
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
          if (event.altKey && !event.metaKey && !event.ctrlKey) {
            if (event.key === "ArrowUp" && canMoveUpRef.current) {
              event.preventDefault();
              onMoveBlockDelta(block.id, -1);
              return true;
            }
            if (event.key === "ArrowDown" && canMoveDownRef.current) {
              event.preventDefault();
              onMoveBlockDelta(block.id, 1);
              return true;
            }
          }

          if (event.key === "Enter") {
            if (
              menuBlockIdRef.current === block.id ||
              pagePickerBlockIdRef.current === block.id
            ) {
              event.preventDefault();
              return true;
            }
            const ed = editorRef.current;
            if (
              ed &&
              !ed.isDestroyed &&
              (ed.isActive("codeBlock") ||
                ed.isActive("bulletList") ||
                ed.isActive("orderedList") ||
                ed.isActive("blockquote") ||
                ed.isActive("horizontalRule"))
            ) {
              return false;
            }
            event.preventDefault();
            onEnter(block.id);
            return true;
          }

          if (event.key === "Backspace") {
            const isEmpty = view.state.doc.textContent.length === 0;
            if (isEmpty) {
              event.preventDefault();
              onBackspace(block.id);
              return true;
            }
          }

          return false;
        },
      },
    },
    [pageId, block.id, wikiLinkExtension, navigate, onMoveBlockDelta]
  );

  useEffect(() => {
    if (!editor) return;
    const prev = prevBlockTypeRef.current;
    if (
      prev !== null &&
      prev.id === block.id &&
      prev.type !== block.type
    ) {
      applyBlockTypeToEditor(editor, block.type);
    }
    prevBlockTypeRef.current = { id: block.id, type: block.type };
  }, [block.type, block.id, editor]);

  useEffect(() => {
    editorRef.current = editor ?? null;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    registerEditor(block.id, editor);
    return () => registerEditor(block.id, null);
  }, [editor, block.id, registerEditor]);

  useEffect(() => {
    if (!editor || !isFocused) return;
    editor.commands.focus();
  }, [editor, isFocused]);

  return (
    <div onClick={() => setFocusedBlockId(block.id)}>
      <EditorContent editor={editor} className="editor-content" />
    </div>
  );
}

type Props = DocumentBlockProps;

export default function Block(props: Props) {
  if (props.block.type === "databaseEmbed") {
    return <DatabaseEmbedBlock {...props} />;
  }
  return <DocumentBlock {...props} />;
}
