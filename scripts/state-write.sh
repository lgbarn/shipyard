#!/usr/bin/env bash
# Shipyard state writer
# Updates .shipyard/STATE.md with current position and status
#
# Usage:
#   state-write.sh --phase <N> --position <description> [--status <status>] [--blocker <description>]
#   state-write.sh --raw <content>
#
# Examples:
#   state-write.sh --phase 2 --position "Building plan 1 of 3" --status in_progress
#   state-write.sh --raw "$(cat updated-state.md)"

# Exit Codes:
#   0 - Success (STATE.md written or recovered)
#   1 - User error (invalid --phase, invalid --status, missing required args)
#   2 - State corruption (post-write validation failed, generated STATE.md is empty/malformed)
#   3 - Missing dependency (.shipyard/ directory missing, mktemp failed)

set -euo pipefail

# Ensure .shipyard directory exists
if [ ! -d ".shipyard" ]; then
    echo "Error: .shipyard/ directory does not exist. Run /shipyard:init first." >&2
    exit 3
fi

STATE_FILE=".shipyard/STATE.md"

# Atomic write: write to temp file, validate, then mv (POSIX-atomic replacement)
atomic_write() {
    local content="$1"
    local target="$2"
    local tmpfile
    tmpfile=$(mktemp "${target}.tmp.XXXXXX" 2>/dev/null) || \
    tmpfile=$(mktemp -t "state-write.XXXXXX") || {
        echo "Error: Failed to create temporary file" >&2
        exit 3
    }
    # Cleanup on unexpected exit
    trap 'rm -f "$tmpfile"' EXIT INT TERM

    printf '%s\n' "$content" > "$tmpfile"

    # Post-write validation: must be non-empty
    if [ ! -s "$tmpfile" ]; then
        echo "Error: Generated STATE.md is empty" >&2
        rm -f "$tmpfile"
        exit 2
    fi

    # Atomic move (same filesystem guarantees atomicity)
    mv "$tmpfile" "$target" || {
        echo "Error: Failed to move temp file to ${target}" >&2
        rm -f "$tmpfile"
        exit 2
    }
    # Clear the trap since file is moved
    trap - EXIT INT TERM
}

# Parse arguments
PHASE=""
POSITION=""
STATUS=""
BLOCKER=""
RAW_CONTENT=""
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

while [[ $# -gt 0 ]]; do
    case "$1" in
        --phase)
            PHASE="$2"
            shift 2
            ;;
        --position)
            POSITION="$2"
            shift 2
            ;;
        --status)
            STATUS="$2"
            shift 2
            ;;
        --blocker)
            BLOCKER="$2"
            shift 2
            ;;
        --raw)
            RAW_CONTENT="$2"
            shift 2
            ;;
        *)
            echo "Unknown argument: $1" >&2
            exit 1
            ;;
    esac
done

# Validate inputs
if [ -n "$PHASE" ] && ! [[ "$PHASE" =~ ^[0-9]+$ ]]; then
    echo "Error: --phase must be a positive integer, got '${PHASE}'" >&2
    exit 1
fi

if [ -n "$STATUS" ]; then
    case "$STATUS" in
        ready|planned|planning|building|in_progress|complete|complete_with_gaps|shipped|blocked|paused)
            ;;
        *)
            echo "Error: --status must be one of: ready, planned, planning, building, in_progress, complete, complete_with_gaps, shipped, blocked, paused. Got '${STATUS}'" >&2
            exit 1
            ;;
    esac
fi

# If raw content provided, write directly
if [ -n "$RAW_CONTENT" ]; then
    atomic_write "$RAW_CONTENT" "$STATE_FILE"
    echo "STATE.md updated (raw write) at ${TIMESTAMP}"
    exit 0
fi

# Otherwise, build or update STATE.md
if [ -f "$STATE_FILE" ]; then
    EXISTING=$(cat "$STATE_FILE")
else
    EXISTING=""
fi

# If we have structured updates, apply them
if [ -n "$PHASE" ] || [ -n "$POSITION" ] || [ -n "$STATUS" ]; then
    NEW_CONTENT=$({
        printf '%s\n' "# Shipyard State" ""
        printf '%s\n' "**Schema:** 2.0"
        printf '%s\n' "**Last Updated:** ${TIMESTAMP}" ""

        if [ -n "$PHASE" ]; then
            printf '%s\n' "**Current Phase:** ${PHASE}"
        fi
        if [ -n "$POSITION" ]; then
            printf '%s\n' "**Current Position:** ${POSITION}"
        fi
        if [ -n "$STATUS" ]; then
            printf '%s\n' "**Status:** ${STATUS}"
        fi
        if [ -n "$BLOCKER" ]; then
            printf '%s\n' "" "## Blockers" "" "- ${BLOCKER}"
        fi

        # Preserve history section if it exists
        if echo "$EXISTING" | grep -q "## History"; then
            printf '%s\n' ""
            echo "$EXISTING" | sed -n '/## History/,$p'
        else
            printf '%s\n' "" "## History" ""
        fi

        # Append current action to history
        printf '%s\n' "- [${TIMESTAMP}] Phase ${PHASE:-?}: ${POSITION:-updated} (${STATUS:-unknown})"
    })
    atomic_write "$NEW_CONTENT" "$STATE_FILE"
    echo "STATE.md updated at ${TIMESTAMP}: Phase=${PHASE:-?} Position=${POSITION:-?} Status=${STATUS:-?}"
else
    echo "Error: No updates provided. Use --phase, --position, --status, or --raw." >&2
    exit 1
fi

exit 0
