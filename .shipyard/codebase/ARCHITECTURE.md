# Architecture

## System Overview

Shipyard is a Claude Code plugin implementing a **multi-agent orchestration framework** for systematic software development. It follows a **pipeline architecture** where each phase of work progresses through orchestrated stages: planning, parallel execution, quality gates, and delivery.

### Core Architectural Pattern: Staged Pipeline with Fresh Context

```
INITIALIZE → PLAN → BUILD → VERIFY → SHIP
             ↓       ↓       ↓        ↓
          architect builder reviewer verifier
                    (parallel)
```

Each stage is handled by specialized agents running in **fresh 200k-token contexts**, preventing context degradation across phases.

## Architecture Layers

### 1. Entry Layer (Commands)

**Location:** `/commands/*.md`

Commands are the primary user interface, implemented as markdown specifications that orchestrate workflows.

**Pattern:** Declarative orchestration
- Commands specify WHAT to do at each step
- Commands dispatch agents and invoke skills
- Commands manage state transitions
- Commands handle checkpoints and routing

**Key commands:**
- `init.md` - Project bootstrapping, brownfield analysis, roadmap creation
- `plan.md` - Research and architectural decomposition
- `build.md` - Parallel execution with quality gates
- `ship.md` - Final verification and delivery

**Data flow:**
```
User invocation → Command reads state → Dispatches agents → Updates state → Routes forward
```

### 2. Execution Layer (Agents)

**Location:** `/agents/*.md`

Agents are specialized subagents dispatched by commands to perform specific analytical or implementation tasks.

**Pattern:** Single-responsibility agents with defined inputs/outputs
- Each agent has a clear job (architect, builder, reviewer, etc.)
- Agents run in isolated contexts (via Task tool with `subagent_type`)
- Agents produce structured artifacts (markdown reports)
- Agents never directly modify project state management files

**Agent specializations:**

- **mapper** (4 parallel instances) - Brownfield codebase analysis
  - Technology focus → STACK.md, INTEGRATIONS.md
  - Architecture focus → ARCHITECTURE.md, STRUCTURE.md
  - Quality focus → CONVENTIONS.md, TESTING.md
  - Concerns focus → CONCERNS.md

- **researcher** - Domain/technology investigation
  - Analyzes existing codebase for relevant patterns
  - Documents external dependencies and APIs

- **architect** - Requirements decomposition
  - Creates roadmaps with phase sequencing
  - Decomposes phases into wave-ordered plans (max 3 tasks each)
  - Defines verification criteria

- **builder** - Task execution
  - Implements tasks from plans sequentially
  - Follows TDD protocol when `tdd="true"`
  - Creates atomic commits per task
  - Handles IaC validation
  - Produces SUMMARY.md

- **reviewer** - Two-stage code review
  - Stage 1: Spec compliance against PLAN.md
  - Stage 2: Code quality (SOLID, security, performance)
  - Produces REVIEW.md with findings

- **verifier** - Success criteria validation
  - Runs tests and checks acceptance criteria
  - Validates IaC changes
  - Produces VERIFICATION.md

- **auditor** - Cross-task security analysis
  - OWASP Top 10, secrets scanning
  - Dependency vulnerabilities
  - IaC security (Terraform, Ansible, Docker)
  - Produces AUDIT.md

- **simplifier** - Code quality across tasks
  - Detects cross-task duplication
  - Identifies dead code and unnecessary abstractions
  - Flags AI bloat patterns
  - Produces SIMPLIFICATION.md

- **documenter** - Documentation generation
  - Analyzes changes for documentation needs
  - Updates/creates API docs, architecture docs
  - Produces DOCUMENTATION.md

**Agent dispatch pattern:**
```markdown
subagent_type: "shipyard:{agent-name}"
model: inherit | opus | sonnet | haiku (from config.model_routing or agent default)
```

### 3. Context Layer (Skills)

**Location:** `/skills/*/SKILL.md`

Skills are reusable behavioral protocols that activate based on deterministic triggers.

