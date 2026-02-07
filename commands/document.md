---
description: "On-demand documentation generation — API docs, architecture updates, user guides"
disable-model-invocation: true
argument-hint: "[scope] — directory, file pattern, diff range, or current (default: uncommitted changes)"
---

# /shipyard:document - On-Demand Documentation Generation

You are executing on-demand documentation generation. Follow these steps precisely.

<prerequisites>

## Step 1: Parse Arguments

Extract from the command:
- `scope` (optional): What to document. Accepts:
  - **No argument / "current"**: Document uncommitted changes (`git diff` + `git diff --cached`)
  - **Diff range** (e.g., `main..HEAD`): Document all changes in range
  - **Directory path** (e.g., `src/api/`): Document specific module
  - **"." or "all"**: Document all changed files vs main branch

If no scope and no uncommitted changes exist, default to documenting changed files against the main branch.

## Step 2: Detect Context

1. Check if `.shipyard/` exists (optional — this command works anywhere).
2. If `.shipyard/config.json` exists, read `model_routing.documentation` for model selection.
3. Otherwise, use default model: **sonnet**.
4. Follow **Worktree Protocol** (see `docs/PROTOCOLS.md`) — detect worktree context.

</prerequisites>

<execution>

## Step 3: Gather Scope

Based on the scope argument, collect the code to document:
- **Current**: `git diff` + `git diff --cached`
- **Range**: `git diff <range>`
- **Directory**: List and read all source files in directory
- **Full codebase**: `git diff main...HEAD`

Also gather:
- Existing documentation in `docs/` directory (if exists)
- README.md (if exists)
- `.shipyard/PROJECT.md` (if exists)

## Step 4: Build Agent Context

Assemble context per **Agent Context Protocol** (see `docs/PROTOCOLS.md`):
- The diff/file content collected in Step 3
- Existing documentation for update context
- `.shipyard/PROJECT.md` (if exists)
- Working directory, current branch, and worktree status

## Step 5: Dispatch Documenter

Dispatch a **documenter agent** (subagent_type: "shipyard:documenter") with:
- Follow **Model Routing Protocol** — resolve model from `model_routing.documentation` (default: sonnet)
- max_turns: 20
- All context from Step 4
- Instruction: Analyze changes and generate/update documentation — API docs for public interfaces, architecture updates for structural changes, user-facing docs for new features

</execution>

<output>

## Step 6: Present Results

Display the documentation report to the user.

If documentation was generated, offer follow-up:
> "Would you like me to:
> - Write the documentation to `docs/`
> - Review the generated docs for quality
> - Document additional modules or files"

</output>
