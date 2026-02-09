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
| Plan a phase | `/shipyard:plan` |
| Build from a plan | `/shipyard:build` |
| Quick one-off task | `/shipyard:quick "task"` |
| Review my code | `/shipyard:review` |
| Security check | `/shipyard:audit` |
| Check progress | `/shipyard:status` |
| Change settings | `/shipyard:settings` |
| Ship completed work | `/shipyard:ship` |

## How to Access Skills

**In Claude Code:** Use the `Skill` tool. When you invoke a skill, its content is loaded and presented to you — follow it directly. Never use the Read tool on skill files.

**In other environments:** Check your platform's documentation for how skills are loaded.

## Available Skills

Shipyard provides 16 skills:

| Skill | Purpose |
|-------|---------|
| `shipyard:using-shipyard` | How to find and use skills (this skill) |
| `shipyard:shipyard-tdd` | TDD discipline for all implementation |
| `shipyard:shipyard-debugging` | Root cause investigation before fixes |
| `shipyard:shipyard-verification` | Evidence before completion claims |
| `shipyard:shipyard-brainstorming` | Requirements gathering and design exploration |
| `shipyard:security-audit` | OWASP, secrets, dependencies, IaC security |
| `shipyard:code-simplification` | Duplication, dead code, AI bloat detection |
| `shipyard:infrastructure-validation` | Terraform, Ansible, Docker validation workflows |
| `shipyard:parallel-dispatch` | Concurrent agent dispatch for independent tasks |
| `shipyard:shipyard-writing-plans` | Creating structured implementation plans |
| `shipyard:shipyard-executing-plans` | Executing plans with builder/reviewer agents |
| `shipyard:git-workflow` | Branch creation, commits, worktrees, and completion |
| `shipyard:documentation` | After implementation, before shipping, when docs are incomplete |
| `shipyard:shipyard-writing-skills` | Creating and testing new skills |
| `shipyard:shipyard-testing` | Writing effective, maintainable tests |
| `shipyard:lessons-learned` | Capturing discoveries and reusable patterns |

## Shipyard Commands

| Command | Purpose |
|---------|---------|
| `/shipyard:init` | Configure project preferences and create `.shipyard/` directory |
| `/shipyard:brainstorm` | Explore requirements through interactive dialogue |
| `/shipyard:plan` | Plan a phase of work (creates roadmap if needed) |
| `/shipyard:build` | Execute a plan with builder and reviewer agents |
| `/shipyard:status` | Check progress on current plan execution |
| `/shipyard:resume` | Restore context from a previous session |
| `/shipyard:quick` | Quick single-task execution without full planning |
| `/shipyard:ship` | Finalize work — merge, PR, or preserve |
| `/shipyard:settings` | View or update workflow settings |
| `/shipyard:issues` | View and manage deferred issues across sessions |
| `/shipyard:rollback` | Revert to a previous checkpoint |
| `/shipyard:recover` | Diagnose and recover from interrupted state |
| `/shipyard:worktree` | Manage git worktrees for isolated feature development |
| `/shipyard:review [target]` | On-demand code review — current changes, diff range, or files |
| `/shipyard:audit [scope]` | On-demand security audit — OWASP, secrets, dependencies, IaC |
| `/shipyard:simplify [scope]` | On-demand simplification — duplication, dead code, complexity |
| `/shipyard:document [scope]` | On-demand documentation generation for changes or modules |
| `/shipyard:research <topic>` | On-demand domain/technology research and comparison |
| `/shipyard:verify [criteria]` | On-demand verification — run tests or check acceptance criteria |
| `/shipyard:map [focus]` | On-demand codebase analysis — technology, architecture, quality, concerns |

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
