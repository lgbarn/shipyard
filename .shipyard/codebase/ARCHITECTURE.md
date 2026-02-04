# Shipyard Architecture

**Last Updated:** 2026-02-03
**Analyzed Version:** 2.3.0
**Schema:** System architecture and design patterns

## Overview

Shipyard is a Claude Code plugin that implements a **structured software delivery pipeline** using a multi-agent orchestration architecture. The system decomposes complex software projects into phases, plans, and tasks, then executes them through specialized agents with quality gates and verification at each stage.

**Core Architectural Principle:** Separation of orchestration (commands) from execution (agents), with declarative protocols connecting the layers and fresh context per agent to prevent quality degradation.

## System Layers

```
┌──────────────────────────────────────────────────────────────┐
│                     USER INTERFACE                           │
│          (Claude Code CLI + Shipyard Commands)               │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                  COMMAND ORCHESTRATION                        │
│  /init  /plan  /build  /ship  /status  /resume  /quick      │
│         (Stateless workflow coordinators)                    │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                    PROTOCOL LAYER                             │
│  State Update │ Model Routing │ Checkpoint │ Agent Context   │
│  (Shared contracts referenced by all commands/agents)        │
└─────────────────┬─────────────┬──────────────────────────────┘
                  │             │
         ┌────────┘             └──────────┐
         │                                 │
┌────────▼──────────┐           ┌─────────▼─────────────────┐
│   SKILLS LAYER    │           │   AGENT EXECUTION         │
│  (Auto-Activate)  │           │  (Fresh Context)          │
│  16 SKILL.md      │           │  9 Specialized Agents     │
│  Deterministic    │           │  Parallel & Sequential    │
│  triggers         │           │  Execution                │
└────────┬──────────┘           └─────────┬─────────────────┘
         │                                 │
         └────────┬────────────────────────┘
                  │
┌─────────────────▼──────────────────────────────────────────┐
│                   STATE PERSISTENCE                         │
│    STATE.md │ ROADMAP.md │ Plans │ Summaries │ Checkpoints │
│              (Git-tracked artifacts)                        │
└─────────────────┬──────────────────────────────────────────┘
                  │
┌─────────────────▼──────────────────────────────────────────┐
│                   SESSION LIFECYCLE                         │
│              hooks.json → state-read.sh                     │
│         (Adaptive context injection)                        │
└─────────────────────────────────────────────────────────────┘
```

## Architectural Patterns

### 1. Command-Agent Separation (Orchestrator Pattern)

**Pattern:** Commands are stateless orchestrators that dispatch stateful agents.

**Implementation:**
- Commands (`commands/*.md`) contain workflow logic but execute no tasks directly
- Agents (`agents/*.md`) receive context and execute focused work
- Commands coordinate agent dispatch, collect results, and manage state transitions
- No shared memory between command and agent - all communication through artifacts

**Example Flow (/shipyard:build):**
```
Command: build.md
  ├─> Reads STATE.md, ROADMAP.md, config.json (lines 13-28)
  ├─> Groups plans by wave number (line 43)
  ├─> Dispatches builder agents (parallel, per plan) (lines 46-54)
  ├─> Collects SUMMARY.md from each builder (lines 93-96)
  ├─> Dispatches reviewer agents (parallel, per plan) (lines 99-112)
  ├─> Handles retry logic based on review verdicts (lines 130-137)
  ├─> Dispatches verifier agent (single, cross-plan) (lines 146-165)
  ├─> Conditionally dispatches auditor/simplifier/documenter (lines 167-237)
  └─> Updates STATE.md and ROADMAP.md (lines 239-246)
```

**Rationale:** Commands maintain high-level state and sequencing. Agents work in isolation with fresh context, preventing context pollution across tasks.

**Evidence:** `commands/build.md` lines 45-140, `agents/builder.md` lines 9-21

### 2. Protocol-Based Integration (Contract Pattern)

**Pattern:** Shared protocols define contracts between commands and agents, eliminating tight coupling.

**Implementation:**
- 12 protocols defined in `docs/PROTOCOLS.md` (252 lines)
- Commands reference protocols by name (e.g., "Follow **State Update Protocol**")
- Agents implement protocol requirements without knowing caller identity
- Protocols are versioned and self-contained

**Key Protocols:**

| Protocol | Purpose | References |
|----------|---------|------------|
| **State Loading** | Load project state files for session context | Commands: all |
| **Model Routing** | Map agent roles to model tiers (haiku/sonnet/opus) | Commands: init, plan, build, ship |
| **Checkpoint** | Create rollback points at pipeline boundaries | Commands: build, plan, ship |
| **Worktree** | Detect and record git worktree context | Commands: all, Agents: all |
| **Issue Tracking** | Append non-blocking findings to ISSUES.md | Agents: reviewer, auditor, simplifier |
| **Codebase Docs** | Resolve configured codebase documentation path | Commands: init, build, Agents: builder, reviewer |
| **Agent Context** | Standard context to pass when dispatching agents | Commands: all (when dispatching) |
| **State Update** | Update STATE.md with canonical status values | Commands: all (at transitions) |
| **Native Task Scaffolding** | Map workflow stages to native tasks | Commands: init, plan, build, ship |
| **Discussion Capture** | Capture user decisions before planning | Command: plan |
| **Commit Convention** | Use conventional commits for all work | Agents: builder, documenter |

