# Code Conventions

**Last Updated:** 2026-02-03
**Analyzed Version:** 2.3.0

## Overview

Shipyard is a Claude Code plugin implementing a systematic software delivery workflow. The codebase prioritizes **clarity over cleverness**, **explicitness over inference**, and **verification over assumption**. Conventions are not suggestions - they are enforced in code review, automated tests, and workflow protocols.

## File Organization Conventions

### Directory Structure

```
shipyard/
├── .claude-plugin/         # Plugin metadata (JSON)
├── agents/                 # Agent definitions (Markdown)
├── commands/               # Slash command workflows (Markdown)
├── hooks/                  # Session lifecycle hooks (JSON + Bash)
├── scripts/                # Utility scripts (Bash)
├── skills/                 # Auto-activating skill definitions (Markdown)
│   └── {skill-name}/
│       └── SKILL.md        # Skill content (uppercase SKILL.md)
└── test/                   # Test suite (Bats)
    ├── run.sh              # Test runner
    ├── test_helper.bash    # Shared test utilities
    └── *.bats              # Test files
```

### Naming Patterns

**Files:**
- Agent definitions: `{role}.md` (e.g., `builder.md`, `reviewer.md`)
- Commands: `{command-name}.md` (e.g., `init.md`, `build.md`)
- Skills: `SKILL.md` (uppercase, consistent across all 16 skills)
- Scripts: `{function}-{action}.sh` (e.g., `state-read.sh`, `checkpoint.sh`)
- Configuration: `{purpose}.json` (e.g., `plugin.json`, `hooks.json`)
- Test files: `{subject}.bats` (e.g., `checkpoint.bats`, `state-read.bats`)
- Test helpers: `test_helper.bash` (shared setup and assertion utilities)

**Directories:**
- Skills use kebab-case: `shipyard-tdd/`, `code-simplification/`, `git-workflow/`
- Agent directories use lowercase singular: `agents/`, `commands/`, `skills/`

**Identifiers:**
- Skill names use namespace prefix: `shipyard:skill-name` or domain prefix: `security-audit`, `code-simplification`
- Agent names use lowercase singular: `builder`, `reviewer`, `auditor`
- Command names use kebab-case: `shipyard:init`, `shipyard:build`, `shipyard:quick`

## Documentation Conventions

### Markdown Structure

**Front Matter (YAML):**
Every agent and skill file includes YAML front matter:

```yaml
---
name: builder
description: |
  Use this agent when...
model: inherit|sonnet|opus|haiku
color: green
---
```

**Command files use:**
```yaml
---
description: "Brief description"
disable-model-invocation: true
argument-hint: "[phase-number] [--flag]"
---
```

**Section Headers:**
- Use `##` for major sections
- Use `###` for subsections
- Use `####` sparingly for nested content

**Lists:**
- Ordered lists for sequential steps: `1. Step one`
- Unordered lists for non-sequential items: `- Item`
- Checkbox lists for requirements/checklists: `- [ ] Requirement`

**Code Blocks:**
- Use fenced code blocks with language identifiers: ` ```bash`, ` ```json`, ` ```markdown`
- Use `<Good>` and `<Bad>` tags to show examples and anti-patterns
- Use inline code for file paths, commands, and identifiers: `` `file.md` ``

**Emphasis:**
- Bold for critical terms: `**MANDATORY**`, `**Stage 1**`
- Italics rarely used; prefer bold for emphasis
- ALL CAPS for absolute rules: `NEVER`, `ALWAYS`, `MUST`

### Agent Definition Patterns

**Standard Sections:**
1. Front matter with name, description, model, color
2. Role description ("You are a...")
3. Protocol/workflow sections
4. Output format specifications
5. Key rules
6. Integration notes (what calls this agent, what it pairs with)

**Example structure:**
```markdown
---
name: reviewer
description: |
  Use this agent when...
model: inherit
color: yellow
---

You are a Code Reviewer performing two-stage review.

## Stage 1 — Spec Compliance
...

## Stage 2 — Code Quality
...

## Output Format
...

## Key Rules
- **Critical findings block shipping.**
...
```

### Skill Definition Patterns

**Standard Sections:**
1. Front matter with name and description
2. Token budget comment (advisory, not enforced - see CONTRIBUTING.md)
3. Overview with core principle
4. When to use / Activation triggers
5. Detailed workflow or protocol
6. Examples (Good/Bad)
7. Red flags and common rationalizations
8. Integration notes

**File Structure:**
```markdown
---
name: skill-name
description: Use when [trigger context description]
---

<!-- TOKEN BUDGET: N lines / ~M tokens -->

# Skill Title

