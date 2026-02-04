# External Integrations

**Last Updated:** 2026-02-03
**Analyzed Version:** 2.3.0
**Integration Model:** Tool-based (CLI invocations)
**Network Dependencies:** Zero outbound HTTP/HTTPS

---

## Overview

Shipyard is a **standalone plugin** with **zero runtime API dependencies**. It operates entirely within the Claude Code environment, coordinating local tools and git operations. All integrations are **tool-based** (CLI invocations) rather than API-based (HTTP requests).

## Primary Integration: Claude Code Platform

### Anthropic Claude API (Implicit)
- **Type**: Platform-provided (not directly integrated)
- **Usage**: Accessed transparently through Claude Code CLI
- **Models Used**:
  - `claude-opus-4-5` (architecture, debugging)
  - `claude-sonnet-4-5` (building, planning, review, security)
  - `claude-haiku-3-5` (validation)
- **Model Selection**: Configurable per task type in `.shipyard/config.json`
- **API Key**: Managed by Claude Code CLI (not by Shipyard)
- **Authentication**: User authenticates with Claude Code once; Shipyard inherits credentials

### Claude Code Plugin System
- **Schema**: `https://anthropic.com/claude-code/marketplace.schema.json`
- **Registration**: Via `/.claude-plugin/marketplace.json`
- **Hooks**: SessionStart hook injects state context at conversation startup
- **Agent Dispatch**: Uses Claude Code's native agent system
- **Task Management**: Uses Claude Code's native TaskCreate/TaskUpdate/TaskList tools

## Version Control Integration

### Git (Required)
- **Type**: CLI tool
- **Usage**:
  - Checkpoint creation: `git tag -a "shipyard-checkpoint-{label}-{timestamp}"`
  - Atomic commits: `git commit -m "{type}({scope}): {description}"`
  - Worktree management: `git worktree add/list/remove`
  - State rollback: `git revert` or `git reset --hard {checkpoint-tag}`
  - Status checks: `git status`, `git diff`, `git log`
- **Branch Strategy**: Per-phase or per-feature branches (user-configurable)
- **Remote Operations**: Optional (user decides when to `git push`)
- **Integration Point**: Invoked via Bash tool in Claude conversations

### GitHub (Optional, Distribution Only)
- **Type**: Git remote host
- **Usage**:
  - Plugin source repository: `https://github.com/lgbarn/shipyard.git`
  - Issue tracking: `https://github.com/lgbarn/shipyard/issues`
  - Plugin distribution: `claude plugin marketplace add lgbarn/shipyard`
- **No API Integration**: Shipyard does not call GitHub API
- **User Access**: Users can optionally use `gh` CLI in their projects (not required by Shipyard)

## Infrastructure-as-Code Tool Integration

Shipyard **validates but does not execute** IaC tools. The builder and verifier agents invoke these CLIs to check syntax and generate plans, but actual infrastructure changes are left to the user.

### Terraform (Optional)
- **Type**: CLI tool (if present on system)
- **Detection**: Files matching `*.tf`, `*.tfvars`, `terraform*`
- **Validation Workflow** (invoked by builder/verifier agents):
  ```bash
  terraform fmt -check
  terraform validate
  terraform plan -out=tfplan
  tflint --recursive        # if installed
  tfsec . OR checkov -d .   # if installed
  ```
- **No Auto-Apply**: Shipyard NEVER runs `terraform apply` automatically
- **Usage Context**: Plan review, syntax validation, security scanning
- **Integration Point**: Invoked via Bash tool when IaC files detected

### Ansible (Optional)
- **Type**: CLI tool (if present on system)
- **Detection**: Files matching `playbook*.yml`, `roles/`, `inventory/`, `ansible*`
- **Validation Workflow**:
  ```bash
  yamllint .
  ansible-lint
  ansible-playbook --syntax-check *.yml
  ansible-playbook --check *.yml      # dry run
  molecule test                       # if configured
  ```
- **No Auto-Execute**: Shipyard NEVER runs `ansible-playbook` without `--check`
- **Usage Context**: Syntax validation, linting, dry-run verification
- **Integration Point**: Invoked via Bash tool when Ansible files detected

### Docker (Optional)
- **Type**: CLI tool (if present on system)
- **Detection**: Files matching `Dockerfile`, `docker-compose.yml`, `*.dockerfile`
- **Validation Workflow**:
  ```bash
  hadolint Dockerfile              # if installed
  docker build -t test-build .
  trivy image test-build           # if installed
  docker compose config            # if compose file present
  ```
