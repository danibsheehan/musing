# CLAUDE.md

@AGENTS.md

The above is the canonical, tool-agnostic reference (install/configure/run/test, conventions,
constraints, definition of done) — also read by Cursor and any other agent. Everything below
is Claude Code–specific session mechanics.

## Skills

`.claude/skills` is the canonical skills directory — add new skills here. `.cursor/skills` is
a symlink to it, kept only for compatibility with the legacy Cursor rules/skills setup. Claude
Code auto-discovers and invokes them by task: `editor-tiptap`, `supabase-sync`,
`musing-vitest-tests`, `doc-writer`, `pr-ready`, `ai-service`.