**Pattern:** Auto-activation with trigger-based dispatch
- File pattern triggers (e.g., `*.tf` → infrastructure-validation)
- Task marker triggers (e.g., `tdd="true"` → shipyard-tdd)
- State condition triggers (e.g., claiming "done" → shipyard-verification)
- Content pattern triggers (e.g., error messages → shipyard-debugging)

**Skill types:**

**Rigid skills** (disciplined protocols):
- `shipyard-tdd` - Red-Green-Refactor cycle enforcement
- `shipyard-debugging` - Root cause investigation before fixes
- `shipyard-verification` - Evidence-based completion

**Flexible skills** (adaptive patterns):
- `shipyard-brainstorming` - Requirements exploration
- `shipyard-writing-plans` - Plan structure guidance
- `shipyard-executing-plans` - Execution workflow
- `parallel-dispatch` - Concurrent agent orchestration
- `git-workflow` - Branch management and worktrees

**Domain skills** (specialized validation):
- `security-audit` - OWASP, secrets, CVE scanning
- `code-simplification` - Duplication and bloat detection
- `infrastructure-validation` - Terraform/Ansible/Docker workflows
- `documentation` - Documentation generation patterns

**Meta skill:**
- `using-shipyard` - Skill discovery and invocation protocol (loaded at session start)

### 4. State Layer (File-based persistence)

**Location:** `.shipyard/` directory in user projects

**Pattern:** File-based state with dual-tracking
- **File state** - Cross-session persistence (survives restarts)
- **Native tasks** - In-session UI visibility (ephemeral)

**State structure:**
```
.shipyard/
├── PROJECT.md          # Vision, requirements, constraints (immutable after init)
├── ROADMAP.md          # Phase structure with success criteria
├── STATE.md            # Current position, status, history (mutable)
├── ISSUES.md           # Deferred issues across sessions
├── config.json         # Workflow preferences, model routing
├── codebase/           # Brownfield analysis artifacts
│   ├── STACK.md
│   ├── INTEGRATIONS.md
│   ├── ARCHITECTURE.md
│   ├── STRUCTURE.md
│   ├── CONVENTIONS.md
│   ├── TESTING.md
│   └── CONCERNS.md
└── phases/
    └── {NN}-{name}/
        ├── RESEARCH.md
        ├── plans/
        │   └── PLAN-{W}.{P}.md
        └── results/
            ├── SUMMARY-{W}.{P}.md
            ├── REVIEW-{W}.{P}.md
            ├── VERIFICATION.md
            ├── AUDIT-{N}.md
            ├── SIMPLIFICATION-{N}.md
            └── DOCUMENTATION-{N}.md
```

**State transitions:**
```
ready → planning → planned → building → complete → shipped
         ↑                      ↓
         └── (gap-filling) ─────┘
```

### 5. Integration Layer (Hooks & Scripts)

**Location:** `/hooks/` and `/scripts/`

**Pattern:** Session lifecycle integration via hooks

**SessionStart hook** (`hooks/hooks.json`):
- Triggers on: startup, resume, clear, compact
- Executes: `scripts/state-read.sh`
- Injects context into session based on adaptive tier

**Adaptive context loading tiers:**
- **minimal** - STATE.md only
- **planning** - STATE.md + PROJECT.md + ROADMAP.md
- **execution** - Planning tier + current phase plans + recent summaries
- **full** - Execution tier + codebase analysis
- **auto** - Selects tier based on current status

**State management scripts:**
- `state-read.sh` - Adaptive context injection at session start
- `state-write.sh` - Updates STATE.md with current position
- `checkpoint.sh` - Git tag-based rollback points

## Data Flow

### Initialize Flow

```
/shipyard:init
  → Detect project type (brownfield/greenfield)
  → [Brownfield] Dispatch 4 mapper agents in parallel
     → mapper:tech → STACK.md, INTEGRATIONS.md
     → mapper:arch → ARCHITECTURE.md, STRUCTURE.md
     → mapper:quality → CONVENTIONS.md, TESTING.md
     → mapper:concerns → CONCERNS.md
  → Invoke brainstorming skill
  → Capture requirements → PROJECT.md
  → Collect workflow preferences → config.json
  → Dispatch architect agent → ROADMAP.md
  → Create phase tasks (native)
  → Initialize STATE.md
  → Commit
```

