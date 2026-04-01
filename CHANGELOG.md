# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [4.5.0] - 2026-04-01

### Changed
- **`/shipyard:ship` cleanup**: Step 10 now runs `scripts/clean.sh` instead of archiving artifacts into a subdirectory. The script lists what it intends to delete and requires the user to type `CLEAN` to confirm. Cleanup is optional — ship completes even if the user declines.
- **`import-spec` and `import-spec-file` moved from commands to skills**: Removes the dual command+skill duplication introduced in v4.3.0. Both remain invocable via `/shipyard:import-spec` and `/shipyard:import-spec-file` as skills.

### Fixed
- **`using-shipyard` skill index**: Added 3 missing skills (`shipyard-handoff`, `import-spec`, `import-spec-file`) to the table and activation triggers. Updated count from 16 to 19.
- **Stale README references**: Removed deleted alias commands (`b`, `p`, `q`, `s`) from file tree and command table. Updated skills count to 19 with `import-spec` and `import-spec-file` entries.
- **`help.md` stale aliases**: Removed references to deleted alias commands.

### Removed
- **Alias commands**: `/shipyard:b`, `/shipyard:p`, `/shipyard:q`, `/shipyard:s` command files removed.
- **Duplicate command files**: `commands/import-spec.md` and `commands/import-spec-file.md` removed (skill versions are the canonical source).

## [4.3.0] - 2026-03-30

### Added
- **`/shipyard:import-spec-file`**: New command for importing handwritten or freeform spec documents (architecture docs, requirements files, validation specs, RFCs) into Shipyard — no spec-kit required. Reads the spec, heuristically maps its sections to `PROJECT.md`, then conducts a focused gap-filling interview (2-5 questions) to cover what the spec doesn't define. The original spec is staged as `RESEARCH.md` so all downstream agents have full access during planning and implementation.
- **Brownfield-aware routing in `import-spec-file`**: After import, checks for existing codebase docs before routing forward. Suggests `/shipyard:map` first when a codebase exists without analysis docs — consistent with the `brainstorm` routing pattern.
- **`/shipyard:plan` RESEARCH.md skip updated**: Pre-check now recognizes `RESEARCH.md` populated by either `/shipyard:import-spec` or `/shipyard:import-spec-file`, with updated user message.
- **`/shipyard:init` greenfield guidance updated**: Post-init next-step guidance now surfaces all three entry paths: `brainstorm`, `import-spec`, and `import-spec-file`.

## [4.2.0] - 2026-03-30

