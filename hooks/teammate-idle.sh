#!/usr/bin/env bash
# TeammateIdle hook: quality gate before teammate stops
# Exit 0 = allow idle, Exit 2 = block with feedback
#
# Solo mode: always allows (exit 0)
# Teammate mode: runs version check + test pass verification

set -euo pipefail

# Kill switch: skip all hooks
if [ "${SHIPYARD_DISABLE_HOOKS:-}" = "true" ]; then exit 0; fi
# Selective skip: comma-separated hook names
HOOK_NAME="$(basename "${BASH_SOURCE[0]}" .sh)"
if [[ ",${SHIPYARD_SKIP_HOOKS:-}," == *",$HOOK_NAME,"* ]]; then exit 0; fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${SCRIPT_DIR}/scripts/team-detect.sh"
source "${SCRIPT_DIR}/scripts/hook-log.sh"

# Solo mode: skip gates
if [ "${SHIPYARD_IS_TEAMMATE}" != "true" ]; then
    exit 0
fi

# Gate 1: Version check
if [ -f "${SCRIPT_DIR}/scripts/check-versions.sh" ]; then
    if ! _output=$(bash "${SCRIPT_DIR}/scripts/check-versions.sh" 2>&1); then
        _msg="BLOCKED: Version check failed. Fix version mismatches before stopping."
        echo "$_msg" >&2
        echo "$_output" | tail -5 >&2
        echo "  (see ${HOOK_LOG} for details)" >&2
        log_hook_failure "$HOOK_NAME" "2" "$_msg"
        exit 2
    fi
fi

# Gate 2: Tests must pass
if ! _output=$(npm test --prefix "${SCRIPT_DIR}" 2>&1); then
    _msg="BLOCKED: Tests are failing. Fix test failures before stopping."
    echo "$_msg" >&2
    echo "$_output" | tail -10 >&2
    echo "  (see ${HOOK_LOG} for details)" >&2
    log_hook_failure "$HOOK_NAME" "2" "$_msg"
    exit 2
fi

exit 0
