"""Weekly Economic Indicators PDF parser.

WEI is a data source that:
  - fills gaps DEI does not cover (weekly FX averages, forwards, bond curve,
    ISBs, auctions, YTD FX, liquidity surplus, remittances, …)
  - does NOT write DEI-owned daily series (ASPI / T-bills / turnover…) —
    those stay primary on DEI so week-ending scrapes cannot reset approvals

Skips locked money-market / policy / CPI series (OVERLAP_SKIP_SERIES),
including CCPI/NCPI YoY and MoM owned by consumer-price-inflation.
"""

from __future__ import annotations

import re
from datetime import date
from typing import Any, Callable

from .common import MONTHS, make_obs, parse_human_date, parse_number, pdf_text

ObsBuilder = Callable[..., dict[str, Any] | None]

# Bond tenor label → series suffix
_BOND_TENORS: list[tuple[str, str]] = [
    (r"<\s*2\s*Years?", "2y"),
    (r"<\s*3\s*Years?", "3y"),
    (r"<\s*4\s*Years?", "4y"),
    (r"<\s*5\s*Years?", "5y"),
    (r"<\s*6\s*Years?", "6y"),
    (r"<\s*8\s*Years?", "8y"),
    (r"<\s*10\s*Years?", "10y"),
    (r"<\s*15\s*Years?", "15y"),
    (r"<\s*20\s*Years?", "20y"),
]

# ISB maturity date → stable series id
_ISB_KEYS: list[tuple[str, str]] = [
    ("15-Apr-28", "2028_04_pdi"),
    ("15-Jan-30", "2030_01_macro"),
    ("15-Mar-33", "2033_03_macro"),
    ("15-Jun-35", "2035_06_gov"),
    ("15-May-36", "2036_05_macro"),
    ("15-Feb-38", "2038_02_macro"),
    ("15-Jun-38", "2038_06_usd"),
]


def parse_wei_period(text: str, fallback: date | None = None) -> date | None:
    first = (text.splitlines()[0].strip() if text.strip() else "")
    d = parse_human_date(first)
    if d:
        return d
    m = re.search(
        r"week ending\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})",
        text,
        re.IGNORECASE,
    )
    if m:
        return parse_human_date(m.group(1))
    m = re.search(
        r"By\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4}),\s+the All Share Price Index",
        text,
    )
    if m:
        return parse_human_date(m.group(1))
    m = re.search(
        r"as of\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})",
        text,
        re.IGNORECASE,
    )
    if m:
        return parse_human_date(m.group(1))
    return fallback


def _paren_number(raw: str) -> float | None:
    """Parse `1,234.56` or `(783.07)` accounting negatives."""
    t = (raw or "").strip()
    if not t or t in {"-", "—", "n.a.", "n/a"}:
        return None
    neg = t.startswith("(") and t.endswith(")")
    t = t.strip("()")
    val = parse_number(t)
    if val is None:
        return None
    return -val if neg else val


def _month_start_from_end_phrase(text: str, label: str) -> date | None:
    """`as at end February 2026` → 2026-02-01."""
    m = re.search(
        rf"{re.escape(label)}[^\n]{{0,80}}end\s+([A-Za-z]+)\s+(\d{{4}})",
        text,
        re.IGNORECASE,
    )
    if not m:
        return None
    month = MONTHS.get(m.group(1).lower())
    if not month:
        return None
    return date(int(m.group(2)), month, 1)


