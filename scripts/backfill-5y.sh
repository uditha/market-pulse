#!/usr/bin/env bash
# Slow 5-year CBSL backfill — polite pacing to avoid stressing cbsl.lk
# Requires API on :4000 (pnpm --filter @lankapulse/api dev)
set -euo pipefail
cd "$(dirname "$0")/.."

REPORTS="${REPORTS:-5206,1059,1064,6277}"
YEARS="${YEARS:-5}"
CHUNK_DAYS="${CHUNK_DAYS:-90}"
DELAY="${DELAY:-5}"

echo "Backfill ${YEARS}y · reports=${REPORTS} · chunk=${CHUNK_DAYS}d · delay=${DELAY}s"
echo "Log: data/logs/backfill-5y.log"
mkdir -p data/logs

pnpm extract -- \
  --reports "$REPORTS" \
  --years "$YEARS" \
  --chunk-days "$CHUNK_DAYS" \
  --delay "$DELAY" \
  2>&1 | tee data/logs/backfill-5y.log

echo "Done. Review pending rows on http://localhost:3000/ops"
