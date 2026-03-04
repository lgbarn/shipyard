---
name: shipyard-writing-plans
description: Use when you have a spec, requirements, or design for a multi-step task — before touching code. Also triggers on "plan this", "break this down", "create tasks", "decompose this feature", or when a task clearly needs more than 2-3 steps to implement. If you're about to start building without a plan, this skill applies.
---

<!-- TOKEN BUDGET: 290 lines / ~870 tokens -->

# Writing Plans

<activation>

## When This Skill Activates

- You have a spec, requirements, or design for a multi-step implementation task
- You need to break work into bite-sized, executable tasks before touching code
- You are preparing work for builder agents or a parallel execution session

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**Context:** This should be run in a dedicated worktree (created by brainstorming skill).

**Save plans to:** `docs/plans/YYYY-MM-DD-<feature-name>.md`

## Natural Language Triggers
- "write a plan", "create a plan", "plan this feature", "break this down into tasks"

</activation>

<instructions>

## Overview

Write comprehensive implementation plans assuming the engineer has zero context for our codebase and questionable taste. Document everything they need to know: which files to touch for each task, code, testing, docs they might need to check, how to test it. Give them the whole plan as bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

Assume they are a skilled developer, but know almost nothing about our toolset or problem domain. Assume they don't know good test design very well.

## Shipyard Plan Format

Shipyard plans use XML-structured tasks with verification criteria. Each task includes:

```xml
<task id="1" name="Component Name">
  <description>What this task accomplishes</description>
  <files>
    <create>exact/path/to/file.py</create>
    <modify>exact/path/to/existing.py:123-145</modify>
    <test>tests/exact/path/to/test.py</test>
  </files>
  <steps>
    <step>Write the failing test</step>
    <step>Run test to verify it fails</step>
    <step>Write minimal implementation</step>
    <step>Run test to verify it passes</step>
    <step>Commit</step>
  </steps>
  <verification>
    <command>pytest tests/path/test.py::test_name -v</command>
    <expected>PASS</expected>
  </verification>
</task>
```

This structured format enables `/shipyard:build` to parse and execute tasks systematically, and `/shipyard:status` to track progress.

## Task Granularity Guide

| Size | Example | Action |
|------|---------|--------|
| **Too big** | "Implement authentication system" | Split — no single commit for a whole system |
| **Right size** | "Add JWT token validation middleware" | Keep — one TDD cycle, one commit |
| **Too small** | "Add import statement" | Merge with its parent task |

**Target:** Each task = one TDD cycle (write test → fail → implement → pass → commit). If a task needs more than one commit, split it.

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**
- "Write the failing test" - step
- "Run it to make sure it fails" - step
- "Implement the minimal code to make the test pass" - step
- "Run the tests and make sure they pass" - step
- "Commit" - step

## Coupling Detection

Before ordering tasks, check for dependencies. Tasks that must share state or touch the same file need sequencing:

| Dependency Type | Example | Resolution |
|----------------|---------|------------|
| Same file | Tasks A and B both modify `auth.py` | Sequence them; never parallelize |
| Import dependency | Task B imports what Task A creates | B blocks on A |
| Interface contract | Task B depends on Task A's return type | Define interface in Task A, implement in B |
| Shared utility | Both tasks call a helper that doesn't exist yet | Create helper as Task 0 |

**Red flag:** Two tasks listed as parallelizable that both modify the same file — this will produce merge conflicts.

## Mid-Phase Adaptation

When reality diverges from the plan during execution:

- **Minor divergence** (file path changed, one extra step) — adapt in place, note in SUMMARY.md
- **Major divergence** (wrong architecture, missing component) — pause, update plan, re-approve before continuing
- **Blocker** (dependency missing, API changed) — stop, document in SUMMARY.md as blocker, escalate

Do not silently adapt major changes. The plan is a contract; changes need acknowledgment.

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [Feature Name] Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use shipyard:shipyard-executing-plans to implement this plan task-by-task.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

---
```

## Task Structure

```markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

**Step 1: Write the failing test**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

**Step 3: Write minimal implementation**

