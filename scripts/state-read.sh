#!/usr/bin/env bash
# SessionStart hook for Shipyard plugin
# Reads project state and injects context at session start
# Supports adaptive context loading (minimal/planning/execution/brownfield/full)
#
# Exit Codes:
#   0 - Success (JSON context output produced)
#   1 - User error (invalid tier value -- currently auto-corrected, reserved for future use)
#   2 - State corruption (STATE.json missing required fields or malformed)
#   3 - Missing dependency (jq not found)

set -euo pipefail

# Sanitize lesson content — defense-in-depth, NOT a security boundary.
# LESSONS.md is local user-edited content, not external/untrusted input.
# This catches accidental prompt pollution (stray XML tags, copy-pasted
# system prompts). It will NOT stop a determined adversary — regex-based
# sanitization is inherently bypassable. The real protection is that
# .shipyard/ is local-only and gitignored.
# Strips XML/HTML tags, code blocks, prompt directives, and caps length.
sanitize_lesson() {
    local raw="$1"
    # 1. Strip XML/HTML tags (closed and unclosed) and HTML-encoded tag entities
    raw=$(printf '%s\n' "$raw" | sed 's/<[^>]*>//g; s/<[a-zA-Z\/!][^>]*$//g; s/&lt;/ /g; s/&gt;/ /g; s/&#60;/ /g; s/&#62;/ /g')
    # 2. Remove code blocks (lines between triple-backtick fences, inclusive)
    raw=$(printf '%s\n' "$raw" | awk '/```/{skip=!skip; next} !skip{print}')
    # 3. Filter lines containing prompt directive patterns (case-insensitive)
    raw=$(printf '%s\n' "$raw" | grep -viE '^\s*(SYSTEM|ASSISTANT|USER)\s*:|\bSYSTEM\s+PROMPT\b|\bIGNORE\s+(ALL\s+)?(PREVIOUS|ABOVE)\b|\bNEW\s+INSTRUCTION\b' || true)
    # 4. Cap at 500 characters
    if [ "${#raw}" -gt 500 ]; then
        raw="${raw:0:497}..."
    fi
    printf '%s' "$raw"
}

# Auto-migrate STATE.md to STATE.json + HISTORY.md
# Called when STATE.json is missing but STATE.md exists
migrate_state_md() {
    local state_md
    state_md=$(cat ".shipyard/STATE.md" 2>/dev/null || echo "")

    # Validate required fields (same checks as legacy code)
    if [ -z "$state_md" ]; then
        jq -n '{
            error: "STATE.md is corrupt or incomplete",
            details: "File is empty",
            exitCode: 2,
            recovery: "Run: bash scripts/state-write.sh --recover"
        }'
        exit 2
    fi
    local local_missing=""
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

    # Extract fields
    local m_status m_phase m_position m_blocker m_updated
    m_status=$(echo "$state_md" | sed -n 's/^.*\*\*Status:\*\* \(.*\)$/\1/p' | head -1)
    m_phase=$(echo "$state_md" | sed -n 's/^.*\*\*Current Phase:\*\* \([0-9][0-9]*\).*$/\1/p' | head -1)
    m_position=$(echo "$state_md" | sed -n 's/^.*\*\*Current Position:\*\* \(.*\)$/\1/p' | head -1)
    m_blocker=$(echo "$state_md" | sed -n 's/^.*\*\*Blocker:\*\* \(.*\)$/\1/p' | head -1)
    m_updated=$(echo "$state_md" | sed -n 's/^.*\*\*Last Updated:\*\* \(.*\)$/\1/p' | head -1)
    m_updated="${m_updated:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}"

    # Validate phase integer
    if [ -n "$m_phase" ] && ! [[ "$m_phase" =~ ^[0-9]+$ ]]; then
        m_phase="0"
    fi

    # Write STATE.json
    jq -n \
        --argjson schema 3 \
        --argjson phase "${m_phase:-0}" \
        --arg position "${m_position:-}" \
        --arg status "${m_status:-unknown}" \
        --arg updated_at "$m_updated" \
        --arg blocker "${m_blocker:-}" \
        '{schema: $schema, phase: $phase, position: $position, status: $status, updated_at: $updated_at, blocker: (if $blocker == "" then null else $blocker end)}' \
        > .shipyard/STATE.json

    # Extract history section from STATE.md and write HISTORY.md
    local history_section=""
    history_section=$(echo "$state_md" | sed -n '/^## History$/,$ { /^## History$/d; p; }' | sed '/^$/d')
    if [ -n "$history_section" ]; then
        printf '%s\n' "$history_section" > .shipyard/HISTORY.md
    fi
    # Append migration log entry
    printf '%s\n' "- [$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Migrated from STATE.md to STATE.json (schema 3)" >> .shipyard/HISTORY.md

    echo "Migrated STATE.md -> STATE.json + HISTORY.md" >&2
}

