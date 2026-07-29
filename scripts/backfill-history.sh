#!/usr/bin/env bash
# Backfill older CBSL history year-by-year, month-by-month (gentle).
# Skips current YTD by default (ends at Dec 31 of last year).
# Requires API on :4000.
set -euo pipefail
cd "$(dirname "$0")/.."

REPORTS="${REPORTS:-5206,1059,1064,6277}"
START_YEAR="${START_YEAR:-2021}"
END_YEAR="${END_YEAR:-$(( $(date +%Y) - 1 ))}"
DELAY="${DELAY:-6}"

mkdir -p data/logs
LOG="data/logs/backfill-history.log"
echo "History backfill ${START_YEAR}→${END_YEAR} · reports=${REPORTS} · by-month · delay=${DELAY}s"
echo "Log: ${LOG}"
: >"$LOG"

for year in $(seq "$START_YEAR" "$END_YEAR"); do
  echo ""
  echo "======== YEAR ${year} ========"
  pnpm extract -- \
    --reports "$REPORTS" \
    --from "${year}-01-01" \
    --to "${year}-12-31" \
    --by-month \
    --delay "$DELAY" \
    2>&1 | tee -a "$LOG"
  echo "======== YEAR ${year} done — pausing 15s ========"
  sleep 15
done

echo "History backfill complete. Review pending on http://localhost:3000/ops"
