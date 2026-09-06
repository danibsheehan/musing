import type { ResolvedPos } from "prosemirror-model";
import { describe, expect, it, vi } from "vitest";
import type { EditorView } from "@tiptap/pm/view";
import { textBeforeCursorInBlock, viewCoordsForFloatingMenu } from "./editorBlockText";

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

const RECT = { left: 0, right: 100, top: 0, bottom: 50, width: 100, height: 50 } as DOMRect;
const INSIDE = { top: 10, left: 10, bottom: 20 };
const OUTSIDE = { top: -1000, left: -1000, bottom: -1000 };

function makeView(coordsSequence: Array<typeof INSIDE>, docSize = 100) {
  let call = 0;
  const coordsAtPos = vi.fn(() => coordsSequence[Math.min(call++, coordsSequence.length - 1)]);
  const view = {
    dom: { getBoundingClientRect: () => RECT },
    state: { doc: { content: { size: docSize } } },
    coordsAtPos,
  } as unknown as EditorView;
  return { view, coordsAtPos };
}

describe("viewCoordsForFloatingMenu", () => {
  it("uses the anchor position's coords when they land inside the editor", () => {
    const { view, coordsAtPos } = makeView([INSIDE]);
    const result = viewCoordsForFloatingMenu(view, 5, 5);
    expect(result).toEqual(INSIDE);
    expect(coordsAtPos).toHaveBeenCalledTimes(1);
  });

  it("falls back to the head position when the anchor lands outside", () => {
    const { view, coordsAtPos } = makeView([OUTSIDE, INSIDE]);
    const result = viewCoordsForFloatingMenu(view, 5, 6);
    expect(result).toEqual(INSIDE);
    expect(coordsAtPos).toHaveBeenCalledTimes(2);
  });

  it("falls back to a clamped anchor position when anchor and head both land outside", () => {
    const { view, coordsAtPos } = makeView([OUTSIDE, OUTSIDE, INSIDE]);
    const result = viewCoordsForFloatingMenu(view, 5, 6);
    expect(result).toEqual(INSIDE);
    expect(coordsAtPos).toHaveBeenCalledTimes(3);
  });

  it("falls back to a clamped head position as the last coordsAtPos attempt", () => {
    const { view, coordsAtPos } = makeView([OUTSIDE, OUTSIDE, OUTSIDE, INSIDE]);
    const result = viewCoordsForFloatingMenu(view, 5, 6);
    expect(result).toEqual(INSIDE);
    expect(coordsAtPos).toHaveBeenCalledTimes(4);
  });

  it("falls back to a computed position derived from the editor's rect when every attempt lands outside", () => {
    const { view } = makeView([OUTSIDE]);
    const result = viewCoordsForFloatingMenu(view, 5, 6);
    const expectedY = RECT.top + Math.min(24, RECT.height * 0.15);
    expect(result).toEqual({ top: expectedY, left: RECT.left + 8, bottom: expectedY });
  });
});
