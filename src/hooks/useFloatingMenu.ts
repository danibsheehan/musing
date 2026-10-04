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

/** Where a menu last saw its typed token: document positions of the trigger character through the caret. */
export type MenuToken = { from: number; to: number; query: string };

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
  /** Called for the chosen item. Call `close()` when done to hide the menu (the typed token is left to the caller to consume). */
  onSelect: (item: TItem, ctx: { blockId: string; close: () => void }) => void;
  /** Swallow a repeated Enter (key held down) without selecting anything. */
  blockRepeatedEnter?: boolean;
  /**
   * Reset the highlighted item on every editor update while open. By default it resets only when
   * the menu opens or its query changes.
   */
  resetSelectionOnEveryActivity?: boolean;
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
  const queryRef = useRef("");
  const tokenRef = useRef<MenuToken | null>(null);
  /**
   * Where the token the user dismissed (Escape, clicking away, Enter with no match) started. The
   * text stays in the document, so the menu must not reopen for that same token on the next
   * keystroke; it clears once that token ends or a different one starts.
   */
  const dismissedFromRef = useRef<number | null>(null);
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
    queryRef.current = query;
  }, [anchor, selectedIndex, query]);

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  /**
   * Closes the menu and resets its query and selection. The typed token stays in the document, and
   * the menu stays closed for it until it ends or a new one starts.
   */
  const close = useCallback(() => {
    // The token as it is in the document right now, not as the menu last saw it: Escape can arrive
    // in the same frame as the typing, before the menu has opened or remembered anything. Null when
    // the token is already gone (a selection consumed it, or Backspace deleted it).
    const ed = editorRef.current;
    const matchToken = configRef.current.matchToken;
    let dismissedFrom: number | null = null;
    if (ed && !ed.isDestroyed && matchToken) {
      const { from, $from } = ed.state.selection;
      const token = matchToken(textBeforeCursorInBlock($from));
      if (token) dismissedFrom = from - token.length;
    }
    dismissedFromRef.current = dismissedFrom;
    isOpenRef.current = false;
    blockIdRef.current = null;
    tokenRef.current = null;
    setAnchor(null);
    setQuery("");
    setSelectedIndex(0);
  }, [editorRef]);

  /** The token is already gone from the document, so just hide the menu. */
  const hide = useCallback(() => {
    blockIdRef.current = null;
    tokenRef.current = null;
    setAnchor(null);
  }, []);

  /** Opens a menu that has no typed token, anchored to a block at a screen position. */
  const open = useCallback((args: { blockId: string; position: MenuPosition }) => {
    setAnchor(args);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  /**
   * The typed token as it is right now. The remembered token only refreshes once per animation
   * frame, so when the user types or edits and acts within the same frame it can be out of date;
   * the live token at the caret is used whenever the caret is still in the block the menu is
   * anchored to. Otherwise (the caret moved to another block, e.g. while the editor was blurred)
   * the remembered range is returned, and the caller should check that its text is still there.
   */
  const getToken = useCallback((editor: TiptapEditor): MenuToken | null => {
    const stored = tokenRef.current;
    const matchToken = configRef.current.matchToken;
    if (!stored || !matchToken) return stored;
    const { from, $from } = editor.state.selection;
    const live = matchToken(textBeforeCursorInBlock($from));
    if (live && blockIdAtSelection(editor) === blockIdRef.current) {
      return { from: from - live.length, to: from, query: live.query };
    }
    return stored;
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
          dismissedFromRef.current = null;
          hideIfOwned();
          return;
        }
        if (dismissedFromRef.current !== null) {
          if (dismissedFromRef.current === from - token.length) return;
          dismissedFromRef.current = null;
        }

        const coords = viewCoordsForFloatingMenu(ed.view, from - token.length, from);
        const top = coords.bottom + 4;
        const left = coords.left;
        if (!Number.isFinite(top) || !Number.isFinite(left)) {
          if (ed.view.composing) return;
          hideIfOwned();
          return;
        }

        const resetSelection =
          cfg.resetSelectionOnEveryActivity ||
          !isOpenRef.current ||
          token.query !== queryRef.current;
        blockIdRef.current = activeBlockId;
        tokenRef.current = { from: from - token.length, to: from, query: token.query };
        setAnchor({ blockId: activeBlockId, position: { top, left } });
        setQuery(token.query);
        if (resetSelection) setSelectedIndex(0);
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
        if (dismissedFromRef.current === ed.state.selection.from - token.length) return;
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
        // Nothing to choose: close the menu and let Enter make a new line.
        if (n === 0) {
          close();
          return;
        }
        swallow();
        if (e.repeat && cfg.blockRepeatedEnter) return;
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
    /** Synchronous mirror of the anchor block id. */
    blockIdRef: blockIdRef as RefObject<string | null>,
    /** The typed token right now (see above); null for a menu opened with `open()`. */
    getToken,
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
