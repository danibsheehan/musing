"""Shared path analysis and PR guide content for musing."""

from __future__ import annotations

import re
from collections import defaultdict
from collections.abc import Iterable

AREA_RULES: list[tuple[str, tuple[str, ...]]] = [
    (
        "editor",
        (
            "src/components/Block.tsx",
            "src/components/Editor.tsx",
            "src/components/EditorTextFormatBubble.tsx",
            "src/components/EmojiSuggestionMenu.tsx",
            "src/components/PageBlockGutter.tsx",
            "src/components/PageDocument",
            "src/components/PagePickerMenu",
            "src/components/SlashMenu",
            "src/extensions/",
            "src/lib/blockEditorCommands",
            "src/lib/defaultBlocks",
            "src/lib/editorBlockText",
            "src/lib/editorBubbleMenuPortal",
            "src/lib/emojiSuggestion",
            "src/lib/resolveWikiPage",
            "src/lib/slashMenuOptions",
            "src/lib/tiptapMenuOpen",
        ),
    ),
    (
        "sync",
        (
            "src/components/AccountAuthControls",
            "src/context/",
            "src/lib/supabase",
            "src/lib/workspaceStorage",
            "src/lib/workspaceTree",
            "supabase/",
        ),
    ),
    (
        "database",
        (
            "src/components/Database",
            "src/lib/database",
            "src/lib/findDatabaseOwnerPage",
            "src/extensions/musingDatabaseEmbed",
        ),
    ),
    (
        "export",
        (
            "src/lib/downloadPageDocx",
            "src/lib/downloadPagePdf",
            "src/lib/htmlToDocx",
            "src/lib/pageToExportHtml",
            "src/lib/sanitizeExportFilename",
        ),
    ),
    (
        "app",
        (
            "src/App",
            "src/main",
            "src/components/AppLayout",
            "src/components/HomeRedirect",
            "src/components/PageChrome",
            "src/components/PageView",
            "src/components/Sidebar",
            "src/components/ThemePreferenceSelect",
        ),
    ),
    ("tests", (".test.", ".spec.")),
    ("ci", (".github/",)),
    ("docs", ("README.md", "docs/", ".cursor/skills/", ".cursor/rules/")),
    ("config", ("package.json", "package-lock.json", "vite.config", "eslint.config", "tsconfig")),
]

AREA_DISPLAY = {
    "editor": "editor",
    "sync": "sync / Supabase",
    "database": "database embeds",
    "export": "export",
    "app": "app shell / routes",
    "tests": "tests",
    "ci": "CI / GitHub",
    "docs": "docs / agent guidance",
    "config": "tooling config",
    "other": "other",
}

META_START = "<!-- pr-guide-meta:start -->"
META_END = "<!-- pr-guide-meta:end -->"

SUMMARY_PROMPT = "<!-- What changed and why? -->"
VERIFY_PROMPT = "<!-- Commands run, manual checks, or N/A with rationale. -->"

LEGACY_TEMPLATE_MARKERS = ("## Checklist", "No unintended secrets")


def matches(path: str, prefixes: tuple[str, ...]) -> bool:
    return any(path == prefix or path.startswith(prefix) or prefix in path for prefix in prefixes)


def areas_for(path: str) -> list[str]:
    areas: list[str] = []
    for area, prefixes in AREA_RULES:
        if matches(path, prefixes):
            areas.append(area)
    return areas or ["other"]


def analyze_paths(paths: Iterable[str]) -> tuple[set[str], dict[str, int]]:
    area_counts: dict[str, int] = defaultdict(int)
    for path in paths:
        for area in areas_for(path):
            area_counts[area] += 1
    return set(area_counts), dict(area_counts)


def ordered_areas(areas: set[str]) -> list[str]:
    ordered = [area for area, _ in AREA_RULES if area in areas]
    if "other" in areas:
        ordered.append("other")
    return ordered


def format_touches(areas: set[str]) -> str:
    ordered = ordered_areas(areas)
    if not ordered:
        return "none detected"
    return ", ".join(AREA_DISPLAY[area] for area in ordered)


def verify_commands(areas: set[str]) -> list[str]:
    commands: list[str] = []
    if areas & {"editor", "sync", "database", "export", "app", "config"}:
        commands.extend(
            [
                "`npm run lint`",
                "`npm run test:run` or targeted Vitest files for the changed area",
                "`npm run build`",
            ]
        )
    elif "tests" in areas:
        commands.append("`npm run test:run` or targeted Vitest files")

    if "sync" in areas:
        commands.append("Optional Supabase smoke check with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set")
    if "ci" in areas:
        commands.append("Review workflow syntax and required permissions in GitHub Actions")
    if not commands:
        commands.append("N/A - docs/tooling only; confirm locally if anything user-facing changed")
    return commands


