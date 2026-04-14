import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import type { Editor as TiptapEditor } from "@tiptap/core";
import PageDocumentEditor from "./PageDocumentEditor";
import type { Block as BlockType } from "../types/block";
import type { Page } from "../types/page";
import type { WorkspaceDatabase } from "../types/database";
import SlashMenu from "./SlashMenu";
import PagePickerMenu from "./PagePickerMenu";
import DatabasePickerMenu from "./DatabasePickerMenu";
import {
  filterSlashMenuItems,
  SLASH_MENU_ITEMS,
  type SlashMenuChoice,
} from "../lib/slashMenuOptions";
import { filterPagesForPicker } from "../lib/resolveWikiPage";
import { stringifyDatabaseEmbedPayload } from "../lib/databaseEmbed";
import { useWorkspace } from "../context/useWorkspace";
import { textBeforeCursorInBlock, viewCoordsForFloatingMenu } from "../lib/editorBlockText";
import { applyBlockTypeToEditor, isBlockHtmlVisuallyEmpty } from "../lib/blockEditorCommands";
import { blockIdAtSelection } from "../lib/pageDocument/blockIdAtSelection";
import { blocksToDocHtml } from "../lib/pageDocument/blocksToDocHtml";
import { findSlashMenuFilterDeleteRange } from "../lib/pageDocument/slashMenuDeleteRange";
import {
  isPagePickerOpen,
  isSlashMenuOpen,
  removePagePickerToken,
  removeSlashCommandToken,
} from "../lib/tiptapMenuOpen";
import { tryDeleteEmptyTopLevelBlock } from "../lib/pageDocument/tryDeleteEmptyTopLevelBlock";

/** If two consecutive empty paragraphs sit under the slash row, drop the second (stray Enter / double insert). */
function trimDuplicateEmptyParagraphBelowSlashAnchor(
  blocks: BlockType[],
  wave: { slashAt: number; anchorBlockId: string } | null,
  now: number
): BlockType[] {
  if (!wave || now - wave.slashAt > 1500) return blocks;
  const i = blocks.findIndex((b) => b.id === wave.anchorBlockId);
  if (i === -1 || blocks.length < i + 3) return blocks;
  const b = blocks[i + 1];
  const c = blocks[i + 2];
  if (
    b.type === "paragraph" &&
    c.type === "paragraph" &&
    isBlockHtmlVisuallyEmpty(b.content) &&
    isBlockHtmlVisuallyEmpty(c.content)
  ) {
    return [...blocks.slice(0, i + 2), ...blocks.slice(i + 3)];
  }
  return blocks;
}

type Props = {
  pageId: string;
  blocks: BlockType[];
  /** When this changes (e.g. storage synced from another tab), mirror `blocks` into local state. */
  externalWorkspaceRevision: number;
  onBlocksChange: (blocks: BlockType[]) => void;
};

