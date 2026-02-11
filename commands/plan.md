---
description: "Plan a phase of work (creates roadmap if needed)"
disable-model-invocation: true
argument-hint: "[phase-number] [--skip-research] [--no-discuss]"
---

# /shipyard:plan - Phase Planning

You are executing the Shipyard planning workflow. Follow these steps precisely.

<prerequisites>

## Step 1: Parse Arguments

- If a phase number is provided, use it.
- If `--skip-research` is provided, skip the research step.
- If `--no-discuss` is provided, skip the discussion capture step.
- If `--gaps` is provided, this is a gap-filling re-plan (see note at bottom).
- If no phase number is provided, read `.shipyard/STATE.json` to determine the current phase.

## Step 1.5: Ensure ROADMAP.md Exists

Check if `.shipyard/ROADMAP.md` exists.

- **If it exists:** Proceed to Step 2.

- **If `.shipyard/PROJECT.md` exists but no ROADMAP.md:** Tell the user a roadmap is needed before planning. Dispatch an **architect agent** (subagent_type: `"shipyard:architect"`) with the full PROJECT.md content to generate `.shipyard/ROADMAP.md`. Present the roadmap to the user for approval. Allow up to **3 revision cycles** where the user can request changes. After approval (or 3 rounds), finalize and proceed to Step 2.

- **If neither PROJECT.md nor ROADMAP.md exists:** Use `AskUserQuestion` to ask: "No project definition or roadmap found. What would you like to do?"
  - `Run brainstorming first (Recommended)` — Tell the user: "Run `/shipyard:brainstorm` to explore requirements and capture a project definition first." Then stop.
  - `Create a minimal roadmap` — Ask the user for a brief description of what they want to build. Dispatch an **architect agent** (subagent_type: `"shipyard:architect"`) with that description to generate `.shipyard/ROADMAP.md`. Present for approval with up to **3 revision cycles**. After approval, proceed to Step 2.
  - `Cancel` — Stop.

## Step 2: Validate State

1. Verify `.shipyard/` exists. If not, tell the user to run `/shipyard:init` first.
2. Read `.shipyard/ROADMAP.md` and locate the target phase.
3. Read `.shipyard/STATE.json` for current context.
4. If this phase already has plans and is not a `--gaps` run, ask the user if they want to re-plan (existing plans will be archived).

## Step 2a: Load Model Routing

Follow **Model Routing Protocol** (select the correct model for each agent role using `model_routing` from config; see `docs/PROTOCOLS.md`) -- read `model_routing` from config for researcher, architect, and verifier model selection.

## Step 2b: Discussion Capture (unless --no-discuss or --gaps)

Follow **Discussion Capture Protocol** (ask targeted questions about ambiguous requirements and design choices, then write decisions to CONTEXT-{N}.md; see `docs/PROTOCOLS.md`).

If `.shipyard/phases/{N}/CONTEXT-{N}.md` already exists, ask the user if they want to redo it or keep the existing decisions.

1. Read the target phase description from ROADMAP.md
2. Present the phase scope to the user
3. Identify gray areas: ambiguous requirements, design choices, or approach decisions
4. Ask targeted questions one at a time using AskUserQuestion (multiple choice preferred)
5. Write user decisions to `.shipyard/phases/{N}/CONTEXT-{N}.md`

This ensures downstream agents (researcher, architect, builder) work from shared understanding rather than making assumptions.

## Step 2c: Team or Agent Dispatch

**Detection:** Check the `SHIPYARD_TEAMS_ENABLED` environment variable (exported by `scripts/team-detect.sh`). This variable is set to `true` when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.

**Prompt (conditional):** If `SHIPYARD_TEAMS_ENABLED=true`, use `AskUserQuestion` with exactly two options:
- "Team mode (parallel teammates)" — uses TeamCreate/TaskCreate/SendMessage/TeamDelete lifecycle
- "Agent mode (subagents)" — uses standard Task dispatch (current behavior)

Question text: "Teams available. Use team mode (parallel teammates) or agent mode (subagents)?"

**Silent fallback:** If `SHIPYARD_TEAMS_ENABLED` is `false` or unset, silently set `dispatch_mode` to `agent` with no prompt (zero overhead).

**Variable storage:** Store the result as `dispatch_mode` (value: `team` or `agent`). This variable is referenced by all subsequent dispatch steps.

**Recommendation:** For the plan command, agent mode is preferred. The sequential workflow (research → architect → verify) has no parallelism benefit from team mode. All dispatch steps below use Task dispatch regardless of `dispatch_mode`. The dispatch section is included for consistency with other Shipyard commands.

</prerequisites>

<execution>

## Step 3: Mark Phase In Progress

Follow **Native Task Scaffolding Protocol** (create/update native tasks for progress tracking via TaskCreate/TaskUpdate; see `docs/PROTOCOLS.md`) -- update the native task for this phase to `in_progress`.

Follow **State Update Protocol** (update `.shipyard/STATE.json` and `.shipyard/HISTORY.md` via state-write.sh; see `docs/PROTOCOLS.md`) -- set:
- **Phase:** {N}
- **Position:** Planning phase {N}
- **Status:** planning

