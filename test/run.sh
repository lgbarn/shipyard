#!/usr/bin/env bash
# Shipyard test runner -- works on macOS and Linux
# Usage: bash test/run.sh [optional bats args]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "$PROJECT_ROOT"

# Ensure bats is available
BATS="./node_modules/.bin/bats"
if [ ! -x "$BATS" ]; then
    echo "bats not found. Installing via npm..."
    npm install --save-dev bats bats-support bats-assert
fi

# Run all .bats files in test/
echo "Running Shipyard test suite..."
"$BATS" --formatter tap test/*.bats "$@"
