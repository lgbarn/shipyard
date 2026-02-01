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

set -euo pipefail

# Ensure .shipyard directory exists
if [ ! -d ".shipyard" ]; then
    echo "Error: .shipyard/ directory does not exist. Run /shipyard:init first." >&2
    exit 1
fi

STATE_FILE=".shipyard/STATE.md"

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
    echo "$RAW_CONTENT" > "$STATE_FILE"
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
    # Build new state content
    NEW_STATE="# Shipyard State\n\n"
    NEW_STATE+="**Last Updated:** ${TIMESTAMP}\n\n"

    if [ -n "$PHASE" ]; then
        NEW_STATE+="**Current Phase:** ${PHASE}\n"
    fi
    if [ -n "$POSITION" ]; then
        NEW_STATE+="**Current Position:** ${POSITION}\n"
    fi
    if [ -n "$STATUS" ]; then
        NEW_STATE+="**Status:** ${STATUS}\n"
    fi
    if [ -n "$BLOCKER" ]; then
        NEW_STATE+="\n## Blockers\n\n- ${BLOCKER}\n"
    fi

    # Preserve history section if it exists
    if echo "$EXISTING" | grep -q "## History"; then
        HISTORY_SECTION=$(echo "$EXISTING" | sed -n '/## History/,$p')
        NEW_STATE+="\n${HISTORY_SECTION}\n"
    else
        NEW_STATE+="\n## History\n\n"
    fi

    # Append current action to history
    NEW_STATE+="- [${TIMESTAMP}] Phase ${PHASE:-?}: ${POSITION:-updated} (${STATUS:-unknown})\n"

    printf '%b' "$NEW_STATE" > "$STATE_FILE"
    echo "STATE.md updated at ${TIMESTAMP}: Phase=${PHASE:-?} Position=${POSITION:-?} Status=${STATUS:-?}"
else
    echo "Error: No updates provided. Use --phase, --position, --status, or --raw." >&2
    exit 1
fi

exit 0
