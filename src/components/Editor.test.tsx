import { act, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SLASH_MENU_ITEMS } from "../lib/slashMenuOptions";
import {
  databaseFixture,
  flushFrames,
  installLayoutStubs,
  pageFixture,
  paragraphBlock,
  renderEditor,
  wait,
} from "../test/editorHarness";

/**
 * Characterization tests for the floating menus orchestrated by `Editor.tsx` (slash menu,
 * `@` page picker, linked-database picker). They pin CURRENT behavior, including quirks, so the
 * menu refactor can be verified as behavior-neutral. jsdom cannot cover real focus/blur on menu
 * clicks, key repeat from a physical keyboard, IME composition, or real layout coordinates;
 * those stay manual (see the vitest-tests skill).
 */

// The emoji extension probes canvas support when its module loads (before any test runs);
// jsdom logs "not implemented" unless getContext is stubbed first.
vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = () => null;
});

let restoreLayout: () => void;
beforeAll(() => {
  restoreLayout = installLayoutStubs();
});
afterAll(() => {
  restoreLayout();
});

const slashMenu = () => screen.queryByRole("listbox", { name: "Block commands" });
const pagePicker = () => screen.queryByRole("listbox", { name: "Pages" });
const databasePicker = () => screen.queryByRole("listbox", { name: "Databases" });
const optionNames = () => screen.getAllByRole("option").map((o) => o.textContent);
const selectedIndex = () =>
  screen.getAllByRole("option").findIndex((o) => o.getAttribute("aria-selected") === "true");

const otherPages = [pageFixture("p-alpha", "Alpha"), pageFixture("p-beta", "Beta")];
const withOthers = [pageFixture("current", "Current"), ...otherPages];

function pointerDown(target: Element) {
  act(() => {
    target.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
  });
}

