#!/usr/bin/env bash
# TaskCompleted hook: quality gate before marking task done
# Exit 0 = allow completion, Exit 2 = block with feedback
#
# Solo mode: always allows (exit 0)
# Teammate mode: verifies task has evidence (test output, results)

set -euo pipefail

# Kill switch: skip all hooks
if [ "${SHIPYARD_DISABLE_HOOKS:-}" = "true" ]; then exit 0; fi
# Selective skip: comma-separated hook names
HOOK_NAME="$(basename "${BASH_SOURCE[0]}" .sh)"
if [[ ",${SHIPYARD_SKIP_HOOKS:-}," == *",$HOOK_NAME,"* ]]; then exit 0; fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${SCRIPT_DIR}/scripts/team-detect.sh"

# Solo mode: skip gates
if [ "${SHIPYARD_IS_TEAMMATE}" != "true" ]; then
    exit 0
fi

# Check for evidence: phase results or verification artifacts in .shipyard
if [ -d ".shipyard/phases" ]; then
    evidence_count=0
    # Scope evidence check to current phase directory
    current_phase=$(jq -r '.phase // ""' .shipyard/STATE.json 2>/dev/null || true)
    if [ -n "$current_phase" ]; then
        phase_dir=$(find .shipyard/phases/ -maxdepth 1 -type d \
            \( -name "${current_phase}*" -o -name "0${current_phase}*" \) 2>/dev/null | head -1)
        if [ -n "$phase_dir" ]; then
            evidence_count=$(find "$phase_dir" \
                \( -name "SUMMARY-*.md" -o -name "REVIEW-*.md" -o -name "AUDIT-*.md" \) \
                | wc -l | tr -d ' ')
        fi
    else
        # Fallback: no phase in state, check all phases
        evidence_count=$(find .shipyard/phases/ \
            \( -name "SUMMARY-*.md" -o -name "REVIEW-*.md" -o -name "AUDIT-*.md" \) \
            | wc -l | tr -d ' ')
    fi
    if [ "${evidence_count}" -gt 0 ]; then
        # Verify at least one evidence file has non-trivial content (>3 lines)
        has_substance=false
        while IFS= read -r efile; do
            if [ "$(wc -l < "$efile" | tr -d ' ')" -gt 3 ]; then
                has_substance=true
                break
            fi
        done < <(find "${phase_dir:-.shipyard/phases/}" \
            \( -name "SUMMARY-*.md" -o -name "REVIEW-*.md" -o -name "AUDIT-*.md" \) 2>/dev/null)
        if [ "$has_substance" = true ]; then
            exit 0
        fi
        echo "BLOCKED: Evidence files exist but none have substantive content (>3 lines). Add real verification results." >&2
        exit 2
    fi
fi

echo "BLOCKED: No verification evidence found. Run tests and produce results before marking task complete." >&2
exit 2
