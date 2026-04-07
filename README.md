# musing

> Notion-style block pages and editor in the browser, with optional **Supabase** sync and a **GitHub Pages** deployment path.

## Overview

**musing** is a single-page React app: you edit block-based notes, link pages together, and embed lightweight databases. Data lives in **localStorage** by default. When you add Supabase credentials, the same workspace syncs to the cloud using anonymous sign-in and a JSON snapshot stored per user. The repo includes GitHub Actions workflows: one **deploys** to Pages with the correct asset base path (`https://<user>.github.io/<repo>/`) and copies `index.html` to `404.html` so client-side routes survive a refresh; another **pings** Supabase daily (optional) so a free-tier project is less likely to pause from inactivity.

## Features

- Block editor built on **TipTap** with a **slash menu** for block types; **floating toolbar** on selected text for bold, italic, underline, links, and related styles (keyboard shortcuts still work); reorder blocks by dragging the **grip** or with **Alt + ↑ / ↓**
- **Pages** with client-side routes (`/page/:pageId`) and a sidebar for navigation
- **Wiki-style links** in text plus an **`@` page picker** to insert links while typing
- **Database embeds** with table and canvas-style views
- **Export** pages to **PDF** or **.docx** (Word) from the page chrome menu
- **localStorage** persistence; **cross-tab** updates via the `storage` event
- Optional **Supabase** sync (workspace snapshot in Postgres, RLS-scoped to the signed-in user)
- **Vite** + **TypeScript**; **React Router** with `basename` derived from `import.meta.env.BASE_URL` for subpath hosting

## Installation

```bash
git clone https://github.com/danibsheehan/musing.git
cd musing
npm install
```

## Quick start

```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). With no Supabase env vars, the app runs entirely offline in the browser.

Other useful scripts:

| Command | Purpose |
| ------- | ------- |
| `npm run build` | Production build (`dist/`) |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npm run test` | Vitest in watch mode |
| `npm run test:run` | Vitest once (CI-style) |

Optional: copy `.env.example` to **`.env.local` in the repo root** (next to `package.json`), set the variables below, then restart `npm run dev`.

```bash
cp .env.example .env.local
# edit .env.local — Vite only loads env from the project root, not from src/
```

## Stack

| Area        | Choice                                      |
| ----------- | ------------------------------------------- |
| UI          | React 19, React Router 7                    |
| Editor      | TipTap (`@tiptap/react`, starter-kit, bubble menu on selection) |
| Build       | Vite 8, TypeScript 5.9                      |
| Backend (opt.) | Supabase (`@supabase/supabase-js`)     |

There is no published npm package; the app is the product.

## Code layout

This repo is an application, not a library: there is no separate package API. The React UI and editor live under `src/` (routes, TipTap extensions including wiki links and the selection format bubble, Supabase client, export helpers). Database shape and RLS for sync are in `supabase/schema.sql`. `vite.config.ts` aliases `@tiptap/pm/*` to `prosemirror-*` packages so Vite 8 (Rolldown) resolves TipTap imports.

## Configuration

| Variable              | When needed              | Description |
| --------------------- | ------------------------ | ----------- |
| `VITE_SUPABASE_URL`   | Cloud sync               | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Cloud sync            | Supabase anon (publishable) key |
| `VITE_BASE_PATH`      | Custom base path in builds | Optional override, e.g. `/custom/` — trailing slash preferred |

Local development uses `.env.local`. **GitHub Actions** should define the same Supabase variables as **repository secrets** if you want sync on the live site or the **Supabase keepalive** workflow to run against your project.

## Supabase (optional cloud sync)

1. Create a project and copy **Project URL** and the **anon (publishable) key**.
2. In **SQL Editor**, run `supabase/schema.sql` (creates `workspaces`, indexes, and RLS policies).
3. Under **Authentication → Providers**, enable **Anonymous** sign-ins (used for sync without a custom auth UI).
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` and restart the dev server.

Without those env vars, the app still runs using **localStorage** only.

If auth misbehaves on the deployed URL, open **Authentication → URL Configuration** in Supabase and set **Site URL** and **Redirect URLs** to your GitHub Pages origin, e.g. `https://<user>.github.io/<repo>/`.

### Keep free-tier projects active (optional)

Supabase can **pause** free-tier projects after roughly a week without activity. The **Supabase keepalive** workflow (`.github/workflows/supabase-keepalive.yml`) sends a daily `GET` to your project’s `/auth/v1/health` endpoint using the **anon** key only—no service role key.

| Item | Detail |
| ---- | ------ |
| Secrets | Same as Pages: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. If either is missing, the job **skips** and succeeds so the repo stays green without Supabase. |
| Schedule | Daily at **06:00 UTC**; edit the `cron` expression in the workflow file to change the time. |
| Manual run | **Actions** → **Supabase keepalive** → **Run workflow**. |

Scheduled workflows run from the **default branch** (typically `main`). If a repository has no activity for a long time, GitHub may disable scheduled workflows until the repo is active again.

## Deploy to GitHub Pages

1. Repo **Settings → Pages** → **Build and deployment**: source **GitHub Actions**.
2. **Settings → Secrets and variables → Actions** → add repository secrets if you want cloud sync on the live site (same values as `.env.local`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   The build completes without them; the published app then behaves like local dev with no Supabase config (local-only persistence in the browser).
3. Push to `main`. The **Deploy to GitHub Pages** workflow runs `npm ci`, `npm run build`, copies `dist/index.html` to `dist/404.html`, and publishes `dist`. **Supabase keepalive** is scheduled from the default branch as well; it only performs the health ping when both Supabase secrets above are set (otherwise it skips).

For a **user site** (`https://<username>.github.io` from a repo named `<username>.github.io`), `vite.config.ts` uses base path `/` automatically when `GITHUB_ACTIONS` and `GITHUB_REPOSITORY` indicate that naming convention.

Simulate a Pages build locally:

```bash
GITHUB_ACTIONS=true GITHUB_REPOSITORY=yourname/yourrepo npm run build
```

Optional: `VITE_BASE_PATH=/custom/` when building.

## License

MIT — see [LICENSE](LICENSE).
