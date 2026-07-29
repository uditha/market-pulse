"""HTML listing adapters for outlets without reliable RSS."""

from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from .base import (
    absolute_url,
    canonicalize_url,
    content_hash,
    fetch_bytes,
    is_mostly_latin,
    make_soup,
    og_meta,
    save_raw,
    truncate_summary,
)


def _same_host(url: str, homepage: str) -> bool:
    try:
        return urlparse(url).netloc.replace("www.", "") == urlparse(
            homepage
        ).netloc.replace("www.", "")
    except Exception:
        return False


def _collect_links(
    soup_doc: Any,
    *,
    source_id: str,
    homepage: str,
    path_hints: tuple[str, ...] = (),
    limit: int = 12,
) -> list[dict[str, Any]]:
    seen: set[str] = set()
    items: list[dict[str, Any]] = []

    for a in soup_doc.find_all("a", href=True):
        href = a.get("href") or ""
        url = absolute_url(homepage, href)
        if not url or url in seen:
            continue
        if not _same_host(url, homepage):
            continue
        path = urlparse(url).path.lower()
        # Skip pure section / home / tag / author pages
        if path in {"", "/", "/business", "/categories/business"}:
            continue
        if any(
            skip in path
            for skip in (
                "/tag/",
                "/author/",
                "/category/",
                "/categories/",
                "/page/",
                "/login",
                "/search",
                "/wp-admin",
                "/feed",
            )
        ):
            continue
        if path_hints and not any(h in path for h in path_hints):
            # Still accept deep article-looking paths with enough segments
            segments = [s for s in path.split("/") if s]
            if len(segments) < 2:
                continue

        title = a.get_text(" ", strip=True)
        if not title or len(title) < 28:
            continue
        if not is_mostly_latin(title):
            continue
        low = title.lower()
        if low.startswith("articles by") or low.startswith("by "):
            continue
        if low in {"read more", "learn more", "see more", "view all"}:
            continue
        # Prefer anchors that look like headlines
        if len(title) > 220:
            title = title[:220]

        # Try nearby image
        image_url = None
        parent = a.parent
        for _ in range(4):
            if parent is None:
                break
            img = parent.find("img")
            if img and img.get("src"):
                image_url = absolute_url(homepage, img.get("src"))
                break
            parent = parent.parent

        summary = ""
        sibling = a.find_next(["p", "span", "div"])
        if sibling:
            summary = truncate_summary(sibling.get_text(" ", strip=True))

        seen.add(url)
        payload = f"{url}|{title}|{summary}"
        items.append(
            {
                "sourceId": source_id,
                "url": canonicalize_url(url),
                "title": title,
                "summary": summary,
                "imageUrl": image_url,
                "publishedAt": None,
                "contentHash": content_hash(payload),
            }
        )
        if len(items) >= limit:
            break
    return items


def _enrich_from_og(item: dict[str, Any]) -> dict[str, Any]:
    """Optionally fill missing summary/image from article og tags (best-effort)."""
    if item.get("summary") and item.get("imageUrl"):
        return item
    try:
        raw = fetch_bytes(item["url"], timeout=12.0)
        doc = make_soup(raw)
        if not item.get("summary"):
            desc = og_meta(doc, "og:description") or og_meta(doc, "description")
            if desc:
                item["summary"] = truncate_summary(desc)
        if not item.get("imageUrl"):
            img = og_meta(doc, "og:image")
            if img:
                item["imageUrl"] = absolute_url(item["url"], img)
        # refresh hash
        payload = f"{item['url']}|{item['title']}|{item.get('summary') or ''}"
        item["contentHash"] = content_hash(payload)
    except Exception:
        pass
    return item


def fetch_html_listing(source: dict[str, Any]) -> list[dict[str, Any]]:
    raw = fetch_bytes(source["url"])
    save_raw(source["id"], raw, ext="html")
    doc = make_soup(raw)
    sid = source["id"]
    homepage = source["homepage"]

    hints: tuple[str, ...] = ()
    if sid == "adaderana-biz":
        hints = ("/news/", "/business", "/hot-news")
    elif sid == "ft":
        hints = ("/business", "/columns", "/markets", "/front-page", "/news")
    elif sid == "daily-mirror-biz":
        hints = ("/business", "/breaking-news", "/print")
    elif sid == "sunday-times":
        hints = ("/business", "/news", "/columns")
    elif sid == "the-morning":
        hints = ("/articles/", "/article/", "/news/")
    elif sid == "echelon":
        hints = ("/article", "/features", "/magazine", "/news")

    items = _collect_links(
        doc,
        source_id=sid,
        homepage=homepage,
        path_hints=hints,
        limit=24,
    )

    # Enrich top few for better summaries when listing text is thin
    enriched: list[dict[str, Any]] = []
    for i, item in enumerate(items):
        if i < 4 and (not item.get("summary") or len(item["summary"]) < 40):
            enriched.append(_enrich_from_og(item))
        else:
            enriched.append(item)
    return enriched
