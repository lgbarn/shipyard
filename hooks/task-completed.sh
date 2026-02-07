#!/usr/bin/env bash
# TaskCompleted hook: quality gate before marking task done
# Exit 0 = allow completion, Exit 2 = block with feedback
#
# Solo mode: always allows (exit 0)
# Teammate mode: verifies task has evidence (test output, results)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${SCRIPT_DIR}/scripts/team-detect.sh"

# Solo mode: skip gates
if [ "${SHIPYARD_IS_TEAMMATE}" != "true" ]; then
    exit 0
fi

# Check for evidence: phase results or verification artifacts in .shipyard
if [ -d ".shipyard/phases" ]; then
    # Look for any results files (summaries, reviews, audit reports)
    evidence_count=$(find .shipyard/phases/ -name "SUMMARY-*.md" -o -name "REVIEW-*.md" -o -name "AUDIT-*.md" | wc -l | tr -d ' ')
    if [ "${evidence_count}" -gt 0 ]; then
        exit 0
    fi
fi

echo "BLOCKED: No verification evidence found. Run tests and produce results before marking task complete." >&2
exit 2
