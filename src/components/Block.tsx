import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { Block as BlockType } from "../types/block";

import { useEffect } from "react";

type Props = {
    block: BlockType;
    onChange: (id: string, content: string) => void;
    onEnter: (id: string) => void;
    onBackspace: (id: string) => void;
    isFocused: boolean;
    setFocusedBlockId: (id: string) => void;
};

export default function Block({
    block,
    onChange,
    onEnter,
    onBackspace,
    isFocused,
    setFocusedBlockId,
}: Props) {
    const editor = useEditor({
        extensions: [StarterKit],
        content: block.content,
        onUpdate: ({ editor }) => {
            onChange(block.id, editor.getHTML());
        },
        editorProps: {
            handleKeyDown(view, event) {
                if (event.key === "Enter") {
                    event.preventDefault();
                    onEnter(block.id);
                    return true;
                }

                if (event.key === "Backspace") {
                    const isEmpty = view.state.doc.textContent.length === 0;
                    if (isEmpty) {
                        event.preventDefault();
                        onBackspace(block.id);
                        return true;
                    }
                }

                return false;
            },
        },
    });

    useEffect(() => {
        if (isFocused && editor) {
            editor.commands.focus();
        }
    }, [isFocused, editor]);

    return (
        <div onClick={() => setFocusedBlockId(block.id)}>
            <EditorContent editor={editor} className="editor-content" />
        </div>
    );
}
