#!/usr/bin/env bash
# Shipyard test runner -- works on macOS and Linux
# Usage: bash test/run.sh [optional bats args]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "$PROJECT_ROOT"

# bats is installed via devDependencies (npm ci)
BATS="./node_modules/.bin/bats"

# Run all .bats files in test/
echo "Running Shipyard test suite..."
"$BATS" --formatter tap test/*.bats "$@"
