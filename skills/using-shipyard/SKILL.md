---
name: using-shipyard
description: Use when starting any conversation - establishes how to find and use skills, requiring Skill tool invocation before ANY response including clarifying questions
---

<!-- TOKEN BUDGET: 220 lines / ~660 tokens -->

# Using Shipyard

## What is Shipyard?

Shipyard is a structured project execution framework for Claude Code. It works as a plugin that helps you:

- **Plan work in phases** — break large projects into manageable pieces with clear success criteria
- **Build with parallel agents and TDD** — fresh 200k-token context per task, atomic commits, test-driven development
- **Review code quality and security automatically** — two-stage code review, OWASP security audits, complexity analysis
- **Ship with confidence** — verification gates, documentation generation, and delivery workflows

Shipyard works as a Claude Code plugin. Install it once, then use slash commands in any project.

## Getting Started

New to Shipyard? Follow these steps:

1. **`/shipyard:init`** — Set up your project preferences (interaction mode, git strategy, quality gates). Takes ~1 minute.
2. **`/shipyard:brainstorm`** — Explore what you want to build through interactive dialogue. Captures a project definition.
3. **`/shipyard:plan 1`** — Plan your first phase of work. Researches the codebase and decomposes into executable tasks.
4. **`/shipyard:build`** — Execute the plan with parallel builder agents, review gates, and security audits.
5. **`/shipyard:ship`** — Verify, audit, document, and deliver your completed work.

For quick one-off tasks, skip the lifecycle and use `/shipyard:quick 'description'`.

## I Want To...

| Goal | Command |
|------|---------|
| Set up a new project | `/shipyard:init` |
| Explore requirements | `/shipyard:brainstorm` |
| Understand existing code | `/shipyard:map` |
| Plan a phase | `/shipyard:plan [phase] [--skip-research]` |
| Build from a plan | `/shipyard:build [phase] [--plan N] [--light]` |
| Quick one-off task | `/shipyard:quick "task"` |
| Review my code | `/shipyard:review` |
| Security check | `/shipyard:audit` |
| Research technology options | `/shipyard:research "topic"` |
| Find duplication/complexity | `/shipyard:simplify [scope]` |
| Generate documentation | `/shipyard:document [scope]` |
| Run tests and verify | `/shipyard:verify [criteria]` |
| Check progress | `/shipyard:status` |
| Change settings | `/shipyard:settings` |
| Rollback to checkpoint | `/shipyard:rollback` |
| Recover from errors | `/shipyard:recover` |
| Ship completed work | `/shipyard:ship [--phase \| --milestone \| --branch]` |

## How to Access Skills

**In Claude Code:** Use the `Skill` tool. When you invoke a skill, its content is loaded and presented to you — follow it directly. Never use the Read tool on skill files.

**In other environments:** Check your platform's documentation for how skills are loaded.

## Available Skills

Shipyard provides 16 skills. Skills are **behavioral disciplines** — they define HOW to do work, not what to build.

| Skill | What It Actually Does |
|-------|----------------------|
| `shipyard:using-shipyard` | Index of all skills/commands with triggers and activation rules (this skill) |
| `shipyard:shipyard-tdd` | Enforces write-failing-test → watch-fail → implement → watch-pass → refactor cycle. Tests written after code prove nothing. |
| `shipyard:shipyard-debugging` | 4-phase investigation (root cause → pattern analysis → hypothesis test → fix). After 3 failed fixes, stop and question architecture. |
| `shipyard:shipyard-verification` | Blocks "done"/"fixed"/"passing" claims until you run the actual command fresh and read the output. Evidence before assertions. |
| `shipyard:shipyard-brainstorming` | One-question-at-a-time Socratic dialogue to turn vague ideas into validated designs with trade-offs before any code is written. |
| `shipyard:security-audit` | Checks OWASP Top 10, scans for hardcoded secrets, audits dependencies and IaC (Terraform/Ansible/Docker). Critical findings block merge. |
| `shipyard:code-simplification` | Post-implementation review for duplication (3+ occurrences → extract), dead code, over-engineering, and AI bloat patterns. |
| `shipyard:infrastructure-validation` | Tool-chain workflows for Terraform (fmt/validate/plan/lint), Ansible (lint/syntax/dry-run), Docker (hadolint/build/trivy). |
| `shipyard:parallel-dispatch` | Routes 2+ independent tasks to concurrent agents with isolated scope/constraints. Prevents sequential bottleneck. |
| `shipyard:shipyard-writing-plans` | Converts specs into executable tasks with exact file paths, code samples, verification commands, and TDD steps for builder handoff. |
| `shipyard:shipyard-executing-plans` | Runs fresh builder agent per task + two-stage review (spec compliance then code quality) + security audit + simplification gate. |
| `shipyard:git-workflow` | Full branch lifecycle: create worktree → setup → baseline tests → work → verify → 4 completion options (merge/PR/keep/discard). |
| `shipyard:documentation` | Generates code comments, API docs (params/returns/examples), architecture docs, and user guides. Verifies examples actually work. |
| `shipyard:shipyard-writing-skills` | TDD for docs: run scenario WITHOUT skill (RED) → document agent rationalizations → write skill countering them (GREEN) → refine. |
| `shipyard:shipyard-testing` | Enforces behavior-based testing via public APIs: AAA structure, DAMP not DRY, name tests after behavior, prefer state over mocks. |
| `shipyard:lessons-learned` | After phase completion, captures what worked/surprised/failed into `.shipyard/LESSONS.md` and optionally feeds back to CLAUDE.md. |