## Overview
...
```

**Token Budget Comments:**
- Format: `<!-- TOKEN BUDGET: N lines / ~M tokens -->`
- Status: Advisory guideline, not enforced (see [Issue #19](https://github.com/lgbarn/shipyard/issues/19))
- Purpose: Signal approximate size for context planning
- Placement: Always immediately after frontmatter, before title

**Trigger Specification:**
Skills explicitly define their activation conditions:
```markdown
## Activation Triggers
- File patterns: `*.test.*`, `*.spec.*`
- Task markers: `tdd="true"` in plan
- State conditions: About to claim "done"
```

### Command Definition Patterns

**Standard Sections:**
1. Front matter
2. Step-by-step execution protocol
3. Conditional logic for different scenarios
4. Agent dispatch instructions
5. State management
6. Git operations
7. Routing/suggestions for next steps

**Steps are numbered explicitly:**
```markdown
## Step 0: Parse Arguments
...

## Step 1: Validate State
...

## Step 2: Update State
...
```

## Bash Script Conventions

### Shebang and Safety

**All scripts start with:**
```bash
#!/usr/bin/env bash
set -euo pipefail
```

- `set -e`: Exit on error
- `set -u`: Exit on undefined variable
- `set -o pipefail`: Propagate pipe failures

### Script Structure

1. Header comment describing purpose and usage
2. Shebang and set flags
3. Exit code documentation (in header comment)
4. Variable initialization
5. Argument parsing
6. Main logic
7. Exit with documented status code

**Example:**
```bash
#!/usr/bin/env bash
# Shipyard state writer
# Updates .shipyard/STATE.md with current position
#
# Usage:
#   state-write.sh --phase <N> --position <desc>
#
# Exit Codes:
#   0 - Success (STATE.md written)
#   1 - User error (invalid arguments)
#   2 - State corruption (validation failed)
#   3 - Missing dependency (.shipyard/ missing)

set -euo pipefail

# Variable initialization
PHASE=""
POSITION=""
...
```

**Exit Code Convention:**
All scripts document exit codes in their header:
- `0`: Success
- `1`: User error (invalid arguments, missing required parameters)
- `2`: Data corruption or validation failure
- `3`: Missing dependency (directory, command, file)

### Variable Naming

- UPPERCASE for constants and environment variables: `STATE_FILE`, `TIMESTAMP`
- lowercase for local variables: `phase`, `status`, `suggestion`
- Descriptive names: `context_tier`, `phase_dir`, `plan_context`

### Output Conventions

- Use `echo` for informational messages
- Redirect errors to stderr: `>&2`
- Use `exit 0` for success, `exit 1` for failure
- JSON output uses `jq` for proper escaping: `jq -n --arg ctx "$full_content"`

### Path Handling

- Always use `$(pwd)` for current directory
- Use `$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)` for script directory
- Quote all paths: `"$path"`, `"${phase_dir}"`

## JSON Conventions

### Plugin Metadata

**plugin.json:**
```json
{
  "name": "shipyard",
  "description": "Brief description",
  "author": {
    "name": "lgbarn",
    "email": "email@example.com"
  }
}
```

**marketplace.json:**
```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "shipyard",
  "owner": {...},
  "plugins": [...]
}
```

### Hooks Configuration

**hooks.json structure:**
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear",
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

## Test File Conventions

### Bats Test Framework

**Framework:** bats-core (Bash Automated Testing System)

**Dependencies:**
- `bats` (test runner)
- `bats-support` (test helpers)
- `bats-assert` (assertion library)

### Test File Structure

**All test files follow this pattern:**
```bash
#!/usr/bin/env bats
load test_helper

@test "component: behavior description" {
    # Arrange
    setup_shipyard_dir

    # Act
    run bash "$SCRIPT_PATH" --arg value

    # Assert
    assert_success
    assert_output --partial "expected"
}
```

**Header:**
1. Shebang: `#!/usr/bin/env bats`
2. Load helpers: `load test_helper` (first line after shebang)
3. Setup functions (if needed): `setup() { ... }`

**Test Naming:**
```bash
# Pattern: @test "component: behavior description"
@test "state-read: no .shipyard directory outputs 'No Shipyard Project Detected' JSON"
@test "integration: write then read round-trip preserves state data"
@test "e2e: structured write creates valid state then read returns JSON"
```

**Conventions:**
- Prefix with component name: `state-read:`, `checkpoint:`, `integration:`, `e2e:`
- Describe expected behavior, not implementation
- One behavior per test
- Clear, complete descriptions (not abbreviated)

### Test Helper Patterns

**File:** `test/test_helper.bash`

**Purpose:** Shared setup functions, common assertions, path constants

