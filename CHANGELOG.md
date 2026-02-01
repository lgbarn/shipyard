# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

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
