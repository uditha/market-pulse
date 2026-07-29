"""RSS / Atom adapters."""

from __future__ import annotations

import gzip
from typing import Any
from xml.etree import ElementTree as ET

from .base import (
    absolute_url,
    canonicalize_url,
    content_hash,
    fetch_bytes,
    is_mostly_latin,
    parse_published,
    save_raw,
    strip_html,
    truncate_summary,
)

NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "content": "http://purl.org/rss/1.0/modules/content/",
    "media": "http://search.yahoo.com/mrss/",
    "dc": "http://purl.org/dc/elements/1.1/",
}


def _local(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[-1]
    return tag


def _text(el: ET.Element | None) -> str:
    if el is None or el.text is None:
        return ""
    return el.text.strip()


def _find_text(parent: ET.Element, names: list[str]) -> str:
    for child in parent:
        if _local(child.tag) in names:
            t = _text(child)
            if t:
                return t
            # Some titles wrap text in nested elements
            joined = "".join(child.itertext()).strip()
            if joined:
                return joined
    return ""


def _find_link(parent: ET.Element) -> str | None:
    for child in parent:
        if _local(child.tag) == "link":
            href = child.get("href")
            if href:
                return href.strip()
            t = _text(child)
            if t:
                return t
    return None


def _find_image(parent: ET.Element) -> str | None:
    for child in parent:
        local = _local(child.tag)
        if local == "enclosure":
            url = child.get("url")
            typ = (child.get("type") or "").lower()
            if url and (not typ or typ.startswith("image")):
                return url
        if local == "content" and child.get("url") and (
            (child.get("medium") or "").lower() == "image"
            or (child.get("type") or "").lower().startswith("image")
        ):
            return child.get("url")
        if local == "thumbnail" and child.get("url"):
            return child.get("url")
        if local == "image":
            for sub in child:
                if _local(sub.tag) == "url":
                    t = _text(sub)
                    if t:
                        return t
    # media:content nested
    for child in parent.iter():
        if _local(child.tag) in {"content", "thumbnail"} and child.get("url"):
            return child.get("url")
    return None


def _maybe_gunzip(data: bytes) -> bytes:
    if len(data) >= 2 and data[0] == 0x1F and data[1] == 0x8B:
        return gzip.decompress(data)
    return data


def parse_feed_xml(data: bytes, *, source_id: str, base_url: str) -> list[dict[str, Any]]:
    data = _maybe_gunzip(data)
    # Strip BOM
    if data.startswith(b"\xef\xbb\xbf"):
        data = data[3:]
    root = ET.fromstring(data)
    items: list[dict[str, Any]] = []

    # RSS 2.0
    channel_items = [el for el in root.iter() if _local(el.tag) == "item"]
    # Atom
    if not channel_items:
        channel_items = [el for el in root.iter() if _local(el.tag) == "entry"]

    for el in channel_items[:40]:
        title = strip_html(_find_text(el, ["title"]))
        link = _find_link(el)
        if not link:
            continue
        url = absolute_url(base_url, link)
        if not url:
            continue
        desc = _find_text(el, ["description", "summary", "content", "encoded"])
        if not desc:
            # atom content may be nested
            for child in el:
                if _local(child.tag) in {"content", "summary"}:
                    desc = "".join(child.itertext()).strip()
                    if desc:
                        break
        published = parse_published(
            _find_text(el, ["pubDate", "published", "updated", "date"]) or None
        )
        image = _find_image(el)
        image_url = absolute_url(base_url, image) if image else None
        summary = truncate_summary(desc) if desc else ""
        if not title:
            continue
        if len(title) < 24 or not is_mostly_latin(title):
            continue
        payload = f"{url}|{title}|{summary}"
        items.append(
            {
                "sourceId": source_id,
                "url": canonicalize_url(url),
                "title": title[:300],
                "summary": summary,
                "imageUrl": image_url,
                "publishedAt": published,
                "contentHash": content_hash(payload),
            }
        )
    return items


def fetch_rss(source: dict[str, Any]) -> list[dict[str, Any]]:
    raw = fetch_bytes(source["url"])
    save_raw(source["id"], raw, ext="xml")
    return parse_feed_xml(raw, source_id=source["id"], base_url=source["homepage"])
