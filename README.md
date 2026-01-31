# Shipyard

Ship software systematically — from idea to production with discipline, parallel agents, and zero context rot.

Shipyard is a Claude Code plugin that combines structured project lifecycle management with rigorous development practices. It replaces ad-hoc workflows with a systematic pipeline: brainstorm requirements, plan in phases, execute with fresh subagents, review with two-stage gates, audit for security, audit for simplification, and ship with confidence.

## Quick Start

```bash
# Install from marketplace
/plugin install shipyard

# Initialize a new project
/shipyard:init

# Plan a phase
/shipyard:plan 1

# Build it
/shipyard:build

# Check progress
/shipyard:status

# Ship it
/shipyard:ship
```

## Commands

| Command | Purpose |
|---------|---------|
| `/shipyard:init` | Initialize project — gather requirements, analyze codebase, create roadmap |
| `/shipyard:plan` | Decompose a phase into executable plans with atomic tasks |
| `/shipyard:build` | Execute plans with parallel builder agents and review gates |
| `/shipyard:status` | Show progress dashboard and route to next action |
| `/shipyard:resume` | Restore context from a previous session |
| `/shipyard:quick` | Execute a small task with full guarantees |
| `/shipyard:ship` | Verify and deliver — merge, PR, or preserve |

## Skills (Auto-Activating)

Shipyard includes 14 skills that activate automatically based on context:

| Skill | When It Activates |
|-------|-------------------|
| `test-driven-development` | Writing any new code, features, or fixes |
| `systematic-debugging` | Any error, test failure, or unexpected behavior |
| `verification-before-completion` | Before claiming any task is complete |
| `brainstorming` | Creative work: features, components, design |
| `security-audit` | Working with code, configs, dependencies, or IaC |
| `code-simplification` | After implementation, before shipping, reviewing AI code |
| `documentation` | After implementation, before shipping, when docs are incomplete |
| `infrastructure-validation` | Working with Terraform, Ansible, Docker, or IaC files |
| `parallel-dispatch` | 2+ independent tasks that can run concurrently |
| `writing-plans` | Creating implementation plans |
| `executing-plans` | Implementing from a written plan |
| `git-workflow` | Branch management, commits, delivery |
| `using-shipyard` | Every session (skill discovery protocol) |
| `writing-skills` | Creating new skills |

## Agents

Shipyard dispatches specialized agents for different phases of work:

| Agent | Role | Dispatched By |
|-------|------|---------------|
| **mapper** | Brownfield codebase analysis (4 parallel instances) | `/shipyard:init` |
| **researcher** | Domain/technology research | `/shipyard:plan` |
| **architect** | Roadmap + plan decomposition | `/shipyard:init`, `/shipyard:plan` |
| **builder** | Task execution with TDD, IaC validation, atomic commits | `/shipyard:build`, `/shipyard:quick` |
| **reviewer** | Two-stage code review (spec + quality) | `/shipyard:build` |
| **auditor** | Comprehensive security & compliance analysis | `/shipyard:build`, `/shipyard:ship` |
| **simplifier** | Cross-task duplication and complexity analysis | `/shipyard:build` |
| **documenter** | Documentation generation & updates | `/shipyard:build`, `/shipyard:ship` |
| **verifier** | Post-execution verification (including IaC) | `/shipyard:plan`, `/shipyard:build`, `/shipyard:ship` |

## How It Works

### The Lifecycle

```
IDEA → /init (brainstorm + roadmap)
     → /plan (research + decompose)
     → /build (parallel execute + review)
     → /status (check progress)
     → repeat plan→build per phase
     → /ship (verify + deliver)
     → SHIPPED
```

### State Management

Shipyard uses a dual state system:

- **File state** (`.shipyard/` directory): Cross-session persistence for project vision, roadmap, plans, and progress. Survives session restarts and can be committed to git.
- **Native tasks** (TaskCreate/TaskUpdate): In-session UI visibility showing real-time progress of phases and plans.

### Key Design Principles

- **Fresh context per task**: Each builder agent runs in a clean 200k-token context, preventing quality degradation
- **Two-stage review + security audit**: Spec compliance and code quality per task, comprehensive security audit per phase
- **Configurable gates**: Security audit, simplification review, and IaC validation can be toggled in `config.json` or skipped with `--light`
- **Code simplification**: Post-phase analysis catches AI-generated duplication and bloat across tasks
- **Documentation generation**: Post-phase documentation keeps docs synchronized with code changes
- **IaC support**: Terraform, Ansible, Docker validation workflows built into the builder and verifier
- **Max 3 tasks per plan**: Keeps each agent's workload within the quality budget
- **Atomic commits**: Every task produces a separate, revertable commit
- **Phase-based planning**: Break large projects into manageable phases with clear success criteria

## Project State Structure

```
.shipyard/
├── PROJECT.md          # Vision, decisions, constraints
├── ROADMAP.md          # Phase structure with success criteria
├── STATE.md            # Current position, session memory
├── config.json         # Workflow preferences
├── codebase/           # Brownfield analysis (optional)
├── phases/
│   └── 01-{name}/
│       ├── RESEARCH.md
│       ├── 01-PLAN.md
│       ├── 01-SUMMARY.md
│       ├── VERIFICATION.md
│       ├── AUDIT-{N}.md          # Security audit report
│       ├── SIMPLIFICATION-{N}.md # Code simplification report
│       └── DOCUMENTATION-{N}.md  # Documentation generation report
└── quick/              # Ad-hoc tasks
```

## Acknowledgments

Shipyard draws inspiration from:

- [Superpowers](https://github.com/obra/superpowers) by Jesse Vincent — composable skills, TDD discipline, two-stage code review
- [GSD (Get Shit Done)](https://gsd.site/) by TÂCHES — project lifecycle management, phase-based planning, context engineering

## License

MIT
