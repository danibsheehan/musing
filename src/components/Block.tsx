import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import {
  applyBlockTypeToEditor,
  isBlockHtmlVisuallyEmpty,
  tipTapContentFromBlock,
} from "../lib/blockEditorCommands";
import type { AddBlockAfterEnterOptions, Block as BlockType } from "../types/block";
import { WikiLink } from "../extensions/wikiLink";
import { singleTopLevelBlock } from "../extensions/singleTopLevelBlock";
import { useWorkspace } from "../context/useWorkspace";
import { useNavigate } from "react-router-dom";

import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import DatabaseEmbedBlock from "./DatabaseEmbedBlock";
import EditorTextFormatBubble from "./EditorTextFormatBubble";
import { textBeforeCursorInBlock } from "../lib/editorBlockText";

/** True when the caret is right after `/` or still typing the slash-query (e.g. `/p`), without a closing space. */
function isSlashMenuOpen(editor: TiptapEditor): boolean {
  const textBefore = textBeforeCursorInBlock(editor.state.selection.$from);
  return /\/[^ \n]*$/.test(textBefore);
}

/** `@query` at end of block text (Obsidian-style page link picker). */
function isPagePickerOpen(editor: TiptapEditor): boolean {
  const textBefore = textBeforeCursorInBlock(editor.state.selection.$from);
  return /@([^ \n]*)$/.test(textBefore);
}