- **No Auto-Deploy**: Shipyard builds images for validation, does not push or run containers
- **Usage Context**: Build verification, security scanning, compose validation
- **Integration Point**: Invoked via Bash tool when Docker files detected

### Kubernetes (Optional)
- **Type**: CLI tool (if present on system)
- **Detection**: YAML files with `apiVersion:` field
- **Validation**: Basic YAML syntax checking
- **No kubectl Integration**: Shipyard does not apply manifests to clusters
- **Usage Context**: Syntax validation only

### CloudFormation (Optional)
- **Type**: CLI tool (if present on system)
- **Detection**: Templates with `AWSTemplateFormatVersion`
- **Validation**: Basic YAML/JSON syntax checking
- **No AWS CLI Integration**: Shipyard does not deploy stacks
- **Usage Context**: Syntax validation only

## Security Scanning Tool Integration

### Secrets Detection (Pattern-Based)
- **Type**: Built-in regex patterns (no external tool)
- **Patterns Detected**:
  - AWS Access Keys: `AKIA[0-9A-Z]{16}`
  - GitHub Tokens: `ghp_[0-9a-zA-Z]{36}`
  - OpenAI/Stripe Keys: `sk-[0-9a-zA-Z]{48}`
  - Database URIs with credentials: `(postgres|mysql|mongodb)://[^:]+:[^@]+@`
  - Generic secrets: `(password|secret|token|api_key)\s*[:=]\s*['"][^'"]{8,}`
- **Usage Context**: Pre-commit scanning by auditor agent
- **No Cloud Service**: Pattern matching runs locally

### Dependency Scanners (Optional)
Invoked by auditor agent if present on system:

| Tool | Language | Command | Purpose |
|------|----------|---------|---------|
| `npm audit` | Node.js | `npm audit` | Check for CVEs in npm dependencies |
| `pip-audit` | Python | `pip-audit` | Check for CVEs in Python packages |
| `cargo audit` | Rust | `cargo audit` | Check for CVEs in Cargo crates |
| `govulncheck` | Go | `govulncheck ./...` | Check for Go module vulnerabilities |

- **Detection**: Based on presence of lock files (`package-lock.json`, `requirements.txt`, `Cargo.lock`, `go.sum`)
- **No Cloud APIs**: All scanning runs locally via CLI tools
- **Integration Point**: Invoked via Bash tool during security audit phase

### Container Scanners (Optional)
| Tool | Purpose | Command |
|------|---------|---------|
| `trivy` | Docker image scanning | `trivy image {image-name}` |
| `hadolint` | Dockerfile linting | `hadolint Dockerfile` |

- **Detection**: Invoked when Dockerfile changes detected
- **Usage Context**: Post-build security validation
- **Integration Point**: Invoked via Bash tool during Docker validation

### IaC Security Scanners (Optional)
| Tool | Purpose | IaC Type | Command |
|------|---------|----------|---------|
| `tfsec` | Terraform security | Terraform | `tfsec .` |
| `checkov` | Multi-IaC security | Terraform, CloudFormation, K8s | `checkov -d .` |

- **Detection**: Invoked when IaC files detected
- **Usage Context**: Pre-apply security validation
- **Integration Point**: Invoked via Bash tool during IaC validation

## Language-Specific Tool Integration

Shipyard references these tools in documentation and validation workflows but does **not bundle or require** them:

### Node.js/JavaScript
- `npm test` - Test runner (if `package.json` exists)
- `npm install` - Dependency installation (worktree setup)

### Python
- `pytest` - Test runner
- `pip install -r requirements.txt` - Dependency installation

### Rust
- `cargo test` - Test runner
- `cargo build` - Build verification

### Go
- `go test ./...` - Test runner
- `go build` - Build verification

**Detection**: Based on presence of manifest files (`package.json`, `requirements.txt`, `Cargo.toml`, `go.mod`)

**Usage Context**: Task verification commands in plans (generated by architect agent)

**Integration Point**: Invoked via Bash tool during builder agent execution

## Data Storage

### File System (Local Only)
- **Location**: `.shipyard/` directory in project root
- **Format**: Markdown (human-readable), JSON (config)
- **Persistence**: Files survive session restarts, can be committed to git
- **No Database**: Zero SQL or NoSQL databases
- **No Cloud Storage**: All state is local

### Session State (Ephemeral)
- **Location**: Claude Code's in-memory task system
- **Lifecycle**: Lives for duration of conversation session
- **Cleared**: On session restart (unless restored via `state-read.sh` hook)

