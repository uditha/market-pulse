"""Shared helpers for CBSL DEI / WEI / MEI PDF scrapers.

Design goals for long-term reliability:
- Discover PDF URLs from Drupal listing pages (never hard-code daily filenames).
- Always send a Referer (CBSL returns 404 without it on some PDFs).
- Parse with pdfplumber text + label-anchored regex (not glyph-scrambled pdftotext).
- Never emit series that overlap locked eResearch / policy / CPI primaries.
- Fixture self-tests pin expected values so layout drift fails loudly.
"""

from __future__ import annotations

import hashlib
import re
import time
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Iterable
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

MONTHS = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "sept": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}

# Series owned by locked eResearch / dedicated scrapers — never ingest from PDFs.
OVERLAP_SKIP_SERIES = frozenset(
    {
        # Money Market Summary / Daily Ops / Term Repo (locked)
        "sl.mm.call.min_rate",
        "sl.mm.call.max_rate",
        "sl.mm.call.wa_yield",
        "sl.mm.call.volume",
        "sl.mm.repo.min_rate",
        "sl.mm.repo.max_rate",
        "sl.mm.repo.wa_yield",
        "sl.mm.repo.volume",
        "sl.mm.omo.offer_repo",
        "sl.mm.omo.offer_reverse_repo",
        "sl.mm.omo.received",
        "sl.mm.omo.accepted",
        "sl.mm.omo.min_rate",
        "sl.mm.omo.max_rate",
        "sl.mm.omo.wa_yield",
        "sl.mm.sdf.volume",
        "sl.mm.sdf.rate",
        "sl.mm.slf.volume",
        "sl.mm.slf.rate",
        "sl.mm.overnight_liquidity",
        "sl.mm.cbsl.gov_holdings",
        "sl.mm.term_repo.offer_repo",
        "sl.mm.term_repo.offer_reverse_repo",
        "sl.mm.term_repo.received",
        "sl.mm.term_repo.accepted",
        "sl.mm.term_repo.min_rate",
        "sl.mm.term_repo.max_rate",
        "sl.mm.term_repo.wa_yield",
        "sl.mm.term_repo.tenure",
        "sl.mm.term_repo.settlement_date",
        "sl.mm.term_repo.maturity_date",
        "sl.mm.term_repo.side",
        # Bank rates + policy + CPI primaries
        "sl.mm.awlr",
        "sl.mm.awpr",
        "sl.mm.awpr.monthly",
        "sl.mm.awpr.6m",
        "sl.mm.awdr",
        "sl.mm.awdr.6m",
        "sl.mm.awfdr",
        "sl.mm.awsr",
        "sl.mm.opr",
        "sl.mm.srr",
        "sl.ei.ccpi.headline_yoy",
        "sl.ei.ccpi.core_yoy",
        "sl.ei.ncpi.headline_yoy",
        "sl.ei.ncpi.core_yoy",
        # MoM owned by consumer-price-inflation (or other primary) — not WEI
        "sl.ei.ccpi.headline_mom",
        "sl.ei.ncpi.headline_mom",
        # Gov securities eResearch (6169) — use sl.fi.tbill.* from DEI instead
        "sl.mm.tbill.91d",
        "sl.mm.tbill.182d",
        "sl.mm.tbill.364d",
    }
)


@dataclass(frozen=True)
class PdfListing:
    report_id: str
    title: str
    listing_url: str
    title_prefix: str
    pdf_name_re: re.Pattern[str]


LISTINGS: dict[str, PdfListing] = {
    "daily-economic-indicators": PdfListing(
        report_id="daily-economic-indicators",
        title="Daily Economic Indicators",
        listing_url=(
            "https://www.cbsl.gov.lk/en/statistics/economic-indicators/daily-indicators"
        ),
        title_prefix="Daily Economic Indicators",
        pdf_name_re=re.compile(
            r"(daily_economic_indicators|DEI_)\d",
            re.IGNORECASE,
        ),
    ),
    "weekly-economic-indicators": PdfListing(
        report_id="weekly-economic-indicators",
        title="Weekly Economic Indicators",
        listing_url=(
            "https://www.cbsl.gov.lk/en/statistics/economic-indicators/weekly-indicators"
        ),
        title_prefix="Weekly Economic Indicators",
        pdf_name_re=re.compile(r"WEI_\d{8}", re.IGNORECASE),
    ),
    "monthly-economic-indicators": PdfListing(
        report_id="monthly-economic-indicators",
        title="Monthly Economic Indicators",
        listing_url=(
            "https://www.cbsl.gov.lk/en/statistics/economic-indicators/monthly-indicators"
        ),
        title_prefix="Monthly Economic Indicators",
        pdf_name_re=re.compile(r"MEI_\d{6}", re.IGNORECASE),
    ),
    "external-sector-performance": PdfListing(
        report_id="external-sector-performance",
        title="External Sector Performance",
        listing_url=(
            "https://www.cbsl.gov.lk/en/press/press-releases/external-sector-performance"
        ),
        title_prefix="External Sector Performance",
        pdf_name_re=re.compile(
            r"press_\d{8}_external_sector_performance_.*_e(?:_0)?\.pdf",
            re.IGNORECASE,
        ),
    ),
}

