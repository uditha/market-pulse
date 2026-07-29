"""News scrape orchestration: fetch → rank → ingest."""

from __future__ import annotations

import json
import os
import time
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import httpx

from .finance_filter import filter_finance
from .html_listing import fetch_html_listing
from .next_data import fetch_echelon_next, fetch_the_morning_next
from .rss import fetch_rss
from .sources import NEWS_EDITION_CAP, SOURCE_BY_ID, SOURCES

API_URL = os.environ.get("API_URL", "http://localhost:4000")
COLOMBO = ZoneInfo("Asia/Colombo")
NEWS_SLOT = "latest"


def colombo_today() -> str:
    return datetime.now(COLOMBO).date().isoformat()


def _publish_ts(item: dict[str, Any]) -> float:
    """Epoch seconds for sorting; missing/invalid dates sort last."""
    raw = item.get("publishedAt")
    if not raw:
        return float("-inf")
    try:
        # Support Z / offset ISO strings from RSS adapters
        s = str(raw).replace("Z", "+00:00")
        return datetime.fromisoformat(s).timestamp()
    except ValueError:
        return float("-inf")


def rank_by_recency(
    by_source: dict[str, list[dict[str, Any]]], cap: int
) -> list[dict[str, Any]]:
    """Newest first across outlets; missing publish times fall to the bottom."""
    seen_urls: set[str] = set()
    flat: list[dict[str, Any]] = []
    for source in SOURCES:
        for item in by_source.get(source["id"], []):
            url = item.get("url")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            flat.append(item)
    # Any unexpected source ids not in SOURCES order
    for sid, items in by_source.items():
        if sid in SOURCE_BY_ID:
            continue
        for item in items:
            url = item.get("url")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            flat.append(item)

    flat.sort(key=_publish_ts, reverse=True)
    return flat[:cap]


def fetch_source(source: dict[str, Any]) -> list[dict[str, Any]]:
    kind = source["kind"]
    if kind == "rss":
        return fetch_rss(source)
    if kind == "html_listing":
        return fetch_html_listing(source)
    if kind == "next_data":
        if source["id"] == "echelon":
            return fetch_echelon_next(source)
        if source["id"] == "the-morning":
            return fetch_the_morning_next(source)
        raise ValueError(f"No next_data adapter for {source['id']}")
    raise ValueError(f"Unknown kind {kind}")


def post_ingest(
    *,
    edition_date: str,
    articles: list[dict[str, Any]],
    cap: int,
    dry_run: bool,
) -> dict[str, Any]:
    payload = {
        "slot": NEWS_SLOT,
        "editionDate": edition_date,
        "cap": cap,
        "articles": [
            {
                "sourceId": a["sourceId"],
                "url": a["url"],
                "title": a["title"],
                "summary": a.get("summary") or "",
                "imageUrl": a.get("imageUrl"),
                "publishedAt": a.get("publishedAt"),
                "contentHash": a["contentHash"],
            }
            for a in articles
        ],
    }
    if dry_run:
        return {"dryRun": True, "wouldIngest": len(articles), "payload": payload}
    with httpx.Client(timeout=60.0) as client:
        res = client.post(f"{API_URL}/ingest/news", json=payload)
        res.raise_for_status()
        return res.json()


def run(
    *,
    sources: list[str] | None = None,
    cap: int = NEWS_EDITION_CAP,
    delay: float = 0.6,
    dry_run: bool = False,
) -> dict[str, Any]:
    edition_date = colombo_today()
    selected = [
        s
        for s in SOURCES
        if s["enabled"] and (not sources or s["id"] in sources)
    ]

    by_source: dict[str, list[dict[str, Any]]] = {}
    report: list[dict[str, Any]] = []

    for i, source in enumerate(selected):
        print(f"[news] fetching {source['id']} ({source['kind']})…", flush=True)
        try:
            items = filter_finance(fetch_source(source))
            by_source[source["id"]] = items
            report.append(
                {
                    "sourceId": source["id"],
                    "ok": True,
                    "count": len(items),
                }
            )
            print(f"[news]   {source['id']}: {len(items)} finance items", flush=True)
        except Exception as exc:
            report.append(
                {
                    "sourceId": source["id"],
                    "ok": False,
                    "error": str(exc),
                    "count": 0,
                }
            )
            print(f"[news]   {source['id']} FAILED: {exc}", flush=True)
        if i < len(selected) - 1 and delay > 0:
            time.sleep(delay)

    ranked = rank_by_recency(by_source, cap)
    print(
        f"[news] snapshot {edition_date}: {len(ranked)} items (cap {cap})",
        flush=True,
    )

    ingest: dict[str, Any] | None = None
    try:
        ingest = post_ingest(
            edition_date=edition_date,
            articles=ranked,
            cap=cap,
            dry_run=dry_run,
        )
        print(f"[news] ingest: {json.dumps(ingest)[:400]}", flush=True)
    except Exception as exc:
        print(f"[news] ingest FAILED: {exc}", flush=True)
        ingest = {"ok": False, "error": str(exc)}

    summary = {
        "ok": all(r["ok"] for r in report) or len(ranked) > 0,
        "slot": NEWS_SLOT,
        "editionDate": edition_date,
        "totalArticles": len(ranked),
        "sources": report,
        "ingest": ingest,
    }
    print("---SUMMARY_JSON---", flush=True)
    print(json.dumps(summary), flush=True)
    print("---END_SUMMARY---", flush=True)
    return summary


def get_source(source_id: str) -> dict[str, Any] | None:
    return SOURCE_BY_ID.get(source_id)
