---
name: editor-tiptap
description: >-
  TipTap/ProseMirror conventions for musing’s block editor, slash menu, wiki links,
  and Vite PM aliases. Use when editing or adding tiptap, prosemirror, extensions,
  Block.tsx, Editor.tsx, SlashMenu, PagePickerMenu, wiki links, slash commands, or
  block types in src/extensions or lib/blockEditorCommands.
---

# Editor / TipTap (musing)

## Mental model

- **App-level blocks** are `Block[]` on each `Page` (`types/block.ts`): `id`, `type`, `content` (string).
- **Each visible text block** gets its **own** TipTap editor in `Block.tsx` (`useEditor` + `EditorContent`), not one doc for the whole page.
- **Parent orchestration** (`Editor.tsx`): block list, drag-and-drop, slash menu, `@` page picker, database picker, focus and keyboard flow between blocks.

## Where things live

| Area | Location |
|------|----------|
| Per-block editor, StarterKit, WikiLink | `components/Block.tsx` |
| Multi-block UI, menus, DnD | `components/Editor.tsx` |
| Wiki link mark (`[[...]]`, `data-wiki-page-id`) | `extensions/wikiLink.ts` |
| Slash menu items / block types | `lib/slashMenuOptions.ts` |
| Applying block type to editor HTML | `lib/blockEditorCommands.ts` |
| Cursor-in-block helpers | `lib/editorBlockText.ts` |
| Floating text format bubble | `components/EditorTextFormatBubble.tsx`, `lib/editorBubbleMenuPortal.ts` |

## Vite and `@tiptap/pm/*`

Imports like `@tiptap/pm/state` **must** resolve via **`vite.config.ts`** aliases to `prosemirror-*`. If the build fails on a new PM subpath, **add the matching alias** — do not “fix” by removing the map or switching bundler assumptions.

## Patterns to preserve

- **WikiLink** is configured with **`getPages` from a ref** (`pagesBox`) so TipTap input rules see current pages without recreating the extension every render (`Block.tsx`).
- **Wiki link `href`** uses **`import.meta.env.BASE_URL`** so links work on GitHub Pages subpaths (`extensions/wikiLink.ts`).
- **Slash / `@` detection** uses **`textBeforeCursorInBlock`** — keep behavior aligned with `Editor.tsx` menu state.
- New **block types**: extend `BlockType` and `slashMenuOptions`, implement command behavior in **`blockEditorCommands`** / **`Block.tsx`** (and any new embed component), and ensure **`workspaceStorage` / snapshot** still round-trips.

## Do not break

- **Selection and focus** across blocks — test Enter, Backspace, and focus when changing keyboard handlers.
- **Serialization**: `content` is stored as used by TipTap HTML pipeline; changing schema or marks affects existing data.
- **StarterKit + custom blocks**: database embeds and special types may bypass or wrap the default node — follow existing `Block.tsx` branches.

## Tests

Vitest + Testing Library: `src/**/*.test.{ts,tsx}`, setup `src/test/setup.ts`. Prefer extending existing editor/menu tests when changing behavior.
