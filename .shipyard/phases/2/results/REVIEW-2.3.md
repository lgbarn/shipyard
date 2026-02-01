# REVIEW-2.3: state-read.sh Unit Tests

**Plan:** PLAN-2.3
**Reviewer:** claude-opus-4-5
**Date:** 2026-02-01
**Verdict:** PASS

---

## Stage 1: Spec Compliance

**Verdict:** PASS

### Must-Have 1: Minimum 6 test cases for state-read.sh
- **Status:** PASS
- **Notes:** Exactly 6 `@test` blocks are present in `test/state-read.bats`. All 6 pass when executed.

### Must-Have 2: At least 1 negative test (no .shipyard directory)
- **Status:** PASS
- **Notes:** Test 1 (`no .shipyard directory outputs 'No Shipyard Project Detected' JSON`) changes into `$BATS_TEST_TMPDIR` which has no `.shipyard/` directory, exercises the else branch at line 163 of `scripts/state-read.sh`, and asserts the expected message.

### Must-Have 3: Outputs valid JSON in all cases (verified via jq)
- **Status:** PASS
- **Notes:** Tests 1 and 6 explicitly pipe `$output` through `jq .` and assert exit code 0. Test 2 uses `jq -r` to extract a specific field, which also validates JSON. Tests 3, 4, and 5 rely on `assert_success` (the script itself uses `jq -n` to produce output, so success implies valid JSON). The coverage is adequate.

### Must-Have 4: Context tier auto-detection tested (building -> execution)
- **Status:** PASS
- **Notes:** Test 4 (`auto-detect building status resolves to execution tier`) uses `setup_shipyard_with_state` which sets `Status: building` in STATE.md, creates a plan file under `.shipyard/phases/1/plans/`, and asserts the plan content appears in output -- confirming the auto-detection resolved to execution tier.

### Must-Have 5: Minimal tier loads only STATE.md
- **Status:** PASS
- **Notes:** Test 3 (`minimal state (STATE.md only) is included in output`) explicitly writes `{"context_tier": "minimal"}` to config.json, then asserts STATE.md content is present. The test does not assert that PROJECT.md or ROADMAP.md are absent (no negative assertion), but the plan did not require that level of rigor. The test matches the plan specification.

### Must-Have 6: Planning tier includes PROJECT.md and ROADMAP.md
- **Status:** PASS
- **Notes:** Test 5 (`planning tier includes PROJECT.md and ROADMAP.md`) sets `Status: planning` in STATE.md, creates both files, and asserts both appear in output.

### Deviations

The summary documents one deviation: tests 2, 4, and 6 needed `mkdir -p .shipyard/phases` to work around a bug in `state-read.sh` where `find .shipyard/phases/` fails under `set -e` when the directory does not exist. This is a legitimate workaround that does not violate the plan. The builder correctly identified and documented the underlying bug without attempting an out-of-scope fix.

---

## Stage 2: Code Quality

### Critical

None.

### Important

1. **Fragile jq validation pattern** -- `/Users/lgbarn/Personal/shipyard/test/state-read.bats` lines 13-14, 90-91

   The pattern `echo "$output" | jq . >/dev/null 2>&1` followed by `assert_equal "$?" "0"` is fragile. After `run`, the `$?` variable is already set to the exit code of the `run` command, not the jq pipeline. However, in bats, `assert_equal "$?" "0"` actually checks the exit code of the *previous* command (`echo ... | jq ...`), because `assert_equal` receives the already-expanded `$?`. This works in practice because `$?` is expanded before `assert_equal` executes, but the intent would be clearer and more robust with an explicit subshell check or by using `run` again:

   ```bash
   run jq . <<< "$output"
   assert_success
   ```

   - **Remediation:** Replace the two-line `echo | jq` + `assert_equal "$?" "0"` pattern with `run jq . <<< "$output"` followed by `assert_success`. This is idiomatic bats and eliminates any ambiguity about `$?` scope.

2. **Test 5 missing phases directory** -- `/Users/lgbarn/Personal/shipyard/test/state-read.bats` line 60-78

   Test 5 (planning tier) uses `setup_shipyard_dir` which only creates `.shipyard/`. The `state-read.sh` script calls `find .shipyard/phases/` on line 74 for execution/full tiers. Currently this test passes because `Status: planning` means the script never reaches the `find` call. However, if the script's tier logic were ever refactored to check the phases directory earlier (before the tier gate), this test would break. The other tests already defensively create `.shipyard/phases/` -- test 5 should do the same for consistency.

   - **Remediation:** Add `mkdir -p .shipyard/phases` after `setup_shipyard_dir` in test 5 for defensive consistency.

3. **No test for minimal tier exclusion** -- `/Users/lgbarn/Personal/shipyard/test/state-read.bats` test 3

   Test 3 verifies that STATE.md content is present under the minimal tier, but does not verify that PROJECT.md/ROADMAP.md are excluded. Creating those files and asserting they are absent (`refute_output --partial`) would strengthen confidence that the minimal tier actually restricts context loading.

   - **Remediation:** In test 3, create PROJECT.md and ROADMAP.md files, then use `refute_output --partial` to confirm they are not included in minimal-tier output.

### Suggestions

1. **Extract jq validation into a helper** -- `/Users/lgbarn/Personal/shipyard/test/test_helper.bash`

   Multiple tests validate JSON output. A shared `assert_valid_json()` helper would reduce duplication and make the validation pattern consistent across all state-read tests (and future test files).

   - **Remediation:** Add to `test_helper.bash`:
     ```bash
     assert_valid_json() {
         run jq . <<< "$output"
         assert_success
     }
     ```

2. **Test naming could include tier name explicitly** -- `/Users/lgbarn/Personal/shipyard/test/state-read.bats`

   Test 3 is named "minimal state (STATE.md only) is included in output" but does not include the word "tier" which is the domain concept. Consider "minimal tier: includes STATE.md content" for consistency with tests 4 and 5 which reference tiers.

   - **Remediation:** Rename to `"state-read: minimal tier includes STATE.md content"` for consistency.

---

## Summary

**Recommendation: APPROVE**

All 6 must-haves from PLAN-2.3 are met. The tests are well-structured, appropriately scoped, and all pass. The builder documented a real bug in `state-read.sh` (the `find` exit code issue under `set -e`) without going out of scope to fix it. The deviation (adding `mkdir -p .shipyard/phases`) is a reasonable workaround that is well-documented in the summary.

The important findings (fragile `$?` pattern, missing negative assertion for minimal tier) are quality improvements that do not block merge. The tests correctly exercise the script's core behaviors: no-project fallback, JSON structure, tier auto-detection, and tier-specific file loading.
