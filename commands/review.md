---
description: "On-demand code review — review current changes, a diff range, or specific files"
disable-model-invocation: true
argument-hint: "[target] — file, diff range (main..HEAD), or current (default: uncommitted changes)"
---

# /shipyard:review - On-Demand Code Review

You are executing an on-demand code review. Follow these steps precisely.

<prerequisites>

## Step 1: Parse Arguments

Extract from the command:
- `target` (optional): What to review. Accepts:
  - **No argument / "current"**: Review uncommitted changes (`git diff` + `git diff --cached`)
  - **Diff range** (e.g., `main..HEAD`, `abc123..def456`): Review commits in range
  - **File/directory path**: Review current state of specific files
  - **Branch name**: Review branch changes vs main (`main..<branch>`)

If no target and no uncommitted changes exist, ask the user what they want reviewed.

## Step 2: Detect Context

1. Check if `.shipyard/` exists (optional — this command works anywhere).
2. If `.shipyard/config.json` exists, read `model_routing.review` for model selection.
3. Otherwise, use default model: **sonnet**.
4. Follow **Worktree Protocol** (see `docs/PROTOCOLS.md`) — detect worktree context.

</prerequisites>

<execution>

## Step 3: Gather Diff

Based on the target, collect the code to review:
- **Current**: `git diff` + `git diff --cached`
- **Range**: `git diff <range>` + `git log --oneline <range>`
- **Path**: `git diff HEAD -- <path>` (or read files directly if untracked)
- **Branch**: `git diff main...<branch>`

If the diff is empty, inform the user and stop.

## Step 4: Build Agent Context

Assemble context per **Agent Context Protocol** (see `docs/PROTOCOLS.md`):
- The diff content collected in Step 3
- `.shipyard/PROJECT.md` (if exists) — for project understanding
- Codebase docs per **Codebase Docs Protocol** (if `.shipyard/` exists)
- Working directory, current branch, and worktree status
- If a PLAN.md is associated (user mentions a plan), include it for spec compliance review

## Step 5: Dispatch Reviewer

Dispatch a **reviewer agent** (subagent_type: "shipyard:reviewer") with:
- Follow **Model Routing Protocol** — resolve model from `model_routing.review` (default: sonnet)
- max_turns: 15
- All context from Step 4
- Instruction: Perform two-stage review (spec compliance if plan provided, otherwise skip to code quality)

</execution>

<output>

## Step 6: Present Results

Display the review report to the user.

If findings exist, offer follow-up:
> "Would you like me to:
> - Fix the critical/important issues
> - Review additional files or a different scope
> - Run a security audit on the same scope (`/shipyard:audit`)"

</output>
