#!/usr/bin/env bash
# Optional Colombo cron for the single Market news snapshot.
# Example:
#   0 5,18 * * * TZ=Asia/Colombo /path/to/market-pulse/scripts/cron-news.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export API_URL="${API_URL:-http://127.0.0.1:4000}"
cd "$ROOT/services/extractors"
exec bash scripts/run-news.sh