describe("Editor slash menu", () => {
  it("opens on '/' listing every command, first one selected", async () => {
    const h = await renderEditor();
    expect(slashMenu()).not.toBeInTheDocument();

    h.typeText("/");
    await flushFrames();

    expect(slashMenu()).toBeInTheDocument();
    expect(optionNames()).toHaveLength(SLASH_MENU_ITEMS.length);
    expect(selectedIndex()).toBe(0);
  });

  it("filters the commands by the text typed after '/'", async () => {
    const h = await renderEditor();
    h.typeText("/head");
    await flushFrames();
    expect(optionNames()).toEqual(["Heading 1", "Heading 2"]);
  });

  it("moves the selection with ArrowDown/ArrowUp and wraps at both ends", async () => {
    const h = await renderEditor();
    h.typeText("/head");
    await flushFrames();
    expect(selectedIndex()).toBe(0);

    const down = h.pressKey("ArrowDown");
    expect(down.defaultPrevented).toBe(true);
    expect(selectedIndex()).toBe(1);

    h.pressKey("ArrowDown");
    expect(selectedIndex()).toBe(0);

    h.pressKey("ArrowUp");
    expect(selectedIndex()).toBe(1);
  });

  it("applies the selected command on Enter: block type changes, token removed, menu closes", async () => {
    const h = await renderEditor();
    h.typeText("/head");
    await flushFrames();
    h.pressKey("ArrowDown");

    const enter = h.pressKey("Enter");
    await wait(80);

    expect(enter.defaultPrevented).toBe(true);
    expect(h.topLevel()).toEqual(["heading:"]);
    expect(h.editor.state.doc.firstChild?.attrs.level).toBe(2);
    expect(slashMenu()).not.toBeInTheDocument();
    const last = h.onBlocksChange.mock.calls.at(-1)?.[0];
    expect(last?.[0].type).toBe("heading2");
  });

  it("swallows a repeated Enter (key held down) without applying anything", async () => {
    const h = await renderEditor();
    h.typeText("/head");
    await flushFrames();

    const enter = h.pressKey("Enter", { repeat: true });
    await wait(80);

    expect(enter.defaultPrevented).toBe(true);
    expect(h.topLevel()).toEqual(["paragraph:/head"]);
    expect(slashMenu()).toBeInTheDocument();
  });

  it("closes the menu on Enter when no command matches and lets Enter make a new line", async () => {
    const h = await renderEditor();
    h.typeText("/zzz");
    await flushFrames();
    expect(screen.getByText("No matching commands")).toBeInTheDocument();

    h.pressKeyInEditor("Enter", 13);
    await flushFrames();

    expect(slashMenu()).not.toBeInTheDocument();
    expect(h.topLevel()).toEqual(["paragraph:/zzz", "paragraph:"]);
  });

  it("stays open with the message for three characters past the last match, then closes", async () => {
    const h = await renderEditor();
    h.typeText("/hxab");
    await flushFrames();
    expect(slashMenu()).toBeInTheDocument();
    expect(screen.getByText("No matching commands")).toBeInTheDocument();

    h.typeText("c");
    await flushFrames();

    expect(slashMenu()).not.toBeInTheDocument();
    expect(h.topLevel()).toEqual(["paragraph:/hxabc"]);
    expect(h.pressKey("Enter").defaultPrevented).toBe(false);
    expect(h.pressKey("ArrowDown").defaultPrevented).toBe(false);
  });

  it("does not swallow keys pressed in the same frame as the character that closes it", async () => {
    const h = await renderEditor();
    h.typeText("/hxab");
    await flushFrames();

    h.typeText("c"); // the menu has not seen this keystroke yet
    expect(h.pressKey("ArrowDown").defaultPrevented).toBe(false);
    expect(h.pressKey("Escape").defaultPrevented).toBe(false);
  });

  // Regression: Enter pressed before the menu had seen the closing character moved the caret to a
  // new block, and the menu (still open on the old block) was never hidden.
  it("closes when Enter is pressed in the same frame as the character that closes it", async () => {
    const h = await renderEditor();
    h.typeText("/zzz");
    await flushFrames();
    expect(slashMenu()).toBeInTheDocument();

    h.typeText("z"); // the menu has not seen this keystroke yet
    h.pressKeyInEditor("Enter", 13);
    await flushFrames();

    expect(h.topLevel()).toEqual(["paragraph:/zzzz", "paragraph:"]);
    expect(slashMenu()).not.toBeInTheDocument();
  });

  // jsdom has no input method, so the editor's composing flag is forced on here.
  it("does not give up while an input method is composing", async () => {
    const h = await renderEditor();
    Object.defineProperty(h.editor.view, "composing", { get: () => true, configurable: true });

    h.typeText("/zzzzz");
    await flushFrames();

    expect(slashMenu()).toBeInTheDocument();
    expect(h.pressKey("ArrowDown").defaultPrevented).toBe(true);
    expect(slashMenu()).toBeInTheDocument();
  });

  it("stays closed after giving up when the text is deleted back to something that matches", async () => {
    const h = await renderEditor();
    h.typeText("/hxabc");
    await flushFrames();
    expect(slashMenu()).not.toBeInTheDocument();

    h.deleteBackward(4);
    await flushFrames();

    expect(h.topLevel()).toEqual(["paragraph:/h"]);
    expect(slashMenu()).not.toBeInTheDocument();
  });

  it("shows the commands again when the text is deleted back while the message is still showing", async () => {
    const h = await renderEditor();
    h.typeText("/hx");
    await flushFrames();
    expect(screen.getByText("No matching commands")).toBeInTheDocument();

    h.deleteBackward();
    await flushFrames();

    expect(slashMenu()).toBeInTheDocument();
    expect(optionNames()).toContain("Heading 1");
  });

  it("closes on Escape and keeps the typed text", async () => {
    const h = await renderEditor();
    h.typeText("/he");
    await flushFrames();

    const esc = h.pressKey("Escape");

    expect(esc.defaultPrevented).toBe(true);
    expect(slashMenu()).not.toBeInTheDocument();
    expect(h.topLevel()).toEqual(["paragraph:/he"]);
  });

  it("stays closed after Escape while the same token is edited, and stops swallowing keys", async () => {
    const h = await renderEditor();
    h.typeText("/he");
    await flushFrames();
    h.pressKey("Escape");

    h.typeText("a");
    await flushFrames();
    expect(slashMenu()).not.toBeInTheDocument();
    expect(h.topLevel()).toEqual(["paragraph:/hea"]);

    expect(h.pressKey("Enter").defaultPrevented).toBe(false);
    expect(h.pressKey("ArrowDown").defaultPrevented).toBe(false);
    expect(h.pressKey("Escape").defaultPrevented).toBe(false);
  });

  it("stays closed when Escape is pressed in the same frame as typing the token", async () => {
    const h = await renderEditor();
    h.typeText("/he"); // the menu has not opened yet
    h.pressKey("Escape");
    await flushFrames();

    expect(slashMenu()).not.toBeInTheDocument();
    expect(h.topLevel()).toEqual(["paragraph:/he"]);
  });

  it("opens again for a new token after the dismissed one has ended", async () => {
    const h = await renderEditor();
    h.typeText("/he");
    await flushFrames();
    h.pressKey("Escape");

    h.typeText(" /he");
    await flushFrames();

    expect(slashMenu()).toBeInTheDocument();
  });

  it("closes without removing text when a space ends the token", async () => {
    const h = await renderEditor();
    h.typeText("/he");
    await flushFrames();
    expect(slashMenu()).toBeInTheDocument();

    h.typeText(" ");
    await flushFrames();

    expect(slashMenu()).not.toBeInTheDocument();
    expect(h.topLevel()).toEqual(["paragraph:/he "]);
  });

  it("closes on pointerdown outside the menu (keeping the text) but not inside it", async () => {
    const h = await renderEditor();
    h.typeText("/he");
    await flushFrames();

    pointerDown(screen.getByRole("listbox", { name: "Block commands" }));
    expect(slashMenu()).toBeInTheDocument();

    pointerDown(document.body);
    expect(slashMenu()).not.toBeInTheDocument();
    expect(h.topLevel()).toEqual(["paragraph:/he"]);
  });

  it("stays closed after clicking away while the same token is edited", async () => {
    const h = await renderEditor();
    h.typeText("/he");
    await flushFrames();
    pointerDown(document.body);

    h.typeText("a");
    await flushFrames();

    expect(slashMenu()).not.toBeInTheDocument();
    expect(h.topLevel()).toEqual(["paragraph:/hea"]);
  });

  it("Divider inserts a horizontal rule", async () => {
    const h = await renderEditor();
    h.typeText("/div");
    await flushFrames();
    h.pressKey("Enter");
    await wait(80);

    expect(h.topLevel()[0]).toBe("horizontalRule:");
    expect(slashMenu()).not.toBeInTheDocument();
  });

  it("Emoji removes the token and types ':' after a frame to start the emoji suggestions", async () => {
    const h = await renderEditor();
    h.typeText("/emoji");
    await flushFrames();
    h.pressKey("Enter");
    await flushFrames();

    expect(h.topLevel()).toEqual(["paragraph::"]);
    expect(slashMenu()).not.toBeInTheDocument();
  });

  it("Linked database closes the slash menu and opens the database picker", async () => {
    const h = await renderEditor({ databases: [databaseFixture("db1", "Tasks")] });
    h.typeText("/linked");
    await flushFrames();
    h.pressKey("Enter");
    await flushFrames();

    expect(slashMenu()).not.toBeInTheDocument();
    expect(databasePicker()).toBeInTheDocument();
    expect(h.topLevel()).toEqual(["paragraph:"]);
  });

  // Regression: the token used to be measured from the END of the block's text, so a command typed
  // at the start or in the middle of a non-empty block made the rest of the block look like part of
  // the token, and applying the command deleted it. The menu now remembers where the token is.
  it("a command typed at the start of a non-empty block keeps that block's text", async () => {
    const h = await renderEditor({ blocks: [paragraphBlock("b1", "Title")] });
    h.setCaret(1);
    h.typeAtCaret("/head");
    await flushFrames();
    expect(slashMenu()).toBeInTheDocument();

    h.pressKey("Enter");
    await wait(80);

    expect(h.topLevel()).toEqual(["heading:Title"]);
  });

  it("removes the whole token when more is typed and Enter is pressed before the next frame", async () => {
    const h = await renderEditor();
    h.typeText("/di");
    await flushFrames();
    expect(slashMenu()).toBeInTheDocument();

    h.typeText("v"); // the menu has not seen this keystroke yet
    h.pressKey("Enter");
    await wait(80);

    expect(h.topLevel()[0]).toBe("horizontalRule:");
    expect(h.topLevel().slice(1)).toEqual(["paragraph:"]);
  });

  it("removes the token even when text before it was deleted in the same frame", async () => {
    const h = await renderEditor({ blocks: [paragraphBlock("b1", "ab ")] });
    h.typeText("/di");
    await flushFrames();
    expect(slashMenu()).toBeInTheDocument();

    // Shift the token left and extend it, then press Enter before the menu can refresh.
    act(() => {
      h.editor.commands.deleteRange({ from: 2, to: 3 });
    });
    h.typeText("v");
    h.pressKey("Enter");
    await wait(80);

    expect(h.topLevel()[0]).toBe("paragraph:a ");
    expect(JSON.stringify(h.topLevel())).not.toContain("/");
  });

  it("a command typed in the middle of a block's text removes only the typed token", async () => {
    const h = await renderEditor({ blocks: [paragraphBlock("b1", "Hello world")] });
    h.setCaret(7);
    h.typeAtCaret("/head");
    await flushFrames();
    expect(slashMenu()).toBeInTheDocument();

    h.pressKey("Enter");
    await wait(80);

    expect(h.topLevel()).toEqual(["heading:Hello world"]);
  });

  it("does not delete unrelated text when the document changed after the menu opened", async () => {
    const h = await renderEditor({ blocks: [paragraphBlock("b1", "abc ")] });
    h.typeText("/head");
    await flushFrames();
    expect(slashMenu()).toBeInTheDocument();

    // Replace the text before the next animation frame can refresh the menu's remembered token.
    act(() => {
      h.editor.commands.setContent('<p data-block-id="b1">XYZXYZXYZXYZ</p>');
    });
    const option = screen.getByRole("option", { name: "Heading 1" });
    act(() => {
      option.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 }),
      );
    });
    await wait(80);

    expect(h.topLevel()).toEqual(["heading:XYZXYZXYZXYZ"]);
  });
});

