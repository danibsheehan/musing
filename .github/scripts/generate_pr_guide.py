#!/usr/bin/env python3
"""Build a sticky PR guide comment from changed paths."""

from __future__ import annotations

import os
import sys

from pr_guide_lib import (
    AREA_DISPLAY,
    AREA_RULES,
    analyze_paths,
    checklist_items,
    format_touches,
    reviewer_focus,
    verify_commands,
)


def read_paths(argv: list[str]) -> list[str]:
    if len(argv) > 1:
        with open(argv[1], encoding="utf-8") as handle:
            return [line.strip() for line in handle if line.strip()]
    return [line.strip() for line in sys.stdin if line.strip()]


def main() -> int:
    paths = read_paths(sys.argv)
    areas, area_counts = analyze_paths(paths)
    diff_stat = os.environ.get("DIFF_SHORTSTAT", "").strip()
    commit_lines = [
        line.strip()
        for line in os.environ.get("COMMIT_LINES", "").splitlines()
        if line.strip()
    ]

    lines: list[str] = [
        "## PR guide",
        "",
        "_Auto-generated from changed paths. Fill in **Summary** and **How to verify** in the PR description above._",
        "",
        f"**Touches:** {format_touches(areas)}",
    ]

    if diff_stat:
        lines.extend(["", f"**Diff:** {diff_stat}"])

    lines.extend(["", "### Suggested verify", ""])
    lines.extend(f"- {command}" for command in verify_commands(areas))

    lines.extend(["", "### Checklist (applies to this PR)", ""])
    lines.extend(f"- [ ] {item}" for item in checklist_items(areas))

    lines.extend(["", "### Reviewer focus", ""])
    lines.extend(f"- {item}" for item in reviewer_focus(areas, paths))

    if commit_lines:
        lines.extend(["", "### Commits", ""])
        lines.extend(f"- `{line}`" for line in commit_lines[:15])
        if len(commit_lines) > 15:
            lines.append(f"- _...and {len(commit_lines) - 15} more_")

    lines.extend(["", "### Files by area", "", "| Area | Files |", "| --- | ---: |"])
    for area, _ in AREA_RULES:
        if area in area_counts:
            lines.append(f"| {AREA_DISPLAY[area]} | {area_counts[area]} |")
    if "other" in area_counts:
        lines.append(f"| {AREA_DISPLAY['other']} | {area_counts['other']} |")

    repo_url = os.environ.get("GITHUB_REPO_URL", "").rstrip("/")
    if repo_url:
        ci_href = f"{repo_url}/blob/main/.github/workflows/ci.yml"
        template_href = f"{repo_url}/blob/main/.github/pull_request_template.md"
    else:
        ci_href = ".github/workflows/ci.yml"
        template_href = ".github/pull_request_template.md"

    lines.extend(
        [
            "",
            "### CI",
            "",
            f"Primary check: [CI]({ci_href}) runs Vitest coverage for every PR. Coverage tables are posted separately.",
            "",
            "---",
            "",
            f"Template: [`pull_request_template.md`]({template_href})",
        ]
    )

    sys.stdout.write("\n".join(lines) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