def _extract_ytd_fx(text: str) -> float | None:
    """USD/LKR YTD % when CBSL prints it in highlights (common from ~2025)."""
    patterns = [
        r"Year to date (depreciation|appreciation) of Sri Lanka rupee against "
        r"the US dollar was\s+([\d.]+)\s+per cent",
        r"Year-to-date (depreciation|appreciation) of (?:the )?Sri Lanka rupee against "
        r"the US dollar was\s+([\d.]+)\s+per cent",
        r"(depreciation|appreciation) of (?:the )?Sri Lanka rupee against the US dollar "
        r"was\s+([\d.]+)\s+per cent year[- ]to[- ]date",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if not m:
            continue
        val = parse_number(m.group(2))
        if val is None:
            continue
        # Positive = depreciation (weaker LKR), negative = appreciation
        if m.group(1).lower() == "appreciation":
            val = -val
        return val
    return None


def _extract_highlights(text: str) -> dict[str, float]:
    out: dict[str, float] = {}
    m = re.search(
        r"All[- ]Share Price Index \(ASPI\).*?(increased|decreased) by\s+([\d.]+)\s+per cent "
        r"to\s+([\d,]+\.\d+)\s+points"
        r".*?S&P SL\s*20.*? (increased|decreased) by\s+([\d.]+)\s+per cent "
        r"to\s+([\d,]+\.\d+)\s+points",
        text,
        re.IGNORECASE | re.DOTALL,
    )
    if m:
        aspi_wow = parse_number(m.group(2))
        aspi = parse_number(m.group(3))
        sp_wow = parse_number(m.group(5))
        sp = parse_number(m.group(6))
        if aspi is not None:
            out["aspi"] = aspi
        if sp is not None:
            out["sp_sl20"] = sp
        if aspi_wow is not None:
            out["aspi_wow_pct"] = -aspi_wow if m.group(1).lower() == "decreased" else aspi_wow
        if sp_wow is not None:
            out["sp_wow_pct"] = -sp_wow if m.group(4).lower() == "decreased" else sp_wow

    m = re.search(
        r"total outstanding market liquidity was a surplus of Rs\.?\s*([\d,]+\.\d+)\s*bn",
        text,
        re.IGNORECASE,
    )
    if m:
        val = parse_number(m.group(1))
        if val is not None:
            out["liquidity_surplus_bn"] = val

    ytd = _extract_ytd_fx(text)
    if ytd is not None:
        out["usd_ytd_pct"] = ytd

    m = re.search(
        r"Food and Non-Food inflation recorded\s+([\d.]+)\s+per cent and\s+([\d.]+)\s+per cent",
        text,
        re.IGNORECASE,
    )
    if m:
        food = parse_number(m.group(1))
        nonfood = parse_number(m.group(2))
        if food is not None:
            out["ncpi_food_yoy"] = food
        if nonfood is not None:
            out["ncpi_nonfood_yoy"] = nonfood

    m = re.search(
        r"Brent and WTI crude oil prices\s+(increased|decreased)\s+by\s+US dollars\s+([\d.]+)\s+and\s+US dollars\s+([\d.]+)",
        text,
        re.IGNORECASE,
    )
    if m:
        brent = parse_number(m.group(2))
        if brent is not None:
            out["brent_wow"] = -brent if m.group(1).lower() == "decreased" else brent
    return out


def _extract_share_table(text: str) -> dict[str, float]:
    """§2.8 — year-ago / week-ago / this-week columns; take this week (last)."""
    out: dict[str, float] = {}
    block = re.search(
        r"2\.8 Share Market([\s\S]+?)(?:FISCAL SECTOR|3\.1 Government|3\.3 Government)",
        text,
        re.IGNORECASE,
    )
    section = block.group(1) if block else text

    patterns = [
        (r"All[- ]Share Price Index.*?\)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)", "aspi"),
        (r"S&P Sri Lanka 20 Index.*?\)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)", "sp_sl20"),
        (r"Daily Turnover \(Rs\. mn\)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)", "turnover"),
        (
            r"Market Capitalisa\S*on \(Rs\.bn\)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)",
            "market_cap",
        ),
        (r"Foreign Purchases \(Rs\. mn\)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)", "foreign_purchases"),
        (r"Foreign Sales \(Rs\. mn\)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)", "foreign_sales"),
        (
            r"Net Foreign Purchases \(Rs\. mn\)\s+(\(?[\d,]+\.\d+\)?)\s+(\(?[\d,]+\.\d+\)?)\s+(\(?[\d,]+\.\d+\)?)",
            "foreign_net",
        ),
    ]
    for pat, key in patterns:
        m = re.search(pat, section, re.IGNORECASE)
        if not m:
            continue
        val = _paren_number(m.group(3))
        if val is not None:
            out[key] = val
    return out


def _extract_tbill_bond_curve(text: str) -> dict[str, float]:
    """§3.3.1 primary this-week + secondary averages."""
    out: dict[str, float] = {}
    block = re.search(
        r"3\.3\.1 Treasury Bills and Treasury Bonds([\s\S]+?)(?:3\.3\.2|Source: Public Debt)",
        text,
        re.IGNORECASE,
    )
    section = block.group(1) if block else text

    for tenor, suffix in [("91 Day", "91d"), ("182 Day", "182d"), ("364 Day", "364d")]:
        m = re.search(
            rf"{tenor}\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)",
            section,
        )
        if m:
            primary = parse_number(m.group(1))
            secondary = parse_number(m.group(3))
            if primary is not None and 0 < primary < 40:
                out[f"tbill.{suffix}.primary"] = primary
            if secondary is not None and 0 < secondary < 40:
                out[f"tbill.{suffix}.secondary"] = secondary

    # Bond row: optional primary, then buy/sell/this-avg/last-avg → this-avg = nums[-2]
    for label_re, suffix in _BOND_TENORS:
        m = re.search(rf"({label_re})([^\n]+)", section, re.IGNORECASE)
        if not m:
            continue
        nums = [parse_number(x) for x in re.findall(r"[\d.]+", m.group(2))]
        nums = [n for n in nums if n is not None and 0 < n < 40]
        if len(nums) >= 2:
            this_avg = nums[-2]
            out[f"tbond.{suffix}.secondary_mid"] = this_avg
    return out


def _extract_isbs(text: str) -> dict[str, float]:
    out: dict[str, float] = {}
    block = re.search(
        r"3\.3\.2 International Sovereign Bonds([\s\S]+?)(?:3\.4 Government)",
        text,
        re.IGNORECASE,
    )
    section = block.group(1) if block else text
    for mat, key in _ISB_KEYS:
        m = re.search(rf"{re.escape(mat)}([^\n]+)", section)
        if not m:
            continue
        nums = [parse_number(x) for x in re.findall(r"[\d.]+", m.group(1))]
        # Skip coupon-like first number (e.g. 4.00); last two are last-week / this-week YTM
        nums = [n for n in nums if n is not None and 0 < n < 40]
        if len(nums) >= 2:
            out[f"isb.{key}"] = nums[-1]
    return out


def _extract_auction(text: str) -> dict[str, float]:
    out: dict[str, float] = {}
    block = re.search(
        r"3\.4 Government Securities([\s\S]+?)(?:EXTERNAL SECTOR|4\.1 Exchange)",
        text,
        re.IGNORECASE,
    )
    section = block.group(1) if block else text

    m = re.search(
        r"of which T-Bills and T-Bonds held by Foreigners\s+([\d,]+)\s+([\d,]+)",
        section,
        re.IGNORECASE,
    )
    if m:
        val = parse_number(m.group(2))
        if val is not None:
            out["gov_foreign_holdings"] = val

    m = re.search(
        r"Treasury Bills\s+([\d,]+)\s+([\d,]+)\s+Treasury Bonds\s+([\d,]+)\s+([\d,]+)",
        section,
        re.IGNORECASE,
    )
    if m:
        tb = parse_number(m.group(2))
        tn = parse_number(m.group(4))
        if tb is not None:
            out["gov_tbill_stock"] = tb
        if tn is not None:
            out["gov_tbond_stock"] = tn

    # Phase I auction — last number is This Week
    m = re.search(
        r"Amount Offered\s+([\d,]+)\s+([\d,]+|-)",
        section,
    )
    if m and m.group(2) != "-":
        val = parse_number(m.group(2))
        if val is not None:
            out["tbill_auction_offered"] = val
    m = re.search(
        r"Total Bids Received\s+([\d,]+)\s+([\d,]+|-)",
        section,
    )
    if m and m.group(2) != "-":
        val = parse_number(m.group(2))
        if val is not None:
            out["tbill_auction_bids"] = val
    m = re.search(
        r"Amount Accepted\s+([\d,]+)\s+([\d,]+|-)",
        section,
    )
    if m and m.group(2) != "-":
        val = parse_number(m.group(2))
        if val is not None:
            out["tbill_auction_accepted"] = val

    if (
        "tbill_auction_offered" in out
        and "tbill_auction_bids" in out
        and out["tbill_auction_offered"] > 0
    ):
        out["tbill_auction_cover"] = round(
            out["tbill_auction_bids"] / out["tbill_auction_offered"],
            4,
        )
    return out


def _apply_fx_five(
    out: dict[str, float],
    ccy: str,
    buy: float | None,
    sell: float | None,
    mid: float | None,
    week_ago: float | None,
    year_ago: float | None,
) -> None:
    if buy is not None:
        out[f"{ccy}.week_avg_buy"] = buy
    if sell is not None:
        out[f"{ccy}.week_avg_sell"] = sell
    if mid is not None:
        out[f"{ccy}.week_avg_mid"] = mid
    if mid is not None and week_ago is not None and week_ago != 0:
        out[f"{ccy}.week_avg_mid_wow_pct"] = round((mid / week_ago - 1.0) * 100.0, 4)
    if mid is not None and year_ago is not None and year_ago != 0:
        out[f"{ccy}.week_avg_mid_yoy_pct"] = round((mid / year_ago - 1.0) * 100.0, 4)


def _extract_fx_week(text: str) -> dict[str, float]:
    """§4.1 weekly average bank rates + USD forwards.

    Layouts seen:
      2023: `USD 301.16 316.67 308.92 306.70 361.64`
      2024–25: `EUxScDhangeRates Aver.. 301.02 …`
      2026: `UESxDchangeRates Aver.. 310.65 …`
    """
    out: dict[str, float] = {}
    block = re.search(
        r"4\.1 Exchange Rate([\s\S]+?)(?:4\.2 Tourism|4\.3 Official)",
        text,
        re.IGNORECASE,
    )
    section = block.group(1) if block else text
    nums = r"([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)"

    # Prefer clean labels, then garbled Tableau variants (order matters).
    ccy_patterns = [
        (rf"\bUSD\s+{nums}", "usd"),
        (rf"UES\S*D\S*\s+Aver\.\.\s+{nums}", "usd"),
        (rf"EUxS\S*D\S*\s+Aver\.\.\s+{nums}", "usd"),
        (rf"\bGBP\s+{nums}", "gbp"),
        (rf"GEB\S*P\S*\s+Aver\.\.\s+{nums}", "gbp"),
        (rf"EGxB\S*P\S*\s+Aver\.\.\s+{nums}", "gbp"),
        (rf"\bYen\s+{nums}", "jpy"),
        (rf"YEe\S*\s+Aver\.\.\s+{nums}", "jpy"),
        (rf"EYex\S*\s+Aver\.\.\s+{nums}", "jpy"),
        (rf"\bEuro\s+{nums}", "eur"),
        (rf"EEU\S*R\S*\s+Aver\.\.\s+{nums}", "eur"),
        (rf"EExU\S*R\S*\s+Aver\.\.\s+{nums}", "eur"),
    ]
    for pat, ccy in ccy_patterns:
        if f"{ccy}.week_avg_mid" in out:
            continue
        m = re.search(pat, section, re.IGNORECASE)
        if not m:
            continue
        _apply_fx_five(
            out,
            ccy,
            parse_number(m.group(1)),
            parse_number(m.group(2)),
            parse_number(m.group(3)),
            parse_number(m.group(4)),
            parse_number(m.group(5)),
        )

    m = re.search(
        r"1\s*Month\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)",
        section,
        re.IGNORECASE,
    )
    if m:
        val = parse_number(m.group(3))
        if val is not None and 50 < val < 1000:
            out["usd.fwd_1m"] = val
    m = re.search(
        r"3\s*Month\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)",
        section,
        re.IGNORECASE,
    )
    if m:
        val = parse_number(m.group(3))
        if val is not None and 50 < val < 1000:
            out["usd.fwd_3m"] = val
    return out


def _infer_external_month(text: str) -> date | None:
    """Best-effort month for §4.2 stamps (February / June / …)."""
    m = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+\1\s+\1\s+\1",
        text,
        re.IGNORECASE,
    )
    if m:
        month = MONTHS.get(m.group(1).lower())
        if month:
            # Prefer 2026 column pair when present near the match
            return date(2026, month, 1)
    section = _ora_section(text)
    if section:
        return _parse_as_at_month(section)
    return None