describe("Editor menu triggers", () => {
  it.each(["see http://www.google.com", "and/or", "10/3/2026", "C:/Users/me", "TCP/IP"])(
    "a slash inside %s does not open the menu, and Enter, Escape and clicking away keep the text",
    async (text) => {
      const h = await renderEditor();
      h.typeText(text);
      await flushFrames();
      expect(slashMenu()).not.toBeInTheDocument();

      const enter = h.pressKey("Enter");
      h.pressKey("Escape");
      pointerDown(document.body);

      expect(enter.defaultPrevented).toBe(false);
      expect(h.topLevel()).toEqual([`paragraph:${text}`]);
    },
  );

  it("an @ inside an email address does not open the page picker, and Enter, Escape and clicking away keep the text", async () => {
    const h = await renderEditor({ pages: withOthers });
    h.typeText("Email me at jane@gmail.com");
    await flushFrames();
    expect(pagePicker()).not.toBeInTheDocument();

    h.pressKey("Enter");
    h.pressKey("Escape");
    pointerDown(document.body);

    expect(h.topLevel()).toEqual(["paragraph:Email me at jane@gmail.com"]);
  });

  it("a slash right after a space still opens the menu", async () => {
    const h = await renderEditor();
    h.typeText("see /he");
    await flushFrames();
    expect(slashMenu()).toBeInTheDocument();
  });

  it("an @ right after a space still opens the page picker", async () => {
    const h = await renderEditor({ pages: withOthers });
    h.typeText("mail @al");
    await flushFrames();
    expect(optionNames()).toEqual(["Alpha"]);
  });

  it.each(["line1", "line1 "])(
    "a slash after %j and a soft line break does not open the menu",
    async (before) => {
      const h = await renderEditor();
      h.typeText(before);
      act(() => {
        h.editor.commands.setHardBreak();
      });
      h.typeText("/he");
      await flushFrames();
      expect(slashMenu()).not.toBeInTheDocument();
    },
  );

  it("an open menu closes when a soft line break follows its token", async () => {
    const h = await renderEditor();
    h.typeText("/he");
    await flushFrames();
    expect(slashMenu()).toBeInTheDocument();

    act(() => {
      h.editor.commands.setHardBreak();
    });
    await flushFrames();

    expect(slashMenu()).not.toBeInTheDocument();
  });
});

