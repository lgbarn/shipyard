# Shipyard Directory Structure

**Last Updated:** 2026-02-03
**Analyzed Version:** 2.3.0
**Schema:** Directory layout and file organization

## Root Layout

```
shipyard/
├── .claude/                  # Claude Code session settings (local, not committed)
├── .claude-plugin/           # Plugin metadata for Claude Code marketplace
├── .git/                     # Git repository
├── .gitignore                # Git ignore patterns
├── .npmignore                # npm package exclusions
├── .shipyard/                # Shipyard's own project state (dogfooding)
├── agents/                   # Specialized subagent definitions (9 agents)
├── CHANGELOG.md              # Version history following Keep a Changelog
├── commands/                 # Slash command definitions (12 commands)
├── CONTRIBUTING.md           # Plugin development guide
├── docs/                     # Plugin documentation
├── hooks/                    # Session lifecycle hooks
├── LICENSE                   # MIT license
├── node_modules/             # npm dependencies (bats test framework)
├── package.json              # npm package metadata and system dependencies
├── package-lock.json         # npm dependency lockfile
├── README.md                 # User documentation
├── scripts/                  # State management utilities (3 bash scripts)
├── skills/                   # Auto-activating behavioral protocols (16 skills)
└── test/                     # bats-core test suite (42 tests)
```

## Directory Purpose Annotations

### `.claude-plugin/` - Plugin Registration

**Purpose:** Declares the plugin to Claude Code's plugin system.

**Evidence:** `/Users/lgbarn/Personal/shipyard/.claude-plugin/`

**Contents:**
```
.claude-plugin/
├── marketplace.json    # Marketplace metadata (version 2.3.0, category: development-lifecycle)
└── plugin.json         # Plugin definition (name, description, author)
```

**File Details:**

- **plugin.json** (minimal schema):
  ```json
  {
    "name": "shipyard",
    "description": "Ship software systematically...",
    "author": {"name": "lgbarn", "email": "..."}
  }
  ```
  - No `source` path (defaults to plugin root)
  - Loaded by Claude Code at plugin installation

- **marketplace.json**:
  - Version, category, keywords
  - Used for marketplace listing

**Loaded By:** Claude Code plugin system on installation

---

### `agents/` - Agent Definitions

**Purpose:** Markdown specifications for specialized subagents dispatched by commands.

**Evidence:** `/Users/lgbarn/Personal/shipyard/agents/`

**Pattern:** One file per agent, named `{agent-name}.md`

**Contents:**
```
agents/
├── architect.md          # Roadmap and plan decomposition (opus, blue)
├── auditor.md            # Security and compliance analysis (sonnet, red)
├── builder.md            # Task execution with TDD (inherit, green)
├── documenter.md         # Documentation generation (sonnet, cyan)
├── mapper.md             # Brownfield codebase analysis (sonnet, cyan)
├── researcher.md         # Domain/technology research (sonnet, magenta)
├── reviewer.md           # Two-stage code review (sonnet, yellow)
├── simplifier.md         # Complexity and duplication analysis (sonnet, magenta)
└── verifier.md           # Post-execution verification (haiku, green)
```

**File Structure:**
```yaml
---
name: agent-name                          # Used in Task tool dispatch
description: |                            # When to use (with <example> tags)
  Use when {conditions}. Examples...
model: opus | sonnet | haiku | inherit    # Default model (overridden by config.model_routing)
color: blue | green | yellow | red | ...  # UI color for agent output
---

You are a {Role}. Your job is to {purpose}.

## Protocol
[Step-by-step execution instructions]

## Absolute Rules
- NEVER {anti-pattern}
- ALWAYS {required-behavior}
```

**File Sizes:**
- mapper: 2.7k tokens (27 lines of protocol)
- researcher: 2.8k tokens (specialized for research)
- architect: 3.4k tokens (62 lines, goal-backward methodology)
- builder: 6.2k tokens (92 lines, TDD + IaC protocols)
- reviewer: 4.5k tokens (two-stage review logic)
- verifier: 5.4k tokens (comprehensive validation)
- auditor: 6.5k tokens (OWASP + secrets + dependencies + IaC security)
- simplifier: 6.8k tokens (cross-task pattern detection)
- documenter: 5.6k tokens (documentation needs analysis)

**Usage:**
- Dispatched via Task tool: `Task(subagent_type: "shipyard:{agent-name}")`
- Agents run in isolated contexts with curated input bundles
- Produce structured markdown artifacts in `.shipyard/phases/{N}/` directories

**Key Agents:**

- **mapper** - Brownfield analysis (4 parallel instances during `/shipyard:init`)
  - Technology focus → STACK.md, INTEGRATIONS.md
  - Architecture focus → ARCHITECTURE.md, STRUCTURE.md
  - Quality focus → CONVENTIONS.md, TESTING.md
  - Concerns focus → CONCERNS.md

- **architect** - Requirements decomposition
  - Roadmaps: `.shipyard/ROADMAP.md`
  - Plans: `.shipyard/phases/{N}/plans/PLAN-{W}.{P}.md`
  - Max 3 tasks per plan (hard limit)

- **builder** - Implementation
  - Executes tasks sequentially from PLAN.md
  - TDD enforcement when `tdd="true"`
  - Atomic commits per task
  - IaC validation for Terraform/Ansible/Docker
  - Output: SUMMARY-{W}.{P}.md

- **reviewer** - Code review
  - Stage 1: Spec compliance (objective)
  - Stage 2: Code quality (SOLID, security, performance)
  - Output: REVIEW-{W}.{P}.md with verdict

- **verifier** - Success criteria validation
  - Runs tests, checks acceptance criteria
  - IaC validation
  - Output: VERIFICATION.md

- **auditor** - Cross-task security analysis
  - OWASP Top 10, secrets scanning
  - Dependency CVE checks
  - IaC security (Terraform, Ansible, Docker)
  - Output: AUDIT-{N}.md

