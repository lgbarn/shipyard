# Simplification Report
**Phase:** Phase 2 - Testing Foundation
**Date:** 2026-02-01
**Files analyzed:** 7 (test/run.sh, test/test_helper.bash, 4 .bats files, package.json)
**Findings:** 3 (1 high, 1 medium, 1 low priority)

## High Priority

### Duplicated setup logic: `mkdir -p .shipyard/phases`
- **Type:** Consolidate
- **Locations:**
  - test/state-read.bats:24
  - test/state-read.bats:51
  - test/state-read.bats:85
  - test/integration.bats:6
  - test/integration.bats:50
- **Description:** Five tests manually create `.shipyard/phases/` directory because `state-read.sh` uses `find .shipyard/phases/` under `set -euo pipefail`, which fails when the directory doesn't exist. The `2>/dev/null` in the script only suppresses stderr, not the exit code. This is a known bug documented in SUMMARY-2.3.md but not fixed.
- **Suggestion:** Add a helper function `setup_shipyard_with_phases()` to test_helper.bash that calls `setup_shipyard_dir()` and creates the phases directory. Replace all 5 instances with this helper. This consolidates the workaround in one place.
- **Impact:** Reduces 5 scattered mkdir commands to 1 helper function call each. If the underlying bug in state-read.sh is ever fixed, only the helper needs updating (or removal), not 5 test files.

## Medium Priority

### Redundant assertion pattern: verify tag exists, check output is non-empty
- **Type:** Refactor
- **Locations:**
  - test/integration.bats:33-36
  - test/integration.bats:42-45
- **Description:** Two tests use the pattern `run git tag -l "pattern"`, then `assert_success`, then `[ -n "$output" ]`. The `assert_success` already verifies git didn't error. The `[ -n "$output" ]` check is redundant if the goal is to verify the tag exists — git tag -l exits 0 even if it finds no tags, so checking for non-empty output makes sense, but it's duplicative across these tests.
- **Suggestion:** Extract a helper function `assert_git_tag_exists()` that takes a tag pattern and combines `run git tag -l`, `assert_success`, and `[ -n "$output" ]` with a clear failure message. This makes the tests more readable and reduces duplication.
- **Impact:** Eliminates 6 lines of repeated assertion logic across 2 tests, improves test readability.

## Low Priority

### Overly detailed comments in test files
- **Type:** Remove
- **Locations:**
  - test/checkpoint.bats:23 ("Tag name should contain sanitized version...")
  - test/checkpoint.bats:47 ("Create a fake old checkpoint tag...")
  - test/state-read.bats:8 ("No .shipyard dir exists")
  - test/state-read.bats:22 ("STATE.md has Status: building...")
  - test/integration.bats:13 ("Verify write succeeded")
- **Description:** Several tests include comments that restate what the adjacent code already makes clear. For example, "No .shipyard dir exists" appears immediately before a comment that says exactly that. These comments add noise without adding clarity.
- **Suggestion:** Remove comments that restate obvious code. Keep only comments that explain _why_ a test does something non-obvious (e.g., why the prune test uses a 2020 timestamp, why phases/ must be created).
- **Impact:** Minor reduction in line count (5-10 lines), slight improvement in readability.

## Summary

- **Duplication found:** 1 instance (mkdir .shipyard/phases) across 5 tests
- **Dead code found:** 0 unused definitions
- **Complexity hotspots:** 0 functions exceeding thresholds
- **AI bloat patterns:** 0 instances (tests are appropriately minimal)
- **Estimated cleanup impact:** 15-20 lines removable via helper function consolidation and comment cleanup

## Recommendation

**Simplification is optional and can be deferred.** The test code is clean, focused, and follows good patterns. The high-priority finding (duplicated `mkdir .shipyard/phases`) is worth addressing to reduce fragility, but it does not block shipping. The underlying issue is that `state-read.sh` has a bug (documented in SUMMARY-2.3.md) where it fails when `.shipyard/phases/` doesn't exist. The proper fix is to patch `state-read.sh` itself, not work around it in every test.

If you choose to simplify now, prioritize:
1. Add `setup_shipyard_with_phases()` helper to consolidate the mkdir workaround
2. Consider extracting `assert_git_tag_exists()` for checkpoint tests

If you defer, this is acceptable. The code is functional and maintainable as-is.

## Notes

**Positive findings:**
- No cross-file duplication between test files (each .bats file is appropriately independent)
- test_helper.bash is well-designed: provides exactly 3 focused helpers, loads dependencies once, exports absolute paths
- test/run.sh is minimal and appropriate (20 lines, auto-installs dependencies, single responsibility)
- Test structure follows bats best practices: setup helpers, clear test names, appropriate use of assert_output --partial
- No dead code or unused helpers detected
- No over-engineering: helpers are used by multiple tests, no single-use abstractions
- No AI bloat patterns: no verbose error handling, no redundant type checks, no unnecessary wrappers

**Why no major issues?**
Phase 2 created test infrastructure from scratch with a clear plan. There was no existing code to conflict with, no legacy patterns to duplicate. Each task built on the previous task's output (test_helper.bash was created before .bats files), so duplication was avoided by design. The only duplication found is a workaround for a bug in the code under test, not a design flaw in the tests themselves.
