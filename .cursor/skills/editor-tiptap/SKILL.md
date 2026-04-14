---
name: editor-tiptap
description: >-
  TipTap/ProseMirror conventions for musing’s block editor, slash menu, wiki links,
  and Vite PM aliases. Use when editing or adding tiptap, prosemirror, extensions,
  Block.tsx, Editor.tsx, PageDocumentEditor.tsx, SlashMenu, PagePickerMenu, wiki links,
  slash commands, page document serialization, or block types in src/extensions or
  lib/blockEditorCommands.
---

# Editor / TipTap (musing)

## Mental model

- **App-level blocks** are `Block[]` on each `Page` (`types/block.ts`): `id`, `type`, `content` (string).
- **One TipTap document per page** (`PageDocumentEditor.tsx`): `useEditor` + `EditorContent` for the whole page so **selection can span blocks**. Top-level doc nodes carry **`data-block-id`** (`blockIdOnBlocks`, `ensureTopLevelBlockIds`).
- **Parent orchestration** (`Editor.tsx`): slash menu, `@` page picker, database picker, focus and keyboard flow; uses **`blockIdAtSelection`** / **`findBlockPositionById`** to target the active block inside the shared doc.
- **Serialization**: `lib/pageDocument/blocksToDocHtml.ts` (blocks → HTML for `setContent`) and `serializeDocToBlocks.ts` (doc → `Block[]`). Changing schema or marks affects stored data.

## Where things live

| Area | Location |
|------|----------|
| Single-doc editor, StarterKit, WikiLink, DB embed | `components/PageDocumentEditor.tsx` |
| Page chrome, menus, workspace wiring | `components/Editor.tsx` |
| Block-level attrs (`data-block-id`) | `extensions/blockIdOnBlocks.ts`, `ensureTopLevelBlockIds.ts` |
| Wiki link mark (`[[...]]`, `data-wiki-page-id`) | `extensions/wikiLink.ts` |
| Slash menu items / block types | `lib/slashMenuOptions.ts` |
| Applying block type to editor HTML | `lib/blockEditorCommands.ts` |
| Doc ↔ blocks | `lib/pageDocument/blocksToDocHtml.ts`, `serializeDocToBlocks.ts`, `blockIdAtSelection.ts` |
| Floating text format bubble | `components/EditorTextFormatBubble.tsx`, `lib/editorBubbleMenuPortal.ts` |

`Block.tsx` may remain for legacy or tests; **page editing** goes through `PageDocumentEditor`.

## Vite and `@tiptap/pm/*`

Imports like `@tiptap/pm/state` **must** resolve via **`vite.config.ts`** aliases to `prosemirror-*`. If the build fails on a new PM subpath, **add the matching alias** — do not “fix” by removing the map or switching bundler assumptions.

## Patterns to preserve

- **WikiLink** uses **`getPages` from a ref** (`pagesBox`) so the extension stays stable while input rules see current pages (`PageDocumentEditor.tsx`). ESLint may need a **targeted `react-hooks/refs` disable** on `WikiLink.configure` — `getPages` runs from ProseMirror, not during React render.
- **Wiki link `href`** uses **`import.meta.env.BASE_URL`** so links work on GitHub Pages subpaths (`extensions/wikiLink.ts`).
- **Slash / `@` detection** uses **`textBeforeCursorInBlock`** — keep behavior aligned with `Editor.tsx` menu state.
- New **block types**: extend `BlockType` and `slashMenuOptions`, implement command behavior in **`blockEditorCommands`** / serialization, and ensure **`workspaceStorage` / snapshot** still round-trips.
- **External workspace sync**: `setContent(blocksToDocHtml(...), { emitUpdate: false })` when replacing from outside so TipTap does not double-emit updates.

## Do not break

- **Selection and focus** in a single doc — test Enter, Backspace, slash commands, and cross-block selection.
- **Serialization**: `content` is stored as used by TipTap HTML pipeline; changing schema or marks affects existing data.
- **StarterKit + custom blocks**: database embeds and special types follow `serializeDocToBlocks` / `blocksToDocHtml`.

## Tests

Vitest + Testing Library: `src/**/*.test.{ts,tsx}`, setup `src/test/setup.ts`. Prefer extending existing editor/menu tests when changing behavior.
