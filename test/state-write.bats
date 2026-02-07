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

@test "state-write: structured write creates valid STATE.json" {
    setup_shipyard_dir
    run bash "$STATE_WRITE" --phase 2 --position "Building plan 1" --status in_progress
    assert_success
    assert_output --partial "STATE.json updated"

    assert_valid_state_json
    assert_json_field "schema" "3"
    assert_json_field "phase" "2"
    assert_json_field "status" "in_progress"
    assert_json_field "position" "Building plan 1"
}

@test "state-write: raw write replaces STATE.json content" {
    setup_shipyard_dir
    run bash "$STATE_WRITE" --raw '{"schema":3,"phase":1,"position":"Custom","status":"ready","updated_at":"2026-01-01T00:00:00Z","blocker":null}'
    assert_success
    assert_output --partial "raw write"

    assert_valid_state_json
    assert_json_field "position" "Custom"
}

@test "state-write: history preserved across writes" {
    setup_shipyard_dir
    bash "$STATE_WRITE" --phase 1 --position "First" --status planning
    bash "$STATE_WRITE" --phase 2 --position "Second" --status building

    [ -f .shipyard/HISTORY.md ]
    run cat .shipyard/HISTORY.md
    assert_output --partial "Phase 1"
    assert_output --partial "Phase 2"
}

@test "state-write: no arguments exits with error" {
    setup_shipyard_dir
    run bash "$STATE_WRITE"
    assert_failure
    assert_output --partial "No updates provided"
}

# --- Phase 3: atomic writes, schema version, exit codes ---

@test "state-write: structured write includes schema 3" {
    setup_shipyard_dir
    run bash "$STATE_WRITE" --phase 1 --position "test" --status ready
    assert_success
    assert_json_field "schema" "3"
}

@test "state-write: atomic write leaves no temp files" {
    setup_shipyard_dir
    bash "$STATE_WRITE" --phase 1 --position "test" --status ready
    run find .shipyard -name "*.tmp.*"
    assert_output ""
}

@test "state-write: missing .shipyard exits code 3" {
    cd "$BATS_TEST_TMPDIR"
    run bash "$STATE_WRITE" --phase 1 --position "test" --status ready
    assert_failure
    assert_equal "$status" 3
}

# --- Phase 3: recovery tests ---

@test "state-write: --recover rebuilds from phase artifacts" {
    setup_shipyard_dir
    mkdir -p .shipyard/phases/2/plans
    echo "# Plan" > .shipyard/phases/2/plans/PLAN-2.1.md

    run bash "$STATE_WRITE" --recover
    assert_success

    assert_valid_state_json
    assert_json_field "schema" "3"
    assert_json_field "phase" "2"
    assert_json_field "status" "planned"
    assert_output --partial "recovered"

    [ -f .shipyard/HISTORY.md ]
    run cat .shipyard/HISTORY.md
    assert_output --partial "recovered"
}

@test "state-write: --recover with no phases defaults to phase 1" {
    setup_shipyard_dir
    run bash "$STATE_WRITE" --recover
    assert_success

    assert_valid_state_json
    assert_json_field "phase" "1"
    assert_json_field "status" "ready"
}

@test "state-write: --recover detects completed phase from summary" {
    setup_shipyard_dir
    mkdir -p .shipyard/phases/3/results
    echo "# Summary" > .shipyard/phases/3/results/SUMMARY-3.1.md

    run bash "$STATE_WRITE" --recover
    assert_success

    assert_valid_state_json
    assert_json_field "phase" "3"
    assert_json_field "status" "complete"
}

@test "state-write: --raw rejects invalid JSON" {
    setup_shipyard_dir
    run bash "$STATE_WRITE" --raw "not valid json"
    assert_failure
    assert_output --partial "not valid JSON"
}
