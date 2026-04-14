import type { Editor } from "@tiptap/core";
import type { EmojiItem } from "@tiptap/extension-emoji";
import { useEffect, useRef } from "react";

export type EmojiSuggestionMenuProps = {
  editor: Editor;
  items: EmojiItem[];
  selectedIndex: number;
  command: (item: EmojiItem) => void;
  clientRect: (() => DOMRect | null) | null | undefined;
};

export default function EmojiSuggestionMenu(props: EmojiSuggestionMenuProps) {
  const { items, selectedIndex, command } = props;
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const el = rowRefs.current[selectedIndex];
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <div
      data-musing-emoji-suggestion-menu
      role="listbox"
      aria-label="Emoji"
      onMouseDown={(e) => e.preventDefault()}
    >
      {items.length === 0 ? (
        <div className="musing-dropdown-empty">No matching emoji</div>
      ) : (
        items.map((item, index) => (
          <button
            key={item.name}
            type="button"
            ref={(el) => {
              rowRefs.current[index] = el;
            }}
            role="option"
            aria-selected={selectedIndex === index}
            className="musing-dropdown-option-btn"
            onClick={() => command(item)}
          >
            <span className="musing-dropdown-emoji-glyph">{item.emoji}</span>
            <span className="musing-dropdown-option-label">
              :{item.shortcodes[0] ?? item.name}:
            </span>
          </button>
        ))
      )}
    </div>
  );
}
