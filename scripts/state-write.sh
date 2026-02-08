#!/usr/bin/env bash
# Shipyard state writer
# Updates .shipyard/STATE.json with current position and status
# Appends to .shipyard/HISTORY.md
#
# Usage:
#   state-write.sh --phase <N> --position <description> [--status <status>] [--blocker <description>]
#   state-write.sh --raw <content>
#
# Examples:
#   state-write.sh --phase 2 --position "Building plan 1 of 3" --status in_progress
#   state-write.sh --raw '{"schema":3,"phase":1,"position":"Custom","status":"ready","updated_at":"2026-01-01T00:00:00Z","blocker":null}'

# Exit Codes:
#   0 - Success (STATE.json written or recovered)
#   1 - User error (invalid --phase, invalid --status, --raw not valid JSON, missing required args)
#   2 - State corruption (post-write validation failed, generated state file is empty/invalid JSON)
#   3 - Missing dependency (.shipyard/ directory missing, mktemp failed)
#   4 - Lock timeout (could not acquire state lock after max retries)

set -euo pipefail

# Reject symlinked .shipyard directory (security: prevent writes outside project)
if [ -L ".shipyard" ]; then
    echo "Error: .shipyard is a symlink, which is not allowed" >&2
    exit 3
fi

# Ensure .shipyard directory exists
if [ ! -d ".shipyard" ]; then
    echo "Error: .shipyard/ directory does not exist. Run /shipyard:init first." >&2
    exit 3
fi

STATE_FILE=".shipyard/STATE.json"
HISTORY_FILE=".shipyard/HISTORY.md"

# --- Teams-aware locking (only when teams enabled) ---
LOCK_DIR=""
_release_lock() {
    if [ -n "$LOCK_DIR" ] && [ -d "$LOCK_DIR" ]; then
        rm -f "$LOCK_DIR/pid"
        rmdir "$LOCK_DIR" 2>/dev/null || true
    fi
}

if [ "${SHIPYARD_TEAMS_ENABLED:-}" = "true" ]; then
    # Compute per-project lock path using hash of .shipyard absolute path
    SHIPYARD_DIR_HASH=$(cd .shipyard && pwd | (sha256sum 2>/dev/null || md5sum 2>/dev/null || cksum) | cut -d' ' -f1 | cut -c1-12)
    LOCK_DIR="${TMPDIR:-/tmp}/shipyard-state-${SHIPYARD_DIR_HASH}.lock"

    # Acquire lock with retry (mkdir is atomic on all POSIX systems)
    MAX_RETRIES="${SHIPYARD_LOCK_MAX_RETRIES:-30}"
    RETRY_DELAY="${SHIPYARD_LOCK_RETRY_DELAY:-0.1}"
    # Validate lock parameters (prevent DoS via extreme env var values)
    [[ "$MAX_RETRIES" =~ ^[0-9]+$ ]] && [ "$MAX_RETRIES" -ge 1 ] && [ "$MAX_RETRIES" -le 300 ] || MAX_RETRIES=30
    [[ "$RETRY_DELAY" =~ ^[0-9]*\.?[0-9]+$ ]] || RETRY_DELAY=0.1
    (( $(awk "BEGIN{print ($RETRY_DELAY > 5.0)}") )) && RETRY_DELAY=0.1
    acquired=false
    for (( i=0; i<MAX_RETRIES; i++ )); do
        if mkdir "$LOCK_DIR" 2>/dev/null; then
            echo $$ > "$LOCK_DIR/pid"
            acquired=true
            break
        fi
        # Check for stale lock (owning process died)
        if [ -f "$LOCK_DIR/pid" ]; then
            old_pid=$(cat "$LOCK_DIR/pid" 2>/dev/null || echo "")
            if [ -n "$old_pid" ] && ! kill -0 "$old_pid" 2>/dev/null; then
                # Stale lock — owning process is dead
                rm -f "$LOCK_DIR/pid"
                rmdir "$LOCK_DIR" 2>/dev/null || true
                if mkdir "$LOCK_DIR" 2>/dev/null; then
                    echo $$ > "$LOCK_DIR/pid"
                    acquired=true
                    break
                fi
            fi
        fi
        sleep "$RETRY_DELAY"
    done

    if [ "$acquired" != "true" ]; then
        echo "Error: Could not acquire state lock after ${MAX_RETRIES} retries" >&2
        exit 4
    fi
fi

# Cleanup stack for safe multi-call trap handling
_CLEANUP_FILES=()
_cleanup_stack() {
    if [ ${#_CLEANUP_FILES[@]} -gt 0 ]; then
        for f in "${_CLEANUP_FILES[@]}"; do
            rm -f "$f"
        done
    fi
}
trap '_cleanup_stack; _release_lock' EXIT INT TERM

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
    # Register temp file for cleanup on unexpected exit
    _CLEANUP_FILES+=("$tmpfile")

    printf '%s\n' "$content" > "$tmpfile"

    # Post-write validation: must be non-empty
    if [ ! -s "$tmpfile" ]; then
        echo "Error: Generated state file is empty" >&2
        rm -f "$tmpfile"
        exit 2
    fi

    # For JSON targets, validate structure
    if [[ "$target" == *.json ]]; then
        if ! jq -e '.schema' "$tmpfile" > /dev/null 2>&1; then
            echo "Error: Generated JSON is invalid" >&2
            rm -f "$tmpfile"
            exit 2
        fi
    fi

    # Atomic move (same filesystem guarantees atomicity)
    mv "$tmpfile" "$target" || {
        echo "Error: Failed to move temp file to ${target}" >&2
        rm -f "$tmpfile"
        exit 2
    }
    # Remove from cleanup stack since file was successfully moved
    _CLEANUP_FILES=("${_CLEANUP_FILES[@]/$tmpfile/}")
}

# Append to history file
append_history() {
    local entry="$1"
    printf '%s\n' "- [${TIMESTAMP}] ${entry}" >> "$HISTORY_FILE"
}

# Parse arguments
PHASE=""
POSITION=""
STATUS=""
BLOCKER=""
RAW_CONTENT=""
RECOVER=false
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
        --recover)
            RECOVER=true
            shift
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

