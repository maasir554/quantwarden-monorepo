#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PORT="${PORT:-8010}"

if [[ -f .venv/bin/activate ]]; then
  source .venv/bin/activate
fi

exec uvicorn main:app --host 0.0.0.0 --port "$PORT"
