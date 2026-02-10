---
description: "Show project progress and route to next action"
disable-model-invocation: true
argument-hint: ""
---

# /shipyard:status - Progress Dashboard

You are executing the Shipyard status workflow. Follow these steps precisely.

<prerequisites>

## Step 1: Check State Exists

Check if `.shipyard/` directory exists.

- **If it does not exist:**
  Display:
  > "No Shipyard project detected in this directory. Run `/shipyard:init` to get started."
  Stop here.

## Step 2: Read State Files

Follow **State Loading Protocol** (read STATE.json, HISTORY.md, ROADMAP.md, PROJECT.md, config.json, and recent SUMMARY/VERIFICATION files to establish session context; see `docs/PROTOCOLS.md`).

</prerequisites>

<execution>

## Step 3: Display Native Task Progress

Follow **Native Task Scaffolding Protocol** (create/update native tasks for progress tracking via TaskCreate/TaskUpdate; see `docs/PROTOCOLS.md`) -- call TaskList to show the current state of all Shipyard-created native tasks.

## Step 4: Display Dashboard

Present a comprehensive status display:

### Progress Visualization

Show phase progress in a clear format:
```
Roadmap: {milestone_name}
═══════════════════════════════════════════

Phase 1: {title}                    [COMPLETE]
Phase 2: {title}                    [IN PROGRESS - Building]
  - Plan 2.1: {title}              [COMPLETE]
  - Plan 2.2: {title}              [IN PROGRESS]
  - Plan 2.3: {title}              [NOT STARTED]
Phase 3: {title}                    [NOT STARTED]

Overall: {X}/{Y} phases complete
```

### Current Position

From STATE.json:
- What phase and step we're on
- What was last completed
- When it was last updated

### Recent Activity

From the most recent SUMMARY.md files:
- Last 3-5 completed actions
- Files recently modified
- Key decisions made

### Blockers & Issues

From STATE.json, HISTORY.md, and REVIEW.md files:
- Any unresolved critical issues
- Any blocked tasks
- Any gaps identified

</execution>

<output>

## Step 5: Intelligent Routing

Based on the current state, suggest the most appropriate next action:

| State | Suggestion |
|-------|-----------|
| No `.shipyard/` directory | `/shipyard:init` -- Initialize the project |
| Phase exists but has no plans | `/shipyard:plan {N}` -- Plan the current phase |
| Plans exist but none executed | `/shipyard:build {N}` -- Begin building |
| Build in progress, interrupted | `/shipyard:resume` -- Restore context and continue |
| Phase complete with gaps | `/shipyard:plan {N} --gaps` -- Fill the gaps |
| Phase fully complete, more remain | `/shipyard:plan {N+1}` -- Plan the next phase |
| All phases complete | `/shipyard:ship` -- Finalize and deliver |
| Milestone shipped (status: shipped) | `/shipyard:brainstorm` -- Define goals for the next milestone |
| Critical issues found | Review issues, then `/shipyard:build {N} --plan W.P` to retry specific plans |
| Quick task needed | `/shipyard:quick {description}` -- Execute outside the roadmap |

Present the suggestion clearly:
> "**Recommended next step:** `/shipyard:{command}` -- {reason}"

If multiple actions are reasonable, list them in priority order.

</output>
