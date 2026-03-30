import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import type { Block as BlockType } from "../types/block";

import { useCallback, useEffect, useRef } from "react";

/** True when the caret is right after `/` or still typing the slash-query (e.g. `/p`), without a closing space. */
function isSlashMenuOpen(editor: TiptapEditor): boolean {
    const { from, $from } = editor.state.selection;
    const start = $from.start();
    if (from <= start) return false;
    const textBefore = editor.state.doc.textBetween(start, from);
    return /\/[^ \n]*$/.test(textBefore);
}

type Props = {
    block: BlockType;
    menuBlockId: string | null;
    onContentChange: (id: string, content: string) => void;
    onEnter: (id: string) => void;
    onBackspace: (id: string) => void;
    isFocused: boolean;
    registerEditor: (id: string, instance: TiptapEditor | null) => void;
    setFocusedBlockId: (id: string) => void;
    setShowMenu: (show: boolean) => void;
    setMenuBlockId: (id: string | null) => void;
    setMenuPosition: (pos: { top: number; left: number } | null) => void;
};

export default function Block({
    block,
    menuBlockId,
    onContentChange,
    onEnter,
    onBackspace,
    isFocused,
    registerEditor,
    setFocusedBlockId,
    setShowMenu,
    setMenuBlockId,
    setMenuPosition,
}: Props) {
    const menuBlockIdRef = useRef(menuBlockId);

    useEffect(() => {
        menuBlockIdRef.current = menuBlockId;
    }, [menuBlockId]);

    const slashMenuRaf = useRef(0);

    const queueSlashMenuSync = useCallback(
        (ed: TiptapEditor) => {
            cancelAnimationFrame(slashMenuRaf.current);
            slashMenuRaf.current = requestAnimationFrame(() => {
                if (ed.isDestroyed) return;
                const open = isSlashMenuOpen(ed);
                if (open) {
                    const { from, $from } = ed.state.selection;
                    const blockStart = $from.start();
                    const textBefore = ed.state.doc.textBetween(blockStart, from);
                    const m = textBefore.match(/\/[^ \n]*$/);
                    if (!m) return;
                    const slashPos = from - m[0].length;
                    const coords = ed.view.coordsAtPos(slashPos);
                    setMenuPosition({
                        top: coords.bottom + 4,
                        left: coords.left,
                    });
                    setShowMenu(true);
                    setMenuBlockId(block.id);
                } else if (menuBlockIdRef.current === block.id) {
                    setShowMenu(false);
                    setMenuBlockId(null);
                    setMenuPosition(null);
                }
            });
        },
        [block.id, setMenuBlockId, setMenuPosition, setShowMenu]
    );

    useEffect(
        () => () => cancelAnimationFrame(slashMenuRaf.current),
        []
    );

    const editor = useEditor(
        {
            extensions: [
                StarterKit.configure({
                    heading: {
                        levels: [1, 2],
                    },
                }),
            ],
            content: block.content,
            onUpdate: ({ editor }) => {
                onContentChange(block.id, editor.getHTML());
                queueSlashMenuSync(editor);
            },
            onSelectionUpdate: ({ editor }) => {
                queueSlashMenuSync(editor);
            },
            editorProps: {
                handleKeyDown(view, event) {
                    if (event.key === "Enter") {
                        if (menuBlockIdRef.current === block.id) {
                            event.preventDefault();
                            return true;
                        }
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
        },
        [block.id]
    );

    useEffect(() => {
        if (!editor) return;

        if (block.type === "heading") {
            editor.commands.setHeading({ level: 1 });
        } else {
            editor.commands.setParagraph();
        }
    }, [block.type, editor]);

    useEffect(() => {
        if (!editor) return;
        registerEditor(block.id, editor);
        return () => registerEditor(block.id, null);
    }, [editor, block.id, registerEditor]);

    useEffect(() => {
        if (!editor || !isFocused) return;
        editor.commands.focus();
    }, [editor, isFocused]);

    return (
        <div onClick={() => setFocusedBlockId(block.id)}>
            <EditorContent editor={editor} className="editor-content" />
        </div>
    );
}
