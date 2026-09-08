# Coverage sweep

A low-stakes pilot for agent-led PR creation and auto-merge in this repo (see the
coverage-sweep exception in [`AGENTS.md`](../AGENTS.md)). Scope is deliberately narrow:
test-only changes that raise branch coverage on a short list of files already judged safe for
autonomous work, with no change to source behavior. This exists to build a track record for
agent-led automation in musing before considering any expansion beyond this narrow scope.

## Curated allowlist

Only these files are eligible, regardless of what a coverage report says about any other
file:

- `src/lib/themePreference.ts` — pure localStorage/`matchMedia` logic; no TipTap doc model,
  no Supabase.
- `src/lib/blockPlainText.ts` — pure string/DOM text extraction; reads block content, does
  not mutate the doc model.
- `src/components/SidebarSearch.tsx` — UI component with debounce/effect logic; calls
  `aiClient`/`useWorkspace` but does not touch doc-model or sync internals directly.

All three already have an adjacent `.test.ts`/`.test.tsx` file — the routine extends existing
suites, it does not create test infrastructure from scratch.

## Explicit exclusions

Off-limits regardless of coverage percentage, until manually promoted (see Growth below):

- Anything under `src/extensions/` or `src/lib/pageDocument/` (TipTap doc model / extensions
  — see the `editor-tiptap` skill).
- `Editor.tsx`, `Block.tsx`, `PageDocumentEditor.tsx`, `DatabaseEmbedNodeView.tsx`,
  `DatabaseEmbedBlock.tsx`, `musingDatabaseEmbed.ts` (editor core / node views).
- `WorkspaceContext.tsx`, `workspaceStorage.ts`, `supabaseClient.ts`, `supabaseWorkspace.ts`
  (core data layer / Supabase sync — see the `supabase-sync` skill).
- Everything under `service/` (separate toolchain, own auth/budget boundary — see the
  `ai-service` skill).

## Sweep algorithm

Each run:

1. Run `npm run test:coverage`.
2. Restrict to the curated allowlist above — ignore every other file's coverage number.
3. Pick the single lowest-branch-coverage file among the allowlist (ties broken
   alphabetically).
4. Add Vitest cases for that file's currently-uncovered branches only. No change to source
   behavior.
5. If closing the gap would require a real judgment call rather than a mechanical fix (e.g.
   a coverage gap only closable by changing what the code does), skip that file and try the
   next-lowest allowlisted file. If none of the three has a mechanically-closable gap, log a
   no-op run (see Log below) and stop — do not force a fix and do not touch an excluded file.

## How a run is worked

1. Run the sweep algorithm above to pick a file (or determine the run is a no-op).
2. Implement the added test cases per the file's existing test conventions (see the
   `vitest-tests` skill).
3. Run scoped local checks: `npm run lint` and `npm run test:coverage`.
4. Open a PR labeled `agent-coverage-sweep`.
5. Watch required checks. On failure, one fix retry; if still failing, relabel the PR
   `coverage-sweep-needs-review` and stop — never force-merge, never retry indefinitely.
6. Append a row to [`coverage-sweep-log.md`](coverage-sweep-log.md).

## Growth

The allowlist grows manually only — a human decides when a file's guardrails are stable
enough to add. Criteria to consider when promoting a file:

- It has an adjacent `.test.ts`/`.test.tsx` file already (the routine extends suites, it
  does not build new test infrastructure).
- It is not in an excluded area above (doc model, editor core, Supabase sync, `service/`).

There is no automatic promotion (e.g. "any file with a test file becomes eligible") — this is
intentional while the routine has no track record yet in this repo.
