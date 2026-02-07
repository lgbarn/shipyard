---
description: "On-demand verification — run tests, check acceptance criteria, validate phase completion"
disable-model-invocation: true
argument-hint: "[criteria] — criteria file, phase number, or run project tests (default)"
---

# /shipyard:verify - On-Demand Verification

You are executing on-demand verification. Follow these steps precisely.

<prerequisites>

## Step 1: Parse Arguments

Extract from the command:
- `criteria` (optional): What to verify. Accepts:
  - **No argument**: Run project test suite and report results
  - **File path** (e.g., `acceptance-criteria.md`): Verify each criterion in the file
  - **Phase number** (e.g., `3`): Verify phase success criteria from ROADMAP.md
  - **Inline criteria** (e.g., `"all API endpoints return JSON"`): Verify specific criteria

## Step 2: Detect Context

1. Check if `.shipyard/` exists (optional — this command works anywhere).
2. If `.shipyard/config.json` exists, read `model_routing.validation` for model selection.
3. Otherwise, use default model: **haiku**.
4. Follow **Worktree Protocol** (see `docs/PROTOCOLS.md`) — detect worktree context.

</prerequisites>

<execution>

## Step 3: Build Agent Context

Assemble context per **Agent Context Protocol** (see `docs/PROTOCOLS.md`):
- The criteria to verify from Step 1
- `.shipyard/PROJECT.md` (if exists)
- `.shipyard/ROADMAP.md` (if phase number provided)
- Test framework configuration (package.json scripts, Makefile targets, etc.)
- Working directory, current branch, and worktree status

## Step 4: Dispatch Verifier

Dispatch a **verifier agent** (subagent_type: "shipyard:verifier") with:
- Follow **Model Routing Protocol** — resolve model from `model_routing.validation` (default: haiku)
- max_turns: 15
- All context from Step 3
- Instruction: For each criterion, identify how to verify it (test command, code inspection, manual check), execute verification, and record PASS or FAIL with concrete evidence

</execution>

<output>

## Step 5: Present Results

Display the verification report to the user.

If failures exist, offer follow-up:
> "Would you like me to:
> - Fix the failing criteria
> - Run a more detailed review (`/shipyard:review`)
> - Check security on the verified code (`/shipyard:audit`)"

</output>
