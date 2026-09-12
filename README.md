# musing

[![CI](https://github.com/danibsheehan/musing/actions/workflows/verify.yml/badge.svg)](https://github.com/danibsheehan/musing/actions/workflows/verify.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Live app](https://img.shields.io/badge/live-danibsheehan.com%2Fmusing-brightgreen?style=flat-square)](https://www.danibsheehan.com/musing/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=0a1018)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)

[![musing banner](./docs/readme-banner.svg)](https://www.danibsheehan.com/musing/)

> Notion-style block pages and editor in the browser, with optional **Supabase** sync and a **GitHub Pages** deployment path.

**[Try it live →](https://www.danibsheehan.com/musing/)** — nothing to install, no account required. Everything below this is for running musing yourself or contributing to it.

## Contents

- [Start here](#start-here)
- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick start](#quick-start)
- [CI](#ci)
- [Automation](#automation)
- [Stack](#stack)
- [Code layout](#code-layout)
- [Configuration](#configuration)
- [Deploy](#deploy)
- [Cursor — legacy compatibility only](#cursor--legacy-compatibility-only)

## Start here

| I want to…                           | Go here                                                                                       |
| :----------------------------------- | :-------------------------------------------------------------------------------------------- |
| **Try it live**                      | [danibsheehan.com/musing](https://www.danibsheehan.com/musing/) — no install                  |
| **Run it on my machine**             | [Prerequisites](#prerequisites) → [Installation](#installation) → [Quick start](#quick-start) |
| **Understand what it does**          | [Overview](#overview) → [Features](#features)                                                 |
| **Set up cloud sync or AI features** | [Configuration](#configuration)                                                               |
| **Deploy my own copy**               | [Deploy](#deploy)                                                                             |
| **See what CI and automation do**    | [CI](#ci) → [Automation](#automation)                                                         |

## Overview

musing is a block-based note app in the spirit of Notion — write in blocks, link pages to each other by name, and embed small databases (as a table or a freeform canvas) right inside a page.

It runs entirely in your browser. By default your notes are saved to **localStorage** on your own device — there's nothing to sign up for, and nothing leaves your machine. If you want the same notes to follow you across devices, add a free **Supabase** project and musing will sync that workspace to the cloud behind an anonymous sign-in, with no separate account system to set up.

If you also add **`musing-ai-service`** (see [Deploy](#deploy)), musing gains an AI layer on top of your own notes: semantic search, one-click page summaries, and a "related pages" list that finds connections you never explicitly linked. It's entirely optional and additive — nothing about the core note-taking experience changes without it.

The repo also includes GitHub Actions workflows for anyone hosting their own copy: one **deploys** to GitHub Pages with the correct asset base path (`https://<user>.github.io/<repo>/`) and copies `index.html` to `404.html` so client-side routes survive a refresh; another **pings** Supabase daily so a free-tier project is less likely to pause from inactivity; a third optionally **deploys** `musing-ai-service` to Cloud Run, and a fourth **probes** its `/health` endpoint weekly once deployed.

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
- Optional **AI second-brain layer** (`musing-ai-service`, requires Supabase too): a search box in the sidebar for semantic search across your notes, a **Summarize** button per page, a collapsible **Related pages** list, and a usage indicator showing how much of your monthly AI budget is used
- **Vite** + **TypeScript**; **React Router 8** (`react-router`, not `react-router-dom`) with `basename` derived from `import.meta.env.BASE_URL` for subpath hosting

## Prerequisites

| Requirement           | Notes                    |
| :-------------------- | :----------------------- |
| **Node.js `22.22.3`** | Matches `.nvmrc` and CI. |

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
| `npm run typecheck`            | `tsc -b` — type-check only, no build output (CI)                                                                             |
| `npm run preview`              | Serve the production build locally                                                                                           |
| `npm run lint`                 | ESLint                                                                                                                       |
| `npm audit --audit-level=high` | Fail on high/critical advisories (CI)                                                                                        |
| `npm run format`               | Prettier write                                                                                                               |
| `npm run format:check`         | Prettier check (CI)                                                                                                          |
| `npm run test`                 | Vitest in watch mode                                                                                                         |
| `npm run test:run`             | Vitest once (CI-style)                                                                                                       |
| `npm run test:coverage`        | Vitest once with **v8 coverage**, HTML + `lcov` under `coverage/`, and **threshold checks** (configured in `vite.config.ts`) |
| `npm run test:coverage:watch`  | Same coverage settings while iterating in watch mode                                                                         |

## CI

**In plain English:** CI's job is to catch drift, regressions, and broken builds before they land on `main`. Pushes to **`main`** and **pull requests** run `.github/workflows/verify.yml` (via dani-actions' shared `npm-verify.yml`), as separate parallel jobs — one required check per concern, per npm package (root app and `service/`):

- Stack-docs drift check (`python3 .github/scripts/check_stack_docs.py`) — keeps this README and `AGENTS.md` in sync with `package.json`
- `format` — `npm run format:check`
- `lint` — `npm run lint`
- `audit` — `npm audit --audit-level=high`
- `typecheck` — `npm run typecheck` (root app only; `service/` type-checks as part of its own build)
- `test` — `npm run test:coverage` for the root app (fails if coverage drops below the thresholds in `vite.config.ts`), `npm run test:run` for `service/` (no coverage yet)
- `build` — `npm run build`

The `test` job appends a Cobertura coverage summary to the workflow's job summary ([`irongut/CodeCoverageSummary`](https://github.com/irongut/CodeCoverageSummary)) for any package with coverage. On pull requests from the same repository — not forks, since a fork's `GITHUB_TOKEN` can't write to the base repo's PR thread — it also posts a coverage table comment ([`5monkeys/cobertura-action`](https://github.com/5monkeys/cobertura-action)). `.github/workflows/pr-guide.yml` additionally posts a sticky **PR guide** comment with touched areas, suggested verification, reviewer focus, and path-based `area:*` labels.

## Automation

**In plain English:** this repo merges two narrow kinds of change automatically, once CI
passes — grouped npm minor/patch Dependabot bumps (see below), and test-only coverage
additions to a small curated allowlist of files opened by a scheduled coverage-sweep routine
(labeled `agent-coverage-sweep`; see [`AGENTS.md`](AGENTS.md) and
[`.claude/coverage-sweep.md`](.claude/coverage-sweep.md)). Everything else — npm majors,
GitHub Actions bumps, and all human-authored changes — is still reviewed and merged by hand.
Separately, one thing runs unattended and lives elsewhere: a scheduled Claude Code
routine, defined in
[`danibsheehan/portfolio-automation`](https://github.com/danibsheehan/portfolio-automation)'s
[`weekly-project-update`](https://github.com/danibsheehan/portfolio-automation/blob/main/.claude/skills/weekly-project-update/SKILL.md)
skill, reads this repo once a week and never writes to it. Only when there's something people-relevant
to report does it open a PR against
[danibsheehan.github.io](https://github.com/danibsheehan/danibsheehan.github.io) updating this
project's page. See that skill and its
[repo's README](https://github.com/danibsheehan/portfolio-automation#autonomy-boundary)
for the full autonomy boundary (it opens, never merges).

`.github/dependabot.yml` opens weekly PRs: a grouped `npm-minor-and-patch` bump and ungrouped
GitHub Actions bumps (capped at 10 open each). `.github/workflows/dependabot-auto-merge.yml`
auto-merges (squash) only the grouped `npm-minor-and-patch` PRs, and only once every required
`verify.yml` check passes. Ungrouped GitHub Actions bumps and any npm major bump still get a
human review before merging, same as any other change.

Also running on their own: **CodeQL** ([`codeql.yml`](.github/workflows/codeql.yml)) scans on
push/PR/weekly schedule; **dependency review**
([`dependency-review.yml`](.github/workflows/dependency-review.yml)) flags newly-introduced
vulnerable/incompatible dependencies in a PR's diff; **PR guide**
([`pr-guide.yml`](.github/workflows/pr-guide.yml)) scaffolds an empty PR description, posts a
sticky checklist/reviewer-focus comment, and applies path-based labels (same-repo PRs only);
**Lighthouse CI** ([`lighthouse.yml`](.github/workflows/lighthouse.yml)) audits a local
production build and posts warn-level performance/accessibility/best-practices/SEO scores.

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
- **Agent docs** — **`AGENTS.md`** at the repo root is the tool-agnostic reference for coding agents (install/run/test commands, conventions, constraints, definition of done). **`CLAUDE.md`** imports it for Claude Code. Skills live in **`.claude/skills/`** (canonical — including **`pr-ready`** for pre-PR lint/format/coverage/build checks); see [Cursor — legacy compatibility only](#cursor--legacy-compatibility-only) for how Cursor fits in.

## Configuration

musing runs with zero configuration by default — no env vars, **localStorage** only. Env vars
for cloud sync and AI features, full Supabase setup, and keeping a free-tier Supabase project
awake all live in **[docs/configuration.md](docs/configuration.md)**.

## Deploy

Two independent deploy targets — the frontend to GitHub Pages, and the optional
`musing-ai-service` backend to Cloud Run (secrets, GCP IAM setup, and rollback notes): see
**[docs/deploy.md](docs/deploy.md)**.

## Cursor — legacy compatibility only

This project is developed with Claude Code. Conventions live directly in
[`AGENTS.md`](AGENTS.md) / [`CLAUDE.md`](CLAUDE.md) — there are no separate
`.cursor/rules/*.mdc` files. `.cursor/skills` is kept only as a symlink to the canonical
`.claude/skills/` directory, for compatibility if this repo is opened in Cursor.

| Path                | Purpose                                                                                                    |
| :------------------ | :--------------------------------------------------------------------------------------------------------- |
| `.claude/skills/*/` | Canonical skills: editor-tiptap, supabase-sync, vitest-tests, ai-service — `.cursor/skills` symlinks here. |
| `.prettierrc`       | Prettier style — agents and CI follow it; use `npm run format` / `format:check`.                           |

## License

MIT — see [LICENSE](LICENSE).
