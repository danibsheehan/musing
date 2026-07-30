---
name: musing-vitest-tests
description: >-
  Writes or updates Vitest + Testing Library tests for musing: colocated
  *.test.ts(x), jsdom setup, workspace/Supabase mocks, and editor helpers. Use when
  adding or changing code under src/, writing tests, fixing flaky UI/hook tests,
  coverage thresholds, or when the user mentions Vitest, RTL, or test coverage.
---

# Vitest tests (musing)

## When this applies

- Editing `src/**/*.test.ts(x)`, `src/test/setup.ts`, or `vite.config.ts` `test` / `coverage` options.
- Adding tests for components, context, `lib/`, extensions, or page-document helpers.

## Stack (must match repo)

- **Runner**: Vitest (`test` block in **`vite.config.ts`**).
- **DOM**: **jsdom** (`environment: 'jsdom'`, `globals: true`).
- **Matchers**: **`@testing-library/jest-dom/vitest`** via **`src/test/setup.ts`**.
- **Components / hooks**: **`@testing-library/react`** (`render`, `screen`, `within`, `waitFor`, `renderHook`, `act`).
- **Interactions**: **`@testing-library/user-event`** when exercising UI.

## Conventions

1. **File placement** — Colocate: `Foo.test.tsx` next to `Foo.tsx`, `bar.test.ts` next to `bar.ts`. Include pattern: `src/**/*.{test,spec}.{ts,tsx}`.

2. **Workspace / storage** — Prefer patterns from **`context/WorkspaceContext.test.tsx`**:
   - `vi.hoisted` + `vi.mock` for `lib/workspaceStorage` (`loadWorkspace` / `saveWorkspace`) while keeping other exports.
   - Mock **`lib/supabaseClient`** (`isSupabaseConfigured`, `getSupabase`) so unit tests never hit a real project.
   - Use small **`WorkspaceSnapshot` / `Page` / `Block` fixtures** shaped like `types/page.ts` and `types/block.ts`.

3. **Supabase helpers** — Mock the client module; assert parse/upsert logic with fixtures. See `lib/supabaseWorkspace.test.ts`, `lib/supabaseClient.test.ts`.

4. **Editor / TipTap** — Prefer testing **public helpers** and serialization (`lib/pageDocument/*`, slash/menu helpers) over deep ProseMirror internals. Extend existing suites when changing behavior; see **`.cursor/skills/editor-tiptap/SKILL.md`**.

5. **UI** — Prefer **roles and accessible names**. Cover loading/error/empty when the UI surfaces them. For router-dependent views, use **`MemoryRouter`** (and `basename` awareness when relevant) like neighboring tests.

6. **Commands**
   - **Task done**: `npm run test:run` (or Vitest watch) for suites you touched.
   - Coverage / gate: `npm run test:coverage` — thresholds in `vite.config.ts`; HTML under `coverage/`.
   - **PR done**: **`.cursor/skills/pr-ready/SKILL.md`**.

## Anti-patterns

- Real network calls to Supabase or other remotes in unit tests.
- Asserting pixel layout or TipTap/ProseMirror private internals instead of blocks, labels, or exported helpers.
- Duplicating huge snapshots when a minimal `Page` / `Block` fixture suffices.

## Reference locations

- Config: `vite.config.ts` (`test`, `coverage.thresholds`).
- Setup: `src/test/setup.ts`.
- Examples: `context/WorkspaceContext.test.tsx`, `components/SlashMenu.test.tsx`, `lib/pageDocument/*.test.ts`, `lib/workspaceStorage.test.ts`.
