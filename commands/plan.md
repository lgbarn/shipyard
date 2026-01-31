---
description: "Plan a phase by decomposing it into executable tasks"
disable-model-invocation: true
argument-hint: "[phase-number] [--skip-research]"
---

# /shipyard:plan - Phase Planning

You are executing the Shipyard planning workflow. Follow these steps precisely.

## Step 0: Parse Arguments

- If a phase number is provided, use it.
- If `--skip-research` is provided, skip the research step.
- If `--gaps` is provided, this is a gap-filling re-plan (see note at bottom).
- If no phase number is provided, read `.shipyard/STATE.md` to determine the current phase.

## Step 1: Validate State

1. Verify `.shipyard/` exists. If not, tell the user to run `/shipyard:init` first.
2. Read `.shipyard/ROADMAP.md` and locate the target phase.
3. Read `.shipyard/STATE.md` for current context.
4. If this phase already has plans and is not a `--gaps` run, ask the user if they want to re-plan (existing plans will be archived).

## Step 2: Mark Phase In Progress

Update the native task for this phase to `in_progress` using TaskUpdate.

Update `.shipyard/STATE.md`:
- **Current Phase:** {N}
- **Current Position:** Planning phase {N}
- **Status:** planning

## Step 3: Research (unless --skip-research)

Dispatch a **researcher agent** (subagent_type: "shipyard:researcher") with:
- The phase description from ROADMAP.md
- PROJECT.md for overall context
- Codebase analysis files (if they exist in `.shipyard/codebase/`)
- Any CONCERNS.md content relevant to this phase

The researcher agent should:
- Investigate the existing codebase for relevant code paths
- Identify files that will need modification
- Note any patterns or conventions to follow
- Document external APIs or libraries needed
- Write findings to `.shipyard/phases/{N}/RESEARCH.md`

## Step 4: Architecture & Plan Generation

Dispatch an **architect agent** (subagent_type: "shipyard:architect") with:
- Phase description from ROADMAP.md
- Research findings (if available)
- PROJECT.md
- Codebase analysis
- Previous phase summaries (if any exist in `.shipyard/phases/{N-1}/`)

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

## Step 5: Plan Verification

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

## Step 6: Task Scaffolding

For each plan, create a native task using TaskCreate:
- Title: "Phase {N} / Plan {W}.{P}: {plan_title}"
- Description: Plan summary
- Status: not_started

## Step 7: Update State

Update `.shipyard/STATE.md`:
- **Current Position:** Phase {N} planned, ready for build
- **Status:** planned

## Step 8: Commit

Create a git commit with the planning artifacts:
```
shipyard: plan phase {N}
```

## Step 9: Present Summary & Route Forward

Display a summary showing:
- Number of waves and plans
- Plan titles organized by wave
- Total estimated scope

Suggest:
> "Phase {N} is planned with {X} plans across {Y} waves. Run `/shipyard:build {N}` to begin execution."

---

### Gap-Filling Mode (--gaps)

When `--gaps` is provided:
1. Read existing SUMMARY.md files from the phase to understand what was built
2. Read any GAPS.md or verification notes identifying what is missing
3. The architect agent should produce only the plans needed to fill gaps
4. New plans get wave numbers after existing completed waves
5. Skip re-planning anything already completed
