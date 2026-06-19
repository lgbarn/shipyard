# Shipyard

Agent-driven plugin (v4.8.0) for structured project execution: idea → brainstorm → plan → build → ship.

Shipyard is authored as a **Claude Code plugin** (canonical source) and also ships a
**generated Codex plugin tree** so Codex users can install it natively. The Claude Code
artifacts are the single source of truth; the Codex tree is a build output (see
"Codex support" below).

## Commands

```bash
npm test                  # Full BATS test suite
npm run test:fast         # Unit tests only (bats --filter-tags unit)
npm run test:ci           # Parallel execution (4 jobs)
bash scripts/check-versions.sh   # Verify version sync across files
bash scripts/build-codex.sh      # Regenerate the Codex plugin tree from canonical artifacts
bash scripts/check-codex-sync.sh # Verify the committed Codex tree matches the generator
shellcheck --severity=warning scripts/*.sh hooks/*.sh test/run.sh
```

## Architecture

```
commands/       Slash commands (markdown + YAML frontmatter) — Claude Code
skills/         Auto-activating skills (skills/<name>/SKILL.md) — shared with Codex
agents/         Specialized subagents (markdown + YAML frontmatter) — Claude Code
scripts/        State management, version checks, Codex generator, cleanup utilities
hooks/          Plugin lifecycle hooks (SessionStart, TeammateIdle, TaskCompleted, Stop) — Claude Code
test/           BATS test suite + test_helper.bash
docs/           Protocols, guides, state schema, context engineering
.claude-plugin/ Claude Code plugin metadata (plugin.json, marketplace.json) — canonical
plugins/        Generated Codex plugin tree (plugins/shipyard/.codex-plugin/, skills/)
.agents/        Generated Codex marketplace manifest (.agents/plugins/marketplace.json)
.husky/         Pre-commit: check-versions.sh && check-codex-sync.sh && npm test
```

## Codex support

Codex artifacts are **generated** from the canonical Claude Code artifacts — never hand-edited.

- `scripts/build-codex.sh` transforms `.claude-plugin/plugin.json` + `skills/` into the Codex
  tree under `plugins/shipyard/` and `.agents/plugins/marketplace.json`.
- `scripts/check-codex-sync.sh` regenerates into a temp dir and diffs against the committed
  tree; any drift fails CI. This is what keeps the Codex tree from drifting by hand.
- Codex install: `codex plugin marketplace add lgbarn/shipyard`, then enable the plugin.
- Codex support is **best-effort, not parity**: skills run natively, but parallel subagent
  dispatch and lifecycle hooks degrade (see the PRD and the "Using Shipyard with Codex" guide).

## Version Sync

Six version strings must match. `scripts/check-versions.sh` enforces this (also runs in the
pre-commit hook and CI).

- `package.json`
- `package-lock.json` (root + `packages[""]`)
- `.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json` (top entry)
- `plugins/shipyard/.codex-plugin/plugin.json` (generated — regenerate after a version bump)
- `CHANGELOG.md` (top entry)

## Conventions

- **Files/dirs:** kebab-case
- **Commits:** conventional format — `feat:`, `fix:`, `chore:`, `build:`, `shipyard(phase-N):`
- **Bash scripts:** `set -euo pipefail`, ShellCheck compliant (`--severity=warning`)
- **Skills:** auto-discovered from `skills/*/SKILL.md` — no manual registration
- **Agents:** model values are `opus`, `sonnet`, `haiku`, or `inherit`
- **Codex tree:** never edit `plugins/` or `.agents/` by hand — run `scripts/build-codex.sh`
- **Adding components:** see [CONTRIBUTING.md](CONTRIBUTING.md)

## Gotchas

- **Pre-commit hook** runs `check-versions.sh && check-codex-sync.sh && npm test` — all must pass
- **`.shipyard/` is gitignored** — local project state only, never committed
- **jq >= 1.6 required** — `state-read.sh` exits code 3 if missing; the Codex generator also needs jq
- **Symlinked `.shipyard/`** is rejected (prevents writes outside project)
- **Team locking** uses directory-based locks at `${TMPDIR}/shipyard-state-${hash}.lock`
- **CI matrix** tests on macOS, Ubuntu, and Windows (WSL); ShellCheck + version + Codex-sync checks run on Ubuntu only
- **PR version bump enforced** — CI rejects PRs where package.json version <= main branch version
- **After a version bump** regenerate the Codex tree (`bash scripts/build-codex.sh`) or `check-codex-sync.sh` will fail
