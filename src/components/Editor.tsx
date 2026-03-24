import { useState } from "react";
import Block from "./Block";
import type { Block as BlockType } from "../types/block";
import { v4 as uuidv4 } from "uuid";

export default function Editor() {
  const [blocks, setBlocks] = useState<BlockType[]>([
    {
      id: uuidv4(),
      type: "paragraph",
      content: "<p></p>",
    },
  ]);

  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(blocks[0].id);

  const updateBlock = (id: string, content: string) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, content } : b))
    );
  };

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

  return (
    <div style={{ maxWidth: "700px", margin: "40px auto" }}>
      {blocks.map((block) => (
        <Block
          key={block.id}
          block={block}
          onChange={updateBlock}
          onEnter={addBlockAfter}
          onBackspace={deleteBlock}
          isFocused={focusedBlockId === block.id}
          setFocusedBlockId={setFocusedBlockId}
        />
      ))}
    </div>
  );
}