export default function Editor({
  pageId,
  blocks,
  externalWorkspaceRevision,
  onBlocksChange,
}: Props) {
  const { pages, databases } = useWorkspace();

  const [localBlocks, setLocalBlocks] = useState<BlockType[]>(blocks);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(
    blocks[0]?.id ?? null
  );
  const [showMenu, setShowMenu] = useState(false);
  const [menuBlockId, setMenuBlockId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  /** Text after `/` in the block (drives filtering; typed in the editor, not a separate input). */
  const [slashMenuQuery, setSlashMenuQuery] = useState("");

  /** Avoid stale closures on `window` keydown (effect timing vs `flushSync` / menu open). */
  const showMenuRef = useRef(false);
  const menuBlockIdRef = useRef<string | null>(null);
  const slashSelectedIndexRef = useRef(0);
  /** Set synchronously from Block when `/` menu opens — `menuBlockId` state/ref can lag one frame behind `showMenu`. */
  const slashAnchorBlockIdRef = useRef<string | null>(null);
  /** While applying a non-embed slash command, block `addBlockAfter` for this row (re-entrant Enter / focus). */
  const slashMutatingBlockIdRef = useRef<string | null>(null);
  const slashMutatingClearTimerRef = useRef(0);
  /** Re-enable `setEditable(true)` after a slash apply — must clear on unmount. */
  const slashEditableRestoreTimerRef = useRef(0);
  const postSlashWaveRef = useRef<{
    slashAt: number;
    anchorBlockId: string;
    lastInsertedChildId: string | null;
    lastInsertAt: number;
  } | null>(null);
  const showPagePickerRef = useRef(false);
  const showDatabasePickerRef = useRef(false);

  const [showPagePicker, setShowPagePicker] = useState(false);
  const [pagePickerBlockId, setPagePickerBlockId] = useState<string | null>(null);
  const [pagePickerPosition, setPagePickerPosition] = useState<{ top: number; left: number } | null>(
    null
  );
  const [pagePickerQuery, setPagePickerQueryState] = useState("");
  const [pagePickerSelectedIndex, setPagePickerSelectedIndex] = useState(0);

  const [showDatabasePicker, setShowDatabasePicker] = useState(false);
  const [databasePickerBlockId, setDatabasePickerBlockId] = useState<string | null>(null);
  const [databasePickerPosition, setDatabasePickerPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [databasePickerSelectedIndex, setDatabasePickerSelectedIndex] = useState(0);

  const slashMenuQueryRef = useRef("");
  const pagePickerBlockIdRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    showMenuRef.current = showMenu;
    menuBlockIdRef.current = menuBlockId;
    slashSelectedIndexRef.current = selectedIndex;
    slashMenuQueryRef.current = slashMenuQuery;
    showPagePickerRef.current = showPagePicker;
    showDatabasePickerRef.current = showDatabasePicker;
    pagePickerBlockIdRef.current = pagePickerBlockId;
  }, [
    showMenu,
    menuBlockId,
    selectedIndex,
    slashMenuQuery,
    showPagePicker,
    showDatabasePicker,
    pagePickerBlockId,
  ]);

  const otherPageCount = useMemo(
    () => pages.filter((p) => p.id !== pageId).length,
    [pages, pageId]
  );

  const filteredSlashItems = useMemo(
    () => filterSlashMenuItems(SLASH_MENU_ITEMS, slashMenuQuery),
    [slashMenuQuery]
  );

  const safeSlashIndex =
    filteredSlashItems.length === 0
      ? 0
      : Math.min(selectedIndex, filteredSlashItems.length - 1);

  useEffect(() => {
    if (!showMenu) return;
    setSelectedIndex(0);
  }, [slashMenuQuery, showMenu]);

  const pickerPages = useMemo(
    () =>
      filterPagesForPicker(pages, {
        query: pagePickerQuery,
        excludePageId: pageId,
      }),
    [pages, pagePickerQuery, pageId]
  );

  const blocksRef = useRef(blocks);
  /** Latest `localBlocks` for synchronous reads inside `addBlockAfter` (must see inserts before chained PM handlers run). */
  const localBlocksRef = useRef(localBlocks);
  localBlocksRef.current = localBlocks;
  const focusedBlockIdRef = useRef(focusedBlockId);
  focusedBlockIdRef.current = focusedBlockId;
  const lastExternalRevisionRef = useRef(externalWorkspaceRevision);
  /** Set in `replaceBlocks` when local edits need persisting — flushed in `useLayoutEffect`, not inside `setLocalBlocks`. */
  const shouldPersistToWorkspaceRef = useRef(false);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  useEffect(() => {
    if (externalWorkspaceRevision === lastExternalRevisionRef.current) return;
    lastExternalRevisionRef.current = externalWorkspaceRevision;
    const next = blocksRef.current;
    setLocalBlocks(next);
    setFocusedBlockId((prev) =>
      prev && next.some((b) => b.id === prev) ? prev : next[0]?.id ?? null
    );
  }, [externalWorkspaceRevision]);

  const pageEditorRef = useRef<TiptapEditor | null>(null);
  const slashMenuActivityRafRef = useRef(0);
  const pagePickerActivityRafRef = useRef(0);
  const slashMenuRef = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      window.clearTimeout(slashMutatingClearTimerRef.current);
      window.clearTimeout(slashEditableRestoreTimerRef.current);
    },
    []
  );

  const pagePickerRef = useRef<HTMLDivElement>(null);
  const databasePickerRef = useRef<HTMLDivElement>(null);

  const replaceBlocks = useCallback(
    (updater: (prev: BlockType[]) => BlockType[]) => {
      setLocalBlocks((prev) => {
        let next = updater(prev);
        if (next === prev) return prev;
        const wave = postSlashWaveRef.current;
        if (wave) {
          next = trimDuplicateEmptyParagraphBelowSlashAnchor(
            next,
            wave,
            performance.now()
          );
        }
        if (next !== prev) {
          shouldPersistToWorkspaceRef.current = true;
        }
        return next;
      });
    },
    []
  );

  useLayoutEffect(() => {
    if (!shouldPersistToWorkspaceRef.current) return;
    shouldPersistToWorkspaceRef.current = false;
    onBlocksChange(localBlocks);
  }, [localBlocks, onBlocksChange]);

  const closeSlashMenu = useCallback(() => {
    const ed = pageEditorRef.current;
    if (ed && !ed.isDestroyed) {
      removeSlashCommandToken(ed);
    }
    slashAnchorBlockIdRef.current = null;
    /** Same-tick as Backspace / pointer close so `window` capture listeners see a closed menu immediately. */
    showMenuRef.current = false;
    menuBlockIdRef.current = null;
    slashMenuQueryRef.current = "";
    setShowMenu(false);
    setMenuBlockId(null);
    setMenuPosition(null);
    setSelectedIndex(0);
    setSlashMenuQuery("");
  }, []);

  const onSlashMenuOpenChange = useCallback((blockId: string | null) => {
    slashAnchorBlockIdRef.current = blockId;
  }, []);

  const closePagePickerMenu = useCallback(() => {
    const ed = pageEditorRef.current;
    if (ed && !ed.isDestroyed) {
      removePagePickerToken(ed);
    }
    setShowPagePicker(false);
    setPagePickerBlockId(null);
    setPagePickerPosition(null);
    setPagePickerQueryState("");
    setPagePickerSelectedIndex(0);
  }, []);

  const closeDatabasePicker = useCallback(() => {
    setShowDatabasePicker(false);
    setDatabasePickerBlockId(null);
    setDatabasePickerPosition(null);
    setDatabasePickerSelectedIndex(0);
  }, []);

  const setPagePickerQuery = useCallback((query: string) => {
    setPagePickerQueryState(query);
    setPagePickerSelectedIndex(0);
  }, []);

  const registerPageEditor = useCallback((instance: TiptapEditor | null) => {
    pageEditorRef.current = instance;
  }, []);

  const queueSlashMenuFromEditor = useCallback(
    (ed: TiptapEditor) => {
      cancelAnimationFrame(slashMenuActivityRafRef.current);
      slashMenuActivityRafRef.current = requestAnimationFrame(() => {
        if (ed.isDestroyed) return;
        const activeBlockId =
          blockIdAtSelection(ed) ??
          menuBlockIdRef.current ??
          slashAnchorBlockIdRef.current;
        if (!activeBlockId) return;

        const thisBlockOwnsSlashMenu = () =>
          menuBlockId === activeBlockId || menuBlockIdRef.current === activeBlockId;

        const closeSlashForThisRow = () => {
          if (!thisBlockOwnsSlashMenu()) return;
          menuBlockIdRef.current = null;
          onSlashMenuOpenChange(null);
          setSlashMenuQuery("");
          setShowMenu(false);
          setMenuBlockId(null);
          setMenuPosition(null);
        };

        const open = isSlashMenuOpen(ed);
        if (!open) {
          if (ed.view.composing) return;
          closeSlashForThisRow();
          return;
        }

        const { from, $from } = ed.state.selection;
        const textBefore = textBeforeCursorInBlock($from);
        const m = textBefore.match(/\/[^ \n]*$/);
        if (!m) {
          if (ed.view.composing) return;
          closeSlashForThisRow();
          return;
        }

        const slashPos = from - m[0].length;
        const coords = viewCoordsForFloatingMenu(ed.view, slashPos, from);
        const top = coords.bottom + 4;
        const left = coords.left;
        if (!Number.isFinite(top) || !Number.isFinite(left)) {
          if (ed.view.composing) return;
          closeSlashForThisRow();
          return;
        }

        menuBlockIdRef.current = activeBlockId;
        onSlashMenuOpenChange(activeBlockId);
        closePagePickerMenu();
        setSlashMenuQuery(m[0].slice(1));
        setMenuPosition({ top, left });
        setShowMenu(true);
        setMenuBlockId(activeBlockId);
      });
    },
    [
      menuBlockId,
      closePagePickerMenu,
      setMenuBlockId,
      setMenuPosition,
      setShowMenu,
      setSlashMenuQuery,
      onSlashMenuOpenChange,
    ]
  );

  const queuePagePickerFromEditor = useCallback(
    (ed: TiptapEditor) => {
      cancelAnimationFrame(pagePickerActivityRafRef.current);
      pagePickerActivityRafRef.current = requestAnimationFrame(() => {
        if (ed.isDestroyed) return;
        if (otherPageCount === 0) {
          if (pagePickerBlockIdRef.current) {
            setShowPagePicker(false);
            setPagePickerBlockId(null);
            setPagePickerPosition(null);
          }
          return;
        }
        const activeBlockId =
          blockIdAtSelection(ed) ?? pagePickerBlockIdRef.current;
        if (!activeBlockId) return;

        const thisBlockOwnsPagePicker = () =>
          pagePickerBlockId === activeBlockId ||
          pagePickerBlockIdRef.current === activeBlockId;

        const closePickerForThisRow = () => {
          if (!thisBlockOwnsPagePicker()) return;
          pagePickerBlockIdRef.current = null;
          setShowPagePicker(false);
          setPagePickerBlockId(null);
          setPagePickerPosition(null);
        };

        const open = isPagePickerOpen(ed);
        if (!open) {
          if (ed.view.composing) return;
          closePickerForThisRow();
          return;
        }

        const { from, $from } = ed.state.selection;
        const textBefore = textBeforeCursorInBlock($from);
        const m = textBefore.match(/@([^ \n]*)$/);
        if (!m) {
          if (ed.view.composing) return;
          closePickerForThisRow();
          return;
        }

        const atPos = from - m[0].length;
        const coords = viewCoordsForFloatingMenu(ed.view, atPos, from);
        const top = coords.bottom + 4;
        const left = coords.left;
        if (!Number.isFinite(top) || !Number.isFinite(left)) {
          if (ed.view.composing) return;
          closePickerForThisRow();
          return;
        }

        closeSlashMenu();
        pagePickerBlockIdRef.current = activeBlockId;
        setPagePickerPosition({ top, left });
        setPagePickerQuery(m[1] ?? "");
        setShowPagePicker(true);
        setPagePickerBlockId(activeBlockId);
      });
    },
    [
      otherPageCount,
      pagePickerBlockId,
      closeSlashMenu,
      setPagePickerBlockId,
      setPagePickerPosition,
      setPagePickerQuery,
      setShowPagePicker,
    ]
  );

  const handlePageEditorActivity = useCallback(
    (ed: TiptapEditor) => {
      const bid = blockIdAtSelection(ed);
      if (bid) setFocusedBlockId(bid);
      queueSlashMenuFromEditor(ed);
      queuePagePickerFromEditor(ed);
    },
    [queueSlashMenuFromEditor, queuePagePickerFromEditor]
  );

  const handlePageDocumentKeyDown = useCallback(
    (ed: TiptapEditor, event: KeyboardEvent): boolean => {
      if (ed.isDestroyed) return false;
      if (event.key !== "Backspace") return false;
      if (ed.view.composing) return false;

      if (!isSlashMenuOpen(ed) && showMenuRef.current) {
        closeSlashMenu();
        event.preventDefault();
        return true;
      }
      if (
        otherPageCount > 0 &&
        !isPagePickerOpen(ed) &&
        showPagePickerRef.current
      ) {
        closePagePickerMenu();
        event.preventDefault();
        return true;
      }

      if (tryDeleteEmptyTopLevelBlock(ed)) {
        event.preventDefault();
        return true;
      }
      return false;
    },
    [closeSlashMenu, closePagePickerMenu, otherPageCount]
  );

  useEffect(
    () => () => {
      cancelAnimationFrame(slashMenuActivityRafRef.current);
      cancelAnimationFrame(pagePickerActivityRafRef.current);
    },
    []
  );

  /** Block's useEffect skips one apply — we already ran `applyBlockTypeToEditor` in `applySlashCommand`. */
  const slashTypeSyncedInEditorRef = useRef<string | null>(null);
  const slashCommandDedupeRef = useRef<{
    at: number;
    blockId: string;
    type: SlashMenuChoice | "";
  }>({ at: 0, blockId: "", type: "" });

  const updateBlockType = useCallback(
    (id: string, type: BlockType["type"]) => {
      replaceBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, type } : b)));
      closeSlashMenu();
    },
    [closeSlashMenu, replaceBlocks]
  );

  const applySlashCommand = useCallback(
    (type: SlashMenuChoice, slashBlockId?: string) => {
      const blockId =
        slashBlockId ?? menuBlockIdRef.current ?? slashAnchorBlockIdRef.current;
      if (!blockId) return;

      const now = performance.now();
      const ded = slashCommandDedupeRef.current;
      if (
        ded.type === type &&
        ded.blockId === blockId &&
        now - ded.at < 200
      ) {
        return;
      }
      slashCommandDedupeRef.current = { at: now, blockId, type };

      const removeSlash = () => {
        const editor = pageEditorRef.current;
        if (!editor || editor.isDestroyed) return;
        /** Slash menu click blurs the editor — selection-based delete targets the wrong block. */
        const del = findSlashMenuFilterDeleteRange(editor.state.doc, blockId);
        if (del) {
          editor
            .chain()
            .focus()
            .deleteRange({ from: del.from, to: del.to })
            .setTextSelection(del.from)
            .run();
          return;
        }
        editor
          .chain()
          .focus()
          .command(({ tr, state }) => {
            const { $from } = state.selection;
            const textBefore = textBeforeCursorInBlock($from);
            const m = textBefore.match(/\/[^ \n]*$/);
            if (!m) return false;
            tr.delete($from.pos - m[0].length, $from.pos);
            return true;
          })
          .run();
      };

      if (type === "emoji") {
        removeSlash();
        closeSlashMenu();
        requestAnimationFrame(() => {
          const e = pageEditorRef.current;
          if (e && !e.isDestroyed) {
            e.chain().focus().insertContent(":").run();
          }
          setFocusedBlockId(blockId);
        });
        return;
      }

      if (type === "databaseEmbed") {
        const pos = menuPosition ?? { top: 120, left: 24 };
        removeSlash();
        closeSlashMenu();
        setDatabasePickerBlockId(blockId);
        setDatabasePickerPosition(pos);
        setDatabasePickerSelectedIndex(0);
        setShowDatabasePicker(true);
        requestAnimationFrame(() => {
          setFocusedBlockId(blockId);
          pageEditorRef.current?.commands.focus();
        });
        return;
      }

      postSlashWaveRef.current = {
        slashAt: performance.now(),
        anchorBlockId: blockId,
        lastInsertedChildId: null,
        lastInsertAt: 0,
      };
      slashMutatingBlockIdRef.current = blockId;
      const focusBlockIdAfterSlash = blockId;
      const ed = pageEditorRef.current;
      try {
        removeSlash();
        if (ed && !ed.isDestroyed) {
          ed.setEditable(false);
        }
        if (ed && !ed.isDestroyed) {
          applyBlockTypeToEditor(ed, type);
          slashTypeSyncedInEditorRef.current = blockId;
        }
        flushSync(() => {
          updateBlockType(blockId, type);
        });
        if (type === "horizontalRule") {
          const insertedAt = performance.now();
          const w = postSlashWaveRef.current;
          if (w) {
            postSlashWaveRef.current = {
              slashAt: w.slashAt,
              anchorBlockId: w.anchorBlockId,
              lastInsertedChildId: null,
              lastInsertAt: insertedAt,
            };
          }
        }
      } finally {
        window.clearTimeout(slashEditableRestoreTimerRef.current);
        slashEditableRestoreTimerRef.current = window.setTimeout(() => {
          slashEditableRestoreTimerRef.current = 0;
          const focusEditorId = focusBlockIdAfterSlash;
          const pe = pageEditorRef.current;
          if (pe && !pe.isDestroyed) {
            pe.setEditable(true);
            pe.commands.focus();
          }
          setFocusedBlockId(focusEditorId);
        }, 48);
        window.clearTimeout(slashMutatingClearTimerRef.current);
        slashMutatingClearTimerRef.current = window.setTimeout(() => {
          if (slashMutatingBlockIdRef.current === blockId) {
            slashMutatingBlockIdRef.current = null;
          }
        }, 500);
      }
    },
    [menuPosition, updateBlockType, closeSlashMenu]
  );

  const applyDatabasePickerSelect = useCallback(
    (db: WorkspaceDatabase) => {
      if (!databasePickerBlockId) return;
      const blockId = databasePickerBlockId;
      const viewId = db.views[0]?.id ?? null;
      const content = stringifyDatabaseEmbedPayload(db.id, viewId);
      let nextBlocks: BlockType[] = [];
      replaceBlocks((prev) => {
        nextBlocks = prev.map((b) =>
          b.id === blockId ? { ...b, type: "databaseEmbed", content } : b
        );
        return nextBlocks;
      });
      closeDatabasePicker();
      requestAnimationFrame(() => {
        pageEditorRef.current?.commands.setContent(blocksToDocHtml(nextBlocks), {
          emitUpdate: false,
        });
        setFocusedBlockId(blockId);
      });
    },
    [databasePickerBlockId, replaceBlocks, closeDatabasePicker]
  );

  const applyPagePickerSelect = useCallback(
    (page: Page, forcedBlockId?: string) => {
      const blockId = forcedBlockId ?? pagePickerBlockId;
      if (!blockId) return;
      const ed = pageEditorRef.current;
      if (ed && !ed.isDestroyed) {
        ed.chain()
          .focus()
          .command(({ tr, state }) => {
            const { $from } = state.selection;
            const textBefore = textBeforeCursorInBlock($from);
            const m = textBefore.match(/@([^ \n]*)$/);
            if (!m) return false;
            const delFrom = $from.pos - m[0].length;
            const markType = state.schema.marks.wikiLink;
            if (!markType) return false;
            const textNode = state.schema.text(page.title, [
              markType.create({ pageId: page.id }),
            ]);
            tr.replaceWith(delFrom, $from.pos, textNode);
            return true;
          })
          .run();
      }
      closePagePickerMenu();
      requestAnimationFrame(() => {
        setFocusedBlockId(blockId);
        pageEditorRef.current?.commands.focus();
      });
    },
    [pagePickerBlockId, closePagePickerMenu]
  );

  useLayoutEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ed = pageEditorRef.current;
      if (!ed || ed.isDestroyed) return;
      // React menu state is updated in rAF after `/` — use doc + selection as source of truth
      // so Arrow/Enter run before ProseMirror moves the caret to another block.
      if (!isSlashMenuOpen(ed)) return;

      const textBefore = textBeforeCursorInBlock(ed.state.selection.$from);
      const slashM = textBefore.match(/\/[^ \n]*$/);
      const query = slashM ? slashM[0].slice(1) : "";
      const items = filterSlashMenuItems(SLASH_MENU_ITEMS, query);
      const n = items.length;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (n === 0) return;
        setSelectedIndex((prev) => {
          const cur = Math.min(prev, n - 1);
          return (cur + 1) % n;
        });
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (n === 0) return;
        setSelectedIndex((prev) => {
          const cur = Math.min(prev, n - 1);
          return cur === 0 ? n - 1 : cur - 1;
        });
      }

      if (e.key === "Enter") {
        if (e.repeat) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (n === 0) return;
        const idx = Math.min(slashSelectedIndexRef.current, n - 1);
        applySlashCommand(items[idx]!.type);
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        closeSlashMenu();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [applySlashCommand, closeSlashMenu]);

  const safePagePickerIndex =
    pickerPages.length === 0
      ? 0
      : Math.min(pagePickerSelectedIndex, pickerPages.length - 1);

  const safeDatabasePickerIndex =
    databases.length === 0
      ? 0
      : Math.min(databasePickerSelectedIndex, databases.length - 1);

  useEffect(() => {
    if (otherPageCount === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const ed = pageEditorRef.current;
      if (!ed || ed.isDestroyed) return;
      // Same rAF lag as slash: listener must not wait for `showPagePicker`.
      if (!isPagePickerOpen(ed)) return;

      const textBefore = textBeforeCursorInBlock(ed.state.selection.$from);
      const atM = textBefore.match(/@([^ \n]*)$/);
      const pageQuery = atM ? atM[1] ?? "" : "";
      const livePickerPages = filterPagesForPicker(pages, {
        query: pageQuery,
        excludePageId: pageId,
      });
      const n = livePickerPages.length;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (n === 0) return;
        setPagePickerSelectedIndex((prev) => {
          const cur = Math.min(prev, n - 1);
          return (cur + 1) % n;
        });
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (n === 0) return;
        setPagePickerSelectedIndex((prev) => {
          const cur = Math.min(prev, n - 1);
          return cur === 0 ? n - 1 : cur - 1;
        });
      }

      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const idx =
          n === 0 ? 0 : Math.min(pagePickerSelectedIndex, n - 1);
        const pick = livePickerPages[idx];
        if (pick) applyPagePickerSelect(pick);
        else closePagePickerMenu();
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        closePagePickerMenu();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    otherPageCount,
    pagePickerSelectedIndex,
    pages,
    pageId,
    applyPagePickerSelect,
    closePagePickerMenu,
  ]);

  useEffect(() => {
    if (databases.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showDatabasePickerRef.current) return;

      const n = databases.length;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (n === 0) return;
        setDatabasePickerSelectedIndex((prev) => {
          const cur = Math.min(prev, n - 1);
          return (cur + 1) % n;
        });
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (n === 0) return;
        setDatabasePickerSelectedIndex((prev) => {
          const cur = Math.min(prev, n - 1);
          return cur === 0 ? n - 1 : cur - 1;
        });
      }

      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const idx = n === 0 ? 0 : Math.min(databasePickerSelectedIndex, n - 1);
        const pick = databases[idx];
        if (pick) applyDatabasePickerSelect(pick);
        else closeDatabasePicker();
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        closeDatabasePicker();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    databasePickerSelectedIndex,
    databases,
    applyDatabasePickerSelect,
    closeDatabasePicker,
  ]);

  useEffect(() => {
    if (!showMenu && !showPagePicker && !showDatabasePicker) return;

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      // `ref.contains` can be false on the first frame the menu exists; `closest` is reliable in capture phase.
      if (
        slashMenuRef.current?.contains(t) ||
        t.closest("[data-musing-slash-menu]")
      ) {
        return;
      }
      if (
        pagePickerRef.current?.contains(t) ||
        t.closest("[data-musing-page-picker-menu]")
      ) {
        return;
      }
      if (
        databasePickerRef.current?.contains(t) ||
        t.closest("[data-musing-database-picker-menu]")
      ) {
        return;
      }
      closeSlashMenu();
      closePagePickerMenu();
      closeDatabasePicker();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [
    showMenu,
    showPagePicker,
    showDatabasePicker,
    closeSlashMenu,
    closePagePickerMenu,
    closeDatabasePicker,
  ]);

  return (
    <div className="editor-root editor-root--single-doc">
      <PageDocumentEditor
        pageId={pageId}
        blocks={localBlocks}
        externalWorkspaceRevision={externalWorkspaceRevision}
        onBlocksChange={(next) => replaceBlocks(() => next)}
        registerEditor={registerPageEditor}
        onEditorActivity={handlePageEditorActivity}
        onEditorKeyDown={handlePageDocumentKeyDown}
      />

      {showMenu && menuBlockId && menuPosition && (
        <div ref={slashMenuRef}>
          <SlashMenu
            position={menuPosition}
            onSelect={applySlashCommand}
            selectedIndex={safeSlashIndex}
            items={filteredSlashItems}
          />
        </div>
      )}

      {showPagePicker && pagePickerBlockId && pagePickerPosition && (
        <div ref={pagePickerRef}>
          <PagePickerMenu
            position={pagePickerPosition}
            pages={pickerPages}
            selectedIndex={safePagePickerIndex}
            onSelect={applyPagePickerSelect}
          />
        </div>
      )}

      {showDatabasePicker && databasePickerBlockId && databasePickerPosition && (
        <div ref={databasePickerRef}>
          <DatabasePickerMenu
            position={databasePickerPosition}
            databases={databases}
            selectedIndex={safeDatabasePickerIndex}
            onSelect={applyDatabasePickerSelect}
          />
        </div>
      )}
    </div>
  );
}