**Standard exports:**
```bash
PROJECT_ROOT="$(cd "$(dirname "${BATS_TEST_FILENAME}")/.." && pwd)"
STATE_READ="${PROJECT_ROOT}/scripts/state-read.sh"
STATE_WRITE="${PROJECT_ROOT}/scripts/state-write.sh"
CHECKPOINT="${PROJECT_ROOT}/scripts/checkpoint.sh"
```

**Helper Function Naming:**
```bash
setup_shipyard_dir()              # Creates isolated .shipyard skeleton
setup_shipyard_with_state()       # Creates .shipyard with STATE.md
setup_shipyard_corrupt_state()    # Creates corrupted state for error testing
setup_shipyard_empty_state()      # Creates empty STATE.md for edge cases
setup_git_repo()                  # Initializes test git repo with config

assert_valid_json()               # Custom assertion for JSON validation
```

**Naming conventions:**
- `setup_*` for test environment preparation
- `assert_*` for custom assertions
- Descriptive, not abbreviated: `setup_shipyard_with_state` not `setup_state`

### Test Organization

**Test files by component:**
```
test/
├── checkpoint.bats         # checkpoint.sh tests (90 lines)
├── state-read.bats         # state-read.sh tests (211 lines)
├── state-write.bats        # state-write.sh tests (137 lines)
├── integration.bats        # Cross-component integration (138 lines)
└── e2e-smoke.bats         # End-to-end smoke tests (92 lines)
```

**Total:** 668 lines of test code across 5 files

### Assertion Patterns

**From bats-assert library:**
```bash
assert_success                      # Exit code 0
assert_failure                      # Exit code non-zero
assert_equal "$expected" "$actual"  # String equality
assert_output "exact match"         # Exact output match
assert_output --partial "substring" # Substring match
refute_output --partial "not this"  # Assert substring absent
```

**Custom assertions:**
```bash
assert_valid_json()  # Validates JSON output via jq
```

### Test Execution

**Via npm:**
```bash
npm test
```

**Direct execution:**
```bash
bash test/run.sh
./node_modules/.bin/bats test/*.bats
```

**Test runner behavior:**
- TAP (Test Anything Protocol) formatted output
- Runs all `*.bats` files in `test/` directory
- Auto-installs bats if missing (via npm)
- Exit code 0 if all tests pass, non-zero otherwise

### Test Isolation

**All tests use isolated environments:**
- `BATS_TEST_TMPDIR`: Temporary directory per test run
- `cd "$BATS_TEST_TMPDIR"`: Change to isolated directory
- Fresh git repos: `git init -q` in test setup
- Cleanup handled automatically by bats framework

**Example isolation:**
```bash
@test "checkpoint: creates tag with valid label" {
    setup_git_repo              # Fresh git repo in BATS_TEST_TMPDIR
    cd "$BATS_TEST_TMPDIR"      # Isolated directory
    run bash "$CHECKPOINT" "pre-build-phase-2"
    assert_success
    # Cleanup automatic on test completion
}
```

## Content Style Conventions

### Tone and Voice

- **Imperative for instructions:** "Run the command", "Create a git commit"
- **Declarative for rules:** "Tests must pass", "Critical findings block shipping"
- **Direct and specific:** Avoid hedge words like "might", "could", "perhaps"
- **No emojis** unless explicitly requested by user

### Formatting Principles

**Tables for comparison:**
```markdown
| Severity | Definition | Action |
|----------|-----------|--------|
| Critical | Exploitable vulnerability | Must fix |
```

**Code examples with context:**
```markdown
<Good>
```typescript
test('retries failed operations 3 times', async () => {
  // Clear test
});
```
Clear name, tests real behavior
</Good>
```

**Numbered checklists for verification:**
```markdown
- [ ] Every new function has a test
- [ ] Watched each test fail before implementing
```

### Anti-Pattern Documentation

**Common structure:**
```markdown
| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
```

**Red Flags sections:**
```markdown
## Red Flags - STOP and Start Over
- Code before test
- Test passes immediately
```

## Workflow Protocol Patterns

### Sequential Steps

Commands and agents use numbered steps with clear dependencies:
```markdown
## Step 1: Validate State
...

## Step 2: Update State
(depends on Step 1 completing)
...
```

### Conditional Execution

Clear branching logic:
```markdown
**If verification passes:**
- Continue to next step

**If verification fails:**
- Stop execution
- Report findings
```

### Agent Dispatch Pattern

Consistent structure for invoking subagents:
```markdown
Dispatch a **builder agent** (subagent_type: "shipyard:builder") with:
- The full plan content
- PROJECT.md for context
- Working directory path
```

## Commit Message Conventions

### Format

**Conventional commits:**
```
{type}({scope}): {description}

Examples:
feat(auth): add retry logic for failed operations
fix(api): handle null response from external service
refactor(db): extract connection pooling logic
test(parser): add edge case for empty input
docs(readme): update installation instructions
chore(deps): update dependencies
```

