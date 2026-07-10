# Proposal: Enhance `/shipyard:quick` with Light Exploration and Review

**Date:** 2026-03-12
**Status:** Draft
**Motivation:** Feature-dev comparison — quick mode skips codebase understanding and quality review

---

## Problem

`/shipyard:quick` currently dispatches two agents: **architect → builder**. This means:

1. **The architect plans blind** — it doesn't know what patterns, utilities, or conventions exist in the codebase. It may propose creating something that already exists or violating established patterns.
2. **The builder's output is never reviewed** — code goes straight to commit. Bugs, convention violations, and missed edge cases ship silently. This undermines the "Shipyard guarantees" promise.

By contrast, `/feature-dev` uses up to 8 agents with deep exploration (2-3 explorers), competing architecture proposals (2-3 architects), and multi-focus review (3 reviewers). That's too heavy for quick mode, but the current approach of *zero* exploration and *zero* review is too light.

## Proposed Change

Add two lightweight steps while keeping quick mode **autonomous** (no new user checkpoints) and **fast** (2 additional agents, not 6).

### Current Flow (4 agents: 0 + 1 + 1 + 0)

```
Steps 1-4: Setup (validate state, capture task, generate number, detect worktree)
Step 5:    Architect plans (blind — no codebase context beyond what it finds itself)
Step 6:    Builder executes
Steps 7-9: Update state, commit, report
```

### Proposed Flow (4 agents: 1 + 1 + 1 + 1)

```
Steps 1-4:  Setup (unchanged)
Step 5 NEW: Light Explorer — single agent scans relevant code
Step 6:     Architect plans (now with explorer findings as context)
Step 7:     Builder executes (unchanged)
Step 8 NEW: Light Reviewer — single agent reviews builder output
Step 9:     Fix cycle (if reviewer found blocking issues, re-dispatch builder once)
Steps 10-12: Update state, commit, report
```

---

## New Step Details

### Step 5: Light Exploration

Dispatch **1** explorer agent (subagent_type to be determined — could use existing `shipyard:researcher` or the feature-dev `code-explorer` pattern).

**Agent instructions:**
- Scan the codebase for files related to the task description
- Identify existing patterns, utilities, and conventions that the task should follow
- Return a concise summary: relevant files, reusable functions, conventions to follow

**Key constraints:**
- Single agent, not 2-3 (speed over thoroughness)
- Narrow scope — only what's relevant to the specific task
- Output is passed to the architect, not shown to the user

**What this prevents:**
- Architect proposing to create a utility that already exists
- Builder using patterns inconsistent with the rest of the codebase
- Duplicate code when a helper is one import away

### Step 6: Architect (Enhanced)

Same as the current Step 5, but the architect now receives:
- The task description (as before)
- Codebase docs (as before)
- **NEW: Explorer findings** — relevant files, patterns, reusable utilities

This produces better plans because the architect knows what already exists.

### Step 8: Light Review

Dispatch **1** reviewer agent after the builder completes.

**Agent instructions:**
- Review the builder's changes for correctness and convention adherence
- Classify issues as **blocking** (bugs, logic errors, security) or **advisory** (style, naming)
- Return a verdict: PASS, PASS_WITH_NOTES, or FAIL with specific issues

**Key constraints:**
- Single agent with combined focus (not 3 separate reviewers)
- No user checkpoint — fully autonomous
- Only **blocking** issues trigger a fix cycle

### Step 9: Fix Cycle (Conditional)

If the reviewer returns FAIL:
- Re-dispatch the builder with the reviewer's findings
- Builder fixes the specific issues identified
- **Max 1 fix cycle** — if the second pass still fails, commit anyway and note the issues in the report

If the reviewer returns PASS or PASS_WITH_NOTES:
- Proceed directly to commit
- Include advisory notes in the quick task file under `## Review Notes`

---

## What Stays the Same

- **No new user checkpoints** — quick mode remains fully autonomous
- **Max 3-step plans** — architect still produces simplified plans
- **Git commit format** — `shipyard(quick-{NNN}): {task title}`
- **State tracking** — same STATE.json and HISTORY.md updates
- **Task size validation** — still suggests `/shipyard:plan` for large tasks
- **Worktree and model routing** — unchanged

## Impact

| Metric | Before | After |
|---|---|---|
| Agents dispatched | 2 | 3-4 (4 only if fix cycle triggers) |
| Codebase awareness | None | Light scan of relevant files |
| Quality gate | None | Single reviewer pass |
| User interaction | Same | Same (no new checkpoints) |
| Estimated overhead | — | ~30-60s additional for explorer + reviewer |

## Open Questions

1. **Which agent type for the explorer?** Options:
   - Reuse `shipyard:researcher` (already exists, but designed for domain research, not code exploration)
   - Create a new `shipyard:explorer` agent (clean but adds maintenance surface)
   - Use the Explore subagent_type built into Claude Code (lightweight, no custom agent needed)

2. **Should the reviewer use `shipyard:reviewer`?** The existing reviewer does two-stage review (spec compliance → code quality). For quick mode, a single combined pass would be faster. Options:
   - Dispatch `shipyard:reviewer` with instructions to do a single lightweight pass
   - Create a `shipyard:quick-reviewer` agent variant

3. **Should `--light` flag skip these new steps?** Currently quick mode doesn't support flags. Adding `--light` (or `--fast`) to skip exploration and review would preserve the original behavior for truly trivial tasks.

## Files to Modify

| File | Change |
|---|---|
| `commands/quick.md` | Add steps 5, 8, 9; renumber existing steps |
| `.claude/agents/` | Possibly add explorer/quick-reviewer agent definitions |
| `docs/QUICKSTART.md` | Update quick mode documentation |
| `docs/AGENT-GUIDE.md` | Document new agent(s) if created |

---

## Comparison: Quick (Enhanced) vs Feature-Dev

| Aspect | Quick (Enhanced) | Feature-Dev |
|---|---|---|
| Exploration | 1 agent, narrow scope | 2-3 agents, deep tracing |
| Architecture | 1 architect with context | 2-3 competing approaches |
| User questions | None | Dedicated clarification phase |
| Implementation | Autonomous builder | User-approved, step-by-step |
| Review | 1 reviewer, auto-fix | 3 reviewers, user decides |
| Git | Atomic commit | No git management |
| Best for | Confident, small changes | Unfamiliar code, design-heavy features |
