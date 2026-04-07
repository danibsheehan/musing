import type { ResolvedPos } from "@tiptap/pm/model";
import { describe, expect, it, vi } from "vitest";
import { textBeforeCursorInBlock } from "./editorBlockText";

describe("textBeforeCursorInBlock", () => {
  it("returns empty string when the parent is not a textblock", () => {
    const $from = {
      parent: { isTextblock: false },
      parentOffset: 3,
    } as unknown as ResolvedPos;
    expect(textBeforeCursorInBlock($from)).toBe("");
  });

  it("returns text from block start through parentOffset", () => {
    const textBetween = vi.fn(() => "hello");
    const $from = {
      parent: { isTextblock: true, textBetween },
      parentOffset: 5,
    } as unknown as ResolvedPos;
    expect(textBeforeCursorInBlock($from)).toBe("hello");
    expect(textBetween).toHaveBeenCalledWith(0, 5);
  });
});
