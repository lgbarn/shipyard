# Code Conventions

**Project:** Shipyard
**Analysis Date:** 2026-02-01
**Language:** Markdown, Bash, JSON

## Overview

Shipyard is a Claude Code plugin written primarily in Markdown for documentation and agent definitions, with Bash scripts for state management and lifecycle hooks. The codebase follows a structured, self-documenting approach with strong emphasis on explicit workflows, deterministic triggers, and rigorous verification protocols.

## File Organization Conventions

### Directory Structure

```
shipyard/
├── .claude-plugin/         # Plugin metadata (JSON)
├── agents/                 # Agent definitions (Markdown)
├── commands/               # Slash command workflows (Markdown)
├── hooks/                  # Session lifecycle hooks (JSON + Bash)
├── scripts/                # Utility scripts (Bash)
└── skills/                 # Auto-activating skill definitions (Markdown)
    └── {skill-name}/
        └── SKILL.md        # Skill content
```

### Naming Patterns

**Files:**
- Agent definitions: `{role}.md` (e.g., `builder.md`, `reviewer.md`)
- Commands: `{command-name}.md` (e.g., `init.md`, `build.md`)
- Skills: `SKILL.md` (uppercase, consistent across all skills)
- Scripts: `{function}-{action}.sh` (e.g., `state-read.sh`, `checkpoint.sh`)
- Configuration: `{purpose}.json` (e.g., `plugin.json`, `hooks.json`)

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
2. Overview with core principle
3. When to use / Activation triggers
4. Detailed workflow or protocol
5. Examples (Good/Bad)
6. Red flags and common rationalizations
7. Integration notes

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
3. Variable initialization
4. Argument parsing
5. Main logic
6. Exit with status code

**Example:**
```bash
#!/usr/bin/env bash
# Shipyard state writer
# Updates .shipyard/STATE.md with current position
#
# Usage:
#   state-write.sh --phase <N> --position <desc>

set -euo pipefail

# Variable initialization
PHASE=""
POSITION=""
...
```

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

## Summary of Key Conventions

1. **File naming:** Lowercase with hyphens, SKILL.md for skills
2. **Documentation:** YAML front matter, clear sections, examples with Good/Bad tags
3. **Bash scripts:** Strict mode (`set -euo pipefail`), quoted paths, descriptive variables
4. **JSON:** Schema references, consistent structure, no trailing commas
5. **Commits:** Conventional format with scope, descriptive messages
6. **Verification:** Evidence before claims, multi-stage review, categorized findings
7. **Integration:** Explicit cross-references, clear invocation patterns
8. **Error handling:** Validate early, fail clearly, guide user to resolution

This codebase prioritizes **clarity over cleverness**, **explicitness over inference**, and **verification over assumption**.
