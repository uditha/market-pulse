"""External Sector Performance — monthly CBSL press PDF parser.

Parses the \"Summary of External Sector Performance\" table (month + YTD
columns) plus highlight cards on page 1 for GOR and tourist arrivals.

ESP is the primary writer for monthly merchandise trade, current account,
remittances, and tourism earnings. Gross official reserves (incl. PBOC swap)
are stored as ``sl.ei.reserves.gor`` — never as Official Reserve Assets.
"""

from __future__ import annotations

import re
from datetime import date
from io import BytesIO
from typing import Any, Callable

from .common import make_obs, parse_human_date, parse_number, pdf_text

ObsBuilder = Callable[..., dict[str, Any] | None]

_SUMMARY_MARKER = re.compile(
    r"Summary of External Sector Performance",
    re.IGNORECASE,
)
_PERF_MONTH = re.compile(
    r"External Sector Performance\s*[–—\-]\s*([A-Za-z]+\s+\d{4})",
    re.IGNORECASE,
)
_GOR_BN = re.compile(
    r"Gross official reserves\s*\(GOR\).*?US\$\s*([\d.,]+)\s*billion",
    re.IGNORECASE | re.DOTALL,
)
_GOR_CARD = re.compile(
    r"GROSS\s+OFFICIAL\s+RESERVES.*?USD\s*([\d.,]+)\s*bn",
    re.IGNORECASE | re.DOTALL,
)
_GOR_NEAR_REMIT = re.compile(
    r"USD\s*([\d.,]+)\s*bn\s*\n?\s*REMITTANCES",
    re.IGNORECASE,
)
_ARRIVALS_MONTH = re.compile(
    r"Tourist arrivals:\s*([\d,]+)",
    re.IGNORECASE,
)
_ARRIVALS_YTD = re.compile(
    r"Tourist arrivals:\s*([\d,]+).*?Tourist arrivals:\s*([\d,]+)",
    re.IGNORECASE | re.DOTALL,
)
_CHANGE_RESERVES = re.compile(
    r"Change in Reserves[^\n]*?"
    r"(-?[\d,]+\.?\d*)\s+(-?[\d,]+\.?\d*)\s+(-?[\d,]+\.?\d*)\s+(-?[\d,]+\.?\d*)",
    re.IGNORECASE,
)

# Label → (month series, optional ytd series). Context-sensitive labels use
# section state in the row loop.
_ROW_MAP: list[tuple[re.Pattern[str], str, str | None]] = [
    (re.compile(r"^Current Account Balance", re.I), "sl.ei.bop.current_account", "sl.ei.bop.current_account_ytd"),
    (re.compile(r"^Trade Balance", re.I), "sl.ei.trade.balance", "sl.ei.trade.balance_ytd"),
    (re.compile(r"^Merchandise Exports", re.I), "sl.ei.trade.exports", "sl.ei.trade.exports_ytd"),
    (re.compile(r"^Merchandise Imports", re.I), "sl.ei.trade.imports", "sl.ei.trade.imports_ytd"),
    (re.compile(r"^Services Account\s*\(net\)", re.I), "sl.ei.services.net", "sl.ei.services.net_ytd"),
    (re.compile(r"^Services\s*[–\-]\s*Inflows", re.I), "sl.ei.services.inflows", "sl.ei.services.inflows_ytd"),
    (re.compile(r"^Services\s*[–\-]\s*Outflows", re.I), "sl.ei.services.outflows", "sl.ei.services.outflows_ytd"),
    (re.compile(r"^Tourist Earnings", re.I), "sl.ei.tourist_earnings_usd", "sl.ei.tourist_earnings_usd_ytd"),
    (re.compile(r"^Computer and IT/?BPO", re.I), "sl.ei.services.it_bpo", "sl.ei.services.it_bpo_ytd"),
    (re.compile(r"^Travel Abroad", re.I), "sl.ei.services.travel_abroad", "sl.ei.services.travel_abroad_ytd"),
    (re.compile(r"^Primary Income Account\s*\(net\)", re.I), "sl.ei.income.primary_net", "sl.ei.income.primary_net_ytd"),
    (re.compile(r"^Primary Income Account\s*[–\-]\s*Inflows", re.I), "sl.ei.income.primary_inflows", "sl.ei.income.primary_inflows_ytd"),
    (re.compile(r"^Primary Income Account\s*[–\-]\s*Outflows", re.I), "sl.ei.income.primary_outflows", "sl.ei.income.primary_outflows_ytd"),
    (re.compile(r"^Direct Investment related", re.I), "sl.ei.income.fdi_related", "sl.ei.income.fdi_related_ytd"),
    (re.compile(r"^Portfolio Investment related", re.I), "sl.ei.income.portfolio_related", "sl.ei.income.portfolio_related_ytd"),
    (re.compile(r"^Other Investment Interest", re.I), "sl.ei.income.other_interest", "sl.ei.income.other_interest_ytd"),
    (re.compile(r"^Secondary Income Account\s*\(net\)", re.I), "sl.ei.income.secondary_net", "sl.ei.income.secondary_net_ytd"),
    (re.compile(r"^Workers['’]?\s*Remittances", re.I), "sl.ei.remittances_usd", "sl.ei.remittances_usd_ytd"),
    (re.compile(r"^Personal Transfers\s*[–\-]\s*Outflows", re.I), "sl.ei.income.personal_outflows", "sl.ei.income.personal_outflows_ytd"),
    (re.compile(r"^Net Flows to the CSE", re.I), "sl.ei.flows.cse", "sl.ei.flows.cse_ytd"),
    (re.compile(r"^Net Flows to the G-?Sec", re.I), "sl.ei.flows.gov_securities", "sl.ei.flows.gov_securities_ytd"),
    (re.compile(r"^Change in Reserves", re.I), "sl.ei.reserves.change", "sl.ei.reserves.change_ytd"),
]


