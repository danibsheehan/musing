# musing

[![CI](https://github.com/danibsheehan/musing/actions/workflows/ci.yml/badge.svg)](https://github.com/danibsheehan/musing/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Live app](https://img.shields.io/badge/live-danibsheehan.com%2Fmusing-brightgreen?style=flat-square)](https://www.danibsheehan.com/musing/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=0a1018)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)

> Notion-style block pages and editor in the browser, with optional **Supabase** sync and a **GitHub Pages** deployment path.

**[Try it live →](https://www.danibsheehan.com/musing/)** — nothing to install, no account required. Everything below this is for running musing yourself or contributing to it.

## Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Automation](#automation)
- [Stack](#stack)
- [Code layout](#code-layout)
- [Configuration](#configuration)
- [Supabase (optional cloud sync)](#supabase-optional-cloud-sync)
- [Deploy to GitHub Pages](#deploy-to-github-pages)

## Overview

musing is a block-based note app in the spirit of Notion — write in blocks, link pages to each other by name, and embed small databases (as a table or a freeform canvas) right inside a page.

It runs entirely in your browser. By default your notes are saved to **localStorage** on your own device — there's nothing to sign up for, and nothing leaves your machine. If you want the same notes to follow you across devices, add a free **Supabase** project and musing will sync that workspace to the cloud behind an anonymous sign-in, with no separate account system to set up.

The repo also includes two optional GitHub Actions workflows for anyone hosting their own copy. One **deploys** to GitHub Pages with the correct asset base path (`https://<user>.github.io/<repo>/`) and copies `index.html` to `404.html` so client-side routes survive a refresh. The other **pings** Supabase daily so a free-tier project is less likely to pause from inactivity.

## Features

- Block editor built on **TipTap**: a **slash menu** for block types, a **floating toolbar** on selected text for bold, italic, underline, links, and related styles (keyboard shortcuts still work), and drag-to-reorder blocks via the **grip** or **Alt + ↑ / ↓**
- **Emoji**: type **`:`** for inline emoji suggestions, or pick **Emoji** from the slash menu
- **Pages** with client-side routes (`/page/:pageId`) and a sidebar for navigation
- **Wiki-style links** in text plus an **`@` page picker** to insert links while typing
- **Database embeds** with table and canvas-style views
- **Export** pages to **PDF** or **.docx** (Word) from the page chrome menu
- **Theme** control: **Light**, **Dark**, or **System** (stored in `localStorage` as `musing-theme-pref`)
- **localStorage** persistence; **cross-tab** updates via the `storage` event
- Optional **Supabase** sync (workspace snapshot in Postgres, RLS-scoped to the signed-in user)
- **Vite** + **TypeScript**; **React Router 8** (`react-router`, not `react-router-dom`) with `basename` derived from `import.meta.env.BASE_URL` for subpath hosting

## Installation

```bash
git clone https://github.com/danibsheehan/musing.git
cd musing
npm install
```

`npm install` also sets up a **Husky** pre-commit hook (`.husky/pre-commit`) that runs
**lint-staged**, formatting staged files with Prettier before each commit — the same check
`npm run format:check` enforces in CI.

## Quick start

```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). With no Supabase env vars, the app runs entirely offline in the browser.

Other useful scripts:

| Command                        | Purpose                                                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev:clean`            | Same as `npm run dev`, but unsets `NODE_OPTIONS` for this run (handy if inherited flags break Vite)                          |
| `npm run build`                | Production build (`dist/`)                                                                                                   |
| `npm run preview`              | Serve the production build locally                                                                                           |
| `npm run lint`                 | ESLint                                                                                                                       |
| `npm audit --audit-level=high` | Fail on high/critical advisories (CI)                                                                                        |
| `npm run format`               | Prettier write                                                                                                               |
| `npm run format:check`         | Prettier check (CI)                                                                                                          |
| `npm run test`                 | Vitest in watch mode                                                                                                         |
| `npm run test:run`             | Vitest once (CI-style)                                                                                                       |
| `npm run test:coverage`        | Vitest once with **v8 coverage**, HTML + `lcov` under `coverage/`, and **threshold checks** (configured in `vite.config.ts`) |
| `npm run test:coverage:watch`  | Same coverage settings while iterating in watch mode                                                                         |

### Continuous integration

**In plain English:** CI's job is to catch drift, regressions, and broken builds before they land on `main`. Pushes to **`main`** and **pull requests** run `.github/workflows/ci.yml`, in order:

1. Stack-docs drift check (`python3 .github/scripts/check_stack_docs.py`) — keeps this README and `.cursor/rules/musing-project.mdc` in sync with `package.json`
2. `npm audit --audit-level=high`
3. `npm run lint`
4. `npm run format:check`
5. `npm run test:coverage` — fails if coverage drops below the thresholds in `vite.config.ts`
6. `npm run build`

Every run appends a Cobertura coverage summary to the workflow's job summary ([`irongut/CodeCoverageSummary`](https://github.com/irongut/CodeCoverageSummary)). On pull requests from the same repository — not forks, since a fork's `GITHUB_TOKEN` can't write to the base repo's PR thread — CI also posts a coverage table comment ([`5monkeys/cobertura-action`](https://github.com/5monkeys/cobertura-action)). `.github/workflows/pr-guide.yml` additionally posts a sticky **PR guide** comment with touched areas, suggested verification, reviewer focus, and path-based `area:*` labels.

Optional: copy `.env.example` to **`.env.local` in the repo root** (next to `package.json`), set the variables below, then restart `npm run dev`.

```bash
cp .env.example .env.local
# edit .env.local — Vite only loads env from the project root, not from src/
```

## Automation

**In plain English:** nothing in this repo merges or opens a PR on its own yet — Dependabot's
weekly bumps and CI results are all reviewed and merged by hand. The one thing that _does_ run
unattended is read-only and lives elsewhere: a scheduled Claude Code routine, defined in
[`danibsheehan/portfolio-automation`](https://github.com/danibsheehan/portfolio-automation)'s
[`weekly-project-update`](https://github.com/danibsheehan/portfolio-automation/blob/main/.cursor/skills/weekly-project-update/SKILL.md)
skill, reads this repo once a week and never writes to it. Only when there's something people-relevant
to report does it open a PR against
[danibsheehan.github.io](https://github.com/danibsheehan/danibsheehan.github.io) updating this
project's page. See that skill and its
[repo's README](https://github.com/danibsheehan/portfolio-automation#autonomy-boundary)
for the full autonomy boundary (it opens, never merges).

`.github/dependabot.yml` opens weekly PRs: a grouped `npm-minor-and-patch` bump and ungrouped
GitHub Actions bumps (capped at 10 open each). No auto-merge is configured here — every
Dependabot PR gets a human review before merging, same as any other change.

## Stack

| Area           | Choice                                                          |
| -------------- | --------------------------------------------------------------- |
| UI             | React 19, React Router 8 (`react-router`)                       |
| Editor         | TipTap (`@tiptap/react`, starter-kit, bubble menu on selection) |
| Build          | Vite 8, TypeScript 6.0                                          |
| Backend (opt.) | Supabase (`@supabase/supabase-js`)                              |

There is no published npm package; the app is the product.

## Code layout

This repo is an application, not a library: there is no separate package API.

- **UI and editor** — `src/` (routes, TipTap extensions including wiki links and the selection format bubble, Supabase client, export helpers)
- **Sync schema and RLS** — `supabase/schema.sql`
- **TipTap/Vite alias note** — `vite.config.ts` aliases `@tiptap/pm/*` to `prosemirror-*` packages so Vite 8 (Rolldown) resolves TipTap imports
- **Agent docs** — **`AGENTS.md`** at the repo root is the tool-agnostic reference for coding agents (install/run/test commands, conventions, constraints, definition of done). Coding agents also use a thin always-apply rule (`.cursor/rules/musing-project.mdc`) plus scoped rules under `.cursor/rules/` (README, tests, TipTap, workspace/Supabase); optional skills live in `.cursor/skills/` (including **`pr-ready`** for pre-PR lint/format/coverage/build checks). Cursor reads `AGENTS.md` and the rules natively; **`CLAUDE.md`** imports both for Claude Code and maps the scoped rules to the paths they cover, and `.claude/skills` is a symlink to `.cursor/skills` so both tools share one set of skill files.

## Configuration

| Variable                 | When needed                | Description                                                   |
| ------------------------ | -------------------------- | ------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Cloud sync                 | Supabase project URL                                          |
| `VITE_SUPABASE_ANON_KEY` | Cloud sync                 | Supabase anon (publishable) key                               |
| `VITE_BASE_PATH`         | Custom base path in builds | Optional override, e.g. `/custom/` — trailing slash preferred |

Local development uses `.env.local`. **GitHub Actions** should define the same Supabase variables as **repository secrets** if you want sync on the live site or the **Supabase keepalive** workflow to run against your project.

## Supabase (optional cloud sync)

**In plain English:** there's no email or password to manage — Supabase just needs an anonymous session to scope your data to you, so sync stays a background detail rather than a separate account.

1. Create a project and copy **Project URL** and the **anon (publishable) key**.
2. In **SQL Editor**, run `supabase/schema.sql` (creates `workspaces`, indexes, and RLS policies).
3. Under **Authentication → Providers**, enable **Anonymous** sign-ins (used for sync without a custom auth UI).
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` and restart the dev server.

Without those env vars, the app still runs using **localStorage** only.

If auth misbehaves on the deployed URL, open **Authentication → URL Configuration** in Supabase and set **Site URL** and **Redirect URLs** to your GitHub Pages origin, e.g. `https://<user>.github.io/<repo>/`.

### Keep free-tier projects active (optional)

Supabase can **pause** free-tier projects after roughly a week without activity. The **Supabase keepalive** workflow (`.github/workflows/supabase-keepalive.yml`) sends a daily `GET` to your project’s `/auth/v1/health` endpoint using the **anon** key only—no service role key.

| Item       | Detail                                                                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secrets    | Same as Pages: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. If either is missing, the job **skips** and succeeds so the repo stays green without Supabase. |
| Schedule   | Daily at **06:00 UTC**; edit the `cron` expression in the workflow file to change the time.                                                                     |
| Manual run | **Actions** → **Supabase keepalive** → **Run workflow**.                                                                                                        |

Scheduled workflows run from the **default branch** (typically `main`). If a repository has no activity for a long time, GitHub may disable scheduled workflows until the repo is active again.

## Deploy to GitHub Pages

1. Repo **Settings → Pages** → **Build and deployment**: source **GitHub Actions**.
2. **Settings → Secrets and variables → Actions** → add repository secrets if you want cloud sync on the live site (same values as `.env.local`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
     The build completes without them; the published app then behaves like local dev with no Supabase config (local-only persistence in the browser).
3. Push to `main`. **CI** runs stack-docs drift, `npm audit` (high+), lint, format check, coverage, and build; on success it calls **Deploy to GitHub Pages** for the same commit (`npm ci`, `npm run build`, copy `dist/index.html` → `dist/404.html`, publish `dist`). You can also run **Deploy to GitHub Pages** alone via **Actions → Run workflow**. **Supabase keepalive** is scheduled from the default branch as well; it only performs the health ping when both Supabase secrets above are set (otherwise it skips).

For a **user site** (`https://<username>.github.io` from a repo named `<username>.github.io`), `vite.config.ts` uses base path `/` automatically when `GITHUB_ACTIONS` and `GITHUB_REPOSITORY` indicate that naming convention.

Simulate a Pages build locally:

```bash
GITHUB_ACTIONS=true GITHUB_REPOSITORY=yourname/yourrepo npm run build
```

Optional: `VITE_BASE_PATH=/custom/` when building.

## License

MIT — see [LICENSE](LICENSE).