**Rationale:** Protocols enable independent evolution of commands and agents. New commands can reuse existing protocols. New protocols don't break existing commands.

**Evidence:** `docs/PROTOCOLS.md` lines 1-252, command files reference protocols with markdown links

### 3. Multi-Agent Pipeline (Pipeline Pattern)

**Pattern:** Phases flow through a fixed pipeline of agent stages with quality gates.

**Pipeline Stages:**

```
Phase Input (ROADMAP.md phase description)
    │
    ├──> [Discussion Capture] (optional, via plan command)
    │        └─> CONTEXT-{N}.md
    │
    ├──> [Research] (optional, via plan command)
    │        └─> RESEARCH.md
    │
    ├──> [Architect] (plan creation)
    │        └─> PLAN-*.md (wave-ordered)
    │
    ├──> [Verifier] (plan coverage check)
    │        └─> Feedback to architect if gaps found
    │
    ├──> [Builder] (parallel per wave)
    │        └─> SUMMARY-*.md + atomic commits
    │
    ├──> [Reviewer] (parallel, 2-stage per plan)
    │        ├─> Stage 1: Spec compliance
    │        └─> Stage 2: Code quality
    │        └─> REVIEW-*.md
    │
    ├──> [Verifier] (phase-level verification)
    │        └─> VERIFICATION.md
    │
    ├──> [Auditor] (optional, security gate)
    │        └─> AUDIT.md
    │
    ├──> [Simplifier] (optional, quality gate)
    │        └─> SIMPLIFICATION.md
    │
    ├──> [Documenter] (optional, completeness gate)
    │        └─> DOCUMENTATION.md
    │
    └──> Phase Output (updated ROADMAP.md, STATE.md)
```

**Gate Behavior:**
- **Critical gates (Reviewer CRITICAL_ISSUES):** Blocks progress, retries builder up to 2x
- **Final gates (Auditor CRITICAL at ship):** Blocks `/shipyard:ship`, requires user decision
- **Advisory gates (Simplifier, Documenter):** Non-blocking, user decides to implement/defer/dismiss

**Wave Parallelism:**
- Plans within a wave execute in parallel (independent builders)
- Waves execute sequentially (wave N+1 waits for wave N)
- Reviews run in parallel after all builders in a wave complete

**Evidence:** `commands/build.md` lines 42-237, `commands/plan.md` lines 52-128

### 4. Fresh Context Pattern (Subagent Isolation)

**Pattern:** Each agent receives a fresh context snapshot, preventing state leakage between tasks.

**Implementation:**
- Agents are dispatched as **subagents** via the Task tool
- Each agent receives only the context needed for its role (per **Agent Context Protocol**)
- No shared in-memory state between agent invocations
- All inter-agent communication happens through written artifacts (SUMMARY.md, REVIEW.md, etc.)
- Each agent starts with a clean 200k token context budget

**Context Scoping Examples:**

```
Builder Agent receives:
  - PLAN-{W}.{P}.md (the specific plan to execute)
  - CONTEXT-{N}.md (user decisions for this phase)
  - SUMMARY.md from previous waves (dependencies only)
  - Codebase docs (CONVENTIONS.md, STACK.md, ARCHITECTURE.md)
  - Working directory, branch, worktree status
  Total: ~30-60k tokens

Reviewer Agent receives:
  - PLAN-{W}.{P}.md (the spec to compare against)
  - SUMMARY-{W}.{P}.md (what was actually done)
  - Git diff of the plan's commits
  - CONTEXT-{N}.md (user intent)
  Total: ~20-40k tokens

Verifier Agent receives:
  - Phase goals from ROADMAP.md
  - All SUMMARY.md files for the phase
  - All REVIEW.md files for the phase
  - PROJECT.md for requirements context
  Total: ~15-30k tokens

No shared model state between Builder and Reviewer.
```

**Rationale:** Prevents agents from inheriting assumptions or context pollution from previous tasks. Each agent approaches its work with "fresh eyes" and focused context.

**Evidence:** `commands/build.md` lines 48-54 (builder dispatch), `docs/PROTOCOLS.md` lines 132-159 (Agent Context Protocol)

### 5. Wave-Based Parallelism (DAG Execution)

**Pattern:** Plans are organized into waves representing a dependency DAG, enabling parallel execution within each wave.

**Structure:**
```
Wave 1 (parallel execution):
  ├─ PLAN-1.1.md (independent)
  ├─ PLAN-1.2.md (independent)
  └─ PLAN-1.3.md (independent)

Wave 2 (waits for Wave 1, then parallel):
  ├─ PLAN-2.1.md (depends on 1.1)
  └─ PLAN-2.2.md (depends on 1.2, 1.3)

Wave 3 (waits for Wave 2):
  └─ PLAN-3.1.md (depends on all prior)
```