### Plan Flow

```
/shipyard:plan [N]
  → Read STATE.md, ROADMAP.md
  → Update STATE: planning
  → [Unless --skip-research] Dispatch researcher → RESEARCH.md
  → Dispatch architect → PLAN-{W}.{P}.md files
  → Dispatch verifier → validate plans
  → Create plan tasks (native)
  → Update STATE: planned
  → Create checkpoint
  → Commit
```

### Build Flow

```
/shipyard:build [N]
  → Read STATE.md, ROADMAP.md, config.json
  → Update STATE: building
  → Create pre-build checkpoint
  → For each wave (sequential):
     → Dispatch builder agents in parallel (one per plan)
        → Execute tasks sequentially
        → Create atomic commits
        → Produce SUMMARY.md
     → Dispatch reviewer agents in parallel
        → Two-stage review
        → Produce REVIEW.md
     → Handle critical issues (retry up to 2x)
     → Update plan tasks: completed/blocked
  → Dispatch verifier → VERIFICATION.md
  → [Unless --light or config] Dispatch auditor → AUDIT.md
  → [Unless --light or config] Dispatch simplifier → SIMPLIFICATION.md
  → [Unless --light or config] Dispatch documenter → DOCUMENTATION.md
  → Update ROADMAP: mark phase complete
  → Update STATE: complete
  → Create post-build checkpoint
  → Commit artifacts
```

### Ship Flow

```
/shipyard:ship
  → Read all phase VERIFICATION.md, AUDIT.md files
  → Dispatch verifier (comprehensive)
  → Dispatch auditor (comprehensive)
  → Check for critical findings
  → [Branch mode] Merge to main
  → [PR mode] Create pull request
  → [Preserve mode] Create release tag
  → Update STATE: shipped
  → Commit
```

## Key Architectural Decisions

### 1. Fresh Context Per Agent

**Decision:** Each builder/reviewer runs in a new 200k context, not accumulated context.

**Rationale:** Prevents quality degradation from context pollution. Each agent sees only what it needs: the plan, project requirements, conventions, and prior results.

**Tradeoff:** Higher token usage vs. maintained quality.

### 2. Wave-Based Parallelism

**Decision:** Plans within a wave execute in parallel; waves execute sequentially.

**Rationale:** Maximizes throughput while respecting dependencies. Parallel execution reduces wallclock time.

**Implementation:** Architect assigns wave numbers based on dependency analysis.

### 3. Two-Stage Review

**Decision:** Review split into spec compliance (does it match the plan?) and code quality (is it well-built?).

**Rationale:** Separates concerns. Spec compliance is objective and blocks progress. Code quality can have nuance.

**Tradeoff:** More review time vs. higher confidence.

### 4. Post-Phase Quality Gates

**Decision:** Security audit, simplification review, and documentation generation run AFTER phase verification.

**Rationale:** Individual task reviews can't detect cross-task patterns (duplication, security coherence). Dedicated agents with whole-phase visibility catch these.

**Configurable:** Can be toggled per project or skipped with `--light`.

### 5. File-Based State + Native Tasks

**Decision:** Use both file-based persistence and ephemeral native tasks.

**Rationale:**
- Files persist across sessions and can be committed to git
- Native tasks provide real-time UI visibility during execution
- Dual tracking ensures state survives session interruption

### 6. Skill Auto-Activation

**Decision:** Skills activate via deterministic triggers, not LLM judgment.

**Rationale:** Ensures consistency. If `tdd="true"` is in a plan, the TDD skill MUST activate. No room for rationalization.

**Implementation:** `using-shipyard` skill loaded at every session start defines triggers and enforcement protocol.

### 7. Atomic Commits Per Task

**Decision:** Every completed task gets its own git commit.

**Rationale:** Enables surgical rollback. If task 3 of a plan is problematic, revert only that commit, not the entire phase.

**Tradeoff:** Noisier git history vs. granular revertability.

