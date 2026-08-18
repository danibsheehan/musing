# CLAUDE.md

@AGENTS.md

The above is the canonical, tool-agnostic reference (install/configure/run/test, conventions,
constraints, definition of done) — also read by Cursor and any other agent. Everything below
is Claude Code–specific session mechanics.

## Always-apply rule

@.cursor/rules/musing-project.mdc

This is this repo's always-apply context — stack, `src/` layout, Vite/TipTap aliases,
`BASE_URL`, and Supabase env. Cursor reads it natively; the `@`-import above is how Claude
Code loads the same file.

## Scoped rules — read the file when touching its paths

Cursor applies these automatically via each file's `globs:` frontmatter. Claude Code has
no equivalent auto-attach, so read the file yourself before editing matching paths.

| Rule | Applies to |
|---|---|
| `.cursor/rules/editor-tiptap.mdc` | `src/components/{PageDocumentEditor,Editor,EditorTextFormatBubble,SlashMenu,PagePickerMenu,Block}.tsx`, `src/extensions/**/*`, `src/lib/pageDocument/**/*`, `src/lib/blockEditorCommands.ts`, `src/lib/slashMenuOptions.ts`, `vite.config.ts` |
| `.cursor/rules/frontend-testing.mdc` | `src/**/*.{test,spec}.{ts,tsx}`, `src/test/**/*`, `vite.config.ts` |
| `.cursor/rules/workspace-supabase.mdc` | `src/context/**/*`, `src/lib/workspaceStorage.ts`, `src/lib/supabaseClient.ts`, `src/lib/supabaseWorkspace.ts`, `src/types/page.ts`, `supabase/schema.sql`, `.env.example` |
| `.cursor/rules/readme.mdc` | `README.md`, `supabase/schema.sql`, `.env.example`, `.github/workflows/**` |

## Skills

`.claude/skills` is a directory symlink to `.cursor/skills` — same `SKILL.md` files, no
copies. Claude Code auto-discovers and invokes them by task the same way Cursor does:
`editor-tiptap`, `supabase-sync`, `musing-vitest-tests`, `doc-writer`, `pr-ready`.
