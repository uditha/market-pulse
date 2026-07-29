"""Monthly Economic Indicators — summary table parser (page 'SUMMARY').

Captures high-value macro / agriculture / energy / monetary / trade / BoP /
equity prints from the "SUMMARY OF SELECTED ECONOMIC INDICATORS" page.

Reliability design
------------------
CBSL renders the summary as a 3-column table (prior year / current year /
Y-o-Y). Text extraction of that table is fragile: footnote superscripts fuse
into value tokens (``1(b,6)29`` = 1,629 with a ``(b)`` marker), thousands are
sometimes split by a stray space (``1 ,211.3``), and negatives are shown with
accounting parentheses (``(4,191)``). Money aggregates are also printed in
Rs. Mn in older reports (≤2019) and Rs. Bn in newer ones — a silent 1000×
difference.

Instead of per-row value regexes we cluster the page's *words* by their x
position:

* rows are grouped by baseline (``top``), tolerant of raised superscripts;
* value tokens (right of the label/unit columns) are merged into columns by
  horizontal gap, which stitches ``1`` + ``,211.3`` back into ``1,211.3``;
* the current-year column is located dynamically (median x of the 2nd column)
  so a row whose current cell is blank (``Yala … 1,532.9  -  -``) yields *no*
  value rather than leaking the prior-year figure.

Label matching, period, and unit are read from the plain row text. Skips
NCPI/CCPI (owned by the CPI scraper) and the MEI "Total Reserves" line (a
broader stock than Official Reserve Assets — ORA is filled from WEI §4.3 only).
"""

from __future__ import annotations

import re
from datetime import date
from io import BytesIO
from typing import Any, Callable

from .common import MONTHS, make_obs, parse_human_date, parse_number

ObsBuilder = Callable[..., dict[str, Any] | None]

# Column geometry (points). Value tokens sit right of the unit column; the
# current-year column is discovered per-document but always well right of this.
_VALUE_MIN_X0 = 345.0
_CLUSTER_GAP = 8.0  # merge value words closer than this (stitches "1" + ",211.3")
_CURR_TOL = 30.0  # a cell counts as current-year if within this of the column x
_ROW_TOL = 4.0  # baseline tolerance when grouping words into rows

_MONTH_RE = re.compile(
    r"\b(January|February|March|April|May|June|July|August|September|"
    r"October|November|December)\b",
    re.IGNORECASE,
)
_QUARTER_RE = re.compile(r"(\d)\s*(?:st|nd|rd|th)\s+Quarter", re.IGNORECASE)
# CBSL has mis-spelled the heading ("SUMARRY", "SUMARY") in some 2019 issues.
_SUMMARY_MARKER = re.compile(r"SUM\w*RY OF SELECTED ECONOMIC INDICATORS", re.IGNORECASE)
# Two adjacent years mark a block header ("2017 2018", "2025(a) 2026(b)").
_YEAR_PAIR = re.compile(r"(20\d{2})\D{1,8}(20\d{2})")


def parse_mei_publication(text: str, fallback: date | None = None) -> date | None:
    m = re.search(
        r"SUM\w*RY OF SELECTED ECONOMIC INDICATORS\s+([A-Za-z]+\s+\d{4})",
        text,
        re.IGNORECASE,
    )
    if m:
        return parse_human_date(m.group(1))
    m = re.search(
        r"MONTHLY\s+ECONOMIC\s+INDICATORS\s+([A-Za-z]+)\s+(\d{4})",
        text,
        re.IGNORECASE,
    )
    if m:
        return parse_human_date(f"{m.group(1)} {m.group(2)}")
    return fallback


def _month_start(year: int, month_name: str) -> date | None:
    month = MONTHS.get(month_name.lower())
    if not month:
        return None
    return date(year, month, 1)


def _quarter_start(year: int, quarter: int) -> date:
    return date(year, (quarter - 1) * 3 + 1, 1)


def _last_month(line: str) -> str | None:
    """Reference month = the last month named on the row (handles 'Jan - Apr')."""
    hits = _MONTH_RE.findall(line)
    return hits[-1] if hits else None


def _clean_cell(token: str) -> float | None:
    """Parse a summary value token, tolerant of footnote / spacing garble.

    ``(718)`` → -718 (accounting negative), ``1(b,6)29`` → 1629,
    ``2,3 (a 0 ) 8.4`` → 2308.4, ``-1,470`` → -1470.
    """
    t = (token or "").strip()
    if not t or t in {"-", "—", "n/a", "n.a.", "na"}:
        return None
    # Whole-token accounting negative: (1,383) / (59.1)
    if re.fullmatch(r"\(\s*[\d,]+(?:\.\d+)?\s*\)", t):
        val = parse_number(t.strip("() "))
        return -val if val is not None else None
    # Drop footnote letters and stray parens fused into the digits.
    t = re.sub(r"[A-Za-z]", "", t)
    t = t.replace("(", "").replace(")", "")
    return parse_number(t)


