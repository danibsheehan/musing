import { v4 as uuidv4 } from "uuid";
import type { Block } from "../types/block";

export function createEmptyBlocks(): Block[] {
  return [
    {
      id: uuidv4(),
      type: "paragraph",
      content: "<p></p>",
    },
  ];
}
