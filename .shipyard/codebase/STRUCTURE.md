# Directory Structure

## Root Layout

```
shipyard/
├── .claude-plugin/       # Plugin metadata
├── agents/               # Specialized subagent definitions
├── commands/             # Slash command definitions
├── hooks/                # Session lifecycle hooks
├── scripts/              # State management utilities
├── skills/               # Auto-activating behavioral protocols
├── .npmignore            # npm package exclusions
├── LICENSE               # MIT license
├── package.json          # npm package metadata
└── README.md             # User documentation
```

## Directory Purpose Annotations

### `.claude-plugin/` - Plugin Registration

**Purpose:** Declares the plugin to Claude Code's plugin system.

**Contents:**
- `plugin.json` - Plugin metadata (name, version, description, author)

**Notes:**
- Minimal schema - only valid plugin.json fields
- No source path specification (defaults to plugin root)
- Loaded by Claude Code at plugin installation

---

### `agents/` - Agent Definitions

**Purpose:** Markdown specifications for specialized subagents dispatched by commands.

**Pattern:** One file per agent, named `{agent-name}.md`

**Contents:**

```
agents/
├── architect.md          # Roadmap and plan decomposition
├── auditor.md            # Security and compliance analysis
├── builder.md            # Task execution with TDD
├── documenter.md         # Documentation generation
├── mapper.md             # Brownfield codebase analysis
├── researcher.md         # Domain/technology research
├── reviewer.md           # Two-stage code review
├── simplifier.md         # Complexity and duplication analysis
└── verifier.md           # Post-execution verification
```

**File structure:**
```yaml
---
name: agent-name
description: |
  When to use this agent (with examples)
model: opus | sonnet | haiku | inherit
color: blue | green | yellow | red | magenta
---

[Agent protocol definition]
```

**Usage:**
- Dispatched via Task tool with `subagent_type: "shipyard:{agent-name}"`
- Agent runs in isolated context
- Produces structured markdown artifacts

**Key agents:**

- **mapper** - Brownfield analysis (4 parallel instances)
  - Technology, architecture, quality, concerns analysis
  - Output: `.shipyard/codebase/*.md`

- **researcher** - Domain investigation
  - Codebase analysis for patterns and dependencies
  - Output: `.shipyard/phases/{N}/RESEARCH.md`

- **architect** - Requirements decomposition
  - Roadmaps and phase plans
  - Output: `.shipyard/ROADMAP.md`, `.shipyard/phases/{N}/plans/PLAN-{W}.{P}.md`

- **builder** - Implementation
  - TDD enforcement, atomic commits, IaC validation
  - Output: `.shipyard/phases/{N}/results/SUMMARY-{W}.{P}.md`

- **reviewer** - Code review
  - Two-stage: spec compliance + code quality
  - Output: `.shipyard/phases/{N}/results/REVIEW-{W}.{P}.md`

- **verifier** - Success criteria validation
  - Test execution, IaC validation
  - Output: `.shipyard/phases/{N}/VERIFICATION.md`

- **auditor** - Cross-task security analysis
  - OWASP, secrets, dependencies, IaC security
  - Output: `.shipyard/phases/{N}/results/AUDIT-{N}.md`

- **simplifier** - Code quality analysis
  - Duplication, dead code, AI bloat
  - Output: `.shipyard/phases/{N}/results/SIMPLIFICATION-{N}.md`

- **documenter** - Documentation generation
  - API docs, architecture docs
  - Output: `.shipyard/phases/{N}/results/DOCUMENTATION-{N}.md`

---

### `commands/` - Command Definitions

**Purpose:** Markdown specifications for slash commands that orchestrate workflows.

**Pattern:** One file per command, named `{command-name}.md`

**Contents:**

```
commands/
├── build.md              # Execute plans with parallel agents
├── init.md               # Initialize project
├── issues.md             # View and manage deferred issues
├── plan.md               # Decompose phases into plans
├── quick.md              # Quick single-task execution
├── recover.md            # Diagnose and recover from errors
├── resume.md             # Restore context from previous session
├── rollback.md           # Revert to checkpoint
├── ship.md               # Finalize and deliver
├── status.md             # Show progress and route
└── worktree.md           # Manage git worktrees
```

**File structure:**
```yaml
---
description: "What this command does"
disable-model-invocation: true
argument-hint: "[arg1] [--flag]"
---

# /shipyard:{command-name} - Title

[Step-by-step orchestration protocol]
```

**Command categories:**