## Shipyard Commands

Commands are **actions** — they produce artifacts, change state, or trigger workflows.

### Lifecycle Commands (run in order for full projects)

| Command | What It Actually Does |
|---------|----------------------|
| `/shipyard:init` | **Settings only.** Asks ~9 preference questions (interaction mode, git strategy, review depth, quality gates, model routing) and writes `.shipyard/config.json`. No codebase analysis or planning. |
| `/shipyard:brainstorm` | Socratic dialogue exploring goals/constraints → writes `.shipyard/PROJECT.md`. Optionally dispatches architect to generate `ROADMAP.md` with up to 3 revision cycles. |
| `/shipyard:plan [phase] [--skip-research]` | Dispatches researcher → architect → verifier agents to create executable plan files (`PLAN-W.P.md`) with tasks, file paths, verification commands. Produces `RESEARCH.md` and context files. |
| `/shipyard:build [phase] [--plan N] [--light]` | Dispatches builder agent per plan + two-stage review + optional security audit/simplification/docs. Handles retries (up to 2) on critical issues. Produces `SUMMARY` and `REVIEW` files per plan. |
| `/shipyard:ship [--phase \| --milestone \| --branch]` | Pre-ship verification + tests + security audit + docs + lessons learned capture. Then presents 4 delivery options: merge locally, push PR, preserve branch, or discard. Archives artifacts. |

### Session Management

| Command | What It Actually Does |
|---------|----------------------|
| `/shipyard:status` | Reads state files and displays progress dashboard with blockers and next-action suggestion. No side effects. |
| `/shipyard:resume` | Reconstructs context from `STATE.json` + `HISTORY.md` + artifacts to detect interrupted work and route to recovery. |
| `/shipyard:settings` | Interactive menu to view/update `.shipyard/config.json` preferences. Supports `list`, `view <key>`, `set <key> <value>`. |
| `/shipyard:issues` | Manages deferred issues in `.shipyard/ISSUES.md` with severity tracking. Supports `--add`, `--resolve`, `--list`. |
| `/shipyard:rollback` | Reverts to a git checkpoint (state-only or full code+state). Lists recent checkpoints, creates safety checkpoint before reverting. |
| `/shipyard:recover` | Diagnoses state inconsistencies and offers recovery: resume, rollback, rebuild state from artifacts, or full reset. |

### On-Demand Tools (use anytime, no lifecycle required)

| Command | What It Actually Does |
|---------|----------------------|
| `/shipyard:quick "task"` | Dispatches architect (simplified plan) → builder (execute + verify) for small self-contained tasks. Produces `QUICK-NNN.md`. No roadmap needed. |
| `/shipyard:review [target]` | Two-stage code review (spec compliance if plan exists, otherwise quality). Accepts uncommitted changes, diff ranges, file paths, or branch comparisons. |
| `/shipyard:audit [scope]` | OWASP Top 10 + secrets + dependencies + IaC security scan. Critical findings are hard gates. Accepts changes, ranges, directories, or full codebase. |
| `/shipyard:simplify [scope]` | Detects duplication, dead code, unnecessary abstractions, and AI bloat. Non-blocking findings. Accepts changes, ranges, or directories. |
| `/shipyard:document [scope]` | Generates API docs, architecture updates, user guides. Analyzes code vs existing docs to find gaps. Accepts changes, ranges, or directories. |
| `/shipyard:research <topic>` | Dispatches researcher to evaluate technology options via web search + codebase analysis. Produces comparison matrix with recommendations. |
| `/shipyard:verify [criteria]` | Runs acceptance criteria or test suites, records PASS/FAIL with evidence. Accepts test suite, criteria file, phase number, or inline text. |
| `/shipyard:map [focus]` | Deep codebase analysis producing up to 7 docs (STACK, INTEGRATIONS, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, CONCERNS). Supports parallel "all" mode. |
| `/shipyard:worktree` | Git worktree management: `create` (isolated branch + setup + tests), `list`, `switch`, `remove` (with dirty-state safety checks). |
| `/shipyard:move-docs` | Relocates codebase docs between `.shipyard/codebase/` (private) and `docs/codebase/` (public) using `git mv`. |

