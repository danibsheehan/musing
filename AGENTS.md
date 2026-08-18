# AGENTS.md

Instructions for any coding agent (Cursor, Claude Code, or otherwise) working in this repo.
Human contributors: see [`README.md`](README.md) instead — this file is written for agents
and skips the narrative tour.

**musing** is a single-page React app for Notion-style block editing: pages, wiki-style
links, and lightweight database embeds. Data lives in `localStorage` by default; an optional
Supabase project adds cloud sync via anonymous sign-in and a JSON workspace snapshot.

## Install

```bash
npm install
```

## Configure

Nothing is required for local dev — the app runs entirely offline against `localStorage`
with no env vars set. For optional Supabase sync:

```bash
cp .env.example .env.local   # repo root, next to package.json — Vite does not load src/ env
```

Then set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (see `.env.example` and the
`supabase-sync` skill below). `VITE_BASE_PATH` is only for simulating a non-root GitHub
Pages base path locally.

## Run

```bash
npm run dev         # Vite dev server
npm run dev:clean   # same, with NODE_OPTIONS unset for this run
npm run preview     # serve the production build locally
```

## Test / CI parity

```bash
python3 .github/scripts/check_stack_docs.py   # README / musing-project.mdc version drift
npm audit --audit-level=high
npm run lint
npm run format:check
npm run test:coverage   # Vitest + v8 coverage; fails below thresholds in vite.config.ts
npm run build
```

This is the same sequence `.github/workflows/ci.yml` runs on push to `main` and on pull
requests. `npm run test` / `npm run test:run` run Vitest without coverage; use those while
iterating on a single suite. See the **`pr-ready`** skill below for the full pre-PR checklist.

## Conventions

Detailed, path-scoped conventions live in `.cursor/rules/*.mdc` and are read automatically by
Claude Code via [`CLAUDE.md`](CLAUDE.md); Cursor reads them natively. Do not restate them here
— this section is the map, not the content:

| Area                                                                                | Rule                                              |
| ----------------------------------------------------------------------------------- | ------------------------------------------------- |
| Stack, `src/` layout, Vite/TipTap aliases, `BASE_URL`, Supabase env, agent done bar | `.cursor/rules/musing-project.mdc` (always-apply) |
| TipTap editor, slash menu, wiki links                                               | `.cursor/rules/editor-tiptap.mdc`                 |
| Vitest / Testing Library conventions                                                | `.cursor/rules/frontend-testing.mdc`              |
| Workspace storage and optional Supabase sync                                        | `.cursor/rules/workspace-supabase.mdc`            |
| README accuracy                                                                     | `.cursor/rules/readme.mdc`                        |

Step-by-step playbooks (both `.cursor/skills/*/SKILL.md` and `.claude/skills/` — same files,
symlinked, auto-invoked by either tool based on the task):

- `editor-tiptap` — TipTap/ProseMirror doc model, slash and wiki-link menus, `vite.config.ts`
  PM aliases.
- `workspace-supabase` reference / `supabase-sync` skill — anonymous auth, workspace JSON
  snapshot, RLS, env.
- `musing-vitest-tests` — Vitest / Testing Library conventions and fakes for this repo.
- `doc-writer` — README, JSDoc, and inline documentation.
- `pr-ready` — local CI-parity checks and PR template before opening a PR.

## Constraints — do not

- **Import from `react-router-dom`.** This repo uses `react-router` directly (React Router 8).
- **Assume the app is hosted at `/`.** Any app URL (wiki links, exports) must go through
  `BASE_URL` (`import.meta.env.BASE_URL`), not a hardcoded root path — see
  `musing-project.mdc`.
- **Add a `@tiptap/pm/*` import without checking `vite.config.ts`'s `resolve.alias` map.**
  Rolldown (Vite 8) doesn't resolve those subpaths on its own; new ProseMirror subpaths need
  a matching `prosemirror-*` alias.
- **Assume Supabase is configured.** With no env vars set, the app is `localStorage`-only —
  don't add code paths that require a DB.
- **Bump React, Vite, TypeScript, or React Router without updating the docs in the same
  change** — `check_stack_docs.py` checks README / `musing-project.mdc` drift but does not
  fix it.
- **Commit secrets** (`.env.local`, credentials) or amend/force-push without being explicitly
  asked.
- **Open, push, or merge a PR unless the user asks.**

## Definition of done

- **Task done**: follow the scoped rule/skill for files touched; run the smallest relevant
  check (`npm run test:run` for touched suites, `npm run lint` if ESLint-relevant). Full
  coverage CI is not required for every small edit.
- **PR done**: run the checks under Test / CI parity above, then follow the `pr-ready` skill
  (PR template filled, no secrets). Commit, push, or open a PR only when the user asks.
