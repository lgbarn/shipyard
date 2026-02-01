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
