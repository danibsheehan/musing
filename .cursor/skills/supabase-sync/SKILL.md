---
name: supabase-sync
description: >-
  Anonymous Supabase auth, workspaces JSON snapshot, RLS, and env for musing cloud
  sync. Use when changing sync, auth, supabase/schema.sql, supabaseClient,
  supabaseWorkspace, WorkspaceContext remote logic, or GitHub Actions secrets for
  Supabase.
---

# Supabase sync (musing)

## Product behavior

- **Without** `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (see `isSupabaseConfigured()` in `lib/supabaseClient.ts`), the app uses **localStorage only** — no Supabase calls.
- **With** config: `WorkspaceProvider` uses **`signInAnonymously()`** if there is no session, then loads or creates the user’s row in **`public.workspaces`**.

## Data model

- **Table** (see `supabase/schema.sql`): `workspaces(user_id uuid PK → auth.users, snapshot jsonb, updated_at)`.
- **`snapshot`**: full **`WorkspaceSnapshot`** (`types/page.ts`: `version: 2`, `homePageId`, `lastOpenedPageId`, `pages`, `databases`). Parsed with **`parseWorkspaceJson` / `snapshotFromRemoteJson`** (`lib/supabaseWorkspace.ts`, `workspaceStorage.ts`).
- **RLS**: policies restrict **select/insert/update** to rows where **`auth.uid() = user_id`**, for **`authenticated`** role. Anonymous users are authenticated sessions with a real `user.id`.

## App responsibilities (`lib/supabaseWorkspace.ts`, `WorkspaceContext.tsx`)

- **`fetchWorkspaceRow`**: read one row by `user_id`.
- **`upsertWorkspaceRow`**: upsert on `user_id` conflict with full snapshot + `updated_at`.
- On first sync with empty remote: **push** current local snapshot; if remote has data: **replace** local state with remote (and persist to localStorage).
- **Debounced remote save** (~800ms) after local commits when sync is ready.

## SQL vs TypeScript

| Change | Where |
|--------|--------|
| New columns, policies, indexes, table shape | **`supabase/schema.sql`** (and apply in Supabase SQL Editor / migrations workflow you use) |
| Snapshot JSON shape, merge logic, when to save | **`types/page.ts`**, **`workspaceStorage.ts`**, **`WorkspaceContext.tsx`** |
| Client queries/upsert | **`supabaseWorkspace.ts`** |

If you change **`WorkspaceSnapshot`** or table columns, update **parsing**, **RLS** if new fields need different access, and **README** for any new env or setup.

## Supabase dashboard

- Enable **Anonymous** sign-ins: **Authentication → Providers** (error message in `WorkspaceContext.tsx` points here).
- **URL config**: set **Site URL** and **Redirect URLs** for your deployed origin (e.g. GitHub Pages) if auth misbehaves — see README.

## Env and CI

- **Local**: `.env.local` next to `package.json` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (see `.env.example`).
- **GitHub Actions / Pages**: same variable **names** as **repository secrets** so the built app can use cloud sync on the live site; **keepalive** workflow uses them to ping `/auth/v1/health` — README documents skip-if-missing behavior.

## Security note

Use **anon key** only in the client. Do not embed **service role** keys in the app or public workflows.
