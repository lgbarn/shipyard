---
description: "Investigate bugs and failures with systematic root-cause analysis"
disable-model-invocation: true
argument-hint: "<error description or test name>"
---

# /shipyard:debug - Root Cause Analysis

You are executing the Shipyard debugging workflow. This dispatches a dedicated debugger agent for systematic root-cause investigation.

<prerequisites>

## Step 1: Parse Arguments

- If an error description is provided, use it as the problem statement.
- If no argument is provided, ask the user:
  > "What issue are you investigating? Provide the error message, failing test, or describe the unexpected behavior."

## Step 2: Gather Context

1. Read `.shipyard/STATE.json` if it exists (for current phase context)
2. Read `.shipyard/config.json` for model routing
3. Follow **Worktree Protocol** (detect if running in a git worktree; if so, use worktree root for paths and record the branch name; see `docs/PROTOCOLS.md`)
4. Follow **Model Routing Protocol** (select the correct model for the debugger role using `model_routing.debugging` from config; see `docs/PROTOCOLS.md`)

</prerequisites>

<execution>

## Step 3: Dispatch Debugger

Dispatch a **debugger agent** (subagent_type: "shipyard:debugger") following the **Model Routing Protocol** with:
- The problem statement (error description, test name, or unexpected behavior)
- Working directory, current branch, and worktree status
- Codebase docs per **Codebase Docs Protocol** (resolve configured codebase docs path and load CONVENTIONS.md, STACK.md, ARCHITECTURE.md, etc.; see `docs/PROTOCOLS.md`)
- `.shipyard/PROJECT.md` if it exists
- Recent git log (`git log --oneline -20`)
- Any error output or stack traces the user provided

The debugger agent performs:
1. Root cause investigation (reproduce, trace, gather evidence)
2. Pattern analysis (compare working vs broken code)
3. Hypothesis testing (minimal changes, one variable at a time)
4. Remediation plan (documented steps for the builder)

## Step 4: Present Results

Read the debugger's ROOT-CAUSE.md output and present to the user:
- Root cause summary
- Evidence chain
- Remediation plan

</execution>

<output>

## Step 5: Route Forward

Offer the user options based on the diagnosis:

- **Fix now:** "Run `/shipyard:quick {remediation summary}` to implement the fix."
- **Plan a fix:** "Run `/shipyard:plan` to plan a structured fix if the issue spans multiple files."
- **Manual fix:** "The remediation plan is in ROOT-CAUSE.md. Fix it yourself and run the verification command to confirm."

If in an active phase build:
- **Re-dispatch builder:** "This issue was found during Phase {N} build. Re-dispatch the builder with the diagnosis to fix and continue."

</output>
