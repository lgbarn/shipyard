---
description: "Revert to a previous Shipyard checkpoint"
disable-model-invocation: true
argument-hint: "[checkpoint-tag] [--list]"
---

# /shipyard:rollback - Checkpoint Rollback

You are executing the Shipyard rollback workflow. Follow these steps precisely.

<prerequisites>

## Step 1: Verify State

1. Verify `.shipyard/` exists. If not, tell the user there is nothing to roll back.
2. Verify this is a git repository with at least one commit.

## Step 2: List Checkpoints

Run `git tag -l "shipyard-checkpoint-*" --sort=-version:refname` to find all checkpoints.

- **If `--list` was passed**, display checkpoints with dates and labels, then stop.
- **If no checkpoints exist**, inform the user:
  > "No Shipyard checkpoints found. Checkpoints are created automatically during `/shipyard:plan` and `/shipyard:build`."

</prerequisites>

<execution>

## Step 3: Select Checkpoint

- **If a specific checkpoint tag was provided**, use it. Verify it exists with `git tag -l`.
- **If no argument**, show the 5 most recent checkpoints and ask the user to select one:

```
Available Checkpoints
═════════════════════

1. shipyard-checkpoint-post-build-phase-2-20260131T...
2. shipyard-checkpoint-pre-build-phase-2-20260131T...
3. shipyard-checkpoint-post-plan-phase-2-20260130T...
4. shipyard-checkpoint-post-build-phase-1-20260130T...
5. shipyard-checkpoint-pre-build-phase-1-20260130T...

Select a checkpoint (1-5):
```

## Step 4: Choose Rollback Scope

Ask the user:

> "What scope should the rollback cover?"
> 1. **State only** — Revert `.shipyard/` files only (plans, state, roadmap). Code stays as-is.
> 2. **Full rollback** — Revert both `.shipyard/` state AND code changes back to the checkpoint.

## Step 5: Create Safety Checkpoint

Before any rollback, create a safety checkpoint:

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/checkpoint.sh "pre-rollback"
```

This ensures the current state can be recovered if the rollback was a mistake.

## Step 6: Execute Rollback

### State-only rollback:

```bash
git checkout <checkpoint-tag> -- .shipyard/
```

This restores all `.shipyard/` files to their state at the checkpoint without affecting code.

### Full rollback:

Identify all commits between the checkpoint and HEAD:

```bash
git log --oneline <checkpoint-tag>..HEAD
```

Show the user what will be reverted. Then:

```bash
git revert --no-commit <checkpoint-tag>..HEAD
git commit -m "shipyard: rollback to <checkpoint-tag>"
```

## Step 7: Update State

Add a history entry to `.shipyard/HISTORY.md`:

```
- [<timestamp>] Rolled back to <checkpoint-tag> (<scope>)
```

</execution>

<output>

## Step 8: Confirm

Display:
> "Rollback complete. Reverted to `<checkpoint-tag>` (<scope> scope)."
> "Safety checkpoint created: `shipyard-checkpoint-pre-rollback-<timestamp>`"
> "Run `/shipyard:status` to see current state."

</output>
