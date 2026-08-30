import { createHash } from "node:crypto";

export type IncomingBlock = {
  id: string;
  type: string;
  content: string;
};

export type Chunk = {
  blockId: string;
  content: string;
  contentHash: string;
};

/** Blocks below this length embed poorly on their own (e.g. a bare short heading). */
const MIN_CONTENT_LENGTH = 8;

/** Structurally empty or non-textual block types — nothing meaningful to embed. */
const SKIP_BLOCK_TYPES = new Set(["horizontalRule", "databaseEmbed"]);

export function chunkBlocks(blocks: IncomingBlock[]): Chunk[] {
  return blocks
    .filter((block) => !SKIP_BLOCK_TYPES.has(block.type))
    .filter((block) => block.content.trim().length >= MIN_CONTENT_LENGTH)
    .map((block) => ({
      blockId: block.id,
      content: block.content,
      contentHash: createHash("sha256").update(block.content).digest("hex"),
    }));
}
