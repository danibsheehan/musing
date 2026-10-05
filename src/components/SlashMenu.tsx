import {
  SLASH_MENU_ITEMS,
  type SlashMenuChoice,
  type SlashMenuItem,
} from "../lib/slashMenuOptions";

type Props = {
  position: { top: number; left: number };
  onSelect: (type: SlashMenuChoice) => void;
  /** Called when the "no matches" row is clicked. */
  onClose: () => void;
  selectedIndex: number;
  items?: SlashMenuItem[];
};

export default function SlashMenu({
  onSelect,
  onClose,
  position,
  selectedIndex,
  items = SLASH_MENU_ITEMS,
}: Props) {
  return (
    <div
      data-musing-slash-menu
      className="musing-dropdown musing-dropdown--slash"
      role={items.length > 0 ? "listbox" : undefined}
      aria-label="Block commands"
      onPointerDown={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
      }}
    >
      {items.length === 0 ? (
        <button
          type="button"
          className="musing-dropdown-empty"
          // Keep focus in the editor: the button is gone as soon as it is clicked.
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClose}
        >
          <span>No matching commands</span>
          <span className="musing-dropdown-hint">esc to close</span>
        </button>
      ) : (
        items.map((item, index) => (
          <div
            key={`${item.type}-${item.label}`}
            role="option"
            aria-selected={selectedIndex === index}
            className="musing-dropdown-option"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              e.stopPropagation();
              onSelect(item.type);
            }}
          >
            {item.label}
          </div>
        ))
      )}
    </div>
  );
}
