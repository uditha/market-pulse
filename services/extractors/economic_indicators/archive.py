"""Download + optional ingest archive for DEI / WEI / MEI PDFs.

Keeps every PDF under data/raw/ so extra series can be parsed later.
Usage:
  .venv/bin/python -m economic_indicators.archive --from 2019-01-01
  .venv/bin/python -m economic_indicators.archive --from 2019-01-01 --download-only
  .venv/bin/python -m economic_indicators.archive --from 2019-01-01 --reports weekly-economic-indicators
  # Re-parse / ingest already-downloaded PDFs (no CBSL network):
  .venv/bin/python -m economic_indicators.archive --local --reports weekly-economic-indicators --force
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import date
from pathlib import Path

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
from .mei import normalize_mei_pdf
from .wei import normalize_wei_pdf

NORMALIZERS = {
    "daily-economic-indicators": normalize_dei_pdf,
    "weekly-economic-indicators": normalize_wei_pdf,
    "monthly-economic-indicators": normalize_mei_pdf,
}

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
DEFAULT_LISTING_PAGES = 80


def _existing_hashes(raw_dir: Path, report_id: str) -> set[str]:
    """Hashes already on disk for this report (from filename suffix)."""
    out: set[str] = set()
    for p in raw_dir.glob(f"{report_id}_*.pdf"):
        # {report}_{YYYY-MM-DD}_{hash10}.pdf
        parts = p.stem.split("_")
        if len(parts) >= 2 and len(parts[-1]) >= 10:
            out.add(parts[-1][:10])
    return out


def archive_report(
    report_id: str,
    from_d: date,
    to_d: date,
    *,
    raw_dir: Path,
    delay_sec: float,
    download_only: bool,
    force: bool,
    bounds: dict[str, tuple[float, float]] | None,
    post_ingest,
    max_listing_pages: int = DEFAULT_LISTING_PAGES,
) -> dict:
    listing = LISTINGS[report_id]
    normalize = NORMALIZERS[report_id]
    raw_dir.mkdir(parents=True, exist_ok=True)
    known = _existing_hashes(raw_dir, report_id)

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
        ),
    }

    print(f"\n=== {report_id} {iso(from_d)} → {iso(to_d)} ===", flush=True)
    with httpx.Client(follow_redirects=True, timeout=120.0, headers=headers) as client:
        print(f"  Discovering listing (up to {max_listing_pages} pages) …", flush=True)
        listed = discover_listing_pdfs(
            report_id, max_pages=max_listing_pages, client=client
        )
        windowed = filter_by_window(listed, from_d, to_d)
        print(
            f"  Listed {len(listed)}; {len(windowed)} in window "
            f"(oldest listed {iso(listed[-1].period) if listed else '—'})",
            flush=True,
        )

        stats = {
            "reportId": report_id,
            "listed": len(listed),
            "windowed": len(windowed),
            "downloaded": 0,
            "skippedExisting": 0,
            "downloadFailed": 0,
            "parsed": 0,
            "parseFailed": 0,
            "ingested": 0,
            "observations": 0,
            "files": [],
        }

        for i, item in enumerate(windowed):
            step = f"[{i + 1}/{len(windowed)}]"
            if i > 0 and delay_sec > 0:
                time.sleep(delay_sec)
            print(f"  {step} {iso(item.period)} — {item.title}", flush=True)
            try:
                pdf_bytes, final_url = download_pdf(
                    item.url,
                    referer=listing.listing_url,
                    client=client,
                )
            except Exception as exc:  # noqa: BLE001
                print(f"  {step} DOWNLOAD FAIL: {exc}", flush=True)
                stats["downloadFailed"] += 1
                stats["files"].append(
                    {"period": iso(item.period), "ok": False, "error": str(exc)}
                )
                continue

            digest = content_hash_bytes(pdf_bytes)
            short = digest[:10]
            out_path = raw_dir / f"{report_id}_{iso(item.period)}_{short}.pdf"
            if out_path.exists() and not force:
                print(f"  {step} already on disk {out_path.name}", flush=True)
                stats["skippedExisting"] += 1
            else:
                out_path.write_bytes(pdf_bytes)
                print(
                    f"  {step} saved {out_path.name} ({len(pdf_bytes):,} bytes)",
                    flush=True,
                )
                stats["downloaded"] += 1
            known.add(short)

            file_rec: dict = {
                "period": iso(item.period),
                "ok": True,
                "path": str(out_path),
                "contentHash": digest,
                "url": final_url,
                "bytes": len(pdf_bytes),
            }

            if download_only:
                stats["files"].append(file_rec)
                continue

            try:
                observations = normalize(
                    pdf_bytes,
                    final_url,
                    fallback_period=item.period,
                    bounds=bounds or {},
                )
            except Exception as exc:  # noqa: BLE001
                print(f"  {step} PARSE FAIL (PDF kept): {exc}", flush=True)
                stats["parseFailed"] += 1
                file_rec["parseError"] = str(exc)
                stats["files"].append(file_rec)
                continue

            stats["parsed"] += 1
            periods = sorted({o["period"] for o in observations})
            meta = {
                "sourceReportId": report_id,
                "url": final_url,
                "contentHash": digest,
                "fromDate": periods[0],
                "toDate": periods[-1],
                "rawPath": str(out_path),
                "fetchedAt": utc_now_iso(),
                "force": force,
            }
            if post_ingest is None:
                file_rec["observations"] = len(observations)
                stats["observations"] += len(observations)
                stats["files"].append(file_rec)
                continue

            ingest_result = post_ingest(observations, meta, False)
            skipped = bool(
                isinstance(ingest_result, dict) and ingest_result.get("skipped")
            )
            if skipped:
                print(f"  {step} ingest skip unchanged", flush=True)
            else:
                n = len(observations)
                stats["ingested"] += 1
                stats["observations"] += n
                print(f"  {step} ingest OK → {n} obs", flush=True)
            file_rec["observations"] = 0 if skipped else len(observations)
            file_rec["ingest"] = ingest_result
            stats["files"].append(file_rec)

    return stats


def _period_from_raw_name(path: Path, report_id: str) -> date | None:
    """`weekly-economic-indicators_2020-01-03_509031ed02.pdf` → 2020-01-03."""
    stem = path.stem
    prefix = f"{report_id}_"
    if not stem.startswith(prefix):
        return None
    rest = stem[len(prefix) :]
    # period is YYYY-MM-DD before final _hash
    parts = rest.rsplit("_", 1)
    if not parts:
        return None
    try:
        return date.fromisoformat(parts[0])
    except ValueError:
        return None


def ingest_local_report(
    report_id: str,
    from_d: date,
    to_d: date,
    *,
    raw_dir: Path,
    force: bool,
    bounds: dict[str, tuple[float, float]] | None,
    post_ingest,
) -> dict:
    """Parse + ingest PDFs already under data/raw/ (no CBSL network)."""
    normalize = NORMALIZERS[report_id]
    listing = LISTINGS[report_id]
    # Public CBSL page — never store file:// on observations (breaks "CBSL source" UI).
    public_source_url = listing.listing_url
    paths = sorted(raw_dir.glob(f"{report_id}_*.pdf"))
    windowed: list[tuple[Path, date]] = []
    for path in paths:
        period = _period_from_raw_name(path, report_id)
        if period is None or period < from_d or period > to_d:
            continue
        windowed.append((path, period))

    print(
        f"\n=== LOCAL {report_id} {iso(from_d)} → {iso(to_d)} "
        f"({len(windowed)} PDFs) ===",
        flush=True,
    )
    stats = {
        "reportId": report_id,
        "mode": "local",
        "listed": len(paths),
        "windowed": len(windowed),
        "downloaded": 0,
        "skippedExisting": 0,
        "downloadFailed": 0,
        "parsed": 0,
        "parseFailed": 0,
        "ingested": 0,
        "observations": 0,
        "files": [],
    }

    for i, (path, period) in enumerate(windowed):
        step = f"[{i + 1}/{len(windowed)}]"
        print(f"  {step} {iso(period)} — {path.name}", flush=True)
        pdf_bytes = path.read_bytes()
        digest = content_hash_bytes(pdf_bytes)
        file_rec: dict = {
            "period": iso(period),
            "ok": True,
            "path": str(path),
            "contentHash": digest,
            "url": public_source_url,
            "bytes": len(pdf_bytes),
        }
        try:
            observations = normalize(
                pdf_bytes,
                public_source_url,
                fallback_period=period,
                bounds=bounds or {},
            )
        except Exception as exc:  # noqa: BLE001
            print(f"  {step} PARSE FAIL: {exc}", flush=True)
            stats["parseFailed"] += 1
            file_rec["ok"] = False
            file_rec["parseError"] = str(exc)
            stats["files"].append(file_rec)
            continue

        stats["parsed"] += 1
        periods = sorted({o["period"] for o in observations})
        meta = {
            "sourceReportId": report_id,
            "url": public_source_url,
            "contentHash": digest,
            "fromDate": periods[0] if periods else iso(period),
            "toDate": periods[-1] if periods else iso(period),
            "rawPath": str(path),
            "fetchedAt": utc_now_iso(),
            "force": force,
        }
        if post_ingest is None:
            file_rec["observations"] = len(observations)
            stats["observations"] += len(observations)
            stats["files"].append(file_rec)
            continue

        ingest_result = post_ingest(observations, meta, False)
        skipped = bool(
            isinstance(ingest_result, dict) and ingest_result.get("skipped")
        )
        if skipped and not force:
            print(f"  {step} ingest skip unchanged", flush=True)
        else:
            n = len(observations)
            stats["ingested"] += 1
            stats["observations"] += n
            print(f"  {step} ingest OK → {n} obs", flush=True)
        file_rec["observations"] = 0 if (skipped and not force) else len(observations)
        file_rec["ingest"] = ingest_result
        stats["files"].append(file_rec)

    return stats


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Archive DEI/WEI/MEI PDFs from CBSL and optionally backfill ingest"
    )
    parser.add_argument(
        "--reports",
        default=",".join(sorted(PDF_REPORT_IDS)),
        help="Comma-separated report ids",
    )
    parser.add_argument("--from", dest="from_date", default="2019-01-01")
    parser.add_argument("--to", dest="to_date", default=None)
    parser.add_argument("--delay", type=float, default=2.5)
    parser.add_argument(
        "--download-only",
        action="store_true",
        help="Save PDFs only (no parse / ingest)",
    )
    parser.add_argument(
        "--local",
        action="store_true",
        help="Re-parse/ingest PDFs already in --raw-dir (no CBSL download)",
    )
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--listing-pages", type=int, default=DEFAULT_LISTING_PAGES)
    parser.add_argument(
        "--raw-dir",
        default=str(RAW_DIR),
        help="Directory to store PDFs",
    )
    args = parser.parse_args(argv)

    if args.local and args.download_only:
        print("--local and --download-only are mutually exclusive", file=sys.stderr)
        return 2

    from_d = date.fromisoformat(args.from_date)
    to_d = date.fromisoformat(args.to_date) if args.to_date else date.today()
    reports = [r.strip() for r in args.reports.split(",") if r.strip()]
    for r in reports:
        if r not in PDF_REPORT_IDS:
            print(f"Unknown report {r}", file=sys.stderr)
            return 2

    post_ingest = None
    bounds: dict = {}
    if not args.download_only:
        # Import from main only when ingesting (pulls API client etc.)
        sys.path.insert(0, str(ROOT))
        from main import BOUNDS, post_ingest as _post_ingest  # type: ignore

        bounds = BOUNDS
        post_ingest = _post_ingest

    raw_dir = Path(args.raw_dir)
    summary = {
        "from": iso(from_d),
        "to": iso(to_d),
        "downloadOnly": args.download_only,
        "local": args.local,
        "rawDir": str(raw_dir.resolve()),
        "reports": [],
    }
    for report_id in reports:
        if args.local:
            stats = ingest_local_report(
                report_id,
                from_d,
                to_d,
                raw_dir=raw_dir,
                force=args.force,
                bounds=bounds,
                post_ingest=post_ingest,
            )
        else:
            stats = archive_report(
                report_id,
                from_d,
                to_d,
                raw_dir=raw_dir,
                delay_sec=args.delay,
                download_only=args.download_only,
                force=args.force,
                bounds=bounds,
                post_ingest=post_ingest,
                max_listing_pages=args.listing_pages,
            )
        # Trim per-file detail in final summary print
        slim = {k: v for k, v in stats.items() if k != "files"}
        slim["fileCount"] = len(stats["files"])
        summary["reports"].append(slim)
        print(
            f"  → {report_id}: down={stats['downloaded']} "
            f"exist={stats['skippedExisting']} fail_dl={stats['downloadFailed']} "
            f"parse_fail={stats['parseFailed']} obs={stats['observations']}",
            flush=True,
        )

    print("---ARCHIVE_SUMMARY---", flush=True)
    print(json.dumps(summary, indent=2), flush=True)
    print("---END_ARCHIVE_SUMMARY---", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