def _parse_as_at_month(text: str) -> date | None:
    """Parse `as at end February 2026` or `as at 30thOctober 2020` → month-start."""
    m = re.search(
        r"as at\s+end\s+([A-Za-z]+)\s+(\d{4})",
        text,
        re.IGNORECASE,
    )
    if m:
        month = MONTHS.get(m.group(1).lower())
        if month:
            return date(int(m.group(2)), month, 1)
    m = re.search(
        r"as at\s+(\d{1,2})(?:st|nd|rd|th)?\s*([A-Za-z]+)\s+(\d{4})",
        text,
        re.IGNORECASE,
    )
    if m:
        month = MONTHS.get(m.group(2).lower())
        if month:
            return date(int(m.group(3)), month, 1)
    return None


def _ora_section(text: str) -> str | None:
    """Isolate WEI §4.3 Official Reserve Assets (not the lagged §4.4 block)."""
    m = re.search(
        r"4\.3\s+Official\s*Reserve\s*Assets[\s\S]*?"
        r"(?=4\.4\s+|Predetermined Short-Term|\Z)",
        text,
        re.IGNORECASE,
    )
    if m:
        return m.group(0)
    # 2019-era: ORA lived under 4.3 International Reserves & FCL
    m = re.search(
        r"4\.3\s+International Reserves[\s\S]*?"
        r"(?=4\.4\s+|Predetermined Short-Term|\Z)",
        text,
        re.IGNORECASE,
    )
    if m:
        return m.group(0)
    return None


