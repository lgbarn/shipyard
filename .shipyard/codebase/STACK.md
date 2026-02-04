# Technology Stack

**Last Updated:** 2026-02-03
**Analyzed Version:** 2.3.0
**Project Type:** Claude Code Plugin
**Distribution:** npm package (`@lgbarn/shipyard`)

---

## Overview

Shipyard is a pure bash-based Claude Code plugin with minimal dependencies. It uses shell scripts for state management and workflow orchestration, with no build step or compilation required. The plugin integrates directly with Claude Code's plugin system and relies on the host environment for execution.

## Core Languages

### Bash/Shell Script
- **Version Required:** `>= 4.0`
- **Primary Language:** All runtime logic, state management, and workflow automation
- **POSIX Compliance:** Scripts are POSIX-compatible where possible, with macOS/Linux cross-platform support
- **Key Scripts:**
  - `/Users/lgbarn/Personal/shipyard/scripts/state-read.sh` - Session startup hook, adaptive context loading
  - `/Users/lgbarn/Personal/shipyard/scripts/state-write.sh` - Atomic state persistence with corruption detection
  - `/Users/lgbarn/Personal/shipyard/scripts/checkpoint.sh` - Git tag-based rollback system
- **Validation:** All scripts pass `shellcheck --severity=style`
- **Features Used:**
  - `set -euo pipefail` for error handling
  - Atomic file writes with `mktemp` and `mv`
  - POSIX-compliant regex and string manipulation
  - Process substitution (`< <(...)`) for streaming

### Markdown
- **Version:** CommonMark-compatible
- **Usage:** All configuration files, documentation, command definitions, skill definitions, agent prompts
- **Key Locations:**
  - `commands/*.md` - Slash command definitions (12 commands)
  - `skills/*/SKILL.md` - Auto-activating skill definitions (16 skills)
  - `agents/*.md` - Specialized agent prompt definitions (9 agents)
  - `.shipyard/PROJECT.md`, `ROADMAP.md`, `STATE.md` - Project state files

### JSON
- **Usage:** Plugin metadata, configuration, session hook output
- **Key Files:**
  - `package.json` - npm package metadata and dependencies
  - `.claude-plugin/plugin.json` - Plugin registration
  - `.claude-plugin/marketplace.json` - Marketplace metadata
  - `hooks/hooks.json` - Session hook configuration (schema version 2.0)
  - `.shipyard/config.json` - User configuration (workflow preferences, model routing)
- **Schema Versions:**
  - hooks.json: `"schemaVersion": "2.0"`
  - STATE.md: `"Schema": "2.0"` (markdown metadata)
  - config.json: `"version": "1.2"`

---

## Runtime Requirements

### Required System Dependencies

#### Node.js
- **Version Required:** `>= 16.0.0` (specified in `package.json` engines)
- **Purpose:** npm package distribution only (no Node.js code execution at runtime)
- **Justification:** Claude Code plugin marketplace uses npm for distribution

#### jq
- **Version Required:** `>= 1.6`
- **Purpose:** JSON parsing and manipulation in bash scripts
- **Critical Usage:**
  - Session hook JSON output formatting (`state-read.sh` line 256)
  - Config file parsing for `context_tier` and `codebase_docs_path` (lines 89, 188)
- **Validation:** Scripts check for `jq` availability and exit with code 3 if missing
- **Installation:**
  ```bash
  # macOS
  brew install jq

  # Ubuntu/Debian
  sudo apt-get install jq

  # Alpine
  apk add jq
  ```

#### Git
- **Version Required:** `>= 2.20`
- **Purpose:** Version control, checkpoint management, worktree support
- **Key Operations:**
  - `git tag` - Checkpoint creation and pruning
  - `git worktree` - Isolated branch management
  - `git diff-index` - Dirty worktree detection
  - `git rev-parse` - Repository validation
- **Used By:**
  - `checkpoint.sh` - Tag-based rollback points
  - `state-read.sh` - Recovery from git checkpoint tags (line 152)
  - `/shipyard:worktree` command - Worktree lifecycle management
