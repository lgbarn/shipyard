# Shipyard

A Claude Code plugin for structured project execution. Plan work in phases, build with parallel agents and TDD, review with security audits and quality gates, and ship with confidence.

```
IDEA → /init → /brainstorm → /plan → /build → /ship → SHIPPED
```

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI installed and authenticated
- `jq` (used by session hooks for state injection)

## Installation

### From GitHub (recommended)

```bash
claude plugin marketplace add lgbarn/shipyard
claude plugin install shipyard@shipyard
```

### From a local clone

```bash
git clone git@github.com:lgbarn/shipyard.git
claude plugin marketplace add /absolute/path/to/shipyard
claude plugin install shipyard@shipyard
```

### Verify

```bash
claude /shipyard:status
```

## Quick Start

Once installed, navigate to any project directory and run:

```bash
# Configure project preferences
/shipyard:init

# Explore requirements interactively
/shipyard:brainstorm

# Plan a phase
/shipyard:plan 1

# Build it
/shipyard:build

# Ship it
/shipyard:ship
```

For the full command reference and common workflows, see [docs/QUICKSTART.md](docs/QUICKSTART.md).

## Commands

| Command | Purpose |
|---------|---------|
| `/shipyard:init` | Configure project preferences and create `.shipyard/` directory |
| `/shipyard:brainstorm` | Explore requirements through interactive dialogue |
| `/shipyard:plan [phase] [--skip-research]` | Plan a phase of work (creates roadmap if needed) |
| `/shipyard:build [phase] [--plan N] [--light]` | Execute plans with parallel builder agents and review gates |
| `/shipyard:status` | Show progress dashboard and route to next action |
| `/shipyard:resume` | Restore context from a previous session |
| `/shipyard:quick [task]` | Execute a small task with full guarantees |
| `/shipyard:ship [--phase \| --milestone \| --branch]` | Verify and deliver — merge, PR, or preserve |
| `/shipyard:settings` | View or update workflow settings |
| `/shipyard:issues [--add \| --resolve \| --list]` | View and manage deferred issues across sessions |
| `/shipyard:rollback [checkpoint] [--list]` | Revert to a previous checkpoint |
| `/shipyard:recover` | Diagnose and recover from interrupted state |
| `/shipyard:move-docs` | Move codebase analysis docs between `.shipyard/codebase/` and `docs/codebase/` |
| `/shipyard:worktree [create\|list\|switch\|remove] [name]` | Manage git worktrees for isolated feature development |
| `/shipyard:review [target]` | On-demand code review — current changes, diff range, or files |
| `/shipyard:audit [scope]` | On-demand security audit — OWASP, secrets, dependencies, IaC |
| `/shipyard:simplify [scope]` | On-demand simplification — duplication, dead code, complexity |
| `/shipyard:document [scope]` | On-demand documentation generation for changes or modules |
| `/shipyard:research <topic>` | On-demand domain/technology research and comparison |
| `/shipyard:verify [criteria]` | On-demand verification — run tests or check acceptance criteria |
| `/shipyard:map [focus]` | On-demand codebase analysis — technology, architecture, quality, concerns |
| `/shipyard:help [topic]` | Quick-reference table or detailed help for a specific command/skill |
| `/shipyard:doctor` | Health-check diagnostic — jq, git, skills, hooks, `.shipyard/` structure |
| `/shipyard:cancel` | Graceful build interruption — checkpoint, pause, resume later |
| `/shipyard:debug [description]` | Root-cause analysis with 5 Whys protocol via debugger agent |
| `/shipyard:s` / `b` / `p` / `q` | Aliases for status, build, plan, quick |

## Skills (Auto-Activating)

Shipyard includes 16 skills that Claude invokes automatically when trigger conditions match:

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
| `shipyard-testing` | Writing effective, maintainable tests |
| `shipyard-writing-skills` | Creating new skills |
| `lessons-learned` | After phase completion, before shipping, reflecting on work |

## Agents

Shipyard dispatches 10 specialized agents for different phases of work:

