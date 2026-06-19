#!/usr/bin/env bash
#
# Generate the Codex plugin tree from the canonical Claude Code artifacts.
#
# Shipyard's Claude Code plugin (.claude-plugin/, skills/) is the single source
# of truth. This script transforms it into a Codex plugin tree:
#
#   .agents/plugins/marketplace.json          Codex marketplace manifest
#   plugins/shipyard/.codex-plugin/plugin.json Codex plugin manifest
#   plugins/shipyard/skills/<name>/SKILL.md    skills (copied byte-for-byte)
#
# The Codex tree is a COMMITTED build artifact. CI (check-codex-sync.sh) enforces
# that the committed tree equals this generator's output, so the tree can never
# drift from the canonical source by hand.
#
# Usage: build-codex.sh [OUTPUT_DIR]   (defaults to the repo root)
#
set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
    echo "Error: jq is required but not installed" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUT_DIR="${1:-${ROOT_DIR}}"

SRC_PLUGIN="${ROOT_DIR}/.claude-plugin/plugin.json"
PLUGIN_DIR="${OUT_DIR}/plugins/shipyard"
CODEX_MANIFEST="${PLUGIN_DIR}/.codex-plugin/plugin.json"
MARKETPLACE="${OUT_DIR}/.agents/plugins/marketplace.json"

# Skills included in the walking skeleton (Slice 1). Later slices expand this set.
SKELETON_SKILLS=("using-shipyard")

NAME=$(jq -r '.name' "${SRC_PLUGIN}")

# --- clean previous output so removals are reflected deterministically ---
rm -rf "${PLUGIN_DIR}" "${OUT_DIR}/.agents"
mkdir -p "${PLUGIN_DIR}/.codex-plugin" "${PLUGIN_DIR}/skills" "${OUT_DIR}/.agents/plugins"

# --- plugin manifest: carry over name/version/description/author, then add the
#     Codex-specific skills pointer and interface block ---
jq '. + {
      "skills": "./skills/",
      "interface": {
        "displayName": "Shipyard",
        "shortDescription": "Ship software systematically with Codex",
        "category": "Engineering",
        "defaultPrompt": [
          "Help me ship this feature systematically",
          "What should I do next in Shipyard?"
        ]
      }
    }' "${SRC_PLUGIN}" > "${CODEX_MANIFEST}"

# --- marketplace manifest pointing at the plugin dir ---
jq -n --arg name "${NAME}" '{
      "name": $name,
      "interface": { "displayName": "Shipyard" },
      "plugins": [
        {
          "name": $name,
          "source": { "source": "local", "path": "./plugins/shipyard" },
          "policy": { "installation": "AVAILABLE" },
          "category": "Engineering"
        }
      ]
    }' > "${MARKETPLACE}"

# --- copy skills byte-for-byte (Codex SKILL.md format is identical) ---
for skill in "${SKELETON_SKILLS[@]}"; do
    src="${ROOT_DIR}/skills/${skill}"
    if [[ ! -f "${src}/SKILL.md" ]]; then
        echo "Error: canonical skill not found: ${skill}" >&2
        exit 1
    fi
    mkdir -p "${PLUGIN_DIR}/skills/${skill}"
    cp "${src}/SKILL.md" "${PLUGIN_DIR}/skills/${skill}/SKILL.md"
done

echo "Generated Codex plugin tree at ${OUT_DIR} (${#SKELETON_SKILLS[@]} skill(s))"