# Parse arguments
HUMAN_MODE=false
while [[ $# -gt 0 ]]; do
    case "$1" in
        --human) HUMAN_MODE=true; shift ;;
        *) shift ;;
    esac
done

# Check for jq dependency
if ! command -v jq >/dev/null 2>&1; then
    echo '{"error":"Missing dependency: jq is required but not found in PATH","exitCode":3}' >&2
    exit 3
fi

# Build compact skill summary from discovered skills (auto-discovers from skills/*/SKILL.md)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

skill_list=""
for skill_dir in "${PLUGIN_ROOT}"/skills/*/; do
    [ -f "${skill_dir}SKILL.md" ] || continue
    skill_name=$(basename "$skill_dir")
    # Extract first line description from SKILL.md (after the # header)
    desc=$(sed -n '/^[^#]/{ s/^[[:space:]]*//; p; q; }' "${skill_dir}SKILL.md" 2>/dev/null || echo "")
    [ -z "$desc" ] && desc="(no description)"
    # Truncate long descriptions
    [ "${#desc}" -gt 120 ] && desc="${desc:0:117}..."
    skill_list="${skill_list}\n- \`shipyard:${skill_name}\` - ${desc}"
done

read -r -d '' skill_summary <<SKILLEOF || true
## Shipyard Skills & Commands

**Skills** (invoke via Skill tool for full details):
$(printf '%b' "$skill_list")

**Triggers:** File patterns (*.tf, Dockerfile, *.test.*), task markers (tdd="true"), state conditions (claiming done, errors), and content patterns (security, refactor) activate skills automatically. If even 1% chance a skill applies, invoke it.

**Commands:** /init, /plan, /build, /status, /resume, /quick, /ship, /issues, /rollback, /recover, /move-docs, /worktree, /help, /doctor, /cancel, /s, /b, /p, /q
SKILLEOF

# Build state context
state_context=""
suggestion=""

# Reject symlinked .shipyard directory (security: prevent writes outside project)
if [ -L ".shipyard" ]; then
    jq -n '{
        error: ".shipyard is a symlink, which is not allowed",
        details: "Remove the symlink and run /shipyard:init to create a real directory",
        recovery: "rm .shipyard && mkdir .shipyard"
    }'
    exit 3
fi