def _median(xs: list[float]) -> float | None:
    xs = sorted(xs)
    n = len(xs)
    if not n:
        return None
    return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2.0


class _Row:
    __slots__ = ("line", "cells")

    def __init__(self, line: str, cells: list[tuple[float, float]]):
        self.line = line
        # cells: (x0, value) left→right, one per value column present
        self.cells = cells

    def current(self, curr_x: float | None) -> float | None:
        if curr_x is None:
            return None
        for x0, val in self.cells:
            if abs(x0 - curr_x) <= _CURR_TOL:
                return val
        return None


def _summary_rows(data: bytes) -> tuple[list[_Row], str]:
    import pdfplumber

    with pdfplumber.open(BytesIO(data)) as pdf:
        page = None
        page_text = ""
        for pg in pdf.pages[:6]:
            txt = pg.extract_text() or ""
            if _SUMMARY_MARKER.search(txt):
                page = pg
                page_text = txt
                break
        if page is None:
            return [], ""
        words = page.extract_words(use_text_flow=False, keep_blank_chars=False)

    words.sort(key=lambda w: (w["top"], w["x0"]))
    groups: list[tuple[float, list[dict[str, Any]]]] = []
    for w in words:
        if groups and abs(w["top"] - groups[-1][0]) <= _ROW_TOL:
            groups[-1][1].append(w)
        else:
            groups.append((w["top"], [w]))

    rows: list[_Row] = []
    for _top, ws in groups:
        ws.sort(key=lambda w: w["x0"])
        line = " ".join(w["text"] for w in ws)
        value_words = [w for w in ws if w["x0"] >= _VALUE_MIN_X0]
        clusters: list[list[dict[str, Any]]] = []
        for w in value_words:
            if clusters and w["x0"] - clusters[-1][-1]["x1"] <= _CLUSTER_GAP:
                clusters[-1].append(w)
            else:
                clusters.append([w])
        cells: list[tuple[float, float]] = []
        for c in clusters:
            val = _clean_cell("".join(x["text"] for x in c))
            if val is not None:
                cells.append((c[0]["x0"], val))
        rows.append(_Row(line, cells))
    return rows, page_text


def _current_column_x(rows: list[_Row]) -> float | None:
    """Locate the current-year column: median x of the 2nd value column."""
    return _median([r.cells[1][0] for r in rows if len(r.cells) >= 2])


def _header_year(summary_text: str, pub: date) -> int:
    """Current-year column = the 2nd year of the summary's main block header.

    The header pair is the reference vintage regardless of publication month —
    early-year issues (e.g. Jan 2019) report the *prior* year (header "2017 2018"),
    so the publication year must not be assumed.
    """
    m = _YEAR_PAIR.search(summary_text)
    if m:
        return int(m.group(2))
    years = [int(y) for y in re.findall(r"\b(20\d{2})\b", summary_text)]
    return max(years) if years else pub.year


def _bop_period(text: str) -> date | None:
    """Balance-of-Payments block carries its own (lagged) year header + period."""
    m = re.search(
        r"Balance of Payments\s+(\d{4})\s+\(?(\d{4})",
        text,
        re.IGNORECASE,
    )
    if not m:
        return None
    year = int(m.group(2))
    block = text[m.start() : m.start() + 600]
    # Stop before the reserves row / footnotes so a later section's
    # "1st Quarter" (page 3 GDP detail) can't be mistaken for the BoP period.
    cut = re.search(r"Total Reserves|\n\([a-z]\)\s", block)
    if cut:
        block = block[: cut.start()]
    q = _QUARTER_RE.search(block)
    if q:
        return _quarter_start(year, int(q.group(1)))
    return date(year, 12, 1)