- **simplifier** - Code quality across tasks
  - Detects cross-task duplication
  - Identifies dead code, unnecessary abstractions
  - Flags AI bloat patterns
  - Output: SIMPLIFICATION-{N}.md

- **documenter** - Documentation generation
  - Analyzes changes for documentation needs
  - API docs, architecture docs, user-facing docs
  - Output: DOCUMENTATION-{N}.md

---

### `commands/` - Command Definitions

**Purpose:** Markdown specifications for slash commands that orchestrate workflows.

**Evidence:** `/Users/lgbarn/Personal/shipyard/commands/`

**Pattern:** One file per command, named `{command-name}.md`

**Contents:**
```
commands/
├── build.md              # Execute plans with parallel agents (276 lines)
├── init.md               # Initialize project (165 lines)
├── issues.md             # View and manage deferred issues
├── move-docs.md          # Move codebase docs between locations
├── plan.md               # Decompose phases into plans
├── quick.md              # Quick single-task execution
├── recover.md            # Diagnose and recover from errors
├── resume.md             # Restore context from previous session
├── rollback.md           # Revert to checkpoint
├── ship.md               # Finalize and deliver
├── status.md             # Show progress and route
└── worktree.md           # Manage git worktrees
```

**File Structure:**
```yaml
---
description: "What this command does (user-facing)"
disable-model-invocation: true           # Commands orchestrate, don't execute
argument-hint: "[args] [--flags]"        # CLI syntax guidance
---

# /shipyard:{command-name} - Title

## Step 0: Parse Arguments
## Step 1: Validate State
## Step 2: Dispatch Agents
## Step N: Route Forward
```

**Command Categories:**

**Lifecycle Commands (core workflow):**
- `init.md` (165 lines) - Project bootstrapping
  - Brownfield: 4 parallel mapper agents → codebase analysis
  - Greenfield: skip to brainstorming
  - Brainstorming skill → PROJECT.md
  - Workflow preferences → config.json
  - Architect agent → ROADMAP.md
  - Create native tasks, STATE.md, checkpoint

- `plan.md` - Research and phase decomposition
  - Researcher agent (optional, unless `--skip-research`) → RESEARCH.md
  - Architect agent → PLAN-{W}.{P}.md files
  - Verifier agent → validate plans
  - Create native tasks for plans

- `build.md` (276 lines) - Parallel execution with quality gates
  - Wave-based orchestration (plans within wave run parallel)
  - Builder agents (parallel) → SUMMARY.md
  - Reviewer agents (parallel) → REVIEW.md
  - Verifier agent → VERIFICATION.md
  - Optional gates: auditor, simplifier, documenter

- `ship.md` - Final verification and delivery
  - Comprehensive verification and audit
  - Options: merge to main, create PR, preserve branch
  - Lessons learned capture
  - STATE.md → shipped

**Navigation Commands (session management):**
- `status.md` - Progress dashboard
  - Reads STATE.md, ROADMAP.md
  - Shows phase/plan completion
  - Routes to next command based on status

- `resume.md` - Context restoration
  - Rebuilds native tasks from .shipyard/ files
  - Suggests continuation point

**Utility Commands (supporting workflows):**
- `quick.md` - Simplified workflow
  - Architect agent → simplified plan
  - Builder agent → execution
  - Reviewer agent → basic review
  - Bypasses full planning overhead

- `issues.md` - Issue tracking
  - `--add` - append to ISSUES.md
  - `--resolve` - mark issue as resolved
  - `--list` - display open issues

- `rollback.md` - Checkpoint-based reversion
  - `--list` - show available checkpoints
  - Revert to `shipyard-checkpoint-{label}-{timestamp}` git tag

- `recover.md` - State diagnosis and recovery
  - Validates STATE.md integrity
  - Calls `state-write.sh --recover` if corrupted

- `worktree.md` - Isolated feature development
  - Wraps git-workflow skill
  - `create`, `list`, `switch`, `remove` operations

- `move-docs.md` - Codebase docs migration
  - Move between `.shipyard/codebase/` and `docs/codebase/`
  - Updates config.json codebase_docs_path

**Orchestration Pattern:**
1. Parse arguments and validate
2. Read state from `.shipyard/`
3. Dispatch agents (via Task tool with Agent Context Protocol)
4. Update state (via state-write.sh)
5. Create checkpoints (via checkpoint.sh)
6. Commit artifacts
7. Route forward with suggestions

**Token Cost:** Commands are 5-10k tokens (orchestration-heavy, minimal direct implementation).

---

### `hooks/` - Session Lifecycle Integration

**Purpose:** Integrate with Claude Code's session lifecycle to inject context.

**Evidence:** `/Users/lgbarn/Personal/shipyard/hooks/`

**Contents:**
```
hooks/
└── hooks.json            # SessionStart hook configuration (schemaVersion: 2.0)
```

**Hook Configuration:**
```json
{
  "schemaVersion": "2.0",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/state-read.sh"
          }
        ]
      }
    ]
  }
}
```

**Behavior:**
- Fires on session start events: startup, resume, clear, compact
- Executes `state-read.sh` to inject adaptive context
- Injects compact skill summary (~1500 tokens vs ~6000 in v1.x)
- Provides command suggestions based on current STATE.md status

**Context Injection Flow:**
1. Session starts
2. Hook executes state-read.sh
3. Script determines context tier (auto → map status to tier)
4. Script loads files per tier (minimal/planning/execution/full)
5. Script outputs JSON with `hookSpecificOutput.additionalContext`
6. Claude Code injects context into system prompt

---

### `scripts/` - State Management Utilities

**Purpose:** Shell scripts for state persistence and context management.

**Evidence:** `/Users/lgbarn/Personal/shipyard/scripts/`

**Contents:**
```
scripts/
├── checkpoint.sh         # Git tag-based checkpoint management (66 lines)
├── state-read.sh         # Adaptive context loading at session start (264 lines)
└── state-write.sh        # Updates .shipyard/STATE.md (232 lines)
```

