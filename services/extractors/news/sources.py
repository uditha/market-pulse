"""Sri Lanka business news outlets — mirrored from packages/shared/src/news.ts."""

from __future__ import annotations

from typing import Any

NEWS_EDITION_CAP = 100

# Keep in sync with packages/shared/src/news.ts
SOURCES: list[dict[str, Any]] = [
    {
        "id": "economynext",
        "name": "EconomyNext",
        "homepage": "https://economynext.com/",
        "kind": "rss",
        "url": "https://economynext.com/feed/",
        "enabled": True,
    },
    {
        "id": "lbo",
        "name": "Lanka Business Online",
        "homepage": "https://www.lankabusinessonline.com/",
        "kind": "rss",
        "url": "https://www.lankabusinessonline.com/feed/",
        "enabled": True,
    },
    {
        "id": "adaderana-biz",
        "name": "Ada Derana Biz",
        "homepage": "https://bizenglish.adaderana.lk/",
        "kind": "rss",
        "url": "https://bizenglish.adaderana.lk/feed/",
        "enabled": True,
    },
    {
        "id": "lmd",
        "name": "LMD",
        "homepage": "https://lmd.lk/",
        "kind": "rss",
        "url": "https://lmd.lk/feed/",
        "enabled": True,
    },
    {
        "id": "business-today",
        "name": "Business Today",
        "homepage": "https://businesstoday.lk/",
        "kind": "rss",
        "url": "https://businesstoday.lk/feed/",
        "enabled": True,
    },
    {
        "id": "newswire",
        "name": "NewsWire",
        "homepage": "https://www.newswire.lk/",
        "kind": "rss",
        "url": "https://www.newswire.lk/feed/",
        "enabled": True,
    },
    {
        "id": "ft",
        "name": "Daily FT",
        "homepage": "https://www.ft.lk/",
        "kind": "html_listing",
        "url": "https://www.ft.lk/",
        "enabled": True,
    },
    {
        "id": "echelon",
        "name": "Echelon",
        "homepage": "https://www.echelon.lk/",
        "kind": "next_data",
        "url": "https://echelon.lk/category/features/",
        "enabled": True,
    },
    {
        "id": "daily-mirror-biz",
        "name": "Daily Mirror Business",
        "homepage": "https://www.dailymirror.lk/business",
        "kind": "html_listing",
        "url": "https://www.dailymirror.lk/business",
        "enabled": True,
    },
    {
        "id": "sunday-times",
        "name": "Sunday Times Business",
        "homepage": "https://www.sundaytimes.lk/",
        "kind": "html_listing",
        "url": "https://www.sundaytimes.lk/",
        "enabled": True,
    },
    {
        "id": "the-morning",
        "name": "The Morning",
        "homepage": "https://www.themorning.lk/",
        "kind": "next_data",
        "url": "https://www.themorning.lk/",
        "enabled": True,
    },
]

SOURCE_BY_ID = {s["id"]: s for s in SOURCES}
