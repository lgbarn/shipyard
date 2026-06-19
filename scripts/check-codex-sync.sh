#!/usr/bin/env bash
#
# Verify the committed Codex plugin tree equals the generator's output.
#
# The Codex tree (plugins/shipyard/, .agents/plugins/marketplace.json) is a
# build artifact produced by build-codex.sh. This guard regenerates it into a
# temp dir and diffs it against the committed tree; any drift fails CI. This is
# what makes "Claude artifacts are the single source of truth" enforceable
# rather than aspirational.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

bash "${SCRIPT_DIR}/build-codex.sh" "${TMP_DIR}" >/dev/null

DRIFT=0
for rel in "plugins/shipyard" ".agents/plugins/marketplace.json"; do
    if ! diff -r "${ROOT_DIR}/${rel}" "${TMP_DIR}/${rel}" >/dev/null 2>&1; then
        echo "ERROR: Codex tree drift detected in ${rel}"
        diff -r "${ROOT_DIR}/${rel}" "${TMP_DIR}/${rel}" || true
        DRIFT=1
    fi
done

if [[ ${DRIFT} -gt 0 ]]; then
    echo ""
    echo "Committed Codex tree differs from generator output."
    echo "Regenerate with: bash scripts/build-codex.sh"
    exit 1
fi

echo "Codex tree in sync with generator output"
