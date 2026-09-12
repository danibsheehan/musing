# Configuration

musing runs with zero configuration — no env vars, using **localStorage** only in the browser.
Everything below is optional, for cloud sync and the AI layer.

## Environment variables

| Variable                 | When needed                | Description                                                   |
| ------------------------ | -------------------------- | ------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Cloud sync                 | Supabase project URL                                          |
| `VITE_SUPABASE_ANON_KEY` | Cloud sync                 | Supabase anon (publishable) key                               |
| `VITE_AI_SERVICE_URL`    | AI features                | `musing-ai-service` URL — also requires Supabase to be set    |
| `VITE_BASE_PATH`         | Custom base path in builds | Optional override, e.g. `/custom/` — trailing slash preferred |

Optional: copy `.env.example` to **`.env.local` in the repo root** (next to `package.json`), set
the variables above, then restart `npm run dev`.

```bash
cp .env.example .env.local
# edit .env.local — Vite only loads env from the project root, not from src/
```

**GitHub Actions** should define the same Supabase variables as **repository secrets** if you
want sync on the live site or the **Supabase keepalive** workflow to run against your project.

## Supabase (optional cloud sync)

**In plain English:** there's no email or password to manage — Supabase just needs an anonymous
session to scope your data to you, so sync stays a background detail rather than a separate
account.

1. Create a project and copy **Project URL** and the **anon (publishable) key**.
2. In **SQL Editor**, run `supabase/schema.sql` (creates `workspaces`, indexes, and RLS
   policies, plus the `vector` extension and `note_embeddings`/`ai_outputs`/`ai_usage` tables
   used by the optional `musing-ai-service` backend under `service/`).
3. Under **Authentication → Providers**, enable **Anonymous** sign-ins (used for sync without a
   custom auth UI).
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` and restart the dev
   server.

Without those env vars, the app still runs using **localStorage** only.

If auth misbehaves on the deployed URL, open **Authentication → URL Configuration** in Supabase
and set **Site URL** and **Redirect URLs** to your GitHub Pages origin, e.g.
`https://<user>.github.io/<repo>/`.

### Keep free-tier projects active (optional)

Supabase can **pause** free-tier projects after roughly a week without activity. The **Supabase
keepalive** workflow (`.github/workflows/supabase-keepalive.yml`) sends a daily `GET` to your
project's `/auth/v1/health` endpoint using the **anon** key only — no service role key.

| Item       | Detail                                                                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secrets    | Same as Pages: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. If either is missing, the job **skips** and succeeds so the repo stays green without Supabase. |
| Schedule   | Daily at **06:00 UTC**; edit the `cron` expression in the workflow file to change the time.                                                                     |
| Manual run | **Actions** → **Supabase keepalive** → **Run workflow**.                                                                                                        |

Scheduled workflows run from the **default branch** (typically `main`). If a repository has no
activity for a long time, GitHub may disable scheduled workflows until the repo is active again.
