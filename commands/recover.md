---
description: "Diagnose and recover from interrupted or corrupted state"
disable-model-invocation: true
argument-hint: ""
---

# /shipyard:recover - State Recovery

You are executing the Shipyard recovery workflow. Follow these steps precisely.

## Step 1: Verify State Exists

Check if `.shipyard/` directory exists.

- **If it does not exist:**
  > "No Shipyard project detected. Nothing to recover. Run `/shipyard:init` to start fresh."
  Stop here.

## Step 2: Diagnose State

Read the following files and check for inconsistencies:

1. **`.shipyard/STATE.md`** — What does the system think is happening?
2. **`.shipyard/ROADMAP.md`** — What phases exist and what are their statuses?
3. **`.shipyard/config.json`** — Are preferences intact?
4. **Phase directories** — What artifacts exist?

### Check for these inconsistencies:

| Symptom | Diagnosis |
|---------|-----------|
| Status says "building" but no SUMMARY.md files exist for current phase | Build was interrupted before any task completed |
| Status says "building" and some SUMMARY.md exist but not all | Build was interrupted mid-phase |
| Status says "planning" but no PLAN.md files exist | Planning was interrupted before architect completed |
| REVIEW.md shows CRITICAL_ISSUES with no subsequent fix commits | Review issues were never addressed |
| STATE.md is missing or empty | State file was corrupted or deleted |
| STATE.md references a phase that doesn't exist in ROADMAP.md | State and roadmap are out of sync |
| SUMMARY.md shows "partial" or "failed" status | Task execution failed |

## Step 3: List Available Checkpoints

Run `git tag -l "shipyard-checkpoint-*" --sort=-version:refname` and identify the most recent checkpoint.

## Step 4: Present Diagnosis

Display a clear diagnosis:

```
Recovery Diagnosis
══════════════════

State: {description of what STATE.md says}
Actual: {description of what artifacts exist}
Problem: {what is inconsistent}
Last checkpoint: {most recent checkpoint tag, or "none"}

Recommended action: {see options below}
```

## Step 5: Present Recovery Options

Based on the diagnosis, present these options (in order of preference):

### Option 1: Resume from current state
> "Continue from where things stopped. Run `/shipyard:resume` to restore context and pick up."

**Best when:** Build was interrupted cleanly, some work was completed and committed.

### Option 2: Rollback to last checkpoint
> "Revert to the last known good state. Run `/shipyard:rollback`."

**Best when:** State is corrupted or inconsistent, but a recent checkpoint exists.

### Option 3: Reset state file
> "Rebuild STATE.md from existing artifacts. This examines what plans, summaries, and reviews exist and reconstructs the state to match reality."

**Best when:** STATE.md is corrupted or out of sync, but the actual artifacts (.shipyard/ plans, summaries) are intact.

If the user selects this option:
1. Scan `.shipyard/phases/` for the latest phase with artifacts
2. Check which plans have SUMMARY.md (completed) vs not (incomplete)
3. Rebuild STATE.md to reflect actual progress:
   ```markdown
   # Shipyard State

   **Last Updated:** <timestamp>
   **Current Phase:** {highest phase with artifacts}
   **Current Position:** {derived from artifacts}
   **Status:** {derived: "planned" if plans exist but no summaries, "building" if some summaries, "complete" if all summaries}

   ## History

   - [<timestamp>] State recovered from artifacts
   ```
4. Commit: `shipyard: recover state from artifacts`

### Option 4: Full reset
> "Archive current state and start fresh. This moves `.shipyard/` to `.shipyard.archived-<timestamp>/` and allows `/shipyard:init` to run again."

**Best when:** State is severely corrupted and no checkpoint is usable.

**Requires explicit confirmation:**
> "This will archive all Shipyard state. Type 'RESET' to confirm."