describe("Editor slash commands emit the matching block type", () => {
  it.each([
    ["/para", 0, "paragraph"],
    ["/head", 0, "heading"],
    ["/head", 1, "heading2"],
    ["/quote", 0, "blockquote"],
    ["/code", 0, "codeBlock"],
    ["/bullet", 0, "bulletList"],
    ["/numbered", 0, "orderedList"],
    ["/div", 0, "horizontalRule"],
  ])("%s (item %i) leaves the first block as %s", async (typed, downs, expectedType) => {
    const h = await renderEditor();
    h.typeText(typed);
    await flushFrames();
    for (let i = 0; i < downs; i++) h.pressKey("ArrowDown");

    h.pressKey("Enter");

    // Asserted right after the key press, before any timer runs: the type must not depend on timing.
    const blocks = h.onBlocksChange.mock.calls.at(-1)?.[0];
    expect(blocks?.[0].type).toBe(expectedType);
    await wait(80);
    expect(slashMenu()).not.toBeInTheDocument();
  });
});

describe("Editor persisted blocks match the document", () => {
  // Regression: a guard that ran for 1.5s after a slash command trimmed the SAVED blocks when two
  // empty paragraphs followed the command's row, while the editor kept showing both, so the saved
  // page lost a paragraph on reload.
  it("persists every block the editor shows when Enter is pressed twice right after a command", async () => {
    const h = await renderEditor();
    h.typeText("/head");
    await flushFrames();
    h.pressKey("Enter");
    await wait(80);

    act(() => {
      h.editor.commands.splitBlock();
      h.editor.commands.splitBlock();
    });

    expect(h.topLevel()).toEqual(["heading:", "paragraph:", "paragraph:"]);
    const blocks = h.onBlocksChange.mock.calls.at(-1)?.[0];
    expect(blocks?.map((b) => b.type)).toEqual(["heading", "paragraph", "paragraph"]);
  });
});

