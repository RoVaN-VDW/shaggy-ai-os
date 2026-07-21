#!/usr/bin/env bash
set -euo pipefail

ROOT="${SHAGGY_VOICE_ROOT:-$HOME/Library/Application Support/SHAGGY/voice-benchmark-2a}"
PYTHON="${SHAGGY_VOICE_PYTHON:-$ROOT/mlx-venv/bin/python}"

if [[ ! -x "$PYTHON" ]]; then
  printf 'Voice runtime ontbreekt: %s\n' "$PYTHON" >&2
  printf 'Voer eerst de goedgekeurde voice benchmark/setup uit.\n' >&2
  exit 1
fi

export SHAGGY_VOICE_ROOT="$ROOT"
export HF_HOME="${HF_HOME:-$ROOT/mlx-hf-cache}"
exec "$PYTHON" "$(dirname "$0")/server.py" --host 127.0.0.1 --port "${SHAGGY_VOICE_PORT:-8766}"
