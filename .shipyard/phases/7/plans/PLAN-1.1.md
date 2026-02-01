---
phase: final-validation-release
plan: 1
wave: 1
dependencies: []
must_haves:
  - CHANGELOG.md at repo root following Keep a Changelog format with v2.0.0 section
  - CHANGELOG.md covers Added, Changed, Fixed, and Security categories from Phases 1-6
  - E2e smoke test script at test/e2e-smoke.bats exercising write -> read -> checkpoint -> prune pipeline
  - Smoke test runs in isolated temp directory (no side effects on repo)
  - Smoke test validates JSON output structure from state-read.sh
  - Smoke test validates checkpoint tag creation and prune lifecycle
files_touched:
  - CHANGELOG.md
  - test/e2e-smoke.bats
tdd: false
---

# Plan 1.1: CHANGELOG.md and End-to-End Smoke Test

## Context

Phase 7 research confirmed all 39 tests pass, shellcheck is clean, and npm pack succeeds. Two items remain before tagging: (1) a CHANGELOG.md documenting all v2.0 changes and (2) an end-to-end smoke test that validates the full script pipeline in a single automated run. The smoke test satisfies ROADMAP Gate 3 ("Smoke test of full lifecycle completes without manual intervention").

The CHANGELOG content was drafted in RESEARCH.md Section 6. The smoke test must exercise `state-write.sh` (structured write + recovery), `state-read.sh` (tier detection + JSON validity), and `checkpoint.sh` (create + prune) in sequence within a temporary project directory.

## Tasks

<task id="1" files="CHANGELOG.md" tdd="false">
  <action>
    Create `CHANGELOG.md` at the repository root using the Keep a Changelog format. Include:

    1. Header with format attribution link
    2. `## [2.0.0] - 2026-02-01` section with four subsections:
       - **Added**: test suite (39 tests), state corruption detection/recovery, atomic writes, Schema 2.0, lessons-learned system, CONTRIBUTING.md, shared protocols, token budget comments, new skill (lessons-learned), new command (/worktree), new agents (mapper, researcher, documenter), hooks.json schemaVersion
       - **Changed**: session hook output reduced 75% (~6000 to ~1500 tokens), full skill injection replaced with compact summary, shipyard-writing-skills trimmed below 500 lines, commands/agents deduplicated via shared protocols, all 15 skills standardized, package.json bumped to 2.0.0
       - **Fixed**: printf '%b' format string injection, grep -oP GNU-only dependency, unquoted variables, path traversal prevention, git tag label sanitization, checkpoint.sh prune validation, dirty worktree detection, missing phases directory crash (Issue #4)
       - **Security**: all script arguments validated, shellcheck --severity=style passes, input validation on all user-facing parameters
    3. No `[Unreleased]` section (this is the initial changelog)
  </action>
  <verify>test -f /Users/lgbarn/Personal/shipyard/CHANGELOG.md && grep -q "\[2.0.0\]" /Users/lgbarn/Personal/shipyard/CHANGELOG.md && grep -q "### Added" /Users/lgbarn/Personal/shipyard/CHANGELOG.md && grep -q "### Changed" /Users/lgbarn/Personal/shipyard/CHANGELOG.md && grep -q "### Fixed" /Users/lgbarn/Personal/shipyard/CHANGELOG.md && grep -q "### Security" /Users/lgbarn/Personal/shipyard/CHANGELOG.md && echo "PASS" || echo "FAIL"</verify>
  <done>CHANGELOG.md exists at repo root with [2.0.0] section containing Added, Changed, Fixed, and Security subsections covering all Phase 1-6 work.</done>
</task>

<task id="2" files="test/e2e-smoke.bats" tdd="false">
  <action>
    Create `test/e2e-smoke.bats` -- a bats test file that exercises the full script pipeline end-to-end. The file must:

    1. **Setup**: Create a temp directory, initialize it as a git repo (`git init`, `git commit --allow-empty`), create `.shipyard/` directory structure
    2. **Teardown**: Remove temp directory completely

    Include these test cases:

    **Test 1: "e2e: structured write creates valid state then read returns JSON"**
    - Run `state-write.sh --phase 1 --position "Smoke test" --status planning`
    - Verify exit code 0
    - Verify STATE.md contains Schema 2.0, Phase 1, Status planning
    - Run `state-read.sh` and capture output
    - Verify exit code 0
    - Verify output is valid JSON (pipe through `jq .`)
    - Verify JSON contains `hookSpecificOutput` key

    **Test 2: "e2e: checkpoint create and prune lifecycle"**
    - Run `state-write.sh --phase 1 --position "Pre-checkpoint" --status in_progress` (state-read needs STATE.md)
    - Run `checkpoint.sh "smoke-test"`
    - Verify exit code 0 and output contains "Checkpoint created"
    - Verify `git tag -l "shipyard-checkpoint-*"` shows the tag
    - Run `checkpoint.sh --prune 0` to prune all checkpoints
    - Verify output contains "Pruned 1 checkpoint"
    - Verify `git tag -l "shipyard-checkpoint-*"` is empty

    **Test 3: "e2e: recovery rebuilds state from artifacts"**
    - Create `.shipyard/phases/2/plans/PLAN-1.1.md` with minimal content
    - Remove STATE.md
    - Run `state-write.sh --recover`
    - Verify exit code 0
    - Verify new STATE.md contains "Phase" and "2" and "Schema" and "2.0"
    - Run `state-read.sh` on recovered state
    - Verify valid JSON output (exit 0, passes `jq .`)

    Important implementation notes:
    - Use `load test_helper` for shared setup
    - All script paths must be absolute (use `$PROJECT_ROOT/scripts/...`)
    - cd into temp directory for each test (scripts look for `.shipyard/` relative to cwd)
    - Export PATH to include project scripts directory if needed
  </action>
  <verify>cd /Users/lgbarn/Personal/shipyard && bash test/run.sh test/e2e-smoke.bats 2>&1 | tail -5</verify>
  <done>All 3 e2e smoke tests pass. The full lifecycle (write -> read -> checkpoint -> prune -> recover -> read) completes without manual intervention. Gate 3 satisfied.</done>
</task>

<task id="3" files="test/e2e-smoke.bats" tdd="false">
  <action>
    Validate the smoke test does not interfere with existing tests. Run the full suite:

    1. Run `bash test/run.sh` (runs all .bats files including the new e2e-smoke.bats)
    2. Verify all tests pass (should be 39 existing + 3 new = 42 total)
    3. Verify no temp directories are left behind after the run
    4. If any test fails, diagnose and fix the smoke test only (do not modify existing tests or scripts)
  </action>
  <verify>cd /Users/lgbarn/Personal/shipyard && bash test/run.sh 2>&1 | grep -E "^(ok|not ok|1\.\.)" | tail -5 && echo "---" && bash test/run.sh 2>&1 | grep "^not ok" | wc -l | xargs -I{} test 0 -eq {} && echo "ALL PASS" || echo "FAILURES DETECTED"</verify>
  <done>Full test suite (42 tests) passes with zero failures. No temp files left behind. Existing 39 tests unaffected by new smoke test.</done>
</task>
