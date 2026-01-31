# Shipyard

Ship software systematically — from idea to production with discipline, parallel agents, and zero context rot.

Shipyard is a Claude Code plugin that combines structured project lifecycle management with rigorous development practices. It replaces ad-hoc workflows with a systematic pipeline: brainstorm requirements, plan in phases, execute with fresh subagents, review with two-stage gates, audit for security, audit for simplification, and ship with confidence.

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI installed and authenticated
- `jq` (used by session hooks for state injection)

## Installation

### From source

```bash
git clone git@github.com:lgbarn/shipyard.git
claude plugin add /path/to/shipyard
```

### From npm

```bash
npm install -g @lgbarn/shipyard
claude plugin add "$(npm root -g)/@lgbarn/shipyard"
```

### Verify

```bash
claude /shipyard:status
```

## Quick Start

Once installed, navigate to any project directory and run:

```bash
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
| `/shipyard:plan [phase] [--skip-research]` | Decompose a phase into executable plans with atomic tasks |
| `/shipyard:build [phase] [--plan N] [--light]` | Execute plans with parallel builder agents and review gates |
| `/shipyard:status` | Show progress dashboard and route to next action |
| `/shipyard:resume` | Restore context from a previous session |
| `/shipyard:quick [task]` | Execute a small task with full guarantees |
| `/shipyard:ship [--phase \| --milestone \| --branch]` | Verify and deliver — merge, PR, or preserve |
| `/shipyard:issues [--add \| --resolve \| --list]` | View and manage deferred issues across sessions |
| `/shipyard:rollback [checkpoint] [--list]` | Revert to a previous checkpoint |
| `/shipyard:recover` | Diagnose and recover from interrupted state |
| `/shipyard:worktree [create\|list\|switch\|remove] [name]` | Manage git worktrees for isolated feature development |

## Skills (Auto-Activating)

Shipyard includes 14 skills that activate automatically based on context:

| Skill | When It Activates |
|-------|-------------------|
| `shipyard-tdd` | Writing any new code, features, or fixes |
| `shipyard-debugging` | Any error, test failure, or unexpected behavior |
| `shipyard-verification` | Before claiming any task is complete |
| `shipyard-brainstorming` | Creative work: features, components, design |
| `security-audit` | Working with code, configs, dependencies, or IaC |
| `code-simplification` | After implementation, before shipping, reviewing AI code |
| `documentation` | After implementation, before shipping, when docs are incomplete |
| `infrastructure-validation` | Working with Terraform, Ansible, Docker, or IaC files |
| `parallel-dispatch` | 2+ independent tasks that can run concurrently |
| `shipyard-writing-plans` | Creating implementation plans |
| `shipyard-executing-plans` | Implementing from a written plan |
| `git-workflow` | Branch management, commits, delivery |
| `using-shipyard` | Every session (skill discovery protocol) |
| `shipyard-writing-skills` | Creating new skills |

## Agents

Shipyard dispatches specialized agents for different phases of work:

| Agent | Role | Dispatched By |
|-------|------|---------------|
| **mapper** | Brownfield codebase analysis (4 parallel instances) | `/shipyard:init` |
| **researcher** | Domain/technology research | `/shipyard:plan` |
| **architect** | Roadmap + plan decomposition | `/shipyard:init`, `/shipyard:plan`, `/shipyard:quick` |
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

## Plugin Structure

```
shipyard/
├── .claude-plugin/
│   └── plugin.json        # Plugin metadata (name, version, keywords)
├── agents/                # Specialized subagent definitions
│   ├── architect.md       # Roadmap and plan decomposition
│   ├── auditor.md         # Security and compliance analysis
│   ├── builder.md         # Task execution with TDD
│   ├── documenter.md      # Documentation generation
│   ├── mapper.md          # Brownfield codebase analysis
│   ├── researcher.md      # Domain/technology research
│   ├── reviewer.md        # Two-stage code review
│   ├── simplifier.md      # Complexity and duplication analysis
│   └── verifier.md        # Post-execution verification
├── commands/              # Slash command definitions
│   ├── init.md            # /shipyard:init
│   ├── plan.md            # /shipyard:plan
│   ├── build.md           # /shipyard:build
│   ├── status.md          # /shipyard:status
│   ├── resume.md          # /shipyard:resume
│   ├── quick.md           # /shipyard:quick
│   ├── ship.md            # /shipyard:ship
│   ├── issues.md          # /shipyard:issues
│   ├── rollback.md        # /shipyard:rollback
│   ├── recover.md         # /shipyard:recover
│   └── worktree.md        # /shipyard:worktree
├── hooks/
│   └── hooks.json         # SessionStart hook for state injection
├── scripts/
│   ├── state-read.sh      # Adaptive context loading on session start
│   ├── state-write.sh     # Updates .shipyard/STATE.md
│   └── checkpoint.sh      # Git tag checkpoint management
└── skills/                # Auto-activating skill definitions
    ├── code-simplification/
    ├── documentation/
    ├── git-workflow/
    ├── infrastructure-validation/
    ├── parallel-dispatch/
    ├── security-audit/
    ├── shipyard-brainstorming/
    ├── shipyard-debugging/
    ├── shipyard-executing-plans/
    ├── shipyard-tdd/
    ├── shipyard-verification/
    ├── shipyard-writing-plans/
    ├── shipyard-writing-skills/
    └── using-shipyard/