if [ -d ".shipyard" ]; then
    if [ -f ".shipyard/STATE.json" ]; then
        # PRIMARY PATH: Read STATE.json via jq
        :
    elif [ -f ".shipyard/STATE.md" ]; then
        # MIGRATION PATH: Convert STATE.md -> STATE.json + HISTORY.md
        migrate_state_md
        # Fall through to read the newly-created STATE.json
    fi

    if [ -f ".shipyard/STATE.json" ]; then
        # Verify integrity: checksum + JSON validation
        _state_ok=true

        # Checksum verification (if checksum file exists)
        if [ -f ".shipyard/STATE.json.sha256" ]; then
            _expected_sum=$(cat ".shipyard/STATE.json.sha256" 2>/dev/null || echo "")
            _actual_sum=$(shasum -a 256 .shipyard/STATE.json | cut -d' ' -f1)
            if [ -n "$_expected_sum" ] && [ "$_expected_sum" != "$_actual_sum" ]; then
                _state_ok=false
            fi
        fi

        # JSON structure validation
        if [ "$_state_ok" = true ]; then
            jq -e 'has("schema") and has("phase") and has("status")' .shipyard/STATE.json > /dev/null 2>&1 || _state_ok=false
        fi

        # Fallback to backup if primary is corrupt
        if [ "$_state_ok" = false ]; then
            if [ -f ".shipyard/STATE.json.bak" ] && \
               jq -e 'has("schema") and has("phase") and has("status")' .shipyard/STATE.json.bak > /dev/null 2>&1; then
                cp ".shipyard/STATE.json.bak" ".shipyard/STATE.json"
                shasum -a 256 ".shipyard/STATE.json" | cut -d' ' -f1 > ".shipyard/STATE.json.sha256" 2>/dev/null || true
            else
                jq -n '{
                    error: "STATE.json is corrupt or incomplete",
                    details: "Malformed JSON or missing required fields (schema, phase, status)",
                    exitCode: 2,
                    recovery: "Run: bash scripts/state-write.sh --recover"
                }'
                exit 2
            fi
        fi

        # Extract fields in one jq call (IFS=tab because position/blocker may contain spaces)
        _tsv=$(jq -r '[.schema, .phase, .status, (.position // ""), (.blocker // "")] | @tsv' .shipyard/STATE.json 2>/dev/null) || {
            jq -n '{
                error: "Failed to extract fields from STATE.json",
                details: "JSON may be structurally valid but contains incompatible field types",
                recovery: "Run: bash scripts/state-write.sh --recover"
            }'
            exit 2
        }
        IFS=$'\t' read -r schema phase status position blocker <<< "$_tsv"

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

        # Render structured STATE.json context (replaces raw STATE.md dump)
        state_context="## Shipyard Project State Detected\n\nA .shipyard/ directory exists in this project. Below is the current state.\n\n### STATE.json\nPhase: ${phase}\nStatus: ${status}\nPosition: ${position:-none}\nBlocker: ${blocker:-none}\nSchema: ${schema}\n"

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
                    phase_dir=$(find .shipyard/phases/ -maxdepth 1 -type d \( -name "${phase}*" -o -name "0${phase}*" \) 2>/dev/null | head -1)
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
                        # Extract header + ~7 lines of lesson content (8 lines total per lesson)
                        chunk=$(sed -n "${line_num},$((line_num + 8))p" ".shipyard/LESSONS.md" 2>/dev/null || echo "")
                        chunk=$(sanitize_lesson "$chunk")
                        lesson_snippet="${lesson_snippet}${chunk}\n"
                    done <<< "$last_five"
                    if [ -n "$lesson_snippet" ]; then
                        state_context="${state_context}\n### Recent Lessons Learned\n${lesson_snippet}\n"
                    fi
                fi
            fi

            # Load recent history (execution/full tier only)
            if [ -f ".shipyard/HISTORY.md" ]; then
                history_tail=$(tail -10 ".shipyard/HISTORY.md" 2>/dev/null || echo "")
                if [ -n "$history_tail" ]; then
                    state_context="${state_context}\n### Recent History\n${history_tail}\n"
                fi
            fi

            # Load working notes (execution/full tier only, last 20 lines)
            if [ -f ".shipyard/NOTES.md" ]; then
                notes_tail=$(tail -20 ".shipyard/NOTES.md" 2>/dev/null || echo "")
                if [ -n "$notes_tail" ]; then
                    state_context="${state_context}\n### Working Notes\n${notes_tail}\n"
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
            # Validate: reject absolute paths and directory traversals
            case "$codebase_docs_path" in
                /*|*..*) codebase_docs_path=".shipyard/codebase" ;;
            esac

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
    fi
fi

if [ -z "$state_context" ]; then
    state_context="## No Shipyard Project Detected\n\nThis project does not have a .shipyard/ directory.\n\n**To get started, the user can run:** /shipyard:init\n\nThis will analyze the codebase (if one exists), gather requirements, and create a structured roadmap.\n"
fi

# Combine all context
full_context="<EXTREMELY_IMPORTANT>\nYou have Shipyard available -- a structured project execution framework.\n\n**Current State:**\n${state_context}\n\n**Below are available Shipyard skills and commands. Use the Skill tool to load any skill for full details.**\n\n${skill_summary}\n</EXTREMELY_IMPORTANT>"

# Human-readable output mode (--human flag)
if [ "$HUMAN_MODE" = true ]; then
    if [ -f ".shipyard/STATE.json" ]; then
        _h_phase=$(jq -r '.phase' .shipyard/STATE.json)
        _h_status=$(jq -r '.status' .shipyard/STATE.json)
        _h_position=$(jq -r '.position // "none"' .shipyard/STATE.json)
        _h_updated=$(jq -r '.updated_at // "unknown"' .shipyard/STATE.json)
        _h_blocker=$(jq -r '.blocker // empty' .shipyard/STATE.json 2>/dev/null || true)
        echo "=== Shipyard State ==="
        echo "Phase:    ${_h_phase}"
        echo "Status:   ${_h_status}"
        echo "Position: ${_h_position}"
        echo "Updated:  ${_h_updated}"
        [ -n "$_h_blocker" ] && echo "Blocker:  ${_h_blocker}"
        echo ""
        if [ -f ".shipyard/HISTORY.md" ]; then
            echo "=== Recent History ==="
            tail -5 ".shipyard/HISTORY.md" 2>/dev/null || true
            echo ""
        fi
        echo "=== Suggested Action ==="
        case "$_h_status" in
            ready)                       echo "Run: /shipyard:plan ${_h_phase}" ;;
            planned)                     echo "Run: /shipyard:build ${_h_phase}" ;;
            planning)                    echo "Continue planning or run /shipyard:status" ;;
            building|in_progress)        echo "Run: /shipyard:resume" ;;
            complete|complete_with_gaps) echo "Run: /shipyard:plan $((_h_phase + 1)) or /shipyard:ship" ;;
            shipped)                     echo "Project shipped! Run /shipyard:init for new milestone" ;;
            *)                           echo "Run: /shipyard:status" ;;
        esac
    else
        echo "No Shipyard project detected. Run /shipyard:init to get started."
    fi
    exit 0
fi

# Output JSON (jq handles escaping natively)
jq -n --arg ctx "$full_context" '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: $ctx
  }
}'

exit 0
