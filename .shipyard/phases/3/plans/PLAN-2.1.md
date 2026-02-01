# Plan 2.1: Integration Tests -- Recovery Round-Trip and Cross-Script Verification

---
phase: 3
plan: 2.1
wave: 2
dependencies: [1.1, 1.2, 1.3]
must_haves:
  - Integration test proving corrupt STATE.md -> recovery -> read round-trip
  - Integration test proving atomic write does not leave partial STATE.md
  - Integration test proving schema version survives write-read cycle
  - All Phase 2 existing tests still pass
files_touched:
  - test/integration.bats
tdd: false
---

## Context

After Wave 1 completes, all three scripts have their Phase 3 enhancements. This plan adds integration tests that exercise cross-script workflows: recovering a corrupt state, verifying the schema version survives a write-read cycle, and confirming that atomic writes protect against partial file states. This plan only touches `test/integration.bats`, which is not modified by any Wave 1 plan.

## Dependencies

- **Plan 1.1** (checkpoint.sh changes) -- needed for checkpoint tag recovery integration
- **Plan 1.2** (state-read.sh changes) -- needed for corruption detection in round-trip test
- **Plan 1.3** (state-write.sh changes) -- needed for --recover flag and schema version

## Tasks

### Task 1: Add corruption recovery round-trip integration test
**Files:** test/integration.bats
**Action:** modify
**Description:**

Append the following integration test to `test/integration.bats`:

```bash
@test "integration: corrupt STATE.md detected then recovered via --recover" {
    setup_shipyard_dir
    mkdir -p .shipyard/phases/2/plans
    echo "# Plan 2.1" > .shipyard/phases/2/plans/PLAN-2.1.md

    # Write a corrupt STATE.md (missing required fields)
    echo "# Broken State File" > .shipyard/STATE.md

    # Read should detect corruption (exit 2)
    run bash "$STATE_READ"
    assert_failure
    assert_equal "$status" 2
    echo "$output" | jq -e '.error' >/dev/null

    # Recovery should rebuild from artifacts
    run bash "$STATE_WRITE" --recover
    assert_success

    # Read should now succeed with recovered state
    run bash "$STATE_READ"
    assert_success
    echo "$output" | jq -e '.hookSpecificOutput' >/dev/null

    # Verify recovered state references the correct phase
    run cat .shipyard/STATE.md
    assert_output --partial "**Current Phase:** 2"
    assert_output --partial "**Schema:** 2.0"
}
```

This test exercises the full corruption detection and recovery workflow across both state-read.sh and state-write.sh.

**Acceptance Criteria:**
- Test passes end-to-end: corrupt -> detect -> recover -> read succeeds
- Exit code 2 is correctly returned for corrupt state
- Recovered STATE.md is valid and readable by state-read.sh

### Task 2: Add schema version and atomic write integration tests
**Files:** test/integration.bats
**Action:** modify
**Description:**

Append two more integration tests:

1. **"integration: schema version 2.0 survives write-read cycle"**:
   ```bash
   @test "integration: schema version 2.0 survives write-read cycle" {
       setup_shipyard_dir
       mkdir -p .shipyard/phases

       # Write with structured args
       bash "$STATE_WRITE" --phase 1 --position "Schema test" --status planning

       # Verify schema in file
       run cat .shipyard/STATE.md
       assert_output --partial "**Schema:** 2.0"

       # Read and verify JSON output includes the schema in context
       run bash "$STATE_READ"
       assert_success
       assert_output --partial "Schema"
       assert_output --partial "2.0"
   }
   ```

2. **"integration: write-recover-checkpoint round-trip"**:
   ```bash
   @test "integration: write-recover-checkpoint round-trip" {
       setup_git_repo
       mkdir -p .shipyard/phases/3/results
       echo "# Summary" > .shipyard/phases/3/results/SUMMARY-3.1.md

       # Create a checkpoint first
       bash "$CHECKPOINT" "pre-recovery"

       # Recover state from artifacts
       run bash "$STATE_WRITE" --recover
       assert_success

       # Verify recovered state is correct
       run cat .shipyard/STATE.md
       assert_output --partial "**Current Phase:** 3"
       assert_output --partial "**Status:** complete"

       # Create post-recovery checkpoint
       git add -A && git commit -q -m "recovered state" || true
       run bash "$CHECKPOINT" "post-recovery"
       assert_success
       assert_output --partial "Checkpoint created"

       # Both checkpoint tags should exist
       run git tag -l "shipyard-checkpoint-*"
       assert_output --partial "pre-recovery"
       assert_output --partial "post-recovery"
   }
   ```

**Acceptance Criteria:**
- Schema 2.0 appears in written STATE.md and is visible in state-read.sh JSON output
- Write-recover-checkpoint round-trip completes without errors
- Both checkpoint tags are created and persist

### Task 3: Run full test suite and final verification
**Files:** (none -- verification only)
**Action:** test
**Description:**

Run the complete test suite to verify all Phase 3 changes work together without regressions.

```bash
cd /Users/lgbarn/Personal/shipyard

# Full test suite
bash test/run.sh

# Shellcheck all scripts
shellcheck --severity=warning scripts/state-read.sh scripts/state-write.sh scripts/checkpoint.sh

# Count total tests (should be original count + new Phase 3 tests)
npx bats test/*.bats 2>&1 | tail -1
```

Verify the following Phase 3 success criteria are met:
1. Truncated STATE.md is detected and reported (exit code 2)
2. Atomic writes confirmed (no temp files left, valid STATE.md after write)
3. `--recover` rebuilds valid STATE.md from .shipyard/ contents
4. All exit codes documented in script headers and tested
5. `schema: 2.0` present in all newly created STATE.md files

**Acceptance Criteria:**
- `bash test/run.sh` exits 0 with all tests passing
- `shellcheck --severity=warning scripts/*.sh` exits 0
- All 5 Phase 3 success criteria verified
- No regressions in Phase 2 tests

## Verification

```bash
cd /Users/lgbarn/Personal/shipyard
# Run only integration tests
npx bats test/integration.bats
# Run full suite
bash test/run.sh
# Shellcheck all scripts
shellcheck --severity=warning scripts/state-read.sh scripts/state-write.sh scripts/checkpoint.sh
```