| Agent | Role | Default Model | Dispatched By |
|-------|------|---------------|---------------|
| **mapper** | Brownfield codebase analysis (4 parallel instances) | sonnet | `/shipyard:map` |
| **researcher** | Domain/technology research | sonnet | `/shipyard:plan`, `/shipyard:research` |
| **architect** | Roadmap + plan decomposition | opus | `/shipyard:brainstorm`, `/shipyard:plan`, `/shipyard:quick` |
| **builder** | Task execution with TDD, IaC validation, atomic commits | sonnet | `/shipyard:build`, `/shipyard:quick` |
| **reviewer** | Two-stage code review (spec + quality) | sonnet | `/shipyard:build`, `/shipyard:review` |
| **auditor** | Comprehensive security & compliance analysis | sonnet | `/shipyard:build`, `/shipyard:ship`, `/shipyard:audit` |
| **simplifier** | Cross-task duplication and complexity analysis | sonnet | `/shipyard:build`, `/shipyard:simplify` |
| **documenter** | Documentation generation & updates | sonnet | `/shipyard:build`, `/shipyard:ship`, `/shipyard:document` |
| **verifier** | Post-execution verification (including IaC) | haiku | `/shipyard:plan`, `/shipyard:build`, `/shipyard:ship`, `/shipyard:verify` |
| **debugger** | Root-cause analysis with 5 Whys protocol | sonnet | `/shipyard:debug` |

All agents have formal definition files in `.claude/agents/` with tool restrictions and model defaults. See [`docs/AGENT-GUIDE.md`](docs/AGENT-GUIDE.md) for detailed documentation including model assignments, tool access, and composition patterns.

## Agent Teams Support

