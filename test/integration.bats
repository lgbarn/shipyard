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
