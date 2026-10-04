import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { useFloatingMenu } from "../hooks/useFloatingMenu";
import { textBeforeCursorInBlock, viewCoordsForFloatingMenu } from "../lib/editorBlockText";
import { applyBlockTypeToEditor, isBlockHtmlVisuallyEmpty } from "../lib/blockEditorCommands";
import { blockIdAtSelection } from "../lib/pageDocument/blockIdAtSelection";
import { blocksToDocHtml } from "../lib/pageDocument/blocksToDocHtml";
import { findSlashMenuFilterDeleteRange } from "../lib/pageDocument/slashMenuDeleteRange";
import {
  isPagePickerOpen,
  isSlashMenuOpen,
  matchPageToken,
  matchSlashToken,
  removePagePickerToken,
  removeSlashCommandToken,
} from "../lib/tiptapMenuOpen";
import { tryDeleteEmptyTopLevelBlock } from "../lib/pageDocument/tryDeleteEmptyTopLevelBlock";

/** If two consecutive empty paragraphs sit under the slash row, drop the second (stray Enter / double insert). */
function trimDuplicateEmptyParagraphBelowSlashAnchor(
  blocks: BlockType[],
  wave: { slashAt: number; anchorBlockId: string } | null,
  now: number,
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
  /**
   * What `PageDocumentEditor` sees as the external revision. It is bumped in the same state batch
   * as `localBlocks`, so the document re-seeds when it holds the new blocks. Passing the
   * `externalWorkspaceRevision` prop straight through makes it re-seed one render earlier, from
   * the old blocks, and it never runs again.
   */
  const [documentRevision, setDocumentRevision] = useState(externalWorkspaceRevision);
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
  /** Re-enable `setEditable(true)` after a slash apply — must clear on unmount. */
  const slashEditableRestoreTimerRef = useRef(0);
  const postSlashWaveRef = useRef<{
    slashAt: number;
    anchorBlockId: string;
  } | null>(null);
  const showDatabasePickerRef = useRef(false);

  const [showDatabasePicker, setShowDatabasePicker] = useState(false);
  const [databasePickerBlockId, setDatabasePickerBlockId] = useState<string | null>(null);
  const [databasePickerPosition, setDatabasePickerPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [databasePickerSelectedIndex, setDatabasePickerSelectedIndex] = useState(0);

  const slashMenuQueryRef = useRef("");

  useLayoutEffect(() => {
    showMenuRef.current = showMenu;
    menuBlockIdRef.current = menuBlockId;
    slashSelectedIndexRef.current = selectedIndex;
    slashMenuQueryRef.current = slashMenuQuery;
    showDatabasePickerRef.current = showDatabasePicker;
  }, [showMenu, menuBlockId, selectedIndex, slashMenuQuery, showDatabasePicker]);

  const otherPageCount = useMemo(
    () => pages.filter((p) => p.id !== pageId).length,
    [pages, pageId],
  );

  const filteredSlashItems = useMemo(
    () => filterSlashMenuItems(SLASH_MENU_ITEMS, slashMenuQuery),
    [slashMenuQuery],
  );

  const safeSlashIndex =
    filteredSlashItems.length === 0 ? 0 : Math.min(selectedIndex, filteredSlashItems.length - 1);

  useEffect(() => {
    if (!showMenu) return;
    setSelectedIndex(0);
  }, [slashMenuQuery, showMenu]);

  const getPickerPages = useCallback(
    (query: string) => filterPagesForPicker(pages, { query, excludePageId: pageId }),
    [pages, pageId],
  );

  const blocksRef = useRef(blocks);
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
    setDocumentRevision(externalWorkspaceRevision);
  }, [externalWorkspaceRevision]);

  const pageEditorRef = useRef<TiptapEditor | null>(null);
  const slashMenuActivityRafRef = useRef(0);
  const slashMenuRef = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      window.clearTimeout(slashEditableRestoreTimerRef.current);
    },
    [],
  );

  const databasePickerRef = useRef<HTMLDivElement>(null);

  const replaceBlocks = useCallback((updater: (prev: BlockType[]) => BlockType[]) => {
    setLocalBlocks((prev) => {
      let next = updater(prev);
      if (next === prev) return prev;
      const wave = postSlashWaveRef.current;
      if (wave) {
        next = trimDuplicateEmptyParagraphBelowSlashAnchor(next, wave, performance.now());
      }
      if (next !== prev) {
        shouldPersistToWorkspaceRef.current = true;
      }
      return next;
    });
  }, []);

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

  const applyPagePickerSelect = useCallback((page: Page, ctx: { close: () => void }) => {
    const ed = pageEditorRef.current;
    if (ed && !ed.isDestroyed) {
      ed.chain()
        .focus()
        .command(({ tr, state }) => {
          const { $from } = state.selection;
          const textBefore = textBeforeCursorInBlock($from);
          const token = matchPageToken(textBefore);
          if (!token) return false;
          const delFrom = $from.pos - token.length;
          const markType = state.schema.marks.wikiLink;
          if (!markType) return false;
          const textNode = state.schema.text(page.title, [markType.create({ pageId: page.id })]);
          tr.replaceWith(delFrom, $from.pos, textNode);
          return true;
        })
        .run();
    }
    ctx.close();
    requestAnimationFrame(() => {
      pageEditorRef.current?.commands.focus();
    });
  }, []);

  const {
    isOpen: showPagePicker,
    isOpenRef: showPagePickerRef,
    blockId: pagePickerBlockId,
    position: pagePickerPosition,
    items: pickerPages,
    selectedIndex: safePagePickerIndex,
    menuRef: pagePickerRef,
    handleEditorActivity: queuePagePickerFromEditor,
    select: selectPagePickerItem,
    close: closePagePickerMenu,
  } = useFloatingMenu<Page>({
    editorRef: pageEditorRef,
    matchToken: matchPageToken,
    enabled: otherPageCount > 0,
    getItems: getPickerPages,
    onSelect: applyPagePickerSelect,
    onBeforeOpen: closeSlashMenu,
    removeTokenOnClose: removePagePickerToken,
  });

  const closeDatabasePicker = useCallback(() => {
    setShowDatabasePicker(false);
    setDatabasePickerBlockId(null);
    setDatabasePickerPosition(null);
    setDatabasePickerSelectedIndex(0);
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
          blockIdAtSelection(ed) ?? menuBlockIdRef.current ?? slashAnchorBlockIdRef.current;
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
        const token = matchSlashToken(textBefore);
        if (!token) {
          if (ed.view.composing) return;
          closeSlashForThisRow();
          return;
        }

        const slashPos = from - token.length;
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
        setSlashMenuQuery(token.query);
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
    ],
  );

  const handlePageEditorActivity = useCallback(
    (ed: TiptapEditor) => {
      queueSlashMenuFromEditor(ed);
      queuePagePickerFromEditor(ed);
    },
    [queueSlashMenuFromEditor, queuePagePickerFromEditor],
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
      if (otherPageCount > 0 && !isPagePickerOpen(ed) && showPagePickerRef.current) {
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
    [closeSlashMenu, closePagePickerMenu, otherPageCount, showPagePickerRef],
  );

  useEffect(
    () => () => {
      cancelAnimationFrame(slashMenuActivityRafRef.current);
    },
    [],
  );

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
    [closeSlashMenu, replaceBlocks],
  );

  const applySlashCommand = useCallback(
    (type: SlashMenuChoice, slashBlockId?: string) => {
      const blockId = slashBlockId ?? menuBlockIdRef.current ?? slashAnchorBlockIdRef.current;
      if (!blockId) return;

      const now = performance.now();
      const ded = slashCommandDedupeRef.current;
      if (ded.type === type && ded.blockId === blockId && now - ded.at < 200) {
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
            const token = matchSlashToken(textBefore);
            if (!token) return false;
            tr.delete($from.pos - token.length, $from.pos);
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
          pageEditorRef.current?.commands.focus();
        });
        return;
      }

      postSlashWaveRef.current = {
        slashAt: performance.now(),
        anchorBlockId: blockId,
      };
      const ed = pageEditorRef.current;
      try {
        removeSlash();
        if (ed && !ed.isDestroyed) {
          ed.setEditable(false);
        }
        if (ed && !ed.isDestroyed) {
          applyBlockTypeToEditor(ed, type);
        }
        flushSync(() => {
          updateBlockType(blockId, type);
        });
      } finally {
        window.clearTimeout(slashEditableRestoreTimerRef.current);
        slashEditableRestoreTimerRef.current = window.setTimeout(() => {
          slashEditableRestoreTimerRef.current = 0;
          const pe = pageEditorRef.current;
          if (pe && !pe.isDestroyed) {
            pe.setEditable(true);
            pe.commands.focus();
          }
        }, 48);
      }
    },
    [menuPosition, updateBlockType, closeSlashMenu],
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
          b.id === blockId ? { ...b, type: "databaseEmbed", content } : b,
        );
        return nextBlocks;
      });
      closeDatabasePicker();
      requestAnimationFrame(() => {
        pageEditorRef.current?.commands.setContent(blocksToDocHtml(nextBlocks), {
          emitUpdate: false,
        });
      });
    },
    [databasePickerBlockId, replaceBlocks, closeDatabasePicker],
  );

  useLayoutEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ed = pageEditorRef.current;
      if (!ed || ed.isDestroyed) return;
      // React menu state is updated in rAF after `/` — use doc + selection as source of truth
      // so Arrow/Enter run before ProseMirror moves the caret to another block.
      if (!isSlashMenuOpen(ed)) return;

      const textBefore = textBeforeCursorInBlock(ed.state.selection.$from);
      const query = matchSlashToken(textBefore)?.query ?? "";
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

  const safeDatabasePickerIndex =
    databases.length === 0 ? 0 : Math.min(databasePickerSelectedIndex, databases.length - 1);

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
  }, [databasePickerSelectedIndex, databases, applyDatabasePickerSelect, closeDatabasePicker]);

  useEffect(() => {
    if (!showMenu && !showPagePicker && !showDatabasePicker) return;

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      // `ref.contains` can be false on the first frame the menu exists; `closest` is reliable in capture phase.
      if (slashMenuRef.current?.contains(t) || t.closest("[data-musing-slash-menu]")) {
        return;
      }
      if (pagePickerRef.current?.contains(t) || t.closest("[data-musing-page-picker-menu]")) {
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
    pagePickerRef,
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
        externalWorkspaceRevision={documentRevision}
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
            onSelect={selectPagePickerItem}
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
