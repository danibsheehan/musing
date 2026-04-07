import type { Editor } from "@tiptap/core";
import { isTextSelection } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEditorState } from "@tiptap/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { getEditorBubbleMenuPortal } from "../lib/editorBubbleMenuPortal";
import { textBeforeCursorInBlock } from "../lib/editorBlockText";

type Props = {
  editor: Editor;
  blockId: string;
};

function shouldShowFormatBubble({ editor }: { editor: Editor }): boolean {
  const { selection } = editor.state;
  if (!isTextSelection(selection) || selection.empty) return false;
  if (editor.isActive("codeBlock")) return false;
  const textBefore = textBeforeCursorInBlock(selection.$from);
  if (/\/[^ \n]*$/.test(textBefore)) return false;
  if (/@([^ \n]*)$/.test(textBefore)) return false;
  return true;
}

function normalizeUrl(input: string): string {
  const t = input.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t) || /^mailto:/i.test(t) || t.startsWith("/")) {
    return t;
  }
  return `https://${t}`;
}

export default function EditorTextFormatBubble({ editor, blockId }: Props) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const linkInputRef = useRef<HTMLInputElement>(null);
  const moreRef = useRef<HTMLDetailsElement>(null);

  const fmt = useEditorState({
    editor,
    selector: ({ editor: ed }) =>
      ed
        ? {
            bold: ed.isActive("bold"),
            italic: ed.isActive("italic"),
            underline: ed.isActive("underline"),
            strike: ed.isActive("strike"),
            code: ed.isActive("code"),
            link: ed.isActive("link"),
            href: (ed.getAttributes("link").href as string) ?? "",
          }
        : {
            bold: false,
            italic: false,
            underline: false,
            strike: false,
            code: false,
            link: false,
            href: "",
          },
  });

  const closeMore = useCallback(() => {
    if (moreRef.current) moreRef.current.open = false;
  }, []);

  const openLinkPanel = useCallback(() => {
    closeMore();
    setLinkUrl(fmt.href || "");
    setLinkOpen(true);
  }, [fmt.href, closeMore]);

  useEffect(() => {
    if (!linkOpen) return;
    const id = requestAnimationFrame(() => linkInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [linkOpen]);

  /** BubbleMenu only recomputes position on selection/resize; reflow after link panel mounts. */
  useLayoutEffect(() => {
    const bump = () => window.dispatchEvent(new Event("resize"));
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(bump);
    });
    return () => cancelAnimationFrame(id);
  }, [linkOpen]);

  useEffect(() => {
    if (!linkOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLinkOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [linkOpen]);

  const applyLink = useCallback(() => {
    const url = normalizeUrl(linkUrl);
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setLinkOpen(false);
  }, [editor, linkUrl]);

  const removeLink = useCallback(() => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  }, [editor]);

  const clearInlineFormatting = useCallback(() => {
    editor
      .chain()
      .focus()
      .unsetMark("bold")
      .unsetMark("italic")
      .unsetMark("underline")
      .unsetMark("strike")
      .unsetMark("code")
      .run();
    closeMore();
  }, [editor, closeMore]);

  return (
    <BubbleMenu
      editor={editor}
      pluginKey={`formatBubble:${blockId}`}
      appendTo={getEditorBubbleMenuPortal}
      updateDelay={0}
      shouldShow={({ editor: ed }) => shouldShowFormatBubble({ editor: ed })}
      className="editor-format-bubble-root"
      options={{
        placement: "top",
        flip: { fallbackPlacements: ["bottom", "top"] },
      }}
    >
      <div
        className="editor-format-bubble"
        onMouseDown={(e) => e.preventDefault()}
        role="toolbar"
        aria-label="Text formatting"
      >
        <div className="editor-format-bubble-row">
          <button
            type="button"
            className={`editor-format-btn${fmt.bold ? " is-active" : ""}`}
            aria-pressed={fmt.bold}
            title="Bold (⌘B)"
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            B
          </button>
          <button
            type="button"
            className={`editor-format-btn${fmt.italic ? " is-active" : ""}`}
            aria-pressed={fmt.italic}
            title="Italic (⌘I)"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            I
          </button>
          <button
            type="button"
            className={`editor-format-btn${fmt.underline ? " is-active" : ""}`}
            aria-pressed={fmt.underline}
            title="Underline (⌘U)"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            U
          </button>
          <span className="editor-format-sep" aria-hidden />
          <button
            type="button"
            className={`editor-format-btn editor-format-btn-link${fmt.link ? " is-active" : ""}`}
            aria-pressed={fmt.link}
            title="Link"
            onClick={() => {
              if (linkOpen) {
                setLinkOpen(false);
              } else {
                openLinkPanel();
              }
            }}
          >
            Link
          </button>
          <details ref={moreRef} className="editor-format-more">
            <summary className="editor-format-more-summary" title="More options">
              More
            </summary>
            <div className="editor-format-more-menu" role="menu">
              <button
                type="button"
                className={`editor-format-menu-item${fmt.strike ? " is-active" : ""}`}
                role="menuitem"
                onClick={() => {
                  editor.chain().focus().toggleStrike().run();
                  closeMore();
                }}
              >
                <span className="editor-format-menu-label">Strikethrough</span>
                <span className="editor-format-menu-hint">⌘⇧S</span>
              </button>
              <button
                type="button"
                className={`editor-format-menu-item${fmt.code ? " is-active" : ""}`}
                role="menuitem"
                onClick={() => {
                  editor.chain().focus().toggleCode().run();
                  closeMore();
                }}
              >
                <span className="editor-format-menu-label">Inline code</span>
              </button>
              <div className="editor-format-menu-divider" role="separator" />
              <button
                type="button"
                className="editor-format-menu-item"
                role="menuitem"
                onClick={clearInlineFormatting}
              >
                Clear text style
              </button>
            </div>
          </details>
        </div>

        {linkOpen ? (
          <div className="editor-format-link-panel">
            <label className="editor-format-link-label" htmlFor={`fmt-link-${blockId}`}>
              URL
            </label>
            <input
              ref={linkInputRef}
              id={`fmt-link-${blockId}`}
              type="url"
              className="editor-format-link-input"
              placeholder="https://…"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                }
              }}
            />
            <div className="editor-format-link-actions">
              <button type="button" className="editor-format-link-primary" onClick={applyLink}>
                Apply
              </button>
              {fmt.link ? (
                <button type="button" className="editor-format-link-secondary" onClick={removeLink}>
                  Remove link
                </button>
              ) : null}
              <button
                type="button"
                className="editor-format-link-secondary"
                onClick={() => setLinkOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </BubbleMenu>
  );
}
