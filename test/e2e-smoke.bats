#!/usr/bin/env bats
load test_helper

# E2e setup: create a fully isolated temp git repo with .shipyard skeleton
setup() {
    setup_git_repo
    mkdir -p .shipyard/phases
}

# bats test_tags=integration
@test "e2e: structured write creates valid state then read returns JSON" {
    cd "$BATS_TEST_TMPDIR"

    # Write state
    run bash "$STATE_WRITE" --phase 1 --position "Smoke test" --status planning
    assert_success

    # Verify STATE.json contents
    assert_valid_state_json
    assert_json_field "schema" "3"
    assert_json_field "phase" "1"
    assert_json_field "status" "planning"

    # Read state back
    run bash "$STATE_READ"
    assert_success

    # Verify valid JSON with hookSpecificOutput
    assert_valid_json
    echo "$output" | jq -e '.hookSpecificOutput' >/dev/null
}

# bats test_tags=integration
@test "e2e: checkpoint create and prune lifecycle" {
    cd "$BATS_TEST_TMPDIR"

    # State-read needs STATE.json to exist
    bash "$STATE_WRITE" --phase 1 --position "Pre-checkpoint" --status in_progress

    # Create a checkpoint
    run bash "$CHECKPOINT" "smoke-test"
    assert_success
    assert_output --partial "Checkpoint created"

    # Verify checkpoint tag exists
    run git tag -l "shipyard-checkpoint-*"
    assert_success
    [ -n "$output" ]

    # Small delay so prune cutoff is strictly after the tag timestamp
    sleep 1

    # Prune all checkpoints (0 days = everything older than now)
    run bash "$CHECKPOINT" --prune 0
    assert_success
    assert_output --partial "Pruned 1 checkpoint"

    # Verify no checkpoint tags remain
    run git tag -l "shipyard-checkpoint-*"
    [ -z "$output" ]
}

# bats test_tags=integration
@test "e2e: recovery rebuilds state from artifacts" {
    cd "$BATS_TEST_TMPDIR"

    # Create phase artifacts that recovery can discover
    mkdir -p .shipyard/phases/2/plans
    echo "# Plan 2.1 -- smoke test artifact" > .shipyard/phases/2/plans/PLAN-1.1.md

    # Remove any existing state files
    rm -f .shipyard/STATE.json .shipyard/STATE.md

    # Recover state from artifacts
    run bash "$STATE_WRITE" --recover
    assert_success

    # Verify recovered STATE.json
    assert_valid_state_json
    assert_json_field "phase" "2"
    assert_json_field "schema" "3"

    # Read recovered state and verify valid JSON
    run bash "$STATE_READ"
    assert_success
    assert_valid_json
}