**Script Details:**

**1. state-read.sh** (264 lines)
- **Purpose:** SessionStart hook to inject adaptive context
- **Dependencies:** jq 1.6+
- **Inputs:**
  - `.shipyard/STATE.md` (extracts status, phase)
  - `.shipyard/config.json` (reads `context_tier`)
  - `.shipyard/PROJECT.md`, `ROADMAP.md`, phase files (conditional)
- **Outputs:** JSON for SessionStart hook
  ```json
  {
    "hookSpecificOutput": {
      "hookEventName": "SessionStart",
      "additionalContext": "..."
    }
  }
  ```
- **Context Tiers:**
  - `minimal` (~500 tokens): STATE.md only
  - `planning` (~1500 tokens): + PROJECT.md, ROADMAP.md (first 80 lines)
  - `execution` (~2500 tokens): + phase plans (first 50 lines, max 3), summaries (first 30 lines, max 3), lessons (max 5)
  - `full` (~4000 tokens): + codebase docs (STACK, ARCHITECTURE, CONVENTIONS, CONCERNS - first 40 lines each)
  - `auto` (default): Maps status to tier (building → execution, planning → planning)
- **Exit Codes:** 0 (success), 2 (state corruption), 3 (missing jq)
- **Token Reduction:** v2.0 reduced from ~6000 tokens (full skill injection) to ~1500 tokens (compact summaries)

**2. state-write.sh** (232 lines)
- **Purpose:** Atomically update STATE.md with structured writes
- **Inputs:**
  - `--phase N` (phase number, must be positive integer)
  - `--position "text"` (human-readable position)
  - `--status value` (enum: ready|planning|planned|building|complete|shipped|blocked|paused)
  - `--raw "content"` (raw STATE.md content for direct write)
  - `--recover` (rebuild STATE.md from phase artifacts)
- **Outputs:** Updated STATE.md (atomic via temp file + `mv`)
- **Recovery Mode:**
  1. Finds latest phase from `.shipyard/phases/` directories
  2. Checks for SUMMARY.md (complete), PLAN.md (planned), or neither (ready)
  3. Extracts checkpoint history from git tags
  4. Builds new STATE.md with Schema 2.0
- **Safety Features:**
  - Atomic writes (temp file + `mv` - POSIX-atomic)
  - Input validation (regex checks on all parameters)
  - Post-write validation (checks non-empty)
- **Exit Codes:** 0 (success), 1 (invalid args), 2 (write failed), 3 (missing .shipyard/)

**3. checkpoint.sh** (66 lines)
- **Purpose:** Git tag management for rollback points
- **Inputs:**
  - `<label>` (checkpoint label - sanitized to alphanumeric + `.` `_` `-`, max 64 chars)
  - `--prune [days]` (remove checkpoints older than N days, default 30)
- **Outputs:** Git tags with format `shipyard-checkpoint-{label}-{timestamp}`
  - Timestamp format: `YYYYMMDDTHHMMSSZ` (e.g., `20260203T180000Z`)
- **Features:**
  - Label sanitization (prevents git flag injection)
  - Prune by date (parses timestamp from tag name)
  - Dirty worktree warnings
- **Exit Codes:** 0 (success/warning), 1 (invalid args), 3 (git failed)
- **Standard Checkpoints:**
  - `pre-build-phase-{N}` - before build execution
  - `post-plan-phase-{N}` - after planning completes
  - `post-build-phase-{N}` - after build and verification

**Script Standards:**
- Strict mode: `set -euo pipefail`
- Shellcheck compliance: `--severity=style` passes (all 3 scripts)
- Format string injection protection: uses `printf '%s'` instead of `printf '%b'`
- Path traversal prevention
- Exit code discipline (0=success, 1=user error, 2=corruption, 3=dependency missing)

---

### `skills/` - Auto-Activating Behavioral Protocols

**Purpose:** Reusable behavioral protocols that activate based on deterministic triggers.

**Evidence:** `/Users/lgbarn/Personal/shipyard/skills/`

**Pattern:** One subdirectory per skill, each containing `SKILL.md`

**Contents:**
```
skills/
├── code-simplification/
│   └── SKILL.md          # Duplication and bloat detection (~900 tokens)
├── documentation/
│   └── SKILL.md          # Documentation generation patterns
├── git-workflow/
│   └── SKILL.md          # Branch management and worktrees (375 lines, ~1350 tokens)
├── infrastructure-validation/
│   └── SKILL.md          # Terraform/Ansible/Docker workflows
├── lessons-learned/
│   └── SKILL.md          # Post-phase reflection and lesson capture
├── parallel-dispatch/
│   └── SKILL.md          # Concurrent agent orchestration
├── security-audit/
│   └── SKILL.md          # OWASP, secrets, CVE scanning
├── shipyard-brainstorming/
│   └── SKILL.md          # Requirements exploration via Socratic dialogue
├── shipyard-debugging/
│   └── SKILL.md          # Root cause investigation before fixes
├── shipyard-executing-plans/
│   └── SKILL.md          # Execution workflow with checkpoint handling
├── shipyard-tdd/
│   └── SKILL.md          # Red-Green-Refactor enforcement (10k tokens)
├── shipyard-testing/
│   └── SKILL.md          # Writing effective, maintainable tests
├── shipyard-verification/
│   └── SKILL.md          # Evidence-based completion
├── shipyard-writing-plans/
│   └── SKILL.md          # Plan structure (max 3 tasks, wave assignment)
├── shipyard-writing-skills/
│   └── SKILL.md          # Skill authoring guide (<500 lines after v2.0 trimming)
└── using-shipyard/
    └── SKILL.md          # Skill discovery protocol (180 lines, ~8.3k tokens)
```

