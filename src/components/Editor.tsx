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
  type SlashMenuItem,
} from "../lib/slashMenuOptions";
import { filterPagesForPicker } from "../lib/resolveWikiPage";
import { stringifyDatabaseEmbedPayload } from "../lib/databaseEmbed";
import { useWorkspace } from "../context/useWorkspace";
import { useFloatingMenu } from "../hooks/useFloatingMenu";
import { textBeforeCursorInBlock } from "../lib/editorBlockText";
import { applyBlockTypeToEditor, isBlockHtmlVisuallyEmpty } from "../lib/blockEditorCommands";
import { blocksToDocHtml } from "../lib/pageDocument/blocksToDocHtml";
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

const getSlashItems = (query: string) => filterSlashMenuItems(SLASH_MENU_ITEMS, query);

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
  /** Re-enable `setEditable(true)` after a slash apply — must clear on unmount. */
  const slashEditableRestoreTimerRef = useRef(0);
  const postSlashWaveRef = useRef<{
    slashAt: number;
    anchorBlockId: string;
  } | null>(null);

  const otherPageCount = useMemo(
    () => pages.filter((p) => p.id !== pageId).length,
    [pages, pageId],
  );

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

  useEffect(
    () => () => {
      window.clearTimeout(slashEditableRestoreTimerRef.current);
    },
    [],
  );

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

  /**
   * Late-bound, so the menus can close each other and the slash hook can call the slash command
   * handler before all of them are defined.
   */
  const closeSlashMenuRef = useRef<() => void>(() => {});
  const applySlashCommandRef = useRef<(type: SlashMenuChoice, blockId?: string) => void>(() => {});

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
    onBeforeOpen: () => closeSlashMenuRef.current(),
    removeTokenOnClose: removePagePickerToken,
    resetSelectionOnEveryActivity: true,
  });

  const applyDatabasePickerSelect = useCallback(
    (db: WorkspaceDatabase, ctx: { blockId: string; close: () => void }) => {
      const viewId = db.views[0]?.id ?? null;
      const content = stringifyDatabaseEmbedPayload(db.id, viewId);
      let nextBlocks: BlockType[] = [];
      replaceBlocks((prev) => {
        nextBlocks = prev.map((b) =>
          b.id === ctx.blockId ? { ...b, type: "databaseEmbed", content } : b,
        );
        return nextBlocks;
      });
      ctx.close();
      requestAnimationFrame(() => {
        pageEditorRef.current?.commands.setContent(blocksToDocHtml(nextBlocks), {
          emitUpdate: false,
        });
      });
    },
    [replaceBlocks],
  );

  const getDatabases = useCallback(() => databases, [databases]);

  const {
    isOpen: showDatabasePicker,
    blockId: databasePickerBlockId,
    position: databasePickerPosition,
    selectedIndex: safeDatabasePickerIndex,
    menuRef: databasePickerRef,
    open: openDatabasePicker,
    select: selectDatabasePickerItem,
    close: closeDatabasePicker,
  } = useFloatingMenu<WorkspaceDatabase>({
    editorRef: pageEditorRef,
    enabled: databases.length > 0,
    getItems: getDatabases,
    onSelect: applyDatabasePickerSelect,
  });

  const {
    isOpen: showMenu,
    isOpenRef: showMenuRef,
    blockIdRef: slashBlockIdRef,
    getToken: getSlashToken,
    position: menuPosition,
    items: filteredSlashItems,
    selectedIndex: safeSlashIndex,
    menuRef: slashMenuRef,
    handleEditorActivity: queueSlashMenuFromEditor,
    close: closeSlashMenu,
  } = useFloatingMenu<SlashMenuItem>({
    editorRef: pageEditorRef,
    matchToken: matchSlashToken,
    enabled: true,
    getItems: getSlashItems,
    onSelect: (item, ctx) => applySlashCommandRef.current(item.type, ctx.blockId),
    onBeforeOpen: closePagePickerMenu,
    removeTokenOnClose: removeSlashCommandToken,
    blockRepeatedEnter: true,
    onEmptyEnter: "ignore",
  });

  const registerPageEditor = useCallback((instance: TiptapEditor | null) => {
    pageEditorRef.current = instance;
  }, []);

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
    [closeSlashMenu, closePagePickerMenu, otherPageCount, showMenuRef, showPagePickerRef],
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
      const blockId = slashBlockId ?? slashBlockIdRef.current;
      if (!blockId) return;

      const now = performance.now();
      const ded = slashCommandDedupeRef.current;
      if (ded.type === type && ded.blockId === blockId && now - ded.at < 200) {
        return;
      }
      slashCommandDedupeRef.current = { at: now, blockId, type };

      const removeSlash = () => {
        const editor = pageEditorRef.current;
        const token = editor && !editor.isDestroyed ? getSlashToken(editor) : null;
        if (!editor || !token) return;
        // Clicking the menu blurs the editor, so don't rely on the selection: delete the token where
        // the menu last saw it, and only if that text is still there.
        const { doc } = editor.state;
        if (
          token.to > doc.content.size ||
          doc.textBetween(token.from, token.to) !== `/${token.query}`
        ) {
          return;
        }
        editor
          .chain()
          .focus()
          .deleteRange({ from: token.from, to: token.to })
          .setTextSelection(token.from)
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
        openDatabasePicker({ blockId, position: pos });
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
    [
      menuPosition,
      slashBlockIdRef,
      getSlashToken,
      updateBlockType,
      closeSlashMenu,
      openDatabasePicker,
    ],
  );

  useLayoutEffect(() => {
    applySlashCommandRef.current = applySlashCommand;
    closeSlashMenuRef.current = closeSlashMenu;
  });

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
    slashMenuRef,
    showPagePicker,
    pagePickerRef,
    showDatabasePicker,
    databasePickerRef,
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

      {menuPosition && (
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
            onSelect={selectDatabasePickerItem}
          />
        </div>
      )}
    </div>
  );
}
