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

# --- Positive tests: structured writes ---

@test "state-write: structured write creates valid STATE.md" {
    setup_shipyard_dir
    run bash "$STATE_WRITE" --phase 2 --position "Building plan 1" --status in_progress
    assert_success
    assert_output --partial "STATE.md updated"

    run cat .shipyard/STATE.md
    assert_output --partial "**Current Phase:** 2"
    assert_output --partial "**Status:** in_progress"
    assert_output --partial "**Current Position:** Building plan 1"
}

@test "state-write: raw write replaces STATE.md content" {
    setup_shipyard_dir
    run bash "$STATE_WRITE" --raw "# Custom State"
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
