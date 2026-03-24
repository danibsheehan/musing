import type { BlockType } from "../types/block";

type Props = {
    position: { top: number; left: number };
    onSelect: (type: BlockType) => void;
    selectedIndex: number;
};

export default function SlashMenu({ onSelect, position, selectedIndex }: Props) {
    const options = ["paragraph", "heading"];

    return (
        <div
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
            }}
        >
            {options.map((option, index) => (
                <div
                    key={option}
                    onClick={() => onSelect(option)}
                    style={{
                        padding: "4px 8px",
                        backgroundColor: selectedIndex === index ? "#eee" : "transparent",
                        borderRadius: "4px",
                        cursor: "pointer",
                    }}
                >
                    {option}
                </div>
            ))}
        </div>
    );
}