- **Graceful Degradation:** Scripts warn but continue if not in a git repository

#### Bash
- **Version Required:** `>= 4.0`
- **Purpose:** Script execution environment
- **Features Used:**
  - Associative arrays (Bash 4.0+)
  - Process substitution
  - `[[` conditional expressions
  - `set -euo pipefail` error handling
- **Compatibility:** macOS (zsh/bash), Linux (bash)

---

## Build Tools & Package Management

### npm
- **Purpose:** Package distribution and dev dependency management
- **Distribution:** `@lgbarn/shipyard` published to npm registry
- **Scripts Defined:**
  - `npm test` → `bash test/run.sh` (runs bats test suite)
- **Installation Methods:**
  ```bash
  # From GitHub (recommended)
  claude plugin marketplace add lgbarn/shipyard
  claude plugin install shipyard@shipyard

  # From local clone
  claude plugin marketplace add /path/to/shipyard
  claude plugin install shipyard@shipyard
  ```

### No Build Step Required
- **Runtime:** Pure bash, no transpilation or compilation
- **Deployment:** Direct file distribution via npm
- **Files Distributed:** (from `package.json` "files" field)
  - `.claude-plugin/` - Plugin metadata
  - `agents/` - Agent definitions
  - `commands/` - Command definitions
  - `skills/` - Skill definitions
  - `hooks/` - Session hooks
  - `scripts/` - State management scripts
  - `README.md`, `LICENSE`, `CHANGELOG.md`

---

## Testing Framework

### Bats (Bash Automated Testing System)
- **Version:** `^1.13.0` (dev dependency)
- **Purpose:** Unit and integration testing for bash scripts
- **Test Suite:** 39 tests across 5 test files
- **Test Files:**
  - `test/state-read.bats` - Session hook context loading
  - `test/state-write.bats` - State persistence and atomicity
  - `test/checkpoint.bats` - Git tag management
  - `test/integration.bats` - End-to-end workflow tests
  - `test/e2e-smoke.bats` - Smoke tests
- **Helper Libraries:**
  - `bats-support` (`^0.3.0`) - Test helper functions
  - `bats-assert` (`^2.2.4`) - Assertion library
- **Test Runner:** `test/run.sh` (auto-installs bats if missing)
- **Execution:**
  ```bash
  npm test
  # or
  bash test/run.sh
  ```

---

## Platform Compatibility

### Supported Operating Systems
- **macOS:** Primary development platform (Darwin kernel)
  - `date -u -v-Nd +format` (BSD date syntax)
  - Works with both bash and zsh
- **Linux:** Full support (Ubuntu, Debian, Alpine, etc.)
  - `date -u -d "N days ago" +format` (GNU date syntax)
  - Bash 4.0+ required
- **Windows:** Not officially supported (Claude Code is macOS/Linux only)

### Cross-Platform Adaptations
- **Date Command:** Scripts use conditional logic to detect BSD vs GNU date:
  ```bash
  CUTOFF=$(date -u -v-"${DAYS}"d +"%Y%m%dT%H%M%SZ" 2>/dev/null || \
           date -u -d "${DAYS} days ago" +"%Y%m%dT%H%M%SZ")
  ```
- **Temporary Files:** Uses both `mktemp` with target-relative and fallback patterns
- **File Paths:** Absolute paths required, no assumptions about home directory location

---

## External Tool Support (Optional)

These tools are **not required** but are referenced by Shipyard skills for specific workflows:

### Infrastructure as Code (IaC)

#### Terraform
- **Referenced By:** `infrastructure-validation` skill
- **Validation Workflow:**
  1. `terraform fmt -check` - Format validation
  2. `terraform validate` - Syntax validation
  3. `terraform plan -out=tfplan` - Change preview (mandatory)
  4. `tflint --recursive` - Linting (optional)
  5. `tfsec . OR checkov -d .` - Security scanning (optional)
- **Drift Detection:** `terraform plan -detailed-exitcode`