PDF_REPORT_IDS = frozenset(LISTINGS.keys())


@dataclass
class ListedPdf:
    report_id: str
    title: str
    url: str
    period: date  # report / week-ending / publication month-start


def parse_number(text: str) -> float | None:
    t = (text or "").strip()
    if not t or t in {"-", "—", "n/a", "N/A", "n.a.", "na"}:
        return None
    neg = False
    if t.startswith("(") and t.endswith(")"):
        neg = True
        t = t[1:-1]
    # CBSL PDFs space digits / thousands: "2 9 4 . 0 0", "5 ,858.5", "1 ,777"
    t = t.replace(",", "").replace("%", "")
    t = re.sub(r"\s+", "", t)
    if not t or t in {"-", "—"}:
        return None
    try:
        value = float(t)
    except ValueError:
        return None
    return -value if neg else value


def parse_human_date(text: str) -> date | None:
    """Parse '23 July 2026', '01 January 2026', 'May 2026', '20 March 2026'."""
    t = re.sub(r"\s+", " ", (text or "").strip())
    m = re.fullmatch(
        r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})",
        t,
    )
    if m:
        day = int(m.group(1))
        month = MONTHS.get(m.group(2).lower())
        year = int(m.group(3))
        if month:
            try:
                return date(year, month, day)
            except ValueError:
                return None
    m = re.fullmatch(r"([A-Za-z]+)\s+(\d{4})", t)
    if m:
        month = MONTHS.get(m.group(1).lower())
        year = int(m.group(2))
        if month:
            return date(year, month, 1)
    return None


def period_from_filename(url: str, report_id: str) -> date | None:
    name = url.rsplit("/", 1)[-1]
    if report_id == "daily-economic-indicators":
        m = re.search(r"(\d{8})", name)
        if m:
            raw = m.group(1)
            try:
                return date(int(raw[:4]), int(raw[4:6]), int(raw[6:8]))
            except ValueError:
                pass
        m = re.search(r"DEI_(\d{2})_(\d{2})_(\d{4})", name, re.I)
        if m:
            try:
                return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
            except ValueError:
                return None
    if report_id == "weekly-economic-indicators":
        m = re.search(r"WEI_(\d{8})", name, re.I)
        if m:
            raw = m.group(1)
            try:
                return date(int(raw[:4]), int(raw[4:6]), int(raw[6:8]))
            except ValueError:
                return None
    if report_id == "monthly-economic-indicators":
        m = re.search(r"MEI_(\d{6})", name, re.I)
        if m:
            raw = m.group(1)
            try:
                return date(int(raw[:4]), int(raw[4:6]), 1)
            except ValueError:
                return None
    if report_id == "external-sector-performance":
        # press_YYYYMMDD_external_sector_performance_may_2026_e.pdf
        m = re.search(
            r"external_sector_performance_([a-z]+)_(\d{4})",
            name,
            re.I,
        )
        if m:
            month = MONTHS.get(m.group(1).lower())
            year = int(m.group(2))
            if month:
                return date(year, month, 1)
    return None


def content_hash_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def make_obs(
    series_id: str,
    period: str,
    value: float,
    source_url: str,
    confidence: float,
    bounds: dict[str, tuple[float, float]],
) -> dict[str, Any] | None:
    if series_id in OVERLAP_SKIP_SERIES:
        return None
    b = bounds.get(series_id)
    if b and not (b[0] <= value <= b[1]):
        return None
    return {
        "seriesId": series_id,
        "period": period,
        "value": value,
        "sourceUrl": source_url,
        "asOf": period,
        "confidence": round(confidence, 3),
    }


