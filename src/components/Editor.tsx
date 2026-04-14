import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { flushSync } from "react-dom";
import type { Editor as TiptapEditor } from "@tiptap/core";
import Block from "./Block";
import type {
  AddBlockAfterEnterOptions,
  Block as BlockType,
} from "../types/block";
import type { Page } from "../types/page";
import type { WorkspaceDatabase } from "../types/database";
import { v4 as uuidv4 } from "uuid";
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
import { textBeforeCursorInBlock } from "../lib/editorBlockText";
import { applyBlockTypeToEditor, isBlockHtmlVisuallyEmpty } from "../lib/blockEditorCommands";

const BLOCK_DND_MIME = "application/x-musing-block-id";

/** Code / lists need an explicit “click below” target to add a following row (no Enter-to-exit). */
function blockTypeUsesBelowClickInsert(type: BlockType["type"]): boolean {
  return (
    type === "codeBlock" ||
    type === "bulletList" ||
    type === "orderedList"
  );
}

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

type DropIndicator = { blockId: string; after: boolean };

/** When a page has only one block, backspace should still remove non-text blocks by resetting to an empty paragraph. */
function soleBlockAlreadyMinimal(block: BlockType): boolean {
  if (block.type !== "paragraph") return false;
  if (typeof document === "undefined") {
    const stripped = block.content
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/[\u200b-\u200d\ufeff\s]/g, "");
    return stripped.length === 0;
  }
  const host = document.createElement("div");
  host.innerHTML = block.content.trim() || "<p></p>";
  const text = (host.textContent ?? "")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .trim();
  return text.length === 0;
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
  /** Multi-select for batch delete (gutter: ⌘/Ctrl+click toggle, Shift+click range). */
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(() => new Set());
  const selectionAnchorIndexRef = useRef<number | null>(null);
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
  /** Coalesce duplicate `addBlockAfter(sameId)` in one synchronous turn (double keydown) into a single insert. */
  const pendingAddBlockQueueRef = useRef<
    Array<{ parentId: string; options?: AddBlockAfterEnterOptions }>
  >([]);
  const flushAddBlocksMicrotaskScheduledRef = useRef(false);
  /** Rapid duplicate `addBlockAfter(parentId)` (double Enter, dev Strict Mode replay, etc.). */
  const addBlockAfterDebounceRef = useRef<{ parentId: string; at: number } | null>(null);
  /**
   * After a non-embed / command: the first `addBlockAfter(slashBlock)` often chains into a second
   * `addBlockAfter(newParagraph)` (trusted Enter). Suppress that second insert without blocking Enter on the slash row.
   */
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

  useLayoutEffect(() => {
    showMenuRef.current = showMenu;
    menuBlockIdRef.current = menuBlockId;
    slashSelectedIndexRef.current = selectedIndex;
    slashMenuQueryRef.current = slashMenuQuery;
    showPagePickerRef.current = showPagePicker;
    showDatabasePickerRef.current = showDatabasePicker;
  }, [showMenu, menuBlockId, selectedIndex, slashMenuQuery, showPagePicker, showDatabasePicker]);

  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);

  /** Paragraphs created below a code block (⌘/Ctrl+Enter) hide the slash hint until they have text. */
  const [noSlashPlaceholderBlockIds, setNoSlashPlaceholderBlockIds] = useState(
    () => new Set<string>()
  );

  const clearNoSlashPlaceholderForBlock = useCallback((id: string) => {
    setNoSlashPlaceholderBlockIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    const valid = new Set(localBlocks.map((b) => b.id));
    setNoSlashPlaceholderBlockIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (valid.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [localBlocks]);

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
  const selectedBlockIdsRef = useRef(selectedBlockIds);
  selectedBlockIdsRef.current = selectedBlockIds;
  const focusedBlockIdRef = useRef(focusedBlockId);
  focusedBlockIdRef.current = focusedBlockId;
  /**
   * Native `draggable` + grip often never fires `click` (browser reserves the gesture for DnD).
   * We treat a short pointer press as “select this row” instead of relying on `click`.
   */
  const gutterPointerRef = useRef<{
    blockId: string;
    index: number;
    x: number;
    y: number;
  } | null>(null);
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
    setSelectedBlockIds(new Set());
  }, [externalWorkspaceRevision]);

  const editorByBlockId = useRef(new Map<string, TiptapEditor>());
  /** Suppress one stray "new row" from Enter/key-repeat before `block.type` and TipTap catch up after a / command. */
  const postSlashNewRowLockRef = useRef<{ until: number; blockId: string } | null>(null);
  const postSlashLockClearTimerRef = useRef(0);
  const slashMenuRef = useRef<HTMLDivElement>(null);

  const armPostSlashNewRowLock = useCallback((blockId: string) => {
    postSlashNewRowLockRef.current = {
      until: performance.now() + 750,
      blockId,
    };
    window.clearTimeout(postSlashLockClearTimerRef.current);
    postSlashLockClearTimerRef.current = window.setTimeout(() => {
      const L = postSlashNewRowLockRef.current;
      if (L?.blockId === blockId) postSlashNewRowLockRef.current = null;
    }, 800);
  }, []);

  const isPostSlashNewRowLocked = useCallback((blockId: string) => {
    const L = postSlashNewRowLockRef.current;
    return !!(L && L.blockId === blockId && performance.now() < L.until);
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(postSlashLockClearTimerRef.current);
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

  const registerEditor = useCallback((id: string, instance: TiptapEditor | null) => {
    if (instance) editorByBlockId.current.set(id, instance);
    else editorByBlockId.current.delete(id);
  }, []);

  /** Block's useEffect skips one apply — we already ran `applyBlockTypeToEditor` in `applySlashCommand`. */
  const slashTypeSyncedInEditorRef = useRef<string | null>(null);
  const slashCommandDedupeRef = useRef<{
    at: number;
    blockId: string;
    type: SlashMenuChoice | "";
  }>({ at: 0, blockId: "", type: "" });

  const updateBlockContent = (id: string, content: string) => {
    replaceBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, content } : b)));
  };

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

      armPostSlashNewRowLock(blockId);

      const ed = editorByBlockId.current.get(blockId);
      const removeSlash = () => {
        if (ed && !ed.isDestroyed) {
          ed.chain()
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
        }
      };

      if (type === "emoji") {
        removeSlash();
        closeSlashMenu();
        requestAnimationFrame(() => {
          const e = editorByBlockId.current.get(blockId);
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
          editorByBlockId.current.get(blockId)?.commands.focus();
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
      /** Row to focus after slash apply (new paragraph below a divider when `horizontalRule`). */
      let focusBlockIdAfterSlash = blockId;
      try {
        if (ed && !ed.isDestroyed) {
          ed.setEditable(false);
        }
        removeSlash();
        if (ed && !ed.isDestroyed) {
          applyBlockTypeToEditor(ed, type);
          slashTypeSyncedInEditorRef.current = blockId;
        }
        flushSync(() => {
          updateBlockType(blockId, type);
        });
        if (type === "horizontalRule") {
          const newId = uuidv4();
          flushSync(() => {
            replaceBlocks((prev) => {
              if (prev.some((b) => b.id === newId)) return prev;
              const index = prev.findIndex((b) => b.id === blockId);
              if (index === -1) return prev;
              const newBlock: BlockType = {
                id: newId,
                type: "paragraph",
                content: "<p></p>",
              };
              const copy = [...prev];
              copy.splice(index + 1, 0, newBlock);
              return copy;
            });
          });
          const insertedAt = performance.now();
          const w = postSlashWaveRef.current;
          if (w) {
            postSlashWaveRef.current = {
              slashAt: w.slashAt,
              anchorBlockId: w.anchorBlockId,
              lastInsertedChildId: newId,
              lastInsertAt: insertedAt,
            };
          }
          focusBlockIdAfterSlash = newId;
        }
      } finally {
        window.clearTimeout(slashEditableRestoreTimerRef.current);
        slashEditableRestoreTimerRef.current = window.setTimeout(() => {
          slashEditableRestoreTimerRef.current = 0;
          const focusEditorId = focusBlockIdAfterSlash;
          const hrOrSlashEd = editorByBlockId.current.get(blockId);
          if (hrOrSlashEd && !hrOrSlashEd.isDestroyed) {
            hrOrSlashEd.setEditable(true);
          }
          const e = editorByBlockId.current.get(focusEditorId);
          if (e && !e.isDestroyed) {
            e.setEditable(true);
            e.commands.focus();
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
    [
      menuPosition,
      updateBlockType,
      closeSlashMenu,
      armPostSlashNewRowLock,
      replaceBlocks,
    ]
  );

  /** Applies the highlighted slash item for `blockId` (used when Enter runs before React has opened the menu). */
  const confirmSlashCommandForBlock = useCallback(
    (blockId: string) => {
      const items = filterSlashMenuItems(
        SLASH_MENU_ITEMS,
        slashMenuQueryRef.current
      );
      if (items.length === 0) return;
      const cur = Math.min(
        slashSelectedIndexRef.current,
        items.length - 1
      );
      applySlashCommand(items[cur]!.type, blockId);
    },
    [applySlashCommand]
  );

  const applyDatabasePickerSelect = useCallback(
    (db: WorkspaceDatabase) => {
      if (!databasePickerBlockId) return;
      const blockId = databasePickerBlockId;
      const viewId = db.views[0]?.id ?? null;
      const content = stringifyDatabaseEmbedPayload(db.id, viewId);
      replaceBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId ? { ...b, type: "databaseEmbed", content } : b
        )
      );
      closeDatabasePicker();
      requestAnimationFrame(() => setFocusedBlockId(blockId));
    },
    [databasePickerBlockId, replaceBlocks, closeDatabasePicker]
  );

  const applyPagePickerSelect = useCallback(
    (page: Page, forcedBlockId?: string) => {
      const blockId = forcedBlockId ?? pagePickerBlockId;
      if (!blockId) return;
      const ed = editorByBlockId.current.get(blockId);
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
        editorByBlockId.current.get(blockId)?.commands.focus();
      });
    },
    [pagePickerBlockId, closePagePickerMenu]
  );

  const confirmPagePickerForBlock = useCallback(
    (blockId: string) => {
      const n = pickerPages.length;
      const idx = n === 0 ? 0 : Math.min(pagePickerSelectedIndex, n - 1);
      const pick = pickerPages[idx];
      if (pick) applyPagePickerSelect(pick, blockId);
      else closePagePickerMenu();
    },
    [
      pickerPages,
      pagePickerSelectedIndex,
      applyPagePickerSelect,
      closePagePickerMenu,
    ]
  );

  function executeAddBlockAfter(
    id: string,
    addOptions?: AddBlockAfterEnterOptions
  ) {
    if (slashMutatingBlockIdRef.current === id) {
      return;
    }
    const L = postSlashNewRowLockRef.current;
    // Swallow Enter(s) during the lock but do not clear it: clearing let the next
    // duplicate Enter (key repeat / double dispatch) insert an empty row.
    if (L && L.blockId === id && performance.now() < L.until) {
      return;
    }

    const now = performance.now();
    const wave = postSlashWaveRef.current;
    const slashWaveMaxMs = 900;
    if (
      wave &&
      now - wave.slashAt < slashWaveMaxMs &&
      wave.lastInsertedChildId !== null &&
      wave.lastInsertedChildId === id &&
      now - wave.lastInsertAt < 350
    ) {
      return;
    }
    const deb = addBlockAfterDebounceRef.current;
    const debMs =
      wave && now - wave.slashAt < slashWaveMaxMs ? 320 : 150;
    if (deb && deb.parentId === id && now - deb.at < debMs) {
      return;
    }
    addBlockAfterDebounceRef.current = { parentId: id, at: now };

    const snapshot = localBlocksRef.current;
    const parentIndex = snapshot.findIndex((b) => b.id === id);
    if (parentIndex === -1) {
      return;
    }

    const newId = uuidv4();
    if (snapshot.some((b) => b.id === newId)) {
      return;
    }

    const newBlock: BlockType = {
      id: newId,
      type: "paragraph",
      content: "<p></p>",
    };

    const insertedAt = performance.now();
    const w = postSlashWaveRef.current;
    if (w && insertedAt - w.slashAt < slashWaveMaxMs) {
      postSlashWaveRef.current = {
        slashAt: w.slashAt,
        anchorBlockId: w.anchorBlockId,
        lastInsertedChildId: newId,
        lastInsertAt: insertedAt,
      };
    }

    flushSync(() => {
      replaceBlocks((prev) => {
        if (prev.some((b) => b.id === newId)) return prev;
        const index = prev.findIndex((b) => b.id === id);
        if (index === -1) return prev;
        const copy = [...prev];
        copy.splice(index + 1, 0, newBlock);
        return copy;
      });
    });

    if (addOptions?.suppressSlashPlaceholder) {
      setNoSlashPlaceholderBlockIds((prev) => {
        if (prev.has(newId)) return prev;
        const next = new Set(prev);
        next.add(newId);
        return next;
      });
    }

    setFocusedBlockId(newId);
  }

  const addBlockAfter = (id: string, options?: AddBlockAfterEnterOptions) => {
    if (pendingAddBlockQueueRef.current.some((q) => q.parentId === id)) return;
    pendingAddBlockQueueRef.current.push({ parentId: id, options });
    if (!flushAddBlocksMicrotaskScheduledRef.current) {
      flushAddBlocksMicrotaskScheduledRef.current = true;
      queueMicrotask(() => {
        flushAddBlocksMicrotaskScheduledRef.current = false;
        const queue = pendingAddBlockQueueRef.current.splice(0);
        // One insert per macrotask: stray Enter often queues [heading, newEmpty] in the same turn;
        // running both inserts two rows. Legitimate double-row in one sync turn does not happen.
        if (queue.length > 0) {
          const first = queue[0]!;
          executeAddBlockAfter(first.parentId, first.options);
        }
      });
    }
  };

  const clearBlockSelection = useCallback(() => {
    setSelectedBlockIds(new Set());
  }, []);

  /** Remove window listeners if a left-strip drag is active (e.g. unmount mid-gesture). */
  const stripDragRemoveListenersRef = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      stripDragRemoveListenersRef.current?.();
      stripDragRemoveListenersRef.current = null;
    },
    []
  );

  /**
   * Each block is its own TipTap surface — native text selection cannot span rows.
   * Drag the narrow left strip (same column as + / ⋮⋮) to range-select blocks while scrolling.
   */
  const beginLeftStripBlockDragSelect = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, blockId: string, anchorIndex: number) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const pointerId = e.pointerId;
      const startX = e.clientX;
      const startY = e.clientY;
      let dragActive = false;
      let lastLo = anchorIndex;
      let lastHi = anchorIndex;
      let lastHitIndex = anchorIndex;

      const apply = (hitIndex: number) => {
        const blocks = localBlocksRef.current;
        if (hitIndex < 0 || hitIndex >= blocks.length) return;
        const lo = Math.min(anchorIndex, hitIndex);
        const hi = Math.max(anchorIndex, hitIndex);
        if (lo === lastLo && hi === lastHi) return;
        lastLo = lo;
        lastHi = hi;
        lastHitIndex = hitIndex;
        const next = new Set<string>();
        for (let i = lo; i <= hi; i++) {
          next.add(blocks[i]!.id);
        }
        setSelectedBlockIds(next);
      };

      apply(anchorIndex);

      const stripEl = e.currentTarget;

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!dragActive) {
          if (Math.hypot(dx, dy) < 6) return;
          dragActive = true;
        }
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const row = el?.closest?.("[data-musing-block-id]") as HTMLElement | null;
        const hitId = row?.getAttribute("data-musing-block-id");
        if (!hitId) return;
        const hitIndex = localBlocksRef.current.findIndex((b) => b.id === hitId);
        if (hitIndex === -1) return;
        apply(hitIndex);
      };

      const detachStripDragListeners = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", finish, true);
        window.removeEventListener("pointercancel", finish, true);
      };

      const finish = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        stripDragRemoveListenersRef.current = null;
        detachStripDragListeners();
        try {
          if (stripEl.hasPointerCapture(pointerId)) {
            stripEl.releasePointerCapture(pointerId);
          }
        } catch {
          /* */
        }
        const blocks = localBlocksRef.current;
        if (!dragActive) {
          setSelectedBlockIds(new Set([blockId]));
          selectionAnchorIndexRef.current = anchorIndex;
          setFocusedBlockId(blockId);
        } else {
          selectionAnchorIndexRef.current = lastHitIndex;
          const focusId = blocks[lastHitIndex]?.id ?? blockId;
          setFocusedBlockId(focusId);
        }
      };

      stripDragRemoveListenersRef.current = detachStripDragListeners;
      try {
        stripEl.setPointerCapture(pointerId);
      } catch {
        /* */
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", finish, true);
      window.addEventListener("pointercancel", finish, true);
    },
    []
  );

  const deleteSelectedBlocks = useCallback(() => {
    const removeSet = new Set(selectedBlockIdsRef.current);
    if (removeSet.size === 0) return;
    let focusAfter: string | null = null;
    flushSync(() => {
      replaceBlocks((prev) => {
        if (!prev.some((b) => removeSet.has(b.id))) return prev;
        const deletedIndices: number[] = [];
        prev.forEach((b, i) => {
          if (removeSet.has(b.id)) deletedIndices.push(i);
        });
        const minI = Math.min(...deletedIndices);
        const newBlocks = prev.filter((b) => !removeSet.has(b.id));
        if (newBlocks.length === 0) {
          const sole: BlockType = {
            id: uuidv4(),
            type: "paragraph",
            content: "<p></p>",
          };
          focusAfter = sole.id;
          return [sole];
        }
        const anchorAbove = minI > 0 ? prev[minI - 1]!.id : null;
        focusAfter =
          anchorAbove && newBlocks.some((b) => b.id === anchorAbove)
            ? anchorAbove
            : newBlocks[0]!.id;
        return newBlocks;
      });
    });
    setSelectedBlockIds(new Set());
    selectionAnchorIndexRef.current = null;
    if (focusAfter !== null) {
      setFocusedBlockId(focusAfter);
      const ed = editorByBlockId.current.get(focusAfter);
      if (ed && !ed.isDestroyed) {
        ed.chain().focus("end", { scrollIntoView: false }).run();
        ed.view.dom.focus({ preventScroll: true });
      }
    }
  }, [replaceBlocks]);

  const deleteSelectedBlocksRef = useRef(deleteSelectedBlocks);
  deleteSelectedBlocksRef.current = deleteSelectedBlocks;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      if (selectedBlockIdsRef.current.size === 0) return;
      const inProse = document.activeElement?.closest?.(".ProseMirror");
      if (inProse && selectedBlockIdsRef.current.size < 2) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      deleteSelectedBlocksRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const readPointerModifiers = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    const n = e.nativeEvent;
    if (typeof n.getModifierState === "function") {
      return {
        shift: n.getModifierState("Shift"),
        meta: n.getModifierState("Meta"),
        ctrl: n.getModifierState("Control"),
      };
    }
    return { shift: e.shiftKey, meta: e.metaKey, ctrl: e.ctrlKey };
  }, []);

  const handleGutterGripClick = useCallback(
    (blockId: string, index: number, e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const blocks = localBlocksRef.current;
      const { shift, meta, ctrl } = readPointerModifiers(e);
      if (shift) {
        let anchorIdx = selectionAnchorIndexRef.current;
        if (anchorIdx === null || anchorIdx < 0) {
          const fi = blocks.findIndex((b) => b.id === focusedBlockIdRef.current);
          anchorIdx = fi >= 0 ? fi : index;
        }
        const lo = Math.min(anchorIdx, index);
        const hi = Math.max(anchorIdx, index);
        const next = new Set<string>();
        for (let i = lo; i <= hi; i++) {
          const blk = blocks[i];
          if (blk) next.add(blk.id);
        }
        setSelectedBlockIds(next);
        selectionAnchorIndexRef.current = index;
        setFocusedBlockId(blockId);
        return;
      }
      if (meta || ctrl) {
        setSelectedBlockIds((prev) => {
          const n = new Set(prev);
          if (n.has(blockId)) n.delete(blockId);
          else n.add(blockId);
          return n;
        });
        selectionAnchorIndexRef.current = index;
        setFocusedBlockId(blockId);
        return;
      }
      setSelectedBlockIds(new Set([blockId]));
      selectionAnchorIndexRef.current = index;
      setFocusedBlockId(blockId);
    },
    [readPointerModifiers]
  );

  const deleteBlock = (id: string) => {
    setSelectedBlockIds((prev) => {
      if (!prev.has(id)) return prev;
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    let focusAfterDelete: string | null = null;
    /** Apply removal before focusing the previous row so `editorByBlockId` matches mounted views. */
    flushSync(() => {
      replaceBlocks((prev) => {
        const index = prev.findIndex((b) => b.id === id);
        if (index === -1) return prev;

        if (prev.length === 1) {
          const only = prev[0];
          if (only.id !== id) return prev;
          if (soleBlockAlreadyMinimal(only)) return prev;
          return [{ ...only, type: "paragraph", content: "<p></p>" }];
        }

        const newBlocks = prev.filter((b) => b.id !== id);
        const prevBlock = newBlocks[index - 1] || newBlocks[0];
        focusAfterDelete = prevBlock.id;

        return newBlocks;
      });
    });
    if (focusAfterDelete !== null) {
      setFocusedBlockId(focusAfterDelete);
      /**
       * TipTap’s `focus` command defers `view.focus()` to `requestAnimationFrame`, so the next
       * Backspace (key repeat) often fires while focus is still on the removed row / `<body>`.
       * Move selection to the end of the surviving block and focus the contenteditable synchronously.
       */
      const ed = editorByBlockId.current.get(focusAfterDelete);
      if (ed && !ed.isDestroyed) {
        ed.chain().focus("end", { scrollIntoView: false }).run();
        ed.view.dom.focus({ preventScroll: true });
      }
    }
  };

  const reorderAfterDrop = useCallback(
    (fromId: string, toId: string, placeAfter: boolean) => {
      replaceBlocks((prev) => {
        const fromIdx = prev.findIndex((b) => b.id === fromId);
        const toIdx = prev.findIndex((b) => b.id === toId);
        if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
        const copy = [...prev];
        const [item] = copy.splice(fromIdx, 1);
        let insertIdx = toIdx;
        if (fromIdx < toIdx) insertIdx--;
        if (placeAfter) insertIdx++;
        copy.splice(insertIdx, 0, item);
        return copy;
      });
    },
    [replaceBlocks]
  );

  const moveBlockDelta = useCallback(
    (id: string, delta: -1 | 1) => {
      replaceBlocks((prev) => {
        const i = prev.findIndex((b) => b.id === id);
        const j = i + delta;
        if (i === -1 || j < 0 || j >= prev.length) return prev;
        const copy = [...prev];
        const [item] = copy.splice(i, 1);
        copy.splice(j, 0, item);
        return copy;
      });
    },
    [replaceBlocks]
  );

  useLayoutEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showMenuRef.current) return;

      const items = filterSlashMenuItems(
        SLASH_MENU_ITEMS,
        slashMenuQueryRef.current
      );
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
    if (!showPagePicker) return;

    const n = pickerPages.length;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        if (n === 0) return;
        setPagePickerSelectedIndex((prev) => {
          const cur = Math.min(prev, n - 1);
          return (cur + 1) % n;
        });
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        if (n === 0) return;
        setPagePickerSelectedIndex((prev) => {
          const cur = Math.min(prev, n - 1);
          return cur === 0 ? n - 1 : cur - 1;
        });
      }

      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const idx =
          n === 0 ? 0 : Math.min(pagePickerSelectedIndex, n - 1);
        const pick = pickerPages[idx];
        if (pick) applyPagePickerSelect(pick);
        else closePagePickerMenu();
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closePagePickerMenu();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    showPagePicker,
    pagePickerSelectedIndex,
    pickerPages,
    applyPagePickerSelect,
    closePagePickerMenu,
  ]);

  useEffect(() => {
    if (!showDatabasePicker) return;

    const n = databases.length;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        if (n === 0) return;
        setDatabasePickerSelectedIndex((prev) => {
          const cur = Math.min(prev, n - 1);
          return (cur + 1) % n;
        });
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        if (n === 0) return;
        setDatabasePickerSelectedIndex((prev) => {
          const cur = Math.min(prev, n - 1);
          return cur === 0 ? n - 1 : cur - 1;
        });
      }

      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const idx = n === 0 ? 0 : Math.min(databasePickerSelectedIndex, n - 1);
        const pick = databases[idx];
        if (pick) applyDatabasePickerSelect(pick);
        else closeDatabasePicker();
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeDatabasePicker();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    showDatabasePicker,
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

  const canReorder = localBlocks.length > 1;

  return (
    <div className="editor-root">
      {localBlocks.map((block, index) => {
        const rowDropBefore =
          dropIndicator?.blockId === block.id && !dropIndicator.after;
        const rowDropAfter =
          dropIndicator?.blockId === block.id && dropIndicator.after;

        const showBelowClickInsert =
          blockTypeUsesBelowClickInsert(block.type) &&
          index === localBlocks.length - 1;

        return (
          <div
            key={`${pageId}:${block.id}`}
            data-musing-block-id={block.id}
            className={[
              "editor-block-row",
              rowDropBefore ? "editor-block-row--drop-before" : "",
              rowDropAfter ? "editor-block-row--drop-after" : "",
              selectedBlockIds.has(block.id) ? "editor-block-row--selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onDragOver={(e) => {
              if (!canReorder) return;
              const types = Array.from(e.dataTransfer.types);
              if (
                !types.includes(BLOCK_DND_MIME) &&
                !types.includes("text/plain")
              ) {
                return;
              }
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              const rect = e.currentTarget.getBoundingClientRect();
              const after = e.clientY > rect.top + rect.height / 2;
              setDropIndicator({ blockId: block.id, after });
            }}
            onDragLeave={(e) => {
              const related = e.relatedTarget as Node | null;
              if (related && e.currentTarget.contains(related)) return;
              setDropIndicator(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const fromId =
                e.dataTransfer.getData(BLOCK_DND_MIME) ||
                e.dataTransfer.getData("text/plain");
              if (!fromId || fromId === block.id) {
                setDropIndicator(null);
                return;
              }
              const rect = e.currentTarget.getBoundingClientRect();
              const placeAfter = e.clientY > rect.top + rect.height / 2;
              reorderAfterDrop(fromId, block.id, placeAfter);
              setDropIndicator(null);
            }}
          >
            <div className="editor-block-row-inner">
              <div className="editor-block-gutter">
                <div
                  className="editor-block-select-strip"
                  aria-label="Drag vertically to select multiple blocks"
                  title="Drag up or down to select a range of blocks. Text cannot span blocks — each row is its own editor."
                  onPointerDown={(ev) =>
                    beginLeftStripBlockDragSelect(ev, block.id, index)
                  }
                />
                <button
                  type="button"
                  className="editor-block-add-below"
                  aria-label="Add block below"
                  title="Add block below"
                  onPointerDown={(ev) => ev.stopPropagation()}
                  onClick={() => addBlockAfter(block.id)}
                >
                  <span className="editor-block-add-below-icon" aria-hidden>
                    +
                  </span>
                </button>
                <button
                  type="button"
                  className="editor-block-grip"
                  aria-label="Drag to reorder; ⌘ or Ctrl+click to multi-select, Shift+click for range"
                  title="Drag to reorder (Alt + ↑ / ↓). Left strip: drag to select a range. ⌘/Ctrl+click: toggle row. Shift+click: range from anchor."
                  draggable={canReorder}
                  aria-disabled={!canReorder}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.stopPropagation();
                    const m = readPointerModifiers(e);
                    if (m.meta || m.ctrl || m.shift) {
                      e.preventDefault();
                      gutterPointerRef.current = null;
                      handleGutterGripClick(block.id, index, e);
                      return;
                    }
                    gutterPointerRef.current = {
                      blockId: block.id,
                      index,
                      x: e.clientX,
                      y: e.clientY,
                    };
                    /** Without capture, `pointerup` may miss the button when `draggable` is true (release outside). */
                    try {
                      e.currentTarget.setPointerCapture(e.pointerId);
                    } catch {
                      /* invalid pointerId */
                    }
                  }}
                  onPointerUp={(e) => {
                    if (e.button !== 0) return;
                    e.stopPropagation();
                    const g = gutterPointerRef.current;
                    gutterPointerRef.current = null;
                    try {
                      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                        e.currentTarget.releasePointerCapture(e.pointerId);
                      }
                    } catch {
                      /* already released */
                    }
                    if (!g || g.blockId !== block.id) return;
                    if (Math.hypot(e.clientX - g.x, e.clientY - g.y) >= 10) return;
                    /** Use modifiers at *release* so ⌘ after mousedown still toggles into the selection. */
                    handleGutterGripClick(block.id, index, e);
                  }}
                  onPointerCancel={(e) => {
                    gutterPointerRef.current = null;
                    try {
                      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                        e.currentTarget.releasePointerCapture(e.pointerId);
                      }
                    } catch {
                      /* */
                    }
                  }}
                  onDragStart={(e) => {
                    gutterPointerRef.current = null;
                    e.dataTransfer.setData(BLOCK_DND_MIME, block.id);
                    e.dataTransfer.setData("text/plain", block.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    gutterPointerRef.current = null;
                    setDropIndicator(null);
                  }}
                >
                  <span className="editor-block-grip-icon" aria-hidden>
                    ⋮⋮
                  </span>
                </button>
              </div>
              <div
                className={[
                  "editor-block-body",
                  block.type === "horizontalRule"
                    ? "editor-block-body--hr"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Block
                pageId={pageId}
                block={block}
                externalWorkspaceRevision={externalWorkspaceRevision}
                menuBlockId={menuBlockId}
                pagePickerBlockId={pagePickerBlockId}
                onContentChange={updateBlockContent}
                onEnter={addBlockAfter}
                suppressSlashPlaceholder={noSlashPlaceholderBlockIds.has(
                  block.id
                )}
                onClearSlashPlaceholderSuppression={clearNoSlashPlaceholderForBlock}
                onConfirmSlashCommand={confirmSlashCommandForBlock}
                onConfirmPagePickerCommand={confirmPagePickerForBlock}
                onSlashMenuOpenChange={onSlashMenuOpenChange}
                isPostSlashNewRowLocked={isPostSlashNewRowLocked}
                slashTypeSyncedInEditorRef={slashTypeSyncedInEditorRef}
                pageBlockCount={localBlocks.length}
                onBackspace={deleteBlock}
                isFocused={focusedBlockId === block.id}
                registerEditor={registerEditor}
                setFocusedBlockId={setFocusedBlockId}
                setShowMenu={setShowMenu}
                setMenuBlockId={setMenuBlockId}
                setMenuPosition={setMenuPosition}
                setShowPagePicker={setShowPagePicker}
                setPagePickerBlockId={setPagePickerBlockId}
                setPagePickerPosition={setPagePickerPosition}
                setPagePickerQuery={setPagePickerQuery}
                setSlashMenuQuery={setSlashMenuQuery}
                closePagePickerMenu={closePagePickerMenu}
                closeSlashMenu={closeSlashMenu}
                otherPageCount={otherPageCount}
                canMoveUp={index > 0}
                canMoveDown={index < localBlocks.length - 1}
                onMoveBlockDelta={moveBlockDelta}
                onClearBlockSelection={clearBlockSelection}
              />
              </div>
            </div>
            {showBelowClickInsert ? (
              <button
                type="button"
                className="editor-block-below-hit"
                aria-label="Add block below"
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  const blocks = localBlocksRef.current;
                  const idx = blocks.findIndex((b) => b.id === block.id);
                  if (idx === -1 || idx < blocks.length - 1) return;
                  addBlockAfter(block.id);
                }}
              />
            ) : null}
          </div>
        );
      })}

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