#### Ansible
- **Referenced By:** `infrastructure-validation` skill
- **Validation Workflow:**
  1. `yamllint .` - YAML syntax
  2. `ansible-lint` - Best practices
  3. `ansible-playbook --syntax-check *.yml` - Playbook syntax
  4. `ansible-playbook --check *.yml` - Dry run

#### Docker
- **Referenced By:** `infrastructure-validation` skill
- **Validation Workflow:**
  1. `hadolint Dockerfile` - Dockerfile linting (optional)
  2. `docker build -t test-build .` - Build validation
  3. `trivy image test-build` - Security scanning (optional)
  4. `docker compose config` - Compose validation

### Language-Specific Package Managers

Referenced in `git-workflow` and `security-audit` skills but not executed by Shipyard itself:

- **npm** (Node.js) - `npm audit`, `npm install`, `npm test`
- **pip** (Python) - `pip-audit`, `pip install -r requirements.txt`, `pytest`
- **cargo** (Rust) - `cargo audit`, `cargo build`, `cargo test`
- **go** (Go) - `govulncheck`, `go test ./...`

### Security Scanning Tools

Referenced in `security-audit` skill (optional):
- **npm audit** - Node.js dependency vulnerabilities
- **pip-audit** - Python dependency vulnerabilities
- **cargo audit** - Rust dependency vulnerabilities
- **govulncheck** - Go vulnerability scanning
- **trivy** - Container and IaC security scanning
- **tfsec** / **checkov** - Terraform security scanning

**Note:** Shipyard skills provide *guidance* on using these tools but do not execute them automatically. The Claude Code agent follows skill instructions and uses available tools via Bash when applicable.

---

## Plugin Integration Architecture

### Claude Code Plugin System
- **Plugin Definition:** `.claude-plugin/plugin.json`
  - Registers plugin name and description
  - No version field (version lives in marketplace.json)
- **Marketplace Metadata:** `.claude-plugin/marketplace.json`
  - Schema: `https://anthropic.com/claude-code/marketplace.schema.json`
  - Plugin version: `2.3.0`
  - Category: `development`
  - Owner metadata

### Session Hooks
- **Hook Type:** `SessionStart` (fires on startup, resume, clear, compact)
- **Configuration:** `hooks/hooks.json`
  - Schema version: `2.0`
  - Matcher: `startup|resume|clear|compact`
  - Command: `${CLAUDE_PLUGIN_ROOT}/scripts/state-read.sh`
- **Output Format:** JSON with `hookSpecificOutput.additionalContext` field
- **Token Budget:** ~1500 tokens (reduced from ~6000 in v1.x)
- **Context Tiers:** (configurable via `.shipyard/config.json`)
  - `auto` - Adaptive based on project status (default)
  - `minimal` - STATE.md only
  - `planning` - + PROJECT.md, ROADMAP.md
  - `execution` - + current phase plans/summaries, recent lessons
  - `full` - + codebase analysis docs (STACK.md, ARCHITECTURE.md, etc.)

### Command Registration
- **Location:** `commands/*.md` (12 files)
- **Naming Convention:** `<name>.md` registers as `/shipyard:<name>`
- **Invocation:** Claude Code's Skill tool
- **Command List:**
  - `/shipyard:init` - Project initialization
  - `/shipyard:plan` - Phase planning
  - `/shipyard:build` - Execution with parallel agents
  - `/shipyard:status` - Progress dashboard
  - `/shipyard:resume` - Session restoration
  - `/shipyard:quick` - Ad-hoc task execution
  - `/shipyard:ship` - Delivery workflow
  - `/shipyard:issues` - Issue tracking
  - `/shipyard:rollback` - Checkpoint restoration
  - `/shipyard:recover` - State recovery
  - `/shipyard:move-docs` - Codebase docs relocation
  - `/shipyard:worktree` - Git worktree management