<activation>

## Skill Activation Protocol

When a trigger condition matches, invoke the corresponding skill before responding.

### File Pattern Triggers
| Pattern | Skill |
|---------|-------|
| `*.tf`, `*.tfvars`, `terraform*` | `shipyard:infrastructure-validation` |
| `Dockerfile`, `docker-compose.yml`, `*.dockerfile` | `shipyard:infrastructure-validation` |
| `playbook*.yml`, `roles/`, `inventory/`, `ansible*` | `shipyard:infrastructure-validation` |
| `*.test.*`, `*.spec.*`, `__tests__/`, `*_test.go` | `shipyard:shipyard-tdd` |

### Task Marker Triggers
| Marker | Skill |
|--------|-------|
| `tdd="true"` in plan task | `shipyard:shipyard-tdd` |
| Plan file loaded for execution | `shipyard:shipyard-executing-plans` |
| Design discussion, feature exploration | `shipyard:shipyard-brainstorming` |
| Creating an implementation plan | `shipyard:shipyard-writing-plans` |

### State Condition Triggers
| Condition | Skill |
|-----------|-------|
| About to claim "done", "complete", "fixed" | `shipyard:shipyard-verification` |
| About to commit, create PR, or merge | `shipyard:shipyard-verification` |
| Bug, error, test failure, unexpected behavior | `shipyard:shipyard-debugging` |
| 2+ independent tasks with no shared state | `shipyard:parallel-dispatch` |
| Creating or editing a skill file | `shipyard:shipyard-writing-skills` |
| Branch management, delivery, worktrees | `shipyard:git-workflow` |
| Starting feature work on a new phase | `shipyard:git-workflow` |
| `SHIPYARD_IS_TEAMMATE=true` in env | `shipyard:shipyard-executing-plans`, `shipyard:shipyard-verification` — follow teammate mode sections |

### Content Pattern Triggers
| Pattern in output or conversation | Skill |
|----------------------------------|-------|
| Error, exception, traceback, failure | `shipyard:shipyard-debugging` |
| Security, vulnerability, CVE, OWASP | `shipyard:security-audit` |
| Duplicate, complex, bloat, refactor | `shipyard:code-simplification` |
| Document, README, API docs, changelog | `shipyard:documentation` |

</activation>

<instructions>

## The Core Rule

Invoke relevant skills BEFORE any response or action. If there is a reasonable chance a skill applies, invoke it to check. If an invoked skill turns out to be wrong for the situation, you don't need to use it.

Before every response, evaluate triggers in this order:
1. **File patterns** — check files being discussed, modified, or created
2. **Task markers** — check any loaded plans or task definitions
3. **State conditions** — check current workflow state and intent
4. **Content patterns** — check recent output and user messages

If any trigger matches, invoke the skill before responding. Multiple triggers can fire simultaneously.

</instructions>

<rules>

## Red Flags

These thoughts indicate a missed skill invocation:

| Thought | What to do |
|---------|------------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "This doesn't need a formal skill" | If a skill exists for it, use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |

## Skill Priority

When multiple skills could apply: **process skills first** (brainstorming, debugging), then **implementation skills** (executing-plans, parallel-dispatch).

## Skill Types

**Rigid** (TDD, debugging, verification): Follow exactly. **Flexible** (patterns): Adapt to context. The skill itself tells you which.

## User Instructions

Instructions say WHAT, not HOW. "Add X" or "Fix Y" doesn't mean skip workflows.

</rules>

<examples>

## Good: Skill invoked before responding

User: "Add a health check endpoint"

Before responding, check triggers:
- Task marker → this is implementation → check for `shipyard:shipyard-tdd` (writing code)
- State condition → starting feature work → check for `shipyard:git-workflow` (branch management)

Result: Invoke `shipyard:shipyard-tdd`, then proceed with implementation using TDD discipline.

## Bad: Skipping skill invocation

User: "Add a health check endpoint"

Immediately start writing code without checking triggers. Miss TDD discipline, skip branch creation, no verification before claiming done.

## Good: Multiple triggers fire

User: "Fix the SQL injection bug in the auth module"

Triggers matched:
1. Content pattern → "bug" → invoke `shipyard:shipyard-debugging` (investigate root cause first)
2. Content pattern → "SQL injection" → invoke `shipyard:security-audit` (check for related vulnerabilities)
3. State condition → will claim "fixed" when done → invoke `shipyard:shipyard-verification` (verify before claiming)

Result: Debug first, audit for related issues, verify the fix works.

</examples>
