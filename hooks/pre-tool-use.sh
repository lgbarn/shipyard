#!/usr/bin/env bash
# PreToolUse hook: coaching layer for protocol compliance
# Injects context-aware reminders before key tool calls.
# Exit 0 always — this hook coaches, never blocks.

set -euo pipefail

# Kill switch: skip all hooks
if [ "${SHIPYARD_DISABLE_HOOKS:-}" = "true" ]; then exit 0; fi
# Selective skip: comma-separated hook names
HOOK_NAME="$(basename "${BASH_SOURCE[0]}" .sh)"
if [[ ",${SHIPYARD_SKIP_HOOKS:-}," == *",$HOOK_NAME,"* ]]; then exit 0; fi

INPUT=$(cat) || true
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null) || TOOL_NAME=""

case "$TOOL_NAME" in
  Task)
    echo '{"hookSpecificOutput":{"additionalContext":"Follow Model Routing Protocol from config.json when dispatching agents."}}'
    ;;
  Bash)
    if [ -f ".shipyard/STATE.json" ]; then
      status=$(jq -r '.status // ""' .shipyard/STATE.json 2>/dev/null) || status=""
      if [ "$status" = "building" ]; then
        echo '{"hookSpecificOutput":{"additionalContext":"Build phase active — consider checkpoint before destructive operations."}}'
      fi
    fi
    ;;
  Write)
    tool_input=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null) || tool_input=""
    if [[ "$tool_input" == *"STATE.json"* ]]; then
      echo '{"hookSpecificOutput":{"additionalContext":"Use scripts/state-write.sh for STATE.json updates — do not edit directly."}}'
    fi
    ;;
esac

exit 0
