#!/usr/bin/env bash
#
# Keeps the Shipyard marketplace clone in sync with GitHub.
# Runs as an async SessionStart hook, throttled to once per hour.
#
# This works around a Claude Code limitation where /plugin update
# does not git-fetch the marketplace clone before checking versions.
#

set -euo pipefail

SHIPYARD_CONFIG_DIR="${HOME}/.config/shipyard"
SYNC_LOG="${SHIPYARD_CONFIG_DIR}/marketplace-sync.log"
SYNC_TIMESTAMP="${SHIPYARD_CONFIG_DIR}/marketplace-sync.last"
SYNC_COOLDOWN=3600  # 1 hour

MARKETPLACE_DIR="${HOME}/.claude/plugins/marketplaces/shipyard"

mkdir -p "${SHIPYARD_CONFIG_DIR}"

log() { echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $*" >> "${SYNC_LOG}"; }

# Throttle: skip if synced recently
if [[ -f "${SYNC_TIMESTAMP}" ]]; then
    last=$(cat "${SYNC_TIMESTAMP}" 2>/dev/null || echo "0")
    now=$(date +%s)
    if (( now - last < SYNC_COOLDOWN )); then
        exit 0
    fi
fi

# Marketplace clone must exist and be a git repo
if [[ ! -d "${MARKETPLACE_DIR}/.git" ]]; then
    exit 0
fi

# Record timestamp before fetch (prevents rapid retries on failure)
date +%s > "${SYNC_TIMESTAMP}"

# Fetch and fast-forward
if git -C "${MARKETPLACE_DIR}" fetch origin --quiet 2>>"${SYNC_LOG}"; then
    local_head=$(git -C "${MARKETPLACE_DIR}" rev-parse HEAD)
    remote_head=$(git -C "${MARKETPLACE_DIR}" rev-parse origin/main 2>/dev/null || echo "")

    if [[ -n "${remote_head}" && "${local_head}" != "${remote_head}" ]]; then
        if git -C "${MARKETPLACE_DIR}" merge --ff-only origin/main --quiet 2>>"${SYNC_LOG}"; then
            new_ver=$(jq -r '.version' "${MARKETPLACE_DIR}/.claude-plugin/plugin.json" 2>/dev/null || echo "?")
            log "Marketplace updated to ${new_ver} (${remote_head:0:7})"
        else
            log "Fast-forward failed; marketplace may need manual reset"
        fi
    fi
else
    log "Fetch failed (network issue?)"
fi
