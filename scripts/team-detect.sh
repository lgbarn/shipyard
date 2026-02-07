#!/usr/bin/env bash
# Team detection utility
# Source this script to detect Claude Code Agent Teams environment.
# Exports: SHIPYARD_IS_TEAMMATE, SHIPYARD_TEAMS_ENABLED, SHIPYARD_TEAM_NAME
#
# Usage: source scripts/team-detect.sh

# Detect if running as a teammate (Claude Code sets CLAUDE_CODE_TEAM_NAME automatically)
if [ -n "${CLAUDE_CODE_TEAM_NAME:-}" ]; then
    export SHIPYARD_IS_TEAMMATE=true
    export SHIPYARD_TEAM_NAME="$CLAUDE_CODE_TEAM_NAME"
else
    export SHIPYARD_IS_TEAMMATE=false
    export SHIPYARD_TEAM_NAME=""
fi

# Detect if teams feature is enabled (user opts in via env var)
if [ "${CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS:-}" = "1" ]; then
    export SHIPYARD_TEAMS_ENABLED=true
else
    export SHIPYARD_TEAMS_ENABLED=false
fi
