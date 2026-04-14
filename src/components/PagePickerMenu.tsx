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
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        background: "white",
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "8px",
        boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
        zIndex: 1000,
        minWidth: "12rem",
        maxHeight: "240px",
        overflowY: "auto",
      }}
    >
      {pages.length === 0 ? (
        <div style={{ padding: "4px 8px", color: "#666", fontSize: "0.85rem" }}>
          No matching pages
        </div>
      ) : (
        pages.map((page, index) => (
          <div
            key={page.id}
            onClick={() => onSelect(page)}
            style={{
              padding: "4px 8px",
              backgroundColor: selectedIndex === index ? "#eee" : "transparent",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            {page.title}
          </div>
        ))
      )}
    </div>
  );
}