_ORA_NUM = r"([\d][\d,\s]*\.?\d*)"

# Label → series id for §4.3 breakdown (headline total handled separately)
_ORA_COMPONENTS: list[tuple[str, str]] = [
    (r"(?:\(\d+\)\s*)?Foreign\s+[Cc]urrency\s+[Rr]eserves", "sl.ei.reserves.fx"),
    (r"(?:\(\d+\)\s*)?Reserve\s+posi\S*\s+in\s+the\s+IMF", "sl.ei.reserves.imf"),
    (r"(?:\(\d+\)\s*)?SDRs", "sl.ei.reserves.sdrs"),
    (r"(?:\(\d+\)\s*)?Gold", "sl.ei.reserves.gold"),
    (r"(?:\(\d+\)\s*)?Other\s+[Rr]eserve\s+[Aa]ssets", "sl.ei.reserves.other"),
]


def _extract_ora(text: str) -> list[tuple[str, str, float]]:
    """§4.3 Official Reserve Assets (USD mn) — total + component breakdown."""
    section = _ora_section(text)
    if not section:
        return []
    period_d = _parse_as_at_month(section)
    if not period_d:
        period_d = _month_start_from_end_phrase(section, "Official Reserve Assets")
    if not period_d:
        return []
    period = period_d.isoformat()
    rows: list[tuple[str, str, float]] = []

    total: float | None = None
    # Mid layouts: value on the unit header line
    m = re.search(
        rf"Official\s*Reserve\s*Assets\s*\((?:USD|US\$)\s*Mn\)\s*(?:\([^)]*\))?\s*{_ORA_NUM}",
        section,
        re.IGNORECASE,
    )
    if m:
        total = parse_number(m.group(1))
    if total is None:
        # Modern: separate "Official Reserve Assets(b) 6,450" line
        m = re.search(
            rf"(?m)^Official\s*Reserve\s*Assets\S*\s+{_ORA_NUM}\s*$",
            section,
            re.IGNORECASE,
        )
        if m:
            total = parse_number(m.group(1))
    if total is not None and 50 < total < 50_000:
        rows.append(("sl.ei.total_reserves", period, total))

    for label_pat, series_id in _ORA_COMPONENTS:
        m = re.search(
            rf"{label_pat}\s+{_ORA_NUM}",
            section,
            re.IGNORECASE,
        )
        if not m:
            continue
        val = parse_number(m.group(1))
        if val is None:
            continue
        # Gold / IMF / SDRs / other can be small; FX should be material
        if series_id == "sl.ei.reserves.fx" and not (50 < val < 50_000):
            continue
        if series_id != "sl.ei.reserves.fx" and not (0 <= val < 50_000):
            continue
        rows.append((series_id, period, val))
    return rows


def _quarter_start(year: int, quarter: int) -> date:
    return date(year, (quarter - 1) * 3 + 1, 1)


_GDP_ROW_NUM = re.compile(r"\(?-?(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?\)?")

# WEI §1.3 — four columns: annual(t-1), annual(t), quarter(t-1), quarter(t)
_GDP_SECTOR_ROWS: list[tuple[str, str]] = [
    (r"(?m)^Agriculture\b", "sl.ei.gdp.agriculture_yoy"),
    (r"(?m)^Industry\b", "sl.ei.gdp.industry_yoy"),
    (r"(?m)^Services\b", "sl.ei.gdp.services_yoy"),
    (r"(?m)^GDP\b", "sl.ei.gdp.growth"),
]


def _extract_gdp_industrial(text: str) -> list[tuple[str, str, float]]:
    """§1.3 GDP by industrial origin — latest quarter growth for GDP + sectors."""
    block = re.search(
        r"1\.3\s+GDP by Industrial[\s\S]+?(?=1\.4\s+Agricultur)",
        text,
        re.IGNORECASE,
    )
    if not block:
        return []
    section = block.group(0)
    ag = re.search(r"(?m)^Agriculture\b", section)
    if not ag:
        return []
    header = section[: ag.start()]
    body = section[ag.start() :]

    period_d: date | None = None
    # Modern headers: "2025 Q1 2026 Q1" / "2024 Q4 2025 Q4"
    q_labels = re.findall(r"(20\d{2})\s*Q([1-4])", header, re.IGNORECASE)
    if q_labels:
        y, q = q_labels[-1]
        period_d = _quarter_start(int(y), int(q))
    else:
        # Legacy: "3rd Qtr" + year row "2020 2021 2021 2022" → last year + last qtr
        q_ords = re.findall(r"([1-4])(?:st|nd|rd|th)\s*Qtr", header, re.IGNORECASE)
        years = re.findall(r"\b(20\d{2})\b", header)
        if q_ords and years:
            period_d = _quarter_start(int(years[-1]), int(q_ords[-1]))
    if not period_d:
        return []
    period = period_d.isoformat()

    out: list[tuple[str, str, float]] = []
    for pat, series_id in _GDP_SECTOR_ROWS:
        m = re.search(rf"{pat}([^\n]*)", body, re.IGNORECASE)
        if not m:
            continue
        nums: list[float] = []
        for tok in _GDP_ROW_NUM.findall(m.group(1)):
            val = _paren_number(tok)
            if val is None:
                continue
            # Reject chart-axis junk that sometimes trails the four data cells
            if abs(val) > 80:
                continue
            nums.append(val)
        if len(nums) < 4:
            continue
        out.append((series_id, period, nums[3]))
    return out


