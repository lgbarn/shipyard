---
description: "Show project progress and route to next action"
disable-model-invocation: true
argument-hint: ""
---

# /shipyard:status - Progress Dashboard

You are executing the Shipyard status workflow. Follow these steps precisely.

## Step 1: Check State Exists

Check if `.shipyard/` directory exists.

- **If it does not exist:**
  Display:
  > "No Shipyard project detected in this directory. Run `/shipyard:init` to get started."
  Stop here.

## Step 2: Read State Files

Read the following files (skip any that don't exist):
- `.shipyard/STATE.md` -- current position and status
- `.shipyard/ROADMAP.md` -- phases and progress
- `.shipyard/PROJECT.md` -- project overview
- `.shipyard/config.json` -- workflow preferences
- Any recent `SUMMARY.md` files from `.shipyard/phases/`
- Any `VERIFICATION.md` files from `.shipyard/phases/`

## Step 3: Display Native Task Progress

Call TaskList to show the current state of all Shipyard-created native tasks.

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

From STATE.md:
- What phase and step we're on
- What was last completed
- When it was last updated

### Recent Activity

From the most recent SUMMARY.md files:
- Last 3-5 completed actions
- Files recently modified
- Key decisions made

### Blockers & Issues

From STATE.md and REVIEW.md files:
- Any unresolved critical issues
- Any blocked tasks
- Any gaps identified

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
| Critical issues found | Review issues, then `/shipyard:build {N} --plan W.P` to retry specific plans |
| Quick task needed | `/shipyard:quick {description}` -- Execute outside the roadmap |

Present the suggestion clearly:
> "**Recommended next step:** `/shipyard:{command}` -- {reason}"

If multiple actions are reasonable, list them in priority order.