**Infrastructure commits:**
```
infra(terraform): add RDS encryption
infra(docker): use non-root user
infra(ansible): vault secrets in playbooks
```

**Shipyard-specific commits:**
```
shipyard: initialize project
shipyard: plan phase 1
shipyard: complete phase 2 build
shipyard(phase-1): implement user authentication
```

## State Management Patterns

### STATE.md Structure

```markdown
# Shipyard State

**Last Updated:** 2026-02-01T12:34:56Z
**Current Phase:** 1
**Current Position:** Planning phase 1
**Status:** planning

## History

- [2026-02-01T12:00:00Z] Project initialized
- [2026-02-01T12:30:00Z] Phase 1: Planning (planning)
```

### Config.json Structure

```json
{
  "interaction_mode": "interactive|autonomous",
  "git_strategy": "per_task|per_phase|manual",
  "review_depth": "detailed|lightweight",
  "security_audit": true,
  "simplification_review": true,
  "iac_validation": "auto|true|false",
  "documentation_generation": true,
  "model_routing": {
    "validation": "haiku",
    "building": "sonnet",
    "planning": "sonnet",
    "architecture": "opus"
  },
  "context_tier": "auto|minimal|planning|execution|full",
  "created_at": "timestamp",
  "version": "1.2"
}
```

## Verification and Quality Patterns

### Evidence-Based Claims

**Never claim without evidence:**
```markdown
# WRONG
"Tests should pass now"

# RIGHT
[Run test command] [See: 34/34 pass] "All tests pass"
```

### Multi-Stage Review

**Consistent review structure:**
1. Stage 1: Spec compliance
2. Stage 2: Code quality
3. Verdict: PASS/FAIL with specific findings

### Finding Categorization

**Consistent severity levels:**
- **Critical:** Must fix, blocks progress
- **Important:** Should fix, degrades quality
- **Suggestion/Advisory:** Nice to have

## Integration and References

### Skill Cross-References

**Explicit integration notes:**
```markdown
## Integration

**Referenced by:** `shipyard:auditor` agent

**Pairs with:**
- `shipyard:infrastructure-validation`
- `shipyard:shipyard-verification`
```

### Tool Invocation Patterns

**Skills reference tools explicitly:**
```markdown
In Claude Code, use the `Skill` tool.
Never use the Read tool on skill files.
```

## Error Handling Patterns

### Validation Before Execution

```markdown
## Step 1: Validate State

1. Verify `.shipyard/` exists. If not, tell user to run `/shipyard:init`
2. Read `.shipyard/ROADMAP.md` and locate target phase
```

### Graceful Degradation

```markdown
if [ -f ".shipyard/PROJECT.md" ]; then
    project_md=$(cat ".shipyard/PROJECT.md" 2>/dev/null || echo "")
fi
```

### User Communication

```markdown
# WRONG
Error: File not found

# RIGHT
Error: .shipyard/STATE.md does not exist. Run /shipyard:init first.
```

## Protocol Reference Pattern

All commands, skills, and agents reference shared protocols using this format:

```markdown
Follow **Protocol Name** (see `docs/PROTOCOLS.md`) -- inline summary of what to do.
```

Examples:
- `Follow **State Update Protocol** (see docs/PROTOCOLS.md) -- set status, position, timestamp.`
- `Follow **Worktree Protocol** (see docs/PROTOCOLS.md) -- detect worktree, record working directory and branch.`
- `Follow **Commit Convention** (see docs/PROTOCOLS.md) -- use conventional commit prefixes.`

This pattern ensures:
1. Readers know where to find the full protocol
2. Inline summary provides immediate guidance
3. Consistency across all workflow documents

## Summary of Key Conventions

1. **File naming:** kebab-case for all files, `SKILL.md` (uppercase) for skill entry points
2. **Documentation:** Required YAML frontmatter, token budget comments (advisory), numbered steps in commands
3. **Bash scripts:** Strict mode (`set -euo pipefail`), documented exit codes (0/1/2/3 pattern), atomic writes
4. **JSON:** Consistent schema, defaults documented, no trailing commas
5. **Commits:** Conventional format (`type(scope): description`), shipyard-specific patterns
6. **Verification:** Evidence before claims (enforced via `shipyard-verification` skill)
7. **TDD:** Test-first development (enforced via `shipyard-tdd` skill)
8. **Error handling:** Validate early, specific exit codes, recovery guidance
9. **Testing:** Bats framework, isolated environments, `component: behavior` naming
10. **Quality gates:** ShellCheck for bash, test suite for all changes

These conventions are enforced through automated testing, code review, and workflow skills.
