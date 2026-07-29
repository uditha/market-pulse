"""Daily Economic Indicators (1-page Tableau PDF) parser.

Skips money-market / policy / CPI overlaps. Captures FX, reserve money,
equities, energy, and FI T-bill primary yields.
"""

from __future__ import annotations

import re
from datetime import date
from typing import Any, Callable

from .common import make_obs, parse_human_date, parse_number, pdf_text

ObsBuilder = Callable[..., dict[str, Any] | None]


def _compact_spaces(text: str) -> str:
    return re.sub(r"[ \t]+", " ", text)


def parse_dei_period(text: str, fallback: date | None = None) -> date | None:
    m = re.search(
        r"Daily Economic Indicators\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})",
        text,
    )
    if m:
        return parse_human_date(m.group(1))
    return fallback


def _pair_after_label(text: str, label: str) -> tuple[float, float] | None:
    """Match `USD 305.8354 313.4295` style rows."""
    m = re.search(
        rf"\b{re.escape(label)}\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)",
        text,
    )
    if not m:
        return None
    a, b = parse_number(m.group(1)), parse_number(m.group(2))
    if a is None or b is None:
        return None
    return a, b


def _last_of_pair(text: str, label: str) -> float | None:
    """For two-column date tables, take the latest (rightmost) value."""
    pair = _pair_after_label(text, label)
    return pair[1] if pair else None


def _usd_spot_from_words(data: bytes) -> float | None:
    """Indicative USD/LKR spot via word proximity (Tableau text order is unstable)."""
    import pdfplumber
    from io import BytesIO

    with pdfplumber.open(BytesIO(data)) as pdf:
        page = pdf.pages[0]
        words = page.extract_words() or []
    anchors = [
        w
        for w in words
        if w["text"] in {"Indicative", "Spot", "USD/LKR"}
        or "Indicative" in w["text"]
    ]
    if not anchors:
        return None
    ax = sum(w["x0"] for w in anchors) / len(anchors)
    ay = sum(w["top"] for w in anchors) / len(anchors)
    best: tuple[float, float] | None = None  # (distance, value)
    for w in words:
        raw = w["text"].replace(",", "")
        if not re.fullmatch(r"\d{2,3}\.\d{2}", raw):
            continue
        value = parse_number(raw)
        if value is None or not (200 <= value <= 500):
            continue
        # Prefer annotations near the spot chart (below/right of label).
        dist = abs(w["top"] - ay) + abs(w["x0"] - ax) * 0.5
        if w["top"] + 5 < ay:
            dist += 80  # above the label is usually TT table
        if best is None or dist < best[0]:
            best = (dist, value)
    return best[1] if best else None


def _usd_spot(text: str, data: bytes) -> float | None:
    from_words = _usd_spot_from_words(data)
    if from_words is not None:
        return from_words
    # Text fallback: 2-decimal 3xx near reversed "Rs. Per USD" chart junk
    m = re.search(r"(?<![\d,])(3\d{2}\.\d{2})(?![\d])\s*\n\s*24,000", text)
    if m:
        return parse_number(m.group(1))
    return None


def _share_block(text: str) -> dict[str, float]:
    """Parse share-market box; Tableau occasionally reorders ASPI vs market-cap lines."""
    out: dict[str, float] = {}
    # Layout A (Jan 2026): Turnover, ASPI, Market Cap, PE, S&P
    m = re.search(
        r"ASPI and S&P SL\s*20\s*"
        r"Daily Turnover \(Rs\. mn\)\s+([\d,]+\.\d+)\s+"
        r"([\d,]+\.\d+)\s+"
        r"Market Capitalization \(Rs\. bn\)\s+([\d,]+\.\d+)\s+"
        r"PE Ratio\s+([\d,]+\.\d+)\s+"
        r"([\d,]+\.\d+)",
        text,
    )
    if m:
        mapping = [
            ("turnover", m.group(1)),
            ("aspi", m.group(2)),
            ("market_cap", m.group(3)),
            ("pe", m.group(4)),
            ("sp_sl20", m.group(5)),
        ]
        for key, raw in mapping:
            val = parse_number(raw)
            if val is not None:
                out[key] = val
    else:
        # Layout B (Jul 2026): Turnover, Market Cap, ASPI, PE, S&P
        m = re.search(
            r"ASPI and S&P SL\s*20\s*"
            r"Daily Turnover \(Rs\. mn\)\s+([\d,]+\.\d+)\s+"
            r"Market Capitalization \(Rs\. bn\)\s+([\d,]+\.\d+)\s+"
            r"([\d,]+\.\d+)\s+"
            r"PE Ratio\s+([\d,]+\.\d+)\s+"
            r"([\d,]+\.\d+)",
            text,
        )
        if m:
            mapping = [
                ("turnover", m.group(1)),
                ("market_cap", m.group(2)),
                ("aspi", m.group(3)),
                ("pe", m.group(4)),
                ("sp_sl20", m.group(5)),
            ]
            for key, raw in mapping:
                val = parse_number(raw)
                if val is not None:
                    out[key] = val

    for key, pat in [
        ("foreign_purchases", r"Foreign Purchases\s+([\d,]+\.\d+)"),
        ("foreign_sales", r"Foreign Sales\s+([\d,]+\.\d+)"),
    ]:
        mm = re.search(pat, text)
        if mm:
            val = parse_number(mm.group(1))
            if val is not None:
                out[key] = val
    return out


def _fuel_prices(text: str) -> dict[str, float]:
    out: dict[str, float] = {}
    m = re.search(
        r"Petrol \(92 octane\):\s*([\d.\s]+?)\s*Auto Diesel:\s*([\d.\s]+?)\s*"
        r"Kerosene:\s*([\d.\s]+)",
        text,
    )
    if not m:
        return out
    for key, raw in [
        ("petrol_92", m.group(1)),
        ("auto_diesel", m.group(2)),
        ("kerosene", m.group(3)),
    ]:
        val = parse_number(raw)
        if val is not None:
            out[key] = val
    return out


