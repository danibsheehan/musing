---
name: doc-writer
description: >
  Generates high-quality documentation for JavaScript/TypeScript and Go codebases.
  Use this skill whenever a user asks to write, generate, update, improve, or create
  documentation of any kind — including README files, API docs (JSDoc/GoDoc), inline
  code comments, or function-level docstrings. Trigger even for vague requests like
  "document this", "add docs to my code", "write a README", "explain this function",
  or "make this repo easier to understand". When in doubt, use this skill.
---

# Doc Writer Skill

Generates clear, consistent, production-quality documentation for JS/TS and Go projects.
Covers three output types: **README files**, **API/function docs**, and **inline code comments**.
All output is written in Markdown (`.md`) unless writing inline source annotations.

---

## Step 1: Classify the Request

Determine which doc type(s) are needed:

| Request                                                     | Doc Type                               |
| ----------------------------------------------------------- | -------------------------------------- |
| "Write a README", "document this repo"                      | → README                               |
| "Document this function/class/interface", "add JSDoc/GoDoc" | → API Docs                             |
| "Add comments", "explain what this code does inline"        | → Inline Comments                      |
| Mixed / ambiguous                                           | → Ask, or default to README + API Docs |

---

## Step 2: Gather Context

Before writing, read the relevant files:

- **README**: Scan repo structure, `package.json` / `go.mod`, existing README if any, entry points, exported symbols
- **API Docs**: Read the specific file(s) containing the functions/types to document
- **Inline Comments**: Read the specific functions or blocks to annotate

Use `bash_tool` to explore if needed:

```bash
# JS/TS: find exported functions/types
grep -rn "^export " src/ --include="*.ts" | head -40

# Go: find exported symbols
grep -rn "^func \|^type \|^var \|^const " *.go | grep -v "_test.go" | head -40

# Repo overview
find . -maxdepth 2 -name "*.md" -o -name "package.json" -o -name "go.mod" | head -20
```

---

## Step 3: Write the Documentation

Read the appropriate reference file for the doc type before writing:

- **README** → read `references/readme.md`
- **API Docs (JS/TS)** → read `references/jsdoc.md`
- **API Docs (Go)** → read `references/godoc.md`
- **Inline Comments** → read `references/inline-comments.md`

Then produce the output following those guidelines exactly.

---

## Step 4: Deliver

- **Write files in the workspace** at the paths the user asked for (e.g. repo root `README.md`,
  or next to the source file). Edit existing files in place when updating docs.
- Do **not** use Claude-specific output paths or external "present file" steps — use normal
  file create/edit in this project.
- Summarize for the user: what changed, where, and any gaps they should fill in.

---

## This repo (musing)

- **Features**: reflect shipped UI (editor, wiki links, databases, export, theme). Do not list
  planned work as shipped.
- **Run / scripts**: match `package.json` scripts (`dev`, `build`, `lint`, `format`,
  `format:check`, `test`, `test:run`, `test:coverage`).
- **Stack / layout**: match real entry points under `src/` and TipTap / Vite alias notes in
  `vite.config.ts`. Keep the README Stack table and AGENTS.md's `## Stack` line aligned with
  `package.json` (CI runs `.github/scripts/check_stack_docs.py`).
- **Configuration**: `VITE_SUPABASE_*`, `VITE_AI_SERVICE_URL`, `VITE_BASE_PATH` — same names as
  `.env.example` and GitHub Actions secrets where documented.
- **Supabase**: setup steps must match `supabase/schema.sql` and anonymous auth behavior in
  `WorkspaceContext` / the `supabase-sync` skill.
- **CI / Pages**: if coverage thresholds, deploy, keepalive, stack-docs, or PR-guide behavior
  changes, update the README summary and the workflow files in the same spirit.
- Prefer short tables and copy-pasteable commands. Link to `.github/pull_request_template.md`
  for contribution expectations rather than duplicating long policy text.
