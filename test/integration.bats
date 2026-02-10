#!/usr/bin/env bats
load test_helper

# bats test_tags=integration
@test "integration: write then read round-trip preserves state data" {
    setup_shipyard_dir
    mkdir -p .shipyard/phases

    # Write known state
    bash "$STATE_WRITE" --phase 3 --position "Integration testing" --status in_progress

    # Verify write succeeded
    [ -f .shipyard/STATE.json ]

    # Read state back via state-read.sh
    run bash "$STATE_READ"
    assert_success

    # Verify the JSON output contains what we wrote
    assert_output --partial "Phase: 3"
    assert_output --partial "Status: in_progress"

    # Verify it is valid JSON
    echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null
}

# bats test_tags=integration
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

# bats test_tags=integration
@test "integration: multiple writes accumulate history entries" {
    setup_shipyard_dir
    mkdir -p .shipyard/phases

    bash "$STATE_WRITE" --phase 1 --position "Step one" --status planning
    bash "$STATE_WRITE" --phase 1 --position "Step two" --status building
    bash "$STATE_WRITE" --phase 1 --position "Step three" --status complete

    # All three history entries should be present in HISTORY.md
    run cat .shipyard/HISTORY.md
    assert_output --partial "Step one"
    assert_output --partial "Step two"
    assert_output --partial "Step three"
}

# bats test_tags=integration
@test "integration: corrupt state detected then recovered via --recover" {
    setup_shipyard_dir
    mkdir -p .shipyard/phases/2/plans
    echo "# Plan 2.1" > .shipyard/phases/2/plans/PLAN-2.1.md

    # Write a corrupt STATE.json (malformed JSON)
    echo "not json{" > .shipyard/STATE.json

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

    # Verify recovered STATE.json has correct phase
    assert_json_field "phase" "2"
    assert_json_field "schema" "3"
}

# bats test_tags=integration
@test "integration: schema version 3 survives write-read cycle" {
    setup_shipyard_dir
    mkdir -p .shipyard/phases

    # Write with structured args
    bash "$STATE_WRITE" --phase 1 --position "Schema test" --status planning

    # Verify schema in STATE.json
    assert_json_field "schema" "3"

    # Read and verify JSON output includes the schema in context
    run bash "$STATE_READ"
    assert_success
    assert_output --partial "Schema: 3"
}

# bats test_tags=integration
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
    assert_json_field "phase" "3"
    assert_json_field "status" "complete"

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

# bats test_tags=integration
@test "integration: auto-migration from STATE.md to STATE.json on read" {
    setup_shipyard_with_state
    mkdir -p .shipyard/phases

    # Only STATE.md exists
    [ -f .shipyard/STATE.md ]
    [ ! -f .shipyard/STATE.json ]

    # Read triggers migration
    run bash "$STATE_READ"
    assert_success

    # Both files now exist
    [ -f .shipyard/STATE.md ]
    [ -f .shipyard/STATE.json ]
    [ -f .shipyard/HISTORY.md ]

    assert_valid_state_json
    assert_json_field "schema" "3"
    assert_json_field "phase" "1"
    assert_json_field "status" "building"
}
