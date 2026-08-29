import { describe, expect, it } from "vitest";
import { chunkBlocks } from "./chunking.js";

describe("chunkBlocks", () => {
  it("skips blocks below the minimum content length", () => {
    const chunks = chunkBlocks([{ id: "1", type: "paragraph", content: "hi" }]);
    expect(chunks).toHaveLength(0);
  });

  it("skips structurally-empty block types regardless of content", () => {
    const chunks = chunkBlocks([
      { id: "1", type: "horizontalRule", content: "this is long enough content" },
      { id: "2", type: "databaseEmbed", content: "this is long enough content" },
    ]);
    expect(chunks).toHaveLength(0);
  });

  it("includes blocks with enough content and a hashable type", () => {
    const chunks = chunkBlocks([{ id: "1", type: "paragraph", content: "this is long enough" }]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].blockId).toBe("1");
    expect(chunks[0].contentHash).toHaveLength(64);
  });

  it("produces the same hash for identical content and different hashes for different content", () => {
    const [a] = chunkBlocks([{ id: "1", type: "paragraph", content: "the same content here" }]);
    const [b] = chunkBlocks([{ id: "2", type: "paragraph", content: "the same content here" }]);
    const [c] = chunkBlocks([{ id: "3", type: "paragraph", content: "different content here" }]);

    expect(a.contentHash).toBe(b.contentHash);
    expect(a.contentHash).not.toBe(c.contentHash);
  });
});
