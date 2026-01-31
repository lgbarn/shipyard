#!/usr/bin/env bash
# SessionStart hook for Shipyard plugin
# Reads project state and injects context at session start

set -euo pipefail

# Determine plugin root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Read the using-shipyard skill content
using_shipyard_content=$(cat "${PLUGIN_ROOT}/skills/using-shipyard/SKILL.md" 2>/dev/null || echo "Shipyard skill file not found.")

# Build state context
state_context=""

if [ -d ".shipyard" ] && [ -f ".shipyard/STATE.md" ]; then
    # Project has Shipyard state -- read it
    state_md=$(cat ".shipyard/STATE.md" 2>/dev/null || echo "")
    project_md=""
    if [ -f ".shipyard/PROJECT.md" ]; then
        project_md=$(cat ".shipyard/PROJECT.md" 2>/dev/null || echo "")
    fi
    roadmap_summary=""
    if [ -f ".shipyard/ROADMAP.md" ]; then
        # Read first 80 lines of roadmap for summary
        roadmap_summary=$(head -80 ".shipyard/ROADMAP.md" 2>/dev/null || echo "")
    fi

    state_context="## Shipyard Project State Detected\n\nA .shipyard/ directory exists in this project. Below is the current state.\n\n### STATE.md\n${state_md}\n"

    if [ -n "$project_md" ]; then
        state_context="${state_context}\n### PROJECT.md (summary)\n${project_md}\n"
    fi
    if [ -n "$roadmap_summary" ]; then
        state_context="${state_context}\n### ROADMAP.md (first 80 lines)\n${roadmap_summary}\n"
    fi

    state_context="${state_context}\n### Available Commands\n- /shipyard:status - View progress and get routing suggestions\n- /shipyard:plan [phase] - Plan a phase\n- /shipyard:build [phase] - Execute plans\n- /shipyard:resume - Restore context and continue\n- /shipyard:quick [task] - Execute a small task\n- /shipyard:ship - Finish and deliver work\n- /shipyard:init - Re-initialize or add a milestone\n"
else
    state_context="## No Shipyard Project Detected\n\nThis project does not have a .shipyard/ directory.\n\n**To get started, the user can run:** /shipyard:init\n\nThis will analyze the codebase (if one exists), gather requirements, and create a structured roadmap.\n\n### Available Commands\n- /shipyard:init - Initialize Shipyard for this project\n- /shipyard:quick [task] - Execute a quick task (will create minimal state)\n"
fi

# Combine all context
full_context="<EXTREMELY_IMPORTANT>\nYou have Shipyard available -- a structured project execution framework.\n\n**Current State:**\n${state_context}\n\n**Below is the full content of the 'shipyard:using-shipyard' skill -- your guide to using Shipyard. For all other skills, use the 'Skill' tool:**\n\n${using_shipyard_content}\n</EXTREMELY_IMPORTANT>"

# Output JSON (jq handles escaping natively)
jq -n --arg ctx "$full_context" '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: $ctx
  }
}'

exit 0