**Skill File Structure:**
```yaml
---
name: skill-identifier           # Used in Skill tool invocation
description: Trigger conditions  # When this skill activates (for auto-activation)
---

<!-- TOKEN BUDGET: N lines / ~N tokens -->

# Skill Name

## Activation Triggers
- File pattern: *.ext
- Task marker: marker="value"
- State condition: about to do X
- Content pattern: keyword in output

## Overview
Brief purpose and principle

## Protocol
Step-by-step guidelines (rigid or flexible)

## Red Flags
Common mistakes to avoid
```

**Skill Categories:**

**Process Skills (how to approach work):**
- `shipyard-brainstorming/` - Requirements exploration
  - Socratic dialogue with user
  - Decision capture to CONTEXT-{N}.md
  - Triggers: design discussion, feature exploration

- `shipyard-debugging/` - Root cause investigation (rigid)
  - Systematic debugging before fixes
  - Evidence collection protocol
  - Triggers: error, exception, traceback, test failure

- `shipyard-verification/` - Evidence-based completion (rigid)
  - Never claim "done" without proof
  - Verification checklist
  - Triggers: about to claim "done", "complete", "fixed"

- `shipyard-tdd/` - Red-Green-Refactor enforcement (rigid, 10k tokens)
  - No production code without failing test first
  - Test-first discipline
  - Triggers: `tdd="true"` in plan, `*.test.*`, `*.spec.*` files

- `shipyard-testing/` - Writing effective tests
  - Test structure and maintainability
  - Coverage patterns

**Implementation Skills (how to execute):**
- `shipyard-executing-plans/` - Execution workflow
  - Plan reading protocol
  - Checkpoint handling
  - Artifact production (SUMMARY.md)
  - Triggers: plan file loaded for execution

- `shipyard-writing-plans/` - Plan structure
  - Max 3 tasks per plan (hard limit)
  - Wave assignment for parallelism
  - Verification criteria
  - Triggers: creating implementation plan

- `parallel-dispatch/` - Concurrent agent orchestration
  - Independent task detection
  - Parallel wave execution
  - Triggers: 2+ independent tasks with no shared state

**Quality Skills (how to ensure rigor):**
- `security-audit/` - Security analysis
  - OWASP Top 10 checks
  - Secrets scanning (plaintext credentials, API keys, private keys)
  - Dependency CVE checks
  - IaC security (Terraform, Ansible, Docker)
  - Triggers: "security", "vulnerability", "CVE", "OWASP" in content

- `code-simplification/` - Quality analysis
  - Cross-task duplication detection
  - Dead code identification
  - AI bloat patterns
  - Triggers: "duplicate", "complex", "bloat", "refactor" in content

- `infrastructure-validation/` - IaC workflows
  - Terraform: `fmt`, `validate`, `plan` (never `apply` without review)
  - Ansible: `ansible-lint`, `--syntax-check`
  - Docker: `hadolint`, `build`, `compose config`
  - Triggers: `*.tf`, `*.tfvars`, `Dockerfile`, `docker-compose.yml`, `playbook*.yml`

**Integration Skills (how to integrate with ecosystem):**
- `git-workflow/` (375 lines, ~1350 tokens) - Branch management
  - Worktree creation/switching (with safety verification)
  - Atomic commits per task
  - Completion modes: merge, PR, preserve, discard
  - Triggers: branch management, starting feature work, delivery

- `documentation/` - Documentation generation
  - API documentation needs analysis
  - Architecture documentation updates
  - User-facing docs for features
  - Triggers: "document", "README", "API docs", "changelog" in content

- `lessons-learned/` - Post-phase reflection
  - Captures discoveries, surprises, mistakes
  - Seeds from SUMMARY.md "Issues Encountered" sections
  - Appends to `.shipyard/LESSONS.md`

**Meta Skills:**
- `using-shipyard/` (180 lines, ~8.3k tokens) - Skill discovery protocol
  - Loaded at every session start via state-read.sh
  - Defines all 4 trigger types (file, task, state, content)
  - Lists all available commands and skills
  - Enforcement protocol: "If 1% chance applies, invoke skill"

- `shipyard-writing-skills/` (<500 lines after v2.0 trimming) - Skill authoring guide
  - Skill structure templates
  - Token budget tracking
  - Testing patterns
  - Triggers: creating or editing a skill file

**Token Budget Tracking:** All skills include token budget comments:
```markdown
<!-- TOKEN BUDGET: 300 lines / ~900 tokens -->
```

**Skill Sizes (approximate):**
- Small: ~300 lines, ~900 tokens (code-simplification, documentation, parallel-dispatch)
- Medium: ~400 lines, ~1200 tokens (most skills)
- Large: ~500 lines, ~1500 tokens (git-workflow)
- Rigid: ~10k tokens (shipyard-tdd - detailed protocol)
- Meta: ~8.3k tokens (using-shipyard - comprehensive reference)

**Trigger System (4 types):**
1. **File Pattern Triggers:** `*.tf` → infrastructure-validation
2. **Task Marker Triggers:** `tdd="true"` → shipyard-tdd
3. **State Condition Triggers:** claiming "done" → shipyard-verification
4. **Content Pattern Triggers:** "security" → security-audit

---

### `test/` - Test Suite

**Purpose:** bats-core test suite for bash scripts (dev-only, not published to npm).

**Evidence:** `/Users/lgbarn/Personal/shipyard/test/`

**Contents:**
```
test/
├── checkpoint.bats       # checkpoint.sh tests (create, prune, validation)
├── e2e-smoke.bats        # End-to-end smoke tests (write→read→checkpoint→prune→recover)
├── integration.bats      # Integration tests across scripts
├── run.sh                # Test runner (executes all .bats files)
├── state-read.bats       # state-read.sh tests (tier detection, context loading)
├── state-write.bats      # state-write.sh tests (atomic writes, recovery)
└── test_helper.bash      # Shared fixtures and utilities
```

