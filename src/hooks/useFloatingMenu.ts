import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { textBeforeCursorInBlock, viewCoordsForFloatingMenu } from "../lib/editorBlockText";
import { blockIdAtSelection } from "../lib/pageDocument/blockIdAtSelection";
import type { TokenMatch } from "../lib/tiptapMenuOpen";

export type MenuPosition = { top: number; left: number };

/** Next selected index for ArrowDown/ArrowUp: clamps a stale index, wraps at both ends. `count` must be > 0. */
export function stepMenuIndex(prev: number, count: number, direction: "down" | "up"): number {
  const cur = Math.min(prev, count - 1);
  if (direction === "down") return (cur + 1) % count;
  return cur === 0 ? count - 1 : cur - 1;
}

type OpenState = { blockId: string; position: MenuPosition };

export type FloatingMenuConfig<TItem> = {
  editorRef: RefObject<TiptapEditor | null>;
  /**
   * Pure: the trigger token at the end of the text before the caret (e.g. `@query`), or null.
   * Omit it for a menu that is opened with `open()` and has no typed token.
   */
  matchToken?: (textBefore: string) => TokenMatch | null;
  /**
   * When false a token menu never opens and closes if it was open (e.g. no other pages to link to);
   * for an imperative menu it only turns the keyboard handling off.
   */
  enabled: boolean;
  /** Items for a query. Called with the live document query on key presses, and with the state query for rendering. */
  getItems: (query: string) => TItem[];
  /** Called for the chosen item. Call `close()` when done: it removes the token text and hides the menu. */
  onSelect: (item: TItem, ctx: { blockId: string; close: () => void }) => void;
  /** Runs just before this menu opens, e.g. to close a sibling menu. */
  onBeforeOpen?: () => void;
  /** Deletes the typed token from the document when the menu is closed with `close()`. */
  removeTokenOnClose?: (editor: TiptapEditor) => void;
};

/**
 * A floating menu anchored to a token typed in the document (`@page`, …).
 *
 * Open state is detected from the document after each editor update/selection change (coalesced
 * to one animation frame), because React state lags a frame behind typing. The arrow/Enter/Escape
 * keys are handled in a capture-phase `window` listener that reads the document, not React state,
 * for the same reason, so they run before ProseMirror moves the caret.
 */
export function useFloatingMenu<TItem>(config: FloatingMenuConfig<TItem>) {
  const { editorRef, enabled, getItems } = config;

  const [anchor, setAnchor] = useState<OpenState | null>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  /** Synchronous mirrors for code that runs before React commits (key handlers, rAF callbacks). */
  const isOpenRef = useRef(false);
  const blockIdRef = useRef<string | null>(null);
  const selectedIndexRef = useRef(0);
  const rafRef = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);

  /** Latest config, so the callbacks below keep stable identities. */
  const configRef = useRef(config);
  useLayoutEffect(() => {
    configRef.current = config;
  });

  useLayoutEffect(() => {
    isOpenRef.current = anchor !== null;
    blockIdRef.current = anchor?.blockId ?? null;
    selectedIndexRef.current = selectedIndex;
  }, [anchor, selectedIndex]);

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  /** Full close: removes the typed token from the document, hides the menu, resets query and index. */
  const close = useCallback(() => {
    const ed = editorRef.current;
    if (ed && !ed.isDestroyed) {
      configRef.current.removeTokenOnClose?.(ed);
    }
    setAnchor(null);
    setQuery("");
    setSelectedIndex(0);
  }, [editorRef]);

  /** The token is already gone from the document, so just hide the menu. */
  const hide = useCallback(() => {
    blockIdRef.current = null;
    setAnchor(null);
  }, []);

  /** Opens a menu that has no typed token, anchored to a block at a screen position. */
  const open = useCallback((args: { blockId: string; position: MenuPosition }) => {
    setAnchor(args);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  const select = useCallback(
    (item: TItem) => {
      const blockId = blockIdRef.current;
      if (!blockId) return;
      configRef.current.onSelect(item, { blockId, close });
    },
    [close],
  );

  const handleEditorActivity = useCallback(
    (ed: TiptapEditor) => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (ed.isDestroyed) return;
        const cfg = configRef.current;
        if (!cfg.matchToken) return;
        if (!cfg.enabled) {
          if (blockIdRef.current) hide();
          return;
        }
        const activeBlockId = blockIdAtSelection(ed) ?? blockIdRef.current;
        if (!activeBlockId) return;

        const hideIfOwned = () => {
          if (blockIdRef.current === activeBlockId) hide();
        };

        const { from, $from } = ed.state.selection;
        const token = cfg.matchToken(textBeforeCursorInBlock($from));
        if (!token) {
          if (ed.view.composing) return;
          hideIfOwned();
          return;
        }

        const coords = viewCoordsForFloatingMenu(ed.view, from - token.length, from);
        const top = coords.bottom + 4;
        const left = coords.left;
        if (!Number.isFinite(top) || !Number.isFinite(left)) {
          if (ed.view.composing) return;
          hideIfOwned();
          return;
        }

        cfg.onBeforeOpen?.();
        blockIdRef.current = activeBlockId;
        setAnchor({ blockId: activeBlockId, position: { top, left } });
        setQuery(token.query);
        setSelectedIndex(0);
      });
    },
    [hide],
  );

  useLayoutEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const cfg = configRef.current;
      let query = "";
      if (cfg.matchToken) {
        // React state lags a frame behind typing, so the document is the source of truth for "open".
        const ed = editorRef.current;
        if (!ed || ed.isDestroyed) return;
        const token = cfg.matchToken(textBeforeCursorInBlock(ed.state.selection.$from));
        if (!token) return;
        query = token.query;
      } else if (!isOpenRef.current) {
        return;
      }

      const items = cfg.getItems(query);
      const n = items.length;
      const swallow = () => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      };

      if (e.key === "ArrowDown") {
        swallow();
        if (n === 0) return;
        setSelectedIndex((prev) => stepMenuIndex(prev, n, "down"));
      }

      if (e.key === "ArrowUp") {
        swallow();
        if (n === 0) return;
        setSelectedIndex((prev) => stepMenuIndex(prev, n, "up"));
      }

      if (e.key === "Enter") {
        swallow();
        if (n === 0) {
          close();
          return;
        }
        select(items[Math.min(selectedIndexRef.current, n - 1)]);
      }

      if (e.key === "Escape") {
        swallow();
        close();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled, editorRef, close, select]);

  const items = useMemo(() => getItems(query), [getItems, query]);

  return {
    isOpen: anchor !== null,
    /** Synchronous mirror of `isOpen`, for handlers that run before React commits. */
    isOpenRef: isOpenRef as RefObject<boolean>,
    blockId: anchor?.blockId ?? null,
    position: anchor?.position ?? null,
    query,
    items,
    /** Selected index clamped to the current items. */
    selectedIndex: items.length === 0 ? 0 : Math.min(selectedIndex, items.length - 1),
    /** Attach to the menu's wrapper so outside-click handling can tell inside from outside. */
    menuRef,
    handleEditorActivity,
    open,
    select,
    close,
  };
}
