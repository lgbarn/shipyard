# Technology Stack

## Overview

Shipyard is a **Claude Code plugin** written primarily in **Markdown** and **Bash**, providing a structured project lifecycle management framework. It operates as a configuration-driven system with no compiled code dependencies.

## Primary Language

### Markdown (Documentation as Code)
- **Version**: CommonMark / GitHub Flavored Markdown
- **Purpose**:
  - Agent definitions (9 specialized agents in `/agents/`)
  - Command definitions (11 workflow commands in `/commands/`)
  - Skill definitions (14 auto-activating skills in `/skills/`)
- **Key Features**:
  - YAML frontmatter for metadata (name, description, model, color)
  - Structured checklists and workflows
  - Embedded examples and decision trees
- **Files**: 34+ `.md` files totaling ~100KB of structured documentation

## Scripting Languages

### Bash 4.x+
- **Version**: Requires Bash 4.0+ (uses associative arrays)
- **Purpose**: Session hooks, state management, checkpoint management
- **Key Scripts**:
  - `/scripts/state-read.sh` (584-line adaptive context loader)
  - `/scripts/state-write.sh` (state persistence)
  - `/scripts/checkpoint.sh` (git tag management)
- **Dependencies**:
  - Standard Unix utilities: `grep`, `sed`, `head`, `tail`, `find`, `date`
  - `jq` (required) - JSON processing for state injection
  - `git` (required) - version control operations

## Configuration Formats

### JSON
- **Usage**: Plugin metadata, configuration, session hooks
- **Key Files**:
  - `/package.json` - NPM package manifest (name, version, keywords)
  - `/.claude-plugin/plugin.json` - Plugin metadata
  - `/.claude-plugin/marketplace.json` - Marketplace registration
  - `/hooks/hooks.json` - SessionStart hook configuration
  - `.shipyard/config.json` - Per-project user preferences (runtime-generated)

### YAML
- **Usage**: Frontmatter in Markdown files
- **Purpose**: Agent/command/skill metadata

## Build Tools

### None (Zero Build Step)
- No transpilation required
- No bundling step
- Direct interpretation of Markdown and Bash
- Installation via Claude Code plugin system:
  ```bash
  claude plugin marketplace add lgbarn/shipyard
  claude plugin install shipyard@shipyard
  ```

## Runtime Environment

### Claude Code CLI
- **Required**: Claude Code CLI installed and authenticated
- **Version**: Compatible with Claude Code plugin system (schema version 1.x)
- **Execution Context**: Runs within Claude conversation context
- **Model Support**:
  - Model routing per agent type (configured in `.shipyard/config.json`)
  - Default routing: Haiku (validation), Sonnet (building/planning/review/security), Opus (architecture/debugging)

## Package Management

### NPM (Distribution Only)
- **Package Name**: `@lgbarn/shipyard`
- **Current Version**: 1.2.0
- **Registry**: GitHub (via npm registry proxy)
- **Purpose**: Distribution packaging only (no runtime dependencies)
- **Keywords**: `claude-code-plugin`, `workflow`, `tdd`, `planning`, `code-review`, `subagents`, `parallel-agents`, `lifecycle`, `security`, `infrastructure-as-code`

### No Runtime Dependencies
- **Zero npm packages** required at runtime
- **Zero Python packages** required at runtime
- **Zero compiled binaries** required at runtime

## System Requirements

### Required Tools
| Tool | Purpose | Version |
|------|---------|---------|
| `bash` | Script execution | 4.0+ |
| `jq` | JSON processing | 1.5+ |
| `git` | Version control operations | 2.0+ |
| Claude Code CLI | Plugin runtime | Latest |

### Optional Tools (Enhanced Features)
| Tool | Purpose | Used By |
|------|---------|---------|
| `terraform` | Infrastructure validation | Builder, Verifier agents |
| `ansible-lint` | Playbook validation | Builder, Verifier agents |
| `docker` | Container builds | Builder, Verifier agents |
| `hadolint` | Dockerfile linting | Builder agent |
| `tflint` | Terraform linting | Builder agent |
| `tfsec` | Terraform security scanning | Auditor agent |
| `checkov` | IaC security scanning | Auditor agent |
| `trivy` | Container security scanning | Auditor agent |
| `npm audit` | Node.js dependency scanning | Auditor agent (project-dependent) |
| `pip-audit` | Python dependency scanning | Auditor agent (project-dependent) |
| `cargo audit` | Rust dependency scanning | Auditor agent (project-dependent) |
| `govulncheck` | Go vulnerability scanning | Auditor agent (project-dependent) |

## Version Control

### Git
- **Required**: Yes
- **Usage**:
  - Checkpoint management (git tags: `shipyard-checkpoint-*`)
  - Atomic commits per task (conventional commit format)
  - Worktree management for isolated feature development
  - State rollback (via `git revert` or `git reset`)
- **Conventions**:
  - Conventional commits: `feat|fix|refactor|test|docs|chore|infra(scope): description`
  - Checkpoint tags with timestamp: `shipyard-checkpoint-{label}-{YYYYMMDDTHHMMSSZ}`

## File Structure

### Plugin Distribution
```
shipyard/
├── .claude-plugin/          # Plugin metadata
├── agents/                  # 9 agent definitions (.md)
├── commands/                # 11 command definitions (.md)
├── skills/                  # 14 skill definitions (.md in subdirs)
├── hooks/                   # Session hooks (JSON + scripts)
├── scripts/                 # State management (Bash)
├── package.json            # NPM distribution metadata
├── README.md               # Documentation
└── LICENSE                 # MIT license
```

### Runtime State (Per-Project)
```
.shipyard/
├── PROJECT.md              # Vision, constraints (generated)
├── ROADMAP.md              # Phase structure (generated)
├── STATE.md                # Session memory (updated by scripts)
├── config.json             # User preferences (generated)
├── codebase/               # Brownfield analysis (optional)
├── phases/                 # Phase execution artifacts
└── quick/                  # Ad-hoc task artifacts
```

## Platform Compatibility

### Supported Platforms
- **macOS**: Full support (primary development platform)
- **Linux**: Full support (tested on Ubuntu 20.04+)
- **Windows**: Partial support (requires WSL or Git Bash for Bash scripts)

### Shell Compatibility
- **Bash**: Required (4.0+)
- **Zsh**: Compatible (via `/bin/bash` shebang)
- **Fish**: Not supported (Bash scripts require Bash)

## Language Statistics

Based on codebase analysis:
- **Markdown**: ~95% (by file count and volume)
- **Bash**: ~5% (3 utility scripts)
- **JSON**: <1% (metadata only)

## Versioning Strategy

### Semantic Versioning
- **Current**: 1.2.0
- **Format**: MAJOR.MINOR.PATCH
- **Location**: Synchronized across:
  - `package.json` (`version` field)
  - `.claude-plugin/marketplace.json` (`plugins[0].version`)
  - Git tags (e.g., `v1.2.0`)

## Development Workflow

### No Local Build Required
1. Edit Markdown/Bash files directly
2. Test via `claude` CLI in a project directory
3. Commit to git
4. Tag release (git tag)
5. Push to GitHub
6. Users pull via `claude plugin marketplace add lgbarn/shipyard`

### Testing Strategy
- Functional testing via Claude conversations
- Integration testing with sample projects
- No unit test framework (logic is declarative in Markdown)
