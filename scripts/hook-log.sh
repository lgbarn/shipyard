#
# hook-log.sh — sourced by hook scripts to provide shared failure logging.
#
# Usage (from a hook script):
#   source "${SHIPYARD_ROOT}/scripts/hook-log.sh"
#   log_hook_failure "hook-name" "$exit_code" "stderr snippet"
#
# Do NOT add a shebang — this file is always sourced, never executed directly.
# Do NOT add set -euo pipefail — callers already set it.
#
# shellcheck shell=bash

SHIPYARD_CONFIG_DIR="${HOME}/.config/shipyard"
HOOK_LOG="${SHIPYARD_CONFIG_DIR}/hooks.log"

log_hook_failure() {
    local hook_name="${1}"
    local exit_code="${2}"
    local stderr_snippet="${3}"

    mkdir -p "${SHIPYARD_CONFIG_DIR}"

    # Rotate if log exceeds 100KB (keep last 500 lines)
    if [[ -f "${HOOK_LOG}" ]] && (( $(wc -c < "${HOOK_LOG}") > 102400 )); then
        tail -500 "${HOOK_LOG}" > "${HOOK_LOG}.tmp" && mv "${HOOK_LOG}.tmp" "${HOOK_LOG}"
    fi

    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] hook=${hook_name} exit=${exit_code} ${stderr_snippet}" >> "${HOOK_LOG}"
}
