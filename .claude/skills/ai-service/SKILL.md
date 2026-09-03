---
name: ai-service
description: >-
  Auth boundary, budget/rate-limit gating, and deploy gotchas for musing-ai-service
  (service/) — the optional AI second-brain backend. Use when adding or changing routes,
  middleware, provider calls, CORS config, or Supabase RPCs in service/.
---

# AI service (musing-ai-service, `service/`)

Own package (`service/package.json`), own toolchain — not part of the root npm workspace, not
covered by root `lint`/`test`/`build`. Deployed independently to Cloud Run; the frontend calls
it cross-origin (see `AGENTS.md` and the README's "Deploy musing-ai-service" section).

## Must preserve

- **`requireAuth` (`middleware/auth.ts`) verifies the caller's Supabase JWT** via the
  service-role client (`lib/supabaseAdmin.ts`) — this is the real access boundary. Cloud Run
  itself is deployed `--allow-unauthenticated` by design; don't add GCP-IAM-based access
  control here, callers are end-user browsers with no GCP identity.
- **`requireBudget(provider)` gates every route that calls a paid provider** — including
  `/api/embed-page` (Voyage), not just LLM-calling routes. Add it to any new paid-provider
  route.
- **`llmRateLimiter` (`lib/tokenBucket.ts`)**: `await .acquire()` before every outbound
  Anthropic/Voyage call, process-wide, independent of per-user budgets.
- **CORS (`lib/cors.ts`)**: `ALLOWED_ORIGINS` is a plain comma-separated env var. If a value
  ever needs a literal comma, it must be escaped in `deploy-cloud-run.yml`'s `escape_origins`
  step — the `deploy-cloudrun` action's `env_vars` parses raw commas as entry separators.
- **Two Postgres RPC functions** (`match_note_embeddings`, `match_related_pages` in
  `supabase/schema.sql`) back `/api/search` and `/api/related-pages` — both are revoked from
  `anon`/`authenticated` and granted only to `service_role`, since they take `match_user_id`
  as a plain parameter instead of reading `auth.uid()`. Never weaken that grant.

## Local dev

```bash
cd service
npm install
npm run dev   # tsx watch, reads service/.env.local (see service/.env.example)
```

## Tests

Vitest, colocated `*.test.ts` next to the module under test, configured separately
(`service/vitest.config.ts`). Only pure logic is unit-tested today (`chunking`, `clampLimit`,
`tokenBucket`) — no route/handler-level tests yet.
