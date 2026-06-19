#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-}"

if [[ -z "$PYTHON_BIN" ]]; then
	if command -v python3.13 >/dev/null 2>&1; then
		PYTHON_BIN="python3.13"
	elif command -v python3.12 >/dev/null 2>&1; then
		PYTHON_BIN="python3.12"
	elif command -v python3.11 >/dev/null 2>&1; then
		PYTHON_BIN="python3.11"
	elif command -v python3 >/dev/null 2>&1; then
		PYTHON_BIN="python3"
	else
		echo "[setup] ERROR: No suitable Python interpreter found. Install Python 3.13 or 3.12."
		exit 1
	fi
fi

PY_MM="$($PYTHON_BIN -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
PY_MAJOR="${PY_MM%%.*}"
PY_MINOR="${PY_MM##*.}"
if [[ "$PY_MAJOR" -ne 3 || "$PY_MINOR" -gt 13 ]]; then
	echo "[setup] ERROR: $PYTHON_BIN is Python $PY_MM, which is not supported by current dependency pins."
	echo "[setup] Use Python 3.13 (recommended) or 3.12. Example: PYTHON_BIN=python3.13 bash scripts/setup.sh"
	exit 1
fi

printf "[setup] Using Python interpreter: %s (version %s)\n" "$PYTHON_BIN" "$PY_MM"

printf "[setup] Creating virtual environment...\n"
"$PYTHON_BIN" -m venv .venv

printf "[setup] Installing dependencies...\n"
source .venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt

printf "[setup] Done. Activate with: source %s/.venv/bin/activate\n" "$ROOT_DIR"
printf "[setup] Run API with: uvicorn main:app --host 0.0.0.0 --port 8010 --reload\n"