describe("Editor slash commands persisted shape", () => {
  it("Divider persists a horizontal rule followed by an empty paragraph", async () => {
    const h = await renderEditor();
    h.typeText("/div");
    await flushFrames();
    h.pressKey("Enter");
    await wait(80);

    const blocks = h.onBlocksChange.mock.calls.at(-1)?.[0];
    expect(blocks?.map((b) => b.type)).toEqual(["horizontalRule", "paragraph"]);
  });
});

describe("Editor @ page picker", () => {
  it("never opens when the workspace has no other pages", async () => {
    const h = await renderEditor({ pages: [pageFixture("current", "Current")] });
    h.typeText("@");
    await flushFrames();
    expect(pagePicker()).not.toBeInTheDocument();
  });

  it("opens on '@' listing other pages alphabetically, excluding the current one", async () => {
    const h = await renderEditor({
      pages: [
        pageFixture("current", "Current"),
        pageFixture("p-b", "Beta"),
        pageFixture("p-a", "Alpha"),
      ],
    });
    h.typeText("@");
    await flushFrames();

    expect(pagePicker()).toBeInTheDocument();
    expect(optionNames()).toEqual(["Alpha", "Beta"]);
  });

  it("filters pages by the text typed after '@'", async () => {
    const h = await renderEditor({ pages: withOthers });
    h.typeText("@al");
    await flushFrames();
    expect(optionNames()).toEqual(["Alpha"]);
  });

  it("moves the selection with the arrow keys and wraps", async () => {
    const h = await renderEditor({ pages: withOthers });
    h.typeText("@");
    await flushFrames();
    expect(selectedIndex()).toBe(0);

    h.pressKey("ArrowDown");
    expect(selectedIndex()).toBe(1);
    h.pressKey("ArrowDown");
    expect(selectedIndex()).toBe(0);
    h.pressKey("ArrowUp");
    expect(selectedIndex()).toBe(1);
  });

  it("Enter replaces the token with a wiki link to the selected page and closes the picker", async () => {
    const h = await renderEditor({ pages: withOthers });
    h.typeText("@al");
    await flushFrames();

    const enter = h.pressKey("Enter");
    await flushFrames();

    expect(enter.defaultPrevented).toBe(true);
    expect(h.topLevel()).toEqual(["paragraph:Alpha"]);
    const text = h.editor.getJSON().content?.[0].content?.[0] as
      { text?: string; marks?: unknown[] } | undefined;
    expect(text?.text).toBe("Alpha");
    expect(text?.marks?.[0]).toMatchObject({ type: "wikiLink", attrs: { pageId: "p-alpha" } });
    expect(pagePicker()).not.toBeInTheDocument();
  });

  it("closes on Escape and keeps the typed '@…' text", async () => {
    const h = await renderEditor({ pages: withOthers });
    h.typeText("@al");
    await flushFrames();

    h.pressKey("Escape");

    expect(pagePicker()).not.toBeInTheDocument();
    expect(h.topLevel()).toEqual(["paragraph:@al"]);
  });

  it("stays closed after Escape while the same @ token is edited", async () => {
    const h = await renderEditor({ pages: withOthers });
    h.typeText("@al");
    await flushFrames();
    h.pressKey("Escape");

    h.typeText("p");
    await flushFrames();

    expect(pagePicker()).not.toBeInTheDocument();
    expect(h.topLevel()).toEqual(["paragraph:@alp"]);
  });

  it("closes the picker on Enter when no page matches and lets Enter make a new line", async () => {
    const h = await renderEditor({ pages: withOthers });
    h.typeText("@zzz");
    await flushFrames();
    expect(screen.getByText("No matching pages")).toBeInTheDocument();

    h.pressKeyInEditor("Enter", 13);
    await flushFrames();

    expect(pagePicker()).not.toBeInTheDocument();
    expect(h.topLevel()).toEqual(["paragraph:@zzz", "paragraph:"]);
  });

  it("closes the picker by itself four characters past the last match", async () => {
    const h = await renderEditor({ pages: withOthers });
    h.typeText("@alxyz");
    await flushFrames();
    expect(pagePicker()).toBeInTheDocument();
    expect(screen.getByText("No matching pages")).toBeInTheDocument();

    h.typeText("w");
    await flushFrames();

    expect(pagePicker()).not.toBeInTheDocument();
    expect(h.topLevel()).toEqual(["paragraph:@alxyzw"]);
  });

  it("closes on pointerdown outside the picker and keeps the typed '@…' text", async () => {
    const h = await renderEditor({ pages: withOthers });
    h.typeText("@al");
    await flushFrames();

    pointerDown(document.body);

    expect(pagePicker()).not.toBeInTheDocument();
    expect(h.topLevel()).toEqual(["paragraph:@al"]);
  });

  it("an @ typed right after a slash is not a trigger: the picker stays closed and the slash menu keeps its text", async () => {
    const h = await renderEditor({ pages: withOthers });
    h.typeText("/");
    await flushFrames();
    expect(slashMenu()).toBeInTheDocument();

    h.typeText("@");
    await flushFrames();

    expect(pagePicker()).not.toBeInTheDocument();
    expect(slashMenu()).toBeInTheDocument();
    expect(h.topLevel()).toEqual(["paragraph:/@"]);
  });
});

