# musing

Notion-style editor and pages with optional **Supabase** cloud sync, deployable to **GitHub Pages**.

## Supabase (optional)

1. Create a project and copy **Project URL** and the **anon (publishable) key**.
2. **SQL Editor** → run `supabase/schema.sql` (table `workspaces`, RLS policies).
3. **Authentication → Providers** → enable **Anonymous** sign-ins (used for zero-UI sync).
4. Local dev: copy `.env.example` to **`.env.local` in the repo root** (next to `package.json`) and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Restart `npm run dev`.

Without env vars, the app still runs using **localStorage** only.

If auth behaves oddly on the live URL, set **Authentication → URL Configuration** in Supabase: **Site URL** and **Redirect URLs** to your GitHub Pages origin (e.g. `https://<user>.github.io/<repo>/`).

## Deploy to GitHub Pages

1. Repo **Settings → Pages** → **Build and deployment**: source **GitHub Actions**.
2. **Settings → Secrets and variables → Actions** → add repository secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`  
   (Same values as local `.env.local`; required for cloud sync on the live site.)
3. Push to `main`. The **Deploy to GitHub Pages** workflow builds with the correct asset base path for `https://<user>.github.io/<repo>/` and copies `index.html` to `404.html` so client-side routes work on refresh.

For a **user site** (`<username>.github.io` from a `<username>.github.io` repo), the workflow uses base path `/` automatically.

To simulate a Pages build locally:  
`GITHUB_ACTIONS=true GITHUB_REPOSITORY=yourname/yourrepo npm run build`

Optional override: `VITE_BASE_PATH=/custom/` when building.