**Test Count:** 42 tests total (as of v2.0)
- state-read.bats: tier detection, JSON validity, context loading
- state-write.bats: atomic writes, recovery mode, validation
- checkpoint.bats: tag creation, prune lifecycle, label sanitization
- integration.bats: cross-script workflows
- e2e-smoke.bats: full lifecycle (write → read → checkpoint → prune → recover)

**Test Framework:** bats-core with bats-assert and bats-support

**Run Command:** `bash test/run.sh` (or `npm test`)

**Coverage:**
- All 3 bash scripts (state-read.sh, state-write.sh, checkpoint.sh)
- Exit codes (0, 1, 2, 3)
- Edge cases (missing jq, corrupt STATE.md, invalid inputs)
- Recovery scenarios

**Not Published:** Listed in `.npmignore`, excluded from npm package

---

## User Project Structure (Generated by Shipyard)

When Shipyard is initialized in a user's project via `/shipyard:init`, it creates:

```
{user-project}/
└── .shipyard/                    # Project-specific Shipyard state (committed to git)
    ├── PROJECT.md                # Vision, requirements, constraints (immutable after init)
    ├── ROADMAP.md                # Phase structure with success criteria (updated per phase)
    ├── STATE.md                  # Current position, status, history (mutable)
    ├── ISSUES.md                 # Deferred issues across sessions (optional, created on first issue)
    ├── LESSONS.md                # Lessons learned across phases (optional, created on first lesson)
    ├── config.json               # Workflow preferences, model routing
    ├── codebase/                 # Brownfield analysis (default location, configurable)
    │   ├── STACK.md              # Languages, frameworks, dependencies
    │   ├── INTEGRATIONS.md       # External services, APIs, databases
    │   ├── ARCHITECTURE.md       # Patterns, layers, data flow
    │   ├── STRUCTURE.md          # Directory layout with annotations
    │   ├── CONVENTIONS.md        # Coding standards, naming patterns
    │   ├── TESTING.md            # Test framework, coverage, patterns
    │   └── CONCERNS.md           # Tech debt, security issues, performance
    ├── phases/
    │   └── {NN}-{name}/          # Phase directory (e.g., 01-authentication)
    │       ├── CONTEXT-{N}.md    # User decisions from discussion capture (optional)
    │       ├── RESEARCH.md       # Domain/tech research (optional, unless --skip-research)
    │       ├── VERIFICATION-BUILD.md  # Build verification results
    │       ├── plans/
    │       │   └── PLAN-{W}.{P}.md    # Wave.Plan (e.g., PLAN-1.1.md, PLAN-1.2.md)
    │       └── results/
    │           ├── SUMMARY-{W}.{P}.md       # Builder output per plan
    │           ├── REVIEW-{W}.{P}.md        # Reviewer output per plan
    │           ├── VERIFICATION.md          # Verifier output for phase
    │           ├── AUDIT-{N}.md             # Auditor output (if security_audit enabled)
    │           ├── SIMPLIFICATION-{N}.md    # Simplifier output (if simplification_review enabled)
    │           └── DOCUMENTATION-{N}.md     # Documenter output (if documentation_generation enabled)
    └── quick/                    # Ad-hoc tasks from /shipyard:quick (optional)
        └── {task-name}/
            ├── PLAN.md
            ├── SUMMARY.md
            └── REVIEW.md
```

**Directory Purposes:**

- `.shipyard/` - All Shipyard state for this project (committed to git by user choice)
- `.shipyard/codebase/` - One-time brownfield analysis artifacts (7 markdown files)
- `.shipyard/phases/{NN}-{name}/` - Phase-specific work (NN = zero-padded number, name = kebab-case)
- `.shipyard/phases/{NN}-{name}/plans/` - Architect-generated plans (max 3 tasks per plan)
- `.shipyard/phases/{NN}-{name}/results/` - Execution artifacts (summaries, reviews, verification, audits)
- `.shipyard/quick/` - Quick task execution without full planning (bypasses phases)

**Naming Conventions:**

- Phase directories: `{NN}-{kebab-case-name}` (e.g., `01-authentication`, `02-database-layer`)
- Plan files: `PLAN-{W}.{P}.md` (wave.plan, e.g., `PLAN-1.1.md`, `PLAN-1.2.md`, `PLAN-2.1.md`)
- Summary files: `SUMMARY-{W}.{P}.md` (matches plan wave.plan)
- Review files: `REVIEW-{W}.{P}.md` (matches plan wave.plan)
- Audit files: `AUDIT-{N}.md` (phase number, e.g., `AUDIT-1.md`, `AUDIT-2.md`)
- Simplification files: `SIMPLIFICATION-{N}.md` (phase number)
- Documentation files: `DOCUMENTATION-{N}.md` (phase number)

**Alternative Codebase Docs Location:**

If user chooses `codebase_docs_path: "docs/codebase"` at init, brownfield analysis goes to:
```
{user-project}/
├── docs/
│   └── codebase/             # Committed to git, visible to collaborators
│       ├── STACK.md
│       ├── INTEGRATIONS.md
│       ├── ARCHITECTURE.md
│       ├── STRUCTURE.md
│       ├── CONVENTIONS.md
│       ├── TESTING.md
│       └── CONCERNS.md
└── .shipyard/
    └── ...                   # Other state files (still in .shipyard/)
```

**Migration:** Use `/shipyard:move-docs` to move between locations.

---

## File Conventions

### Markdown Files

**Agent definitions:** YAML frontmatter + protocol definition
```yaml
---
name: agent-name
description: |
  Usage examples with <example> tags
model: opus | sonnet | haiku | inherit
color: blue | green | ...
---
[Protocol content]
```

**Command definitions:** YAML frontmatter + step-by-step orchestration
```yaml
---
description: "User-visible help"
disable-model-invocation: true
argument-hint: "[args] [--flags]"
---
[Orchestration steps]
```

