"""Fetch listing → download PDFs → parse → ingest for DEI / WEI / MEI."""

from __future__ import annotations

import time
from datetime import date
from pathlib import Path
from typing import Any, Callable

import httpx

from .common import (
    LISTINGS,
    PDF_REPORT_IDS,
    content_hash_bytes,
    discover_listing_pdfs,
    download_pdf,
    filter_by_window,
    iso,
    utc_now_iso,
)
from .dei import normalize_dei_pdf
from .esp import normalize_esp_pdf
from .mei import normalize_mei_pdf
from .wei import normalize_wei_pdf

NORMALIZERS: dict[str, Callable[..., list[dict[str, Any]]]] = {
    "daily-economic-indicators": normalize_dei_pdf,
    "weekly-economic-indicators": normalize_wei_pdf,
    "monthly-economic-indicators": normalize_mei_pdf,
    "external-sector-performance": normalize_esp_pdf,
}

FIXTURE_NAMES = {
    "daily-economic-indicators": "daily-economic-indicators.pdf",
    "weekly-economic-indicators": "weekly-economic-indicators.pdf",
    "monthly-economic-indicators": "monthly-economic-indicators.pdf",
    "external-sector-performance": "external-sector-performance.pdf",
}


def fetch_and_ingest_pdf_reports(
    report_id: str,
    from_d: date,
    to_d: date,
    *,
    dry_run: bool,
    force: bool,
    raw_dir: Path,
    bounds: dict[str, tuple[float, float]],
    post_ingest: Callable[[list[dict[str, Any]], dict[str, Any], bool], dict[str, Any]],
    delay_sec: float = 4.0,
    max_listing_pages: int = 50,
) -> dict[str, Any]:
    if report_id not in LISTINGS:
        raise ValueError(f"Unknown PDF report {report_id}")

    listing = LISTINGS[report_id]
    normalize = NORMALIZERS[report_id]
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
        ),
    }

    chunks: list[dict[str, Any]] = []
    total_obs = 0
    series_acc: set[str] = set()
    listed_count = 0
    fetched_count = 0

    with httpx.Client(follow_redirects=True, timeout=120.0, headers=headers) as client:
        print(
            f"    Discovering PDF listing ({listing.listing_url}) …",
            flush=True,
        )
        listed = discover_listing_pdfs(
            report_id,
            max_pages=max_listing_pages,
            client=client,
        )
        listed_count = len(listed)
        windowed = filter_by_window(listed, from_d, to_d)
        # Publish lag / weekends: if the lookback window is empty, still try newest.
        if not windowed and listed and listed[0].period <= to_d:
            windowed = [listed[0]]
        fetched_count = len(windowed)
        print(
            f"    Found {listed_count} listing item(s); "
            f"{fetched_count} in window {iso(from_d)} → {iso(to_d)}",
            flush=True,
        )

        for i, item in enumerate(windowed):
            step = f"[{i + 1}/{fetched_count}]"
            if i > 0 and delay_sec > 0:
                print(
                    f"    {step} waiting {delay_sec:.0f}s before next PDF …",
                    flush=True,
                )
                time.sleep(delay_sec)
            print(
                f"    {step} download {iso(item.period)} — {item.title}",
                flush=True,
            )
            try:
                pdf_bytes, final_url = download_pdf(
                    item.url,
                    referer=listing.listing_url,
                    client=client,
                )
            except Exception as exc:  # noqa: BLE001
                print(f"    {step} WARN skip {iso(item.period)}: {exc}", flush=True)
                chunks.append(
                    {
                        "ok": False,
                        "period": iso(item.period),
                        "url": item.url,
                        "error": str(exc),
                        "observations": 0,
                        "seriesIds": [],
                    }
                )
                continue

            digest = content_hash_bytes(pdf_bytes)
            raw_path = raw_dir / f"{report_id}_{iso(item.period)}_{digest[:10]}.pdf"
            raw_path.parent.mkdir(parents=True, exist_ok=True)
            raw_path.write_bytes(pdf_bytes)
            print(
                f"    {step} parse {iso(item.period)} ({len(pdf_bytes):,} bytes) …",
                flush=True,
            )

            try:
                observations = normalize(
                    pdf_bytes,
                    final_url,
                    fallback_period=item.period,
                    bounds=bounds,
                )
            except Exception as exc:  # noqa: BLE001
                print(f"    {step} WARN parse {iso(item.period)}: {exc}", flush=True)
                chunks.append(
                    {
                        "ok": False,
                        "period": iso(item.period),
                        "url": final_url,
                        "rawPath": str(raw_path),
                        "contentHash": digest,
                        "error": str(exc),
                        "observations": 0,
                        "seriesIds": [],
                    }
                )
                continue

            periods = sorted({o["period"] for o in observations})
            meta = {
                "sourceReportId": report_id,
                "url": final_url,
                "contentHash": digest,
                "fromDate": periods[0],
                "toDate": periods[-1],
                "rawPath": str(raw_path),
                "fetchedAt": utc_now_iso(),
                "force": force,
            }
            mode = "dry-run" if dry_run else "ingest"
            print(
                f"    {step} {mode} {len(observations)} obs "
                f"({periods[0]}→{periods[-1]}) …",
                flush=True,
            )
            ingest_result = post_ingest(observations, meta, dry_run)
            skipped = bool(
                isinstance(ingest_result, dict) and ingest_result.get("skipped")
            )
            if skipped:
                reason = (
                    ingest_result.get("reason")
                    if isinstance(ingest_result, dict)
                    else "skipped"
                )
                print(
                    f"    {step} skip unchanged ({reason})",
                    flush=True,
                )
            else:
                print(
                    f"    {step} OK → {len(observations)} observations",
                    flush=True,
                )
            chunk = {
                "ok": True,
                "skipped": skipped,
                "period": iso(item.period),
                "title": item.title,
                "url": final_url,
                "rawPath": str(raw_path),
                "contentHash": digest,
                "observations": 0 if skipped else len(observations),
                "seriesIds": sorted({o["seriesId"] for o in observations}),
                "window": {"from": periods[0], "to": periods[-1]},
                "ingest": ingest_result,
            }
            chunks.append(chunk)
            if not skipped:
                total_obs += len(observations)
                series_acc.update(chunk["seriesIds"])

    failed = [c for c in chunks if not c.get("ok")]
    succeeded = [c for c in chunks if c.get("ok")]
    # Partial success is OK — one missing/404 day must not fail the whole report.
    batch_ok = bool(succeeded) or fetched_count == 0
    warning = None
    if failed and succeeded:
        warning = (
            f"{len(failed)} of {len(chunks)} PDF(s) skipped "
            f"({', '.join(c.get('period', '?') for c in failed)})"
        )
    elif failed and not succeeded:
        warning = failed[0].get("error") or "pdf_batch_failed"

    return {
        "ok": batch_ok,
        "error": None if batch_ok else warning,
        "warning": warning if batch_ok and failed else None,
        "observations": total_obs,
        "seriesIds": sorted(series_acc),
        "rawPath": next(
            (c.get("rawPath") for c in reversed(chunks) if c.get("rawPath")),
            None,
        ),
        "contentHash": next(
            (c.get("contentHash") for c in reversed(chunks) if c.get("contentHash")),
            None,
        ),
        "htmlBytes": 0,
        "window": {"from": iso(from_d), "to": iso(to_d)},
        "listed": listed_count,
        "fetched": fetched_count,
        "failedFiles": len(failed),
        "okFiles": len(succeeded),
        "chunks": chunks,
        "ingest": {"mode": "pdf_batch", "files": len(chunks)},
    }


