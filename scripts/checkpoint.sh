#!/usr/bin/env bash
# Shipyard checkpoint manager
# Creates git tags for rollback points
#
# Usage:
#   checkpoint.sh <label>           Create a checkpoint
#   checkpoint.sh --prune [days]    Remove checkpoints older than N days (default: 30)
#
# Examples:
#   checkpoint.sh "pre-build-phase-2"
#   checkpoint.sh "post-plan-phase-1"
#   checkpoint.sh --prune 14

set -euo pipefail

if [ "${1:-}" = "--prune" ]; then
    DAYS="${2:-30}"
    CUTOFF=$(date -u -v-${DAYS}d +"%Y%m%dT%H%M%SZ" 2>/dev/null || date -u -d "${DAYS} days ago" +"%Y%m%dT%H%M%SZ")
    PRUNED=0
    for tag in $(git tag -l "shipyard-checkpoint-*" 2>/dev/null); do
        TAG_DATE=$(echo "$tag" | grep -oE '[0-9]{8}T[0-9]{6}Z' || echo "")
        if [ -n "$TAG_DATE" ] && [[ "$TAG_DATE" < "$CUTOFF" ]]; then
            git tag -d "$tag" >/dev/null 2>&1
            PRUNED=$((PRUNED + 1))
        fi
    done
    echo "Pruned ${PRUNED} checkpoint(s) older than ${DAYS} days"
    exit 0
fi

LABEL="${1:-auto}"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
TAG="shipyard-checkpoint-${LABEL}-${TIMESTAMP}"

git tag -a "$TAG" -m "Shipyard checkpoint: ${LABEL}" 2>/dev/null || {
    echo "Warning: Could not create checkpoint tag (not in a git repo or no commits yet)" >&2
    exit 0
}

echo "Checkpoint created: ${TAG}"
exit 0
