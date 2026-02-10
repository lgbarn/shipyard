#!/usr/bin/env bash
# Shipyard test runner -- works on macOS and Linux
# Usage: bash test/run.sh [optional bats args]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "$PROJECT_ROOT"

# bats is installed via devDependencies (npm ci)
BATS="./node_modules/.bin/bats"

# Run all .bats files in test/ (parallel when GNU parallel is available)
echo "Running Shipyard test suite..."
if command -v parallel &>/dev/null; then
    "$BATS" --jobs "$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 2)" --formatter tap test/*.bats "$@"
else
    "$BATS" --formatter tap test/*.bats "$@"
fi
