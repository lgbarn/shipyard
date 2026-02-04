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
#
# Exit Codes:
#   0 - Success (tag created, pruned, or graceful non-git-repo warning)
#   1 - User error (invalid arguments, empty label after sanitization)
#   3 - Missing dependency (git command failed for reason other than "not a repo")

set -euo pipefail

if [ "${1:-}" = "--prune" ]; then
    DAYS="${2:-30}"
    if ! [[ "$DAYS" =~ ^[0-9]+$ ]]; then
        echo "Error: --prune argument must be a positive integer, got '${DAYS}'" >&2
        exit 1
    fi
    CUTOFF=$(date -u -v-"${DAYS}"d +"%Y%m%dT%H%M%SZ" 2>/dev/null || date -u -d "${DAYS} days ago" +"%Y%m%dT%H%M%SZ")
    PRUNED=0
    while IFS= read -r tag; do
        [ -z "$tag" ] && continue
        TAG_DATE=$(echo "$tag" | grep -oE '[0-9]{8}T[0-9]{6}Z' || echo "")
        if [ -n "$TAG_DATE" ] && [[ "$TAG_DATE" < "$CUTOFF" ]]; then
            git tag -d "$tag" >/dev/null 2>&1
            PRUNED=$((PRUNED + 1))
        fi
    done < <(git tag -l "shipyard-checkpoint-*" 2>/dev/null)
    echo "Pruned ${PRUNED} checkpoint(s) older than ${DAYS} days"
    exit 0
fi

LABEL=$(printf '%s' "${1:-auto}" | tr -cd 'a-zA-Z0-9._-')
LABEL="${LABEL#-}"  # strip leading hyphen to prevent git flag injection
if [ -z "$LABEL" ]; then
    echo "Error: label must contain at least one alphanumeric character, dot, underscore, or hyphen" >&2
    exit 1
fi
if [ "${#LABEL}" -gt 64 ]; then
    LABEL="${LABEL:0:64}"
fi
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
TAG="shipyard-checkpoint-${LABEL}-${TIMESTAMP}"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
    echo "Warning: Not in a git repository; skipping checkpoint tag" >&2
    exit 0
fi
git tag -a "$TAG" -m "Shipyard checkpoint: ${LABEL}" 2>/dev/null || {
    echo "Error: git tag failed" >&2
    exit 3
}

echo "Checkpoint created: ${TAG}"

# Warn if worktree has uncommitted changes (tracked or untracked)
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    echo "Warning: Git worktree has uncommitted changes" >&2
    echo "  Consider committing before checkpointing for clean rollback points" >&2
elif [ -n "$(git ls-files --others --exclude-standard 2>/dev/null)" ]; then
    echo "Warning: Git worktree has untracked files" >&2
    echo "  Consider adding and committing before checkpointing for clean rollback points" >&2
fi
exit 0
