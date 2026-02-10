---
name: shipyard-executing-plans
description: Use when you have a written implementation plan to execute, either in the current session with builder/reviewer agents or in a separate session with review checkpoints
---

<!-- TOKEN BUDGET: 300 lines / ~900 tokens -->

# Executing Plans

<activation>

## When This Skill Activates

- You have a written implementation plan (from shipyard:shipyard-writing-plans or similar)
- Plan contains independent tasks suitable for agent dispatch or batch execution
- You need structured execution with two-stage review gates

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

</activation>

## Overview

Execute implementation plans by dispatching fresh builder agents per task, with two-stage review after each: spec compliance review first, then code quality review. Can also run as batch execution with human checkpoints.

**Core principle:** Fresh agent per task + two-stage review (spec then quality) = high quality, fast iteration.

```dot
digraph when_to_use {
    "Have implementation plan?" [shape=diamond];
    "Tasks mostly independent?" [shape=diamond];
    "Stay in this session?" [shape=diamond];
    "Agent-driven execution" [shape=box];
    "Batch execution with checkpoints" [shape=box];
    "Manual execution or brainstorm first" [shape=box];

    "Have implementation plan?" -> "Tasks mostly independent?" [label="yes"];
    "Have implementation plan?" -> "Manual execution or brainstorm first" [label="no"];
    "Tasks mostly independent?" -> "Stay in this session?" [label="yes"];
    "Tasks mostly independent?" -> "Manual execution or brainstorm first" [label="no - tightly coupled"];
    "Stay in this session?" -> "Agent-driven execution" [label="yes"];
    "Stay in this session?" -> "Batch execution with checkpoints" [label="no - parallel session"];
}
```

<instructions>

## The Process

### Step 1: Load and Review Plan

1. Read plan file
2. Review critically - identify any questions or concerns about the plan
3. If concerns: Raise them with your human partner before starting
4. If no concerns: Create tasks via TaskCreate and proceed

### Step 2: Execute Tasks

**Agent-Driven Mode (preferred):**

For each task, dispatch a fresh builder agent:

```dot
digraph process {
    rankdir=TB;

    subgraph cluster_per_task {
        label="Per Task";
        "Dispatch builder agent" [shape=box];
        "Builder asks questions?" [shape=diamond];
        "Answer questions, provide context" [shape=box];
        "Builder implements, tests, commits, self-reviews" [shape=box];
        "Dispatch spec reviewer agent" [shape=box];
        "Spec reviewer confirms code matches spec?" [shape=diamond];
        "Builder fixes spec gaps" [shape=box];
        "Dispatch code quality reviewer agent" [shape=box];
        "Code quality reviewer approves?" [shape=diamond];
        "Builder fixes quality issues" [shape=box];
        "Mark task complete" [shape=box];
    }

    "Read plan, extract all tasks, create via TaskCreate" [shape=box];
    "More tasks remain?" [shape=diamond];
    "Dispatch final reviewer for entire implementation" [shape=box];
    "Use shipyard:git-workflow to complete" [shape=box style=filled fillcolor=lightgreen];

    "Read plan, extract all tasks, create via TaskCreate" -> "Dispatch builder agent";
    "Dispatch builder agent" -> "Builder asks questions?";
    "Builder asks questions?" -> "Answer questions, provide context" [label="yes"];
    "Answer questions, provide context" -> "Dispatch builder agent";
    "Builder asks questions?" -> "Builder implements, tests, commits, self-reviews" [label="no"];
    "Builder implements, tests, commits, self-reviews" -> "Dispatch spec reviewer agent";
    "Dispatch spec reviewer agent" -> "Spec reviewer confirms code matches spec?";
    "Spec reviewer confirms code matches spec?" -> "Builder fixes spec gaps" [label="no"];
    "Builder fixes spec gaps" -> "Dispatch spec reviewer agent" [label="re-review"];
    "Spec reviewer confirms code matches spec?" -> "Dispatch code quality reviewer agent" [label="yes"];
    "Dispatch code quality reviewer agent" -> "Code quality reviewer approves?";
    "Code quality reviewer approves?" -> "Builder fixes quality issues" [label="no"];
    "Builder fixes quality issues" -> "Dispatch code quality reviewer agent" [label="re-review"];
    "Code quality reviewer approves?" -> "Mark task complete" [label="yes"];
    "Mark task complete" -> "More tasks remain?";
    "More tasks remain?" -> "Dispatch builder agent" [label="yes"];
    "More tasks remain?" -> "Dispatch final reviewer for entire implementation" [label="no"];
    "Dispatch final reviewer for entire implementation" -> "Dispatch auditor for security review";
    "Dispatch auditor for security review" -> "Critical security findings?" [shape=diamond];
    "Critical security findings?" -> "Builder fixes security issues" [label="yes"];
    "Builder fixes security issues" -> "Dispatch auditor for security review" [label="re-audit"];
    "Critical security findings?" -> "Dispatch simplifier for complexity review" [label="no / user defers"];
    "Dispatch simplifier for complexity review" -> "High priority simplifications?" [shape=diamond];
    "High priority simplifications?" -> "Builder implements simplifications" [label="user chooses fix"];
    "Builder implements simplifications" -> "Dispatch simplifier for complexity review" [label="re-check"];
    "High priority simplifications?" -> "Use shipyard:git-workflow to complete" [label="no / user defers"];
}
```

**Batch Mode (separate session):**

Default: First 3 tasks per batch.

For each task:
1. Mark as in_progress
2. Follow each step exactly (plan has bite-sized steps)
3. Run verifications as specified
4. Mark as completed