## Network Requests

### None (Zero Outbound HTTP/HTTPS)
Shipyard makes **zero network requests**. It does not:
- Call Anthropic API directly (delegated to Claude Code CLI)
- Call GitHub API
- Call package registries (npm, PyPI, crates.io)
- Call any cloud services (AWS, GCP, Azure)
- Download remote resources
- Phone home for telemetry

**Exception**: If user's project code calls external APIs, those are unrelated to Shipyard's operation.

## Package Registries

### NPM Registry (Distribution Only)
- **URL**: `https://registry.npmjs.org/`
- **Package**: `@lgbarn/shipyard`
- **Usage**: Plugin distribution only (not runtime dependency)
- **Installation**: `npm` CLI used by Claude Code to fetch plugin
- **No Runtime Access**: Shipyard does not interact with npm registry after installation

### GitHub Releases (Alternative Distribution)
- **URL**: `https://github.com/lgbarn/shipyard`
- **Usage**: Alternative installation method via git clone
- **Command**: `claude plugin marketplace add /path/to/shipyard`

## Related Projects (Inspirational, Not Integrated)

Mentioned in documentation as acknowledgments:

### Superpowers
- **URL**: `https://github.com/obra/superpowers`
- **Relation**: Design inspiration for skills system and TDD discipline
- **Integration**: None (separate plugin)

### GSD (Get Shit Done)
- **URL**: `https://gsd.site/`
- **Relation**: Design inspiration for lifecycle management and phase-based planning
- **Integration**: None (separate tool)

## Configuration Sources

### User-Provided Configuration
- **File**: `.shipyard/config.json` (generated on `/shipyard:init`)
- **Schema**: Custom Shipyard schema
- **Options**:
  - `interaction_mode`: `interactive` | `autonomous`
  - `git_strategy`: `per_task` | `per_phase` | `manual`
  - `review_depth`: `detailed` | `lightweight`
  - `security_audit`: `true` | `false`
  - `simplification_review`: `true` | `false`
  - `iac_validation`: `auto` | `true` | `false`
  - `documentation_generation`: `true` | `false`
  - `model_routing`: object mapping task types to models
  - `context_tier`: `auto` | `minimal` | `full`

### Plugin Configuration
- **File**: `.claude-plugin/plugin.json`
- **Schema**: Anthropic Claude Code plugin schema
- **Contents**: Name, description, author metadata

### Hook Configuration
- **File**: `hooks/hooks.json`
- **Purpose**: Register SessionStart hook to inject state context
- **Hook Command**: `${CLAUDE_PLUGIN_ROOT}/scripts/state-read.sh`

## CLI Tool Wrapper Pattern

Shipyard uses a **CLI wrapper pattern** for all external tools:
1. Detect tool by file patterns or manifest presence
2. Check if tool is installed via `which {tool}` or similar
3. If installed, invoke via Bash tool with appropriate flags
4. Capture stdout/stderr
5. Parse output and report to user
6. **Never fail if optional tool missing** (graceful degradation)

## Integration Summary Table

| Integration | Type | Required | Purpose | Access Method |
|------------|------|----------|---------|---------------|
| Claude Code API | Platform | ✅ Yes | Conversation context, agent dispatch | Via Claude Code CLI |
| Git | CLI tool | ✅ Yes | Version control, checkpoints | Bash commands |
| jq | CLI tool | ✅ Yes | JSON processing in hooks | Bash commands |
| GitHub | Git remote | ❌ No | Plugin distribution | Git protocol |
| Terraform | CLI tool | ❌ No | IaC validation | Bash commands (conditional) |
| Ansible | CLI tool | ❌ No | Playbook validation | Bash commands (conditional) |
| Docker | CLI tool | ❌ No | Container builds | Bash commands (conditional) |
| npm/pip/cargo/go | CLI tools | ❌ No | Dependency/test runners | Bash commands (conditional) |
| Security scanners | CLI tools | ❌ No | Vulnerability detection | Bash commands (conditional) |

## No External Services

Shipyard explicitly does **not** integrate with:
- CI/CD platforms (GitHub Actions, CircleCI, Jenkins, etc.)
- Cloud providers (AWS, GCP, Azure)
- Issue trackers (Jira, Linear, Asana)
- Communication tools (Slack, Discord)
- Monitoring/observability (Datadog, Sentry)
- Secret management (Vault, AWS Secrets Manager)

Users are free to use these services in their projects, but Shipyard does not orchestrate or configure them.
