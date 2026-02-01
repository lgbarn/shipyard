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