**Execution:**
- Command loops over waves sequentially
- Within a wave, dispatches all plan builders in parallel (via Task tool)
- Waits for all builders in wave N before starting wave N+1
- Review stage also parallelizes per plan (one reviewer per plan)

**Rationale:** Maximizes throughput by executing independent tasks concurrently while respecting dependencies. Simpler than full DAG scheduling but captures 80% of parallelization benefit.

**Evidence:** `commands/build.md` lines 43-45 "Group plans by wave number. Execute waves sequentially, plans within a wave in parallel."

### 6. State Machine Architecture

**Pattern:** Project state is a finite state machine with canonical transitions.

**States (from State Update Protocol):**
```
ready ──> planning ──> planned ──> building ──> complete ──> shipped
                                        │
                                        └──> blocked (internal state during retry)
```

**State Transitions:**
```
/shipyard:init      → ready
/shipyard:plan      → planning → planned
/shipyard:build     → building → complete (or blocked if critical issues)
/shipyard:ship      → shipped
/shipyard:recover   → (rebuilds state from artifacts)
```

**State Persistence:**
- `STATE.md` stores: current phase, position (human-readable), status, history
- Atomic writes via `state-write.sh` with validation
- History section appends every transition with timestamp
- Schema version 2.0 for future migrations

**Schema Example:**
```markdown
# Shipyard State

**Schema:** 2.0
**Last Updated:** 2026-02-03T15:30:00Z
**Current Phase:** 2
**Current Position:** Building phase 2, wave 1 complete
**Status:** building

## History
- [2026-02-03T14:00:00Z] Phase 1: complete
- [2026-02-03T14:30:00Z] Phase 2: planned
- [2026-02-03T15:00:00Z] Phase 2: building (started)
```

