#!/usr/bin/env bash
#
# Shipyard Memory - Background Indexer Hook
#
# Triggers incremental indexing of conversations.
# Called periodically or on session events.
#

set -euo pipefail

# Configuration
SHIPYARD_CONFIG_DIR="${HOME}/.config/shipyard"
SHIPYARD_CONFIG="${SHIPYARD_CONFIG_DIR}/config.json"
SHIPYARD_LOG="${SHIPYARD_CONFIG_DIR}/memory.log"
SHIPYARD_LOCK="${SHIPYARD_CONFIG_DIR}/memory.lock"
SHIPYARD_LAST_INDEX="${SHIPYARD_CONFIG_DIR}/memory.last-index"
SHIPYARD_INDEX_COOLDOWN=300  # 5 minutes between indexing runs

# Ensure log directory exists
mkdir -p "${SHIPYARD_CONFIG_DIR}"

# Log function
log() {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $*" >> "${SHIPYARD_LOG}"
}

# Check if memory is enabled
is_memory_enabled() {
    if [[ ! -f "${SHIPYARD_CONFIG}" ]]; then
        return 1
    fi

    local enabled
    enabled=$(jq -r '.memory // false' "${SHIPYARD_CONFIG}" 2>/dev/null || echo "false")

    [[ "${enabled}" == "true" ]]
}

# Acquire lock (prevent concurrent indexing)
acquire_lock() {
    if [[ -f "${SHIPYARD_LOCK}" ]]; then
        local lock_age
        lock_age=$(($(date +%s) - $(stat -f %m "${SHIPYARD_LOCK}" 2>/dev/null || stat -c %Y "${SHIPYARD_LOCK}" 2>/dev/null || echo "0")))

        # If lock is older than 10 minutes, assume stale and remove
        if [[ ${lock_age} -gt 600 ]]; then
            log "Removing stale lock (age: ${lock_age}s)"
            rm -f "${SHIPYARD_LOCK}"
        else
            log "Index already running (lock age: ${lock_age}s)"
            return 1
        fi
    fi

    echo $$ > "${SHIPYARD_LOCK}"
    trap 'rm -f "${SHIPYARD_LOCK}"' EXIT
    return 0
}

# Main indexing function
run_index() {
    log "Starting incremental index"

    # Find the memory MCP server script
    local mcp_script=""

    # Check common locations
    for location in \
        "${CLAUDE_PLUGIN_ROOT:-}/dist/memory/mcp-server.js" \
        "${CLAUDE_PLUGIN_ROOT:-}/src/memory/mcp-server.ts" \
        "$(npm root -g)/@lgbarn/shipyard/dist/memory/mcp-server.js" \
        "$(dirname "$0")/../dist/memory/mcp-server.js" \
    ; do
        if [[ -f "${location}" ]]; then
            mcp_script="${location}"
            break
        fi
    done

    if [[ -z "${mcp_script}" ]]; then
        log "ERROR: Could not find memory MCP server script"
        return 1
    fi

    # Run indexing via the MCP server's index command
    # Note: In production, this would use the proper MCP client
    # For now, we call the index function directly
    if [[ "${mcp_script}" == *.ts ]]; then
        npx tsx "${mcp_script}" --index 2>&1 | while read -r line; do
            log "INDEX: ${line}"
        done
    else
        node "${mcp_script}" --index 2>&1 | while read -r line; do
            log "INDEX: ${line}"
        done
    fi

    log "Incremental index complete"
}

# Main entry point
main() {
    # Check if memory is enabled
    if ! is_memory_enabled; then
        # Memory disabled, exit silently
        exit 0
    fi

    # Throttle: skip if last index was less than SHIPYARD_INDEX_COOLDOWN seconds ago
    if [[ -f "${SHIPYARD_LAST_INDEX}" ]]; then
        local last_run
        last_run=$(cat "${SHIPYARD_LAST_INDEX}" 2>/dev/null || echo "0")
        local now
        now=$(date +%s)
        if (( now - last_run < SHIPYARD_INDEX_COOLDOWN )); then
            exit 0
        fi
    fi

    # Try to acquire lock
    if ! acquire_lock; then
        exit 0
    fi

    # Record this run's timestamp
    date +%s > "${SHIPYARD_LAST_INDEX}"

    # Run indexing
    run_index
}

# Handle arguments
case "${1:-}" in
    --status)
        if is_memory_enabled; then
            echo "Memory is enabled"
            if [[ -f "${SHIPYARD_LOCK}" ]]; then
                echo "Indexer is running (PID: $(cat "${SHIPYARD_LOCK}"))"
            else
                echo "Indexer is idle"
            fi
        else
            echo "Memory is disabled"
        fi
        ;;
    --force)
        # Force run even if lock exists
        rm -f "${SHIPYARD_LOCK}"
        main
        ;;
    *)
        main
        ;;
esac
