"""CLI: python -m news"""

from __future__ import annotations

import argparse
import sys

from .pipeline import run
from .sources import NEWS_EDITION_CAP, SOURCES


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="LankaPulse business news scraper")
    parser.add_argument(
        "--slot",
        choices=["latest", "morning", "evening"],
        default="latest",
        help="Kept for compatibility; editions always use slot=latest",
    )
    parser.add_argument(
        "--sources",
        default="",
        help="Comma-separated source ids (default: all enabled)",
    )
    parser.add_argument("--cap", type=int, default=NEWS_EDITION_CAP)
    parser.add_argument("--delay", type=float, default=0.6)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--list-sources",
        action="store_true",
        help="Print registered sources and exit",
    )
    args = parser.parse_args(argv)
    void_slot = args.slot  # noqa: F841 — accepted, ignored
    del void_slot

    if args.list_sources:
        for s in SOURCES:
            flag = "on" if s["enabled"] else "off"
            print(f"{s['id']:20} {s['kind']:14} [{flag}] {s['url']}")
        return 0

    source_ids = [x.strip() for x in args.sources.split(",") if x.strip()] or None
    summary = run(
        sources=source_ids,
        cap=args.cap,
        delay=args.delay,
        dry_run=args.dry_run,
    )
    return 0 if summary.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