### Added
- **spec-kit integration** (`/shipyard:import-spec`): New command that bridges [spec-kit](https://github.com/github/spec-kit) artifacts into Shipyard's pipeline, replacing `/shipyard:brainstorm` when a spec already exists. Maps `spec.md` → `PROJECT.md`, stages `research.md`/`data-model.md`/`contracts/` → phase `RESEARCH.md`, and stages `tasks.md` → `SPECKIT-TASKS.md` for architect seeding.
- **spec-kit-aware `/shipyard:plan`**: Step 4 (Research) now skips the researcher agent when `RESEARCH.md` already exists from an import. Step 5 (Architecture) passes `SPECKIT-TASKS.md` to the architect as a seed for wave/plan decomposition when available.
- **`[NEEDS CLARIFICATION]` handling**: Unresolved spec-kit clarification markers are surfaced as an Open Questions section in `PROJECT.md` rather than silently dropped.

## [4.1.0] - 2026-03-25

### Added
- **Phase-scoped context loading** (CTX-001): Execution tier now extracts only the current phase's section from ROADMAP.md via awk, reducing context noise by ~500 tokens. Falls back to first 80 lines if extraction fails. Configurable via `context_phase_scope` in config.json.
- **Context rot detection** (CTX-005): Warns when assembled context exceeds a configurable threshold (default 8000 chars). Warning appears in agent context, not stderr. Configurable via `context_warn_threshold` in config.json.
- **Handoff skill** (CTX-003): New `/shipyard:handoff` command produces a structured HANDOFF.md for clean session transfers. Consumed one-shot on next session start (renamed to `.consumed`). Orchestrator writes the file directly (not delegated to sub-agents).
- **Mid-execution micro-lessons** (CTX-004): After each builder completes, orchestrator extracts a one-line takeaway to MICRO-LESSONS.md. Next builder in the same phase receives it as context. Phase-scoped, best-effort.
- **Agent context reporting** (CTX-002): Opt-in convention for agents to report turn count, compression status, and completion via `<!-- context: ... -->` comment. Logged to AGENT-METRICS.md for task sizing analysis.
- **WISC documentation**: New `docs/CONTEXT-ENGINEERING.md` explains Shipyard's context engineering design aligned with the WISC framework (Write, Isolate, Select, Compress).

## [4.0.0] - 2026-03-24

### BREAKING CHANGES
- **v2-to-v3 migration code removed** (MAINT-001): Users on v2.x must upgrade to v3.x first, then to v4.0. See `docs/MIGRATION-v3-v4.md`.

### Security
- Removed sanitize_lesson() security theater — `.shipyard/` documented as trusted local content (SEC-001)
- Added secrets pattern detection (sk-, ghp_, AKIA, BEGIN PRIVATE KEY) with stderr warnings on state writes (SEC-002)
- Created `.shipyard/.gitignore` as defense-in-depth against accidental commits (SEC-002)
- Documented lock security model and threat assumptions (SEC-003)

### Reliability
- Lock retry uses exponential backoff (0.05s → 1.0s cap, 120 max retries) for better concurrency (REL-002)
- Removed cross-filesystem mktemp fallback — atomic writes guaranteed or fail-fast with exit 3 (REL-003)
- Added bash 4.0+ runtime version check with macOS Homebrew hint (REL-004)
- Added log rotation to marketplace sync (100KB threshold, 500 lines retained) (REL-005)

### Maintainability
- Extracted STATE_SCHEMA_VERSION constant — replaces 6 hardcoded values (MAINT-002)
- Added debugger agent to packaged agents for marketplace distribution (MAINT-004)

### Documentation
- Created `docs/STATE-SCHEMA.md` with full JSON schema definition and evolution history (DOC-001)
- Documented all SHIPYARD_* environment variables in README.md (DOC-002)
- Created `docs/MIGRATION-v3-v4.md` with upgrade path and FAQ (DOC-003)

### Operations
- Added persistent hook failure logging to `~/.config/shipyard/hooks.log` with rotation (OPS-002)
- Added auto checkpoint pruning (>30 days) to ship command (OPS-003)

### Platform
- Added `windows-2022` (WSL) to CI matrix with Vampire/setup-wsl (COMPAT-001)
- Created `.gitattributes` for LF line ending enforcement (COMPAT-001)
- Replaced date command try-fail-fallback with upfront BSD/GNU detection (COMPAT-002)

## [3.6.1] - 2026-03-11

### Fixed
- **Init re-prompts all settings**: `/shipyard:init` now re-prompts all configuration options when run on an existing project, with current values as pre-filled defaults. Previously it refused to run and directed users to `/settings` or `--fresh`.
- **Codebase docs location is now an explicit prompt**: Added as question 8 in init settings collection instead of silently auto-detecting from `docs/codebase/`.

## [3.6.0] - 2026-03-11

### Added
- **STRIDE threat model for auditor**: Maps attack surface and trust boundaries before scanning, prioritizing the 6 analysis areas by actual risk
- **Divio documentation categories for documenter**: Every document typed as Tutorial, How-to guide, Reference, or Explanation — never mixed
- **Code example verification for documenter**: Bash tool added so documenter verifies code snippets run before including them
- **Skeptical review stance for reviewer**: Default assumes issues exist until evidence proves otherwise; zero-finding reviews trigger deeper inspection
- **Prior finding cross-validation for reviewer**: Checks REVIEW-*.md and ISSUES.md before starting; unresolved Critical findings auto-fail Stage 1
- **Hypothesis timeboxing for debugger**: ~15 minute timebox per hypothesis to prevent rabbit holes
- **Severity tags for debugger**: ROOT-CAUSE.md includes SEV1-4 rating for builder prioritization
- **Pre-build baseline for builder**: Runs test suite before changes to distinguish pre-existing failures from regressions
- **ISSUES.md consumption for builder**: Reads prior review findings before starting work
- **Structured failure documentation for builder**: Failure blocks include task, error output, files touched, and hypothesis for the debugger
- **Risk tags for architect**: Each plan tagged `Risk: low|medium|high` with rationale for builder/reviewer focus
- **ISSUES.md in architect instructions**: Plan decomposition now reads unresolved findings from prior reviews
- **Source freshness tracking for researcher**: External sources require publication dates; sources older than 2 years flagged as [Stale]
- **Inconclusive escalation for researcher**: "Decision Required" section when no clear winner exists
- **Effort estimation for simplifier**: Every finding tagged `trivial|moderate|significant` for builder prioritization
- **Codebase metrics for mapper**: Quantitative metrics per focus area (dependency count, test ratios, module count, etc.)
- **Output location discovery for mapper**: Proactively finds existing codebase directories and merges into them
- **Regression baseline for verifier**: References prior VERIFICATION.md files to define "previously passing"

### Changed
- **AGENT-GUIDE.md updated**: All 10 agent descriptions reflect new capabilities, inputs, and restrictions

## [3.5.0] - 2026-03-06

### Added
- **Plan critique (feasibility stress test)**: `/shipyard:plan` now runs a Step 6a critique that checks file existence, API surface matches, verify command runnability, forward references, hidden dependencies, and complexity before building. Produces `CRITIQUE.md` with READY/CAUTION/REVISE verdict. Gated on `plan_critique` config option (default: `true`).
- **Outcome surfacing in retries**: Builder retry prompts now include a "Recent Outcomes" summary from the current phase, giving retry agents context on what worked and what failed.
- **Structured outcome logging**: After each plan's review verdict, structured metadata (`builder:{model}, verdict:{verdict}, retries:{count}, domain:{task_type}`) is logged to NOTES.md via `state-write.sh --note`.

### Changed
- **Verifier agent expanded**: Added Plan Critique protocol section to `shipyard-verifier.md` agent definition with 5 feasibility checks and evidence requirements.
- **Config schema updated**: Added `plan_critique` (boolean, default `true`) to config.json schema in init, protocols, and defaults.

## [3.4.1] - 2026-03-05

### Fixed
- **Restored documentation quality gate**: Re-added "Per endpoint/function" detailed requirements section removed in v3.4.0, restoring full API documentation enforcement checklist
- **Fixed dispatch tool inconsistency**: Reverted `Agent()` back to `Task()` in parallel-dispatch and executing-plans skills to match authoritative command definitions (build.md, plan.md, ship.md)

## [3.4.0] - 2026-03-04

### Changed
- **All 16 skill descriptions improved**: Descriptions now include specific trigger phrases, quantitative thresholds, and natural language patterns for better activation accuracy
- **Stale content fixed**: Updated TypeScript `Task()` pseudo-code to `Agent()` tool syntax in parallel-dispatch and executing-plans skills
- **Added missing `/shipyard:debug` command**: using-shipyard skill now documents the debug command
- **Infrastructure validation expanded**: Added Kubernetes validation workflow and common mistakes table
- **Code simplification expanded**: Added bash/shell-specific AI anti-patterns with examples
- **Documentation skill trimmed**: Removed redundant duplicated section

## [3.3.0] - 2026-02-18

### Changed
- **Map merge-updates instead of wiping**: `/shipyard:map` now preserves existing codebase docs, merging new findings with existing content instead of deleting and rewriting. Resolved concerns are marked `[Resolved - YYYY-MM-DD]` rather than removed.
- **Map reads config for output path**: `/shipyard:map` now reads `codebase_docs_path` from config instead of hardcoding `.shipyard/codebase/`
- **Init detects existing `docs/codebase/`**: `/shipyard:init` now checks for a pre-existing `docs/codebase/` directory and defaults `codebase_docs_path` to it when found
- **Mapper agents use repo-relative paths**: All file path citations in codebase docs are now repo-relative (e.g., `scripts/state-read.sh`) instead of absolute paths
- **Codebase docs path cleanup**: Converted 283 absolute paths to repo-relative paths across all 7 existing codebase docs
- **Protocols updated**: Codebase Docs Protocol now documents merge-update behavior and relative path conventions

## [3.2.4] - 2026-02-11

### Changed
- **map command defaults to "all"**: `/shipyard:map` with no argument now runs all 4 focus areas (technology, architecture, quality, concerns) in parallel instead of just technology
- **map auto-saves and deletes old docs**: Results are written directly to `.shipyard/codebase/` after deleting any existing docs — no archive, no save prompt

## [3.2.3] - 2026-02-11

### Removed
- PreToolUse hook due to errors

## [3.2.2] - 2026-02-10

### Changed
- **Agent tool access expanded**: Added `Write` tool to auditor, mapper, researcher, reviewer, simplifier, and verifier agents so they can produce output artifacts directly

## [3.2.1] - 2026-02-10

### Added
- **Optional team dispatch pattern**: All 4 multi-agent commands (`build`, `plan`, `map`, `ship`) now support Claude Code native teams when `SHIPYARD_TEAMS_ENABLED=true` — presents user choice between team mode (parallel teammates) and agent mode (subagents)
- **Team Dispatch Protocol**: New protocol section in `docs/PROTOCOLS.md` documenting the detect/ask/branch pattern
- **Team-lead context in executing-plans**: Teammate Mode skill updated with team-lead orchestration guidance

### Changed
- **build.md**: Added Step 2b (Team or Agent Dispatch), team-mode branches for builders and reviewers, single-agent step notes, Team Cleanup block
- **plan.md**: Added Step 2c team/agent dispatch, Task dispatch notes for research, architect, and verifier steps
- **map.md**: Added team dispatch pattern for parallel mapper agents
- **ship.md**: Added Step 1a (Team or Agent Dispatch) for auditor, documenter, and verifier
- **parallel-dispatch skill**: Updated with concrete team dispatch pattern reference
- **Dispatch section formatting**: Aligned across all 4 commands for consistency

### Fixed
- **PreToolUse hook hardened**: Guard against malformed input and restrict matcher to prevent false-positive nudges
- **ShellCheck warnings**: Resolved warnings in `test/test_helper.bash`

## [3.2.0] - 2026-02-10

### Added
- **10 agent definition files** (`.claude/agents/`): shipyard-architect, shipyard-builder, shipyard-reviewer, shipyard-verifier, shipyard-auditor, shipyard-simplifier, shipyard-documenter, shipyard-researcher, shipyard-mapper, shipyard-debugger — each with tool restrictions, model defaults, and structured system prompts
- **`/shipyard:help [topic]` command**: Progressive disclosure — shows quick-reference table by default, detailed help for a specific command/skill when given a topic argument
- **`/shipyard:doctor` command**: Health-check diagnostic — verifies jq, git, skills discoverable, hooks registered, `.shipyard/` structure valid
- **`/shipyard:cancel` command**: Graceful build interruption — creates checkpoint, sets status to "paused", reports what can be resumed
- **`/shipyard:debug` command**: Dispatches the new debugger agent for root-cause analysis with 5 Whys protocol
- **Alias commands**: `/shipyard:s` (status), `/shipyard:b` (build), `/shipyard:p` (plan), `/shipyard:q` (quick)
- **Hook kill switch**: `SHIPYARD_DISABLE_HOOKS=true` disables all hooks; `SHIPYARD_SKIP_HOOKS=hook1,hook2` selectively skips named hooks
- **PreToolUse hook** (`hooks/pre-tool-use.sh`): Protocol compliance nudges — model routing reminders for Task dispatch, checkpoint reminders during builds, state-write guidance
- **SessionEnd hook** (`hooks/stop.sh`): Appends interruption note to HISTORY.md when session ends during active build
- **Backup-on-write**: STATE.json.bak created before every write; state-read.sh falls back to .bak on corruption
- **SHA-256 checksum verification**: Checksum written alongside STATE.json on write, verified on read
- **Working notes** (`--note` flag): `state-write.sh --note "text"` appends timestamped entries to `.shipyard/NOTES.md`; auto-cleared on phase completion; loaded in execution context tier
- **Human-readable state inspect**: `state-read.sh --human` outputs formatted text (phase, status, position, history, next action) for terminal debugging
- **Natural language trigger phrases**: All 16 skills updated with conversational activation phrases (e.g., "build me", "fix this bug", "test first", "is this secure")
- **Conflict resolution rules**: Priority table added to using-shipyard skill (debugging > TDD > verification > brainstorming)
- **Adaptive model routing docs**: Context tier model adjustment documented in PROTOCOLS.md (light/standard/heavy)
- **Agent composition patterns**: Named workflows documented in AGENT-GUIDE.md (Full Build, Quick Task, Investigation, Brownfield, Quality Audit)
- **23 new BATS tests** (108 total): kill switch, selective skip, phase-specific evidence, backup/checksum, working notes, human inspect

### Changed
- **Phase-specific evidence gate**: `task-completed.sh` now scopes evidence check to current phase directory instead of cumulative across all phases
- **Parallel BATS execution**: `test/run.sh` uses `--jobs` for concurrent test execution
- **Test categorization**: All tests tagged `unit` or `integration` via BATS tags; added `test:fast` and `test:ci` npm scripts
- **Session hook skill descriptions**: Truncation increased from 80 to 120 characters for better skill matching
- **CI pipeline expanded**: ShellCheck now covers `test/test_helper.bash`; `npm audit --audit-level=high` added
- **Standardized test teardown**: Default `teardown()` in `test_helper.bash` unsets `SHIPYARD_*` and `CLAUDE_CODE_*` env vars

## [3.1.1] - 2026-02-09

### Changed
- **using-shipyard skill**: Replaced terse one-line descriptions with concrete "what it actually does" summaries for all 16 skills and 21 commands. Reorganized commands into Lifecycle, Session Management, and On-Demand categories.

### Fixed
- **Comprehensive documentation audit**: 24 files corrected across commands, skills, agents, and docs
- README Plugin Structure tree: added 7 missing commands, 2 scripts, 2 tests, package-lock.json
- README `context_tier` values: added missing `planning`, `execution`, `brownfield` options
- AGENT-GUIDE overview table: architect dispatcher `init` → `brainstorm`, mapper dispatcher `init, map` → `map`
- AGENT-GUIDE Mermaid diagram: added brainstorm to lifecycle flow
- ship.md: sequential step numbering (was 3a/3b/4a), fixed next-milestone routing to `/brainstorm`
- status.md: added routing entry for "shipped" state
- worktree.md: consolidated nested `<output>` sections into single block
- recover.md: `<error-handling>` tag → `<output>` for consistency
- rollback.md: replaced hardcoded `${CLAUDE_PLUGIN_ROOT}` with Checkpoint Protocol reference
- settings.md: added missing `context_tier` values, commit step after changes
- brainstorm.md: added Model Routing and Agent Context Protocol references
- build.md: added Model Routing Protocol to reviewer and verifier dispatches
- plan.md: Agent Context Protocol format made consistent
- quick.md: escalation path corrected to `/shipyard:plan`
- move-docs.md: error suggestion corrected to `/shipyard:map`
- resume.md: fragile step number reference replaced with descriptive name
- using-shipyard skill: 6 missing commands added to "I Want To..." table, descriptions harmonized
- shipyard-debugging skill: removed references to 3 non-existent supporting files
- shipyard-writing-skills skill: merged duplicate `<instructions>` blocks, removed `@graphviz-conventions.dot` reference
- shipyard-executing-plans skill: added PROTOCOLS.md links to Model Routing Protocol references
- shipyard-brainstorming skill: clarified external skill reference
- anthropic-best-practices.md: description guidance aligned with CSO section
- lessons-learned skill: updated stale step reference
- COMPARISON.md: corrected model routing category count and context tier count
- PROTOCOLS.md: documented config schema version field
- QUICKSTART.md: added worktree/move-docs/history to Manage State, qualified on-demand scope

## [3.1.0] - 2026-02-09

### Added
- **`/shipyard:brainstorm` command**: Standalone requirements exploration via Socratic dialogue, captures PROJECT.md, offers roadmap generation
- **`/shipyard:settings` command**: View and update workflow settings interactively or directly (`/settings list`, `/settings key value`)
- **Audit executive summary**: Security audit reports now lead with a plain-English executive summary, risk level, prioritized "What to Do" action table, and themes — before diving into detailed findings
- **`docs/COMPARISON.md`**: Feature comparison table (moved from README for cleaner getting-started experience)

### Changed
- **`/shipyard:init` decomposed to settings-only**: No longer handles codebase mapping, brainstorming, or roadmap generation. Creates `.shipyard/`, collects preferences via 3 batches of AskUserQuestion, writes config.json + STATE.json, displays guided next-steps
- **`/shipyard:plan` handles missing roadmaps**: New Step 1.5 creates ROADMAP.md if missing (dispatches architect from PROJECT.md, or offers brainstorming/minimal options)
- **`using-shipyard` skill restructured**: Leads with "What is Shipyard?" orientation and "Getting Started" guide for new users; enforcement rules moved to end; added `<rules>` and `<examples>` XML tags
- **Audit findings format**: Advisory findings use concise bullet format; Cross-Component Analysis elevated from bottom; Analysis Coverage checklist added; Risk Level thresholds defined (Critical/High/Medium/Low)
- **README.md simplified**: Lifecycle diagram at top, plain-English intro, Quick Start updated for new workflow, "Why Memory Was Removed" trimmed, Feature Comparison moved to docs/
- **QUICKSTART.md updated**: Added intro paragraph, brainstorm/settings commands, lifecycle flow reflects new init → brainstorm → plan → build → ship
- **AGENT-GUIDE.md updated**: Pipeline mermaid diagram reflects init as settings-only with separate brainstorm subgraph; agent dispatch references updated

### Fixed
- Stale agent dispatch references in README.md and AGENT-GUIDE.md (init no longer dispatches mapper or architect)
- `TodoWrite` references replaced with `TaskCreate` in using-shipyard, executing-plans, and writing-skills skills
- `skills/shipyard-brainstorming/SKILL.md` output path clarified (command → PROJECT.md, standalone → docs/plans/)

## [3.0.1] - 2026-02-08

### Fixed
- Improved Windows compatibility for state locking (mkdir-based lock uses portable path handling)
- Skip ShellCheck BATS tests when shellcheck is not installed on the system
- Added missing `<rules>` wrapper to security-audit skill and created anthropic-best-practices reference document

## [3.0.0] - 2026-02-07

### Added
- **Agent Teams support**: Automatic detection of Claude Code Agent Teams via `CLAUDE_CODE_TEAM_NAME` and `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` environment variables
- **Team detection utility**: `scripts/team-detect.sh` exports `SHIPYARD_IS_TEAMMATE`, `SHIPYARD_TEAMS_ENABLED`, `SHIPYARD_TEAM_NAME`
- **TeammateIdle hook**: Quality gate that verifies version check + test pass before allowing teammate to stop (`hooks/teammate-idle.sh`)
- **TaskCompleted hook**: Quality gate that verifies evidence artifacts exist before allowing task completion (`hooks/task-completed.sh`)
- **State file locking**: mkdir-based atomic locking in `state-write.sh` when teams mode is enabled (prevents concurrent write corruption)
- **Teammate mode sections**: 4 skills adapted for teams awareness (`shipyard-executing-plans`, `shipyard-verification`, `parallel-dispatch`, `using-shipyard`)
- 18 new BATS tests for team detection, hooks, and state locking (85 total)

### Changed
- **Pure bash project**: All TypeScript tooling removed — no `tsc`, `vitest`, `tsx`, or Node.js build steps
- **CI simplified**: Removed Node.js version matrix, TypeScript type checking, and memory test steps from GitHub Actions
- **Pre-commit hook simplified**: Now runs only `bash scripts/check-versions.sh && npm test` (no build or memory test steps)
- Solo users see zero behavioral change — all teams features are gated on environment variables

### Removed
- **Memory system**: MCP server, SQLite database, embeddings engine, background indexer, and all TypeScript source/dist files
- **5 memory commands**: `/shipyard:memory-search`, `/shipyard:memory-status`, `/shipyard:memory-forget`, `/shipyard:memory-enable`/`memory-disable`, `/shipyard:memory-import`
- **Memory skill**: `shipyard:memory` auto-activating skill
- **search-memory agent**: Dedicated memory search and synthesis agent
- **TypeScript tooling**: `tsc`, `vitest`, `tsx`, and all TS dev dependencies — project is now pure bash
- **MCP configuration**: `.mcp.json` removed (no MCP server to configure)
- **PostToolUse hook**: `memory-indexer.sh` background indexing hook removed from `hooks.json`
- Memory enrichment step from lessons-learned skill and `/shipyard:ship` workflow
- Memory opt-in prompt from `/shipyard:init` workflow
- `model_routing.memory` config key from protocols and documentation

## [2.11.2] - 2026-02-07

### Fixed
- Added default fallback for `CLAUDE_PLUGIN_ROOT` in `.mcp.json` to suppress `/doctor` warning for local development

## [2.11.1] - 2026-02-07

### Fixed
- Added required `mcpServers` wrapper key to `.mcp.json` so Claude Code can discover the shipyard-memory MCP server

## [2.11.0] - 2026-02-07

### Changed
- Migrated project state from `STATE.md` (Markdown) to `STATE.json` (JSON) + `HISTORY.md` (append-only audit trail)
- Schema version bumped from 2.0 (string) to 3 (integer)
- `state-read.sh` reads STATE.json via single `jq` call (10x faster than grep/sed parsing)
- `state-write.sh` produces STATE.json and appends to HISTORY.md
- Auto-migration: projects with STATE.md are automatically migrated on first read
- All documentation, protocols, and command references updated to reflect STATE.json

## [2.10.0] - 2026-02-06

### Added
- **7 on-demand agent commands**: `/shipyard:review`, `/shipyard:audit`, `/shipyard:simplify`, `/shipyard:document`, `/shipyard:research`, `/shipyard:verify`, `/shipyard:map` — dispatch any agent directly without the full lifecycle pipeline. All commands work outside shipyard projects.
- **Quickstart guide**: New `docs/QUICKSTART.md` — intent-to-command decision tree, lifecycle vs on-demand comparison, model routing reference, and common workflows
- **Quality gates in executing-plans skill**: Post-completion security audit (auditor agent) and simplification review (simplifier agent) now run after the final reviewer, matching the guarantees provided by `/shipyard:build`

### Changed
- Updated README, AGENT-GUIDE.md, and using-shipyard skill with all 7 new commands and updated agent dispatch sources
- Executing-plans skill flow diagram now includes auditor → simplifier nodes between final reviewer and git-workflow

## [2.9.1] - 2026-02-06

### Fixed
- **Agent role boundary guardrails**: Added explicit "Role Boundary — STRICT" section to all 10 agents preventing them from exceeding their designated role (e.g., architect must not write code, reviewer must not fix issues, auditor must not apply patches). Each agent now has a clear list of prohibited actions and a statement that their deliverable is a report/plan, not implementation.

## [2.9.0] - 2026-02-06

### Added
- **Agent Reference Guide**: New `docs/AGENT-GUIDE.md` — comprehensive reference for all 10 agents with model assignments, dispatch patterns, tool access, restrictions, and pipeline lifecycle diagram
- **Independent model routing**: Split shared `review` config key into `review`, `simplification`, and `documentation` for independent model control per agent
- **Mapper and search-memory routing**: Added `model_routing.mapping` and `model_routing.memory` config keys (previously missing from routing table)
- **Turn limits**: Recommended `max_turns` for all 10 agents documented in PROTOCOLS.md
- **Model selection guidance**: Upgrade/downgrade recommendations per config key in PROTOCOLS.md
- **Marketplace sync hook**: `scripts/marketplace-sync.sh` — async SessionStart hook that fetches marketplace clone once per hour
- **Auto-release pipeline**: CI now creates git tags and GitHub releases automatically on successful main push (no separate release workflow needed)

### Changed
- Builder and reviewer agent model changed from `inherit` to `sonnet` (matches PROTOCOLS.md defaults)
- Model routing config.json example updated to v1.3 with all 11 keys (10 agents + `debugging` reserved)
- `commands/init.md` model routing description updated to reflect all categories
- `commands/memory-search.md` no longer hardcodes "Haiku" — references Model Routing Protocol
- `skills/memory/SKILL.md` updated with model routing configurability note
- README agents table now includes search-memory and links to AGENT-GUIDE.md
- `scripts/check-versions.sh` now checks `plugin.json` version sync
- CI lint job runs version sync check on every push (not just PRs)

### Security
- Removed `.shipyard/` and `.shipyard.archived/` from git tracking (sensitive project state)
- Added `.shipyard.archived/` to `.gitignore`

## [2.8.0] - 2026-02-05

### Added
- **Migration framework**: Sequential SQL migration system (`src/memory/migrate.ts`) with `schema_migrations` tracking table. Migrations run automatically on database initialization. Failed migrations roll back and halt.
- **Repair tool**: `src/memory/repair.ts` with 7-check pipeline — structural integrity, referential integrity, orphaned vectors, stale source refs, missing embeddings, REINDEX, VACUUM. Supports dry-run (read-only) and fix modes.
- **Export tool**: `src/memory/export.ts` with streaming JSON writer for constant-memory exports. Excludes embeddings (derived data), sets 0600 permissions.
- **3 new MCP tools**: `memory_repair`, `memory_export`, `memory_migrate` (10 tools total)
- **107 new Vitest tests** across 7 new test files: db.test.ts (18), search.test.ts (15), indexer.test.ts (15), migrate.test.ts (5), repair.test.ts (13), export.test.ts (17), integration.test.ts (11)
- **Integration test suite**: 9 end-to-end scenarios against real SQLite — import/recall, text search, vector search, prune, export roundtrip, repair dry run/fix, migration application, MCP handler integration
- Shared TypeScript interfaces in `src/memory/types.ts` (RepairCheck, RepairReport, ExportMetadata, ExportResult)
- Structured JSON logger at `src/memory/logger.ts`

### Security
- Path traversal prevention: `memory_export` output_path restricted to `CONFIG_DIR/exports/` directory
- Zod input validation for all new MCP tools

### Changed
- `initDatabase()` now uses migration runner instead of executing schema.sql directly
- `schema.sql` retained as reference but no longer executed at runtime
- Total test count: 218 (62 BATS + 156 Vitest, 149 pass + 7 skip)

## [2.7.0] - 2026-02-04

### Added
- Database backup via SQLite `.backup()` API with WAL checkpoint for consistency
- `memory_backup` MCP tool for manual database backup
- `memory_health` MCP tool returning DB connectivity, vector search status, embedding model status, and overall health
- `--backup` CLI flag for `mcp-server.ts`
- Automatic database backup after indexing in `memory-indexer.sh` (fault-tolerant)
- Backup rotation: keeps only the 5 most recent backups
- `test:coverage` npm script and CI coverage via `@vitest/coverage-v8`
- 8 new tests (3 BATS + 6 Vitest health check, -1 overlap = 8 net new)

### Security
- Prompt injection mitigation: `sanitize_lesson()` strips XML/HTML tags, HTML entities, code blocks, and prompt directives from lesson content before injection into agent context
- Word-boundary directive filtering prevents mid-line injection bypass
- Backup files set to `0600` permissions matching source database

### Fixed
- 500-character cap on individual lesson content prevents oversized context injection
- 5-lesson maximum enforced with boundary test coverage

## [2.6.1] - 2026-02-04

### Fixed
- Trap collision risk in `state-write.sh` replaced with cleanup stack pattern
- SQL injection surface hardened with input validation on dynamic placeholders in `db.ts`
- Recovery regex tightened to reject non-numeric directory names (`state-write.sh`)
- `echo` replaced with `printf` for POSIX safety in recovery loop (`state-write.sh`)
- Untracked file detection added to checkpoint dirty worktree check (`checkpoint.sh`)
- Exit code 3 now emitted for actual git errors in `checkpoint.sh` (was always exit 0)
- Hardcoded skill list replaced with auto-discovery from `skills/*/SKILL.md` glob (`state-read.sh`)
- E2E test setup refactored to use shared `setup_git_repo` helper (`e2e-smoke.bats`)
- Redundant bats install check removed from `test/run.sh`
- sqlite-vec extension load status now tracked via `isVecEnabled()` export

### Security
- MCP SDK vulnerability patched via npm audit fix (GHSA-345p-7cg4-v4c7)
- Database file permissions set to `0600` after creation
- Secret scrubber expanded with Anthropic (`sk-ant-api03-`), OpenAI (`sk-proj-`), and Azure connection string patterns

### Added
- Structured JSON logger (`src/memory/logger.ts`) replacing bare `console.*` across 4 TypeScript files
- Log rotation for `memory.log` (truncates to last 1000 lines when >10MB)
- Structured warning emitted when storage cap pruning deletes exchanges
- `.nvmrc` file enforcing Node 20
- ShellCheck `--severity=warning` and `tsc --noEmit` added to CI lint job
- 3 new Vitest tests for Anthropic, OpenAI, and Azure secret patterns (49 total)

### Changed
- CI lint job now installs Node.js and runs TypeScript type checking
- ShellCheck scope expanded to include `test/run.sh`

## [2.6.0] - 2026-02-04

### Added
- All 45 agent, command, skill, and protocol files improved with Claude API best practices

### Fixed
- `dist/` committed for plugin marketplace distribution
- npm publish step removed from release workflow (no NPM_TOKEN needed)

### Changed
- `plugin.json` now includes version field for correct cache versioning

## [2.5.3] - 2026-02-04

### Changed
- All dependencies and CI actions updated to latest versions

## [2.5.2] - 2026-02-04

### Fixed
- Hooks updated to use correct Claude Code hooks schema fields
- Memory indexer throttle added to prevent excessive indexing

## [2.5.0] - 2026-02-03

### Breaking
- Memory commands renamed to use `shipyard:` prefix (e.g., `/shipyard:memory-search`)

### Added
- Auto-recall via `search-memory` agent with stronger skill triggers

### Fixed
- Search scores, background indexer, and version sync checks

## [2.4.1] - 2026-02-03

### Fixed
- sqlite-vec extension loading via package helper and KNN query fix
- Unused TypeScript variables removed
- GitHub token length corrected in scrubber tests
- BATS test syntax for piped commands

### Changed
- Node 18 support dropped, Node 20+ required
- Husky pre-commit hook added

## [2.4.0] - 2026-02-03

### Added
- **Memory**: Episodic memory for cross-session conversation recall
  - Local SQLite database with sqlite-vec for semantic vector search
  - Automatic secret scrubbing (AWS keys, GitHub tokens, API keys, private keys, passwords)
  - Per-project opt-out via `"memory": false` in `.shipyard/config.json`
  - 1 GB storage cap with automatic pruning of oldest exchanges
  - Background indexing every 5 minutes
  - One-time import of existing `~/.claude/projects/` history
  - MCP server interface for future-proofing
- New skill: `memory` — when needing past context or solving problems you've encountered before
- New commands:
  - `/shipyard:memory-search <query>` — semantic search across past conversations
  - `/shipyard:memory-forget` — delete current session from memory
  - `/shipyard:memory-status` — storage statistics and health check
  - `/shipyard:memory-enable` / `memory-disable` — toggle memory on/off
  - `/shipyard:memory-import` — re-run history import
- Memory opt-in prompt during `/shipyard:init`
- Memory enrichment in lessons-learned workflow during `/shipyard:ship`
- TypeScript implementation in `src/memory/` with full test suite

### Changed
- Lessons-learned skill enhanced to query memory for debugging struggles and decisions
- `/shipyard:ship` Step 3a now enriches lesson candidates with conversation memory
- `/shipyard:init` Step 5 now asks about memory preferences
- Node.js minimum version raised to 18.0.0 (for native fetch in MCP server)
- package.json version bumped to 2.4.0

### Dependencies
- Added: `@modelcontextprotocol/sdk`, `@xenova/transformers`, `better-sqlite3`, `sqlite-vec`, `zod`
- Added dev: `@types/better-sqlite3`, `@types/node`, `tsx`, `typescript`, `vitest`
- Added optional: `@anthropic-ai/sdk` (for Haiku summarization)

## [2.0.0] - 2026-02-01

### Added
- Bats test suite with 39 tests across all scripts (checkpoint, state-read, state-write, integration)
- State corruption detection and recovery (`--recover` flag on state-write.sh)
- Atomic writes for STATE.md (prevents corruption on interruption)
- Schema versioning (Schema 2.0) for STATE.md
- Lessons-learned capture system with session context integration
- CONTRIBUTING.md with developer guidelines
- Shared protocol system (docs/PROTOCOLS.md) reducing duplication across commands and agents
- Token budget comments in all SKILL.md files
- New skill: lessons-learned
- New command: /worktree
- New agents: mapper, researcher, documenter
- hooks.json schemaVersion field

### Changed
- Session hook output reduced from ~6000 to ~1500 tokens (75% reduction)
- Full skill injection replaced with compact summary (progressive disclosure)
- shipyard-writing-skills trimmed from 634 to under 500 lines
- All commands and agents deduplicated via shared protocols
- All 15 skills standardized with consistent frontmatter
- package.json version bumped to 2.0.0 with proper metadata

### Fixed
- printf '%b' format string injection vulnerability
- grep -oP GNU-only dependency replaced with POSIX-compatible alternative
- Unquoted variables in find, glob expansions, and for loops
- Path traversal prevention (no '..' in user-derived paths)
- Git tag label sanitization (injection prevention)
- checkpoint.sh prune validation (non-integer days rejected)
- Dirty worktree detection in checkpoint.sh
- Missing phases directory crash (Issue #4)

### Security
- All script arguments validated: phase is integer, label is alphanumeric+hyphens, status from known enum
- shellcheck --severity=style passes on all scripts
- Input validation on all user-facing parameters
