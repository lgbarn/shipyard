---
name: shipyard-state
description: Use to inspect or manage Shipyard project state under Codex — show status, resume a previous session, cancel/pause in-progress work, or roll back to a checkpoint. Trigger when the user says "shipyard status", "what's the status", "resume", "continue where we left off", "cancel", "pause this", "roll back", or "restore the checkpoint". Codex has no SessionStart hook, so this skill loads state on demand.
---

# Shipyard state (Codex on-demand)

In Claude Code, Shipyard's `SessionStart` hook auto-injects project state at the start of
every session. **Codex has no such hook**, so state is not loaded automatically — you must
read it on demand with the bundled scripts before acting. All state lives under `.shipyard/`
(STATE.json, HISTORY.md, ROADMAP.md, PROJECT.md, config.json).

Always run the read step first; if `.shipyard/STATE.json` is absent, tell the user there is
no Shipyard project here (suggest `shipyard init`) instead of inventing state.

## Status — show the dashboard

```bash
bash scripts/state-read.sh        # prints JSON context (current phase, position, status)
```

Then also read `.shipyard/HISTORY.md` and `ROADMAP.md` for the fuller picture, and present a
clear dashboard: current phase, position, status, and recent history.

## Resume — restore context and continue

```bash
bash scripts/state-read.sh
```

Read STATE.json for the current phase/position/status and HISTORY.md for what happened, then
continue the workflow from there. If no state exists, there is nothing to resume.

## Cancel — graceful pause

Checkpoint first, then mark the work paused so it can be resumed later:

```bash
bash scripts/checkpoint.sh "pre-cancel-$(date +%s)"   # git tag rollback point
bash scripts/state-write.sh --phase <N> --position "<where you stopped>" --status paused
```

Only cancel work that is actually in progress (`building`/`in_progress`/`planning`). If it is
already paused or complete, say so rather than writing redundant state.

## Roll back — restore a checkpoint

Checkpoints are git tags created by `checkpoint.sh`. List them and revert with git:

```bash
git tag -l 'shipyard-*'                # or however the project tags checkpoints
git checkout <checkpoint-tag>          # inspect, or reset per the user's intent
```

This is a destructive git operation — confirm with the user before resetting, and never
force-reset their working tree without explicit instruction.

## Degradation note

Everything here works identically to Claude Code except that state is pulled on demand
instead of auto-injected. The teammate lifecycle hooks (idle/task-completed/stop) do not
exist in Codex — that is expected, not a regression, because Codex runs single-context.
