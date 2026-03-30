import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import Block from "./Block";
import type { Block as BlockType } from "../types/block";
import type { Page } from "../types/page";
import { v4 as uuidv4 } from "uuid";
import SlashMenu from "./SlashMenu";
import PagePickerMenu from "./PagePickerMenu";
import { SLASH_MENU_ITEMS } from "../lib/slashMenuOptions";
import { filterPagesForPicker } from "../lib/resolveWikiPage";
import { useWorkspace } from "../context/useWorkspace";

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
  const { pages } = useWorkspace();

  const [localBlocks, setLocalBlocks] = useState<BlockType[]>(blocks);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(
    blocks[0]?.id ?? null
  );
  const [showMenu, setShowMenu] = useState(false);
  const [menuBlockId, setMenuBlockId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [showPagePicker, setShowPagePicker] = useState(false);
  const [pagePickerBlockId, setPagePickerBlockId] = useState<string | null>(null);
  const [pagePickerPosition, setPagePickerPosition] = useState<{ top: number; left: number } | null>(
    null
  );
  const [pagePickerQuery, setPagePickerQueryState] = useState("");
  const [pagePickerSelectedIndex, setPagePickerSelectedIndex] = useState(0);

  const otherPageCount = useMemo(
    () => pages.filter((p) => p.id !== pageId).length,
    [pages, pageId]
  );

  const pickerPages = useMemo(
    () =>
      filterPagesForPicker(pages, {
        query: pagePickerQuery,
        excludePageId: pageId,
      }),
    [pages, pagePickerQuery, pageId]
  );

  const blocksRef = useRef(blocks);
  const lastExternalRevisionRef = useRef(externalWorkspaceRevision);

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

  const editorByBlockId = useRef(new Map<string, TiptapEditor>());
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const pagePickerRef = useRef<HTMLDivElement>(null);

  const replaceBlocks = useCallback(
    (updater: (prev: BlockType[]) => BlockType[]) => {
      setLocalBlocks((prev) => {
        const next = updater(prev);
        if (next !== prev) onBlocksChange(next);
        return next;
      });
    },
    [onBlocksChange]
  );

  const closeSlashMenu = useCallback(() => {
    setShowMenu(false);
    setMenuBlockId(null);
    setMenuPosition(null);
    setSelectedIndex(0);
  }, []);

  const closePagePickerMenu = useCallback(() => {
    setShowPagePicker(false);
    setPagePickerBlockId(null);
    setPagePickerPosition(null);
    setPagePickerQueryState("");
    setPagePickerSelectedIndex(0);
  }, []);

  const setPagePickerQuery = useCallback((query: string) => {
    setPagePickerQueryState(query);
    setPagePickerSelectedIndex(0);
  }, []);

  const registerEditor = useCallback((id: string, instance: TiptapEditor | null) => {
    if (instance) editorByBlockId.current.set(id, instance);
    else editorByBlockId.current.delete(id);
  }, []);

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
    (type: BlockType["type"]) => {
      if (!menuBlockId) return;
      const blockId = menuBlockId;
      const ed = editorByBlockId.current.get(blockId);
      if (ed && !ed.isDestroyed) {
        ed.chain()
          .focus()
          .command(({ tr, state }) => {
            const { from, $from } = state.selection;
            const blockStart = $from.start();
            if (from <= blockStart) return false;
            const textBefore = state.doc.textBetween(blockStart, from);
            const m = textBefore.match(/\/[^ \n]*$/);
            if (!m) return false;
            tr.delete(from - m[0].length, from);
            return true;
          })
          .run();
      }
      updateBlockType(blockId, type);
      requestAnimationFrame(() => {
        setFocusedBlockId(blockId);
        editorByBlockId.current.get(blockId)?.commands.focus();
      });
    },
    [menuBlockId, updateBlockType]
  );

  const applyPagePickerSelect = useCallback(
    (page: Page) => {
      if (!pagePickerBlockId) return;
      const blockId = pagePickerBlockId;
      const ed = editorByBlockId.current.get(blockId);
      if (ed && !ed.isDestroyed) {
        ed.chain()
          .focus()
          .command(({ tr, state }) => {
            const { from, $from } = state.selection;
            const blockStart = $from.start();
            if (from <= blockStart) return false;
            const textBefore = state.doc.textBetween(blockStart, from);
            const m = textBefore.match(/@([^ \n]*)$/);
            if (!m) return false;
            const delFrom = from - m[0].length;
            const markType = state.schema.marks.wikiLink;
            if (!markType) return false;
            const textNode = state.schema.text(page.title, [
              markType.create({ pageId: page.id }),
            ]);
            tr.replaceWith(delFrom, from, textNode);
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

  const addBlockAfter = (id: string) => {
    const newBlock: BlockType = {
      id: uuidv4(),
      type: "paragraph",
      content: "<p></p>",
    };

    replaceBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === id);
      const copy = [...prev];
      copy.splice(index + 1, 0, newBlock);
      return copy;
    });

    setFocusedBlockId(newBlock.id);
  };

  const deleteBlock = (id: string) => {
    replaceBlocks((prev) => {
      if (prev.length === 1) return prev;

      const index = prev.findIndex((b) => b.id === id);
      const newBlocks = prev.filter((b) => b.id !== id);

      const prevBlock = newBlocks[index - 1] || newBlocks[0];
      setFocusedBlockId(prevBlock.id);

      return newBlocks;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showMenu) return;

      const n = SLASH_MENU_ITEMS.length;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev + 1) % n);
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev === 0 ? n - 1 : prev - 1));
      }

      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        applySlashCommand(SLASH_MENU_ITEMS[selectedIndex].type);
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeSlashMenu();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [showMenu, selectedIndex, menuBlockId, applySlashCommand, closeSlashMenu]);

  const safePagePickerIndex =
    pickerPages.length === 0
      ? 0
      : Math.min(pagePickerSelectedIndex, pickerPages.length - 1);

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
    if (!showMenu && !showPagePicker) return;

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (slashMenuRef.current?.contains(t)) return;
      if (pagePickerRef.current?.contains(t)) return;
      closeSlashMenu();
      closePagePickerMenu();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [showMenu, showPagePicker, closeSlashMenu, closePagePickerMenu]);

  return (
    <div className="editor-root">
      {localBlocks.map((block) => (
        <Block
          key={`${pageId}:${block.id}`}
          pageId={pageId}
          block={block}
          menuBlockId={menuBlockId}
          pagePickerBlockId={pagePickerBlockId}
          onContentChange={updateBlockContent}
          onEnter={addBlockAfter}
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
          closePagePickerMenu={closePagePickerMenu}
          closeSlashMenu={closeSlashMenu}
          otherPageCount={otherPageCount}
        />
      ))}

      {showMenu && menuBlockId && menuPosition && (
        <div ref={slashMenuRef}>
          <SlashMenu position={menuPosition} onSelect={applySlashCommand} selectedIndex={selectedIndex} />
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
    </div>
  );
}
