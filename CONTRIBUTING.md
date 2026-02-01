# Contributing to Shipyard

Thank you for your interest in contributing to Shipyard. This guide covers how to add commands, skills, and agents, run tests, and submit pull requests.

## Prerequisites

See [README.md](README.md) for installation instructions.

System dependencies for development:

- **bash** >= 4.0
- **jq** >= 1.6
- **git** >= 2.20
- **node** >= 16 (for `npm test`)

## Adding Commands

Commands are slash commands exposed via `/shipyard:<name>`.

1. Create `commands/<name>.md` with required YAML frontmatter:

   ```yaml
   ---
   description: Short description of what the command does
   disable-model-invocation: true
   argument-hint: "[optional-arg] [--flag]"
   ---
   ```

2. Write the command body using a step-numbered workflow pattern (Step 1, Step 2, etc.).
3. Add the command to the Commands table in `README.md`.

## Adding Skills

Skills are auto-activating capabilities that trigger based on context.

1. Create a directory `skills/<name>/` using kebab-case naming.
2. Create `skills/<name>/SKILL.md` with this structure:

   ```markdown
   ---
   name: skill-name
   description: Use when [trigger context description]
   ---

   <!-- TOKEN BUDGET: N lines / ~M tokens -->

   # Skill Title

   ## Overview

   [What this skill does and when it activates.]

   ## Triggers

   [Conditions that activate this skill.]
   ```

3. Follow the consistent header block order: frontmatter, blank line, TOKEN BUDGET comment, blank line, `# Title`, blank line, Overview/Triggers.
4. Use kebab-case for the directory and skill name.
5. Update the hardcoded skill list in `scripts/state-read.sh` (see [Issue #16](https://github.com/lgbarn/shipyard/issues/16)).
6. Add the skill to the Skills table in `README.md`.

## Adding Agents

Agents are specialized subagents dispatched by commands.

1. Create `agents/<name>.md` with YAML frontmatter:

   ```yaml
   ---
   name: agent-name
   description: >
     Short description with examples of when this agent is used.
     Example: "Dispatched by /shipyard:build to execute individual tasks."
   model: sonnet
   ---
   ```

2. Valid `model` values: `opus`, `sonnet`, `haiku`, `inherit`.
3. Add the agent to the Agents table in `README.md`.

## Running Tests

Shipyard uses [bats-core](https://github.com/bats-core/bats-core) for testing.

```bash
# Run all tests
npm test

# Or directly
bash test/run.sh
```

- Test files live in `test/` with the `.bats` extension.
- Shared helpers are in `test/test_helper.bash`.

## PR Requirements

Before submitting a pull request:

1. **All tests pass**: Run `npm test` and confirm zero failures.
2. **ShellCheck passes**: Run `shellcheck --severity=warning scripts/*.sh` with no errors.
3. **No duplicated content**: Ensure documentation is not repeated across files.
4. **Conventional commits**: Use the format `type(scope): description`. See `docs/PROTOCOLS.md` for the full commit convention.

## Markdown Style Guide

| Element | Convention |
|---------|-----------|
| Document title | `#` (one per file) |
| Major sections | `##` |
| Subsections | `###` |
| Frontmatter | Required in commands, skills, and agents |
| File/directory names | kebab-case |
| Tables | Pipe-delimited |
| Code blocks | Triple-backtick with language hint |
| TOKEN BUDGET comments | Advisory, not enforced (see [Issue #19](https://github.com/lgbarn/shipyard/issues/19)) |