## Patterns & Principles

### Orchestration over Implementation

Commands orchestrate; they don't implement. Commands dispatch agents, invoke skills, manage state, and route forward. Implementation happens in agents.

### Artifact-Based Communication

Agents communicate via structured markdown artifacts, not function calls or APIs. This makes all interactions auditable and human-readable.

### Fail-Fast with Checkpoints

Create checkpoints before risky operations (pre-build, post-plan). If something goes wrong, rollback is one command away.

### Adaptive Context Loading

Don't load all context at every session start. Load based on current state:
- Idle project → minimal context
- Active build → execution context with current plans

### Deterministic Triggers

Skills use file patterns, task markers, state conditions, and content patterns—not fuzzy matching. If a trigger fires, the skill MUST activate.

### Cross-Task Analysis

Individual reviewers see one task. Dedicated agents (auditor, simplifier) see the whole phase and catch patterns that span tasks.

## Extension Points

### Adding a New Command

1. Create `/commands/{name}.md` with YAML frontmatter
2. Define step-by-step orchestration protocol
3. Specify which agents to dispatch and when
4. Define state transitions
5. Add command to plugin.json

### Adding a New Agent

1. Create `/agents/{name}.md` with YAML frontmatter
2. Define agent's job, inputs, and outputs
3. Specify artifact format agent produces
4. Update relevant commands to dispatch the agent
5. Document agent in README

### Adding a New Skill

1. Create `/skills/{name}/SKILL.md` with YAML frontmatter
2. Define triggers (file patterns, task markers, state conditions)
3. Document protocol (rigid vs. flexible)
4. Add skill to `using-shipyard` skill list
5. Reference skill from relevant agents

### Configurable Quality Gates

Quality gates (security audit, simplification, IaC validation, documentation) are configurable via `config.json`:
- `true` - always run
- `false` - never run
- `"auto"` - detect when relevant (IaC only)

Commands check config before dispatching optional agents.

## Security Considerations

### Secrets Management

- Auditor scans all files for secrets before commit
- Builder enforces: NEVER commit secrets, credentials, or private keys
- IaC validation checks for plaintext secrets in Terraform/Ansible

### Dependency Scanning

- Auditor checks for known CVEs in added dependencies
- Verifies lock files are committed and consistent
- Flags unpinned versions

### Infrastructure Security

- Terraform: checks for overpermissive IAM, public resources, unencrypted storage
- Ansible: checks for plaintext secrets, privilege escalation
- Docker: checks for root user, secrets in layers, unpinned base images

### Code Security

- Auditor performs OWASP Top 10 checks across all changed files
- Reviews authentication, authorization, injection risks
- Checks output encoding and error handling

## Performance Characteristics

### Token Budget

- Commands: ~5-10k tokens (orchestration only)
- Agents: 50-150k tokens per execution (varies by task complexity)
- Skills: 5-15k tokens (loaded into agent context)
- State injection: 2-10k tokens (adaptive based on tier)

### Parallelism

- Mapper agents: 4 parallel instances during init
- Builder agents: N parallel (where N = plans in current wave)
- Reviewer agents: N parallel (one per completed plan)

### Wallclock Time

Typical phase execution:
- Planning: 2-5 minutes (research + architect + verifier)
- Building: 5-15 minutes per wave (parallel builders + reviewers)
- Verification: 1-3 minutes
- Optional gates: 2-5 minutes each (auditor, simplifier, documenter)

## Limitations & Tradeoffs

### Context Window Management

Fresh contexts prevent pollution but require state to be re-injected. Adaptive loading minimizes this cost.

### Git History Noise

Atomic commits per task create many commits. Squashing is possible at PR time if desired.

### Model Costs

Parallel execution and fresh contexts increase token usage. Configurable model routing (Haiku for validation, Sonnet for building, Opus for architecture) balances cost vs. quality.

### State Synchronization

File state and native tasks must stay synchronized. Commands handle this; agents must never directly modify state files.

### Checkpoint Granularity

Checkpoints are created at phase boundaries (pre/post plan, pre/post build). Intra-phase checkpoints are manual.
