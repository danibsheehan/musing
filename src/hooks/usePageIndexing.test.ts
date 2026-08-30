import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Block } from "../types/block";

const mocks = vi.hoisted(() => ({
  isAiServiceConfigured: vi.fn(() => true),
  embedPage: vi.fn(async () => ({ embedded: 1, skipped: 0, removed: 0 })),
}));

vi.mock("../lib/aiClient", () => ({
  isAiServiceConfigured: mocks.isAiServiceConfigured,
  embedPage: mocks.embedPage,
}));

const blocks: Block[] = [{ id: "b1", type: "paragraph", content: "<p>hello</p>" }];

describe("usePageIndexing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.isAiServiceConfigured.mockReset().mockReturnValue(true);
    mocks.embedPage.mockReset().mockResolvedValue({ embedded: 1, skipped: 0, removed: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function loadHook() {
    return (await import("./usePageIndexing")).usePageIndexing;
  }

  it("does not call embedPage before the debounce elapses", async () => {
    const usePageIndexing = await loadHook();
    renderHook(() => usePageIndexing("page-1", blocks));

    await vi.advanceTimersByTimeAsync(1000);
    expect(mocks.embedPage).not.toHaveBeenCalled();
  });

  it("calls embedPage with plain-text blocks after the debounce elapses", async () => {
    const usePageIndexing = await loadHook();
    renderHook(() => usePageIndexing("page-1", blocks));

    await vi.advanceTimersByTimeAsync(2000);
    expect(mocks.embedPage).toHaveBeenCalledWith("page-1", [
      { id: "b1", type: "paragraph", content: "hello" },
    ]);
  });

  it("resets the debounce timer when blocks change again before it fires", async () => {
    const usePageIndexing = await loadHook();
    const { rerender } = renderHook(({ b }: { b: Block[] }) => usePageIndexing("page-1", b), {
      initialProps: { b: blocks },
    });

    await vi.advanceTimersByTimeAsync(1500);
    const nextBlocks: Block[] = [{ id: "b1", type: "paragraph", content: "<p>hello world</p>" }];
    rerender({ b: nextBlocks });

    await vi.advanceTimersByTimeAsync(1500);
    expect(mocks.embedPage).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(mocks.embedPage).toHaveBeenCalledTimes(1);
    expect(mocks.embedPage).toHaveBeenCalledWith("page-1", [
      { id: "b1", type: "paragraph", content: "hello world" },
    ]);
  });

  it("does nothing when the AI service is not configured", async () => {
    mocks.isAiServiceConfigured.mockReturnValue(false);
    const usePageIndexing = await loadHook();
    renderHook(() => usePageIndexing("page-1", blocks));

    await vi.advanceTimersByTimeAsync(5000);
    expect(mocks.embedPage).not.toHaveBeenCalled();
  });

  it("does nothing when there are no blocks (e.g. a database page)", async () => {
    const usePageIndexing = await loadHook();
    renderHook(() => usePageIndexing("page-1", []));

    await vi.advanceTimersByTimeAsync(5000);
    expect(mocks.embedPage).not.toHaveBeenCalled();
  });
});