### Skill Registration
- **Location:** `skills/*/SKILL.md` (16 skills)
- **Auto-Activation:** Skills define triggers (file patterns, metadata, state conditions)
- **Naming Convention:** Directory name becomes skill name (`shipyard:<dirname>`)
- **Skill List:**
  - `using-shipyard`, `shipyard-tdd`, `shipyard-debugging`, `shipyard-verification`
  - `shipyard-brainstorming`, `security-audit`, `code-simplification`, `documentation`
  - `infrastructure-validation`, `parallel-dispatch`, `shipyard-writing-plans`
  - `shipyard-executing-plans`, `git-workflow`, `shipyard-testing`
  - `shipyard-writing-skills`, `lessons-learned`

### Agent Definitions
- **Location:** `agents/*.md` (9 files)
- **Dispatch Mechanism:** Commands invoke agents via markdown references
- **Execution:** Claude Code creates fresh subagent context (200k token budget)
- **Agent Roles:**
  - `mapper` - Codebase analysis (4 parallel instances)
  - `researcher` - Domain/technology research
  - `architect` - Roadmap and plan decomposition
  - `builder` - Task execution with TDD
  - `reviewer` - Two-stage code review
  - `auditor` - Security and compliance
  - `simplifier` - Duplication and complexity analysis
  - `documenter` - Documentation generation
  - `verifier` - Post-execution validation

---

## Configuration Management

### User Configuration File
- **Location:** `.shipyard/config.json` (created by `/shipyard:init`)
- **Schema Version:** `1.2`
- **Example:**
  ```json
  {
    "interaction_mode": "interactive",
    "git_strategy": "per_task",
    "review_depth": "detailed",
    "security_audit": true,
    "simplification_review": true,
    "iac_validation": "auto",
    "documentation_generation": true,
    "model_routing": {
      "validation": "opus",
      "building": "opus",
      "planning": "opus",
      "architecture": "opus",
      "debugging": "opus",
      "review": "opus",
      "security_audit": "opus"
    },
    "context_tier": "auto",
    "codebase_docs_path": ".shipyard/codebase",
    "created_at": "2026-02-01T00:00:00Z",
    "version": "1.2"
  }
  ```

### Environment Variables
- **`CLAUDE_PLUGIN_ROOT`:** Set by Claude Code, points to plugin installation directory
- **Script Usage:** Used in `hooks/hooks.json` to reference `state-read.sh`

---

## Version History

### Current: 2.3.0 (2026-02-03)
- Extracted shared protocols for commands/agents
- Added discussion capture to planning
- Configurable codebase docs location
- Added `/move-docs` command

### 2.2.0 (2026-02-01)
- Added `shipyard-testing` skill
- Improved test coverage

### 2.1.0 (2026-02-01)
- Configurable codebase docs location
- Enhanced context loading

### 2.0.0 (2026-02-01)
- **Major Refactor:** Bats test suite (39 tests)
- State corruption detection and recovery
- Atomic writes for STATE.md
- Schema versioning (2.0)
- Lessons-learned system
- New skill: `lessons-learned`
- New command: `/worktree`
- New agents: `mapper`, `researcher`, `documenter`
- Security hardening (input validation, shellcheck compliance)
- Token budget reduction (75% reduction in session hook output)

---

## Development Tools

### Linting & Validation
- **shellcheck:** All scripts pass `--severity=style`
- **Markdown:** CommonMark-compatible (no specific linter required)
- **JSON:** Validated against Claude Code schemas where applicable

### Repository
- **Type:** Git
- **URL:** `https://github.com/lgbarn/shipyard.git`
- **Homepage:** `https://github.com/lgbarn/shipyard`
- **Issues:** `https://github.com/lgbarn/shipyard/issues`
- **License:** MIT

---

## Summary

Shipyard is a **bash-native, zero-build Claude Code plugin** with three hard dependencies:
1. **bash >= 4.0** - Execution environment
2. **jq >= 1.6** - JSON parsing
3. **git >= 2.20** - Version control and checkpoint management

The plugin leverages Claude Code's native capabilities (subagents, tasks, skills) and provides structured workflows through markdown-defined commands, skills, and agents. All state management is file-based (`.shipyard/` directory), with no database or external services required.

Optional tool integrations (Terraform, Docker, Ansible, language-specific package managers) are documented in skills but not enforced as dependencies.
