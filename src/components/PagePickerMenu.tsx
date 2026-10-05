import type { Page } from "../types/page";

type Props = {
  position: { top: number; left: number };
  pages: Page[];
  selectedIndex: number;
  onSelect: (page: Page) => void;
  /** Called when the "no matches" row is clicked. */
  onClose: () => void;
};

export default function PagePickerMenu({
  position,
  pages,
  selectedIndex,
  onSelect,
  onClose,
}: Props) {
  return (
    <div
      data-musing-page-picker-menu
      className="musing-dropdown musing-dropdown--picker"
      role={pages.length > 0 ? "listbox" : undefined}
      aria-label="Pages"
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
      }}
    >
      {pages.length === 0 ? (
        <button
          type="button"
          className="musing-dropdown-empty musing-dropdown-empty--sm"
          onClick={onClose}
        >
          <span>No matching pages</span>
          <span className="musing-dropdown-hint">esc to close</span>
        </button>
      ) : (
        pages.map((page, index) => (
          <div
            key={page.id}
            role="option"
            aria-selected={selectedIndex === index}
            className="musing-dropdown-option"
            onClick={() => onSelect(page)}
          >
            {page.title}
          </div>
        ))
      )}
    </div>
  );
}
