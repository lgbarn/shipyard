---
phase: testing-foundation
plan: "2.2"
wave: 2
dependencies: ["1.1"]
must_haves:
  - Minimum 5 test cases for checkpoint.sh
  - At least 1 negative test (bad prune days rejected)
  - Tag creation verified in real git repo
  - Label sanitization verified (special chars stripped)
  - Prune removes old tags, keeps recent ones
  - Non-git-repo produces warning not error (exit 0)
files_touched:
  - test/checkpoint.bats
tdd: true
---

# PLAN-2.2: checkpoint.sh unit tests

## Context

`checkpoint.sh` (54 lines) creates and prunes git tags. It sanitizes labels,
validates prune days as integer, and treats git failures as warnings (exit 0).
Tests require a real git repo since we are testing actual tag operations.

---

<task id="1" files="test/checkpoint.bats" tdd="true">
  <action>
  Create `test/checkpoint.bats` with 3 tag-creation tests:

  ```bash
  #!/usr/bin/env bats
  load test_helper

  # --- Tag creation ---

  @test "checkpoint: creates tag with valid label" {
      setup_git_repo
      run bash "$CHECKPOINT" "pre-build-phase-2"
      assert_success
      assert_output --partial "Checkpoint created"
      assert_output --partial "pre-build-phase-2"

      # Verify tag exists in git
      run git tag -l "shipyard-checkpoint-*"
      assert_output --partial "pre-build-phase-2"
  }

  @test "checkpoint: sanitizes label with special characters" {
      setup_git_repo
      run bash "$CHECKPOINT" 'my<label>&here;now'
      assert_success
      assert_output --partial "Checkpoint created"
      # Tag name should contain sanitized version (only alnum, dot, underscore, hyphen)
      assert_output --partial "mylabelherenow"
  }

  @test "checkpoint: non-git-repo produces warning, exits 0" {
      cd "$BATS_TEST_TMPDIR"
      # No git init -- just a bare directory
      run bash "$CHECKPOINT" "test-label"
      assert_success
      assert_output --partial "Warning"
  }
  ```
  </action>
  <verify>cd "$PROJECT_ROOT" && ./node_modules/.bin/bats test/checkpoint.bats</verify>
  <done>3 tag-creation tests pass: valid label, sanitized label, and non-git warning.</done>
</task>

<task id="2" files="test/checkpoint.bats" tdd="true">
  <action>
  Append 2 prune tests to `test/checkpoint.bats`:

  ```bash
  # --- Prune ---

  @test "checkpoint: --prune rejects non-integer days" {
      setup_git_repo
      run bash "$CHECKPOINT" --prune "abc"
      assert_failure
      assert_output --partial "positive integer"
  }

  @test "checkpoint: --prune removes old tags and reports count" {
      setup_git_repo

      # Create a fake old checkpoint tag (simulate by directly creating with old-looking timestamp)
      git tag -a "shipyard-checkpoint-old-20200101T000000Z" -m "old checkpoint"
      # Create a recent tag
      bash "$CHECKPOINT" "recent"

      # Prune with 1 day window -- old tag should be removed, recent kept
      run bash "$CHECKPOINT" --prune 1
      assert_success
      assert_output --partial "Pruned"

      # Verify old tag is gone
      run git tag -l "shipyard-checkpoint-old-*"
      refute_output --partial "20200101"

      # Verify recent tag still exists
      run git tag -l "shipyard-checkpoint-recent-*"
      assert_success
      [ -n "$output" ]
  }
  ```
  </action>
  <verify>cd "$PROJECT_ROOT" && ./node_modules/.bin/bats test/checkpoint.bats</verify>
  <done>All 5 checkpoint tests pass: valid label, sanitized label, non-git warning, bad prune, and prune-removes-old.</done>
</task>