When batch complete:
- Show what was implemented
- Show verification output
- Say: "Ready for feedback."

Based on feedback:
- Apply changes if needed
- Execute next batch
- Repeat until complete

### Two-Stage Review Pattern

**Stage 1: Spec Compliance Review**
- Does the code match the plan's specification?
- Are all requirements met?
- Is there anything extra that wasn't requested?
- Are verification criteria satisfied?

**Stage 2: Code Quality Review**
- Is the code well-structured?
- Are there any bugs or edge cases missed?
- Is naming clear and consistent?
- Are tests comprehensive?

**IMPORTANT:** Always complete spec compliance before code quality. Wrong order wastes time reviewing quality of code that doesn't meet spec.

### Step 3: Post-Completion Quality Gates

After the final reviewer approves the entire implementation, run these quality gates:

#### Security Audit

Dispatch an **auditor agent** (subagent_type: "shipyard:auditor") with:
- Git diff of all files changed during plan execution
- All task summaries and context
- Dependency manifests if any dependencies were added/changed
- Working directory, current branch, and worktree status
- Follow **Model Routing Protocol** — resolve model from `model_routing.security_audit` (default: sonnet). See `docs/PROTOCOLS.md` for details.

**If CRITICAL findings exist:**
1. Display the critical findings to the user
2. User decides: **fix now** (dispatch builder with audit feedback) / **defer** (append to ISSUES.md) / **acknowledge and proceed**
3. If fixing, re-run audit after fixes

#### Simplification Review

After the audit, dispatch a **simplifier agent** (subagent_type: "shipyard:simplifier") with:
- Git diff of all files changed during plan execution
- All task summaries
- Working directory, current branch, and worktree status
- Follow **Model Routing Protocol** — resolve model from `model_routing.simplification` (default: sonnet). See `docs/PROTOCOLS.md` for details.

**Present findings with options:**
1. **Implement simplifications** — dispatch builder with simplification plan
2. **Defer** — append to ISSUES.md for future cleanup
3. **Dismiss** — acknowledge and proceed

### Step 4: Complete Development

After quality gates pass:
- Announce: "I'm using the git-workflow skill to complete this work."
- **REQUIRED SUB-SKILL:** Use shipyard:git-workflow
- Follow that skill to verify tests, present options, execute choice

### Teammate Mode

When `SHIPYARD_IS_TEAMMATE=true` (detected automatically via Claude Code Agent Teams):

- **Execute tasks directly** instead of dispatching builder subagents (you ARE the builder)
- **Skip quality gate dispatch** (auditor, simplifier) — the lead agent handles these
- **Write results to task metadata** instead of STATE.json — the lead reads task list for progress
- **Respect TeammateIdle hook** — ensure tests pass before stopping work

In solo mode (`SHIPYARD_IS_TEAMMATE=false`), this section has no effect — standard subagent dispatch applies.

</instructions>

<examples>

## Example: Good vs Bad Execution

<example type="good" title="Proper two-stage review execution">
Task 3: Add retry logic to API client

1. Dispatch builder agent with full task context from plan
2. Builder implements, writes tests, commits, self-reviews
3. Dispatch spec reviewer:
   - "Plan says: retry 3 times with exponential backoff. Code retries 3 times but uses fixed delay."
   - FAIL -- send back to builder
4. Builder fixes to exponential backoff, re-commits
5. Dispatch spec reviewer again:
   - "All spec requirements met." PASS
6. Dispatch code quality reviewer:
   - "Code is clean, tests comprehensive." PASS
7. Mark task complete, move to Task 4
</example>

<example type="bad" title="Skipping review stages">
Task 3: Add retry logic to API client

1. Builder implements and commits
2. "Looks good to me" -- skip spec review, jump to next task
3. Task 5 fails because Task 3 used fixed delay instead of exponential backoff
4. Now must revisit Task 3, causing cascading rework
</example>

</examples>

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker mid-batch (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

<rules>

## Builder Agent Guidelines

Builder agents should:
- Follow TDD naturally (shipyard:shipyard-tdd)
- Ask questions before AND during work if unclear
- Self-review before handing off to reviewers
- Commit after each task

## Red Flags

**Never:**
- Skip reviews (spec compliance OR code quality)
- Proceed with unfixed issues
- Dispatch multiple builder agents in parallel (conflicts)
- Make agent read plan file (provide full text instead)
- Skip scene-setting context (agent needs to understand where task fits)
- Ignore agent questions (answer before letting them proceed)
- Accept "close enough" on spec compliance
- Skip review loops (reviewer found issues = builder fixes = review again)
- Let builder self-review replace actual review (both are needed)
- **Start code quality review before spec compliance is approved** (wrong order)
- Move to next task while either review has open issues

**If builder asks questions:**
- Answer clearly and completely
- Provide additional context if needed
- Don't rush them into implementation

**If reviewer finds issues:**
- Builder (same agent) fixes them
- Reviewer reviews again
- Repeat until approved
- Don't skip the re-review

**If agent fails task:**
- Dispatch fix agent with specific instructions
- Don't try to fix manually (context pollution)

</rules>

## Integration

**Required workflow skills:**
- **shipyard:shipyard-writing-plans** - Creates the plan this skill executes
- **shipyard:git-workflow** - Complete development after all tasks

**Agents should use:**
- **shipyard:shipyard-tdd** - Agents follow TDD for each task

## Remember
- Review plan critically first
- Follow plan steps exactly
- Don't skip verifications
- Reference skills when plan says to
- Between batches: just report and wait
- Stop when blocked, don't guess
