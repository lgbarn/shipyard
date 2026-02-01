# Review: Plan 1.2 -- state-read.sh Corruption Detection + Bug Fixes

**Reviewer:** Claude Opus 4.5 (automated)
**Date:** 2026-02-01
**Verdict:** PASS

---

## Stage 1: Spec Compliance

**Verdict:** PASS

### Task 1: Add corruption detection and fix phases/ bug in state-read.sh

- **Status:** PASS
- **Exit code contract (lines 6-10):** Present in script header exactly as specified, covering codes 0, 1, 2, 3.
- **jq dependency check (lines 19-22):** Implemented correctly. Outputs structured JSON to stderr and exits 3.
- **STATE.md corruption detection (lines 36-56):** Handles both empty files (line 36, `-z "$state_md"`) and truncated files missing `**Status:**` or `**Current Phase:**` fields (lines 45-56). Outputs structured JSON with error, details, exitCode, and recovery fields. Exits code 2.
- **Issue #4 fix (lines 109-113):** `find .shipyard/phases/` is wrapped in `[ -d ".shipyard/phases" ]` guard. Falls back to `phase_dir=""`.
- **Glob safety for plans/ and results/ (lines 117, 129):** Both subdirectory loops guarded with `[ -d ... ]` checks.
- **Acceptance criteria verified:**
  - Corrupt STATE.md exits code 2 with JSON containing "error" key -- confirmed via manual test and bats test 7.
  - Empty STATE.md exits code 2 -- confirmed via manual test and bats test 8.
  - Missing `.shipyard/phases/` does not crash -- confirmed via bats test 9.
  - Valid STATE.md continues to work (exit 0) -- confirmed via bats tests 1-6.
  - `shellcheck --severity=warning scripts/state-read.sh` exits 0 -- confirmed.

### Task 2: Update test_helper.bash and add corruption/bug-fix tests

- **Status:** PASS
- **`assert_valid_json` helper (test_helper.bash:39-43):** Implemented as specified. Uses `run jq . <<< "$output"` + `assert_success`. Addresses Issue #5.
- **`setup_shipyard_corrupt_state` fixture (test_helper.bash:46-50):** Creates STATE.md with header only, missing required fields.
- **`setup_shipyard_empty_state` fixture (test_helper.bash:53-56):** Creates 0-byte STATE.md via `: >`.
- **Test: corrupt STATE.md exits code 2 (state-read.bats:101-108):** Matches spec. Asserts failure, exit code 2, and JSON error field.
- **Test: empty STATE.md exits code 2 (state-read.bats:110-115):** Matches spec.
- **Test: missing phases/ directory (state-read.bats:117-124):** Matches spec. Verifies Issue #4 fix.
- **Issue #1 fix:** Fragile `$?` pattern replaced with `assert_valid_json` in tests 1 (line 16) and 6 (line 96).
- **Issue #2 fix:** Planning tier test (line 76) now includes `mkdir -p .shipyard/phases`.
- **Issue #3 fix:** Minimal tier test (lines 39-47) creates PROJECT.md and ROADMAP.md, then uses `refute_output` to verify exclusion.
- **Issue #6 fix:** Test 3 renamed to "state-read: minimal tier includes STATE.md but excludes PROJECT.md and ROADMAP.md" (line 33).
- **Acceptance criteria verified:**
  - All 9 state-read tests pass.
  - All 36 tests pass across the full suite (`bash test/run.sh`).
  - Issues #1 through #6 all addressed.

### Task 3: Verify shellcheck and full test suite

- **Status:** PASS
- `shellcheck --severity=warning scripts/state-read.sh` exits 0 with no output.
- `bash test/run.sh` exits 0, all 36 tests pass, no regressions.

---

## Stage 2: Code Quality

### Critical

None.

### Important

None.

### Suggestions

1. **Corruption detection outputs to stdout while jq check outputs to stderr** (`/Users/lgbarn/Personal/shipyard/scripts/state-read.sh` lines 20 vs 37-54). The jq dependency error goes to stderr (line 20, `>&2`), but corruption errors go to stdout. The summary notes this was intentional (consumers expect parseable output on stdout). This is an acceptable design decision but creates an inconsistency between error output channels. Consider documenting this convention in the exit code header comment.
   - Remediation: Add a comment in the exit code header noting that exit-2 errors output structured JSON on stdout (replacing normal output) while exit-3 errors output on stderr (since jq is unavailable to produce normal output).

2. **Corruption detection only checks first missing field** (`/Users/lgbarn/Personal/shipyard/scripts/state-read.sh` lines 46-47). If `**Status:**` is missing, `local_missing` is set to "Status". Then if `**Current Phase:**` is also missing, the append logic `${local_missing:+$local_missing, }Current Phase` correctly builds "Status, Current Phase". However, if only `**Current Phase:**` is missing, `local_missing` starts empty and becomes "Current Phase" without the append prefix. This is actually correct behavior -- just noting the logic is subtle and worth a comment.
   - Remediation: No change required. The logic is correct.

3. **Test 7 uses raw `jq -e` instead of `assert_valid_json`** (`/Users/lgbarn/Personal/shipyard/test/state-read.bats` line 107). The corrupt state test validates JSON via `echo "$output" | jq -e '.error' >/dev/null` rather than using the new `assert_valid_json` helper. This is defensible since it checks a specific field, but differs from the pattern used elsewhere.
   - Remediation: This is fine as-is since `jq -e '.error'` checks both JSON validity and field existence in one assertion.

4. **Issues #1-#6 remain listed as "Open" in ISSUES.md** (`/Users/lgbarn/Personal/shipyard/.shipyard/ISSUES.md`). All six issues have been addressed by this plan but the issues file was not updated to move them to the Closed table.
   - Remediation: Move issues #1-#6 to the Closed Issues table with resolution notes referencing Plan 1.2.

---

## Summary

**Recommendation: APPROVE**

All three tasks are implemented correctly and match the spec. The exit code contract is documented, corruption detection works for both empty and truncated STATE.md files, the phases/ directory crash (Issue #4) is fixed, and all six tracked issues are addressed in the code. The full test suite (36 tests) passes with zero regressions, and shellcheck reports no warnings.

The only actionable item is updating ISSUES.md to close issues #1-#6, which is a bookkeeping task rather than a code quality concern.
