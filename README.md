# musing

> Notion-style block pages and editor in the browser, with optional **Supabase** sync and a **GitHub Pages** deployment path.

## Overview

**musing** is a single-page React app: you edit block-based notes, link pages together, and embed lightweight databases. Data lives in **localStorage** by default. When you add Supabase credentials, the same workspace syncs to the cloud using anonymous sign-in and a JSON snapshot stored per user. The repo includes a GitHub Actions workflow that builds with the correct asset base path for project Pages (`https://<user>.github.io/<repo>/`) and copies `index.html` to `404.html` so client-side routes survive a refresh.

## Features

- Block editor built on **TipTap** with a **slash menu** for inserting block types
- **Pages** with client-side routes (`/page/:pageId`) and a sidebar for navigation
- **Wiki-style links** between pages
- **Database embeds** with table and canvas-style views
- **localStorage** persistence; **cross-tab** updates via the `storage` event
- Optional **Supabase** sync (workspace snapshot in Postgres, RLS-scoped to the signed-in user)
- **Vite** + **TypeScript**; **React Router** with `basename` derived from `import.meta.env.BASE_URL` for subpath hosting

## Installation

```bash
git clone https://github.com/danibsheehan/musing.git>
cd musing
npm install
```

## Quick start

```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). With no Supabase env vars, the app runs entirely offline in the browser.

Optional: copy `.env.example` to **`.env.local` in the repo root** (next to `package.json`), set the variables below, then restart `npm run dev`.

```bash
cp .env.example .env.local
# edit .env.local — Vite only loads env from the project root, not from src/
```

## Stack

| Area        | Choice                                      |
| ----------- | ------------------------------------------- |
| UI          | React 19, React Router 7                    |
| Editor      | TipTap (`@tiptap/react`, starter-kit)       |
| Build       | Vite 8, TypeScript 5.9                      |
| Backend (opt.) | Supabase (`@supabase/supabase-js`)     |

There is no published npm package; the app is the product.

## Configuration

| Variable              | When needed              | Description |
| --------------------- | ------------------------ | ----------- |
| `VITE_SUPABASE_URL`   | Cloud sync               | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Cloud sync            | Supabase anon (publishable) key |
| `VITE_BASE_PATH`      | Custom base path in builds | Optional override, e.g. `/custom/` — trailing slash preferred |

Local development uses `.env.local`. **GitHub Actions** should define the same Supabase variables as **repository secrets** if you want sync on the live site.

## Supabase (optional cloud sync)

1. Create a project and copy **Project URL** and the **anon (publishable) key**.
2. In **SQL Editor**, run `supabase/schema.sql` (creates `workspaces`, indexes, and RLS policies).
3. Under **Authentication → Providers**, enable **Anonymous** sign-ins (used for sync without a custom auth UI).
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` and restart the dev server.

Without those env vars, the app still runs using **localStorage** only.

If auth misbehaves on the deployed URL, open **Authentication → URL Configuration** in Supabase and set **Site URL** and **Redirect URLs** to your GitHub Pages origin, e.g. `https://<user>.github.io/<repo>/`.

## Deploy to GitHub Pages

1. Repo **Settings → Pages** → **Build and deployment**: source **GitHub Actions**.
2. **Settings → Secrets and variables → Actions** → add repository secrets if you want cloud sync on the live site (same values as `.env.local`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   The build completes without them; the published app then behaves like local dev with no Supabase config (local-only persistence in the browser).
3. Push to `main`. The **Deploy to GitHub Pages** workflow runs `npm ci`, `npm run build`, copies `dist/index.html` to `dist/404.html`, and publishes `dist`.

For a **user site** (`https://<username>.github.io` from a repo named `<username>.github.io`), `vite.config.ts` uses base path `/` automatically when `GITHUB_ACTIONS` and `GITHUB_REPOSITORY` indicate that naming convention.

Simulate a Pages build locally:

```bash
GITHUB_ACTIONS=true GITHUB_REPOSITORY=yourname/yourrepo npm run build
```

Optional: `VITE_BASE_PATH=/custom/` when building.

## License

MIT — see [LICENSE](LICENSE).