Shipyard now supports [Claude Code Agent Teams](https://docs.anthropic.com/en/docs/claude-code) — an experimental feature where multiple independent Claude Code instances collaborate on the same project by sharing a task list and mailbox.

### How It Works

Shipyard's standard execution model uses **subagents** (the Task tool) to dispatch builders, reviewers, and other agents. Each subagent runs within the lead agent's session, sharing its working directory but with a fresh context window. This is efficient for coordinated work where the lead needs to collect results and make decisions.

**Agent Teams** introduces a different model: independent Claude Code instances (teammates) that each have their own full session, context window, and tool access. They coordinate through a shared task list and mailbox rather than through a parent-child relationship.

Shipyard detects the teams environment automatically — **no configuration needed:**

| Environment Variable | Set By | Meaning |
|---------------------|--------|---------|
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` | You (opt-in) | Enables the teams feature in Claude Code |
| `CLAUDE_CODE_TEAM_NAME` | Claude Code (automatic) | Identifies this instance as a teammate |

When teams are detected, Shipyard adapts its behavior:

| Behavior | Solo Mode (default) | Teammate Mode |
|----------|-------------------|---------------|
| Task execution | Dispatches builder subagents | Executes tasks directly (you ARE the builder) |
| Quality gates | Lead dispatches auditor/simplifier | Lead handles quality gates; teammates skip |
| State updates | Writes STATE.json directly | Reports via task metadata (lead writes state) |
| State file locking | No locking needed | mkdir-based locking prevents concurrent writes |
| Verification | Standard pipeline | Runs locally, reports via task metadata |
| Stopping work | No gates | `TeammateIdle` hook verifies tests pass first |
| Completing tasks | No gates | `TaskCompleted` hook verifies evidence exists |

### Enabling Agent Teams

1. **Enable the experimental feature** in your Claude Code configuration:
   ```bash
   export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
   ```

2. **Use Claude Code normally.** When Claude Code spawns teammates, Shipyard automatically detects the team environment and adapts.

3. **Solo users are completely unaffected.** If you don't set the environment variable, Shipyard behaves exactly as before — no locking, no hooks, no behavioral changes.

### When to Use Teams vs Subagents

- **Use subagents** (Shipyard's default) when tasks are tightly coordinated, results need to flow back to a lead agent, or when you want the standard build pipeline (builder → reviewer → auditor).
- **Use teams** when tasks are truly independent, each takes significant time, and you want full isolation between workers to prevent context cross-contamination.

Teams and subagents are complementary. A lead agent in a team can still dispatch subagents for tightly-coupled subtasks within its assigned work.

See [docs/AGENT-TEAMS-GUIDE.md](docs/AGENT-TEAMS-GUIDE.md) for the full Agent Teams usage guide.

## How It Works

### The Lifecycle

```
IDEA → /init (configure preferences)
     → /brainstorm (explore requirements)
     → /plan (research + decompose)
     → /build (parallel execute + review)
     → repeat plan→build per phase
     → /ship (verify + deliver)
     → SHIPPED
```

### State Management

Shipyard uses a dual state system:

- **File state** (`.shipyard/` directory): Cross-session persistence for project vision, roadmap, plans, and progress. Survives session restarts and can be committed to git. Includes backup-on-write (`.bak`), SHA-256 checksums, and working notes (`NOTES.md`) for compaction resilience.
- **Native tasks** (TaskCreate/TaskUpdate): In-session UI visibility showing real-time progress of phases and plans.

### Key Design Principles

- **Fresh context per task**: Each builder agent runs in a clean 200k-token context, preventing quality degradation
- **Two-stage review + security audit**: Spec compliance and code quality per task, comprehensive security audit per phase
- **Configurable gates**: Security audit, simplification review, and IaC validation can be toggled in `config.json` or skipped with `--light`. Hook kill switch (`SHIPYARD_DISABLE_HOOKS`) available for debugging
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
├── STATE.json          # Current position, machine state (JSON)
├── STATE.json.bak      # Automatic backup (corruption fallback)
├── STATE.json.sha256   # Checksum for integrity verification
├── HISTORY.md          # Append-only audit trail
├── NOTES.md            # Working notes (compaction-resilient, auto-cleared per phase)
├── config.json         # Workflow preferences
├── codebase/           # Brownfield analysis (default; or docs/codebase/ if configured)
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
│   ├── marketplace.json   # Marketplace metadata (version, category)
│   └── plugin.json        # Plugin definition (name, description)
├── agents/                # Subagent dispatch prompts (used by commands)
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
│   ├── audit.md           # /shipyard:audit
│   ├── b.md               # /shipyard:b (alias → build)
│   ├── brainstorm.md      # /shipyard:brainstorm
│   ├── build.md           # /shipyard:build
│   ├── cancel.md          # /shipyard:cancel
│   ├── debug.md           # /shipyard:debug
│   ├── doctor.md          # /shipyard:doctor
│   ├── document.md        # /shipyard:document
│   ├── help.md            # /shipyard:help
│   ├── init.md            # /shipyard:init
│   ├── issues.md          # /shipyard:issues
│   ├── map.md             # /shipyard:map
│   ├── move-docs.md       # /shipyard:move-docs
│   ├── p.md               # /shipyard:p (alias → plan)
│   ├── plan.md            # /shipyard:plan
│   ├── q.md               # /shipyard:q (alias → quick)
│   ├── quick.md           # /shipyard:quick
│   ├── recover.md         # /shipyard:recover
│   ├── research.md        # /shipyard:research
│   ├── resume.md          # /shipyard:resume
│   ├── review.md          # /shipyard:review
│   ├── rollback.md        # /shipyard:rollback
│   ├── s.md               # /shipyard:s (alias → status)
│   ├── settings.md        # /shipyard:settings
│   ├── ship.md            # /shipyard:ship
│   ├── simplify.md        # /shipyard:simplify
│   ├── status.md          # /shipyard:status
│   ├── verify.md          # /shipyard:verify
│   └── worktree.md        # /shipyard:worktree
├── docs/
│   ├── AGENT-GUIDE.md        # Detailed agent documentation
│   ├── AGENT-TEAMS-GUIDE.md  # Agent teams usage guide
│   ├── COMPARISON.md         # Feature comparison with other frameworks
│   ├── PROTOCOLS.md          # Model routing and config.json reference
│   └── QUICKSTART.md         # Command reference and common workflows
├── .claude/
│   └── agents/            # Agent definition files with tool restrictions
│       ├── shipyard-architect.md
│       ├── shipyard-auditor.md
│       ├── shipyard-builder.md
│       ├── shipyard-debugger.md
│       ├── shipyard-documenter.md
│       ├── shipyard-mapper.md
│       ├── shipyard-researcher.md
│       ├── shipyard-reviewer.md
│       ├── shipyard-simplifier.md
│       └── shipyard-verifier.md
├── hooks/
│   ├── hooks.json         # Hook registry (SessionStart, TeammateIdle, TaskCompleted, PreToolUse, Stop)
│   ├── teammate-idle.sh   # TeammateIdle quality gate (teams only)
│   ├── task-completed.sh  # TaskCompleted quality gate (phase-specific evidence)
│   ├── pre-tool-use.sh    # PreToolUse protocol compliance nudges
│   └── stop.sh            # SessionEnd build interruption tracking
├── scripts/
│   ├── state-read.sh      # Adaptive context loading on session start
│   ├── state-write.sh     # Updates .shipyard/STATE.json (teams-aware locking)
│   ├── team-detect.sh     # Detects Claude Code Agent Teams environment
│   ├── checkpoint.sh      # Git tag checkpoint management
│   ├── check-versions.sh  # Version sync validation
│   └── marketplace-sync.sh # Marketplace metadata sync
├── skills/                # Auto-activating skill definitions
│   ├── code-simplification/
│   ├── documentation/
│   ├── git-workflow/
│   ├── infrastructure-validation/
│   ├── lessons-learned/
│   ├── parallel-dispatch/
│   ├── security-audit/
│   ├── shipyard-brainstorming/
│   ├── shipyard-debugging/
│   ├── shipyard-executing-plans/
│   ├── shipyard-tdd/
│   ├── shipyard-testing/
│   ├── shipyard-verification/
│   ├── shipyard-writing-plans/
│   ├── shipyard-writing-skills/
│   └── using-shipyard/
├── test/                  # bats-core test suite (dev only)
│   ├── run.sh             # Test runner
│   ├── test_helper.bash   # Shared fixtures
│   ├── state-read.bats
│   ├── state-write.bats   # Includes teams-aware locking tests
│   ├── checkpoint.bats
│   ├── check-versions.bats # Version sync tests
│   ├── marketplace-sync.bats # Marketplace sync tests
│   ├── integration.bats
│   ├── e2e-smoke.bats
│   ├── team-detect.bats   # Team detection tests
│   └── team-hooks.bats    # TeammateIdle and TaskCompleted tests
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── package.json
└── package-lock.json
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
| `codebase_docs_path` | `.shipyard/codebase`, `docs/codebase` | `.shipyard/codebase` | Where brownfield analysis docs are stored |
| `model_routing` | object | see `docs/PROTOCOLS.md` | Model selection per task type |
| `context_tier` | `auto`, `minimal`, `planning`, `execution`, `brownfield`, `full` | `auto` | Context loading at session start |

See `docs/PROTOCOLS.md` for model routing configuration and the full config.json skeleton.

## Memory

Shipyard v3.0 removed its built-in episodic memory system in favor of Claude's native memory, which provides better recall, zero maintenance, and cross-tool context automatically. See [CHANGELOG.md](CHANGELOG.md) for details on this change.

## Feature Comparison

See [docs/COMPARISON.md](docs/COMPARISON.md) for a detailed comparison of Shipyard with other Claude Code project frameworks.

## Acknowledgments

Shipyard draws inspiration from:

- [Superpowers](https://github.com/obra/superpowers) by Jesse Vincent — composable skills, TDD discipline, two-stage code review
- [GSD (Get Shit Done)](https://gsd.site/) by TÂCHES — project lifecycle management, phase-based planning, context engineering

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add commands, skills, and agents, run tests, and submit pull requests.

## License

MIT