def parse_esp_period(text: str, fallback: date | None = None) -> date | None:
    m = _PERF_MONTH.search(text)
    if m:
        return parse_human_date(m.group(1))
    m = re.search(
        r"Summary of External Sector Performance.*?\n\s*([A-Za-z]+\s+\d{4})",
        text,
        re.IGNORECASE | re.DOTALL,
    )
    if m:
        return parse_human_date(m.group(1))
    return fallback


def _clean_label(raw: str) -> str:
    t = re.sub(r"\s+", " ", (raw or "").strip())
    t = re.sub(r"[\d¹²³]+$", "", t).strip()
    return t


def _nums(cells: list[str]) -> list[float]:
    out: list[float] = []
    for c in cells:
        if not c or not re.search(r"\d", c):
            continue
        # Skip pure "%" header leftovers
        if c.strip() in {"%", "(% )", "(%)"}:
            continue
        v = parse_number(c)
        if v is not None:
            out.append(v)
    return out


def _summary_table_rows(data: bytes) -> list[tuple[str, list[float]]]:
    import pdfplumber

    with pdfplumber.open(BytesIO(data)) as pdf:
        for page in pdf.pages:
            txt = page.extract_text() or ""
            if not _SUMMARY_MARKER.search(txt):
                continue
            tables = page.extract_tables() or []
            if not tables:
                continue
            # Largest table by cell count is the summary.
            table = max(tables, key=lambda t: sum(len(r) for r in t))
            rows: list[tuple[str, list[float]]] = []
            for raw in table:
                cells = [(c or "").strip() for c in raw]
                nonempty = [c for c in cells if c]
                if not nonempty:
                    continue
                label = _clean_label(nonempty[0])
                if not label or label.lower() in {"category", "of which,", "of which"}:
                    continue
                if label.lower().startswith("main flows"):
                    continue
                # Drop header year cells fused into label row
                if re.fullmatch(r"May|Jan\s*-\s*May|Change", label, re.I):
                    continue
                nums = _nums(nonempty[1:])
                if not nums:
                    continue
                rows.append((label, nums))
            return rows
    return []


def _pick_month_ytd(nums: list[float]) -> tuple[float | None, float | None]:
    """Return (current month, current YTD) from a 4- or 6-value row."""
    if len(nums) >= 6:
        # prior_m, curr_m, yoy, prior_ytd, curr_ytd, ytd_yoy
        return nums[1], nums[4]
    if len(nums) == 5:
        # sometimes missing one change % — treat as prior_m, curr_m, yoy, prior_ytd, curr_ytd
        return nums[1], nums[4]
    if len(nums) == 4:
        # prior_m, curr_m, prior_ytd, curr_ytd (no change %)
        return nums[1], nums[3]
    if len(nums) == 2:
        # broken row — only YTD pair survived
        return None, nums[1]
    if len(nums) == 1:
        return nums[0], None
    return None, None


