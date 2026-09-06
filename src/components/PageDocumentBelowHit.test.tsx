import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { blockIdOnBlocks } from "../extensions/blockIdOnBlocks";
import PageDocumentBelowHit from "./PageDocumentBelowHit";

function makeEditor(html: string) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const editor = new Editor({
    element: el,
    extensions: [StarterKit, blockIdOnBlocks],
    content: html,
  });
  return { editor, el };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("PageDocumentBelowHit", () => {
  it("renders nothing when the last top-level block is a plain paragraph", () => {
    const { editor, el } = makeEditor("<p>a</p>");
    render(<PageDocumentBelowHit editor={editor} />);

    expect(screen.queryByRole("button", { name: "Add paragraph below" })).not.toBeInTheDocument();

    editor.destroy();
    el.remove();
  });

  it.each([
    ["code block", "<pre><code>x</code></pre>"],
    ["bullet list", "<ul><li>item</li></ul>"],
    ["ordered list", "<ol><li>item</li></ol>"],
    ["blockquote", "<blockquote><p>q</p></blockquote>"],
  ])("renders the hit strip when the last top-level block is a %s", (_label, html) => {
    const { editor, el } = makeEditor(html);
    render(<PageDocumentBelowHit editor={editor} />);

    expect(screen.getByRole("button", { name: "Add paragraph below" })).toBeInTheDocument();

    editor.destroy();
    el.remove();
  });

  it("stays visible after an unrelated update while the last block is still a code block", async () => {
    const { editor, el } = makeEditor("<pre><code>x</code></pre>");
    render(<PageDocumentBelowHit editor={editor} />);
    expect(screen.getByRole("button", { name: "Add paragraph below" })).toBeInTheDocument();

    act(() => {
      editor.commands.insertContentAt(1, "z");
    });

    await waitFor(() => {
      expect(editor.getText()).toContain("z");
    });
    expect(screen.getByRole("button", { name: "Add paragraph below" })).toBeInTheDocument();

    editor.destroy();
    el.remove();
  });

  it("clicking inserts a paragraph below the last block and then hides itself", async () => {
    const user = userEvent.setup();
    const { editor, el } = makeEditor("<pre><code>x</code></pre>");
    render(<PageDocumentBelowHit editor={editor} />);

    const button = screen.getByRole("button", { name: "Add paragraph below" });
    await user.click(button);

    expect(editor.state.doc.childCount).toBe(2);
    expect(editor.state.doc.lastChild?.type.name).toBe("paragraph");

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Add paragraph below" })).not.toBeInTheDocument();
    });

    editor.destroy();
    el.remove();
  });
});