type DocumentBlockProps = {
  pageId: string;
  block: BlockType;
  menuBlockId: string | null;
  pagePickerBlockId: string | null;
  onContentChange: (id: string, content: string) => void;
  onEnter: (id: string, options?: AddBlockAfterEnterOptions) => void;
  /** When true, empty paragraph shows no slash hint until user types (then parent clears via `onClearSlashPlaceholderSuppression`). */
  suppressSlashPlaceholder?: boolean;
  onClearSlashPlaceholderSuppression?: (id: string) => void;
  /** Applies the slash menu choice for this block (Enter while `/…` is active, including before the menu mounts). */
  onConfirmSlashCommand: (blockId: string) => void;
  /** Applies the page picker choice when `@…` is active (Enter before React has opened the picker). */
  onConfirmPagePickerCommand: (blockId: string) => void;
  /** Notifies parent synchronously when `/` menu opens or closes for this block (before React commits `menuBlockId`). */
  onSlashMenuOpenChange: (blockId: string | null) => void;
  /** True briefly after a / command so a stray Enter does not create a row before `block.type` updates. */
  isPostSlashNewRowLocked: (blockId: string) => boolean;
  /** When set to this block id, skip one `applyBlockTypeToEditor` (already applied synchronously in the parent). */
  slashTypeSyncedInEditorRef: RefObject<string | null>;
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
  suppressSlashPlaceholder = false,
  onClearSlashPlaceholderSuppression,
  onConfirmSlashCommand,
  onConfirmPagePickerCommand,
  onSlashMenuOpenChange,
  isPostSlashNewRowLocked,
  slashTypeSyncedInEditorRef,
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

  /** Keeps TipTap `content` in sync with `block.type` when the block is empty (avoids reset to `<p>` after slash). */
  const tiptapContent = useMemo(
    () => tipTapContentFromBlock(block),
    [block.content, block.type]
  );

  const menuBlockIdRef = useRef(menuBlockId);
  const pagePickerBlockIdRef = useRef(pagePickerBlockId);
  const canMoveUpRef = useRef(canMoveUp);
  const canMoveDownRef = useRef(canMoveDown);
  const navigateRef = useRef(navigate);
  const onMoveBlockDeltaRef = useRef(onMoveBlockDelta);
  const prevBlockTypeRef = useRef<{ id: string; type: BlockType["type"] } | null>(null);
  const editorRef = useRef<TiptapEditor | null>(null);
  const prevIsFocusedRef = useRef(false);

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

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    onMoveBlockDeltaRef.current = onMoveBlockDelta;
  }, [onMoveBlockDelta]);

  /** `useEditor` deps omit these — read refs in `handleKeyDown` / `onUpdate` so dev Strict Mode + frequent renders stay correct. */
  const onEnterRef = useRef(onEnter);
  const suppressSlashPlaceholderRef = useRef(suppressSlashPlaceholder);
  const onClearSlashPlaceholderSuppressionRef = useRef(
    onClearSlashPlaceholderSuppression
  );
  const onConfirmSlashCommandRef = useRef(onConfirmSlashCommand);
  const onConfirmPagePickerCommandRef = useRef(onConfirmPagePickerCommand);
  const onBackspaceRef = useRef(onBackspace);
  const onContentChangeRef = useRef(onContentChange);
  const isPostSlashNewRowLockedRef = useRef(isPostSlashNewRowLocked);
  const otherPageCountRef = useRef(otherPageCount);

  useEffect(() => {
    onEnterRef.current = onEnter;
  }, [onEnter]);
  useEffect(() => {
    suppressSlashPlaceholderRef.current = suppressSlashPlaceholder;
  }, [suppressSlashPlaceholder]);
  useEffect(() => {
    onClearSlashPlaceholderSuppressionRef.current =
      onClearSlashPlaceholderSuppression;
  }, [onClearSlashPlaceholderSuppression]);
  useEffect(() => {
    onConfirmSlashCommandRef.current = onConfirmSlashCommand;
  }, [onConfirmSlashCommand]);
  useEffect(() => {
    onConfirmPagePickerCommandRef.current = onConfirmPagePickerCommand;
  }, [onConfirmPagePickerCommand]);
  useEffect(() => {
    onBackspaceRef.current = onBackspace;
  }, [onBackspace]);
  useEffect(() => {
    onContentChangeRef.current = onContentChange;
  }, [onContentChange]);
  useEffect(() => {
    isPostSlashNewRowLockedRef.current = isPostSlashNewRowLocked;
  }, [isPostSlashNewRowLocked]);
  useEffect(() => {
    otherPageCountRef.current = otherPageCount;
  }, [otherPageCount]);

  const slashMenuRaf = useRef(0);

  const queueSlashMenuSync = useCallback(
    (ed: TiptapEditor) => {
      cancelAnimationFrame(slashMenuRaf.current);
      slashMenuRaf.current = requestAnimationFrame(() => {
        if (ed.isDestroyed) return;

        const closeSlashForThisRow = () => {
          if (menuBlockIdRef.current !== block.id) return;
          menuBlockIdRef.current = null;
          onSlashMenuOpenChange(null);
          setShowMenu(false);
          setMenuBlockId(null);
          setMenuPosition(null);
        };

        const open = isSlashMenuOpen(ed);
        if (!open) {
          closeSlashForThisRow();
          return;
        }

        const { from, $from } = ed.state.selection;
        const textBefore = textBeforeCursorInBlock($from);
        const m = textBefore.match(/\/[^ \n]*$/);
        if (!m) {
          closeSlashForThisRow();
          return;
        }

        const slashPos = from - m[0].length;
        const coords = ed.view.coordsAtPos(slashPos);
        const top = coords.bottom + 4;
        const left = coords.left;
        if (!Number.isFinite(top) || !Number.isFinite(left)) {
          closeSlashForThisRow();
          return;
        }

        menuBlockIdRef.current = block.id;
        onSlashMenuOpenChange(block.id);
        closePagePickerMenu();
        setMenuPosition({ top, left });
        setShowMenu(true);
        setMenuBlockId(block.id);
      });
    },
    [
      block.id,
      closePagePickerMenu,
      setMenuBlockId,
      setMenuPosition,
      setShowMenu,
      onSlashMenuOpenChange,
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
        const closePickerForThisRow = () => {
          if (pagePickerBlockIdRef.current !== block.id) return;
          pagePickerBlockIdRef.current = null;
          setShowPagePicker(false);
          setPagePickerBlockId(null);
          setPagePickerPosition(null);
        };

        const open = isPagePickerOpen(ed);
        if (!open) {
          closePickerForThisRow();
          return;
        }

        const { from, $from } = ed.state.selection;
        const textBefore = textBeforeCursorInBlock($from);
        const m = textBefore.match(/@([^ \n]*)$/);
        if (!m) {
          closePickerForThisRow();
          return;
        }

        const atPos = from - m[0].length;
        const coords = ed.view.coordsAtPos(atPos);
        const top = coords.bottom + 4;
        const left = coords.left;
        if (!Number.isFinite(top) || !Number.isFinite(left)) {
          closePickerForThisRow();
          return;
        }

        closeSlashMenu();
        pagePickerBlockIdRef.current = block.id;
        setPagePickerPosition({ top, left });
        setPagePickerQuery(m[1] ?? "");
        setShowPagePicker(true);
        setPagePickerBlockId(block.id);
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
      parseOptions: {
        preserveWhitespace: "full",
      },
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2],
          },
          /**
           * TrailingNode also uses `appendTransaction` to insert a final paragraph when the doc
           * ends in a non-paragraph block. `singleTopLevelBlock` deletes extra top-level siblings in
           * the same `applyTransaction` loop — the two extensions fight forever → OOM / debugger pause.
           */
          trailingNode: false,
        }),
        singleTopLevelBlock,
        Placeholder.configure({
          placeholder: "Press '/' for commands",
          showOnlyCurrent: false,
        }),
        wikiLinkExtension,
      ],
      content: tiptapContent,
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        onContentChangeRef.current(block.id, html);
        if (
          suppressSlashPlaceholderRef.current &&
          !isBlockHtmlVisuallyEmpty(html)
        ) {
          onClearSlashPlaceholderSuppressionRef.current?.(block.id);
        }
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
              navigateRef.current(`/page/${wikiPageId}`);
              return true;
            }
          }
          return false;
        },
        handleKeyDown(view, event) {
          if (event.altKey && !event.metaKey && !event.ctrlKey) {
            if (event.key === "ArrowUp" && canMoveUpRef.current) {
              event.preventDefault();
              onMoveBlockDeltaRef.current(block.id, -1);
              return true;
            }
            if (event.key === "ArrowDown" && canMoveDownRef.current) {
              event.preventDefault();
              onMoveBlockDeltaRef.current(block.id, 1);
              return true;
            }
          }

          if (event.key === "Enter") {
            const ed = editorRef.current;
            // Page picker / slash: `showMenu` / `showPagePicker` may still be false for one frame after
            // RAF sets refs — do not swallow Enter without confirming, or a later Enter becomes `onEnter`
            // and inserts an empty row.
            if (
              ed &&
              !ed.isDestroyed &&
              otherPageCountRef.current > 0 &&
              isPagePickerOpen(ed)
            ) {
              event.preventDefault();
              event.stopImmediatePropagation();
              onConfirmPagePickerCommandRef.current(block.id);
              return true;
            }
            if (ed && !ed.isDestroyed && isSlashMenuOpen(ed)) {
              event.preventDefault();
              event.stopImmediatePropagation();
              onConfirmSlashCommandRef.current(block.id);
              return true;
            }
            if (
              ed &&
              !ed.isDestroyed &&
              (ed.isActive("codeBlock") ||
                ed.isActive("bulletList") ||
                ed.isActive("orderedList") ||
                ed.isActive("horizontalRule"))
            ) {
              return false;
            }
            // Quote blocks: Enter creates the next app-level block (like a paragraph). Shift+Enter keeps a line inside the quote.
            if (
              ed &&
              !ed.isDestroyed &&
              ed.isActive("blockquote") &&
              event.shiftKey
            ) {
              return false;
            }
            if (isPostSlashNewRowLockedRef.current(block.id)) {
              event.preventDefault();
              event.stopImmediatePropagation();
              return true;
            }
            if (event.repeat) {
              event.preventDefault();
              event.stopImmediatePropagation();
              return true;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            onEnterRef.current(block.id);
            return true;
          }

          if (event.key === "Backspace") {
            const ed = editorRef.current;
            const isEmpty =
              ed && !ed.isDestroyed
                ? ed.isEmpty
                : view.state.doc.textContent.replace(/[\u200b-\u200d\ufeff]/g, "").trim()
                    .length === 0;
            if (isEmpty) {
              event.preventDefault();
              onBackspaceRef.current(block.id);
              return true;
            }
          }

          return false;
        },
      },
    },
    [pageId, block.id, wikiLinkExtension]
  );

  useEffect(() => {
    if (!editor) return;
    if (slashTypeSyncedInEditorRef.current === block.id) {
      slashTypeSyncedInEditorRef.current = null;
      prevBlockTypeRef.current = { id: block.id, type: block.type };
      return;
    }
    const prev = prevBlockTypeRef.current;
    if (
      prev !== null &&
      prev.id === block.id &&
      prev.type !== block.type
    ) {
      applyBlockTypeToEditor(editor, block.type);
    }
    prevBlockTypeRef.current = { id: block.id, type: block.type };
  }, [block.type, block.id, editor, slashTypeSyncedInEditorRef]);

  useEffect(() => {
    editorRef.current = editor ?? null;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    registerEditor(block.id, editor);
    return () => registerEditor(block.id, null);
  }, [editor, block.id, registerEditor]);

  useEffect(() => {
    prevIsFocusedRef.current = false;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const becameFocused = isFocused && !prevIsFocusedRef.current;
    prevIsFocusedRef.current = isFocused;
    if (!becameFocused) return;
    // Before mount, `editor.view.hasFocus()` throws (view proxy is not ready).
    if (editor.isInitialized && editor.view.hasFocus()) return;
    editor.commands.focus();
  }, [editor, isFocused]);

  return (
    <div onClick={() => setFocusedBlockId(block.id)}>
      {editor ? <EditorTextFormatBubble editor={editor} blockId={block.id} /> : null}
      <EditorContent
        editor={editor}
        className={[
          "editor-content",
          suppressSlashPlaceholder ? "editor-content--suppress-slash-hint" : "",
          block.type === "codeBlock" ? "editor-content--code-block-row" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      />
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
