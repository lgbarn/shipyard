---
phase: testing-foundation
plan: "2.1"
wave: 2
dependencies: ["1.1"]
must_haves:
  - Minimum 6 test cases for state-write.sh
  - At least 1 negative test (bad --phase rejected)
  - At least 1 negative test (bad --status rejected)
  - Structured write produces valid STATE.md with expected fields
  - History section preserved across multiple writes
files_touched:
  - test/state-write.bats
tdd: true
---

# PLAN-2.1: state-write.sh unit tests

## Context

`state-write.sh` (127 lines) validates `--phase` as integer, `--status` against an
enum, supports `--raw` mode, and preserves a History section across writes. It exits 1
on validation failure and requires a `.shipyard/` directory to exist.

Testing writes first is strategic: state-read tests (PLAN-2.3) will rely on
state-write to produce known STATE.md content.

---

<task id="1" files="test/state-write.bats" tdd="true">
  <action>
  Create `test/state-write.bats` with the following 3 validation/negative tests:

  ```bash
  #!/usr/bin/env bats
  load test_helper

  # --- Negative tests: validation ---

  @test "state-write: --phase rejects non-integer" {
      setup_shipyard_dir
      run bash "$STATE_WRITE" --phase "abc" --position "test" --status ready
      assert_failure
      assert_output --partial "positive integer"
  }

  @test "state-write: --status rejects invalid value" {
      setup_shipyard_dir
      run bash "$STATE_WRITE" --phase 1 --position "test" --status "bogus"
      assert_failure
      assert_output --partial "must be one of"
  }

  @test "state-write: fails without .shipyard directory" {
      cd "$BATS_TEST_TMPDIR"
      # Do NOT create .shipyard
      run bash "$STATE_WRITE" --phase 1 --position "test" --status ready
      assert_failure
      assert_output --partial ".shipyard"
  }
  ```
  </action>
  <verify>cd /tmp && npx --prefix "$PROJECT_ROOT" bats test/state-write.bats 2>/dev/null || "$PROJECT_ROOT/node_modules/.bin/bats" "$PROJECT_ROOT/test/state-write.bats"</verify>
  <done>3 negative tests pass: bad --phase, bad --status, and missing .shipyard all exit 1 with descriptive errors.</done>
</task>

<task id="2" files="test/state-write.bats" tdd="true">
  <action>
  Append 4 positive tests to `test/state-write.bats`:

  ```bash
  # --- Positive tests: structured writes ---

  @test "state-write: structured write creates valid STATE.md" {
      setup_shipyard_dir
      run bash "$STATE_WRITE" --phase 2 --position "Building plan 1" --status in_progress
      assert_success
      assert_output --partial "STATE.md updated"

      # Verify file content
      run cat .shipyard/STATE.md
      assert_output --partial "**Current Phase:** 2"
      assert_output --partial "**Status:** in_progress"
      assert_output --partial "**Current Position:** Building plan 1"
  }

  @test "state-write: raw write replaces STATE.md content" {
      setup_shipyard_dir
      run bash "$STATE_WRITE" --raw "# Custom State\nPhase 99"
      assert_success
      assert_output --partial "raw write"

      run cat .shipyard/STATE.md
      assert_output --partial "Custom State"
  }

  @test "state-write: history preserved across writes" {
      setup_shipyard_dir

      # First write
      bash "$STATE_WRITE" --phase 1 --position "First" --status planning
      # Second write
      bash "$STATE_WRITE" --phase 2 --position "Second" --status building

      run cat .shipyard/STATE.md
      assert_output --partial "## History"
      assert_output --partial "Phase 1"
      assert_output --partial "Phase 2"
  }

  @test "state-write: no arguments exits with error" {
      setup_shipyard_dir
      run bash "$STATE_WRITE"
      assert_failure
      assert_output --partial "No updates provided"
  }
  ```
  </action>
  <verify>cd "$PROJECT_ROOT" && ./node_modules/.bin/bats test/state-write.bats</verify>
  <done>All 7 state-write tests pass: 3 negative (bad phase, bad status, missing dir) + 4 positive (structured, raw, history, no-args).</done>
</task>
