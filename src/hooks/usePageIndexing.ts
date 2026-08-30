import { useEffect, useRef } from "react";
import type { Block } from "../types/block";
import { embedPage, isAiServiceConfigured } from "../lib/aiClient";
import { blocksToPlainText } from "../lib/blockPlainText";

const DEBOUNCE_MS = 2000;

/**
 * Background-embeds a page's blocks ~2s after they stop changing, so search and
 * related-pages have something to work with. Failures are logged, never surfaced —
 * this is a background enhancement and must never disrupt writing.
 *
 * Known limitation: `blocks` losing referential stability resets this debounce even
 * without a real edit — happens when WorkspaceContext replaces the whole snapshot
 * (cross-tab `storage` sync, or the initial remote-fetch-on-mount race), which gives
 * every page a new `blocks` array identity. Effect: indexing is delayed, not skipped
 * or wrong — content-hash dedup on the backend means the eventual call is still
 * correct once things settle. Not fixed here since the fix (keying off a content
 * hash instead of array identity) adds real complexity for a delay-only edge case.
 */
export function usePageIndexing(pageId: string, blocks: Block[]): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isAiServiceConfigured() || blocks.length === 0) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void embedPage(pageId, blocksToPlainText(blocks)).catch((err: unknown) => {
        console.error("Background page indexing failed", err);
      });
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pageId, blocks]);
}
