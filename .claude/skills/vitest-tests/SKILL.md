---
name: vitest-tests
description: >-
  Writes or updates Vitest tests for musing: workspace/Supabase mocks and
  editor helpers. Use when adding or changing code under src/, writing
  tests, fixing flaky UI/hook tests, coverage thresholds, or when the user
  mentions Vitest, RTL, or test coverage.
---

# Vitest tests (musing)

For the React+Vitest+Testing Library mechanics this follows (mocking the API/client module,
the `renderHook` loading-race gotcha, roles/loading/error/empty checklist), see the
**`foundations:react-vitest-testing`** skill. This file is musing's own mocking/fixture
reference.

## When this applies

- Editing `src/**/*.test.ts(x)`, `src/test/setup.ts`, or `vite.config.ts` `test` / `coverage` options.
- Adding tests for components, context, `lib/`, extensions, or page-document helpers.

## Conventions

1. **Workspace / storage** — Prefer patterns from **`context/WorkspaceContext.test.tsx`**:
   - `vi.hoisted` + `vi.mock` for `lib/workspaceStorage` (`loadWorkspace` / `saveWorkspace`) while keeping other exports. The `loadWorkspace` mock returns `{ snapshot, seeded }`.
   - Mock **`lib/supabaseClient`** (`isSupabaseConfigured`, `getSupabase`) so unit tests never hit a real project.
   - Use small **`WorkspaceSnapshot` / `Page` / `Block` fixtures** shaped like `types/page.ts` and `types/block.ts`.

2. **Supabase helpers** — Mock the client module; assert parse/upsert logic with fixtures. See `lib/supabaseWorkspace.test.ts`, `lib/supabaseClient.test.ts`.

3. **Editor / TipTap** — Prefer testing **public helpers** and serialization (`lib/pageDocument/*`, slash/menu helpers) over deep ProseMirror internals. Extend existing suites when changing behavior; see **`.claude/skills/editor-tiptap/SKILL.md`**.

   **Editor menus (slash, `@`, database picker)** — `components/Editor.test.tsx` mounts the real `Editor` in jsdom through **`src/test/editorHarness.tsx`** (`installLayoutStubs`, `renderEditor`, `typeText` / `typeAtCaret`, `pressKey` on `window` where the menus listen, `pressKeyInEditor` for ProseMirror's own key handling, `flushFrames` for the `requestAnimationFrame` open-detection). It pins current behavior, quirks included, so menu refactors can be checked as behavior-neutral; use `it.fails` for a documented known bug so the test flips when it is fixed. **jsdom cannot cover** real focus/blur when clicking a menu, key repeat from a physical keyboard, IME composition, or real layout coordinates — verify those by hand in a browser (with `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `VITE_AI_SERVICE_URL` blanked so the app stays localStorage-only).

4. **Router-dependent views** — use **`MemoryRouter`** from **`react-router`** (and `basename` awareness when relevant) like neighboring tests — not `react-router-dom`.

5. **Commands**
   - **Task done**: `npm run test:run` (or Vitest watch) for suites you touched.
   - Coverage / gate: `npm run test:coverage` — thresholds in `vite.config.ts`; HTML under `coverage/`.
   - **PR done**: **`.claude/skills/pr-ready/SKILL.md`**.

## Anti-patterns

- Real network calls to Supabase or other remotes in unit tests.
- Asserting TipTap/ProseMirror private internals instead of blocks, labels, or exported helpers.

## Reference locations

- Config: `vite.config.ts` (`test`, `coverage.thresholds`).
- Setup: `src/test/setup.ts`.
- Examples: `context/WorkspaceContext.test.tsx`, `components/SlashMenu.test.tsx`, `lib/pageDocument/*.test.ts`, `lib/workspaceStorage.test.ts`.
