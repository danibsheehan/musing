# AGENTS.md

Instructions for any coding agent (Cursor, Claude Code, or otherwise) working in this repo.
Human contributors: see [`README.md`](README.md) instead — this file is written for agents
and skips the narrative tour.

**musing** is a single-page React app for Notion-style block editing: pages, wiki-style
links, and lightweight database embeds. Data lives in `localStorage` by default; an optional
Supabase project adds cloud sync via anonymous sign-in and a JSON workspace snapshot. A
second optional layer, `service/` (`musing-ai-service`), adds AI features — semantic search,
summarization, related pages — as a separately-deployed Node/TypeScript backend the frontend
calls cross-origin; see the `ai-service` skill and the README's "Deploy musing-ai-service"
section.

## Stack

Vite 8, React 19, TypeScript, React Router 8 (`react-router` — do not use
`react-router-dom`); TipTap 3 (one document per page via `PageDocumentEditor`). Optional
Supabase.

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
Pages base path locally. `VITE_AI_SERVICE_URL` additionally enables the AI features (also
requires Supabase); see the `ai-service` skill for `service/`'s own setup.

## Run

```bash
npm run dev         # Vite dev server
npm run dev:clean   # same, with NODE_OPTIONS unset for this run
npm run preview     # serve the production build locally
```

## Test / CI parity

```bash
python3 .github/scripts/check_stack_docs.py   # README / AGENTS.md version drift
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

Conventions for this repo, organized by area. Read automatically by Claude Code via
[`CLAUDE.md`](CLAUDE.md); Cursor reads this file natively too.

### Layout

`src/`: routes (`main.tsx`, `App.tsx` — import routing APIs from `react-router`); workspace
(`context/WorkspaceContext.tsx`, `useWorkspace.ts`, `lib/workspaceStorage.ts`); editor
(`Editor.tsx`, `PageDocumentEditor.tsx`, `SlashMenu.tsx`, `PagePickerMenu.tsx`); extensions
(`extensions/`, e.g. `wikiLink.ts`); slash/commands (`lib/slashMenuOptions.ts`,
`lib/blockEditorCommands.ts`); types (`types/block.ts`, `types/page.ts`); Supabase
(`lib/supabaseClient.ts`, `lib/supabaseWorkspace.ts` — not the `supabase/` SQL folder).

### Editor (TipTap)

Follow the `editor-tiptap` skill for the full doc model, slash menu, and wiki-link patterns.
Vite's `@tiptap/pm/*` subpaths must resolve via the `resolve.alias` map in `vite.config.ts` —
add a matching `prosemirror-*` alias for any new subpath; don't remove the map. Wiki links and
other app URLs must use `import.meta.env.BASE_URL`, not assume a root path.

### Vitest / Testing Library tests

Follow the `musing-vitest-tests` skill for mocking `workspaceStorage` / `supabaseClient`,
fixture shapes, and coverage commands (`npm run test:run`, `npm run test:coverage`). Import
router test helpers (e.g. `MemoryRouter`) from `react-router`, not `react-router-dom`.

### Workspace and Supabase sync

Follow the `supabase-sync` skill for anonymous auth, snapshot shape, RLS, and env/CI details.
Without `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (`isSupabaseConfigured()`), the app
never calls Supabase.

### AI service (`service/`)

Follow the `ai-service` skill for the auth boundary, budget/rate-limit gating, and deploy
gotchas. Own package and toolchain — not covered by root `lint`/`test`/`build`.

### Documentation and README accuracy

Follow the `foundations:doc-writer` skill (from the `dani-foundations` plugin, see
`.claude/settings.json`) — its accuracy checklist covers keeping README features, scripts,
the stack table, and env docs in sync with the repo; no local `doc-writer` copy needed.

Step-by-step playbooks live in `.claude/skills/*/SKILL.md` (canonical — `.cursor/skills` is a
symlink to it, kept for Cursor compatibility), auto-invoked by either tool based on the task:

- `editor-tiptap` — TipTap/ProseMirror doc model, slash and wiki-link menus, `vite.config.ts`
  PM aliases.
- `supabase-sync` — anonymous auth, workspace JSON snapshot, RLS, env.
- `musing-vitest-tests` — Vitest / Testing Library conventions and fakes for this repo.
- `pr-ready` — local CI-parity checks and PR template before opening a PR.
- `ai-service` — `service/` (musing-ai-service): auth/budget boundary, CORS, deploy, own
  toolchain.

## Constraints — do not

- **Import from `react-router-dom`.** This repo uses `react-router` directly (React Router 8).
- **Assume the app is hosted at `/`.** Any app URL (wiki links, exports) must go through
  `BASE_URL` (`import.meta.env.BASE_URL`), not a hardcoded root path.
- **Add a `@tiptap/pm/*` import without checking `vite.config.ts`'s `resolve.alias` map.**
  Rolldown (Vite 8) doesn't resolve those subpaths on its own; new ProseMirror subpaths need
  a matching `prosemirror-*` alias.
- **Assume Supabase is configured.** With no env vars set, the app is `localStorage`-only —
  don't add code paths that require a DB.
- **Assume `musing-ai-service` is configured or reachable.** `isAiServiceConfigured()`
  (`src/lib/aiClient.ts`) gates every AI code path in the frontend; with no
  `VITE_AI_SERVICE_URL` (or no Supabase, which every AI request also requires), none of it
  should render or run.
- **Run root `npm run lint`/`test`/`build` and assume it covers `service/`.** It doesn't —
  `service/` is a separate package with its own scripts; see the `ai-service` skill.
- **Bump React, Vite, TypeScript, or React Router without updating the docs in the same
  change** — `check_stack_docs.py` checks README / `AGENTS.md` drift but does not fix it.
- **Commit secrets** (`.env.local`, credentials) or amend/force-push without being explicitly
  asked.
- **Open, push, or merge a PR unless the user asks.** (This repo has no autonomous exception of
  its own — see README's **Automation** section. A scheduled routine in
  `danibsheehan/portfolio-automation` reads this repo read-only and may open a PR _in a different
  repo_, `danibsheehan.github.io`; it never touches this one.)

## Definition of done

- **Task done**: follow the scoped rule/skill for files touched; run the smallest relevant
  check (`npm run test:run` for touched suites, `npm run lint` if ESLint-relevant). Full
  coverage CI is not required for every small edit. For larger or riskier changes, run
  `/code-review` manually before committing to catch issues early.
- **PR done**: run the checks under Test / CI parity above, then follow the `pr-ready` skill
  (PR template filled, no secrets). Commit, push, or open a PR only when the user asks.