def discover_listing_pdfs(
    report_id: str,
    *,
    max_pages: int = 8,
    client: httpx.Client | None = None,
    min_period: date | None = None,
    page_delay: float = 0.0,
) -> list[ListedPdf]:
    """Walk Drupal Views pages and collect English PDF report links.

    Listings are newest-first. When ``min_period`` is set, stop once a page's
    oldest item is older than the lookback — avoids 80 tight-loop requests
    from datacenter IPs (CBSL WAF often then 404s the PDF downloads).
    """
    listing = LISTINGS[report_id]
    own_client = client is None
    client = client or httpx.Client(follow_redirects=True, timeout=90.0, headers=HEADERS)
    found: dict[str, ListedPdf] = {}
    try:
        for page in range(max_pages):
            if page > 0 and page_delay > 0:
                time.sleep(page_delay)
            url = listing.listing_url if page == 0 else f"{listing.listing_url}?page={page}"
            r = client.get(url, headers=HEADERS)
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "lxml")
            page_hits = 0
            page_oldest: date | None = None
            for a in soup.find_all("a"):
                href = (a.get("href") or "").strip()
                title = a.get_text(" ", strip=True)
                if not href or not title:
                    continue
                # ESP listing titles are "External Sector Performance - May 2026";
                # DEI/WEI/MEI titles start with the report name.
                title_ok = title.startswith(listing.title_prefix) or (
                    report_id == "external-sector-performance"
                    and listing.title_prefix.lower() in title.lower()
                )
                if not title_ok:
                    continue
                abs_url = urljoin(str(r.url), href)
                # Prefer English ESP PDFs; skip Tamil (_t) and Sinhala when present.
                if report_id == "external-sector-performance":
                    if not abs_url.lower().endswith(".pdf"):
                        continue
                    if re.search(r"_t(?:_0)?\.pdf$", abs_url, re.I):
                        continue
                    if not listing.pdf_name_re.search(abs_url):
                        if "_e.pdf" not in abs_url.lower() and "_e_0.pdf" not in abs_url.lower():
                            continue
                elif not abs_url.lower().endswith(".pdf"):
                    continue
                if not listing.pdf_name_re.search(abs_url):
                    # Allow title-matched PDFs even if naming drifts.
                    if "cbsl.gov.lk" not in abs_url:
                        continue
                date_part = title.split("-", 1)[-1].strip() if "-" in title else title
                period = parse_human_date(date_part) or period_from_filename(
                    abs_url, report_id
                )
                if not period:
                    continue
                if abs_url in found:
                    continue
                found[abs_url] = ListedPdf(
                    report_id=report_id,
                    title=title,
                    url=abs_url,
                    period=period,
                )
                page_hits += 1
                if page_oldest is None or period < page_oldest:
                    page_oldest = period
            if page_hits == 0 and page > 0:
                break
            if min_period and page_oldest is not None and page_oldest < min_period:
                break
    finally:
        if own_client:
            client.close()

    return sorted(found.values(), key=lambda x: x.period, reverse=True)


def filter_by_window(
    items: Iterable[ListedPdf],
    from_d: date,
    to_d: date,
    *,
    include_latest: bool = False,
) -> list[ListedPdf]:
    """Keep items in [from_d, to_d].

    Monthly / ESP prints use month-start periods, so a short lookback (14d)
    in late August misses June. ``include_latest`` keeps the newest file that
    is not after ``to_d`` so publish-lag reports still scrape.
    """
    seq = list(items)
    windowed = [x for x in seq if from_d <= x.period <= to_d]
    if include_latest and seq:
        newest = max(seq, key=lambda x: x.period)
        if newest.period <= to_d and newest not in windowed:
            windowed = [newest, *windowed]
    return windowed


