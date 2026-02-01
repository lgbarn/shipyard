#!/usr/bin/env bats
load test_helper

@test "integration: write then read round-trip preserves state data" {
    setup_shipyard_dir
    mkdir -p .shipyard/phases

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
    mkdir -p .shipyard/phases

    bash "$STATE_WRITE" --phase 1 --position "Step one" --status planning
    bash "$STATE_WRITE" --phase 1 --position "Step two" --status building
    bash "$STATE_WRITE" --phase 1 --position "Step three" --status complete

    # All three history entries should be present
    run cat .shipyard/STATE.md
    assert_output --partial "Step one"
    assert_output --partial "Step two"
    assert_output --partial "Step three"
    assert_output --partial "## History"
}

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