**Skill definitions:** YAML frontmatter + behavioral protocol
```yaml
---
name: skill-name
description: Trigger conditions
---
<!-- TOKEN BUDGET: N lines / ~N tokens -->
[Skill content]
```

**State artifacts:** Structured markdown with headers (no frontmatter)
```markdown
# Shipyard State

**Schema:** 2.0
**Last Updated:** {timestamp}
**Current Phase:** {N}
**Current Position:** {description}
**Status:** {status}

## History
- [{timestamp}] {action}
```

### Configuration Files

**plugin.json:** Minimal JSON schema
```json
{
  "name": "shipyard",
  "description": "...",
  "author": {"name": "...", "email": "..."}
}
```

**hooks.json:** Claude Code hook configuration
```json
{
  "schemaVersion": "2.0",
  "hooks": {
    "SessionStart": [...]
  }
}
```

**config.json:** User project preferences
```json
{
  "interaction_mode": "interactive|autonomous",
  "git_strategy": "per_task|per_phase|manual",
  "review_depth": "detailed|lightweight",
  "security_audit": true,
  "simplification_review": true,
  "iac_validation": "auto",
  "documentation_generation": true,
  "codebase_docs_path": ".shipyard/codebase",
  "model_routing": {...},
  "context_tier": "auto",
  "created_at": "{timestamp}",
  "version": "1.2"
}
```

### Scripts

**Shell scripts:** Bash with strict mode
```bash
#!/usr/bin/env bash
# Script purpose
# Usage: script.sh [args]
# Exit Codes:
#   0 - Success
#   1 - User error
#   2 - Corruption
#   3 - Missing dependency

set -euo pipefail
```

**Output format:**
- JSON for hooks (state-read.sh)
- Plain text for utilities (state-write.sh, checkpoint.sh)
- Exit codes for success/failure (0/1/2/3)

---

## Module Boundaries

### Clear Separation of Concerns

1. **Commands** - Orchestration only (no implementation)
   - Dispatch agents via Task tool
   - Update state via state-write.sh
   - Create checkpoints via checkpoint.sh
   - Route user to next action

2. **Agents** - Implementation and analysis (no state management)
   - Execute specialized tasks (build, review, verify, audit)
   - Produce structured markdown artifacts
   - Never directly modify STATE.md, ROADMAP.md, or config.json

3. **Skills** - Reusable protocols (no direct invocation of agents)
   - Provide behavioral guidelines
   - Loaded via Skill tool into agent/command context
   - Self-contained (no external references except protocol docs)

4. **Scripts** - State persistence and context injection (no orchestration)
   - Read/write STATE.md atomically
   - Load context for session start
   - Manage git checkpoints
   - Never dispatch agents or invoke skills

5. **Hooks** - Lifecycle integration (triggers scripts only)
   - Execute state-read.sh on session start
   - No direct orchestration or agent dispatch

### Communication Patterns

| From | To | Mechanism |
|------|----|-----------|
| Commands | Agents | Task tool with `subagent_type: "shipyard:{agent}"` |
| Commands | Skills | Skill tool with `skill: "shipyard:{skill}"` |
| Commands | Scripts | Bash execution (`bash scripts/state-write.sh --phase N ...`) |
| Commands | State Files | Via scripts (not direct file writes) |
| Agents | Artifacts | Direct file writes to `.shipyard/phases/{N}/results/` |
| Scripts | Context | Read state files, output JSON (state-read.sh) |
| Hooks | Scripts | Execute on lifecycle events (SessionStart) |

### No Circular Dependencies