def pdf_url_variants(url: str) -> list[str]:
    """CBSL republishes as `_e_N.pdf` and sometimes moves files between folders."""
    seen: list[str] = []
    candidates = [url]
    stem_m = re.search(r"^(.*?)(_e(?:_\d+)?)?\.pdf$", url, re.I)
    if stem_m:
        stem = stem_m.group(1)
        candidates.append(f"{stem}_e.pdf")
        for i in range(0, 4):
            candidates.append(f"{stem}_e_{i}.pdf")
        candidates.append(f"{stem}.pdf")
    m = re.search(
        r"daily_economic_indicators_(\d{4})(\d{2})(\d{2})_e(?:_\d+)?\.pdf$",
        url,
        re.I,
    )
    if m:
        y, mo, d = m.group(1), m.group(2), m.group(3)
        base = url.rsplit("/", 1)[0]
        candidates.append(f"{base}/DEI_{d}_{mo}_{y}.pdf")
        candidates.append(f"{base}/daily_economic_indicators_{y}{mo}{d}_e.pdf")
        candidates.append(f"{base}/daily_economic_indicators_{y}{mo}{d}_e_0.pdf")
        candidates.append(
            "https://www.cbsl.gov.lk/sites/default/files/"
            f"daily_economic_indicators_{y}{mo}{d}_e.pdf"
        )
    name = url.rsplit("/", 1)[-1]
    files_root = "https://www.cbsl.gov.lk/sites/default/files"
    if re.match(r"MEI_\d{6}", name, re.I):
        candidates.append(f"{files_root}/{name}")
        candidates.append(f"{files_root}/cbslweb_documents/statistics/mei/{name}")
    if re.match(r"WEI_\d{8}", name, re.I):
        candidates.append(f"{files_root}/{name}")
        candidates.append(f"{files_root}/cbslweb_documents/statistics/wei/{name}")
    if "external_sector_performance" in name.lower():
        candidates.append(f"{files_root}/{name}")
        candidates.append(f"{files_root}/cbslweb_documents/press/pr/{name}")
    for c in candidates:
        if c not in seen:
            seen.append(c)
    return seen


def _fresh_listing_url(
    report_id: str,
    period: date,
    stale_url: str,
    client: httpx.Client,
) -> str | None:
    """Re-read the first listing pages in case Drupal swapped the file href."""
    listed = discover_listing_pdfs(
        report_id,
        max_pages=3,
        client=client,
        min_period=period,
    )
    for item in listed:
        if item.period == period and item.url != stale_url:
            return item.url
    return None


def _try_get_pdf(
    client: httpx.Client,
    candidate: str,
    headers: dict[str, str],
) -> tuple[bytes, str] | None:
    r = client.get(candidate, headers=headers)
    if r.status_code == 404:
        raise httpx.HTTPStatusError(
            f"404 Not Found for {candidate}",
            request=r.request,
            response=r,
        )
    r.raise_for_status()
    data = r.content
    if not data.startswith(b"%PDF"):
        raise RuntimeError(f"Not a PDF from {candidate} (got {data[:40]!r})")
    return data, str(r.url)


def download_pdf(
    url: str,
    *,
    referer: str,
    client: httpx.Client,
    retries: int = 3,
    report_id: str | None = None,
    period: date | None = None,
) -> tuple[bytes, str]:
    """Download a CBSL PDF. Returns (bytes, final_url). Retries + filename variants on 404."""
    headers = {
        **HEADERS,
        "Accept": "application/pdf,application/octet-stream,*/*;q=0.8",
        "Referer": referer,
    }
    last_err: Exception | None = None
    tried: set[str] = set()
    transient = {403, 429, 502, 503}

    def attempt_urls(urls: list[str]) -> tuple[bytes, str] | None:
        nonlocal last_err
        for candidate in urls:
            if candidate in tried:
                continue
            tried.add(candidate)
            for attempt in range(retries):
                try:
                    return _try_get_pdf(client, candidate, headers)
                except httpx.HTTPStatusError as exc:
                    last_err = exc
                    status = exc.response.status_code if exc.response is not None else 0
                    if status == 404:
                        break
                    if status in transient and attempt + 1 < retries:
                        time.sleep(2.0 * (attempt + 1))
                        continue
                    if attempt + 1 < retries:
                        time.sleep(1.5 * (attempt + 1))
                except Exception as exc:  # noqa: BLE001
                    last_err = exc
                    if attempt + 1 < retries:
                        time.sleep(1.5 * (attempt + 1))
        return None

    got = attempt_urls(pdf_url_variants(url))
    if got:
        return got
    if report_id and period:
        fresh = _fresh_listing_url(report_id, period, url, client)
        if fresh:
            got = attempt_urls(pdf_url_variants(fresh))
            if got:
                return got
    raise RuntimeError(f"Failed to download PDF {url}: {last_err}")


def pdf_text(data: bytes, *, max_pages: int | None = None) -> str:
    import pdfplumber
    from io import BytesIO

    parts: list[str] = []
    with pdfplumber.open(BytesIO(data)) as pdf:
        pages = pdf.pages if max_pages is None else pdf.pages[:max_pages]
        for page in pages:
            parts.append(page.extract_text() or "")
    return "\n".join(parts)


def iso(d: date) -> str:
    return d.isoformat()


def utc_now_iso() -> str:
    return datetime.now().astimezone().isoformat()
