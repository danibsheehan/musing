import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import Block from "./Block";
import type { Block as BlockType } from "../types/block";
import { v4 as uuidv4 } from "uuid";
import SlashMenu from "./SlashMenu";
import { SLASH_MENU_ITEMS } from "../lib/slashMenuOptions";

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
  const [localBlocks, setLocalBlocks] = useState<BlockType[]>(blocks);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(
    blocks[0]?.id ?? null
  );
  const [showMenu, setShowMenu] = useState(false);
  const [menuBlockId, setMenuBlockId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

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

  useEffect(() => {
    if (!showMenu) return;

    const onPointerDown = (e: PointerEvent) => {
      if (slashMenuRef.current?.contains(e.target as Node)) return;
      closeSlashMenu();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [showMenu, closeSlashMenu]);

  return (
    <div className="editor-root">
      {localBlocks.map((block) => (
        <Block
          key={`${pageId}:${block.id}`}
          pageId={pageId}
          block={block}
          menuBlockId={menuBlockId}
          onContentChange={updateBlockContent}
          onEnter={addBlockAfter}
          onBackspace={deleteBlock}
          isFocused={focusedBlockId === block.id}
          registerEditor={registerEditor}
          setFocusedBlockId={setFocusedBlockId}
          setShowMenu={setShowMenu}
          setMenuBlockId={setMenuBlockId}
          setMenuPosition={setMenuPosition}
        />
      ))}

      {showMenu && menuBlockId && menuPosition && (
        <div ref={slashMenuRef}>
          <SlashMenu position={menuPosition} onSelect={applySlashCommand} selectedIndex={selectedIndex} />
        </div>
      )}
    </div>
  );
}