- Commands may invoke agents and skills
- Agents may reference skills (via Skill tool)
- Skills are self-contained (no agent/command invocation)
- Scripts are utilities (called by commands or hooks, don't call commands/agents)
- Hooks trigger scripts (no command execution, no agent dispatch)

**Dependency Graph:**
```
Hooks → Scripts
Commands → Agents, Skills, Scripts
Agents → Skills (via Skill tool)
Skills → (self-contained, reference Protocols docs)
Scripts → (self-contained, no dependencies)
```

---

## Extensibility Points

### Adding a Command

1. Create `/commands/{name}.md` with YAML frontmatter
2. Define step-by-step orchestration protocol
3. Reference shared protocols from `docs/PROTOCOLS.md`
4. Update `using-shipyard` skill if needed (command list)
5. Document in README.md

### Adding an Agent

1. Create `/agents/{name}.md` with YAML frontmatter
2. Define input/output contract (what context in, what artifact out)
3. Include usage examples with `<example>` tags
4. Update commands that should dispatch it
5. Document in README.md and ARCHITECTURE.md

### Adding a Skill

1. Create `/skills/{name}/SKILL.md` with YAML frontmatter
2. Define triggers in `description` field (file patterns, state conditions, etc.)
3. Add token budget comment: `<!-- TOKEN BUDGET: N lines / ~N tokens -->`
4. Add to `using-shipyard` skill list (Skills section)
5. Reference from agents/commands as needed
6. Follow `shipyard-writing-skills` skill guide

### Adding a Script

1. Create `/scripts/{name}.sh` with header comment
2. Make executable: `chmod +x scripts/{name}.sh`
3. Use strict mode: `set -euo pipefail`
4. Document purpose, usage, exit codes in header
5. Reference from commands or hooks as needed
6. Add tests to `test/{name}.bats`

---

## Version Control

### Tracked in Git

- All plugin files (agents, commands, skills, scripts, hooks)
- Plugin metadata (plugin.json, marketplace.json, package.json)
- Documentation (README.md, CHANGELOG.md, CONTRIBUTING.md, LICENSE)
- Test suite (test/*.bats, test_helper.bash, run.sh)

### Not Tracked in Git

- `.shipyard/` directories in user projects (user's responsibility to commit/ignore)
- `.npmignore` excludes test/ and dev files from npm package
- `node_modules/` (dev dependencies only: bats, bats-assert, bats-support)

### Published to npm

Package includes (per `package.json` `files` field):
- `.claude-plugin/`
- `agents/`
- `commands/`
- `skills/`
- `hooks/`
- `scripts/`
- `README.md`, `LICENSE`, `CHANGELOG.md`

Excludes:
- `test/` (dev-only)
- `.shipyard/` (Shipyard's own state - not needed by users)
- `docs/` (currently, may change)

---

## Token Budget Considerations

**Commands:** 5-10k tokens (orchestration-heavy, no implementation)

**Agents:** 1-7k tokens (vary by complexity)
- mapper: 2.7k (minimal protocol, focus areas passed as context)
- researcher: 2.8k
- architect: 3.4k (goal-backward methodology, max 3 tasks rule)
- builder: 6.2k (TDD protocol, IaC validation, checkpoint handling)
- reviewer: 4.5k (two-stage review logic)
- verifier: 5.4k (comprehensive validation checks)
- auditor: 6.5k (OWASP + secrets + dependencies + IaC security)
- simplifier: 6.8k (cross-task pattern detection algorithms)
- documenter: 5.6k (documentation needs analysis)

**Skills:** 3-15k tokens (vary by protocol complexity)
- Small: ~3-4k (parallel-dispatch, code-simplification)
- Medium: ~5-7k (most skills)
- Large: ~10k (shipyard-tdd - detailed rigid protocol)
- Meta: ~8.3k (using-shipyard - comprehensive reference)

**State Artifacts:** User-generated, variable size
- Limited by adaptive loading (first N lines loaded per file)
- STATE.md: typically <100 lines (~500 tokens)
- PROJECT.md: typically 100-200 lines (~1000-2000 tokens)
- ROADMAP.md: typically 200-400 lines (~2000-4000 tokens)
- PLAN.md: typically 50-100 lines per plan (~500-1000 tokens)
- SUMMARY.md: typically 30-50 lines per plan (~300-500 tokens)

**Session Context Injection:** ~1500-2500 tokens (adaptive tiers)
- v1.x: ~6000 tokens (full skill injection)
- v2.0: ~1500 tokens (compact summaries + state)
- v2.0 reduction: 75% token savings

---

## Key Design Patterns

### 1. Markdown-as-Interface

All specifications (agents, commands, skills) are markdown files with YAML frontmatter.

**Benefits:**
- Human-readable (easy to edit and review)
- Version-controllable (git diffs work well)
- Self-documenting (protocol is the documentation)
- No compilation step (markdown loads directly)

### 2. Agent Isolation

Each agent runs in a fresh context with only the inputs it needs.

**Benefits:**
- No shared state between agents
- No accumulated context pollution
- Clear input/output contracts
- Easier to test and debug

**Implementation:** Commands curate context bundles per agent role (follows Agent Context Protocol).

### 3. File-Based State

State persists in `.shipyard/` as structured markdown.

**Benefits:**
- Survives session restarts (unlike native tasks)
- Git-committable (version control for project state)
- Human-readable (easy to debug and recover)
- Cross-session knowledge (lessons, issues, decisions persist)

**Trade-off:** Requires bash scripts for management.

### 4. Hook-Based Context Injection

SessionStart hook injects adaptive context at session start.

**Benefits:**
- Zero user action (context loads automatically)
- Adaptive (different tiers for different states)
- Token-efficient (compact summaries vs full injection)
- Always current (reads latest STATE.md)

**Trade-off:** Requires jq dependency, runs on every session start.

### 5. Deterministic Triggers

Skills activate via file patterns, task markers, state conditions, content patterns — not LLM judgment.

**Benefits:**
- Ensures skills aren't forgotten (automatic activation)
- Reduces cognitive load (if trigger fires, invoke)
- Prevents skill drift (explicit triggers documented)
- Enforces discipline (1% rule prevents rationalization)

**Trade-off:** Can result in false positives (over-invocation).

### 6. Artifact-Based Communication

Agents communicate via structured markdown artifacts (SUMMARY.md, REVIEW.md, etc.).

**Benefits:**
- All interactions auditable (readable by humans)
- Traceable (clear paper trail)
- Recoverable (artifacts can rebuild state)
- Versionable (can commit artifacts to git)

**Trade-off:** More file I/O vs in-memory communication.

---

## File Inventory

### Plugin Core (22 top-level entries)

| Path | Type | Purpose | Published | Lines/Size |
|------|------|---------|-----------|------------|
| `.claude/` | Directory | Claude Code session settings | No | - |
| `.claude-plugin/` | Directory | Plugin metadata | Yes | 2 files |
| `.git/` | Directory | Git repository | No | - |
| `.gitignore` | File | Git ignore patterns | Yes | ~10 lines |
| `.npmignore` | File | npm package exclusions | Yes | ~5 lines |
| `.shipyard/` | Directory | Shipyard's own state (dogfooding) | No | - |
| `agents/` | Directory | 9 agent definitions | Yes | 9 files, ~4500 lines total |
| `CHANGELOG.md` | File | Version history | Yes | ~100 lines |
| `commands/` | Directory | 12 command definitions | Yes | 12 files, ~1800 lines total |
| `CONTRIBUTING.md` | File | Plugin development guide | Yes | ~100 lines |
| `docs/` | Directory | Plugin documentation | No (currently) | 1 file (PROTOCOLS.md) |
| `hooks/` | Directory | Session lifecycle hooks | Yes | 1 file (hooks.json) |
| `LICENSE` | File | MIT license | Yes | ~20 lines |
| `node_modules/` | Directory | npm dev dependencies | No | bats, bats-assert, bats-support |
| `package.json` | File | npm package metadata | Yes | ~55 lines |
| `package-lock.json` | File | npm dependency lockfile | Yes | ~1500 lines |
| `README.md` | File | User documentation | Yes | ~320 lines |
| `scripts/` | Directory | 3 bash scripts | Yes | 3 files, ~562 lines total |
| `skills/` | Directory | 16 skill definitions | Yes | 16 dirs, ~6500 lines total |
| `test/` | Directory | bats test suite | No | 7 files, ~1200 lines total |

### Agents (9 files, ~4500 lines total)

| File | Purpose | Model | Color | Lines | Tokens |
|------|---------|-------|-------|-------|--------|
| `architect.md` | Roadmap and plan decomposition | opus | blue | 62 | 3.4k |
| `auditor.md` | Security and compliance analysis | sonnet | red | ~120 | 6.5k |
| `builder.md` | Task execution with TDD | inherit | green | 92 | 6.2k |
| `documenter.md` | Documentation generation | sonnet | cyan | ~100 | 5.6k |
| `mapper.md` | Brownfield codebase analysis | sonnet | cyan | 27 | 2.7k |
| `researcher.md` | Domain/technology research | sonnet | magenta | ~50 | 2.8k |
| `reviewer.md` | Two-stage code review | sonnet | yellow | ~80 | 4.5k |
| `simplifier.md` | Complexity and duplication analysis | sonnet | magenta | ~125 | 6.8k |
| `verifier.md` | Post-execution verification | haiku | green | ~95 | 5.4k |

### Commands (12 files, ~1800 lines total)

| File | Purpose | Lines | Key Features |
|------|---------|-------|-------------|
| `build.md` | Execute plans with parallel agents | 276 | Wave orchestration, quality gates |
| `init.md` | Initialize project | 165 | 4 mapper agents, brainstorming, roadmap |
| `issues.md` | View and manage deferred issues | ~50 | Add, resolve, list |
| `move-docs.md` | Move codebase docs | ~40 | Between .shipyard/codebase and docs/codebase |
| `plan.md` | Decompose phases into plans | ~120 | Research, architect, verify |
| `quick.md` | Quick single-task execution | ~80 | Simplified workflow |
| `recover.md` | Diagnose and recover from errors | ~60 | STATE.md validation, recovery mode |
| `resume.md` | Restore context | ~50 | Rebuild native tasks |
| `rollback.md` | Revert to checkpoint | ~50 | List, revert to checkpoint |
| `ship.md` | Finalize and deliver | ~100 | Verify, audit, merge/PR/preserve |
| `status.md` | Show progress and route | ~70 | Dashboard, routing suggestions |
| `worktree.md` | Manage git worktrees | ~60 | Create, list, switch, remove |

### Skills (16 directories, ~6500 lines total)

| Skill | Lines | Tokens | Type | Key Features |
|-------|-------|--------|------|-------------|
| `code-simplification/` | ~300 | ~900 | Flexible | Cross-task duplication |
| `documentation/` | ~280 | ~850 | Flexible | API docs, architecture docs |
| `git-workflow/` | 375 | ~1350 | Flexible | Worktrees, atomic commits |
| `infrastructure-validation/` | ~320 | ~950 | Domain | Terraform, Ansible, Docker |
| `lessons-learned/` | ~250 | ~750 | Flexible | Post-phase reflection |
| `parallel-dispatch/` | ~200 | ~600 | Implementation | Concurrent agents |
| `security-audit/` | ~350 | ~1050 | Domain | OWASP, secrets, CVEs |
| `shipyard-brainstorming/` | ~280 | ~850 | Process | Socratic dialogue |
| `shipyard-debugging/` | ~320 | ~950 | Process (rigid) | Root cause investigation |
| `shipyard-executing-plans/` | ~300 | ~900 | Implementation | Execution workflow |
| `shipyard-tdd/` | ~600 | ~10000 | Process (rigid) | Red-Green-Refactor |
| `shipyard-testing/` | ~280 | ~850 | Process | Test structure |
| `shipyard-verification/` | ~250 | ~750 | Process (rigid) | Evidence-based completion |
| `shipyard-writing-plans/` | ~300 | ~900 | Implementation | Max 3 tasks, waves |
| `shipyard-writing-skills/` | ~480 | ~1450 | Meta | Skill authoring guide |
| `using-shipyard/` | 180 | ~8300 | Meta | Skill discovery, triggers |

### Scripts (3 files, ~562 lines total)

| File | Purpose | Lines | Exit Codes | Dependencies |
|------|---------|-------|-----------|--------------|
| `checkpoint.sh` | Git tag checkpoint management | 66 | 0, 1, 3 | git 2.20+ |
| `state-read.sh` | Adaptive context injection | 264 | 0, 2, 3 | bash 4.0+, jq 1.6+ |
| `state-write.sh` | STATE.md atomic updates | 232 | 0, 1, 2, 3 | bash 4.0+ |

---

## Growth Patterns

### Adding Features (Historical Pattern)

**v1.x → v2.0 Changes:**
- Added 4 new agents (mapper, researcher, documenter, simplifier)
- Added 2 new commands (move-docs, worktree)
- Added 1 new skill (lessons-learned)
- Extracted shared protocols to `docs/PROTOCOLS.md` (deduplicated ~400 lines from commands/agents)
- Reduced session context injection from ~6000 to ~1500 tokens (compact skill summaries)
- Added test suite (42 tests covering all 3 scripts)
- Added Schema 2.0 to STATE.md (supports future migrations)

**Typical Extension:**
1. Identify need (user feedback, workflow gap)
2. Determine type: command (orchestration), agent (execution), skill (behavior), script (utility)
3. Create file following established pattern
4. Reference shared protocols (avoid duplication)
5. Add tests if script
6. Document in README and ARCHITECTURE
7. Update version in package.json and marketplace.json

### Recommended Limits

- **Commands:** Keep under 300 lines (orchestration, not implementation)
- **Agents:** Keep under 150 lines (clear protocol, not encyclopedia)
- **Skills:** Keep under 500 lines (~1500 tokens max) - trim if exceeds
  - Exception: rigid skills like shipyard-tdd can be larger (~10k tokens)
- **Scripts:** Keep under 300 lines (single responsibility, well-tested)

**Rationale:** Token budgets, context window limits, maintainability
