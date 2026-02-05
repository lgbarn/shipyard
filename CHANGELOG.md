# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

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
