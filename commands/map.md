---
description: "On-demand codebase analysis — map technology stack, architecture, quality, or concerns"
disable-model-invocation: true
argument-hint: "[focus] — all (default), technology, architecture, quality, or concerns"
---

# /shipyard:map - On-Demand Codebase Analysis

You are executing on-demand codebase analysis. Follow these steps precisely.

<prerequisites>

## Step 1: Parse Arguments

Extract from the command:
- `focus` (optional): Analysis focus area. Accepts:
  - **No argument / "all"**: Run all 4 focus areas in parallel (dispatches 4 mapper agents)
  - **"technology"**: Map technology stack — languages, frameworks, dependencies, build tools (produces STACK.md + INTEGRATIONS.md)
  - **"architecture"**: Map system architecture — patterns, layers, boundaries, data flow (produces ARCHITECTURE.md + STRUCTURE.md)
  - **"quality"**: Map code quality — conventions, testing, patterns (produces CONVENTIONS.md + TESTING.md)
  - **"concerns"**: Map technical debt — outdated deps, security risks, performance issues (produces CONCERNS.md)

## Step 2: Detect Context

1. Check if `.shipyard/` exists (optional — this command works anywhere).
2. If `.shipyard/config.json` exists, read `model_routing.mapping` for model selection and `codebase_docs_path` for the output directory.
3. Otherwise, use default model: **sonnet** and default `codebase_docs_path`: `.shipyard/codebase`.
4. Follow **Worktree Protocol** (see `docs/PROTOCOLS.md`) — detect worktree context.
5. Store the resolved `codebase_docs_path` for use in Steps 3 and 5.

## Step 2a: Team or Agent Dispatch

**Detection:** Check the `SHIPYARD_TEAMS_ENABLED` environment variable (exported by `scripts/team-detect.sh`). This variable is set to `true` when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.

**Prompt (conditional):** If `SHIPYARD_TEAMS_ENABLED=true`, use `AskUserQuestion` with exactly two options:
- "Team mode (parallel teammates)" — uses TeamCreate/TaskCreate/SendMessage/TeamDelete lifecycle
- "Agent mode (subagents)" — uses standard Task dispatch (current behavior)

Question text: "Teams available. Use team mode (parallel teammates) or agent mode (subagents)?"

**Silent fallback:** If `SHIPYARD_TEAMS_ENABLED` is `false` or unset, silently set `dispatch_mode` to `agent` with no prompt (zero overhead).

**Variable storage:** Store the result as `dispatch_mode` (value: `team` or `agent`). This variable is referenced by all subsequent dispatch steps.

**Note:** Team mode provides parallelism benefit only for `map all` (4 mapper agents). Single-focus maps always use Task dispatch regardless of `dispatch_mode`.

</prerequisites>

<execution>

## Step 3: Build Agent Context

Assemble context per **Agent Context Protocol** (see `docs/PROTOCOLS.md`):
- The focus area from Step 1
- Working directory, current branch, and worktree status
- `.shipyard/PROJECT.md` (if exists)
- **Existing codebase docs** (if any): Read any existing `.md` files from the resolved `codebase_docs_path` directory that match the focus area's output files. Pass their content to the mapper agent so it can merge-update rather than write from scratch. For example, if the focus is "concerns" and `CONCERNS.md` exists, include its content as context.

## Step 4: Dispatch Mapper

**Single focus:**

**Dispatch:** Always uses Task dispatch (single-agent step — team overhead not justified). This applies regardless of `dispatch_mode`.

Dispatch a **mapper agent** (subagent_type: "shipyard:mapper") with:
- Follow **Model Routing Protocol** — resolve model from `model_routing.mapping` (default: sonnet)
- max_turns: 20
- All context from Step 3
- Instruction: Analyze the codebase for the specified focus area. Cite every finding with file paths. Mark inferences with "[Inferred]".

**All focuses (parallel):**

**If dispatch_mode is agent:**

Dispatch **4 mapper agents** in parallel, one per focus area (technology, architecture, quality, concerns), each with the same context but different focus instructions.

**If dispatch_mode is team:**

1. `TeamCreate(name: "shipyard-map-all")` — create a single team for all mappers
2. For each of the 4 focus areas (technology, architecture, quality, concerns), `TaskCreate` with:
   - Subject: "Map {focus_area}"
   - Description: the focus area instructions plus all context from Step 3
3. `TaskUpdate` to pre-assign each task to a specific teammate name (e.g., `mapper-technology`, `mapper-architecture`, `mapper-quality`, `mapper-concerns`) BEFORE spawning
4. For each task, `Task(team_name: "shipyard-map-all", name: "mapper-{focus}", subagent_type: "shipyard:mapper")` to spawn the teammate, following the Model Routing Protocol for model selection
5. Monitor progress via `TaskList` — poll until all 4 mapper tasks reach a terminal state
6. `SendMessage(shutdown_request)` to all teammates, then `TeamDelete(name: "shipyard-map-all")`

## Team Cleanup

**This section applies only when `dispatch_mode` is `team` and focus is `all`.**

After all mapper tasks complete, verify that the team has been properly cleaned up:

1. Confirm `SendMessage(shutdown_request)` was sent to all teammates in `shipyard-map-all`
2. Confirm `TeamDelete(name: "shipyard-map-all")` was called
3. If the team was not cleaned up (due to an error or early exit), run the shutdown + delete now

**Critical rule:** If `dispatch_mode` is `team` and you are about to exit early (error or user cancellation), you MUST run SendMessage(shutdown_request) + TeamDelete for the active team before exiting. Never leave orphaned teams running.

</execution>

<output>

## Step 5: Save Results

1. Resolve the output directory from `codebase_docs_path` (read in Step 2). Create the directory if it doesn't exist. **Do not delete existing files.**
2. Write the mapper agent output to the resolved directory. If a file already exists, the mapper's merge-updated version replaces it (the mapper was given the existing content as context in Step 3 and has already merged its findings).
3. Display a summary of what was written, noting any items marked as `[Resolved - YYYY-MM-DD]` in CONCERNS.md.

Offer follow-up:
> "Would you like me to:
> - Analyze a specific focus area in more detail
> - Create an improvement plan based on the findings"

</output>
