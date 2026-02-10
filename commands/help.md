---
description: "Show help for Shipyard commands and skills"
disable-model-invocation: true
argument-hint: "[topic]"
---

# /shipyard:help - Quick Reference & Help

You are executing the Shipyard help command. Follow these steps precisely.

<execution>

## Step 1: Check for Topic Argument

If a topic argument was provided (e.g., `/shipyard:help build`), skip to Step 3.

If no argument was provided, show the default quick-reference table (Step 2).

## Step 2: Default — "I Want To..." Quick Reference

Display this table:

```
Shipyard Quick Reference
═══════════════════════════════════════════

I Want To...                        Command
─────────────────────────────────────────────
Set up a new project                /shipyard:init
Explore requirements                /shipyard:brainstorm
Understand existing code            /shipyard:map
Plan a phase                        /shipyard:plan [phase]
Build from a plan                   /shipyard:build [phase]
Quick one-off task                  /shipyard:quick "task"
Review my code                      /shipyard:review
Security check                      /shipyard:audit
Research technology options          /shipyard:research "topic"
Find duplication/complexity          /shipyard:simplify [scope]
Generate documentation               /shipyard:document [scope]
Run tests and verify                /shipyard:verify [criteria]
Check progress                      /shipyard:status
Change settings                     /shipyard:settings
Rollback to checkpoint              /shipyard:rollback
Recover from errors                 /shipyard:recover
Ship completed work                 /shipyard:ship

Aliases: /shipyard:s (status), /shipyard:b (build),
         /shipyard:p (plan), /shipyard:q (quick)
```

Then display:

> "For detailed help on a specific command or skill, run `/shipyard:help <topic>`."
> "Example: `/shipyard:help build` or `/shipyard:help tdd`"

Stop here.

## Step 3: Topic-Specific Help

Match the topic argument to a command or skill:

### Command Topics

| Topic | Maps To |
|-------|---------|
| `init` | `/shipyard:init` — Set up project preferences (interaction mode, git strategy, quality gates) |
| `brainstorm` | `/shipyard:brainstorm` — Socratic dialogue exploring goals/constraints, produces PROJECT.md |
| `plan` | `/shipyard:plan [phase]` — Research + architect + verify agents create executable plans |
| `build` | `/shipyard:build [phase]` — Builder agents per plan + two-stage review + security audit |
| `ship` | `/shipyard:ship` — Verification + tests + audit + docs + delivery options |
| `status`, `s` | `/shipyard:status` — Progress dashboard with next-action routing |
| `resume` | `/shipyard:resume` — Reconstruct context and resume interrupted work |
| `settings` | `/shipyard:settings` — View/update config preferences |
| `quick`, `q` | `/shipyard:quick "task"` — Architect + builder for small tasks |
| `review` | `/shipyard:review` — Two-stage code review (spec + quality) |
| `audit` | `/shipyard:audit` — OWASP + secrets + dependencies + IaC security |
| `simplify` | `/shipyard:simplify` — Detect duplication, dead code, over-engineering |
| `document` | `/shipyard:document` — Generate API docs, architecture, user guides |
| `research` | `/shipyard:research "topic"` — Evaluate technology options |
| `verify` | `/shipyard:verify` — Run acceptance criteria, record evidence |
| `map` | `/shipyard:map` — Deep codebase analysis (up to 7 docs) |
| `issues` | `/shipyard:issues` — Manage deferred issues with severity tracking |
| `rollback` | `/shipyard:rollback` — Revert to a git checkpoint |
| `recover` | `/shipyard:recover` — Diagnose and fix state inconsistencies |
| `worktree` | `/shipyard:worktree` — Git worktree management |
| `doctor` | `/shipyard:doctor` — Check plugin health and dependencies |
| `cancel` | `/shipyard:cancel` — Pause in-progress work with checkpoint |
| `help` | `/shipyard:help` — This help command |

### Skill Topics

| Topic | Maps To |
|-------|---------|
| `tdd` | `shipyard:shipyard-tdd` — Write failing test → implement → verify cycle |
| `debugging` | `shipyard:shipyard-debugging` — 4-phase root cause investigation |
| `verification` | `shipyard:shipyard-verification` — Evidence before completion claims |
| `brainstorming` | `shipyard:shipyard-brainstorming` — Socratic design exploration |
| `testing` | `shipyard:shipyard-testing` — Test behaviors through public APIs |
| `security` | `shipyard:security-audit` — OWASP Top 10 + secrets + dependencies |
| `simplification` | `shipyard:code-simplification` — Post-implementation complexity review |
| `infrastructure` | `shipyard:infrastructure-validation` — Terraform/Ansible/Docker workflows |
| `parallel` | `shipyard:parallel-dispatch` — Concurrent agent dispatch |
| `plans`, `writing-plans` | `shipyard:shipyard-writing-plans` — Executable plan creation |
| `executing`, `executing-plans` | `shipyard:shipyard-executing-plans` — Plan execution with reviews |
| `git` | `shipyard:git-workflow` — Branch lifecycle and worktrees |
| `docs` | `shipyard:documentation` — Documentation generation |
| `skills`, `writing-skills` | `shipyard:shipyard-writing-skills` — Skill creation with TDD |
| `lessons` | `shipyard:lessons-learned` — Capture reusable discoveries |

For the matched topic, display:
1. The command/skill name and one-line description
2. Usage syntax with arguments
3. 2-3 common usage examples

If the topic doesn't match anything, display:
> "Unknown topic: '{topic}'. Run `/shipyard:help` to see all available commands and skills."

</execution>
