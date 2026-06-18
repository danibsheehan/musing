#!/usr/bin/env python3
"""Scaffold or refresh the auto-generated metadata in a PR description."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from pr_guide_lib import analyze_paths, merge_pr_body, verify_commands


def read_paths(paths_file: str) -> list[str]:
    return [
        line.strip()
        for line in Path(paths_file).read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths_file", help="Changed paths, one per line")
    parser.add_argument("--current-body", required=True, help="Existing PR description file")
    args = parser.parse_args()

    paths = read_paths(args.paths_file)
    current = Path(args.current_body).read_text(encoding="utf-8")
    areas, _ = analyze_paths(paths)
    merged = merge_pr_body(current, areas, verify_commands(areas))
    if merged is None:
        return 1

    sys.stdout.write(merged)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
