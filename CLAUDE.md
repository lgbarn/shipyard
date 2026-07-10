# Shipyard

Claude Code plugin (v4.5.0) for structured project execution: idea → brainstorm → plan → build → ship.

## Commands

```bash
npm test                  # Full BATS test suite
npm run test:fast         # Unit tests only (bats --filter-tags unit)
npm run test:ci           # Parallel execution (4 jobs)
bash scripts/check-versions.sh  # Verify version sync across files
shellcheck --severity=warning scripts/*.sh hooks/*.sh test/run.sh
```

## Architecture

```
commands/       27 slash commands (markdown + YAML frontmatter)
skills/         19 auto-activating skills (skills/<name>/SKILL.md)
agents/         10 specialized agents (markdown + YAML frontmatter)
scripts/        State management, version checks, cleanup utilities
hooks/          Plugin lifecycle hooks (SessionStart, TeammateIdle, TaskCompleted, Stop)
test/           BATS test suite + test_helper.bash
docs/           Protocols, guides, state schema, context engineering
.claude-plugin/ Plugin metadata (plugin.json, marketplace.json)
.husky/         Pre-commit: check-versions.sh && npm test
```

## Version Sync

Four files must have matching version numbers. `scripts/check-versions.sh` enforces this (also runs in pre-commit hook and CI).

- `package.json`
- `.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
- `CHANGELOG.md` (top entry)

## Conventions

- **Files/dirs:** kebab-case
- **Commits:** conventional format — `feat:`, `fix:`, `chore:`, `build:`, `shipyard(phase-N):`
- **Bash scripts:** `set -euo pipefail`, ShellCheck compliant (`--severity=warning`)
- **Skills:** auto-discovered from `skills/*/SKILL.md` — no manual registration
- **Agents:** model values are `opus`, `sonnet`, `haiku`, or `inherit`
- **Adding components:** see [CONTRIBUTING.md](CONTRIBUTING.md)

## Gotchas

- **Pre-commit hook** runs `check-versions.sh && npm test` — both must pass
- **`.shipyard/` is gitignored** — local project state only, never committed
- **jq >= 1.6 required** — `state-read.sh` exits code 3 if missing
- **Symlinked `.shipyard/`** is rejected (prevents writes outside project)
- **Team locking** uses directory-based locks at `${TMPDIR}/shipyard-state-${hash}.lock`
- **CI matrix** tests on macOS, Ubuntu, and Windows (WSL); ShellCheck + version check run on Ubuntu only
- **PR version bump enforced** — CI rejects PRs where package.json version <= main branch version
