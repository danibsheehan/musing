import type { Editor } from "@tiptap/core";
import type { EmojiItem } from "@tiptap/extension-emoji";
import { EmojiSuggestionPluginKey } from "@tiptap/extension-emoji";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { exitSuggestion } from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";

import EmojiSuggestionMenu, {
  type EmojiSuggestionMenuProps,
} from "../components/EmojiSuggestionMenu";
import { getEmojiSuggestionItems } from "./emojiSuggestionItems";

/**
 * TipTap Emoji `suggestion.render` using a React floating list (arrow keys + Enter).
 */
export function createEmojiSuggestionRender() {
  let renderer: ReactRenderer | null = null;
  let selectedIndex = 0;
  let lastProps: SuggestionProps<EmojiItem, EmojiItem> | null = null;
  let removeOutsidePointerListener: (() => void) | null = null;

  const position = (
    el: HTMLElement,
    clientRect?: (() => DOMRect | null) | null
  ) => {
    const rect = clientRect?.();
    if (!rect) return;
    el.style.position = "fixed";
    el.style.top = `${rect.bottom + 4}px`;
    el.style.left = `${rect.left}px`;
  };

  return () => ({
    onStart: (props: SuggestionProps<EmojiItem, EmojiItem>) => {
      removeOutsidePointerListener?.();
      removeOutsidePointerListener = null;

      lastProps = props;
      selectedIndex = 0;
      renderer = new ReactRenderer(EmojiSuggestionMenu, {
        editor: props.editor,
        className: "musing-dropdown musing-dropdown--emoji",
        props: {
          editor: props.editor,
          items: props.items,
          selectedIndex: 0,
          command: props.command,
          clientRect: props.clientRect ?? null,
        } satisfies EmojiSuggestionMenuProps,
      });
      document.body.appendChild(renderer.element);
      position(renderer.element, props.clientRect);

      const view = props.editor.view;
      const onOutsidePointerDown = (e: PointerEvent) => {
        const r = renderer;
        if (!r?.element) return;
        const t = e.target;
        if (t instanceof Node && r.element.contains(t)) return;
        exitSuggestion(view, EmojiSuggestionPluginKey);
      };
      document.addEventListener("pointerdown", onOutsidePointerDown, true);
      removeOutsidePointerListener = () => {
        document.removeEventListener("pointerdown", onOutsidePointerDown, true);
      };
    },
    onUpdate: (props: SuggestionProps<EmojiItem, EmojiItem>) => {
      lastProps = props;
      selectedIndex = Math.min(
        selectedIndex,
        Math.max(0, props.items.length - 1)
      );
      renderer?.updateProps({
        editor: props.editor,
        items: props.items,
        selectedIndex,
        command: props.command,
        clientRect: props.clientRect ?? null,
      } satisfies EmojiSuggestionMenuProps);
      if (renderer) position(renderer.element, props.clientRect);
    },
    onExit: () => {
      removeOutsidePointerListener?.();
      removeOutsidePointerListener = null;
      renderer?.destroy();
      renderer = null;
      lastProps = null;
      selectedIndex = 0;
    },
    onKeyDown: ({ event, view }: SuggestionKeyDownProps) => {
      const props = lastProps;
      if (!props || props.items.length === 0) {
        if (event.key === "Escape") {
          exitSuggestion(view, EmojiSuggestionPluginKey);
          return true;
        }
        return false;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        selectedIndex = (selectedIndex + 1) % props.items.length;
        renderer?.updateProps({
          editor: props.editor,
          items: props.items,
          selectedIndex,
          command: props.command,
          clientRect: props.clientRect ?? null,
        } satisfies EmojiSuggestionMenuProps);
        return true;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        selectedIndex =
          selectedIndex === 0 ? props.items.length - 1 : selectedIndex - 1;
        renderer?.updateProps({
          editor: props.editor,
          items: props.items,
          selectedIndex,
          command: props.command,
          clientRect: props.clientRect ?? null,
        } satisfies EmojiSuggestionMenuProps);
        return true;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const item = props.items[selectedIndex];
        if (item) props.command(item);
        return true;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        exitSuggestion(view, EmojiSuggestionPluginKey);
        return true;
      }

      return false;
    },
  });
}

/**
 * Emoji extension `suggestion.items` — filtered by typed query after `:`.
 */
export function emojiSuggestionItems({
  query,
}: {
  query: string;
  editor: Editor;
}): EmojiItem[] {
  return getEmojiSuggestionItems(query);
}