describe("Editor linked-database picker", () => {
  const openPicker = async (databases = [databaseFixture("db1", "Tasks")]) => {
    const h = await renderEditor({ databases });
    h.typeText("/linked");
    await flushFrames();
    h.pressKey("Enter");
    await flushFrames();
    return h;
  };

  it("lists the workspace databases", async () => {
    await openPicker([databaseFixture("db1", "Tasks"), databaseFixture("db2", "Notes")]);
    expect(optionNames()).toEqual(["Tasks", "Notes"]);
  });

  it("Enter replaces the slash row with a database embed and closes the picker", async () => {
    const h = await openPicker();
    const enter = h.pressKey("Enter");
    await flushFrames();

    expect(enter.defaultPrevented).toBe(true);
    expect(h.topLevel()).toEqual(["musingDatabaseEmbed:"]);
    expect(databasePicker()).not.toBeInTheDocument();
    const embed = h.onBlocksChange.mock.calls.at(-1)?.[0][0];
    expect(embed?.type).toBe("databaseEmbed");
    expect(JSON.parse(embed?.content ?? "{}")).toMatchObject({ databaseId: "db1" });
  });

  it("existing behavior: choosing a database replaces the whole row, including any other text in it", async () => {
    const h = await renderEditor({
      blocks: [paragraphBlock("b1", "Keep? ")],
      databases: [databaseFixture("db1", "Tasks")],
    });
    h.typeText("/linked");
    await flushFrames();
    h.pressKey("Enter");
    await flushFrames();
    expect(h.topLevel()).toEqual(["paragraph:Keep? "]);

    h.pressKey("Enter");
    await flushFrames();

    expect(h.topLevel()).toEqual(["musingDatabaseEmbed:"]);
  });

  it("does not touch another row when the row the picker was opened from is gone", async () => {
    const h = await renderEditor({
      blocks: [paragraphBlock("b1", "keep"), paragraphBlock("b2")],
      databases: [databaseFixture("db1", "Tasks")],
    });
    h.typeText("/linked");
    await flushFrames();
    h.pressKey("Enter");
    await flushFrames();
    expect(databasePicker()).toBeInTheDocument();

    // Replace the row with a different block at the same position, then choose a database.
    act(() => {
      h.editor.commands.deleteRange({ from: 6, to: 8 });
      h.editor.commands.insertContentAt(6, '<p data-block-id="other">x</p>');
    });
    h.pressKey("Enter");
    await flushFrames();

    expect(h.topLevel()).toEqual(["paragraph:keep", "paragraph:x"]);
    expect(databasePicker()).not.toBeInTheDocument();
  });

  it("still replaces the right row when text above it changed while the picker was open", async () => {
    const h = await renderEditor({
      blocks: [paragraphBlock("b1", "keep"), paragraphBlock("b2")],
      databases: [databaseFixture("db1", "Tasks")],
    });
    h.typeText("/linked");
    await flushFrames();
    h.pressKey("Enter");
    await flushFrames();
    expect(databasePicker()).toBeInTheDocument();

    // Insert text in the first row, which shifts the second row's position.
    act(() => {
      h.editor.commands.insertContentAt(1, "more ");
    });
    h.pressKey("Enter");
    await flushFrames();

    expect(h.topLevel()).toEqual(["paragraph:more keep", "musingDatabaseEmbed:"]);
  });

  it("anchors the row on where the slash token was, not on the current selection", async () => {
    const h = await renderEditor({
      blocks: [paragraphBlock("b1", "keep"), paragraphBlock("b2")],
      databases: [databaseFixture("db1", "Tasks")],
    });
    h.typeText("/linked");
    await flushFrames();
    // Move the caret to the first row without letting the menu refresh, then run the command.
    act(() => {
      h.editor.commands.setTextSelection(2);
    });
    const option = screen.getByRole("option", { name: "Linked database" });
    act(() => {
      option.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 }),
      );
    });
    await flushFrames();
    expect(databasePicker()).toBeInTheDocument();

    h.pressKey("Enter");
    await flushFrames();

    expect(h.topLevel()[0]).toBe("paragraph:keep");
    expect(h.topLevel()).toContain("musingDatabaseEmbed:");
  });

  it("moves the selection with the arrow keys before choosing", async () => {
    const h = await openPicker([databaseFixture("db1", "Tasks"), databaseFixture("db2", "Notes")]);
    h.pressKey("ArrowDown");
    expect(selectedIndex()).toBe(1);

    h.pressKey("Enter");
    await flushFrames();

    const embed = h.onBlocksChange.mock.calls.at(-1)?.[0][0];
    expect(JSON.parse(embed?.content ?? "{}")).toMatchObject({ databaseId: "db2" });
  });

  it("closes on Escape without changing the document", async () => {
    const h = await openPicker();
    h.pressKey("Escape");

    expect(databasePicker()).not.toBeInTheDocument();
    expect(h.topLevel()).toEqual(["paragraph:"]);
  });

  it("closes on pointerdown outside the picker", async () => {
    await openPicker();
    pointerDown(screen.getByRole("listbox", { name: "Databases" }));
    expect(databasePicker()).toBeInTheDocument();

    pointerDown(document.body);
    expect(databasePicker()).not.toBeInTheDocument();
  });

  it("existing behavior: with no databases the picker opens but its keyboard handler is inert", async () => {
    const h = await openPicker([]);
    expect(databasePicker()).toBeInTheDocument();

    const enter = h.pressKey("Enter");

    expect(enter.defaultPrevented).toBe(false);
    expect(databasePicker()).toBeInTheDocument();
  });
});

