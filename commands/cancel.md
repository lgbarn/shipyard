---
description: "Pause in-progress work with a checkpoint"
disable-model-invocation: true
argument-hint: ""
---

# /shipyard:cancel — Graceful Pause

You are executing the Shipyard cancel workflow. This pauses in-progress work and creates a checkpoint for later resumption.

<prerequisites>

## Step 1: Check State Exists

Check if `.shipyard/STATE.json` exists.

- **If it does not exist:**
  Display:
  > "No active Shipyard work to cancel. No `.shipyard/STATE.json` found."
  Stop here.

## Step 2: Read Current State

Follow **State Loading Protocol** — read STATE.json to get current status, phase, and position.

- **If status is NOT `building`, `in_progress`, or `planning`:**
  Display:
  > "No active work in progress. Current status: {status}. Nothing to cancel."
  Stop here.

</prerequisites>

<execution>

## Step 3: Create Checkpoint

Create a git checkpoint so work can be resumed:

```bash
# Create checkpoint tag with current state
git tag "shipyard-checkpoint-$(date +%Y%m%d-%H%M%S)" -m "Shipyard cancel checkpoint: phase {phase}, status {status}"
```

## Step 4: Update State to Paused

Update STATE.json:
- Set `status` to `"paused"`
- Preserve `phase` and `position`

Append to HISTORY.md:
```
- [{timestamp}] Paused: phase {phase}, position {position} (user-initiated cancel)
```

Use `bash scripts/state-write.sh` with appropriate arguments.

## Step 5: Report Pending Work

Scan for any in-progress artifacts:
- Check for uncommitted changes (`git status`)
- Check for unfinished plan tasks (SUMMARY files without completion)
- Check for active worktrees related to current phase

</execution>

<output>

## Step 6: Summary

Display:

```
Shipyard Cancel
═══════════════════════════════════════════

Phase {N} paused at: {position}
Checkpoint: shipyard-checkpoint-{timestamp}
Uncommitted changes: {yes/no}
Pending tasks: {count}

To resume: /shipyard:resume
To rollback: /shipyard:rollback
```

</output>