def _month_from_three_col_header(section: str) -> date | None:
    """Parse `May Apr May / 2025 2026 2026` style headers → latest month-start."""
    months = re.findall(
        r"\b(January|February|March|April|May|June|July|August|September|October|November|December"
        r"|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b",
        section[:400],
        re.IGNORECASE,
    )
    years = re.findall(r"\b(20\d{2})\b", section[:400])
    if not months or not years:
        return None
    mo = MONTHS.get(months[-1].lower())
    if not mo:
        return None
    return date(int(years[-1]), mo, 1)


def _extract_price_indices(text: str) -> list[tuple[str, str, float]]:
    """§1.1 price indices — MoM is owned by consumer-price-inflation (OVERLAP_SKIP).

    Kept as a no-op hook so layout drift tests can still call it; do not emit MoM.
    Food/non-food YoY comes from highlights instead.
    """
    return []


def _extract_pmi(text: str) -> list[tuple[str, str, float]]:
    """§1.6 PMI manufacturing / services / construction — latest month."""
    # Chart-interleaved layout: search whole document with anchored labels.
    rows: list[tuple[str, str, float]] = []
    period_d: date | None = None
    m_hdr = re.search(
        r"PMI Manufacturing[\s\S]{0,80}?"
        r"(May|June|Jul|July|Apr|April)\s+(Jun|June|May|Jul|July)",
        text,
        re.IGNORECASE,
    )
    if m_hdr:
        mo = MONTHS.get(m_hdr.group(2).lower())
        years = re.findall(r"\b(20\d{2})\b", text[m_hdr.start() : m_hdr.start() + 200])
        if mo and years:
            period_d = date(int(years[-1]), mo, 1)
    if not period_d:
        return []
    period = period_d.isoformat()

    m = re.search(
        r"PMI Manufacturing[\s\S]{0,200}?Index\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)",
        text,
        re.IGNORECASE,
    )
    if m:
        val = parse_number(m.group(4))
        if val is not None and 0 < val < 100:
            rows.append(("sl.ei.pmi.manufacturing", period, val))

    m = re.search(
        r"PMI Services[\s\S]{0,200}?Business Ac\S*y Index\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)",
        text,
        re.IGNORECASE,
    )
    if m:
        val = parse_number(m.group(4))
        if val is not None and 0 < val < 100:
            rows.append(("sl.ei.pmi.services", period, val))

    m = re.search(
        r"Total Ac\S*y Index\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)",
        text,
        re.IGNORECASE,
    )
    if m:
        val = parse_number(m.group(4))
        if val is not None and 0 < val < 100:
            rows.append(("sl.ei.pmi.construction", period, val))
    return rows


def _extract_bank_new_rates(text: str) -> list[tuple[str, str, float]]:
    """§2.1 AWNDR / AWNLR (outstanding AWDR/AWLR stay on eResearch 6277)."""
    block = re.search(
        r"2\.1\s+Interest Rates[\s\S]+?(?=2\.2\s+Money Supply)",
        text,
        re.IGNORECASE,
    )
    if not block:
        return []
    section = block.group(0)
    period_d = _month_from_three_col_header(section)
    if not period_d:
        # Fallback: May 2025 April 2026 May 2026 near AWDR
        m = re.search(
            r"(May|April|June|March)\s+20(\d{2})\s+(April|May|June|March)\s+20(\d{2})\s+"
            r"(May|April|June|March)\s+20(\d{2})",
            section,
            re.IGNORECASE,
        )
        if m:
            mo = MONTHS.get(m.group(5).lower())
            if mo:
                period_d = date(2000 + int(m.group(6)), mo, 1)
    if not period_d:
        return []
    period = period_d.isoformat()
    rows: list[tuple[str, str, float]] = []
    for label, sid in (
        (r"Average Weighted New Deposit Rate \(AWNDR\)", "sl.mm.awndr"),
        (r"Average Weighted New Lending Rate \(AWNLR\)", "sl.mm.awnlr"),
    ):
        m = re.search(
            rf"{label}\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)",
            section,
            re.IGNORECASE,
        )
        if not m:
            continue
        val = parse_number(m.group(3))
        if val is not None and 0 < val < 40:
            rows.append((sid, period, val))
    return rows


def _extract_money_credit(text: str) -> list[tuple[str, str, float]]:
    """§2.2 M2b level + YoY, private credit level + YoY."""
    block = re.search(
        r"2\.2\s+Money Supply([\s\S]+?)(?:2\.3\s+Reserve Money)",
        text,
        re.IGNORECASE,
    )
    if not block:
        return []
    section = block.group(1)
    period_d = _month_from_three_col_header(section)
    if not period_d:
        return []
    period = period_d.isoformat()
    rows: list[tuple[str, str, float]] = []

    m = re.search(
        r"\bM2b\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)",
        section,
        re.IGNORECASE,
    )
    if m:
        yago = parse_number(m.group(1))
        latest = parse_number(m.group(3))
        if latest is not None and 100 < latest < 100_000:
            rows.append(("sl.ei.m2b", period, latest))
        if yago and latest and yago > 0:
            rows.append(("sl.ei.m2b_yoy", period, round((latest / yago - 1.0) * 100.0, 2)))

    m = re.search(
        r"Credit to the Private Sector\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)",
        section,
        re.IGNORECASE,
    )
    if m:
        yago = parse_number(m.group(1))
        latest = parse_number(m.group(3))
        if latest is not None and 100 < latest < 50_000:
            rows.append(("sl.ei.credit.private", period, latest))
        if yago and latest and yago > 0:
            rows.append(
                ("sl.ei.credit.private_yoy", period, round((latest / yago - 1.0) * 100.0, 2))
            )
    return rows


