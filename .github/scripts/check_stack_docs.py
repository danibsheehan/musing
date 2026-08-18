#!/usr/bin/env python3
"""Fail if README / project-stack versions drift from package.json and CI.

Sources of truth:
  - package.json — react, typescript, vite, react-router, @tiptap/react
  - .github/workflows/ci.yml — node-version

Checked docs:
  - README.md Stack table
  - .cursor/rules/musing-project.mdc Stack line
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _strip_npm_range(version: str) -> str:
    return version.strip().lstrip("^~>=< ")


def npm_major(version: str) -> str:
    return _strip_npm_range(version).split(".")[0]


def npm_major_minor(version: str) -> str:
    parts = _strip_npm_range(version).split(".")
    if len(parts) < 2:
        raise ValueError(f"expected major.minor in npm version {version!r}")
    return f"{parts[0]}.{parts[1]}"


def read_package_versions(package_json: Path) -> dict[str, str]:
    data = json.loads(package_json.read_text(encoding="utf-8"))
    deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
    required = ("react", "typescript", "vite", "react-router", "@tiptap/react")
    missing = [name for name in required if name not in deps]
    if missing:
        raise ValueError(f"{package_json}: missing {', '.join(missing)}")
    return {
        "react_major": npm_major(deps["react"]),
        "typescript_mm": npm_major_minor(deps["typescript"]),
        "vite_major": npm_major(deps["vite"]),
        "router_major": npm_major(deps["react-router"]),
        "tiptap_major": npm_major(deps["@tiptap/react"]),
    }


def read_ci_node_major(ci_yml: Path) -> str:
    text = ci_yml.read_text(encoding="utf-8")
    node = re.search(r"(?m)^\s*node-version:\s*['\"]?(\d+)['\"]?\s*$", text)
    if not node:
        raise ValueError(f"{ci_yml}: no node-version")
    return node.group(1)


def require_contains(path: Path, needle: str, label: str, errors: list[str]) -> None:
    text = path.read_text(encoding="utf-8")
    if needle not in text:
        errors.append(f"{path.relative_to(ROOT)}: missing {label} ({needle!r})")


def check_readme(readme: Path, versions: dict[str, str], errors: list[str]) -> None:
    text = readme.read_text(encoding="utf-8")
    stack_match = re.search(
        r"(?ms)^## Stack\n(.*?)(?=\n## |\Z)",
        text,
    )
    if not stack_match:
        errors.append(f"{readme.relative_to(ROOT)}: missing ## Stack section")
        return
    stack = stack_match.group(1)
    checks = [
        (f"React {versions['react_major']}", "React major"),
        (f"React Router {versions['router_major']}", "React Router major"),
        (f"Vite {versions['vite_major']}", "Vite major"),
        (f"TypeScript {versions['typescript_mm']}", "TypeScript major.minor"),
    ]
    for needle, label in checks:
        if needle not in stack:
            errors.append(
                f"{readme.relative_to(ROOT)} Stack table: missing {label} ({needle!r})"
            )


def check_project_rule(rule: Path, versions: dict[str, str], errors: list[str]) -> None:
    text = rule.read_text(encoding="utf-8")
    stack_match = re.search(r"(?ms)^## Stack\n(.*?)(?=\n## |\Z)", text)
    if not stack_match:
        errors.append(f"{rule.relative_to(ROOT)}: missing ## Stack section")
        return
    stack = stack_match.group(1)
    checks = [
        (f"Vite {versions['vite_major']}", "Vite major"),
        (f"React {versions['react_major']}", "React major"),
        (f"React Router {versions['router_major']}", "React Router major"),
        (f"TipTap {versions['tiptap_major']}", "TipTap major"),
    ]
    for needle, label in checks:
        if needle not in stack:
            errors.append(
                f"{rule.relative_to(ROOT)} Stack line: missing {label} ({needle!r})"
            )


def main() -> int:
    errors: list[str] = []
    try:
        versions = read_package_versions(ROOT / "package.json")
        node_major = read_ci_node_major(ROOT / ".github/workflows/ci.yml")
    except ValueError as exc:
        print(f"check_stack_docs: {exc}", file=sys.stderr)
        return 1

    check_readme(ROOT / "README.md", versions, errors)
    check_project_rule(ROOT / ".cursor/rules/musing-project.mdc", versions, errors)

    # If docs mention a Node major, it must match CI (CI is the source of truth).
    for path in (ROOT / "README.md", ROOT / ".cursor/rules/musing-project.mdc"):
        text = path.read_text(encoding="utf-8")
        for match in re.finditer(r"\bNode(?:\.js)?\s+(\d+)\b", text):
            if match.group(1) != node_major:
                errors.append(
                    f"{path.relative_to(ROOT)}: Node {match.group(1)} does not match "
                    f"CI node-version {node_major}"
                )

    if errors:
        print("Stack docs drift detected:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        print(
            "\nUpdate README / .cursor/rules/musing-project.mdc to match "
            "package.json and .github/workflows/ci.yml.",
            file=sys.stderr,
        )
        return 1

    print(
        "Stack docs OK: "
        f"React {versions['react_major']}, "
        f"TypeScript {versions['typescript_mm']}, "
        f"Vite {versions['vite_major']}, "
        f"React Router {versions['router_major']}, "
        f"TipTap {versions['tiptap_major']}, "
        f"Node {node_major} (CI)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