**Rationale:** Explicit state machine prevents invalid transitions (e.g., can't `/ship` when status is `planning`). History provides audit trail. Schema version enables future migrations.

**Evidence:** `scripts/state-write.sh` lines 110-118 (validate status against canonical list), `docs/PROTOCOLS.md` lines 157-177 (State Update Protocol)

### 7. Checkpoint-Based Rollback (Safety Net Pattern)

**Pattern:** Lightweight git tags enable rollback to known-good states at pipeline boundaries.

**Checkpoint Naming:**
```
shipyard-checkpoint-pre-build-phase-{N}-{timestamp}
shipyard-checkpoint-post-plan-phase-{N}-{timestamp}
shipyard-checkpoint-post-build-phase-{N}-{timestamp}
```

**Created At:**
- `pre-build-phase-{N}` before builder execution starts (build.md line 39)
- `post-plan-phase-{N}` after planning completes (plan.md line 148)
- `post-build-phase-{N}` after verification passes (build.md line 256)

**Usage:**
```bash
# List available checkpoints
git tag -l "shipyard-checkpoint-*"

# Rollback to pre-build state if build fails catastrophically
git reset --hard shipyard-checkpoint-pre-build-phase-2-20260203T150000Z

# Prune old checkpoints (older than 30 days)
checkpoint.sh --prune 30
```

**Implementation:**
- `scripts/checkpoint.sh` creates timestamped tags (66 lines)
- Commands call checkpoint script at strategic points
- `/shipyard:rollback` command lists and resets to chosen checkpoint

**Rationale:** Provides escape hatch when agents make mistakes or builds go wrong. Cheaper than git branches (no worktree overhead). Prunable to avoid tag clutter.

**Evidence:** `scripts/checkpoint.sh`, `commands/build.md` lines 38-39, 255-256, `commands/rollback.md`

### 8. Adaptive Context Loading (Tiered Injection)

**Pattern:** SessionStart hook injects context based on current project state, loading only what's needed.

**Context Tiers:**

| Tier | Loaded Files | Use Case | Token Cost |
|------|-------------|----------|------------|
| **minimal** | STATE.md only | Idle project, no .shipyard/ | ~500 tokens |
| **planning** | STATE.md + PROJECT.md + ROADMAP.md (first 80 lines) | Planning/status checks | ~1500 tokens |
| **execution** | planning + current phase plans (first 50 lines, max 3) + summaries (first 30 lines, max 3) + lessons (max 5) | Active building | ~2500 tokens |
| **full** | execution + codebase docs (first 40 lines each: STACK, ARCHITECTURE, CONVENTIONS, CONCERNS) | Comprehensive context | ~4000 tokens |

**Auto-Detection Logic:**
```bash
# From state-read.sh lines 96-103
if context_tier == "auto":
  case status in
    building|in_progress) → execution tier
    planning|planned|ready|shipped|complete) → planning tier
    *) → planning tier
  esac
```

**Implementation:**
1. `hooks.json` triggers `state-read.sh` on SessionStart
2. Script reads STATE.md to determine current status
3. Reads `config.json` for `context_tier` (default: "auto")
4. Auto-detects tier from status if "auto"
5. Loads appropriate files based on tier
6. Outputs JSON with `hookSpecificOutput.additionalContext`
7. Claude Code injects context into system prompt

**Token Reduction:** v2.0 reduced session context from ~6000 tokens (v1.x full skill injection) to ~1500 tokens (compact skill summaries + adaptive loading).

**Evidence:** `scripts/state-read.sh` lines 85-203, `hooks/hooks.json` lines 4-15

## Agent Roles and Responsibilities

### Planning Agents

**Researcher** (`agents/researcher.md`, 32 lines)
- **When:** Before architect during `/plan` (unless `--skip-research`)
- **Input:** Phase description from ROADMAP.md, codebase docs, PROJECT.md, CONTEXT-{N}.md
- **Output:** RESEARCH.md with technology options, recommendations, risks, documentation links
- **Model:** Sonnet (configurable via `model_routing.planning`)
- **Purpose:** Investigate technology choices and gather domain knowledge before planning

**Architect** (`agents/architect.md`, 62 lines)
- **When:** During `/init` (roadmap creation), `/plan` (plan decomposition), `/quick` (simplified plans)
- **Input:** PROJECT.md, RESEARCH.md (if exists), ROADMAP.md (for plans), CONTEXT-{N}.md
- **Output:** ROADMAP.md (max 7 phases) OR PLAN-*.md files (max 3 tasks per plan)
- **Constraints:** Max 3 tasks per plan, vertical slices preferred, wave assignment for dependencies
- **Model:** Opus for roadmaps (configurable via `model_routing.architecture`), Sonnet for plans (via `model_routing.planning`)
- **Purpose:** Decompose requirements into executable work with clear verification

### Execution Agents

**Builder** (`agents/builder.md`, 92 lines)
- **When:** During `/build` (per plan, parallel within wave), `/quick` (simplified workflow)
- **Input:** PLAN-*.md, CONTEXT-{N}.md, previous wave SUMMARY.md files, codebase docs
- **Output:** SUMMARY-*.md, atomic commits per task
- **Protocol:**
  - TDD-first when `tdd="true"` (write failing test, implement, verify)
  - IaC validation for `.tf`, `Dockerfile`, `playbook.yml` files
  - Checkpoint handling (pause on `checkpoint:human-verify` markers)
  - Atomic commits using Commit Convention
- **Model:** Sonnet (configurable via `model_routing.building`)
- **Purpose:** Execute plan tasks sequentially, following TDD and verification protocols

**Mapper** (`agents/mapper.md`, 27 lines)
- **When:** During `/init` for brownfield projects (4 parallel instances)
- **Input:** Entire codebase, focus area assignment
- **Output:**
  - Technology focus → STACK.md, INTEGRATIONS.md
  - Architecture focus → ARCHITECTURE.md, STRUCTURE.md
  - Quality focus → CONVENTIONS.md, TESTING.md
  - Concerns focus → CONCERNS.md
- **Model:** Sonnet
- **Purpose:** Analyze existing codebase and produce structured documentation

### Quality Gate Agents

**Reviewer** (`agents/reviewer.md`, 88 lines)
- **When:** After each builder completes during `/build` (parallel per plan)
- **Input:** PLAN.md, SUMMARY.md, git diff of commits, CONTEXT-{N}.md
- **Output:** REVIEW.md with 2-stage verdict (spec compliance + code quality)
- **Stages:**
  1. Spec Compliance: Does it match the plan? Missing/extra/incorrect features?
  2. Code Quality: SOLID principles, error handling, naming, test quality, security, performance
- **Severities:** Critical (blocks), Important (tracked), Suggestion (tracked)
- **Model:** Sonnet (configurable via `model_routing.review`)
- **Purpose:** Two-stage review to ensure correctness and quality

**Verifier** (`agents/verifier.md`, 99 lines)
- **When:** After plan creation (coverage check), after all builders complete (phase verification), before ship (final validation)
- **Input:** ROADMAP.md criteria, all PLAN.md files, all SUMMARY.md files, all REVIEW.md files
- **Output:** VERIFICATION.md with PASS/FAIL per criterion, evidence table
- **Checks:**
  - Plan verification: Coverage, verification commands, success criteria, dependencies, file conflicts
  - Build verification: Success criteria met, test suite passes, no critical review findings
  - Ship verification: All phase criteria, full test suite, integration points
  - IaC verification: Terraform validate/plan, Ansible lint/syntax-check, Docker build
- **Model:** Haiku (configurable via `model_routing.validation`)
- **Purpose:** Verify requirements met with concrete evidence

**Auditor** (`agents/auditor.md`, 143 lines)
- **When:** After phase verification (if `config.security_audit: true` and not `--light`), before ship (always, comprehensive)
- **Input:** Git diff of all phase/milestone changes, dependency manifests, codebase docs
- **Output:** AUDIT.md with Critical/Important/Advisory findings
- **Scope:**
  1. Code Security: OWASP Top 10 (injection, auth, access control, XSS, deserialization)
  2. Secrets Scanning: API keys, tokens, passwords, base64 credentials, .env files
  3. Dependency Audit: CVEs, lock files, version pinning, unnecessary dependencies
  4. IaC Security: Terraform (IAM, public resources, encryption), Ansible (secrets, privilege), Docker (root, secrets in layers)
  5. Docker Security: Base images, user config, attack surface
  6. Configuration Security: Debug mode, error messages, CORS, security headers
  7. Cross-Task Analysis: Auth/authz coherence, data flow security, error handling consistency
- **Gate Behavior:** CRITICAL findings block `/ship` (hard gate)
- **Model:** Sonnet (configurable via `model_routing.security_audit`)
- **Purpose:** Comprehensive security analysis across all changes

**Simplifier** (`agents/simplifier.md`, 145 lines)
- **When:** After phase verification (if `config.simplification_review: true` and not `--light`)
- **Input:** Git diff of all phase changes, all SUMMARY.md files, PROJECT.md
- **Output:** SIMPLIFICATION.md with High/Medium/Low priority findings
- **Focus:**
  1. Cross-Task Duplication: Exact, near, parallel patterns, config duplication (Rule of Three: 3+ occurrences → recommend extraction)
  2. Unnecessary Abstraction: One implementation, wrapper functions, unused factories
  3. Dead Code: Unused imports, uncalled functions, unread variables, commented code
  4. Complexity Hotspots: >40 lines, >3 nesting levels, >5 parameters, >10 cyclomatic complexity
  5. AI Bloat Patterns: Verbose error handling, redundant type checks, over-defensive null checks, wrapper functions used once
- **Gate Behavior:** Non-blocking, user decides: implement/defer/dismiss
- **Model:** Sonnet (configurable via `model_routing.review`)
- **Purpose:** Review cumulative effect of multiple builders for duplication and bloat

**Documenter** (`agents/documenter.md`, 91 lines)
- **When:** After phase verification (if `config.documentation_generation: true` and not `--light`), comprehensive at ship
- **Input:** Git diff of all changes, existing `docs/`, SUMMARY.md files, PROJECT.md
- **Output:** DOCUMENTATION.md + generated docs in `docs/`
- **Scope:**
  - API documentation: Public API reference in `docs/api/`
  - Architecture documentation: Patterns, layers, data flow in `docs/architecture/`
  - User guides: User-facing features in `docs/guides/`
  - README updates: New features and changes
  - Migration guides: Breaking changes
- **Gate Behavior:** Non-blocking at build, gaps flagged at ship
- **Model:** Sonnet (configurable via `model_routing.review`)
- **Purpose:** Generate comprehensive documentation for all changes

## Data Flow Patterns

### 1. Command → Agent Dispatch → Artifact Collection

**Full `/shipyard:build 2` Flow:**

```
1. User invokes: /shipyard:build 2

2. build.md (orchestrator):
   - Parse arguments: phase=2, --plan=None, --light=False
   - Read .shipyard/STATE.md → current_status, current_phase
   - Read .shipyard/ROADMAP.md → find phase 2 definition
   - Read .shipyard/config.json → gates, model_routing
   - Find plans: .shipyard/phases/2/plans/PLAN-*.md
   - Group by wave: {1: [PLAN-1.1, PLAN-1.2], 2: [PLAN-2.1]}

3. Update state:
   state-write.sh --phase 2 --status building

4. Create checkpoint:
   checkpoint.sh "pre-build-phase-2"

5. For wave 1 (parallel dispatch):
   Task(subagent_type: "shipyard:builder", model: config.model_routing.building, context: {
     plan: <PLAN-1.1.md>,
     conventions: <CONVENTIONS.md>,
     project: <PROJECT.md>,
     context: <CONTEXT-2.md>,
     previous: []
   })
   Task(subagent_type: "shipyard:builder", ..., context: {plan: <PLAN-1.2.md>, ...})

6. Builders execute (parallel):
   Builder 1.1:
     Task 1: Write test → Run (fail) → Implement → Verify → Commit
     Task 2: Implement → Verify → Commit
     Task 3: Implement → Verify → Commit
     Write SUMMARY-1.1.md
   Builder 1.2:
     (same sequence)
     Write SUMMARY-1.2.md

7. Collect results:
   Read SUMMARY-1.1.md → status: complete
   Read SUMMARY-1.2.md → status: complete

8. For wave 1 (parallel review):
   Task(subagent_type: "shipyard:reviewer", model: config.model_routing.review, context: {
     plan: <PLAN-1.1.md>,
     summary: <SUMMARY-1.1.md>,
     diff: <git diff for 1.1 commits>,
     context: <CONTEXT-2.md>
   })
   Task(subagent_type: "shipyard:reviewer", ..., context: {plan: <PLAN-1.2.md>, ...})

9. Reviewers execute (parallel):
   Reviewer 1.1:
     Stage 1: Spec compliance → PASS
     Stage 2: Code quality → PASS (with 2 Important findings)
     Write REVIEW-1.1.md
   Reviewer 1.2:
     Stage 1: Spec compliance → PASS
     Stage 2: Code quality → CRITICAL_ISSUES (security vulnerability)
     Write REVIEW-1.2.md

10. Handle critical issues:
    REVIEW-1.2.md has CRITICAL_ISSUES
    → Re-dispatch builder 1.2 with review feedback (retry 1)
    → Builder fixes critical issue
    → Re-run reviewer 1.2
    → REVIEW-1.2.md now PASS

11. Repeat steps 5-10 for wave 2 (waits for wave 1 complete)

12. After all waves complete:
    Task(subagent_type: "shipyard:verifier", model: config.model_routing.validation, context: {
      phase: <ROADMAP.md Phase 2>,
      summaries: [SUMMARY-1.1, SUMMARY-1.2, SUMMARY-2.1],
      reviews: [REVIEW-1.1, REVIEW-1.2, REVIEW-2.1],
      project: <PROJECT.md>
    })
    Write VERIFICATION.md → verdict: PASS

13. Optional gates (config allows, not --light):
    a. Auditor:
       Task(subagent_type: "shipyard:auditor", ..., context: {diff: <all phase changes>})
       → AUDIT.md → no CRITICAL findings
    b. Simplifier:
       Task(subagent_type: "shipyard:simplifier", ..., context: {diff: <all phase changes>})
       → SIMPLIFICATION.md → 2 High, 5 Medium findings
       → User chooses: defer to later
    c. Documenter:
       Task(subagent_type: "shipyard:documenter", ..., context: {diff: <all phase changes>})
       → DOCUMENTATION.md → 1 Critical gap (API docs missing)
       → User chooses: generate now
       → Documenter generates docs in docs/api/

14. Finalize:
    - Update ROADMAP.md: phase 2 status = complete
    - state-write.sh --phase 2 --status complete
    - git commit: "shipyard: complete phase 2 build"
    - checkpoint.sh "post-build-phase-2"
    - TaskUpdate(phase-2 task, status: completed)
    - Route user: "Phase 2 complete! Run /shipyard:plan 3 to plan next phase."
```

**Evidence:** `commands/build.md` lines 1-276

### 2. SessionStart Hook → Context Injection

**Flow:**

```
1. Claude session starts (new session, /resume, /clear, /compact)

2. Claude Code runtime reads hooks.json:
   "SessionStart": [{"command": "${CLAUDE_PLUGIN_ROOT}/scripts/state-read.sh"}]

3. Executes state-read.sh:
   a. Check if .shipyard/ exists
      - If no: Load "No Shipyard Project" context, suggest /shipyard:init
      - If yes: Continue to b

   b. Read STATE.md:
      status=$(sed -n 's/^.*\*\*Status:\*\* \(.*\)$/\1/p' STATE.md)
      phase=$(sed -n 's/^.*\*\*Current Phase:\*\* \([0-9]*\).*$/\1/p' STATE.md)

   c. Validate STATE.md:
      - Check for required fields (Status, Current Phase)
      - If missing: exit 2 (state corruption), suggest recovery

   d. Read config.json:
      context_tier=$(jq -r '.context_tier // "auto"' config.json)

   e. Determine tier (if auto):
      building|in_progress → execution
      planning|planned|ready|shipped → planning

   f. Load files per tier:
      minimal: STATE.md
      planning: + PROJECT.md, ROADMAP.md (first 80 lines)
      execution: + plans (first 50 lines, max 3), summaries (first 30 lines, max 3), lessons (max 5)
      full: + codebase docs (first 40 lines each)

   g. Build compact skill summary:
      ## Shipyard Skills & Commands
      **Skills**: shipyard:using-shipyard, shipyard:tdd, ...
      **Triggers**: File patterns, task markers, state conditions, content patterns
      **Commands**: /init, /plan, /build, /ship, ...

   h. Build suggestion:
      status=ready → "/shipyard:plan 1"
      status=planned → "/shipyard:build 1"
      status=building → "/shipyard:resume"
      status=complete → check next phase or "/shipyard:ship"

   i. Output JSON:
      {
        "hookSpecificOutput": {
          "hookEventName": "SessionStart",
          "additionalContext": "<state>\n<skill summary>\n<suggestion>"
        }
      }

4. Claude Code injects additionalContext into system context

5. User's first message has:
   - Current phase, status, position
   - Relevant project context (tier-appropriate)
   - Compact skill catalog
   - Suggested next command
   - Total: ~1500-2500 tokens (vs ~6000 in v1.x)
```

**Evidence:** `scripts/state-read.sh` lines 45-261, `hooks/hooks.json` lines 4-15

### 3. State Recovery from Artifacts

**Trigger:** Corrupted STATE.md or `/shipyard:recover` command

```
1. User runs: /shipyard:recover
   OR: state-write.sh --recover

2. state-write.sh --recover logic:
   a. Find latest phase:
      latest_phase=$(find .shipyard/phases/ -maxdepth 1 -type d |
                     sed 's|.*/||' | grep '^[0-9]' | sort -n | tail -1)

   b. Determine status from artifacts:
      if .shipyard/phases/{N}/results/SUMMARY-*.md exists:
        status=complete
      elif .shipyard/phases/{N}/plans/PLAN-*.md exists:
        status=planned
      else:
        status=ready

   c. Extract checkpoint history:
      git tag -l "shipyard-checkpoint-*" | while read tag; do
        extract timestamp and label
        append to history
      done

   d. Build STATE.md:
      # Shipyard State
      **Schema:** 2.0
      **Last Updated:** {timestamp}
      **Current Phase:** {latest_phase}
      **Current Position:** Phase {latest_phase} {status} (recovered)
      **Status:** {status}

      ## History
      - [{timestamp}] State recovered from .shipyard/ artifacts
      {checkpoint history}

   e. Atomic write (temp file + mv)

3. Next session start:
   - state-read.sh reads recovered STATE.md
   - Loads context based on recovered status
   - Suggests next action

4. Native tasks rebuilt:
   - /shipyard:status checks TaskList
   - If stale: TaskCreate for each phase/plan from ROADMAP.md and artifact existence
```

**Evidence:** `scripts/state-write.sh` lines 120-176, `commands/recover.md`

## Extension Points

### 1. New Agents

**To add a new agent:**

1. Create `agents/new-agent.md` with YAML frontmatter:
```yaml
---
name: new-agent
description: |
  Use when {conditions}. Examples: <example>...</example>
model: opus | sonnet | haiku | inherit
color: blue | green | yellow | red | cyan | magenta
---
```

2. Define agent protocol (input, output, rules)

3. Dispatch from command:
```
Task(subagent_type: "shipyard:new-agent", model: {from config or default}, context: {...})
```

4. Reference existing protocols or create new ones in `docs/PROTOCOLS.md`

**Example:** Adding a "performance-profiler" agent that runs after build to identify bottlenecks.

### 2. New Commands

**To add a new command:**

1. Create `commands/new-command.md` with YAML frontmatter:
```yaml
---
description: "User-visible help text"
disable-model-invocation: true
argument-hint: "[args] [--flags]"
---
```

2. Reference existing protocols for state management, agent context, model routing

3. Dispatch existing or new agents as needed

4. Update STATE.md via State Update Protocol

**Example:** Adding a `/migrate` command for database migrations that dispatches a builder with migration-specific context.

### 3. New Protocols

**To add a new protocol:**

1. Add to `docs/PROTOCOLS.md` with clear structure:
   - Protocol name
   - When to use
   - Steps/rules
   - Example format

2. Reference from commands and agents with markdown links

3. Version the protocol if it changes behavior

**Example:** Adding a "Rollback Verification Protocol" for safer rollback operations.

### 4. New Skills

**To add a new skill:**

1. Create `skills/skill-name/SKILL.md`:
```yaml
---
name: skill-identifier
description: Trigger conditions - when this skill activates
---

<!-- TOKEN BUDGET: 300 lines / ~900 tokens -->
```

2. Define triggers (file patterns, task markers, state conditions, content patterns)

3. Add to skill summary in `state-read.sh` (lines 20-44)

4. Invoke via Skill tool from commands or agents

**Example:** Adding a "mobile-testing" skill for iOS/Android validation.

### 5. Custom Quality Gates

**To add a new quality gate:**

1. Create an agent that produces a verdict (PASS/FAIL or priority levels)

2. Add gate to `/build` pipeline after verification:
```markdown
## Step 4d: License Compliance

**Skip if:** `--light` flag OR `config.license_audit: false`

Dispatch **license-auditor agent** with:
- All dependency manifests (package.json, Cargo.toml, go.mod)
- Allowed licenses list from config.json

Produce `LICENSE-AUDIT.md`.

If incompatible licenses found:
  - Display findings
  - User decides: remove dependency / accept risk / defer
```

3. Define blocking behavior (critical blocks, advisory allows choice)

4. Update Issue Tracking Protocol if non-blocking findings should persist

**Example:** Adding a "license-compliance" gate to check dependency licenses against whitelist.

## Design Rationale

### Why Markdown-Based Agent Definitions?

**Decision:** Agent definitions are markdown files with YAML frontmatter, not code.

**Rationale:**
- Claude Code plugin system loads markdown as prompts
- YAML frontmatter provides metadata (model tier, color, dispatch examples)
- Markdown body is the agent's system prompt
- Version-controlled, human-readable, easy to evolve
- No compilation step, can be edited in any text editor

**Tradeoff:** Less expressive than code, but more transparent and easier for non-programmers to understand and modify.

### Why Artifact-Based Communication?

**Decision:** Agents communicate via written artifacts (SUMMARY.md, REVIEW.md), not API calls or shared memory.

**Rationale:**
- **Auditability:** Every intermediate result is saved to disk
- **Resumability:** Can restart from any point using artifacts
- **Debugging:** Inspect artifacts to understand agent decisions
- **Human-in-loop:** User can read and edit artifacts between stages
- **Git-tracked:** All decisions version-controlled
- **Language-agnostic:** Markdown is universally readable

**Tradeoff:** More I/O overhead, but dramatically better debuggability and transparency.

### Why Wave-Based Parallelism Instead of Full DAG?

**Decision:** Plans are grouped into waves (coarse-grained parallelism), not a fine-grained DAG.

**Rationale:**
- Simpler mental model for users (wave 1, wave 2, wave 3)
- Easier to visualize and communicate
- Reduces scheduling complexity (no dynamic topological sort)
- Still captures 80% of parallelization benefit
- Easier to debug (clear wave boundaries in artifacts)

**Tradeoff:** Less optimal than full DAG scheduling, but much simpler to understand and debug.

### Why Separate Auditor/Simplifier/Documenter from Reviewer?

**Decision:** Three separate quality gate agents instead of one "quality checker."

**Rationale:**
- **Different timing:** Reviewer runs per-plan, others run per-phase (see cumulative changes)
- **Different scope:** Reviewer sees one plan, others see cross-plan interactions
- **Different expertise:** Security audit requires different skills than code simplification
- **Different blocking behavior:** Auditor can block ship, simplifier never blocks
- **Parallelizability:** Could run auditor/simplifier/documenter in parallel (future enhancement)

**Tradeoff:** More agents to maintain, but clearer separation of concerns and better gate control.

### Why Haiku for Verifier?

**Decision:** Verifier defaults to Haiku (smallest, fastest model).

**Rationale:**
- Verification is mostly mechanical (run tests, check criteria against evidence)
- Doesn't require creative problem-solving or deep reasoning
- Runs frequently (after planning, after build, before ship)
- Cost optimization without quality loss
- Still catches issues (test failures, missing criteria)

**Tradeoff:** Haiku might miss nuanced verification needs, but can be overridden with `model_routing.validation: "sonnet"` in config.

### Why Atomic Commits Per Task?

**Decision:** Builder creates one commit per task, not one per plan or one per phase.

**Rationale:**
- Enables git bisect for debugging
- Clear atomic units of work
- Easier to review in PR (see commit-by-commit progress)
- Aligns with task verification (if task passes, commit it)
- Better rollback granularity (revert individual task)

**Tradeoff:** More commits (noisier git log), but better granularity for debugging and rollback.

### Why Adaptive Context Loading?

**Decision:** SessionStart hook injects different context tiers based on current state.

**Rationale:**
- **Token efficiency:** Don't load execution context when planning, or vice versa
- **Relevance:** Context matches current workflow stage
- **Zero user action:** Automatic on every session start
- **Always current:** Reads latest STATE.md
- **Configurable:** User can override with explicit tier in config.json

**Tradeoff:** Adds bash hook and jq dependency, but dramatically improves token efficiency (~6000 → ~1500 tokens).

## Performance Characteristics

### Parallelization

- **Plan execution:** Up to N plans in a wave execute concurrently (N = plans in wave)
- **Review stage:** Up to N reviewers run concurrently (one per plan)
- **Codebase mapping:** 4 mapper agents run concurrently (Technology, Architecture, Quality, Concerns)

### Bottlenecks

- **Sequential waves:** Wave N+1 waits for all plans in wave N (by design for dependency safety)
- **Auditor/Simplifier/Documenter:** Run sequentially after verification (could be parallelized)
- **Model rate limits:** Parallel agent dispatch may hit API rate limits

### Scalability Limits

- **Max 7 phases per milestone** (architect constraint for manageable scope)
- **Max 3 tasks per plan** (architect constraint for context budget)
- **No theoretical limit on plans per wave** (practical limit is file conflicts)

## Security Architecture

### Secrets Management

- **Never commit secrets:** Auditor scans all files for API keys, tokens, passwords
- **Environment-based config:** PROJECT.md and config.json never contain secrets
- **Checkpoint safety:** Checkpoints are git tags (no secret exposure)

### Code Execution Isolation

- **No eval/exec in agents:** Agents produce markdown artifacts, not executable code
- **Verification commands run in user's shell:** User controls execution environment
- **IaC dry-run:** Terraform/Ansible validation never applies changes (plan/syntax-check only)

### Trust Boundaries

- **User input:** Commands trust user input (phase numbers, flags) after validation
- **Agent output:** Commands validate agent artifacts before progressing (check for required sections)
- **External APIs:** No external API calls except through user's tools (gh CLI, terraform, etc.)

## Key File References

- **Protocol definitions:** `docs/PROTOCOLS.md` (12 protocols, 252 lines)
- **State management:** `scripts/state-read.sh` (264 lines), `scripts/state-write.sh` (232 lines)
- **Session lifecycle:** `hooks/hooks.json` (16 lines)
- **Build pipeline:** `commands/build.md` (276 lines)
- **Plan creation:** `commands/plan.md` (174 lines)
- **Initialization:** `commands/init.md` (165 lines)
- **Delivery:** `commands/ship.md` (288 lines)
- **Agent definitions:** `agents/*.md` (9 agents, 27-145 lines each)
- **Skills:** `skills/*/SKILL.md` (16 skills, ~300-450 lines average)
