#!/usr/bin/env bash
# SessionStart hook for Shipyard plugin
# Reads project state and injects context at session start
# Supports adaptive context loading (minimal/planning/execution/brownfield/full)
#
# Exit Codes:
#   0 - Success (JSON context output produced)
#   1 - User error (invalid tier value -- currently auto-corrected, reserved for future use)
#   2 - State corruption (STATE.md missing required fields or malformed)
#   3 - Missing dependency (jq not found)

set -euo pipefail

# Check for jq dependency
if ! command -v jq >/dev/null 2>&1; then
    echo '{"error":"Missing dependency: jq is required but not found in PATH","exitCode":3}' >&2
    exit 3
fi

# Compact skill summary (replaces full SKILL.md injection for token efficiency)
read -r -d '' skill_summary <<'SKILLEOF' || true
## Shipyard Skills & Commands

**Skills** (invoke via Skill tool for full details):
- `shipyard:using-shipyard` - How to find and use skills
- `shipyard:shipyard-tdd` - TDD discipline for implementation
- `shipyard:shipyard-debugging` - Root cause investigation before fixes
- `shipyard:shipyard-verification` - Evidence before completion claims
- `shipyard:shipyard-brainstorming` - Requirements gathering and design
- `shipyard:security-audit` - OWASP, secrets, dependency security
- `shipyard:code-simplification` - Duplication and dead code detection
- `shipyard:infrastructure-validation` - Terraform, Ansible, Docker validation
- `shipyard:parallel-dispatch` - Concurrent agent dispatch
- `shipyard:shipyard-writing-plans` - Creating implementation plans
- `shipyard:shipyard-executing-plans` - Executing plans with agents
- `shipyard:git-workflow` - Branch, commit, worktree, and delivery
- `shipyard:documentation` - Docs after implementation
- `shipyard:shipyard-testing` - Writing effective, maintainable tests
- `shipyard:shipyard-writing-skills` - Creating and testing new skills
- `shipyard:memory` - Cross-session recall for past conversations

**Triggers:** File patterns (*.tf, Dockerfile, *.test.*), task markers (tdd="true"), state conditions (claiming done, errors), and content patterns (security, refactor) activate skills automatically. If even 1% chance a skill applies, invoke it.

**Commands:** /init, /plan, /build, /status, /resume, /quick, /ship, /issues, /rollback, /recover, /move-docs, /worktree, /memory-search, /memory-status, /memory-forget, /memory-enable, /memory-disable, /memory-import
SKILLEOF

# Build state context
state_context=""
suggestion=""