describe("Editor document sync", () => {
  it("emits serialized blocks, keeping the block id, when the user types", async () => {
    const h = await renderEditor({ blocks: [paragraphBlock("b1")] });
    h.typeText("hello");

    const blocks = h.onBlocksChange.mock.calls.at(-1)?.[0];
    expect(blocks).toHaveLength(1);
    expect(blocks?.[0]).toMatchObject({ id: "b1", type: "paragraph" });
    expect(blocks?.[0].content).toContain("hello");
  });

  it("Backspace in an empty row removes that row when the page has other blocks", async () => {
    const h = await renderEditor({
      blocks: [paragraphBlock("b1", "a"), paragraphBlock("b2")],
    });
    h.setCaret(4);

    const key = h.pressKeyInEditor("Backspace", 8);

    expect(key.defaultPrevented).toBe(true);
    expect(h.topLevel()).toEqual(["paragraph:a"]);
  });

  it("Backspace in the only (empty) row keeps that row", async () => {
    const h = await renderEditor({ blocks: [paragraphBlock("b1")] });
    h.pressKeyInEditor("Backspace", 8);

    expect(h.topLevel()).toEqual(["paragraph:"]);
  });

  // Regression: `Editor` used to hand `PageDocumentEditor` the new revision in the same render in
  // which its `localBlocks` state still held the OLD blocks, so the editor re-seeded from stale
  // content and never re-ran (one update behind). It now passes a revision bumped together with
  // `localBlocks`.
  it("re-seeds the document from the new blocks when the external revision changes", async () => {
    const h = await renderEditor({ blocks: [paragraphBlock("b1", "one")] });
    expect(h.topLevel()).toEqual(["paragraph:one"]);

    h.rerender({ blocks: [paragraphBlock("b1", "two")], externalWorkspaceRevision: 1 });
    await flushFrames();

    expect(h.topLevel()).toEqual(["paragraph:two"]);
  });

  it("ends on the latest content after several external updates in a row", async () => {
    const h = await renderEditor({ blocks: [paragraphBlock("b1", "a")] });

    h.rerender({ blocks: [paragraphBlock("b1", "ab")], externalWorkspaceRevision: 1 });
    await flushFrames();
    h.rerender({ blocks: [paragraphBlock("b1", "abc")], externalWorkspaceRevision: 2 });
    await flushFrames();

    expect(h.topLevel()).toEqual(["paragraph:abc"]);
  });

  it("does not echo an external update back to the workspace as a local edit", async () => {
    const h = await renderEditor({ blocks: [paragraphBlock("b1", "one")] });
    h.onBlocksChange.mockClear();

    h.rerender({ blocks: [paragraphBlock("b1", "two")], externalWorkspaceRevision: 1 });
    await flushFrames();

    expect(h.onBlocksChange).not.toHaveBeenCalled();
  });
});
