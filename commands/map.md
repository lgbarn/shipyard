---
description: "On-demand codebase analysis — map technology stack, architecture, quality, or concerns"
disable-model-invocation: true
argument-hint: "[focus] — technology (default), architecture, quality, or concerns"
---

# /shipyard:map - On-Demand Codebase Analysis

You are executing on-demand codebase analysis. Follow these steps precisely.

<prerequisites>

## Step 1: Parse Arguments

Extract from the command:
- `focus` (optional): Analysis focus area. Accepts:
  - **No argument / "technology"**: Map technology stack — languages, frameworks, dependencies, build tools (produces STACK.md + INTEGRATIONS.md)
  - **"architecture"**: Map system architecture — patterns, layers, boundaries, data flow (produces ARCHITECTURE.md + STRUCTURE.md)
  - **"quality"**: Map code quality — conventions, testing, patterns (produces CONVENTIONS.md + TESTING.md)
  - **"concerns"**: Map technical debt — outdated deps, security risks, performance issues (produces CONCERNS.md)
  - **"all"**: Run all 4 focus areas in parallel (dispatches 4 mapper agents)

## Step 2: Detect Context

1. Check if `.shipyard/` exists (optional — this command works anywhere).
2. If `.shipyard/config.json` exists, read `model_routing.mapping` for model selection.
3. Otherwise, use default model: **sonnet**.
4. Follow **Worktree Protocol** (see `docs/PROTOCOLS.md`) — detect worktree context.

## Step 2a: Team or Agent Dispatch

**Detection:**
Check the `SHIPYARD_TEAMS_ENABLED` environment variable (exported by `scripts/team-detect.sh`). This variable is set to `true` when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.

**Conditional Prompt:**
If `SHIPYARD_TEAMS_ENABLED=true`, use `AskUserQuestion` with exactly two options:
- "Team mode (parallel teammates)" — uses TeamCreate/TaskCreate/SendMessage/TeamDelete lifecycle
- "Agent mode (subagents)" — uses standard Task dispatch (current behavior)

Question text: "Teams available. Use team mode (parallel teammates) or agent mode (subagents)?"

**Silent Fallback:**
If `SHIPYARD_TEAMS_ENABLED` is `false` or unset, silently set `dispatch_mode` to `agent` with no prompt (zero overhead).

**Variable Storage:**
Store the result as `dispatch_mode` (value: `team` or `agent`). This variable is referenced by all subsequent dispatch steps.

**Usage Note:**
Team mode provides parallelism benefit only for `map all` (4 mapper agents). Single-focus maps always use Task dispatch regardless of `dispatch_mode`.

</prerequisites>

<execution>

## Step 3: Build Agent Context

Assemble context per **Agent Context Protocol** (see `docs/PROTOCOLS.md`):
- The focus area from Step 1
- Working directory, current branch, and worktree status
- `.shipyard/PROJECT.md` (if exists)

## Step 4: Dispatch Mapper

**Single focus:**
Dispatch a **mapper agent** (subagent_type: "shipyard:mapper") with:
- Follow **Model Routing Protocol** — resolve model from `model_routing.mapping` (default: sonnet)
- max_turns: 20
- All context from Step 3
- Instruction: Analyze the codebase for the specified focus area. Cite every finding with file paths. Mark inferences with "[Inferred]".

**All focuses (parallel):**
Dispatch **4 mapper agents** in parallel, one per focus area (technology, architecture, quality, concerns), each with the same context but different focus instructions.

</execution>

<output>

## Step 5: Present Results

Display the analysis document(s) to the user.

Offer follow-up:
> "Would you like me to:
> - Save these documents to `.shipyard/codebase/` (or `docs/codebase/`)
> - Analyze another focus area
> - Create an improvement plan based on the findings"

</output>