**Lifecycle commands:**
- `init.md` - Bootstrap project, brownfield analysis, roadmap creation
- `plan.md` - Research and phase decomposition
- `build.md` - Parallel execution with quality gates
- `ship.md` - Final verification and delivery

**Navigation commands:**
- `status.md` - Progress dashboard with routing suggestions
- `resume.md` - Context restoration and continuation

**Utility commands:**
- `quick.md` - Simplified workflow for small tasks
- `issues.md` - Cross-session issue tracking
- `rollback.md` - Checkpoint-based reversion
- `recover.md` - State diagnosis and recovery
- `worktree.md` - Isolated feature development

**Orchestration pattern:**
1. Parse arguments
2. Validate state
3. Dispatch agents (with model routing from config)
4. Update state
5. Create checkpoints
6. Commit artifacts
7. Route forward

---

### `hooks/` - Session Lifecycle Integration

**Purpose:** Integrate with Claude Code's session lifecycle to inject context.

**Contents:**

```
hooks/
└── hooks.json            # SessionStart hook configuration
```

**Hook configuration:**
```json
{
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
- Fires on session start events (startup, resume, clear, compact)
- Executes `state-read.sh` to inject adaptive context
- Injects `using-shipyard` skill content
- Provides command suggestions based on current state

---

### `scripts/` - State Management Utilities

**Purpose:** Shell scripts for state persistence and context management.

**Contents:**

```
scripts/
├── checkpoint.sh         # Git tag-based checkpoint management
├── state-read.sh         # Adaptive context loading at session start
└── state-write.sh        # Updates .shipyard/STATE.md
```

**Script details:**

- **state-read.sh** (159 lines)
  - Detects `.shipyard/` directory presence
  - Reads `STATE.md`, extracts status and phase
  - Determines context tier (minimal/planning/execution/full/auto)
  - Loads appropriate context based on tier
  - Injects `using-shipyard` skill content
  - Provides command suggestions
  - Outputs JSON for SessionStart hook

  **Context tiers:**
  - `minimal` - STATE.md only
  - `planning` - + PROJECT.md + ROADMAP.md (first 80 lines)
  - `execution` - + current phase plans (first 50 lines each) + recent summaries (first 30 lines each)
  - `full` - + codebase analysis (first 40 lines per doc)
  - `auto` - Selects tier based on status field

- **state-write.sh**
  - Updates `.shipyard/STATE.md` with current position
  - Appends to history log
  - Called by commands after state transitions

- **checkpoint.sh**
  - Creates git tags at key points (pre/post plan, pre/post build)
  - Format: `shipyard-checkpoint-{label}`
  - Enables rollback via `/shipyard:rollback`

---

### `skills/` - Auto-Activating Behavioral Protocols

**Purpose:** Reusable behavioral protocols that activate based on deterministic triggers.

**Pattern:** One subdirectory per skill, each containing `SKILL.md`

**Contents:**

```
skills/
├── code-simplification/
│   └── SKILL.md          # Duplication and bloat detection
├── documentation/
│   └── SKILL.md          # Documentation generation patterns
├── git-workflow/
│   └── SKILL.md          # Branch management and worktrees
├── infrastructure-validation/
│   └── SKILL.md          # Terraform/Ansible/Docker workflows
├── parallel-dispatch/
│   └── SKILL.md          # Concurrent agent orchestration
├── security-audit/
│   └── SKILL.md          # OWASP, secrets, CVE scanning
├── shipyard-brainstorming/
│   └── SKILL.md          # Requirements exploration
├── shipyard-debugging/
│   └── SKILL.md          # Root cause investigation
├── shipyard-executing-plans/
│   └── SKILL.md          # Execution workflow
├── shipyard-tdd/
│   └── SKILL.md          # Red-Green-Refactor enforcement
├── shipyard-verification/
│   └── SKILL.md          # Evidence-based completion
├── shipyard-writing-plans/
│   └── SKILL.md          # Plan structure guidance
├── shipyard-writing-skills/
│   └── SKILL.md          # Skill authoring guide
└── using-shipyard/
    └── SKILL.md          # Skill discovery protocol (loaded at session start)
```

**Skill file structure:**
```yaml
---
name: skill-name
description: When to use this skill
---