```

## Configuration

When you run `/shipyard:init`, Shipyard creates a `.shipyard/config.json` in your project with these options:

| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| `interaction_mode` | `interactive`, `autonomous` | — | Approve each phase or execute full roadmap |
| `git_strategy` | `per_task`, `per_phase`, `manual` | — | When to create git commits |
| `review_depth` | `detailed`, `lightweight` | — | Review gate depth between build steps |
| `security_audit` | `true`, `false` | `true` | Run security audit after each phase |
| `simplification_review` | `true`, `false` | `true` | Check for duplication and complexity |
| `iac_validation` | `auto`, `true`, `false` | `auto` | Validate Terraform/Ansible/Docker changes |
| `documentation_generation` | `true`, `false` | `true` | Generate docs after each phase |
| `model_routing` | object | see below | Model selection per task type |
| `context_tier` | `auto`, `minimal`, `full` | `auto` | Context loading at session start |

### Model Routing Defaults

```json
{
  "model_routing": {
    "validation": "haiku",
    "building": "sonnet",
    "planning": "sonnet",
    "architecture": "opus",
    "debugging": "opus",
    "review": "sonnet",
    "security_audit": "sonnet"
  }
}
```

## Feature Comparison

| Capability | Shipyard v1.2.0 | GSD v1.10.1 | Superpowers v3.6.2 |
|-----------|:---:|:---:|:---:|
| **Project Lifecycle** | | | |
| Init / requirements gathering | ✅ | ✅ | ✅ |
| Phase-based roadmap | ✅ | ✅ | ❌ |
| Research agents | ✅ (researcher + 4 mappers) | ✅ (4 parallel) | ❌ |
| Discussion / decision capture | ❌ | ✅ | ❌ |
| Structured planning (waves) | ✅ | ✅ | ✅ |
| Max 3 tasks per plan | ✅ | ✅ | ❌ |
| Quick task mode | ✅ | ✅ | ❌ |
| Progress dashboard | ✅ | ✅ | ❌ |
| Ship / deliver command | ✅ | ✅ | ❌ |
| **Execution** | | | |
| Fresh 200k context per agent | ✅ | ✅ | ✅ |
| Parallel wave execution | ✅ | ✅ | ✅ |
| TDD enforcement | ✅ (rigid skill) | ✅ (implicit) | ✅ (rigid skill) |
| Atomic commits per task | ✅ | ✅ | ✅ |
| IaC validation (Terraform, Ansible, Docker) | ✅ | ❌ | ❌ |
| **Quality Gates** | | | |
| Two-stage code review | ✅ (spec + quality) | ✅ (single-stage) | ✅ (spec + quality) |
| Security audit (OWASP, secrets, deps) | ✅ (dedicated agent) | ❌ | ❌ |
| Code simplification | ✅ (skill + agent) | ❌ | 🧪 (lab, experimental) |
| Documentation generation | ✅ (dedicated agent) | ❌ | ❌ |
| Phase verification | ✅ | ✅ | ❌ |
| Configurable gate toggles | ✅ (`--light`, config.json) | ❌ | ❌ |
| **Context & Models** | | | |
| Multi-model routing | ✅ (7 categories) | ✅ (profiles) | ❌ |
| Adaptive context loading | ✅ (4 tiers) | ✅ (5 tiers, fork) | ✅ (<2k bootstrap) |
| Session resume / state persistence | ✅ | ✅ | ❌ |
| Episodic memory | ❌ | ❌ | ✅ (plugin) |
| **Git & Recovery** | | | |
| Git worktree management | ✅ (command + agent context) | ❌ | ✅ (skill) |
| Rollback / checkpoints | ✅ | ✅ (fork) | ❌ |
| State recovery | ✅ | ✅ (fork) | ❌ |
| Issue tracking (cross-session) | ✅ | ✅ (todos) | ❌ |
| **Skills & Extensibility** | | | |
| Auto-activating skills | ✅ (14 skills) | ❌ | ✅ (15+ skills) |
| Deterministic skill triggers | ✅ (4 trigger types) | ❌ | ❌ (description-based) |
| Systematic debugging | ✅ | ✅ | ✅ (4-phase + escalation) |
| Verification before completion | ✅ | ✅ | ✅ |
| Brainstorming / design | ✅ | ✅ (discuss phase) | ✅ |
| Skill authoring guide | ✅ | ❌ | ✅ |
| Plugin marketplace | ❌ | ❌ | ✅ (7 plugins) |
| **Distribution** | | | |
| npm install | ✅ (`@lgbarn/shipyard`) | ✅ (`npx get-shit-done-cc`) | ✅ (marketplace) |
| Multi-runtime | ❌ (Claude Code) | ✅ (Claude + OpenCode + Gemini) | ❌ (Claude Code) |
| **Scale** | | | |
| Commands | 11 | 20+ | 3 |
| Skills | 14 | 0 | 15+ |
| Named agents | 9 | implicit | implicit |

## Acknowledgments

Shipyard draws inspiration from:

- [Superpowers](https://github.com/obra/superpowers) by Jesse Vincent — composable skills, TDD discipline, two-stage code review
- [GSD (Get Shit Done)](https://gsd.site/) by TÂCHES — project lifecycle management, phase-based planning, context engineering

## License

MIT