def checklist_items(areas: set[str]) -> list[str]:
    items = ["No unintended secrets or local-only config committed"]
    if "editor" in areas:
        items.append("Editor interactions checked: typing, slash menu, page links, drag/reorder, and selection formatting as applicable")
    if "sync" in areas:
        items.append("Local-only mode still works when Supabase env vars are absent")
        items.append("Supabase mode remains RLS-scoped and anonymous-auth compatible")
    if "database" in areas:
        items.append("Database table/canvas embeds preserve saved page data")
    if "export" in areas:
        items.append("PDF and DOCX export still handle the changed page content")
    if "app" in areas:
        items.append("Routes work with `import.meta.env.BASE_URL` for GitHub Pages subpath hosting")
    if "ci" in areas:
        items.append("Workflow permissions are scoped to the PR-guide behavior")
    if "tests" not in areas and areas & {"editor", "sync", "database", "export", "app"}:
        items.append("Tests added or updated for changed behavior, or noted why not")
    return items


def reviewer_focus(areas: set[str], paths: list[str]) -> list[str]:
    focus: list[str] = []
    if "editor" in areas:
        focus.append("Block-editor behavior, TipTap/ProseMirror invariants, keyboard interactions, and serialization compatibility")
    if "sync" in areas:
        focus.append("Workspace persistence, cross-tab behavior, Supabase auth/session handling, and RLS assumptions")
    if "database" in areas:
        focus.append("Database embed ownership, row/field persistence, and page document rendering")
    if "export" in areas:
        focus.append("Exported HTML/PDF/DOCX output and filename handling")
    if "app" in areas:
        focus.append("Routing, layout state, and Pages `BASE_URL` behavior")
    if "ci" in areas:
        focus.append("Workflow event triggers, token permissions, and label/comment behavior on same-repo vs fork PRs")
    if "config" in areas:
        focus.append("Dependency, Vite, TypeScript, and ESLint changes that can affect local and CI runs")
    if any(path.endswith((".test.ts", ".test.tsx")) or ".test." in path or ".spec." in path for path in paths):
        focus.append("Test assertions cover the behavior under review rather than only implementation details")
    if not focus:
        focus.append("Scope looks docs- or tooling-only; confirm there is no hidden runtime impact")
    return focus


def _strip_html_comments(text: str) -> str:
    return re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL).strip()


def is_legacy_template(body: str) -> bool:
    return any(marker in body for marker in LEGACY_TEMPLATE_MARKERS)


def summary_section_is_empty(body: str) -> bool:
    match = re.search(r"## Summary\s*\n+(.*?)\n+## How to verify", body, re.DOTALL | re.IGNORECASE)
    if not match:
        return True
    return not _strip_html_comments(match.group(1))


def should_full_scaffold(body: str) -> bool:
    stripped = body.strip()
    if not stripped:
        return True
    if is_legacy_template(body):
        return True
    if "## Summary" in body and "## How to verify" in body and summary_section_is_empty(body):
        return META_START not in body
    return False


def has_meta_block(body: str) -> bool:
    return META_START in body and META_END in body


def build_meta_block(areas: set[str]) -> str:
    return (
        f"**Touches:** {format_touches(areas)}\n\n"
        "Checklist and reviewer focus: see the **PR guide** comment on this PR "
        "(updated on each push)."
    )


def build_full_body(areas: set[str], verify: list[str]) -> str:
    verify_lines = [VERIFY_PROMPT, ""] + [f"- {command}" for command in verify]
    return "\n".join(
        [
            "## Summary",
            "",
            SUMMARY_PROMPT,
            "",
            "## How to verify",
            "",
            *verify_lines,
            "",
            META_START,
            build_meta_block(areas),
            META_END,
            "",
        ]
    )


def merge_pr_body(current: str, areas: set[str], verify: list[str]) -> str | None:
    if should_full_scaffold(current):
        return build_full_body(areas, verify)
    if has_meta_block(current):
        meta = f"{META_START}\n{build_meta_block(areas)}\n{META_END}"
        return re.sub(
            re.escape(META_START) + r".*?" + re.escape(META_END),
            meta,
            current,
            count=1,
            flags=re.DOTALL,
        )
    return None