def run_pdf_self_test(
    fixtures_dir: Path,
    bounds: dict[str, tuple[float, float]],
) -> list[str]:
    """Return list of failure messages (empty = pass)."""
    failures: list[str] = []

    # DEI golden values from 01 January 2026 fixture
    dei_path = fixtures_dir / FIXTURE_NAMES["daily-economic-indicators"]
    if not dei_path.exists():
        failures.append(f"missing fixture {dei_path}")
    else:
        obs = normalize_dei_pdf(
            dei_path.read_bytes(),
            "fixture://daily-economic-indicators",
            fallback_period=date(2026, 1, 1),
            bounds=bounds,
        )
        by_id = {o["seriesId"]: o for o in obs}
        expect = {
            "sl.fx.usd.tt_buy": 305.8354,
            "sl.fx.usd.tt_sell": 313.4295,
            "sl.fx.usd.spot": 309.98,
            "sl.ei.currency_in_circulation": 1_569_169.17,
            "sl.ei.reserve_money": 1_848_475.42,
            "sl.eq.aspi": 22_624.31,
            "sl.eq.sp_sl20": 6_157.38,
            "sl.eq.turnover": 4_654.88,
            "sl.eq.market_cap": 8_068.62,
            "sl.eq.pe_ratio": 10.73,
            "sl.ei.fuel.petrol_92": 294.0,
            "sl.ei.fuel.auto_diesel": 277.0,
            "sl.ei.energy.brent": 60.99,
            "sl.ei.electricity.generation": 44.65,
            "sl.fi.tbill.91d.primary": 7.74,
        }
        for sid, val in expect.items():
            got = by_id.get(sid)
            if not got or abs(got["value"] - val) > 0.011:
                failures.append(f"DEI {sid}: expected {val}, got {got}")
            elif got["period"] != "2026-01-01":
                failures.append(f"DEI {sid}: bad period {got['period']}")
        # Overlap must not appear
        if "sl.mm.opr" in by_id or "sl.mm.overnight_liquidity" in by_id:
            failures.append("DEI leaked overlap series")
        print(f"OK daily-economic-indicators: {len(obs)} observations")

        # Second layout fixture (Jul 2026) — ASPI/market-cap order flipped
        dei_jul = fixtures_dir / "daily-economic-indicators-20260723.pdf"
        if dei_jul.exists():
            jul = normalize_dei_pdf(
                dei_jul.read_bytes(),
                "fixture://daily-economic-indicators-20260723",
                bounds=bounds,
            )
            jul_by = {o["seriesId"]: o for o in jul}
            jul_aspi = jul_by.get("sl.eq.aspi")
            jul_usd = jul_by.get("sl.fx.usd.tt_buy")
            if not jul_aspi or abs(jul_aspi["value"] - 21_199.37) > 0.011:
                failures.append(f"DEI Jul ASPI expected 21199.37 got {jul_aspi}")
            if not jul_usd or abs(jul_usd["value"] - 331.6477) > 0.0002:
                failures.append(f"DEI Jul USD buy expected 331.6477 got {jul_usd}")
            print(f"OK daily-economic-indicators (Jul layout): {len(jul)} observations")

    wei_path = fixtures_dir / FIXTURE_NAMES["weekly-economic-indicators"]
    if not wei_path.exists():
        failures.append(f"missing fixture {wei_path}")
    else:
        obs = normalize_wei_pdf(
            wei_path.read_bytes(),
            "fixture://weekly-economic-indicators",
            fallback_period=date(2026, 3, 20),
            bounds=bounds,
        )
        by_id = {o["seriesId"]: o for o in obs}
        expect = {
            "sl.fx.usd.ytd_change_pct": 0.5,
            "sl.fx.usd.week_avg_mid": 311.59,
            "sl.fx.usd.fwd_1m": 312.25,
            "sl.fi.tbond.2y.secondary_mid": 8.76,
            "sl.fi.tbond.10y.secondary_mid": 10.83,
            "sl.fi.isb.2028_04_pdi": 6.31,
            "sl.ei.liquidity_surplus": 323.04,
            "sl.ei.remittances_usd_ytd": 1_480.1,
            "sl.eq.foreign_net": -783.07,
            "sl.eq.aspi_wow_pct": -4.85,
            "sl.ei.total_reserves": 7_284.0,
            "sl.ei.reserves.fx": 7_057.0,
            "sl.ei.reserves.gold": 200.0,
            "sl.ei.gdp.growth": 4.8,
            "sl.ei.gdp.agriculture_yoy": 2.1,
            "sl.ei.gdp.industry_yoy": 7.3,
            "sl.ei.gdp.services_yoy": 3.1,
        }
        for sid, val in expect.items():
            got = by_id.get(sid)
            if not got or abs(got["value"] - val) > 0.011:
                failures.append(f"WEI {sid}: expected {val}, got {got}")
        ytd = by_id.get("sl.fx.usd.ytd_change_pct")
        if ytd and ytd.get("period") != "2026-03-20":
            failures.append(f"WEI YTD bad period {ytd.get('period')}")
        ora = by_id.get("sl.ei.total_reserves")
        if ora and ora.get("period") != "2026-02-01":
            failures.append(f"WEI ORA bad period {ora.get('period')}")
        gdp = by_id.get("sl.ei.gdp.growth")
        if gdp and gdp.get("period") != "2025-10-01":
            failures.append(f"WEI GDP bad period {gdp.get('period')}")
        # Must not clobber DEI / locked MM primaries
        for leak in (
            "sl.eq.aspi",
            "sl.eq.sp_sl20",
            "sl.fi.tbill.91d.primary",
            "sl.mm.awpr",
            "sl.mm.opr",
        ):
            if leak in by_id:
                failures.append(f"WEI leaked primary series {leak}")
        if len(obs) < 40:
            failures.append(f"WEI expected >=40 obs, got {len(obs)}")
        print(f"OK weekly-economic-indicators: {len(obs)} observations")

        # Second layout (Jul 2026)
        wei_jul = fixtures_dir / "weekly-economic-indicators-20260724.pdf"
        if not wei_jul.exists():
            raw = fixtures_dir.parent / "data/raw/weekly-economic-indicators_2026-07-24_26439fcb44.pdf"
            wei_jul = raw if raw.exists() else wei_jul
        if wei_jul.exists():
            jul = normalize_wei_pdf(
                wei_jul.read_bytes(),
                "fixture://weekly-economic-indicators-20260724",
                bounds=bounds,
            )
            jul_by = {o["seriesId"]: o for o in jul}
            jul_ytd = jul_by.get("sl.fx.usd.ytd_change_pct")
            jul_mid = jul_by.get("sl.fx.usd.week_avg_mid")
            if not jul_ytd or abs(jul_ytd["value"] - 7.8) > 0.011:
                failures.append(f"WEI Jul YTD expected 7.8 got {jul_ytd}")
            if not jul_mid or abs(jul_mid["value"] - 336.21) > 0.011:
                failures.append(f"WEI Jul USD mid expected 336.21 got {jul_mid}")
            jul_ora = jul_by.get("sl.ei.total_reserves")
            if not jul_ora or abs(jul_ora["value"] - 6_450.0) > 0.011:
                failures.append(f"WEI Jul ORA expected 6450 got {jul_ora}")
            elif jul_ora.get("period") != "2026-06-01":
                failures.append(f"WEI Jul ORA bad period {jul_ora.get('period')}")
            jul_fx = jul_by.get("sl.ei.reserves.fx")
            if not jul_fx or abs(jul_fx["value"] - 6_254.0) > 0.011:
                failures.append(f"WEI Jul FX reserves expected 6254 got {jul_fx}")
            jul_gdp = jul_by.get("sl.ei.gdp.growth")
            if not jul_gdp or abs(jul_gdp["value"] - 5.1) > 0.011:
                failures.append(f"WEI Jul GDP expected 5.1 got {jul_gdp}")
            elif jul_gdp.get("period") != "2026-01-01":
                failures.append(f"WEI Jul GDP bad period {jul_gdp.get('period')}")
            jul_agri = jul_by.get("sl.ei.gdp.agriculture_yoy")
            if not jul_agri or abs(jul_agri["value"] - 1.1) > 0.011:
                failures.append(f"WEI Jul agri GDP expected 1.1 got {jul_agri}")
            jul_ind = jul_by.get("sl.ei.gdp.industry_yoy")
            if not jul_ind or abs(jul_ind["value"] - 7.2) > 0.011:
                failures.append(f"WEI Jul industry GDP expected 7.2 got {jul_ind}")
            jul_svc = jul_by.get("sl.ei.gdp.services_yoy")
            if not jul_svc or abs(jul_svc["value"] - 3.4) > 0.011:
                failures.append(f"WEI Jul services GDP expected 3.4 got {jul_svc}")

            jul_pmi = jul_by.get("sl.ei.pmi.manufacturing")
            if not jul_pmi or abs(jul_pmi["value"] - 53.0) > 0.011:
                failures.append(f"WEI Jul PMI mfg expected 53 got {jul_pmi}")
            jul_credit = jul_by.get("sl.ei.credit.private_yoy")
            if not jul_credit or abs(jul_credit["value"] - 27.81) > 0.05:
                failures.append(f"WEI Jul credit YoY expected 27.81 got {jul_credit}")
            jul_fwd = jul_by.get("sl.ei.reserves.fwd_short")
            if not jul_fwd or abs(jul_fwd["value"] - (-4044.0)) > 0.5:
                failures.append(f"WEI Jul fwd short expected -4044 got {jul_fwd}")

            if "sl.eq.aspi" in jul_by:
                failures.append("WEI Jul leaked sl.eq.aspi")
            print(f"OK weekly-economic-indicators (Jul layout): {len(jul)} observations")

    mei_path = fixtures_dir / FIXTURE_NAMES["monthly-economic-indicators"]
    if not mei_path.exists():
        failures.append(f"missing fixture {mei_path}")
    else:
        obs = normalize_mei_pdf(
            mei_path.read_bytes(),
            "fixture://monthly-economic-indicators",
            fallback_period=date(2026, 5, 1),
            bounds=bounds,
        )
        by_id = {o["seriesId"]: o for o in obs}
        # value + period pinned so a summary layout drift fails loudly
        expect = {
            "sl.ei.gdp.growth": (5.1, "2026-01-01"),
            "sl.ei.gdp.level": (3_652_503.0, "2026-01-01"),
            "sl.ei.iip": (90.9, "2026-04-01"),
            "sl.ei.agri.tea": (24.2, "2026-04-01"),
            "sl.ei.agri.rubber": (5.4, "2026-04-01"),
            "sl.ei.agri.coconut": (1_254.0, "2026-04-01"),
            "sl.ei.agri.fish": (23.2, "2026-04-01"),
            "sl.ei.electricity.generation_monthly": (1_629.0, "2026-03-01"),  # "1(b,6)29"
            "sl.ei.m1": (2_367.2, "2026-04-01"),
            "sl.ei.m2": (14_671.8, "2026-04-01"),
            "sl.ei.m2b": (16_660.4, "2026-04-01"),
            "sl.ei.m4": (20_011.7, "2026-04-01"),
            "sl.eq.aspi": (22_310.80, "2026-05-01"),
            "sl.eq.sp_sl20": (6_159.15, "2026-05-01"),
            "sl.eq.market_cap": (8_115.76, "2026-05-01"),
        }
        for sid, (val, per) in expect.items():
            got = by_id.get(sid)
            if not got or abs(got["value"] - val) > 0.05:
                failures.append(f"MEI {sid}: expected {val}, got {got}")
            elif got["period"] != per:
                failures.append(f"MEI {sid}: expected period {per}, got {got['period']}")
        if "sl.ei.ccpi.headline_yoy" in by_id or "sl.ei.ncpi.headline_yoy" in by_id:
            failures.append("MEI leaked CPI overlap")
        # MEI "Total Reserves" must not overwrite Official Reserve Assets
        if "sl.ei.total_reserves" in by_id:
            failures.append("MEI leaked sl.ei.total_reserves (use WEI ORA only)")
        # Trade / BoP owned by ESP
        for leak in (
            "sl.ei.trade.exports",
            "sl.ei.trade.imports",
            "sl.ei.trade.balance",
            "sl.ei.bop.current_account",
            "sl.ei.bop.trade_account",
            "sl.ei.bop.financial_account",
        ):
            if leak in by_id:
                failures.append(f"MEI leaked ESP-owned series {leak}")
        if len(obs) < 15:
            failures.append(f"MEI expected >=15 obs, got {len(obs)}")
        print(f"OK monthly-economic-indicators: {len(obs)} observations")

        # Second layout fixture (May 2019) — money in Rs. Mn (→Bn), spaced digits,
        # lagged BoP quarter, blank current-year cell must not leak prior year.
        mei_2019 = fixtures_dir / "monthly-economic-indicators-20190501.pdf"
        if mei_2019.exists():
            old = normalize_mei_pdf(
                mei_2019.read_bytes(),
                "fixture://monthly-economic-indicators-20190501",
                fallback_period=date(2019, 5, 1),
                bounds=bounds,
            )
            old_by = {o["seriesId"]: o for o in old}
            old_expect = {
                "sl.ei.agri.tea": (23.6, "2019-04-01"),
                "sl.ei.agri.coconut": (259.3, "2019-04-01"),
                "sl.ei.electricity.generation_monthly": (1_211.3, "2019-02-01"),  # "1 ,211.3"
                "sl.ei.iip": (96.9, "2019-04-01"),
                "sl.ei.m1": (828.31698, "2019-04-01"),  # 828,316.98 Rs.Mn → Bn
                "sl.ei.m4": (8_966.33101, "2019-04-01"),
                "sl.eq.aspi": (5_310.95, "2019-05-01"),
            }
            for sid, (val, per) in old_expect.items():
                got = old_by.get(sid)
                if not got or abs(got["value"] - val) > 0.01:
                    failures.append(f"MEI 2019 {sid}: expected {val}, got {got}")
                elif got["period"] != per:
                    failures.append(
                        f"MEI 2019 {sid}: expected period {per}, got {got['period']}"
                    )
            # "Yala … 1,532.9  -  -" has a blank current cell → must not be emitted
            if "sl.ei.agri.paddy" in old_by and old_by["sl.ei.agri.paddy"]["value"] == 1_532.9:
                failures.append("MEI 2019 leaked Yala prior-year value as current")
            for leak in (
                "sl.ei.trade.balance",
                "sl.ei.bop.trade_account",
                "sl.ei.bop.financial_account",
            ):
                if leak in old_by:
                    failures.append(f"MEI 2019 leaked ESP-owned series {leak}")
            print(f"OK monthly-economic-indicators (2019 layout): {len(old)} observations")

    esp_path = fixtures_dir / FIXTURE_NAMES["external-sector-performance"]
    if not esp_path.exists():
        failures.append(f"missing fixture {esp_path}")
    else:
        obs = normalize_esp_pdf(
            esp_path.read_bytes(),
            "fixture://external-sector-performance",
            fallback_period=date(2026, 5, 1),
            bounds=bounds,
        )
        by_id = {o["seriesId"]: o for o in obs}
        expect = {
            "sl.ei.bop.current_account": (-194.5, "2026-05-01"),
            "sl.ei.bop.current_account_ytd": (-96.7, "2026-05-01"),
            "sl.ei.trade.balance": (-967.9, "2026-05-01"),
            "sl.ei.trade.exports": (1_224.3, "2026-05-01"),
            "sl.ei.trade.imports": (2_192.1, "2026-05-01"),
            "sl.ei.trade.exports_ytd": (5_759.4, "2026-05-01"),
            "sl.ei.trade.imports_ytd": (10_420.0, "2026-05-01"),
            "sl.ei.services.net": (143.2, "2026-05-01"),
            "sl.ei.services.inflows": (475.3, "2026-05-01"),
            "sl.ei.services.outflows": (332.0, "2026-05-01"),
            "sl.ei.tourist_earnings_usd": (155.7, "2026-05-01"),
            "sl.ei.services.transport_inflows": (156.1, "2026-05-01"),
            "sl.ei.services.it_bpo": (66.7, "2026-05-01"),
            "sl.ei.services.travel_abroad": (87.7, "2026-05-01"),
            "sl.ei.services.transport_outflows": (127.6, "2026-05-01"),
            "sl.ei.income.primary_net": (-205.4, "2026-05-01"),
            "sl.ei.income.secondary_net": (835.5, "2026-05-01"),
            "sl.ei.remittances_usd": (847.0, "2026-05-01"),
            "sl.ei.remittances_usd_ytd": (3_909.7, "2026-05-01"),
            "sl.ei.flows.cse": (-22.6, "2026-05-01"),
            "sl.ei.flows.gov_securities": (-60.3, "2026-05-01"),
            "sl.ei.reserves.change": (115.4, "2026-05-01"),
            "sl.ei.reserves.gor": (6_900.0, "2026-05-01"),
            "sl.ei.tourist_arrivals": (145_745.0, "2026-05-01"),
            "sl.ei.tourist_arrivals_ytd": (1_022_022.0, "2026-05-01"),
        }
        for sid, (val, per) in expect.items():
            got = by_id.get(sid)
            if not got or abs(got["value"] - val) > 0.05:
                failures.append(f"ESP {sid}: expected {val}, got {got}")
            elif got["period"] != per:
                failures.append(f"ESP {sid}: expected period {per}, got {got['period']}")
        # Must never overwrite Official Reserve Assets
        if "sl.ei.total_reserves" in by_id:
            failures.append("ESP leaked sl.ei.total_reserves (use GOR series)")
        if len(obs) < 30:
            failures.append(f"ESP expected >=30 obs, got {len(obs)}")
        print(f"OK external-sector-performance: {len(obs)} observations")

    return failures


__all__ = [
    "PDF_REPORT_IDS",
    "fetch_and_ingest_pdf_reports",
    "run_pdf_self_test",
]
