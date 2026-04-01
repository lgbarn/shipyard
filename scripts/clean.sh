#!/usr/bin/env bash
# Shipyard cleanup
# Removes stale state files after a milestone ships, keeping only
# files that carry value across milestones.
#
# Usage:
#   clean.sh                    Interactive cleanup (requires confirmation)
#   clean.sh --confirm          Skip confirmation prompt
#   clean.sh --dry-run          Show what would be deleted without deleting
#
# Preserved files (whitelist):
#   STATE.json, STATE.json.bak, STATE.json.sha256
#   HISTORY.md, config.json, .gitignore
#   LESSONS.md, ISSUES.md, codebase/
#
# Exit Codes:
#   0 - Success (files cleaned or nothing to clean)
#   1 - User error (invalid arguments)
#   2 - User cancelled
#   3 - Missing dependency (.shipyard/ directory missing)

set -euo pipefail

SHIPYARD_DIR=".shipyard"
DOCS_PLANS_DIR="docs/plans"

# Reject symlinked .shipyard directory (security: prevent deletes outside project)
if [ -L "$SHIPYARD_DIR" ]; then
    echo "Error: .shipyard is a symlink, which is not allowed" >&2
    exit 3
fi

if [ ! -d "$SHIPYARD_DIR" ]; then
    echo "Error: .shipyard/ directory does not exist. Nothing to clean." >&2
    exit 3
fi

# --- Parse arguments ---
DRY_RUN=false
CONFIRMED=false

for arg in "$@"; do
    case "$arg" in
        --dry-run)  DRY_RUN=true ;;
        --confirm)  CONFIRMED=true ;;
        *)
            echo "Error: Unknown argument '${arg}'. Usage: clean.sh [--confirm | --dry-run]" >&2
            exit 1
            ;;
    esac
done

# --- Whitelist: files and dirs to keep ---
is_preserved() {
    local name="$1"
    case "$name" in
        STATE.json|STATE.json.bak|STATE.json.sha256) return 0 ;;
        HISTORY.md|config.json|.gitignore)           return 0 ;;
        LESSONS.md|ISSUES.md)                        return 0 ;;
        codebase)                                    return 0 ;;
        *)                                           return 1 ;;
    esac
}

# --- Collect files to delete ---
TO_DELETE=()

# Enable dotglob so hidden files (e.g. .gitignore) are enumerated and subject to whitelist
shopt -s dotglob
for entry in "$SHIPYARD_DIR"/*; do
    [ -e "$entry" ] || continue
    name=$(basename "$entry")
    if ! is_preserved "$name"; then
        TO_DELETE+=("$entry")
    fi
done
shopt -u dotglob

# Also collect stale plans from docs/plans/
if [ -d "$DOCS_PLANS_DIR" ]; then
    for plan in "$DOCS_PLANS_DIR"/*.md; do
        [ -e "$plan" ] || continue
        TO_DELETE+=("$plan")
    done
fi

# --- Nothing to clean ---
if [ ${#TO_DELETE[@]} -eq 0 ]; then
    echo "Nothing to clean. Only preserved files remain."
    exit 0
fi

# --- Show what will be deleted ---
echo "Files and directories to remove:"
for entry in "${TO_DELETE[@]}"; do
    if [ -d "$entry" ]; then
        echo "  [dir]  $entry"
    else
        echo "  [file] $entry"
    fi
done
echo ""
echo "Preserved: STATE.json, HISTORY.md, config.json, .gitignore, LESSONS.md, ISSUES.md, codebase/"

if [ "$DRY_RUN" = true ]; then
    echo ""
    echo "(dry run — nothing deleted)"
    exit 0
fi

# --- Confirm ---
if [ "$CONFIRMED" != true ]; then
    echo ""
    printf "Type 'CLEAN' to confirm deletion: "
    read -r response
    if [ "$response" != "CLEAN" ]; then
        echo "Cancelled."
        exit 2
    fi
fi

# --- Delete ---
REMOVED=0
for entry in "${TO_DELETE[@]}"; do
    rm -rf "$entry"
    REMOVED=$((REMOVED + 1))
done

echo "Cleaned ${REMOVED} item(s)"
exit 0