def _extract_fiscal_debt(text: str) -> list[tuple[str, str, float]]:
    """§3.1 fiscal balances + §3.2 central government debt."""
    rows: list[tuple[str, str, float]] = []

    fiscal = re.search(
        r"3\.1\s+Government Finance[\s\S]+?(?=3\.2\s+Outstanding)",
        text,
        re.IGNORECASE,
    )
    if fiscal:
        section = fiscal.group(0)
        # January - May → end month May; use latest year in block
        years = re.findall(r"\b(20\d{2})\b", section[:200])
        m_span = re.search(
            r"January\s*[-–]\s*(January|February|March|April|May|June|July|August|"
            r"September|October|November|December)",
            text[max(0, fiscal.start() - 400) : fiscal.end()],
            re.IGNORECASE,
        )
        period_d: date | None = None
        if years:
            mo = MONTHS.get(m_span.group(1).lower()) if m_span else 5
            if not mo:
                mo = 5
            period_d = date(int(years[-1]), mo, 1)
        if period_d:
            period = period_d.isoformat()
            for label, sid in (
                (r"Primary Balance", "sl.ei.fiscal.primary_balance"),
                (r"Overall Budget Balance", "sl.ei.fiscal.overall_balance"),
                (r"Revenue and Grants", "sl.ei.fiscal.revenue_grants"),
                (r"Recurrent Expenditure", "sl.ei.fiscal.recurrent_expenditure"),
            ):
                m = re.search(
                    rf"{label}\s+(\(?-?[\d,]+\.?\d*\)?)\s+(\(?-?[\d,]+\.?\d*\)?)",
                    section,
                    re.IGNORECASE,
                )
                if not m:
                    continue
                # WEI prints Rs. bn — store as Rs. mn to match MEI fiscal series
                val = _paren_number(m.group(2))
                if val is None:
                    continue
                rows.append((sid, period, round(val * 1000.0, 2)))

    debt = re.search(
        r"Total Domes\S*c Debt\S*\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)"
        r"[\s\S]{0,400}?"
        r"Total Foreign Debt\S*\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)"
        r"[\s\S]{0,200}?"
        r"Total Outstanding Central Government Debt\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)",
        text,
        re.IGNORECASE,
    )
    if debt:
        # End Mar. 2026
        period_d = None
        ctx = text[max(0, debt.start() - 200) : debt.end()]
        ends = re.findall(
            r"End\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{4})",
            ctx,
            re.IGNORECASE,
        )
        if ends:
            mo = MONTHS.get(ends[-1][0].lower())
            if mo:
                period_d = date(int(ends[-1][1]), mo, 1)
        if not period_d:
            period_d = date(2026, 3, 1)
        period = period_d.isoformat()
        dom = parse_number(debt.group(2))
        frn = parse_number(debt.group(4))
        tot = parse_number(debt.group(6))
        if dom is not None:
            rows.append(("sl.ei.debt.domestic", period, dom))
        if frn is not None:
            rows.append(("sl.ei.debt.foreign", period, frn))
        if tot is not None:
            rows.append(("sl.ei.debt.total", period, tot))
    return rows


def _extract_trade_ytd(text: str) -> list[tuple[str, str, float]]:
    """§4.5 External Trade — YTD USD mn columns."""
    block = re.search(
        r"4\.5\s+External Trade([\s\S]+?)(?:4\.6\s+Trade Indices|4\.7\s+Commodity)",
        text,
        re.IGNORECASE,
    )
    if not block:
        return []
    section = block.group(1)
    # Jan - May → May
    m_span = re.search(
        r"Jan\s*[-–]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)",
        section[:200],
        re.IGNORECASE,
    )
    years = re.findall(r"\b(20\d{2})\b", section[:200])
    if not years:
        return []
    mo = MONTHS.get(m_span.group(1).lower()) if m_span else 5
    if not mo:
        mo = 5
    period = date(int(years[-1]), mo, 1).isoformat()
    rows: list[tuple[str, str, float]] = []

    m = re.search(
        r"\bExports\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)",
        section,
        re.IGNORECASE,
    )
    if m:
        val = parse_number(m.group(2))
        if val is not None:
            rows.append(("sl.ei.trade.exports_ytd", period, val))
    m = re.search(
        r"\bImports\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)",
        section,
        re.IGNORECASE,
    )
    if m:
        val = parse_number(m.group(2))
        if val is not None:
            rows.append(("sl.ei.trade.imports_ytd", period, val))
    m = re.search(
        r"Trade Balance\s+(\(?-?[\d,]+\.\d+\)?)\s+(\(?-?[\d,]+\.\d+\)?)",
        section,
        re.IGNORECASE,
    )
    if m:
        val = _paren_number(m.group(2))
        if val is not None:
            rows.append(("sl.ei.trade.balance_ytd", period, val))
    return rows


