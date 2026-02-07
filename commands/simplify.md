---
description: "On-demand simplification review — detect duplication, dead code, unnecessary complexity, AI bloat"
disable-model-invocation: true
argument-hint: "[scope] — directory, file pattern, diff range, or current (default: uncommitted changes)"
---

# /shipyard:simplify - On-Demand Simplification Review

You are executing an on-demand simplification review. Follow these steps precisely.

<prerequisites>

## Step 1: Parse Arguments

Extract from the command:
- `scope` (optional): What to analyze. Accepts:
  - **No argument / "current"**: Analyze uncommitted changes (`git diff` + `git diff --cached`)
  - **Diff range** (e.g., `main..HEAD`): Analyze commits in range
  - **Directory path** (e.g., `src/`): Analyze all files in directory
  - **"." or "all"**: Analyze all changed files vs main branch

If no scope and no uncommitted changes exist, default to analyzing changed files against the main branch.

## Step 2: Detect Context

1. Check if `.shipyard/` exists (optional — this command works anywhere).
2. If `.shipyard/config.json` exists, read `model_routing.simplification` for model selection.
3. Otherwise, use default model: **sonnet**.
4. Follow **Worktree Protocol** (see `docs/PROTOCOLS.md`) — detect worktree context.

</prerequisites>

<execution>

## Step 3: Gather Scope

Based on the scope argument, collect the code to analyze:
- **Current**: `git diff` + `git diff --cached`
- **Range**: `git diff <range>`
- **Directory**: List and read all source files in directory
- **Full codebase**: `git diff main...HEAD`

## Step 4: Build Agent Context

Assemble context per **Agent Context Protocol** (see `docs/PROTOCOLS.md`):
- The diff/file content collected in Step 3
- `.shipyard/PROJECT.md` (if exists)
- Codebase docs per **Codebase Docs Protocol** (if `.shipyard/` exists)
- Working directory, current branch, and worktree status

## Step 5: Dispatch Simplifier

Dispatch a **simplifier agent** (subagent_type: "shipyard:simplifier") with:
- Follow **Model Routing Protocol** — resolve model from `model_routing.simplification` (default: sonnet)
- max_turns: 10
- All context from Step 4
- Instruction: Review for cross-file duplication, unnecessary abstractions, dead code, complexity hotspots, and AI-generated bloat patterns

</execution>

<output>

## Step 6: Present Results

Display the simplification report to the user.

If findings exist, offer follow-up:
> "Would you like me to:
> - Implement the high-priority simplifications
> - Run a code review on the same scope (`/shipyard:review`)
> - Defer findings to issues (`/shipyard:issues --add`)"

</output>
