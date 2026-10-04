import { act, render, waitFor } from "@testing-library/react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";
import Editor from "../components/Editor";
import { WorkspaceContext, type WorkspaceContextValue } from "../context/workspace-context";
import type { Block } from "../types/block";
import type { WorkspaceDatabase } from "../types/database";
import type { Page } from "../types/page";

/**
 * jsdom has no layout engine. ProseMirror's `coordsAtPos` (used to position the floating menus)
 * and scroll-into-view need a few geometry APIs that jsdom lacks, so stub them with zero rects.
 * Returns a function that restores the originals.
 */
export function installLayoutStubs(): () => void {
  const zeroRect = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
  } as DOMRect;
  const emptyRects = { length: 0, item: () => null } as unknown as DOMRectList;

  const saved: Array<[object, string, PropertyDescriptor | undefined]> = [];
  const patch = (target: object, key: string, value: unknown) => {
    saved.push([target, key, Object.getOwnPropertyDescriptor(target, key)]);
    Object.defineProperty(target, key, { value, configurable: true, writable: true });
  };

  patch(Range.prototype, "getClientRects", () => emptyRects);
  patch(Range.prototype, "getBoundingClientRect", () => zeroRect);
  patch(Element.prototype, "scrollIntoView", () => {});

  return () => {
    for (const [target, key, descriptor] of saved.reverse()) {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else Reflect.deleteProperty(target, key);
    }
  };
}

export const paragraphBlock = (id: string, text = ""): Block => ({
  id,
  type: "paragraph",
  content: text ? `<p>${text}</p>` : "<p></p>",
});

export const pageFixture = (id: string, title: string, overrides: Partial<Page> = {}): Page => ({
  id,
  title,
  parentId: null,
  order: 0,
  updatedAt: "2020-01-01T00:00:00.000Z",
  layout: "document",
  databaseId: null,
  blocks: [paragraphBlock(`${id}-b1`)],
  ...overrides,
});

export const databaseFixture = (id: string, title: string): WorkspaceDatabase => ({
  id,
  title,
  properties: [{ id: `${id}-title`, name: "Name", type: "title" }],
  rows: [],
  views: [{ id: `${id}-view`, name: "Table", type: "table" }],
});

type RenderOptions = {
  pageId?: string;
  blocks?: Block[];
  /** Workspace pages. Include the current page; "other pages" are those with a different id. */
  pages?: Page[];
  databases?: WorkspaceDatabase[];
  externalWorkspaceRevision?: number;
};

function workspaceValue(
  pages: Page[],
  databases: WorkspaceDatabase[],
  externalWorkspaceRevision: number,
): WorkspaceContextValue {
  return {
    pages,
    databases,
    homePageId: pages[0]?.id ?? "",
    lastOpenedPageId: null,
    externalWorkspaceRevision,
    remoteSyncStatus: "disabled",
    remoteSyncError: null,
    getPage: (id) => pages.find((p) => p.id === id),
    getDatabase: (id) => databases.find((d) => d.id === id),
    setLastOpenedPageId: vi.fn(),
    resolveOpenPageId: () => pages[0]?.id ?? "",
    updatePageTitle: vi.fn(),
    updatePageBlocks: vi.fn(),
    updateDatabase: vi.fn(),
    createPage: vi.fn(() => ""),
    createDatabasePage: vi.fn(() => ""),
    deletePageSubtree: vi.fn(() => ({ removedIds: new Set<string>(), fallbackPageId: null })),
    movePageWithinSiblings: vi.fn(),
    ancestryFor: () => [],
    childrenOf: () => [],
  };
}

/** Lets pending `requestAnimationFrame` callbacks (the menus' open detection) run inside `act`. */
export async function flushFrames(count = 2): Promise<void> {
  for (let i = 0; i < count; i++) {
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
  }
}

/** Waits real time inside `act` (e.g. for the 48ms `setEditable(true)` restore after a slash command). */
export async function wait(ms: number): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  });
}

export type EditorHarness = {
  editor: TiptapEditor;
  onBlocksChange: ReturnType<typeof vi.fn<(blocks: Block[]) => void>>;
  rerender: (next: RenderOptions) => void;
  /** Appends text at the end of the document through the editor (fires update + selection events). */
  typeText: (text: string) => void;
  /** Inserts text at the current caret (unlike `typeText`, which always appends at the end). */
  typeAtCaret: (text: string) => void;
  /** Places the caret at a document position. */
  setCaret: (pos: number) => void;
  /** Dispatches a keydown on `window`, where the menus' capture-phase handlers listen. */
  pressKey: (key: string, init?: KeyboardEventInit) => KeyboardEvent;
  /** Dispatches a keydown on the ProseMirror element, so the editor's own key handling runs. */
  pressKeyInEditor: (key: string, keyCode: number) => KeyboardEvent;
  /** Top-level doc node summaries, e.g. `["heading:Title", "paragraph:body"]`. */
  topLevel: () => string[];
};

export async function renderEditor(options: RenderOptions = {}): Promise<EditorHarness> {
  const onBlocksChange = vi.fn<(blocks: Block[]) => void>();
  const tree = (opts: RenderOptions) => {
    const pageId = opts.pageId ?? "current";
    const pages = opts.pages ?? [pageFixture(pageId, "Current")];
    const databases = opts.databases ?? [];
    const revision = opts.externalWorkspaceRevision ?? 0;
    return (
      <MemoryRouter>
        <WorkspaceContext.Provider value={workspaceValue(pages, databases, revision)}>
          <Editor
            pageId={pageId}
            blocks={opts.blocks ?? [paragraphBlock("b1")]}
            externalWorkspaceRevision={revision}
            onBlocksChange={onBlocksChange}
          />
        </WorkspaceContext.Provider>
      </MemoryRouter>
    );
  };

  const view = render(tree(options));
  const dom = await waitFor(() => {
    const el = document.querySelector<HTMLElement & { editor?: TiptapEditor }>(".ProseMirror");
    if (!el?.editor) throw new Error("editor not mounted yet");
    return el;
  });
  const editor = dom.editor as TiptapEditor;

  return {
    editor,
    onBlocksChange,
    rerender: (next) => view.rerender(tree({ ...options, ...next })),
    typeText: (text) => {
      act(() => {
        editor.chain().focus("end").insertContent(text).run();
      });
    },
    typeAtCaret: (text) => {
      act(() => {
        editor.chain().focus().insertContent(text).run();
      });
    },
    setCaret: (pos) => {
      act(() => {
        editor.commands.setTextSelection(pos);
      });
    },
    pressKey: (key, init = {}) => {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
      act(() => {
        window.dispatchEvent(event);
      });
      return event;
    },
    pressKeyInEditor: (key, keyCode) => {
      const event = new KeyboardEvent("keydown", {
        key,
        keyCode,
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        editor.view.dom.dispatchEvent(event);
      });
      return event;
    },
    topLevel: () => {
      const out: string[] = [];
      editor.state.doc.forEach((node) => out.push(`${node.type.name}:${node.textContent}`));
      return out;
    },
  };
}
