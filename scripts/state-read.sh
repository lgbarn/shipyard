#!/usr/bin/env bash
# SessionStart hook for Shipyard plugin
# Reads project state and injects context at session start
# Supports adaptive context loading (minimal/planning/execution/brownfield/full)

set -euo pipefail

# Determine plugin root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Read the using-shipyard skill content
using_shipyard_content=$(cat "${PLUGIN_ROOT}/skills/using-shipyard/SKILL.md" 2>/dev/null || echo "Shipyard skill file not found.")

# Build state context
state_context=""
suggestion=""

if [ -d ".shipyard" ] && [ -f ".shipyard/STATE.md" ]; then
    # Project has Shipyard state -- read it
    state_md=$(cat ".shipyard/STATE.md" 2>/dev/null || echo "")

    # Extract status and phase from STATE.md
    status=$(echo "$state_md" | grep -oP '(?<=\*\*Status:\*\* ).*' 2>/dev/null || echo "")
    phase=$(echo "$state_md" | grep -oP '(?<=\*\*Current Phase:\*\* )\d+' 2>/dev/null || echo "")

    # Determine context tier from config (default: auto)
    context_tier="auto"
    if [ -f ".shipyard/config.json" ]; then
        context_tier=$(jq -r '.context_tier // "auto"' ".shipyard/config.json" 2>/dev/null || echo "auto")
    fi

    # Auto-detect tier based on status
    if [ "$context_tier" = "auto" ]; then
        case "$status" in
            building|in_progress) context_tier="execution" ;;
            planning|planned|ready|shipped|complete|"") context_tier="planning" ;;
            *) context_tier="planning" ;;
        esac
    fi

    # Always load STATE.md (minimal baseline for any project with state)
    state_context="## Shipyard Project State Detected\n\nA .shipyard/ directory exists in this project. Below is the current state.\n\n### STATE.md\n${state_md}\n"

    # Planning tier and above: load PROJECT.md + ROADMAP.md
    if [ "$context_tier" != "minimal" ]; then
        if [ -f ".shipyard/PROJECT.md" ]; then
            project_md=$(cat ".shipyard/PROJECT.md" 2>/dev/null || echo "")
            if [ -n "$project_md" ]; then
                state_context="${state_context}\n### PROJECT.md (summary)\n${project_md}\n"
            fi
        fi
        if [ -f ".shipyard/ROADMAP.md" ]; then
            roadmap_summary=$(head -80 ".shipyard/ROADMAP.md" 2>/dev/null || echo "")
            if [ -n "$roadmap_summary" ]; then
                state_context="${state_context}\n### ROADMAP.md (first 80 lines)\n${roadmap_summary}\n"
            fi
        fi
    fi

    # Execution tier: also load current phase plans and recent summaries
    if [ "$context_tier" = "execution" ] || [ "$context_tier" = "full" ]; then
        if [ -n "$phase" ]; then
            # Find phase directory (handles zero-padded names like 01-name)
            phase_dir=$(find .shipyard/phases/ -maxdepth 1 -type d -name "${phase}*" -o -name "0${phase}*" 2>/dev/null | head -1)
            if [ -n "$phase_dir" ]; then
                plan_context=""
                # Load plans (first 50 lines each, max 3)
                for plan_file in $(ls "${phase_dir}/plans/"PLAN-*.md 2>/dev/null | head -3); do
                    plan_snippet=$(head -50 "$plan_file" 2>/dev/null || echo "")
                    plan_context="${plan_context}\n#### $(basename "$plan_file")\n${plan_snippet}\n"
                done
                # Load recent summaries (first 30 lines each, max 3)
                for summary_file in $(ls "${phase_dir}/results/"SUMMARY-*.md 2>/dev/null | tail -3); do
                    summary_snippet=$(head -30 "$summary_file" 2>/dev/null || echo "")
                    plan_context="${plan_context}\n#### $(basename "$summary_file")\n${summary_snippet}\n"
                done
                if [ -n "$plan_context" ]; then
                    state_context="${state_context}\n### Current Phase Context\n${plan_context}\n"
                fi
            fi
        fi
    fi

    # Brownfield/full tier: also load codebase analysis
    if [ "$context_tier" = "full" ] && [ -d ".shipyard/codebase" ]; then
        codebase_context=""
        for doc in STACK.md ARCHITECTURE.md CONVENTIONS.md CONCERNS.md; do
            if [ -f ".shipyard/codebase/$doc" ]; then
                doc_snippet=$(head -40 ".shipyard/codebase/$doc" 2>/dev/null || echo "")
                codebase_context="${codebase_context}\n#### ${doc}\n${doc_snippet}\n"
            fi
        done
        if [ -n "$codebase_context" ]; then
            state_context="${state_context}\n### Codebase Analysis\n${codebase_context}\n"
        fi
    fi

    # Command auto-suggestions based on current state
    case "$status" in
        ready)
            suggestion="**Suggested next step:** \`/shipyard:plan ${phase:-1}\` -- Plan the current phase"
            ;;
        planned)
            suggestion="**Suggested next step:** \`/shipyard:build ${phase:-1}\` -- Execute the planned phase"
            ;;
        planning)
            suggestion="**Suggested next step:** Continue planning or run \`/shipyard:status\` to check progress"
            ;;
        building|in_progress)
            suggestion="**Suggested next step:** \`/shipyard:resume\` -- Continue building"
            ;;
        complete|complete_with_gaps)
            # Check if more phases exist
            next_phase=$((${phase:-0} + 1))
            if grep -q "Phase ${next_phase}\|Phase 0${next_phase}" ".shipyard/ROADMAP.md" 2>/dev/null; then
                suggestion="**Suggested next step:** \`/shipyard:plan ${next_phase}\` -- Plan the next phase"
            else
                suggestion="**Suggested next step:** \`/shipyard:ship\` -- All phases complete, ready to deliver"
            fi
            ;;
        shipped)
            suggestion="**Project shipped!** Run \`/shipyard:init\` to start a new milestone."
            ;;
    esac

    # Check for open issues
    if [ -f ".shipyard/ISSUES.md" ]; then
        issue_count=$(grep -c "^|" ".shipyard/ISSUES.md" 2>/dev/null || echo "0")
        # Subtract header rows (2 per table section)
        issue_count=$((issue_count > 4 ? issue_count - 4 : 0))
        if [ "$issue_count" -gt 0 ]; then
            suggestion="${suggestion}\n**Note:** ${issue_count} tracked issue(s). Run \`/shipyard:issues\` to review."
        fi
    fi

    # Add suggestion and commands to context
    if [ -n "$suggestion" ]; then
        state_context="${state_context}\n### Recommended Action\n${suggestion}\n"
    fi

    state_context="${state_context}\n### Available Commands\n- /shipyard:status - View progress and get routing suggestions\n- /shipyard:plan [phase] - Plan a phase\n- /shipyard:build [phase] - Execute plans\n- /shipyard:resume - Restore context and continue\n- /shipyard:quick [task] - Execute a small task\n- /shipyard:ship - Finish and deliver work\n- /shipyard:init - Re-initialize or add a milestone\n- /shipyard:issues - View and manage deferred issues\n- /shipyard:rollback - Revert to a previous checkpoint\n- /shipyard:recover - Diagnose and recover from interrupted state\n"
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
