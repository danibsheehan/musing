---
name: pr-ready
description: >-
  Runs musing’s local CI-parity checks and prepares a pull request: lint,
  Vitest coverage thresholds, production build, plus PR template fields. Use when
  the user asks to open a PR, prepare a pull request, pre-PR checks, make CI pass,
  or verify before merging.
---

# PR ready (musing)

Run before opening or updating a PR. Prefer the commands below from the **repo root**.

## Checklist

```
Pre-PR:
- [ ] Scope: only intended files; no secrets (.env.local, credentials)
- [ ] npm run lint
- [ ] npm run test:coverage
- [ ] npm run build
- [ ] PR template filled
```

### 1. Local CI parity

```bash
npm run lint
npm run test:coverage
npm run build
```

| Check | What it covers |
|-------|----------------|
| `lint` | ESLint across the repo |
| `test:coverage` | Vitest once + **v8** coverage; fails if thresholds in `vite.config.ts` are missed (also what `.github/workflows/ci.yml` runs) |
| `build` | `tsc -b` + Vite production bundle (`dist/`) |

Faster while iterating (not a substitute before PR):

- `npm run test:run` — tests without coverage gate
- Focused file/suite filters via Vitest CLI when debugging one area

If editor or Supabase behavior changed, also skim **`.cursor/skills/editor-tiptap/SKILL.md`** / **`.cursor/skills/supabase-sync/SKILL.md`** for missed follow-ups (aliases, schema, env docs).

### 2. PR description

Fill **`.github/pull_request_template.md`**:

- **Summary** — what changed and why
- **How to verify** — commands or manual UI checks, or `N/A` for tooling-only

Same-repo PRs get an automatic **PR guide** sticky comment (`.github/workflows/pr-guide.yml`); keep the template accurate anyway.

Do not push or create the PR unless the user asked.

### 3. After merge (local cleanup)

When the PR is merged and the user is done with the branch (or asks to clean up):

```bash
git checkout main && git pull origin main
git branch -d <feature-branch>
```

Keep only **`main`** locally unless another branch is still in active use. Optionally `git fetch --prune` to drop stale remote-tracking refs.

## Anti-patterns

- Opening a PR without green lint / coverage / build.
- Committing `.env.local` or other secrets.
- Amending or force-pushing unless the user explicitly requests it.
- Leaving merged feature branches checked out or lingering locally after the user asks to clean up.