[Skill protocol definition]
```

**Skill categories:**

**Rigid skills** (disciplined protocols - follow exactly):
- `shipyard-tdd/` - TDD cycle enforcement (10k tokens)
  - Red-Green-Refactor protocol
  - No production code without failing test first
  - Verification checklist

- `shipyard-debugging/` - Root cause investigation
  - Systematic debugging before fixes
  - Evidence collection protocol

- `shipyard-verification/` - Evidence-based completion
  - Never claim "done" without proof
  - Verification checklist

**Flexible skills** (adaptive patterns):
- `shipyard-brainstorming/` - Requirements exploration
  - Socratic dialogue
  - Decision capture

- `shipyard-writing-plans/` - Plan structure
  - Max 3 tasks per plan
  - Wave assignment for parallelism
  - Verification criteria

- `shipyard-executing-plans/` - Execution workflow
  - Plan reading protocol
  - Checkpoint handling
  - Artifact production

- `parallel-dispatch/` - Concurrent agents
  - Independent task detection
  - Parallel wave execution

- `git-workflow/` - Branch management
  - Worktree creation/switching
  - Commit conventions
  - Delivery modes

**Domain skills** (specialized validation):
- `security-audit/` - Security analysis
  - OWASP Top 10 checks
  - Secrets scanning
  - Dependency CVE checks
  - IaC security

- `code-simplification/` - Quality analysis
  - Cross-task duplication
  - Dead code detection
  - AI bloat patterns

- `infrastructure-validation/` - IaC workflows
  - Terraform: fmt, validate, plan
  - Ansible: lint, syntax-check
  - Docker: hadolint, build, compose config

- `documentation/` - Documentation generation
  - API documentation needs
  - Architecture documentation
  - User-facing docs

**Meta skill:**
- `using-shipyard/` - Skill discovery (8.3k tokens)
  - Loaded at every session start via state-read.sh
  - Defines all triggers and enforcement protocol
  - Lists all available commands and skills

**Trigger system:**
- **File pattern triggers** - `*.tf` → infrastructure-validation
- **Task marker triggers** - `tdd="true"` → shipyard-tdd
- **State condition triggers** - claiming "done" → shipyard-verification
- **Content pattern triggers** - error messages → shipyard-debugging

---

## User Project Structure (Generated)

When Shipyard is initialized in a user's project, it creates:

```
{user-project}/
└── .shipyard/
    ├── PROJECT.md            # Vision, requirements, constraints
    ├── ROADMAP.md            # Phase structure with success criteria
    ├── STATE.md              # Current position, status, history
    ├── ISSUES.md             # Deferred issues across sessions
    ├── config.json           # Workflow preferences, model routing
    ├── codebase/             # Brownfield analysis (optional)
    │   ├── STACK.md          # Languages, frameworks, dependencies
    │   ├── INTEGRATIONS.md   # External services, APIs
    │   ├── ARCHITECTURE.md   # Patterns, layers, data flow
    │   ├── STRUCTURE.md      # Directory layout with annotations
    │   ├── CONVENTIONS.md    # Coding standards, naming
    │   ├── TESTING.md        # Test framework, coverage
    │   └── CONCERNS.md       # Tech debt, security issues
    ├── phases/
    │   └── {NN}-{name}/
    │       ├── RESEARCH.md
    │       ├── plans/
    │       │   └── PLAN-{W}.{P}.md
    │       └── results/
    │           ├── SUMMARY-{W}.{P}.md
    │           ├── REVIEW-{W}.{P}.md
    │           ├── VERIFICATION.md
    │           ├── AUDIT-{N}.md
    │           ├── SIMPLIFICATION-{N}.md
    │           └── DOCUMENTATION-{N}.md
    └── quick/                # Ad-hoc tasks (from /shipyard:quick)
