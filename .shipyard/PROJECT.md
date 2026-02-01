# Shipyard v2.0 - Comprehensive Improvement Milestone

## Description

Shipyard is a Claude Code plugin that provides a structured project execution framework with multi-agent orchestration, staged pipelines, and quality gates. Version 2.0 is a clean-break release addressing security vulnerabilities, reliability gaps, testing infrastructure, developer experience, and two new capabilities: a lessons-learned system that feeds discoveries back into CLAUDE.md, and token optimization across all context files following progressive disclosure patterns.

This milestone covers improvements across all areas identified in the v1.2 codebase analysis, prioritized by severity, with freedom to restructure without backward compatibility constraints.

## Goals

1. **Eliminate security vulnerabilities** in shell scripts (injection, input validation, path traversal)
2. **Establish automated testing** with both unit tests (bats-core) and integration tests
3. **Improve reliability** of state management, error handling, and recovery workflows
4. **Add lessons-learned system** that captures discoveries during building/shipping and updates CLAUDE.md
5. **Optimize token usage** across all Shipyard files with concrete budgets and progressive disclosure
6. **Improve developer experience** with reduced documentation duplication, contribution guidelines, and better onboarding
7. **Add .gitignore** and schema versioning for v2.0

## Non-Goals

- Backward compatibility with v1.x `.shipyard/` directories
- Adding new agent types or commands (focus is on hardening existing ones)
- Cloud service integrations or external API dependencies
- GUI or web interface

## Requirements

### Security Hardening
- Quote all variables in shell scripts; eliminate unsafe `ls` in command substitution
- Add input validation for all command arguments (phase numbers, checkpoint tags, file paths)
- Prevent path traversal in file path arguments
- Add `.gitignore` covering `.shipyard/` temporary state files and sensitive data
- Run shellcheck on all bash scripts with zero warnings

### Automated Testing
- Add bats-core unit tests for all 3 shell scripts (`state-read.sh`, etc.)
- Add integration tests that exercise Shipyard commands against a test project
- Verify state files are created correctly, context tiers load properly, hooks fire
- Test error paths: corrupt state, missing files, invalid arguments
- Add CI-ready test runner (can be run with a single command)

### Reliability & Error Handling
- Ensure shell scripts exit with proper error codes on failure
- Improve state corruption recovery with automated detection and repair
- Add tool version checks for required dependencies (jq, git, bash version)
- Fix git worktree isolation so concurrent access to `.shipyard/` is safe

### Lessons Learned System
- After `/shipyard:ship`, automatically capture issues found during discovery and building
- Update the project's CLAUDE.md with structured lessons learned (patterns to follow, pitfalls to avoid)
- Format lessons so they benefit all skills, not just Shipyard
- Include a review step so users can approve/edit before CLAUDE.md is modified

### Token Optimization
- Set concrete token budgets for each file type:
  - Always-loaded content (CLAUDE.md injections, session hooks): minimize aggressively
  - Agent definitions: keep focused system prompts, reference supporting material
  - Skill definitions: SKILL.md under 500 lines, use supporting files for details
  - Command definitions: progressive disclosure — summary up front, details on demand
- Restructure files to use progressive disclosure pattern
- Ensure Claude discovers and loads context on demand rather than upfront
- Reduce session start injection from ~6000 tokens to target ~2000 tokens or less
- Audit all files for content that can be moved to on-demand supporting files

### Developer Experience
- Reduce documentation duplication across 35+ markdown files
- Add CONTRIBUTING.md with guidelines for adding agents, skills, commands
- Add schema versioning for `.shipyard/` directory format
- Simplify the session hook to inject minimal context with pointers to more

## Non-Functional Requirements

- All shell scripts must pass shellcheck with zero warnings
- All tests must be runnable with a single command (`npm test` or equivalent)
- Token budgets must be measurable (include a script or method to count tokens per file)
- Changes must work on macOS and Linux; Windows via WSL acceptable
- No new runtime dependencies beyond existing (bash, jq, git)

## Success Criteria

1. Zero shellcheck warnings across all bash scripts
2. Full test suite passes: unit tests for all scripts, integration tests for core workflows
3. All command arguments are validated with clear error messages for invalid input
4. `.gitignore` prevents accidental commits of sensitive state
5. Lessons-learned system successfully captures and proposes CLAUDE.md updates after shipping
6. Session start context injection reduced by at least 50% from current ~6000 tokens
7. All SKILL.md files under 500 lines with supporting files for overflow
8. CONTRIBUTING.md exists with clear instructions for extending Shipyard
9. State corruption is automatically detected with guided recovery

## Constraints

- Clean break from v1.x — no backward compatibility required (v2.0 release)
- Must remain a pure orchestration layer — no cloud services, no databases
- Must continue to work as a Claude Code plugin (npm package distribution)
- No new runtime dependencies
