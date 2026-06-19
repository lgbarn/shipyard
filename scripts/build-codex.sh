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
# Sources: the canonical shared skills, plus Codex-only entrypoint skills that
# exist because Codex has no slash commands / parallel subagents (codex/skills-extra).
skill_count=0
for skills_root in "${ROOT_DIR}/skills" "${ROOT_DIR}/codex/skills-extra"; do
    [[ -d "${skills_root}" ]] || continue
    for src in "${skills_root}"/*/; do
        [[ -f "${src}SKILL.md" ]] || continue
        name="$(basename "${src}")"
        mkdir -p "${PLUGIN_DIR}/skills/${name}"
        cp "${src}SKILL.md" "${PLUGIN_DIR}/skills/${name}/SKILL.md"
        skill_count=$((skill_count + 1))
    done
done

if [[ ${skill_count} -eq 0 ]]; then
    echo "Error: no skills found under ${ROOT_DIR}/skills or ${ROOT_DIR}/codex/skills-extra" >&2
    exit 1
fi

echo "Generated Codex plugin tree at ${OUT_DIR} (${skill_count} skill(s))"
