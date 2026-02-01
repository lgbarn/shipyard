---
phase: testing-foundation
plan: "3.1"
wave: 3
dependencies: ["2.1", "2.2", "2.3"]
must_haves:
  - Write-then-read round-trip test proves read-after-write consistency
  - Checkpoint create-then-prune integration test
  - Full suite runs via test/run.sh and exits 0
  - Total test count is at least 15 across all .bats files
files_touched:
  - test/integration.bats
tdd: true
---

# PLAN-3.1: Integration tests + final suite validation

## Context

This plan adds cross-script integration tests and validates the full suite meets
all Phase 2 success criteria. It depends on all Wave 2 plans being complete so
that the individual test files already exist and pass.

The two key integration scenarios:
1. **Write-then-read round-trip**: Use state-write.sh to set state, then run
   state-read.sh and verify the written data appears in the JSON output.
2. **Checkpoint lifecycle**: Create a checkpoint, then prune with a window that
   keeps it, verifying it survives.

Finally, task 3 runs the entire suite via `test/run.sh` and validates total
test count meets the minimum of 15.

---

<task id="1" files="test/integration.bats" tdd="true">
  <action>
  Create `test/integration.bats` with the write-then-read round-trip test:

  ```bash
  #!/usr/bin/env bats
  load test_helper

  @test "integration: write then read round-trip preserves state data" {
      setup_shipyard_dir

      # Write known state
      bash "$STATE_WRITE" --phase 3 --position "Integration testing" --status in_progress

      # Verify write succeeded
      [ -f .shipyard/STATE.md ]

      # Read state back via state-read.sh
      run bash "$STATE_READ"
      assert_success

      # Verify the JSON output contains what we wrote
      assert_output --partial "Phase"
      assert_output --partial "3"
      assert_output --partial "in_progress"

      # Verify it is valid JSON
      echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null
  }
  ```
  </action>
  <verify>cd "$PROJECT_ROOT" && ./node_modules/.bin/bats test/integration.bats</verify>
  <done>Write-then-read round-trip test passes, proving read-after-write consistency.</done>
</task>

<task id="2" files="test/integration.bats" tdd="true">
  <action>
  Append the checkpoint lifecycle integration test to `test/integration.bats`:

  ```bash
  @test "integration: checkpoint create then prune retains recent tags" {
      setup_git_repo

      # Create a checkpoint
      bash "$CHECKPOINT" "integration-test"

      # Verify it exists
      run git tag -l "shipyard-checkpoint-integration-test-*"
      assert_success
      [ -n "$output" ]

      # Prune with 30-day window -- our just-created tag should survive
      run bash "$CHECKPOINT" --prune 30
      assert_success

      # Verify the tag still exists after prune
      run git tag -l "shipyard-checkpoint-integration-test-*"
      assert_success
      [ -n "$output" ]
  }

  @test "integration: multiple writes accumulate history entries" {
      setup_shipyard_dir

      bash "$STATE_WRITE" --phase 1 --position "Step one" --status planning
      bash "$STATE_WRITE" --phase 1 --position "Step two" --status building
      bash "$STATE_WRITE" --phase 1 --position "Step three" --status complete

      # Read back via state-read
      run bash "$STATE_READ"
      assert_success

      # All three history entries should be present
      run cat .shipyard/STATE.md
      assert_output --partial "Step one"
      assert_output --partial "Step two"
      assert_output --partial "Step three"
      assert_output --partial "## History"
  }
  ```
  </action>
  <verify>cd "$PROJECT_ROOT" && ./node_modules/.bin/bats test/integration.bats</verify>
  <done>All 3 integration tests pass: round-trip, checkpoint lifecycle, and history accumulation.</done>
</task>

<task id="3" files="test/run.sh" tdd="false">
  <action>
  Run the full test suite via `test/run.sh` and verify:

  1. Exit code is 0
  2. Total test count is at least 15 (sum across all .bats files)
  3. At least 1 failure test exists per script (already guaranteed by plans 2.1-2.3)

  ```bash
  bash test/run.sh 2>&1 | tee /tmp/shipyard-test-output.txt
  echo "---"
  # Count total tests from TAP output
  grep -c "^ok " /tmp/shipyard-test-output.txt
  ```

  If any tests fail, debug and fix them. The runner must exit 0 cleanly.
  </action>
  <verify>bash test/run.sh && test "$(bash test/run.sh 2>&1 | grep -c '^ok ')" -ge 15</verify>
  <done>test/run.sh exits 0. At least 15 tests pass across all .bats files. Phase 2 success criteria met.</done>
</task>