def normalize_mei_pdf(
    data: bytes,
    source_url: str,
    *,
    fallback_period: date | None = None,
    bounds: dict[str, tuple[float, float]],
    obs: ObsBuilder = make_obs,
) -> list[dict[str, Any]]:
    import pdfplumber

    with pdfplumber.open(BytesIO(data)) as pdf:
        text = "\n".join((pg.extract_text() or "") for pg in pdf.pages[:4])

    pub = parse_mei_publication(text, fallback_period)
    if not pub:
        raise RuntimeError("MEI: could not parse publication month")

    rows, summary_text = _summary_rows(data)
    # Blocks carry independent (sometimes lagged) year headers — e.g. a Feb issue
    # reports Dec of the prior year for trade while equities are already current.
    # Track the year per block from the most recent "YYYY YYYY" header row.
    year_holder = [_header_year(summary_text or text, pub)]
    curr_x = _current_column_x(rows)
    if curr_x is None:
        raise RuntimeError("MEI: could not locate summary value columns")

    out: list[dict[str, Any]] = []

    def add(
        series_id: str,
        period: date | None,
        value: float | None,
        confidence: float,
    ) -> None:
        if period is None or value is None:
            return
        item = obs(series_id, period.isoformat(), value, source_url, confidence, bounds)
        if item:
            out.append(item)

    def month_period(line: str) -> date | None:
        mo = _last_month(line)
        return _month_start(year_holder[0], mo) if mo else None

    def quarter_period(line: str) -> date | None:
        q = _QUARTER_RE.search(line)
        return _quarter_start(year_holder[0], int(q.group(1))) if q else None

    broad_seen = 0  # 1st non-consolidated "Broad Money" = M2, 2nd = M4

    for row in rows:
        line = row.line
        # Block header ("2018 2019", "2025(a) 2026(b)") — switch the active year.
        # No summary data row carries a 20xx–20xx pair (base years like 2015/2021
        # appear singly), so this is safe.
        hdr = _YEAR_PAIR.search(line)
        if hdr:
            year_holder[0] = int(hdr.group(2))
            continue
        val = row.current(curr_x)
        if val is None:
            continue

        # ── Real sector ──
        if re.match(r"\s*Gross Domestic Products \(GDP\)", line, re.IGNORECASE):
            add("sl.ei.gdp.level", quarter_period(line), val, 0.9)
        elif re.match(r"\s*GDP Growth", line, re.IGNORECASE):
            add("sl.ei.gdp.growth", quarter_period(line), val, 0.92)
        elif re.match(r"\s*Tea\b", line, re.IGNORECASE):
            add("sl.ei.agri.tea", month_period(line), val, 0.85)
        elif re.match(r"\s*Rubber\b", line, re.IGNORECASE):
            add("sl.ei.agri.rubber", month_period(line), val, 0.85)
        elif re.match(r"\s*Coconut\b", line, re.IGNORECASE):
            add("sl.ei.agri.coconut", month_period(line), val, 0.85)
        elif re.match(r"\s*(Marine Fish Production|Fish)\b", line, re.IGNORECASE):
            add("sl.ei.agri.fish", month_period(line), val, 0.85)
        elif re.match(r"\s*Paddy\b", line, re.IGNORECASE):
            add("sl.ei.agri.paddy", pub, val, 0.8)
        elif re.match(r"\s*Electricity Generation\b", line, re.IGNORECASE):
            add("sl.ei.electricity.generation_monthly", month_period(line), val, 0.88)
        elif re.match(r"\s*Index of Industrial Production", line, re.IGNORECASE):
            add("sl.ei.iip", month_period(line), val, 0.9)

        # ── Fiscal (cumulative YTD — stamp publication month) ──
        elif re.match(r"\s*Revenue and Grants", line, re.IGNORECASE):
            add("sl.ei.fiscal.revenue_grants", pub, val, 0.86)
        elif re.match(r"\s*Recurrent Expenditure", line, re.IGNORECASE):
            add("sl.ei.fiscal.recurrent_expenditure", pub, val, 0.86)

        # ── Monetary aggregates (normalise Rs. Mn → Rs. Bn) ──
        elif re.match(r"\s*Narrow Money", line, re.IGNORECASE):
            add("sl.ei.m1", month_period(line), _to_bn(line, val), 0.9)
        elif re.match(r"\s*Consolidated Broad Money", line, re.IGNORECASE):
            add("sl.ei.m2b", month_period(line), _to_bn(line, val), 0.9)
        elif re.match(r"\s*Broad Money", line, re.IGNORECASE):
            broad_seen += 1
            series = "sl.ei.m2" if broad_seen == 1 else "sl.ei.m4"
            add(series, month_period(line), _to_bn(line, val), 0.9)

        # ── Share market (month-end) ──
        elif re.match(r"\s*ASPI\b", line, re.IGNORECASE):
            add("sl.eq.aspi", month_period(line), val, 0.91)
        elif re.match(r"\s*S&P SL\s*20", line, re.IGNORECASE):
            add("sl.eq.sp_sl20", month_period(line), val, 0.91)
        elif re.match(r"\s*Market Capitali", line, re.IGNORECASE):
            add("sl.eq.market_cap", month_period(line), val, 0.91)

        # Merchandise trade + BoP accounts are owned by External Sector
        # Performance (monthly press). Skip here to avoid period collisions.

        # NCPI / CCPI and "Total Reserves" are intentionally not mapped here.

    if not out:
        raise RuntimeError(
            "MEI: zero observations extracted (summary layout may have changed)"
        )
    return out


def _to_bn(line: str, value: float) -> float:
    """Money aggregates: convert Rs. Mn prints (≤2019) to Rs. Bn for consistency."""
    if re.search(r"Rs\.\s*Mn", line, re.IGNORECASE):
        return round(value / 1000.0, 5)
    return value
