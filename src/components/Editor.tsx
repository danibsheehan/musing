import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import Block from "./Block";
import type { Block as BlockType } from "../types/block";
import { v4 as uuidv4 } from "uuid";
import SlashMenu from "./SlashMenu";

export default function Editor() {
  const [blocks, setBlocks] = useState<BlockType[]>([
    {
      id: uuidv4(),
      type: "paragraph",
      content: "<p></p>",
    },
  ]);

  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(blocks[0].id);
  const [showMenu, setShowMenu] = useState(false);
  const [menuBlockId, setMenuBlockId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const editorByBlockId = useRef(new Map<string, TiptapEditor>());
  const slashMenuRef = useRef<HTMLDivElement>(null);

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
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, content } : b))
    );
  };

  const updateBlockType = useCallback(
    (id: string, type: BlockType["type"]) => {
      setBlocks((prev) =>
        prev.map((b) => (b.id === id ? { ...b, type } : b))
      );
      closeSlashMenu();
    },
    [closeSlashMenu]
  );

  const applySlashCommand = useCallback(
    (type: BlockType["type"]) => {
      if (!menuBlockId) return;
      const blockId = menuBlockId;
      const ed = editorByBlockId.current.get(blockId);
      if (ed && !ed.isDestroyed) {
        const chain = ed.chain().focus().command(({ tr, state }) => {
          const { from, $from } = state.selection;
          const blockStart = $from.start();
          if (from <= blockStart) return false;
          const textBefore = state.doc.textBetween(blockStart, from);
          const m = textBefore.match(/\/[^ \n]*$/);
          if (!m) return false;
          tr.delete(from - m[0].length, from);
          return true;
        });
        if (type === "heading") {
          chain.setHeading({ level: 1 });
        } else {
          chain.setParagraph();
        }
        chain.run();
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

    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === id);
      const copy = [...prev];
      copy.splice(index + 1, 0, newBlock);
      return copy;
    });

    setFocusedBlockId(newBlock.id);
  };

  const deleteBlock = (id: string) => {
    setBlocks((prev) => {
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

      const options = ["paragraph", "heading"] as const satisfies readonly BlockType["type"][];

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev + 1) % options.length);
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) =>
          prev === 0 ? options.length - 1 : prev - 1
        );
      }

      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        applySlashCommand(options[selectedIndex]);
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
    <div style={{ maxWidth: "700px", margin: "40px auto", position: "relative" }}>
      {blocks.map((block) => (
        <Block
          key={block.id}
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