if [ -d ".shipyard" ] && [ -f ".shipyard/STATE.md" ]; then
    # Project has Shipyard state -- read it
    state_md=$(cat ".shipyard/STATE.md" 2>/dev/null || echo "")

    # Validate STATE.md has required fields
    if [ -z "$state_md" ]; then
        jq -n '{
            error: "STATE.md is corrupt or incomplete",
            details: "Missing required field(s): Status, Current Phase",
            exitCode: 2,
            recovery: "Run: bash scripts/state-write.sh --recover"
        }'
        exit 2
    fi
    local_missing=""
    echo "$state_md" | grep -q '\*\*Status:\*\*' || local_missing="Status"
    echo "$state_md" | grep -q '\*\*Current Phase:\*\*' || local_missing="${local_missing:+$local_missing, }Current Phase"
    if [ -n "$local_missing" ]; then
        jq -n --arg missing "$local_missing" '{
            error: "STATE.md is corrupt or incomplete",
            details: ("Missing required field(s): " + $missing),
            exitCode: 2,
            recovery: "Run: bash scripts/state-write.sh --recover"
        }'
        exit 2
    fi

    # Extract status and phase from STATE.md
    status=$(echo "$state_md" | sed -n 's/^.*\*\*Status:\*\* \(.*\)$/\1/p' | head -1)
    phase=$(echo "$state_md" | sed -n 's/^.*\*\*Current Phase:\*\* \([0-9][0-9]*\).*$/\1/p' | head -1)

    # Validate phase is a pure integer
    if [ -n "$phase" ] && ! [[ "$phase" =~ ^[0-9]+$ ]]; then
        phase=""
    fi

    # Determine context tier from config (default: auto)
    context_tier="auto"
    if [ -f ".shipyard/config.json" ]; then
        context_tier=$(jq -r '.context_tier // "auto"' ".shipyard/config.json" 2>/dev/null || echo "auto")
    fi
    case "$context_tier" in
        auto|minimal|planning|execution|brownfield|full) ;;
        *) context_tier="auto" ;;
    esac

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
            if [ -d ".shipyard/phases" ]; then
                phase_dir=$(find .shipyard/phases/ -maxdepth 1 -type d -name "${phase}*" -o -name "0${phase}*" 2>/dev/null | head -1)
            else
                phase_dir=""
            fi
            if [ -n "$phase_dir" ]; then
                plan_context=""
                # Load plans (first 50 lines each, max 3)
                if [ -d "${phase_dir}/plans" ]; then
                    plan_count=0
                    for plan_file in "${phase_dir}/plans/"PLAN-*.md; do
                        [ -e "$plan_file" ] || continue
                        [ "$plan_count" -ge 3 ] && break
                        plan_count=$((plan_count + 1))
                        plan_snippet=$(head -50 "$plan_file" 2>/dev/null || echo "")
                        plan_context="${plan_context}\n#### $(basename "$plan_file")\n${plan_snippet}\n"
                    done
                fi
                # Load recent summaries (first 30 lines each, max 3)
                summary_files=()
                if [ -d "${phase_dir}/results" ]; then
                    for f in "${phase_dir}/results/"SUMMARY-*.md; do
                        [ -e "$f" ] && summary_files+=("$f")
                    done
                fi
                # Take last 3 entries (glob sorts lexicographically)
                total=${#summary_files[@]}
                start=$(( total > 3 ? total - 3 : 0 ))
                for summary_file in "${summary_files[@]:$start}"; do
                    summary_snippet=$(head -30 "$summary_file" 2>/dev/null || echo "")
                    plan_context="${plan_context}\n#### $(basename "$summary_file")\n${summary_snippet}\n"
                done
                if [ -n "$plan_context" ]; then
                    state_context="${state_context}\n### Current Phase Context\n${plan_context}\n"
                fi
            fi
        fi

        # Load recent lessons (execution/full tier only, max 5)
        if [ -f ".shipyard/LESSONS.md" ]; then
            lesson_headers=$(grep -n "^## \[" ".shipyard/LESSONS.md" 2>/dev/null || echo "")
            if [ -n "$lesson_headers" ]; then
                last_five=$(echo "$lesson_headers" | tail -5)
                lesson_snippet=""
                while IFS=: read -r line_num _; do
                    chunk=$(sed -n "${line_num},$((line_num + 8))p" ".shipyard/LESSONS.md" 2>/dev/null || echo "")
                    lesson_snippet="${lesson_snippet}${chunk}\n"
                done <<< "$last_five"
                if [ -n "$lesson_snippet" ]; then
                    state_context="${state_context}\n### Recent Lessons Learned\n${lesson_snippet}\n"
                fi
            fi
        fi
    fi

    # Brownfield/full tier: also load codebase analysis
    if [ "$context_tier" = "full" ]; then
        # Read codebase docs path from config (default: .shipyard/codebase)
        codebase_docs_path=".shipyard/codebase"
        if [ -f ".shipyard/config.json" ]; then
            codebase_docs_path=$(jq -r '.codebase_docs_path // ".shipyard/codebase"' ".shipyard/config.json" 2>/dev/null || echo ".shipyard/codebase")
        fi

        if [ -d "$codebase_docs_path" ]; then
            codebase_context=""
            for doc in STACK.md ARCHITECTURE.md CONVENTIONS.md CONCERNS.md; do
                if [ -f "${codebase_docs_path}/$doc" ]; then
                    doc_snippet=$(head -40 "${codebase_docs_path}/$doc" 2>/dev/null || echo "")
                    codebase_context="${codebase_context}\n#### ${doc}\n${doc_snippet}\n"
                fi
            done
            if [ -n "$codebase_context" ]; then
                state_context="${state_context}\n### Codebase Analysis\n${codebase_context}\n"
            fi
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
            if grep -qE "Phase ${next_phase}|Phase 0${next_phase}" ".shipyard/ROADMAP.md" 2>/dev/null; then
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

else
    state_context="## No Shipyard Project Detected\n\nThis project does not have a .shipyard/ directory.\n\n**To get started, the user can run:** /shipyard:init\n\nThis will analyze the codebase (if one exists), gather requirements, and create a structured roadmap.\n"
fi

# Combine all context
full_context="<EXTREMELY_IMPORTANT>\nYou have Shipyard available -- a structured project execution framework.\n\n**Current State:**\n${state_context}\n\n**Below are available Shipyard skills and commands. Use the Skill tool to load any skill for full details.**\n\n${skill_summary}\n</EXTREMELY_IMPORTANT>"

# Output JSON (jq handles escaping natively)
jq -n --arg ctx "$full_context" '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: $ctx
  }
}'

exit 0
