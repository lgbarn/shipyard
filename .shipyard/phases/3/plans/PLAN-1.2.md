# Plan 1.2: state-read.sh -- Corruption Detection, Bug Fixes, Exit Codes

---
phase: 3
plan: 1.2
wave: 1
dependencies: []
must_haves:
  - Exit code contract documented in script header (0, 1, 2, 3)
  - Truncated/corrupt STATE.md detected and reported with exit code 2 and structured JSON error
  - Issue #4 fixed (phases/ directory missing no longer crashes)
  - Issues #1, #2, #3, #5, #6 addressed in tests
files_touched:
  - scripts/state-read.sh
  - test/state-read.bats
  - test/test_helper.bash
tdd: true
---

## Context

state-read.sh is the most critical script -- it runs on every session start. This plan adds corruption detection (truncated STATE.md missing required fields triggers exit code 2 with structured JSON error output), fixes the known bug where `find .shipyard/phases/` crashes when the directory does not exist (Issue #4), documents the exit code contract, and adds comprehensive tests. This plan also updates `test/test_helper.bash` to add a shared `assert_valid_json` helper (Issue #5) and a corrupt-state fixture function.

## Dependencies

None -- this is a Wave 1 plan that can execute in parallel with Plans 1.1 and 1.3.

## Tasks

### Task 1: Add corruption detection and fix phases/ bug in state-read.sh
**Files:** scripts/state-read.sh
**Action:** modify
**Description:**

1. **Add exit code contract** to script header (after line 4, before `set -euo pipefail`):
   ```
   # Exit Codes:
   #   0 - Success (JSON context output produced)
   #   1 - User error (invalid tier value -- currently auto-corrected, reserved for future use)
   #   2 - State corruption (STATE.md missing required fields or malformed)
   #   3 - Missing dependency (jq not found)
   ```

2. **Add jq dependency check** early in the script (after PLUGIN_ROOT assignment, before any jq usage):
   ```bash
   if ! command -v jq >/dev/null 2>&1; then
       echo '{"error":"Missing dependency: jq is required but not found in PATH","exitCode":3}' >&2
       exit 3
   fi
   ```

3. **Add STATE.md corruption detection** after reading `state_md` (after line 21, before extracting status/phase). If STATE.md exists but is missing required fields (`**Status:**` or `**Current Phase:**`), emit a structured JSON error to stdout and exit 2:
   ```bash
   # Validate STATE.md has required fields
   if [ -n "$state_md" ]; then
       local_missing=""
       echo "$state_md" | grep -q '\*\*Status:\*\*' || local_missing="Status"
       echo "$state_md" | grep -q '\*\*Current Phase:\*\*' || local_missing="${local_missing:+$local_missing, }Current Phase"
       if [ -n "$local_missing" ]; then
           jq -n --arg missing "$local_missing" '{
               error: "STATE.md is corrupt or incomplete",
               details: ("Missing required field(s): " + $missing),
               exitCode: 2,
               recovery: "Run: bash scripts/state-write.sh --recover"
           }'
           exit 2
       fi
   fi
   ```
   Handle the case where STATE.md exists but is empty (0 bytes) the same way -- empty file means all fields are missing.

4. **Fix Issue #4** -- the phases/ directory crash. On line 74, wrap the `find` call in a directory existence check:
   ```bash
   # Before (line 74):
   phase_dir=$(find .shipyard/phases/ -maxdepth 1 -type d -name "${phase}*" -o -name "0${phase}*" 2>/dev/null | head -1)

   # After:
   if [ -d ".shipyard/phases" ]; then
       phase_dir=$(find .shipyard/phases/ -maxdepth 1 -type d -name "${phase}*" -o -name "0${phase}*" 2>/dev/null | head -1)
   else
       phase_dir=""
   fi
   ```

5. **Fix related glob safety** in the execution tier section. The `for plan_file in "${phase_dir}/plans/"PLAN-*.md` loop on line 79 already has `[ -e "$plan_file" ] || continue` guard, which is correct. But add a directory existence check for `plans/` and `results/` subdirectories before entering those loops:
   ```bash
   if [ -n "$phase_dir" ] && [ -d "${phase_dir}/plans" ]; then
       # existing plan loop...
   fi
   ```
   And similarly for the results/ section.

**Acceptance Criteria:**
- `echo "# Broken" > .shipyard/STATE.md && bash scripts/state-read.sh` exits with code 2 and outputs JSON with "error" key
- Empty STATE.md (0 bytes) exits with code 2
- Missing `.shipyard/phases/` directory does not crash the script (exit 0 with valid JSON)
- Existing valid STATE.md continues to work (exit 0)
- `shellcheck --severity=warning scripts/state-read.sh` exits 0

### Task 2: Update test_helper.bash and add corruption/bug-fix tests to state-read.bats
**Files:** test/test_helper.bash, test/state-read.bats
**Action:** modify
**Description:**

**test/test_helper.bash additions:**

1. Add `assert_valid_json` helper function (fixes Issue #5):
   ```bash
   # Assert that $output is valid JSON (replaces fragile jq + $? pattern)
   assert_valid_json() {
       run jq . <<< "$output"
       assert_success
   }
   ```

2. Add `setup_shipyard_corrupt_state` fixture:
   ```bash
   # Create .shipyard with a corrupt (truncated) STATE.md
   setup_shipyard_corrupt_state() {
       setup_shipyard_dir
       echo "# Shipyard State" > .shipyard/STATE.md
       # Missing required fields: Status, Current Phase
   }
   ```

3. Add `setup_shipyard_empty_state` fixture:
   ```bash
   # Create .shipyard with an empty STATE.md
   setup_shipyard_empty_state() {
       setup_shipyard_dir
       : > .shipyard/STATE.md
   }
   ```

**test/state-read.bats additions (append to end of file):**

1. **"state-read: corrupt STATE.md (missing Status) exits code 2 with JSON error"**:
   ```bash
   @test "state-read: corrupt STATE.md (missing Status) exits code 2 with JSON error" {
       setup_shipyard_corrupt_state
       run bash "$STATE_READ"
       assert_failure
       assert_equal "$status" 2
       # Output should be valid JSON with error field
       echo "$output" | jq -e '.error' >/dev/null
   }
   ```

2. **"state-read: empty STATE.md exits code 2"**:
   ```bash
   @test "state-read: empty STATE.md exits code 2" {
       setup_shipyard_empty_state
       run bash "$STATE_READ"
       assert_failure
       assert_equal "$status" 2
   }
   ```

3. **"state-read: missing phases directory does not crash (Issue #4)"**:
   ```bash
   @test "state-read: missing phases directory does not crash (Issue #4)" {
       setup_shipyard_with_state
       # Do NOT create .shipyard/phases/ -- this is the bug trigger
       # Status is "building" which auto-resolves to execution tier, which calls find on phases/
       run bash "$STATE_READ"
       assert_success
       echo "$output" | jq -e '.hookSpecificOutput' >/dev/null
   }
   ```

4. **Fix Issue #1** -- Replace fragile `$?` pattern in existing tests. In test 1 (line 13-14) and test 6 (line 90-91), replace:
   ```bash
   # Old:
   echo "$output" | jq . >/dev/null 2>&1
   assert_equal "$?" "0"

   # New (using the helper or inline):
   run jq . <<< "$output"
   assert_success
   ```

5. **Fix Issue #2** -- In test 5 (planning tier, line 60-78), add `mkdir -p .shipyard/phases` to match other tests that create it defensively.

6. **Fix Issue #3** -- In test 3 (minimal tier, line 34-43), add assertions that PROJECT.md and ROADMAP.md content is NOT present:
   ```bash
   # Add to existing minimal tier test:
   echo "# Should Not Appear" > .shipyard/PROJECT.md
   echo "# Also Hidden" > .shipyard/ROADMAP.md
   # ... run state-read ...
   refute_output --partial "Should Not Appear"
   refute_output --partial "Also Hidden"
   ```

7. **Fix Issue #6** -- Rename test 3 from "state-read: minimal state (STATE.md only) is included in output" to "state-read: minimal tier includes STATE.md but excludes PROJECT.md and ROADMAP.md".

**Acceptance Criteria:**
- All new tests pass (corrupt state exit 2, empty state exit 2, missing phases/ no crash)
- All existing tests still pass (with the $? pattern fixes applied)
- Issues #1, #2, #3, #4, #5, #6 are addressed
- `npx bats test/state-read.bats` exits 0
- `bash test/run.sh` exits 0

### Task 3: Verify shellcheck and full test suite
**Files:** (none -- verification only)
**Action:** test
**Description:**
Run shellcheck on state-read.sh and verify the full test suite passes. This is a gate task -- if anything fails, fix it before marking this plan complete.

```bash
shellcheck --severity=warning scripts/state-read.sh
bash test/run.sh
```

**Acceptance Criteria:**
- `shellcheck --severity=warning scripts/state-read.sh` exits 0 with no warnings
- `bash test/run.sh` exits 0 with all tests passing
- No regressions in any test file

## Verification

```bash
cd /Users/lgbarn/Personal/shipyard
# Run state-read tests specifically
npx bats test/state-read.bats
# Run full suite
bash test/run.sh
# Shellcheck
shellcheck --severity=warning scripts/state-read.sh
# Manual smoke test: corrupt STATE.md
cd /tmp && mkdir -p .shipyard && echo "# broken" > .shipyard/STATE.md
bash /Users/lgbarn/Personal/shipyard/scripts/state-read.sh; echo "exit: $?"
# Should output JSON with error and exit 2
rm -rf /tmp/.shipyard
```