## Step 4: Research (unless --skip-research)

**Dispatch:** Always uses Task dispatch (single-agent step — team overhead not justified). This applies regardless of `dispatch_mode`.

Follow **Agent Context Protocol** (pass PROJECT.md, config.json, working directory, branch, and worktree status to all agents; see `docs/PROTOCOLS.md`) for standard context. Dispatch a **researcher agent** (subagent_type: "shipyard:researcher") with:
- The phase description from ROADMAP.md
- Essential and conditional context per **Agent Context Protocol**
- Codebase docs per **Codebase Docs Protocol** (resolve configured codebase docs path and load CONVENTIONS.md, STACK.md, ARCHITECTURE.md, etc.; see `docs/PROTOCOLS.md`)
- `.shipyard/phases/{N}/CONTEXT-{N}.md` (if exists) -- user decisions to focus research

The researcher agent should:
- Investigate the existing codebase for relevant code paths
- Identify files that will need modification
- Note any patterns or conventions to follow
- Document external APIs or libraries needed
- Write findings to `.shipyard/phases/{N}/RESEARCH.md`

## Step 5: Architecture & Plan Generation

**Dispatch:** Always uses Task dispatch (single-agent step — team overhead not justified). This applies regardless of `dispatch_mode`.

Dispatch an **architect agent** (subagent_type: "shipyard:architect") with context per **Agent Context Protocol** (pass PROJECT.md, config.json, working directory, branch, and worktree status to all agents; see `docs/PROTOCOLS.md`):
- Phase description from ROADMAP.md
- Research findings (RESEARCH.md, if available)
- `.shipyard/phases/{N}/CONTEXT-{N}.md` (if exists) -- user decisions to guide planning
- Previous phase summaries (if any exist in `.shipyard/phases/{N-1}/`)

If `.shipyard/ISSUES.md` exists, also pass it to the architect agent. Open issues relevant to this phase should be considered during planning — they may warrant inclusion as tasks or inform design decisions.

The architect agent must produce plan files in `.shipyard/phases/{N}/plans/`:

**Plan structure rules:**
- Each plan file is named `PLAN-{W}.{P}.md` where W=wave number, P=plan number within wave
- Plans within the same wave CAN execute in parallel (no dependencies on each other)
- Plans in wave W+1 depend on all plans in wave W completing
- Each plan contains **at most 3 tasks**
- Each task is atomic and testable

**Plan file format:**
```markdown
# Plan {W}.{P}: {title}

## Context
{What this plan accomplishes and why}

## Dependencies
{List any plans this depends on -- must be from earlier waves}

## Tasks

### Task 1: {title}
**Files:** {list of files to create or modify}
**Action:** {create|modify|refactor|test}
**Description:** {detailed instructions}
**Acceptance Criteria:**
- {criterion 1}
- {criterion 2}

### Task 2: {title}
...

## Verification
{How to verify this plan was executed correctly}
```

## Step 6: Plan Verification

**Dispatch:** Always uses Task dispatch (single-agent step — team overhead not justified). This applies regardless of `dispatch_mode`.

Dispatch a **verifier agent** (subagent_type: "shipyard:verifier") with:
- All generated plans
- Phase requirements from ROADMAP.md
- PROJECT.md requirements

The verifier must check:
- All phase requirements are covered by at least one plan
- No plan exceeds 3 tasks
- Wave ordering respects dependencies
- File modifications don't conflict between parallel plans
- Acceptance criteria are testable

If issues are found, feed them back to the architect agent for one revision cycle.

## Step 7: Task Scaffolding

Follow **Native Task Scaffolding Protocol** (create/update native tasks for progress tracking via TaskCreate/TaskUpdate; see `docs/PROTOCOLS.md`) -- create a native task for each plan.

## Step 8: Update State

Follow **State Update Protocol** (update `.shipyard/STATE.json` and `.shipyard/HISTORY.md` via state-write.sh; see `docs/PROTOCOLS.md`) -- set:
- **Position:** Phase {N} planned, ready for build
- **Status:** planned

</execution>

<output>

## Step 9: Commit

Create a git commit with the planning artifacts:
```
shipyard: plan phase {N}
```

## Step 9a: Create Checkpoint

Follow **Checkpoint Protocol** (create a named git tag for rollback safety at key pipeline stages; see `docs/PROTOCOLS.md`) -- create `post-plan-phase-{N}` checkpoint.

## Step 10: Present Summary & Route Forward

Display a summary showing:
- Number of waves and plans
- Plan titles organized by wave
- Total estimated scope

Suggest:
> "Phase {N} is planned with {X} plans across {Y} waves. Run `/shipyard:build {N}` to begin execution."

If not already in a worktree and the phase involves code changes, also suggest:
> "Tip: Run `/shipyard:worktree create phase-{N}-{name}` to work in an isolated worktree before building."

</output>

---

### Gap-Filling Mode (--gaps)

When `--gaps` is provided:
1. Read existing SUMMARY.md files from the phase to understand what was built
2. Read any GAPS.md or verification notes identifying what is missing
3. The architect agent should produce only the plans needed to fill gaps
4. New plans get wave numbers after existing completed waves
5. Skip re-planning anything already completed