def _global_energy(text: str) -> dict[str, float]:
    """Brent WTI OPEC + Singapore refined sit on one numeric row after Peak Demand."""
    out: dict[str, float] = {}
    m = re.search(
        r"Peak Demand \(MW\)\s+[\d,]+\.\d+\s+[\d,]+\.\d+\s+"
        r"([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)",
        text,
    )
    if not m:
        # Alternate: numbers immediately under Brent WTI OPEC header
        m = re.search(
            r"Brent\s+WTI\s+OPEC\s+Petrol\s+Diesel\s+Kerosene[\s\S]{0,120}?"
            r"([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)",
            text,
        )
    if not m:
        return out
    keys = ("brent", "wti", "opec", "sg_petrol", "sg_diesel", "sg_kerosene")
    for key, raw in zip(keys, m.groups()):
        val = parse_number(raw)
        if val is not None:
            out[key] = val
    return out


def _tbill_primary(text: str) -> dict[str, float]:
    """Primary T-bill yields from the Yield Rates block (labels are often detached).

    Block shape:
      Yield Rates of T-Bills
      (per cent)
      31-Dec-25 01-Jan-26
      7.74 -
      8.27 8.42
      8.45 -
    """
    out: dict[str, float] = {}
    m = re.search(
        r"Yield Rates of T-Bills\s*\n\s*\(per cent\)\s*\n"
        r"[^\n]+\n"
        r"([\d.]+)\s+(-|[\d.]+)\s*\n"
        r"([\d.]+)\s+(-|[\d.]+)\s*\n"
        r"([\d.]+)\s+(-|[\d.]+)",
        text,
    )
    if not m:
        return out
    rows = [
        ("91d", m.group(1), m.group(2)),
        ("182d", m.group(3), m.group(4)),
        ("364d", m.group(5), m.group(6)),
    ]
    for suffix, primary_raw, secondary_raw in rows:
        primary = parse_number(primary_raw)
        if primary is not None and 0 < primary < 40:
            out[f"{suffix}.primary"] = primary
        if secondary_raw != "-":
            secondary = parse_number(secondary_raw)
            if secondary is not None and 0 < secondary < 40:
                out[f"{suffix}.secondary"] = secondary
    return out


def normalize_dei_pdf(
    data: bytes,
    source_url: str,
    *,
    fallback_period: date | None = None,
    bounds: dict[str, tuple[float, float]],
    obs: ObsBuilder = make_obs,
) -> list[dict[str, Any]]:
    text = _compact_spaces(pdf_text(data, max_pages=1))
    period_d = parse_dei_period(text, fallback_period)
    if not period_d:
        raise RuntimeError("DEI: could not parse report date from PDF")
    period = period_d.isoformat()
    out: list[dict[str, Any]] = []

    def add(series_id: str, value: float | None, confidence: float = 0.9) -> None:
        if value is None:
            return
        item = obs(series_id, period, value, source_url, confidence, bounds)
        if item:
            out.append(item)

    for ccy, sid in [
        ("USD", "usd"),
        ("GBP", "gbp"),
        ("EUR", "eur"),
        ("JPY", "jpy"),
    ]:
        pair = _pair_after_label(text, ccy)
        if pair:
            add(f"sl.fx.{sid}.tt_buy", pair[0], 0.92)
            add(f"sl.fx.{sid}.tt_sell", pair[1], 0.92)

    add("sl.fx.usd.spot", _usd_spot(text, data), 0.88)

    add("sl.ei.currency_in_circulation", _last_of_pair(text, "Currency in Circulation"), 0.93)
    add("sl.ei.reserve_money", _last_of_pair(text, "Reserve Money"), 0.93)

    shares = _share_block(text)
    add("sl.eq.aspi", shares.get("aspi"), 0.91)
    add("sl.eq.sp_sl20", shares.get("sp_sl20"), 0.91)
    add("sl.eq.turnover", shares.get("turnover"), 0.91)
    add("sl.eq.market_cap", shares.get("market_cap"), 0.91)
    add("sl.eq.pe_ratio", shares.get("pe"), 0.9)
    add("sl.eq.foreign_purchases", shares.get("foreign_purchases"), 0.9)
    add("sl.eq.foreign_sales", shares.get("foreign_sales"), 0.9)

    fuel = _fuel_prices(text)
    add("sl.ei.fuel.petrol_92", fuel.get("petrol_92"), 0.9)
    add("sl.ei.fuel.auto_diesel", fuel.get("auto_diesel"), 0.9)
    add("sl.ei.fuel.kerosene", fuel.get("kerosene"), 0.9)

    energy = _global_energy(text)
    for key, series in [
        ("brent", "sl.ei.energy.brent"),
        ("wti", "sl.ei.energy.wti"),
        ("opec", "sl.ei.energy.opec"),
        ("sg_petrol", "sl.ei.energy.sg_petrol"),
        ("sg_diesel", "sl.ei.energy.sg_diesel"),
        ("sg_kerosene", "sl.ei.energy.sg_kerosene"),
    ]:
        add(series, energy.get(key), 0.88)

    add("sl.ei.electricity.generation", _last_of_pair(text, "Total Energy (GWh)"), 0.9)
    add("sl.ei.electricity.peak_demand", _last_of_pair(text, "Peak Demand (MW)"), 0.9)

    tbills = _tbill_primary(text)
    for suffix, value in tbills.items():
        add(f"sl.fi.tbill.{suffix}", value, 0.87)

    if not out:
        raise RuntimeError("DEI: zero observations extracted")
    return out
