import type { Page } from "../types/page";

type Props = {
  position: { top: number; left: number };
  pages: Page[];
  selectedIndex: number;
  onSelect: (page: Page) => void;
};

export default function PagePickerMenu({
  position,
  pages,
  selectedIndex,
  onSelect,
}: Props) {
  return (
    <div
      data-musing-page-picker-menu
      className="musing-dropdown musing-dropdown--picker"
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
      }}
    >
      {pages.length === 0 ? (
        <div className="musing-dropdown-empty musing-dropdown-empty--sm">
          No matching pages
        </div>
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
