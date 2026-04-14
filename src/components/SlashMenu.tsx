import {
  SLASH_MENU_ITEMS,
  type SlashMenuChoice,
  type SlashMenuItem,
} from "../lib/slashMenuOptions";

type Props = {
  position: { top: number; left: number };
  onSelect: (type: SlashMenuChoice) => void;
  selectedIndex: number;
  items?: SlashMenuItem[];
};

export default function SlashMenu({
  onSelect,
  position,
  selectedIndex,
  items = SLASH_MENU_ITEMS,
}: Props) {
  return (
    <div
      data-musing-slash-menu
      className="musing-dropdown musing-dropdown--slash"
      role="listbox"
      aria-label="Block commands"
      onPointerDown={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
      }}
    >
      {items.length === 0 ? (
        <div className="musing-dropdown-empty">No matching commands</div>
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
