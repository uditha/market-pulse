"""Adapters that read article lists from Next.js __NEXT_DATA__ JSON."""

from __future__ import annotations

import json
from typing import Any

from .base import (
    canonicalize_url,
    content_hash,
    fetch_bytes,
    is_mostly_latin,
    make_soup,
    parse_published,
    save_raw,
    truncate_summary,
)


def _next_props(html: bytes) -> dict[str, Any]:
    doc = make_soup(html)
    tag = doc.find("script", id="__NEXT_DATA__")
    if not tag or not tag.string:
        return {}
    try:
        data = json.loads(tag.string)
    except json.JSONDecodeError:
        return {}
    props = data.get("props", {}).get("pageProps", {})
    return props if isinstance(props, dict) else {}


def fetch_echelon_next(source: dict[str, Any]) -> list[dict[str, Any]]:
    raw = fetch_bytes(source["url"])
    save_raw(source["id"], raw, ext="html")
    props = _next_props(raw)
    posts = props.get("posts") or []
    if not isinstance(posts, list):
        return []

    items: list[dict[str, Any]] = []
    for post in posts[:40]:
        if not isinstance(post, dict):
            continue
        title = (post.get("title") or "").strip()
        slug = (post.get("slug") or "").strip()
        if not title or not slug or len(title) < 24 or not is_mostly_latin(title):
            continue
        url = canonicalize_url(f"https://echelon.lk/{slug}/")
        summary = truncate_summary(post.get("excerpt") or "")
        image = post.get("featured_image") or post.get("vertical_image")
        published = parse_published(post.get("date"))
        payload = f"{url}|{title}|{summary}"
        items.append(
            {
                "sourceId": source["id"],
                "url": url,
                "title": title[:300],
                "summary": summary,
                "imageUrl": image,
                "publishedAt": published,
                "contentHash": content_hash(payload),
            }
        )
    return items


def fetch_the_morning_next(source: dict[str, Any]) -> list[dict[str, Any]]:
    """Homepage embeds latestNews in __NEXT_DATA__; deep links use /articles/{id} when live."""
    raw = fetch_bytes(source["url"])
    save_raw(source["id"], raw, ext="html")
    props = _next_props(raw)
    posts = props.get("latestNews") or []
    if not isinstance(posts, list):
        return []

    items: list[dict[str, Any]] = []
    for post in posts[:40]:
        if not isinstance(post, dict):
            continue
        title = (post.get("title") or "").strip()
        pid = (post.get("id") or "").strip()
        if not title or not pid or len(title) < 24 or not is_mostly_latin(title):
            continue
        # Prefer category business/economy when present; still keep general desk news.
        cat = (post.get("category") or "").lower()
        meta = post.get("meta") if isinstance(post.get("meta"), dict) else {}
        excerpt = ""
        if isinstance(meta, dict):
            excerpt = meta.get("excerpt") or ""
            created = meta.get("createdAt")
        else:
            created = None
        if not excerpt:
            excerpt = (post.get("content") or "")[:400]
        summary = truncate_summary(excerpt)
        # Public article deep-links are unstable; unique query keeps history/dedupe.
        url = canonicalize_url(f"https://www.themorning.lk/?a={pid}")
        image = post.get("media") if isinstance(post.get("media"), str) else None
        if image and not image.startswith("http"):
            image = None
        published = parse_published(created) if created else None
        payload = f"{url}|{title}|{summary}|{cat}"
        items.append(
            {
                "sourceId": source["id"],
                "url": url,
                "title": title[:300],
                "summary": summary,
                "imageUrl": image,
                "publishedAt": published,
                "contentHash": content_hash(payload),
            }
        )
    return items