def _extract_reserve_drains(text: str) -> list[tuple[str, str, float]]:
    """§4.4 predetermined short-term drains — FX forward short total."""
    block = re.search(
        r"4\.4\s+International Reserves[\s\S]+?(?=4\.5\s+External Trade|\Z)",
        text,
        re.IGNORECASE,
    )
    if not block:
        return []
    section = block.group(0)
    period_d = _parse_as_at_month(section)
    if not period_d:
        m = re.search(
            r"as at end\s+([A-Za-z]+)\s+(\d{4})",
            section[:200],
            re.IGNORECASE,
        )
        if m:
            mo = MONTHS.get(m.group(1).lower())
            if mo:
                period_d = date(int(m.group(2)), mo, 1)
    if not period_d:
        return []
    period = period_d.isoformat()
    rows: list[tuple[str, str, float]] = []

    # Prefer "forward leg of (4,044)" then Short positions total (first paren thousands)
    m = re.search(
        r"forward leg of\s+\(([\d]{1,2},[\d]{3})\)",
        section,
        re.IGNORECASE,
    )
    if not m:
        m = re.search(
            r"Short posi\S*\s*\([^)]*\)(?:\([^)]*\))?\s*\(([\d]{1,2},[\d]{3})\)",
            section,
            re.IGNORECASE,
        )
    fwd: float | None = None
    if m:
        fwd = _paren_number(m.group(1))
        # Table prints negatives in parens → already negative via _paren_number
        if fwd is not None and fwd > 0:
            fwd = -fwd
        if fwd is not None and -50_000 < fwd <= 0:
            rows.append(("sl.ei.reserves.fwd_short", period, float(fwd)))

    # ORA printed in §4.4 header line for same as-of
    ora = None
    m = re.search(
        r"Official Reserve Assets\S*\s+([\d,]+)",
        section,
        re.IGNORECASE,
    )
    if m:
        ora = parse_number(m.group(1))
    if ora is not None and fwd is not None:
        rows.append(("sl.ei.reserves.net_after_drains", period, round(ora + fwd, 2)))
    return rows


def _extract_electricity_mix(text: str) -> dict[str, float]:
    """§1.10 — latest-day thermal oil GWh + share of total."""
    out: dict[str, float] = {}
    block = re.search(
        r"1\.10\s+Daily Electricity Generation([\s\S]+?)(?:2\.1\s+Interest|1\.9\s+Average)",
        text,
        re.IGNORECASE,
    )
    if not block:
        return out
    section = block.group(1)
    m_tot = re.search(
        r"Total Energy \(GWh\)\s+([\d.]+(?:\s+[\d.]+){1,6})",
        section,
        re.IGNORECASE,
    )
    m_oil = re.search(
        r"Thermal Oil\s+([\d.]+(?:\s+[\d.]+){1,6})",
        section,
        re.IGNORECASE,
    )
    if not m_tot or not m_oil:
        return out
    totals = [parse_number(x) for x in m_tot.group(1).split()]
    oils = [parse_number(x) for x in m_oil.group(1).split()]
    totals = [t for t in totals if t is not None]
    oils = [o for o in oils if o is not None]
    if not totals or not oils:
        return out
    total = totals[-1]
    oil = oils[-1]
    out["thermal_oil"] = oil
    if total > 0:
        out["thermal_oil_share"] = round(oil / total * 100.0, 2)
    return out


def _extract_bid_ask(text: str) -> dict[str, float]:
    """§3.5 3M T-bill price spread + §3.3.1 5Y bond yield buy−sell."""
    out: dict[str, float] = {}
    m = re.search(
        r"3\s*Month\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+([\d.]+)",
        text,
    )
    if m:
        val = parse_number(m.group(1))
        if val is not None and 0 <= val < 5:
            out["tbill_3m_spread"] = val

    # Bond row: buy sell this_avg last_avg when primary blank: `- 11.77 11.62 11.70 11.51`
    m = re.search(
        r"<\s*5\s*Years?\s+-?\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)",
        text,
        re.IGNORECASE,
    )
    if m:
        buy = parse_number(m.group(1))
        sell = parse_number(m.group(2))
        if buy is not None and sell is not None and 0 < sell < buy < 40:
            out["tbond_5y_bid_ask"] = round(buy - sell, 4)
    return out


def _extract_tourism_earnings(text: str, period: str | None) -> list[tuple[str, str, float]]:
    """§4.2 Earnings from Tourism USD mn."""
    if not period:
        return []
    rows: list[tuple[str, str, float]] = []
    m = re.search(
        r"Earnings from Tourism\s+USD mn\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)\S*\s+"
        r"([\d,]+\.\d+)\s+([\d,]+\.\d+)",
        text,
        re.IGNORECASE,
    )
    if m:
        monthly = parse_number(m.group(2))
        ytd = parse_number(m.group(4))
        if monthly is not None:
            rows.append(("sl.ei.tourist_earnings_usd", period, monthly))
        if ytd is not None:
            rows.append(("sl.ei.tourist_earnings_usd_ytd", period, ytd))
    return rows


def _extract_external(text: str) -> list[tuple[str, str, float]]:
    """Return (seriesId, period_iso, value) for month-stamped external prints."""
    rows: list[tuple[str, str, float]] = []
    rows.extend(_extract_ora(text))
    rows.extend(_extract_gdp_industrial(text))
    rows.extend(_extract_price_indices(text))
    rows.extend(_extract_pmi(text))
    rows.extend(_extract_bank_new_rates(text))
    rows.extend(_extract_money_credit(text))
    rows.extend(_extract_fiscal_debt(text))
    rows.extend(_extract_trade_ytd(text))
    rows.extend(_extract_reserve_drains(text))

    period_d = _infer_external_month(text)
    period = period_d.isoformat() if period_d else None

    m = re.search(
        r"Workers' Remi\S*ances \(Inflows\)\s+USD mn\s+"
        r"([\d,]+\.\d+)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)",
        text,
        re.IGNORECASE,
    )
    if m and period:
        monthly = parse_number(m.group(2))
        ytd = parse_number(m.group(4))
        if monthly is not None:
            rows.append(("sl.ei.remittances_usd", period, monthly))
        if ytd is not None:
            rows.append(("sl.ei.remittances_usd_ytd", period, ytd))

    m = re.search(
        r"Tourist Arrivals\s+Number\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)",
        text,
        re.IGNORECASE,
    )
    if m and period:
        monthly = parse_number(m.group(2))
        ytd = parse_number(m.group(4))
        if monthly is not None:
            rows.append(("sl.ei.tourist_arrivals", period, float(monthly)))
        if ytd is not None:
            rows.append(("sl.ei.tourist_arrivals_ytd", period, float(ytd)))
    else:
        # Jul layouts sometimes garble the YTD column — still take monthly + trailing YTD int
        m = re.search(
            r"Tourist Arrivals\s+Number\s+([\d,]+)\s+([\d,]+)[\s\S]{0,40}?([\d,]{6,})",
            text,
            re.IGNORECASE,
        )
        if m and period:
            monthly = parse_number(m.group(2))
            ytd = parse_number(m.group(3))
            if monthly is not None:
                rows.append(("sl.ei.tourist_arrivals", period, float(monthly)))
            if ytd is not None:
                rows.append(("sl.ei.tourist_arrivals_ytd", period, float(ytd)))

    rows.extend(_extract_tourism_earnings(text, period))
    return rows


