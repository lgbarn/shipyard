---
description: "Restore context from a previous session and continue"
disable-model-invocation: true
argument-hint: ""
---

# /shipyard:resume - Session Restoration

You are executing the Shipyard resume workflow. Follow these steps precisely.

<prerequisites>

## Step 1: Verify State Exists

Check if `.shipyard/` directory exists.

- **If it does not exist:**
  Display:
  > "No Shipyard project found. Nothing to resume. Run `/shipyard:init` to start a new project."
  Stop here.

## Step 2: Read Last Position

Follow **State Loading Protocol** (read STATE.json, HISTORY.md, ROADMAP.md, PROJECT.md, config.json, and recent SUMMARY/VERIFICATION files to establish session context; see `docs/PROTOCOLS.md`) -- read STATE.json for current phase, position, status, and HISTORY.md for history.

</prerequisites>

<execution>

## Step 3: Detect Incomplete Work

Scan the current phase directory `.shipyard/phases/{N}/` for signs of incomplete work:

**Planning was interrupted if:**
- RESEARCH.md exists but no plan files
- Some plans exist but verifier hasn't run

**Building was interrupted if:**
- Plan files exist without corresponding SUMMARY.md files in `results/`
- SUMMARY.md exists with status `partial` or `failed`
- REVIEW.md shows `CRITICAL_ISSUES` without a subsequent fix

**Shipping was interrupted if:**
- VERIFICATION.md exists but STATE.json doesn't show "shipped"

Document what was in progress and what remains.

## Step 4: Reconstruct Context

Build a context summary by reading (in order):
1. `.shipyard/PROJECT.md` -- overall project goals
2. `.shipyard/ROADMAP.md` -- phase overview and progress
3. `.shipyard/config.json` -- workflow preferences
4. The most recent phase's plans and results
5. The last 2-3 SUMMARY.md files for recent decisions and context
6. Any REVIEW.md files with unresolved issues

Synthesize this into a brief context restoration message:
```
## Session Restored

**Project:** {name}
**Current Phase:** {N} - {title}
**Last Action:** {description from HISTORY.md}
**Incomplete Work:**
- {list of what was in progress}

**Key Context:**
- {2-3 most important decisions or facts from recent summaries}
```

## Step 5: Recreate Native Tasks

Follow **Native Task Scaffolding Protocol** (create/update native tasks for progress tracking via TaskCreate/TaskUpdate; see `docs/PROTOCOLS.md`) -- check if native tasks exist (via TaskList), and recreate from ROADMAP.md and artifact existence if missing or stale.

## Step 6: Display Status Overview

Run the same display logic as `/shipyard:status` (Step 4 from status.md):
- Show the progress visualization
- Show current position
- Show recent activity
- Show blockers

</execution>

<output>

## Step 7: Route to Next Action

Based on where work was interrupted, suggest the specific next step:

| Interrupted During | Resume Action |
|-------------------|---------------|
| Research | `/shipyard:plan {N}` (will redo research) |
| Plan generation | `/shipyard:plan {N}` (will regenerate plans) |
| Building wave W | `/shipyard:build {N}` (will resume from incomplete plans) |
| Review gate | `/shipyard:build {N}` (will re-review) |
| Verification | `/shipyard:build {N}` (will re-verify) |
| Shipping | `/shipyard:ship` |
| Between phases | `/shipyard:plan {N+1}` or `/shipyard:ship` |

Present clearly:
> "**Session restored.** You were {doing X} when the session ended. Run `{command}` to continue."

</output>
