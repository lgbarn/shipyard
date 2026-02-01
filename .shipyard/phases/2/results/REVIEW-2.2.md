# REVIEW-2.2: checkpoint.sh Unit Tests

**Reviewer:** Claude Opus 4.5
**Date:** 2026-02-01
**Plan:** PLAN-2.2 (checkpoint.sh unit tests)
**Files reviewed:** `test/checkpoint.bats`, `scripts/checkpoint.sh`, `test/test_helper.bash`

---

## Stage 1: Spec Compliance

**Verdict:** PASS

### Must-Have 1: Minimum 5 test cases for checkpoint.sh
- **Status:** PASS
- **Notes:** File contains exactly 5 `@test` blocks (lines 6, 18, 27, 37, 44). All 5 pass when executed.

### Must-Have 2: At least 1 negative test (bad prune days rejected)
- **Status:** PASS
- **Notes:** Test 4 (`--prune rejects non-integer days`, line 37) passes `"abc"` as the prune argument, asserts failure, and checks for `"positive integer"` in the output. The script (`checkpoint.sh` line 19) emits `"Error: --prune argument must be a positive integer, got 'abc'"` and exits 1. Match confirmed.

### Must-Have 3: Tag creation verified in real git repo
- **Status:** PASS
- **Notes:** Test 1 (line 6) calls `setup_git_repo` which runs `git init`, configures user, creates an initial commit, then runs checkpoint.sh. After creation, lines 13-15 verify with `git tag -l "shipyard-checkpoint-*"` that the tag actually exists in the repo.

### Must-Have 4: Label sanitization verified
- **Status:** PASS
- **Notes:** Test 2 (line 18) passes `'my<label>&here;now'` and asserts the output contains `"mylabelherenow"`. The script's `tr -cd 'a-zA-Z0-9._-'` on line 36 of `checkpoint.sh` strips `<`, `>`, `&`, and `;`, producing exactly `"mylabelherenow"`.

### Must-Have 5: Prune removes old tags, keeps recent ones
- **Status:** PASS
- **Notes:** Test 5 (line 44) creates an annotated tag with timestamp `20200101T000000Z`, creates a recent checkpoint, then prunes with `--prune 1`. The test verifies: (a) the old tag is gone via `refute_output --partial "20200101"`, and (b) the recent tag still exists via `[ -n "$output" ]` after listing recent tags.

### Must-Have 6: Non-git-repo produces warning not error (exit 0)
- **Status:** PASS
- **Notes:** Test 3 (line 27) changes to `$BATS_TEST_TMPDIR` without calling `setup_git_repo`, so there is no `.git` directory. `assert_success` confirms exit 0, and `assert_output --partial "Warning"` confirms the warning message. The script's fallback on line 48-51 of `checkpoint.sh` outputs to stderr; bats-core `run` captures both streams.

### Deviations from Plan
- **None.** The implementation is line-for-line identical to the plan spec. The summary reports no deviations.

---

## Stage 2: Code Quality

### Critical

None.

### Important

None.

### Suggestions

1. **Test isolation -- missing `teardown` or per-test cleanup** (`test/checkpoint.bats`, all tests)
   - The `setup_git_repo` helper uses `cd "$BATS_TEST_TMPDIR"` and runs `git init` there. If bats reuses `BATS_TEST_TMPDIR` across tests in the same file, the git repo from test 1 could leak into test 2. In practice, bats-core assigns a unique `BATS_TEST_TMPDIR` per test, so this works today, but an explicit `setup()` function that creates a unique subdirectory would make the isolation guarantee explicit and protect against future bats version changes.
   - **Remediation:** Consider adding a `setup()` function that creates and cds into a unique subdirectory of `BATS_TEST_TMPDIR`, e.g., `WORK="$BATS_TEST_TMPDIR/work-$$"; mkdir -p "$WORK"; cd "$WORK"`.

2. **Prune test relies on string comparison for date logic** (`test/checkpoint.bats`, line 48)
   - The test creates a tag named `shipyard-checkpoint-old-20200101T000000Z` and trusts that the script's string-based date comparison (`[[ "$TAG_DATE" < "$CUTOFF" ]]`) will correctly identify it as old. This works because ISO-8601 timestamps sort lexicographically. The coupling is correct but subtle -- a comment explaining why string comparison is valid here would help future readers.
   - **Remediation:** Add a brief comment in the test or in `checkpoint.sh` noting that `YYYYMMDDTHHMMSSZ` format is intentionally chosen so lexicographic comparison equals chronological comparison.

3. **No edge-case test for empty or all-special-character labels** (`test/checkpoint.bats`)
   - The script has a guard on line 38-41 of `checkpoint.sh` that rejects labels that become empty after sanitization. No test covers this path. This is outside the plan scope, so it is a suggestion for future coverage.
   - **Remediation:** Add a test like `run bash "$CHECKPOINT" '<<<>>>'` and `assert_failure` with appropriate error message check.

4. **No test for default prune days** (`test/checkpoint.bats`)
   - `checkpoint.sh` defaults to 30 days when `--prune` is called without a second argument. No test covers this default. Again, outside plan scope but worth noting.
   - **Remediation:** Add a test that calls `bash "$CHECKPOINT" --prune` (no days argument) and asserts success with output containing "30 days".

---

## Summary

**Recommendation: APPROVE**

All 6 must-haves from PLAN-2.2 are met. The test file matches the plan spec exactly, all 5 tests pass against the actual `checkpoint.sh` script, and no deviations were introduced. The code is clean, readable, and uses bats-assert idioms correctly. The suggestions above are minor improvements for future robustness and coverage -- none block merging.