def normalize_wei_pdf(
    data: bytes,
    source_url: str,
    *,
    fallback_period: date | None = None,
    bounds: dict[str, tuple[float, float]],
    obs: ObsBuilder = make_obs,
) -> list[dict[str, Any]]:
    text = pdf_text(data, max_pages=20)
    period_d = parse_wei_period(text, fallback_period)
    if not period_d:
        raise RuntimeError("WEI: could not parse week-ending date")
    period = period_d.isoformat()
    out: list[dict[str, Any]] = []

    def add(
        series_id: str,
        value: float | None,
        confidence: float = 0.88,
        *,
        period_override: str | None = None,
    ) -> None:
        if value is None:
            return
        item = obs(
            series_id,
            period_override or period,
            value,
            source_url,
            confidence,
            bounds,
        )
        if item:
            out.append(item)

    hi = _extract_highlights(text)
    share = _extract_share_table(text)
    curve = _extract_tbill_bond_curve(text)
    isbs = _extract_isbs(text)
    auction = _extract_auction(text)
    fx = _extract_fx_week(text)
    elec = _extract_electricity_mix(text)
    spreads = _extract_bid_ask(text)

    # --- YTD (primary WEI fill) ---
    add("sl.fx.usd.ytd_change_pct", hi.get("usd_ytd_pct"), 0.9)
    add("sl.ei.ncpi.food_yoy", hi.get("ncpi_food_yoy"), 0.86)
    add("sl.ei.ncpi.nonfood_yoy", hi.get("ncpi_nonfood_yoy"), 0.86)
    add("sl.ei.energy.brent_wow", hi.get("brent_wow"), 0.84)

    # --- Equity fills only (levels stay on DEI; do not overwrite daily primaries) ---
    add("sl.eq.foreign_net", share.get("foreign_net"), 0.88)
    add("sl.eq.aspi_wow_pct", hi.get("aspi_wow_pct"), 0.85)
    add("sl.eq.sp_sl20_wow_pct", hi.get("sp_wow_pct"), 0.85)
    # share table levels are parsed for foreign_net / future reconcile only — not ingested.

    add("sl.ei.liquidity_surplus", hi.get("liquidity_surplus_bn"), 0.86)
    add("sl.ei.electricity.thermal_oil", elec.get("thermal_oil"), 0.84)
    add("sl.ei.electricity.thermal_oil_share", elec.get("thermal_oil_share"), 0.84)
    add("sl.fi.tbill.3m.bid_ask_spread", spreads.get("tbill_3m_spread"), 0.84)
    add("sl.fi.tbond.5y.bid_ask_yield", spreads.get("tbond_5y_bid_ask"), 0.84)

    # --- Bond secondary curve (WEI fill) ---
    for _, suffix in _BOND_TENORS:
        add(
            f"sl.fi.tbond.{suffix}.secondary_mid",
            curve.get(f"tbond.{suffix}.secondary_mid"),
            0.86,
        )

    # --- ISBs ---
    for _, key in _ISB_KEYS:
        add(f"sl.fi.isb.{key}", isbs.get(f"isb.{key}"), 0.85)

    # --- Auction / stocks ---
    add("sl.fi.tbill.auction.offered", auction.get("tbill_auction_offered"), 0.84)
    add("sl.fi.tbill.auction.bids", auction.get("tbill_auction_bids"), 0.84)
    add("sl.fi.tbill.auction.accepted", auction.get("tbill_auction_accepted"), 0.84)
    add("sl.fi.tbill.auction.cover", auction.get("tbill_auction_cover"), 0.84)
    add("sl.fi.gov.foreign_holdings", auction.get("gov_foreign_holdings"), 0.84)
    add("sl.fi.gov.tbill_stock", auction.get("gov_tbill_stock"), 0.84)
    add("sl.fi.gov.tbond_stock", auction.get("gov_tbond_stock"), 0.84)

    # --- Weekly FX averages + forwards ---
    for ccy in ("usd", "gbp", "eur", "jpy"):
        add(f"sl.fx.{ccy}.week_avg_buy", fx.get(f"{ccy}.week_avg_buy"), 0.88)
        add(f"sl.fx.{ccy}.week_avg_sell", fx.get(f"{ccy}.week_avg_sell"), 0.88)
        add(f"sl.fx.{ccy}.week_avg_mid", fx.get(f"{ccy}.week_avg_mid"), 0.9)
        add(f"sl.fx.{ccy}.week_avg_mid_wow_pct", fx.get(f"{ccy}.week_avg_mid_wow_pct"), 0.85)
        add(f"sl.fx.{ccy}.week_avg_mid_yoy_pct", fx.get(f"{ccy}.week_avg_mid_yoy_pct"), 0.85)
    add("sl.fx.usd.fwd_1m", fx.get("usd.fwd_1m"), 0.86)
    add("sl.fx.usd.fwd_3m", fx.get("usd.fwd_3m"), 0.86)

    # --- External month stamps (fill / confirm MEI) ---
    for series_id, per, value in _extract_external(text):
        add(series_id, value, 0.83, period_override=per)

    if not out:
        raise RuntimeError("WEI: zero observations extracted (layout may have changed)")
    return out