# Recovery mode: rebuild STATE.json from .shipyard/ artifacts
if [ "$RECOVER" = true ]; then
    echo "Recovering STATE.json from .shipyard/ artifacts..." >&2

    # Find latest phase number from phases/ directories
    latest_phase=""
    if [ -d ".shipyard/phases" ]; then
        latest_phase=$(find .shipyard/phases/ -maxdepth 1 -type d 2>/dev/null | \
            sed 's|.*/||' | grep '^[0-9][0-9]*$' | sort -n | tail -1)
    fi
    latest_phase="${latest_phase:-1}"

    # Determine status from phase artifacts
    recovered_status="ready"
    recovered_position="Recovered state"
    phase_dir=".shipyard/phases/${latest_phase}"
    if [ -d "$phase_dir" ]; then
        if [ -d "${phase_dir}/results" ] && \
           find "${phase_dir}/results/" -name "SUMMARY-*.md" 2>/dev/null | grep -q .; then
            recovered_status="complete"
            recovered_position="Phase ${latest_phase} completed (recovered)"
        elif [ -d "${phase_dir}/plans" ] && \
             find "${phase_dir}/plans/" -name "PLAN-*.md" 2>/dev/null | grep -q .; then
            recovered_status="planned"
            recovered_position="Phase ${latest_phase} planned (recovered)"
        else
            recovered_position="Phase ${latest_phase} (recovered, status unknown)"
        fi
    fi

    # Build recovered history from git checkpoint tags (if available)
    recovered_history=""
    if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
        while IFS= read -r tag; do
            [ -z "$tag" ] && continue
            tag_date=$(printf '%s\n' "$tag" | grep -oE '[0-9]{8}T[0-9]{6}Z' | head -1 || echo "")
            tag_label=$(printf '%s\n' "$tag" | sed 's/^shipyard-checkpoint-//' | sed 's/-[0-9]*T[0-9]*Z$//')
            recovered_history="${recovered_history}- [${tag_date:-unknown}] Checkpoint: ${tag_label}
"
        done < <(git tag -l "shipyard-checkpoint-*" 2>/dev/null | sort)
    fi

    # Generate recovered STATE.json
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    NEW_CONTENT=$(jq -n \
        --argjson schema 3 \
        --argjson phase "$latest_phase" \
        --arg position "$recovered_position" \
        --arg status "$recovered_status" \
        --arg updated_at "$TIMESTAMP" \
        '{schema: $schema, phase: $phase, position: $position, status: $status, updated_at: $updated_at, blocker: null}')
    atomic_write "$NEW_CONTENT" "$STATE_FILE"

    # Write history
    append_history "State recovered from .shipyard/ artifacts"
    if [ -n "$recovered_history" ]; then
        printf '%s' "$recovered_history" >> "$HISTORY_FILE"
    fi

    echo "STATE.json recovered: Phase=${latest_phase} Status=${recovered_status}" >&2
    exit 0
fi

# If raw content provided, write directly
if [ -n "$RAW_CONTENT" ]; then
    if ! echo "$RAW_CONTENT" | jq -e 'has("schema") and has("phase") and has("status")' > /dev/null 2>&1; then
        echo "Error: --raw content is not valid JSON or missing required fields (schema, phase, status)" >&2
        exit 1
    fi
    atomic_write "$RAW_CONTENT" "$STATE_FILE"
    echo "STATE.json updated (raw write) at ${TIMESTAMP}"
    exit 0
fi

# If we have structured updates, apply them
if [ -n "$PHASE" ] || [ -n "$POSITION" ] || [ -n "$STATUS" ]; then
    NEW_CONTENT=$(jq -n \
        --argjson schema 3 \
        --argjson phase "${PHASE:-0}" \
        --arg position "${POSITION:-}" \
        --arg status "${STATUS:-unknown}" \
        --arg updated_at "$TIMESTAMP" \
        --arg blocker "${BLOCKER:-}" \
        '{schema: $schema, phase: $phase, position: $position, status: $status, updated_at: $updated_at, blocker: (if $blocker == "" then null else $blocker end)}')
    atomic_write "$NEW_CONTENT" "$STATE_FILE"
    append_history "Phase ${PHASE:-?}: ${POSITION:-updated} (${STATUS:-unknown})"
    echo "STATE.json updated at ${TIMESTAMP}: Phase=${PHASE:-?} Position=${POSITION:-?} Status=${STATUS:-?}"
else
    echo "Error: No updates provided. Use --phase, --position, --status, or --raw." >&2
    exit 1
fi

exit 0
