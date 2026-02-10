#!/usr/bin/env bash
# Stop/SessionEnd hook: state safety on session termination
# Detects active build status and appends interruption note to HISTORY.md.
# Exit 0 always — this hook records, never blocks.

set -euo pipefail

# Kill switch: skip all hooks
if [ "${SHIPYARD_DISABLE_HOOKS:-}" = "true" ]; then exit 0; fi
# Selective skip: comma-separated hook names
HOOK_NAME="$(basename "${BASH_SOURCE[0]}" .sh)"
if [[ ",${SHIPYARD_SKIP_HOOKS:-}," == *",$HOOK_NAME,"* ]]; then exit 0; fi

if [ -f ".shipyard/STATE.json" ]; then
    status=$(jq -r '.status // ""' .shipyard/STATE.json 2>/dev/null)
    if [ "$status" = "building" ]; then
        echo "- [$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Session ended during build (may need /shipyard:resume)" \
            >> .shipyard/HISTORY.md
    fi
fi

exit 0