```

**Directory purposes:**

- `.shipyard/` - Project-specific Shipyard state (committed to git)
- `.shipyard/codebase/` - One-time brownfield analysis artifacts
- `.shipyard/phases/{NN}-{name}/` - Phase-specific work
- `.shipyard/phases/{NN}-{name}/plans/` - Architect-generated plans
- `.shipyard/phases/{NN}-{name}/results/` - Execution artifacts
- `.shipyard/quick/` - Quick task execution without full planning

**Naming conventions:**

- Phase directories: `{NN}-{kebab-case-name}` (e.g., `01-authentication`)
- Plan files: `PLAN-{W}.{P}.md` (wave.plan, e.g., `PLAN-1.1.md`)
- Summary files: `SUMMARY-{W}.{P}.md`
- Review files: `REVIEW-{W}.{P}.md`
- Audit files: `AUDIT-{N}.md` (phase number)
- Simplification files: `SIMPLIFICATION-{N}.md`
- Documentation files: `DOCUMENTATION-{N}.md`

---

## File Conventions

### Markdown Files

**Agent definitions:** YAML frontmatter + protocol
**Command definitions:** YAML frontmatter + step-by-step orchestration
**Skill definitions:** YAML frontmatter + behavioral protocol
**State artifacts:** Structured markdown with headers

### Configuration Files

**plugin.json:** Minimal JSON schema (name, description, author)
**hooks.json:** Claude Code hook configuration
**config.json:** User project preferences (interaction mode, git strategy, quality gates, model routing, context tier)

### Scripts

**Shell scripts:** Bash with strict mode (`set -euo pipefail`)
**Output format:** JSON for hooks, plain text for utilities
**Error handling:** Exit codes for success/failure

---

## Module Boundaries

### Clear Separation of Concerns

1. **Commands** - Orchestration only (no implementation)
2. **Agents** - Implementation and analysis (no state management)
3. **Skills** - Reusable protocols (no direct invocation of agents)
4. **Scripts** - State persistence and context injection (no orchestration)
5. **Hooks** - Lifecycle integration (triggers scripts only)

### Communication Patterns

- Commands → Agents: Via Task tool with `subagent_type`
- Commands → Skills: Via Skill tool
- Agents → Artifacts: Write structured markdown
- Scripts → Context: Read state, output JSON
- Hooks → Scripts: Execute on lifecycle events

### No Circular Dependencies

- Commands may invoke agents and skills
- Agents may reference skills
- Skills are self-contained (no external references)
- Scripts are utilities (called by commands or hooks)
- Hooks trigger scripts (no command execution)

---

## Extensibility Points

### Adding a Command

1. Create `/commands/{name}.md`
2. Define orchestration steps
3. Reference in README
4. Update `using-shipyard` skill if needed

### Adding an Agent

1. Create `/agents/{name}.md`
2. Define input/output contract
3. Update commands that dispatch it
4. Document in README and ARCHITECTURE.md

### Adding a Skill

1. Create `/skills/{name}/SKILL.md`
2. Define triggers in frontmatter
3. Add to `using-shipyard` skill list
4. Reference from agents/commands as needed

### Adding a Script

1. Create `/scripts/{name}.sh`
2. Make executable (`chmod +x`)
3. Use strict mode
4. Document purpose in header comment
5. Reference from commands or hooks

---

## Version Control

**Tracked:**
- All plugin files (agents, commands, skills, scripts, hooks)
- Plugin metadata (plugin.json, package.json)
- Documentation (README.md, LICENSE)

**Not tracked:**
- `.shipyard/` directories in user projects (user's responsibility)
- `.npmignore` excludes test/dev files from npm package

**Published to npm:**
- `.claude-plugin/`
- `agents/`
- `commands/`
- `skills/`
- `hooks/`
- `scripts/`
- `README.md`
- `LICENSE`

---

## Token Budget Considerations

**Commands:** 5-10k tokens (orchestration-heavy, no implementation)
**Agents:** 1-7k tokens (vary by complexity)
  - mapper: 2.7k
  - researcher: 2.8k
  - architect: 3.4k
  - builder: 6.2k
  - reviewer: 4.5k
  - verifier: 5.4k
  - auditor: 6.5k
  - simplifier: 6.8k
  - documenter: 5.6k

**Skills:** 5-15k tokens (vary by protocol complexity)
  - shipyard-tdd: 10k (detailed protocol)
  - using-shipyard: 8.3k (comprehensive guide)
  - Others: 3-7k

**State artifacts:** User-generated, variable size
  - Limited by adaptive loading (first N lines loaded)

---

## Key Design Patterns

### 1. Markdown-as-Interface

All specifications (agents, commands, skills) are markdown files with YAML frontmatter. This makes them:
- Human-readable
- Version-controllable
- Easy to edit
- Self-documenting

### 2. Agent Isolation

Each agent runs in a fresh context with only the inputs it needs. No shared state, no accumulated context.

### 3. File-Based State

State persists in `.shipyard/` as structured markdown. Survives session restarts. Can be committed to git.

### 4. Hook-Based Context Injection

SessionStart hook injects adaptive context at session start. Tier adjusts based on current state (idle → minimal, building → execution).

### 5. Deterministic Triggers

Skills activate via file patterns, task markers, state conditions, content patterns—not LLM judgment. If trigger fires, skill activates.

### 6. Artifact-Based Communication

Agents communicate via structured markdown artifacts (SUMMARY.md, REVIEW.md, etc.). All interactions are auditable and traceable.
