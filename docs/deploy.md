# Deployment

musing has two independent deploy targets: the frontend (GitHub Pages) and the optional
`musing-ai-service` backend (Cloud Run). Neither requires the other — the frontend works with
no AI service configured.

## Deploy to GitHub Pages

1. Repo **Settings → Pages** → **Build and deployment**: source **GitHub Actions**.
2. **Settings → Secrets and variables → Actions** → add repository secrets if you want cloud
   sync on the live site (same values as `.env.local`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
     The build completes without them; the published app then behaves like local dev with no
     Supabase config (local-only persistence in the browser).
3. Push to `main`. The branch ruleset requires `verify.yml`'s checks (stack-docs drift, `npm
audit`, lint, format check, typecheck, coverage, build) to pass before a PR can merge;
   **Deploy to GitHub Pages** (`.github/workflows/deploy-pages.yml`) then runs independently on
   that same push (`npm ci`, `npm run build`, copy `dist/index.html` → `dist/404.html`, publish
   `dist`). **Supabase keepalive** is scheduled from the default branch as well; it only
   performs the health ping when both Supabase secrets above are set (otherwise it skips).

For a **user site** (`https://<username>.github.io` from a repo named `<username>.github.io`),
`vite.config.ts` uses base path `/` automatically when `GITHUB_ACTIONS` and
`GITHUB_REPOSITORY` indicate that naming convention.

Simulate a Pages build locally:

```bash
GITHUB_ACTIONS=true GITHUB_REPOSITORY=yourname/yourrepo npm run build
```

Optional: `VITE_BASE_PATH=/custom/` when building.

## Deploy musing-ai-service (optional)

`service/` is a separate backend (Express + TypeScript) providing the AI second-brain
layer — semantic search, summaries, related pages — over musing's notes. It deploys
independently to Cloud Run via `.github/workflows/deploy-cloud-run.yml`, triggered by pushes
to `main` that touch `service/**`. Like **Supabase keepalive**, this workflow **skips**
(doesn't fail) until it's configured:

1. A GCP service account (deploys as, and Cloud Run runs the container as) with: Cloud Run
   Admin, Service Account User, Secret Manager Secret Accessor, Cloud Build Editor (source
   builds run through Cloud Build), Artifact Registry Administrator (the first deploy
   creates the repo, not just pushes to it — plain Writer isn't enough), and Storage Admin
   (source upload needs a Cloud Storage staging bucket created on first deploy).
2. Repository secrets: `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_SA_KEY` (that service account's
   JSON key), plus non-sensitive config — `CHAT_MODEL`, `EMBEDDING_MODEL`,
   `AI_MONTHLY_TOKEN_CAP`, `AI_MONTHLY_REQUEST_CAP`, `AI_MAX_QPS`,
   `VOYAGE_MONTHLY_TOKEN_CAP`, `VOYAGE_MONTHLY_REQUEST_CAP`, `SUPABASE_URL`, and
   `ALLOWED_ORIGINS` (comma-separated list of origins allowed to call the API — see below).
3. GCP Secret Manager secrets (same names): `SUPABASE_SERVICE_ROLE_KEY`,
   `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY` — these are the actual sensitive values, kept out
   of plaintext env vars on the Cloud Run revision.
4. The musing frontend and `service/` are unrelated hosts (GitHub Pages vs. Cloud Run) on
   different origins — the frontend calls `service/` cross-origin directly (no same-origin
   proxy), so the API enforces CORS via `ALLOWED_ORIGINS` rather than relying on shared-domain
   routing.
5. Cloud Run is deployed with `--allow-unauthenticated` — the actual access boundary is
   app-level (the API verifies each request's Supabase JWT), not GCP IAM, since callers are
   end-user browsers with no GCP identity to present.

Without that setup, the app runs exactly as described in the root README with no AI features —
this is an optional layer on top of the core note-taking app.

Once deployed, **weekly probe smoke** (`.github/workflows/weekly-probe-smoke.yml`) checks
`GET /health` on `service/` every Monday, reusing the `VITE_AI_SERVICE_URL` secret already
set for the frontend build — a rare drift check, not a chatty uptime monitor, so it won't
wake a scale-to-zero Cloud Run revision more than once a week.
