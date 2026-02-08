#!/usr/bin/env bash
#
# Verify all version strings are in sync across the project.
# Checks: package.json, package-lock.json (2 locations), plugin.json, marketplace.json
#

set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
    echo "Error: jq is required but not installed" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

PKG_VERSION=$(jq -r '.version' "${ROOT_DIR}/package.json")
LOCK_VERSION=$(jq -r '.version' "${ROOT_DIR}/package-lock.json")
LOCK_PKG_VERSION=$(jq -r '.packages[""].version' "${ROOT_DIR}/package-lock.json")
PLUGIN_VERSION=$(jq -r '.version' "${ROOT_DIR}/.claude-plugin/plugin.json")
MKT_VERSION=$(jq -r '.plugins[0].version' "${ROOT_DIR}/.claude-plugin/marketplace.json")

ERRORS=0

if [[ "${LOCK_VERSION}" != "${PKG_VERSION}" ]]; then
    echo "ERROR: package-lock.json root version (${LOCK_VERSION}) != package.json (${PKG_VERSION})"
    ERRORS=$((ERRORS + 1))
fi

if [[ "${LOCK_PKG_VERSION}" != "${PKG_VERSION}" ]]; then
    echo "ERROR: package-lock.json packages version (${LOCK_PKG_VERSION}) != package.json (${PKG_VERSION})"
    ERRORS=$((ERRORS + 1))
fi

if [[ "${PLUGIN_VERSION}" != "${PKG_VERSION}" ]]; then
    echo "ERROR: plugin.json version (${PLUGIN_VERSION}) != package.json (${PKG_VERSION})"
    ERRORS=$((ERRORS + 1))
fi

if [[ "${MKT_VERSION}" != "${PKG_VERSION}" ]]; then
    echo "ERROR: marketplace.json version (${MKT_VERSION}) != package.json (${PKG_VERSION})"
    ERRORS=$((ERRORS + 1))
fi

if [[ ${ERRORS} -gt 0 ]]; then
    echo ""
    echo "Found ${ERRORS} version mismatch(es). All files must match package.json version: ${PKG_VERSION}"
    exit 1
fi

echo "All versions in sync: ${PKG_VERSION}"