def _pick_yoy(nums: list[float]) -> float | None:
    if len(nums) >= 6:
        return nums[2]
    if len(nums) == 5:
        return nums[2]
    return None


def normalize_esp_pdf(
    data: bytes,
    source_url: str,
    *,
    fallback_period: date | None = None,
    bounds: dict[str, tuple[float, float]],
    obs: ObsBuilder = make_obs,
) -> list[dict[str, Any]]:
    text = pdf_text(data)
    period = parse_esp_period(text, fallback_period)
    if not period:
        raise RuntimeError("ESP: could not parse performance month")

    out: list[dict[str, Any]] = []

    def add(series_id: str, value: float | None, confidence: float) -> None:
        if value is None:
            return
        item = obs(
            series_id,
            period.isoformat(),
            value,
            source_url,
            confidence,
            bounds,
        )
        if item:
            out.append(item)

    # ── Highlight cards (GOR + arrivals) ──
    gor_val: float | None = None
    for pat, scale in (
        (_GOR_BN, 1000.0),
        (_GOR_CARD, 1000.0),
        (_GOR_NEAR_REMIT, 1000.0),
    ):
        m = pat.search(text)
        if m:
            bn = parse_number(m.group(1))
            if bn is not None:
                gor_val = bn * scale
                break
    add("sl.ei.reserves.gor", gor_val, 0.9)

    arr_ytd = _ARRIVALS_YTD.search(text)
    if arr_ytd:
        add("sl.ei.tourist_arrivals", parse_number(arr_ytd.group(1)), 0.88)
        add("sl.ei.tourist_arrivals_ytd", parse_number(arr_ytd.group(2)), 0.88)
    else:
        arr = _ARRIVALS_MONTH.search(text)
        if arr:
            add("sl.ei.tourist_arrivals", parse_number(arr.group(1)), 0.85)

    # Text fallback for Change in Reserves (table often drops month cells)
    cr = _CHANGE_RESERVES.search(text)
    change_month: float | None = None
    change_ytd: float | None = None
    if cr:
        change_month = parse_number(cr.group(2))
        change_ytd = parse_number(cr.group(4))

    rows = _summary_table_rows(data)
    if not rows:
        raise RuntimeError("ESP: summary table not found")

    # Track services inflow vs outflow for duplicate "Sea and Air Transport" labels
    services_section = "inflows"

    for label, nums in rows:
        if re.match(r"^Services\s*[–\-]\s*Inflows", label, re.I):
            services_section = "inflows"
        elif re.match(r"^Services\s*[–\-]\s*Outflows", label, re.I):
            services_section = "outflows"

        if re.match(r"^Sea and Air Transport", label, re.I):
            if services_section == "inflows":
                month_id, ytd_id = (
                    "sl.ei.services.transport_inflows",
                    "sl.ei.services.transport_inflows_ytd",
                )
            else:
                month_id, ytd_id = (
                    "sl.ei.services.transport_outflows",
                    "sl.ei.services.transport_outflows_ytd",
                )
            month_v, ytd_v = _pick_month_ytd(nums)
            add(month_id, month_v, 0.9)
            if ytd_id:
                add(ytd_id, ytd_v, 0.9)
            continue

        if re.match(r"^Change in Reserves", label, re.I):
            month_v, ytd_v = _pick_month_ytd(nums)
            if month_v is None:
                month_v = change_month
            if ytd_v is None:
                ytd_v = change_ytd
            add("sl.ei.reserves.change", month_v, 0.88)
            add("sl.ei.reserves.change_ytd", ytd_v, 0.88)
            continue

        matched = False
        for pat, month_id, ytd_id in _ROW_MAP:
            if pat.search(label):
                month_v, ytd_v = _pick_month_ytd(nums)
                add(month_id, month_v, 0.92)
                if ytd_id:
                    add(ytd_id, ytd_v, 0.92)
                # Store YoY for a few headline series used by the desk radar
                yoy = _pick_yoy(nums)
                if yoy is not None and month_id in {
                    "sl.ei.trade.exports",
                    "sl.ei.trade.imports",
                    "sl.ei.services.net",
                    "sl.ei.remittances_usd",
                    "sl.ei.tourist_earnings_usd",
                }:
                    add(f"{month_id}_yoy", yoy, 0.85)
                matched = True
                break
        if not matched:
            continue

    if not out:
        raise RuntimeError("ESP: zero observations extracted")
    return out


__all__ = ["normalize_esp_pdf", "parse_esp_period"]
