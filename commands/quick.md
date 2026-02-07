---
description: "Execute a small task with Shipyard guarantees"
disable-model-invocation: true
argument-hint: "[task description]"
---

# /shipyard:quick - Quick Task Execution

You are executing the Shipyard quick task workflow. This is for small, self-contained tasks that don't need the full phase/plan/build cycle but still benefit from structured execution.

<prerequisites>

## Step 1: Validate State

Check if `.shipyard/` exists.

- **If it exists:** Read STATE.json for context. Proceed normally.
- **If it does not exist:** Create a minimal `.shipyard/` setup:
  - Create `.shipyard/STATE.json` and `.shipyard/HISTORY.md` with minimal content
  - Create `.shipyard/quick/` directory
  - This is acceptable for quick tasks -- no full init required.

## Step 2: Capture Task Description

- If a task description was provided as an argument, use it.
- If no argument was provided, ask the user:
  > "What task would you like to execute? Describe it in one or two sentences."

Validate the task is appropriate for quick mode:
- Should be completable in a single focused effort
- Should not require architectural changes
- Should not span multiple files in unrelated areas

If the task seems too large, suggest:
> "This task seems substantial. Consider using `/shipyard:init` and `/shipyard:plan` for better structure. Continue with quick mode anyway? (y/n)"

## Step 3: Generate Sequential Number

Look in `.shipyard/quick/` for existing quick task files. Generate the next sequential number:
- First task: `001`
- Format: zero-padded 3-digit number

## Step 4: Detect Working Directory & Model Routing

Follow **Worktree Protocol** (detect if running in a git worktree; if so, use worktree root for paths and record the branch name; see `docs/PROTOCOLS.md`) -- detect worktree, record working directory and branch.
Follow **Model Routing Protocol** (select the correct model for each agent role using `model_routing` from config; see `docs/PROTOCOLS.md`) -- read `model_routing` from config for agent model selection.

</prerequisites>

<execution>

## Step 5: Quick Plan

Dispatch an **architect agent** (subagent_type: "shipyard:architect") in quick mode with context per **Agent Context Protocol** (pass PROJECT.md, config.json, working directory, branch, and worktree status to all agents; see `docs/PROTOCOLS.md`):
- The task description
- Codebase docs per **Codebase Docs Protocol** (resolve configured codebase docs path and load CONVENTIONS.md, STACK.md, ARCHITECTURE.md, etc.; see `docs/PROTOCOLS.md`)

The architect produces a simplified plan in `.shipyard/quick/QUICK-{NNN}.md`:
```markdown
# Quick Task {NNN}: {title}

**Requested:** {timestamp}
**Description:** {task description}

## Plan
1. {step 1 - what to do and where}
2. {step 2}
3. {step 3 - at most 3 steps}

## Files
- {file}: {action - create/modify}

## Verification
- {how to verify it worked}
```

## Step 6: Execute

Dispatch a **builder agent** (subagent_type: "shipyard:builder") with:
- The quick plan
- Project context
- Working directory, current branch, and worktree status

The builder should:
- Execute each step in the plan
- Verify the acceptance criteria
- Append results to the quick task file:
  ```markdown
  ## Result
  **Status:** {complete|failed}
  **Files Modified:**
  - {file}: {what changed}
  **Notes:** {any relevant information}
  **Completed:** {timestamp}
  ```

## Step 7: Update State

Follow **State Update Protocol** (update `.shipyard/STATE.json` and `.shipyard/HISTORY.md` via state-write.sh; see `docs/PROTOCOLS.md`) -- append to history: `Quick task {NNN}: {title} ({status})`

## Step 8: Commit

Create an atomic git commit:
```
shipyard(quick-{NNN}): {task title}
```

Include both the code changes and the quick task file.

</execution>

<output>

## Step 9: Report

Display the result:
```
Quick Task {NNN}: {title}
Status: {COMPLETE|FAILED}
Files changed: {count}
{list of files}
```

If failed, explain why and suggest options:
- Retry with `/shipyard:quick {refined description}`
- Escalate to full planning with `/shipyard:init`

</output>
