"""Shared fetch / normalize helpers for news scrapers."""

from __future__ import annotations

import hashlib
import html
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse, urlunparse

import httpx
from bs4 import BeautifulSoup

RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw" / "news"
RAW_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

SUMMARY_MAX = 180
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")


def content_hash(data: bytes | str) -> str:
    if isinstance(data, str):
        data = data.encode("utf-8", errors="replace")
    return hashlib.sha256(data).hexdigest()


def save_raw(source_id: str, data: bytes, ext: str = "xml") -> tuple[str, str]:
    h = content_hash(data)
    name = f"{source_id}_{h[:10]}.{ext}"
    path = RAW_DIR / name
    if not path.exists():
        path.write_bytes(data)
    return str(path), h


def strip_html(text: str | None) -> str:
    if not text:
        return ""
    text = html.unescape(TAG_RE.sub(" ", text))
    return WS_RE.sub(" ", text).strip()


def truncate_summary(text: str, max_len: int = SUMMARY_MAX) -> str:
    text = strip_html(text)
    if len(text) <= max_len:
        return text
    cut = text[: max_len - 1].rsplit(" ", 1)[0]
    return (cut or text[: max_len - 1]).rstrip(".,;:") + "…"


def is_mostly_latin(text: str) -> bool:
    """Prefer English headlines for the desk snapshot (skip Sinhala-only rows)."""
    letters = [c for c in text if c.isalpha()]
    if len(letters) < 8:
        return True
    latin = sum(1 for c in letters if "A" <= c <= "Z" or "a" <= c <= "z")
    return (latin / len(letters)) >= 0.55


def canonicalize_url(url: str) -> str:
    url = url.strip()
    parsed = urlparse(url)
    clean = parsed._replace(fragment="")
    path = clean.path or "/"
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    return urlunparse(clean._replace(path=path))


def absolute_url(base: str, href: str | None) -> str | None:
    if not href:
        return None
    href = href.strip()
    if href.startswith("data:"):
        return None
    return canonicalize_url(urljoin(base, href))


def fetch_bytes(url: str, *, timeout: float = 35.0) -> bytes:
    with httpx.Client(headers=HEADERS, follow_redirects=True, timeout=timeout) as client:
        res = client.get(url)
        res.raise_for_status()
        return res.content


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_published(value: str | None) -> str | None:
    if not value:
        return None
    value = value.strip()
    for fmt in (
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S %Z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    ):
        try:
            if fmt.endswith("Z") and value.endswith("Z"):
                dt = datetime.strptime(value, fmt).replace(tzinfo=timezone.utc)
            else:
                cleaned = value
                if "%z" in fmt and value.endswith("Z"):
                    cleaned = value[:-1] + "+0000"
                dt = datetime.strptime(cleaned, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc).isoformat()
        except ValueError:
            continue
    return value


def make_soup(html_bytes: bytes) -> BeautifulSoup:
    return BeautifulSoup(html_bytes, "lxml")


def og_meta(soup_doc: Any, prop: str) -> str | None:
    tag = soup_doc.find("meta", property=prop) or soup_doc.find(
        "meta", attrs={"name": prop}
    )
    if not tag:
        return None
    content = tag.get("content")
    return content.strip() if content else None
