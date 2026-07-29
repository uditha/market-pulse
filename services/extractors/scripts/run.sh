#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -x .venv/bin/python ]]; then
  python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
fi
# pnpm may forward a literal "--" before script args — strip it
if [[ "${1:-}" == "--" ]]; then
  shift
fi
exec .venv/bin/python main.py "$@"
