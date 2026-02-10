#!/usr/bin/env bats
load test_helper

# --- Tag creation ---

# bats test_tags=integration
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

# bats test_tags=integration
@test "checkpoint: sanitizes label with special characters" {
    setup_git_repo
    run bash "$CHECKPOINT" 'my<label>&here;now'
    assert_success
    assert_output --partial "Checkpoint created"
    # Tag name should contain sanitized version (only alnum, dot, underscore, hyphen)
    assert_output --partial "mylabelherenow"
}

# bats test_tags=unit
@test "checkpoint: non-git-repo produces warning, exits 0" {
    cd "$BATS_TEST_TMPDIR"
    # No git init -- just a bare directory
    run bash "$CHECKPOINT" "test-label"
    assert_success
    assert_output --partial "Warning"
}

# --- Prune ---

# bats test_tags=integration
@test "checkpoint: --prune rejects non-integer days" {
    setup_git_repo
    run bash "$CHECKPOINT" --prune "abc"
    assert_failure
    assert_output --partial "positive integer"
}

# bats test_tags=integration
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

# --- Exit codes and dirty worktree ---

# bats test_tags=integration
@test "checkpoint: warns when worktree is dirty" {
    setup_git_repo
    # Modify a tracked file without committing
    echo "dirty" >> README.md
    run bash "$CHECKPOINT" "dirty-test"
    assert_success
    assert_output --partial "uncommitted changes"
}

# bats test_tags=integration
@test "checkpoint: no warning when worktree is clean" {
    setup_git_repo
    run bash "$CHECKPOINT" "clean-test"
    assert_success
    refute_output --partial "uncommitted"
}

# bats test_tags=integration
@test "checkpoint: label that sanitizes to empty string exits 1" {
    setup_git_repo
    run bash "$CHECKPOINT" '<>;&'
    assert_failure
    assert_output --partial "alphanumeric"
}