```python
def function(input):
    return expected
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```
```

</instructions>

<examples>

## Example: Well-Written vs Poorly-Written Plan Task

<example type="good" title="Clear, executable task with exact paths and code">
### Task 2: Add Email Validation

**Files:**
- Create: `src/validators/email.py`
- Test: `tests/validators/test_email.py`

**Step 1: Write the failing test**
```python
def test_rejects_empty_email():
    with pytest.raises(ValidationError, match="email is required"):
        validate_email("")
```

**Step 2: Run test to verify it fails**
Run: `pytest tests/validators/test_email.py::test_rejects_empty_email -v`
Expected: FAIL with "cannot import name 'validate_email'"

**Step 3: Write minimal implementation**
```python
from src.errors import ValidationError

def validate_email(email: str) -> str:
    if not email or not email.strip():
        raise ValidationError("email is required")
    return email.strip()
```

**Step 4: Run test to verify it passes**
Run: `pytest tests/validators/test_email.py::test_rejects_empty_email -v`
Expected: PASS

**Step 5: Commit**
```bash
git add src/validators/email.py tests/validators/test_email.py
git commit -m "feat: add email validation with empty check"
```
</example>

<example type="bad" title="Vague task that leaves builder guessing">
### Task 2: Add Validation

Add email validation to the project. Make sure it handles edge cases. Write tests.
</example>

The good example provides exact file paths, complete code, exact commands with expected output, and a single commit per TDD cycle. The bad example forces the builder to guess paths, invent code, and figure out what "edge cases" means.

</examples>

<rules>

## Remember
- Exact file paths always
- Complete code in plan (not "add validation")
- Exact commands with expected output
- Reference relevant skills with @ syntax
- DRY, YAGNI, TDD, frequent commits

## Red Flags

A plan is not ready to ship if any task:
- Has no file path (builder must guess where to put the code)
- Has no verification command (builder cannot confirm it worked)
- Touches the same file as an adjacent task (guaranteed conflict)
- Would take more than 20 minutes (too big — split it)
- Mentions "implement feature X" without TDD steps (builder will skip tests)

## AI-Awareness: Common Plan Quality Failures

AI writers produce plans with predictable failure modes:

| Failure | Symptom | Fix |
|---------|---------|-----|
| Tightly-coupled tasks | Two tasks listed as parallel both modify same file | Add dependency, sequence them |
| Vague verification | `<expected>success</expected>` | Specify exact output or exit code |
| Missing file paths | "Add auth middleware" without path | Read codebase, provide exact path |
| Over-scoped tasks | Single task covers auth + session + logging | Split into one concern per task |
| Missing TDD steps | Steps go straight to implementation | Add write-test, run-test, implement, verify |

## Rationalization Prevention

| Excuse | Reality |
|--------|---------|
| "The path is obvious" | Builders hallucinate paths when not given them. Provide exact paths. |
| "I'll flesh out the test later" | "Later" = never in execution pressure. Write test code in the plan. |
| "These tasks are independent enough" | If they touch the same file, they are coupled. No exceptions. |
| "The verification step is implied" | Implied verification is skipped verification. Write the command. |
| "The task is simple, no need to split" | Simple tasks that take >20 min are not simple. Split them. |

</rules>

## Execution Handoff

After saving the plan, offer execution choice:

**"Plan complete and saved to `docs/plans/<filename>.md`. Two execution options:**

**1. Agent-Driven (this session)** - I dispatch fresh builder agent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?"**

**If Agent-Driven chosen:**
- **REQUIRED SUB-SKILL:** Use shipyard:shipyard-executing-plans
- Stay in this session
- Fresh builder agent per task + two-stage review (spec compliance then code quality)

**If Parallel Session chosen:**
- Guide them to open new session in worktree
- **REQUIRED SUB-SKILL:** New session uses shipyard:shipyard-executing-plans

## Integration

**Called by:** shipyard:shipyard-brainstorming — after requirements are gathered, planning begins
**Pairs with:** shipyard:shipyard-tdd — TDD steps are embedded in every task
**Leads to:** shipyard:shipyard-executing-plans — plan is handed off for execution
